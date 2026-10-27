/**
 * DimmingLab - Bounded Box-Least-Squares (BLS) Style Periodic Search Engine
 * Uses phase-binned circular prefix sums for fast O(N_trials * N_bins) period detection.
 * Evaluates harmonic alternatives (half-period, double-period) to expose ambiguities.
 */

import { LightCurvePoint, SearchCandidate } from '../domain/types';
import { positiveModulo } from './folding';
import { calculateBoxFit } from './fit';

export interface SearchConfig {
  minPeriodDays: number;
  maxPeriodDays: number;
  periodSteps: number; // e.g. 800 - 1500
  phaseBins: number; // e.g. 100 - 150
  durationHours: number;
  topCount?: number;
}

export interface GridEvaluation {
  periodDays: number;
  epochDays: number;
  score: number;
  depth: number;
}

/**
 * Searches for periodic repeating box-like dips across a frequency grid.
 */
export function runPeriodicSearch(
  points: readonly LightCurvePoint[],
  config: SearchConfig,
  onProgress?: (progressPercent: number, trialCount: number, best?: SearchCandidate) => boolean // return true to cancel
): SearchCandidate[] {
  const { minPeriodDays, maxPeriodDays, periodSteps, phaseBins, durationHours } = config;
  const topCount = config.topCount ?? 5;

  if (points.length < 20 || minPeriodDays >= maxPeriodDays || periodSteps <= 0) {
    return [];
  }

  // Pre-filter valid points and compute total stats
  const validPoints: Array<{ time: number; flux: number; weight: number }> = [];
  let sumWeightAll = 0;
  let sumWeightedFluxAll = 0;
  const finitePoints = points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.flux));
  const completeErrors = finitePoints.every(p => p.fluxErr !== undefined && Number.isFinite(p.fluxErr) &&
    p.fluxErr > 0 && Number.isFinite(1 / (p.fluxErr * p.fluxErr)));

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (!Number.isFinite(pt.flux) || !Number.isFinite(pt.time)) continue;

    const w = completeErrors ? 1.0 / (pt.fluxErr! * pt.fluxErr!) : 1.0;
    validPoints.push({ time: pt.time, flux: pt.flux, weight: w });
    sumWeightAll += w;
    sumWeightedFluxAll += w * pt.flux;
  }

  if (validPoints.length < 20 || sumWeightAll <= 0) {
    return [];
  }

  const meanAll = sumWeightedFluxAll / sumWeightAll;

  // Compute total flat variance (sum of w_i * (y_i - meanAll)^2)
  let flatWRSS = 0;
  for (let i = 0; i < validPoints.length; i++) {
    const diff = validPoints[i].flux - meanAll;
    flatWRSS += validPoints[i].weight * diff * diff;
  }

  // Frequency grid: linear in frequency to maintain uniform phase resolution
  const fMin = 1.0 / maxPeriodDays;
  const fMax = 1.0 / minPeriodDays;
  const fStep = (fMax - fMin) / Math.max(1, periodSteps - 1);

  const binCounts = new Float64Array(phaseBins);
  const binWeights = new Float64Array(phaseBins);
  const binWeightedFlux = new Float64Array(phaseBins);

  const candidates: GridEvaluation[] = [];
  let bestCandidate: SearchCandidate | undefined;

  const durationDays = durationHours / 24.0;
  const refTime = validPoints[0].time;

  // Track progress reporting interval
  const reportInterval = Math.max(10, Math.floor(periodSteps / 40));

  for (let step = 0; step < periodSteps; step++) {
    const freq = fMin + step * fStep;
    const trialPeriod = 1.0 / freq;
    const durationPhase = durationDays / trialPeriod;

    // Skip if duration is >= 40% of period (not a transit-like box)
    if (durationPhase >= 0.4 || durationPhase <= 0) continue;

    const binWidth = 1.0 / phaseBins;
    const nBinsInTransit = Math.max(1, Math.round(durationPhase / binWidth));

    // Clear bins
    binCounts.fill(0);
    binWeights.fill(0);
    binWeightedFlux.fill(0);

    // Bin the points
    for (let i = 0; i < validPoints.length; i++) {
      const pt = validPoints[i];
      const norm = (pt.time - refTime) * freq;
      // Phase in [0, 1)
      const phi = positiveModulo(norm, 1.0);
      const binIdx = Math.floor(phi * phaseBins) % phaseBins;

      binCounts[binIdx] += 1;
      binWeights[binIdx] += pt.weight;
      binWeightedFlux[binIdx] += pt.weight * pt.flux;
    }

    // Circular prefix sums to evaluate all window start positions
    // Double array for circular wraparound
    const circWeights = new Float64Array(phaseBins + nBinsInTransit);
    const circWFlux = new Float64Array(phaseBins + nBinsInTransit);
    const circCounts = new Int32Array(phaseBins + nBinsInTransit);

    for (let b = 0; b < phaseBins; b++) {
      circWeights[b] = binWeights[b];
      circWFlux[b] = binWeightedFlux[b];
      circCounts[b] = binCounts[b];
    }
    for (let b = 0; b < nBinsInTransit; b++) {
      circWeights[phaseBins + b] = binWeights[b];
      circWFlux[phaseBins + b] = binWeightedFlux[b];
      circCounts[phaseBins + b] = binCounts[b];
    }

    // Sliding window of size nBinsInTransit
    let windowWeight = 0;
    let windowWFlux = 0;
    let windowCount = 0;

    for (let b = 0; b < nBinsInTransit; b++) {
      windowWeight += circWeights[b];
      windowWFlux += circWFlux[b];
      windowCount += circCounts[b];
    }

    let bestTrialScore = 0;
    let bestTrialEpoch = refTime;
    let bestTrialDepth = 0;

    for (let startBin = 0; startBin < phaseBins; startBin++) {
      if (startBin > 0) {
        windowWeight += circWeights[startBin + nBinsInTransit - 1] - circWeights[startBin - 1];
        windowWFlux += circWFlux[startBin + nBinsInTransit - 1] - circWFlux[startBin - 1];
        windowCount += circCounts[startBin + nBinsInTransit - 1] - circCounts[startBin - 1];
      }

      // Check sufficient points in and out of window
      const countOut = validPoints.length - windowCount;
      if (windowCount < 3 || countOut < 10) continue;

      const wOut = sumWeightAll - windowWeight;
      if (wOut <= 0 || windowWeight <= 0) continue;

      const meanIn = windowWFlux / windowWeight;
      const meanOut = (sumWeightedFluxAll - windowWFlux) / wOut;
      const depth = meanOut - meanIn;

      // Reject brightenings! Must be a dimming (depth > 0)
      if (depth <= 0) continue;

      // Fit improvement score: Delta WRSS = windowWeight * (meanIn - meanAll)^2 + wOut * (meanOut - meanAll)^2
      const diffIn = meanIn - meanAll;
      const diffOut = meanOut - meanAll;
      const score = windowWeight * diffIn * diffIn + wOut * diffOut * diffOut;

      if (score > bestTrialScore) {
        bestTrialScore = score;
        bestTrialDepth = depth;
        // Phase center of window
        const centerBin = startBin + nBinsInTransit / 2.0;
        const centerPhase = (centerBin / phaseBins) % 1.0;
        bestTrialEpoch = refTime + centerPhase * trialPeriod;
      }
    }

    if (bestTrialScore > 0) {
      candidates.push({
        periodDays: trialPeriod,
        epochDays: bestTrialEpoch,
        score: bestTrialScore,
        depth: bestTrialDepth,
      });
    }

    if (step % reportInterval === 0 && onProgress) {
      const pct = Math.round(((step + 1) / periodSteps) * 100);
      if (bestTrialScore > (bestCandidate?.score ?? 0)) {
        bestCandidate = {
          periodDays: trialPeriod,
          epochDays: bestTrialEpoch,
          durationHours,
          depthPpm: bestTrialDepth * 1_000_000,
          fitImprovement: bestTrialScore,
          score: bestTrialScore,
        };
      }
      const shouldCancel = onProgress(pct, step + 1, bestCandidate);
      if (shouldCancel) {
        return [];
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Peak picking with peak suppression (avoid returning duplicate periods within 2% of each other)
  const peaks: GridEvaluation[] = [];
  for (const c of candidates) {
    const isNearby = peaks.some(p => Math.abs(p.periodDays - c.periodDays) / p.periodDays < 0.02);
    if (!isNearby) {
      peaks.push(c);
      if (peaks.length >= topCount) break;
    }
  }

  // Refine top candidates using exact unbinned calculateBoxFit
  const results: SearchCandidate[] = [];
  for (const peak of peaks) {
    const fit = calculateBoxFit(points, {
      periodDays: peak.periodDays,
      epochDays: peak.epochDays,
      durationHours,
    });

    results.push({
      periodDays: +peak.periodDays.toFixed(6),
      epochDays: +peak.epochDays.toFixed(6),
      durationHours,
      depthPpm: Math.round(fit.depthPpm ?? (fit.depth * 1e6)),
      fitImprovement: +fit.fitImprovement.toFixed(2),
      score: +peak.score.toFixed(2),
      isHarmonic: null,
    });
  }

  // Add harmonic tags if any candidate is close to 0.5x or 2.0x of the primary candidate
  if (results.length > 1) {
    const primaryP = results[0].periodDays;
    for (let i = 1; i < results.length; i++) {
      const ratio = results[i].periodDays / primaryP;
      if (Math.abs(ratio - 0.5) < 0.03) {
        results[i].isHarmonic = 'half_period';
      } else if (Math.abs(ratio - 2.0) < 0.05) {
        results[i].isHarmonic = 'double_period';
      }
    }
  }

  return results;
}
