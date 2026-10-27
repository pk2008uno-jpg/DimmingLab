/**
 * DimmingLab - Scientific Evidence Diagnostic Engine
 * 
 * Generates the 5 structured evidence checks required for scientific evaluation:
 * 1. Repetition (cycle coverage, dimming evidence, and individual transit status)
 * 2. Alternating Depths (odd vs even cycle depth comparison)
 * 3. Opposite-Phase Dip (phase 0.5 secondary eclipse check)
 * 4. Sampling Gaps (predicted windows vs real observation coverage)
 * 5. Scientific Boundaries & Limitations (assumptions, geometric depth, follow-ups)
 * 
 * Explicitly separates:
 * - Predicted Window: Model window overlapping dataset observation baseline.
 * - Observation Coverage: Finite samples and temporal coverage (adequate / partial / absent).
 * - Dimming Evidence: Measured depth vs baseline uncertainty (dimming_detected / flat_baseline / ambiguous / unobserved).
 * - Pooled Periodic Fit: Combined phase-folded fit across all cycles.
 */

import {
  EvidenceItem,
  InvestigationSettings,
  LightCurvePoint,
  ObservationCoverage,
  DimmingEvidence,
  PredictedWindow,
} from '../domain/types';
import { computePhaseAndCycle } from './folding';
import { calculateBoxFit, BoxFitResult } from './fit';

export interface DetailedDiagnosticReport {
  items: EvidenceItem[];
  windows: PredictedWindow[];
  events: PredictedWindow[]; // Alias for backward compatibility
  predictedWindowCount: number;
  coveredWindowCount: number;
  adequateCoverageCount: number;
  partialCoverageCount: number;
  absentWindowCount: number;
  dimmingDetectedCount: number;
  flatBaselineCount: number;
  ambiguousDipCount: number;
  brighteningCount: number;
  insufficientSamplesCount: number;
  oddCyclesWithDimming: number;
  evenCyclesWithDimming: number;
  // Aliases for backward compatibility
  sampledEventCount: number;
  predictedEventCount: number;
}

/**
 * Assesses evidence across all 5 scientific diagnostics
 */
export function assessEvidence(
  points: readonly LightCurvePoint[],
  settings: InvestigationSettings,
  providedFit?: BoxFitResult
): DetailedDiagnosticReport {
  const primaryFit = providedFit ?? calculateBoxFit(points, settings);
  const { periodDays, epochDays, durationHours } = settings;
  const durationDays = durationHours / 24.0;

  if (points.length === 0 || primaryFit.status === 'invalid_parameters') {
    return {
      items: createFallbackEvidenceItems(),
      windows: [],
      events: [],
      predictedWindowCount: 0,
      coveredWindowCount: 0,
      adequateCoverageCount: 0,
      partialCoverageCount: 0,
      absentWindowCount: 0,
      dimmingDetectedCount: 0,
      flatBaselineCount: 0,
      ambiguousDipCount: 0,
      brighteningCount: 0,
      insufficientSamplesCount: 0,
      oddCyclesWithDimming: 0,
      evenCyclesWithDimming: 0,
      sampledEventCount: 0,
      predictedEventCount: 0,
    };
  }

  // 1. Determine dataset observation baseline [minTime, maxTime]
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const t = points[i].time;
    if (Number.isFinite(t)) {
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
  }

  // Baseline standard error / scatter of out-of-transit observations
  const outOfTransitScatter = primaryFit.outOfTransitCount > 1
    ? primaryFit.outOfTransitStdErr * Math.sqrt(primaryFit.outOfTransitCount)
    : 0;

  // 2. Identify predicted windows that overlap the dataset baseline
  // A cycle c has window [center - W/2, center + W/2] with center = epoch + c * period
  // It is in-baseline if (center + W/2 >= minTime) AND (center - W/2 <= maxTime)
  const minCycle = Math.floor((minTime - (epochDays + durationDays / 2.0)) / periodDays);
  const maxCycle = Math.ceil((maxTime - (epochDays - durationDays / 2.0)) / periodDays);

  const predictedWindows: PredictedWindow[] = [];

  for (let c = minCycle; c <= maxCycle; c++) {
    const centerTime = epochDays + c * periodDays;
    const windowStart = centerTime - durationDays / 2.0;
    const windowEnd = centerTime + durationDays / 2.0;

    // Check if the window interval overlaps the dataset baseline [minTime, maxTime]
    const overlapsBaseline = windowEnd >= minTime && windowStart <= maxTime;
    if (!overlapsBaseline) {
      // Out-of-baseline cycle is outside observation period, not a data gap
      continue;
    }

    const isEdgeTruncated = windowStart < minTime || windowEnd > maxTime;

    // Find points falling in this predicted window
    const inWindowPoints = points.filter(
      (p) => Number.isFinite(p.flux) && p.time >= windowStart && p.time <= windowEnd
    );
    const sampleCount = inWindowPoints.length;

    // Determine observation coverage independent of flux values
    let coverage: ObservationCoverage = 'absent';
    if (sampleCount === 0) {
      coverage = 'absent';
    } else {
      const visStart = Math.max(windowStart, minTime);
      const visEnd = Math.min(windowEnd, maxTime);
      const visDuration = Math.max(0.0001, visEnd - visStart);

      // Chronologically order points in window
      inWindowPoints.sort((a, b) => a.time - b.time);
      const timeSpan = sampleCount > 1
        ? inWindowPoints[inWindowPoints.length - 1].time - inWindowPoints[0].time
        : 0;

      // Find maximum interior gap between consecutive measurements
      let maxInteriorGap = 0;
      for (let i = 0; i < inWindowPoints.length - 1; i++) {
        const gap = inWindowPoints[i + 1].time - inWindowPoints[i].time;
        if (gap > maxInteriorGap) maxInteriorGap = gap;
      }

      // Coverage policy:
      // Adequate coverage requires:
      // 1. Not severely edge-truncated (visible window >= 60% of predicted duration)
      // 2. Observations span at least 50% of visible duration (guards against narrow bursts/clusters)
      // 3. No massive interior gap (> 40% of visible duration)
      // 4. Sample count >= 3
      const isAdequatelyVisible = !isEdgeTruncated || visDuration >= 0.6 * durationDays;
      const hasSufficientSpan = timeSpan >= 0.5 * visDuration;
      const hasAcceptableGaps = sampleCount > 1 ? maxInteriorGap <= 0.4 * visDuration : false;
      const hasMinimumSamples = sampleCount >= 3;

      if (isAdequatelyVisible && hasSufficientSpan && hasAcceptableGaps && hasMinimumSamples) {
        coverage = 'adequate';
      } else {
        coverage = 'partial';
      }
    }

    // Determine dimming evidence
    let evidence: DimmingEvidence = 'unobserved';
    let meanFlux: number | undefined;
    let depth: number | undefined;
    let depthStdErr: number | null = null;
    let significance: number | null = null;

    if (coverage === 'absent') {
      evidence = 'unobserved';
    } else if (sampleCount < 2) {
      evidence = 'insufficient_samples';
      meanFlux = inWindowPoints[0].flux;
      depth = primaryFit.outOfTransitMean - meanFlux;
    } else {
      meanFlux = inWindowPoints.reduce((sum, p) => sum + p.flux, 0) / sampleCount;
      depth = primaryFit.outOfTransitMean - meanFlux;

      // Estimate event depth standard error
      const hasErrors = inWindowPoints.every(p => p.fluxErr !== undefined && Number.isFinite(p.fluxErr) && p.fluxErr > 0);
      let eventStdErr = 0;

      if (hasErrors) {
        const sumSqErr = inWindowPoints.reduce((sum, p) => {
          const err = (p.fluxErr && p.fluxErr > 0) ? p.fluxErr : outOfTransitScatter;
          return sum + err * err;
        }, 0);
        eventStdErr = Math.sqrt(sumSqErr) / sampleCount;
      } else if (outOfTransitScatter > 0) {
        eventStdErr = outOfTransitScatter / Math.sqrt(sampleCount);
      } else {
        const inVariance = inWindowPoints.reduce((sum, p) => sum + (p.flux - meanFlux!) * (p.flux - meanFlux!), 0) / (sampleCount - 1);
        eventStdErr = inVariance > 0 ? Math.sqrt(inVariance / sampleCount) : 0;
      }

      const roundoffFloor = 64 * Number.EPSILON * Math.max(Math.abs(primaryFit.outOfTransitMean), Math.abs(meanFlux), Number.MIN_VALUE);
      if (!hasErrors && eventStdErr <= roundoffFloor) eventStdErr = 0;
      const baselineStdErr = primaryFit.outOfTransitStdErr;
      const combinedError = Math.hypot(eventStdErr, baselineStdErr);
      depthStdErr = Number.isFinite(combinedError) && combinedError > roundoffFloor ? combinedError : null;
      significance = (depthStdErr !== null && depthStdErr > 0) ? depth / depthStdErr : null;

      // Evidence classification:
      // Accounts for noise scatter, baseline uncertainty, and event depth
      if (depthStdErr !== null && depthStdErr > 0) {
        if (significance !== null && significance >= 2.2 && depth > 0) {
          evidence = 'dimming_detected';
        } else if (significance !== null && significance <= -2.2 && depth < 0) {
          evidence = 'brightening';
        } else if (Math.abs(depth) <= 1.8 * depthStdErr) {
          evidence = 'flat_baseline';
        } else {
          evidence = 'ambiguous_dip';
        }
      } else {
        // Noiseless idealized series (depthStdErr is null or 0)
        // Describe finite changes above floating-point roundoff; no amplitude-based flatness cutoff.
        if (depth > roundoffFloor) {
          evidence = 'dimming_detected';
        } else if (depth < -roundoffFloor) {
          evidence = 'brightening';
        } else {
          evidence = 'flat_baseline';
        }
      }
    }

    predictedWindows.push({
      cycle: c,
      centerTime,
      windowStart,
      windowEnd,
      overlapsBaseline,
      sampleCount,
      coverage,
      evidence,
      meanFlux,
      depth,
      depthStdErr,
      significance,
      isEdgeTruncated,
    });
  }

  // Summary counts
  const predictedWindowCount = predictedWindows.length;
  const coveredWindows = predictedWindows.filter(w => w.coverage !== 'absent');
  const coveredWindowCount = coveredWindows.length;
  const adequateCoverageCount = predictedWindows.filter(w => w.coverage === 'adequate').length;
  const partialCoverageCount = predictedWindows.filter(w => w.coverage === 'partial').length;
  const absentWindowCount = predictedWindows.filter(w => w.coverage === 'absent').length;

  const dimmingDetectedCount = predictedWindows.filter(w => w.evidence === 'dimming_detected').length;
  const flatBaselineCount = predictedWindows.filter(w => w.evidence === 'flat_baseline').length;
  const ambiguousDipCount = predictedWindows.filter(w => w.evidence === 'ambiguous_dip').length;
  const brighteningCount = predictedWindows.filter(w => w.evidence === 'brightening').length;
  const insufficientSamplesCount = predictedWindows.filter(w => w.evidence === 'insufficient_samples').length;

  const oddCyclesWithDimming = predictedWindows.filter(
    w => w.evidence === 'dimming_detected' && Math.abs(w.cycle) % 2 === 1
  ).length;
  const evenCyclesWithDimming = predictedWindows.filter(
    w => w.evidence === 'dimming_detected' && Math.abs(w.cycle) % 2 === 0
  ).length;

  // 3. Evaluate Diagnostics
  const repetitionItem = assessRepetition(
    {
      dimming: dimmingDetectedCount,
      flat: flatBaselineCount,
      ambiguous: ambiguousDipCount,
      brightening: brighteningCount,
      insufficient: insufficientSamplesCount,
      adequate: adequateCoverageCount,
      partial: partialCoverageCount,
      absent: absentWindowCount,
      predicted: predictedWindowCount,
      covered: coveredWindowCount,
    },
    predictedWindows,
    primaryFit,
    settings
  );

  const alternatingItem = assessAlternatingDepths(
    points,
    settings,
    predictedWindows
  );

  const oppositePhaseItem = assessOppositePhaseDip(
    points,
    settings,
    primaryFit
  );

  const samplingGapsItem = assessSamplingGaps(
    coveredWindowCount,
    absentWindowCount,
    predictedWindowCount,
    adequateCoverageCount,
    partialCoverageCount
  );

  const unassessedItem = assessUnassessedLimits(primaryFit);

  return {
    items: [repetitionItem, alternatingItem, oppositePhaseItem, samplingGapsItem, unassessedItem],
    windows: predictedWindows,
    events: predictedWindows, // backward compatibility
    predictedWindowCount,
    coveredWindowCount,
    adequateCoverageCount,
    partialCoverageCount,
    absentWindowCount,
    dimmingDetectedCount,
    flatBaselineCount,
    ambiguousDipCount,
    brighteningCount,
    insufficientSamplesCount,
    oddCyclesWithDimming,
    evenCyclesWithDimming,
    // Backward compatibility aliases
    sampledEventCount: dimmingDetectedCount,
    predictedEventCount: predictedWindowCount,
  };
}

/**
 * Diagnostic 1: Event Repetition Assessment
 */
function assessRepetition(
  counts: {
    dimming: number;
    flat: number;
    ambiguous: number;
    brightening: number;
    insufficient: number;
    adequate: number;
    partial: number;
    absent: number;
    predicted: number;
    covered: number;
  },
  windows: PredictedWindow[],
  primaryFit: BoxFitResult,
  settings: InvestigationSettings
): EvidenceItem {
  const { dimming, flat, ambiguous, brightening, adequate, partial, absent, predicted, covered } = counts;

  if (primaryFit.status === 'insufficient_data') {
    return {
      id: 'repetition',
      kind: 'repetition',
      status: 'inconclusive',
      title: 'Repetition Assessment',
      explanation: 'Insufficient in-transit observations across the dataset to assess periodic repetition.',
      metrics: [
        { name: 'Dimming Events', value: dimming, unit: 'events' },
        { name: 'Covered Windows', value: covered, unit: 'windows' },
        { name: 'Predicted Windows', value: predicted, unit: 'windows' },
      ],
      supportingView: 'time-series',
      limitations: ['Candidate window lacks sufficient in-transit data points.'],
    };
  }

  // Periodic brightening detection
  if (brightening >= 3 && dimming === 0) {
    return {
      id: 'repetition',
      kind: 'repetition',
      status: 'needs_review',
      title: 'Repetition Assessment (Periodic Brightening Detected)',
      explanation: `Observed ${brightening} predicted cycles showing statistically significant brightening (starlight increase). This pattern indicates stellar flares, pulsation, or an inverted signal, contradicting a transiting planet.`,
      metrics: [
        { name: 'Brightening Windows', value: brightening, unit: 'windows' },
        { name: 'Dimming Events', value: 0, unit: 'events' },
        { name: 'Observed Flat', value: flat, unit: 'windows' },
        { name: 'Ambiguous Dips', value: ambiguous, unit: 'windows' },
        { name: 'Adequate Coverage', value: adequate, unit: 'windows' },
        { name: 'Partial Coverage', value: partial, unit: 'windows' },
        { name: 'Absent (Gaps)', value: absent, unit: 'windows' },
        { name: 'Total Predicted', value: predicted, unit: 'windows' },
      ],
      supportingView: 'time-series',
      limitations: ['Starlight brightening contradicts an opaque transiting companion blocking light.'],
    };
  }

  // Genuine periodic repetition: >= 3 distinct transit events show significant dimming
  if (dimming >= 3) {
    return {
      id: 'repetition',
      kind: 'repetition',
      status: 'measured',
      title: 'Repetition Assessment',
      explanation: `Observed ${dimming} distinct transit windows with confirmed dimming across ${predicted} predicted cycles (${adequate} adequate coverage, ${partial} partial, ${absent} absent gaps; ${flat} observed flat${ambiguous > 0 ? `, ${ambiguous} ambiguous` : ''}${brightening > 0 ? `, ${brightening} brightening` : ''}). Consistent with a periodic repeating signal.`,
      metrics: [
        { name: 'Dimming Events', value: dimming, unit: 'events' },
        { name: 'Observed Flat', value: flat, unit: 'windows' },
        { name: 'Ambiguous Dips', value: ambiguous, unit: 'windows' },
        { name: 'Brightening Windows', value: brightening, unit: 'windows' },
        { name: 'Adequate Coverage', value: adequate, unit: 'windows' },
        { name: 'Partial Coverage', value: partial, unit: 'windows' },
        { name: 'Absent (Gaps)', value: absent, unit: 'windows' },
        { name: 'Total Predicted', value: predicted, unit: 'windows' },
      ],
      supportingView: 'time-series',
      limitations: [
        'Repetition confirms recurring dimming at this trial period, but does not identify the astrophysical object type.',
      ],
    };
  }

  // 2 events: marginal repetition
  if (dimming === 2) {
    return {
      id: 'repetition',
      kind: 'repetition',
      status: 'needs_review',
      title: 'Repetition Assessment',
      explanation: `Only 2 distinct transit events show dimming across ${covered} observed windows (${adequate} adequate, ${partial} partial; ${flat} observed flat). At least 3 events are required to confirm an orbital period and eliminate harmonic aliases (e.g. 2P or P/2).`,
      metrics: [
        { name: 'Dimming Events', value: 2, unit: 'events' },
        { name: 'Covered Windows', value: covered, unit: 'windows' },
        { name: 'Observed Flat', value: flat, unit: 'windows' },
        { name: 'Predicted Windows', value: predicted, unit: 'windows' },
      ],
      supportingView: 'time-series',
      limitations: ['Two events cannot uniquely distinguish the true orbital period from aliases.'],
    };
  }

  // 1 event: Single-event trap (Case C mono-transit / dropout)
  if (dimming === 1) {
    const singleDip = windows.find(w => w.evidence === 'dimming_detected');
    const dipCycle = singleDip ? singleDip.cycle : 0;

    let explanation = `Caution: Only 1 single transit event has observations! Phase-folding on a single event can produce an artificially neat alignment without proving any repetition.`;
    if (flat > 0) {
      explanation = `Caution: Only 1 single transit event has observations (cycle ${dipCycle}), while ${flat} other predicted windows were observed to be flat (${absent} fell in gaps). This evidence indicates a single transient event or instrumental dropout rather than a repeating ${settings.periodDays.toFixed(2)}-day orbit.`;
    }

    return {
      id: 'repetition',
      kind: 'repetition',
      status: 'inconclusive',
      title: 'Repetition Assessment (Single Event Trap)',
      explanation,
      metrics: [
        { name: 'Dimming Events', value: 1, unit: 'event' },
        { name: 'Observed Flat Windows', value: flat, unit: 'windows' },
        { name: 'Ambiguous Dips', value: ambiguous, unit: 'windows' },
        { name: 'Covered Windows', value: covered, unit: 'windows' },
        { name: 'Active Cycle', value: dipCycle, unit: 'cycle' },
      ],
      supportingView: 'time-series',
      limitations: [
        'A single event cannot confirm orbital periodicity. Other observed flat windows challenge the periodic hypothesis.',
      ],
    };
  }

  // 0 dimming events
  let explanation = 'Zero transit dimming events were observed at this trial period and epoch.';
  if (covered > 0) {
    explanation = `No dimming events meet the assessment criteria: ${covered} predicted windows were observed (${adequate} adequate, ${partial} partial), with ${flat} consistent with baseline, ${brightening} brightening, and ${ambiguous} ambiguous. Partial or insufficient observations do not establish absence of a dip.`;
  } else {
    explanation = `Zero transit windows were observed: all ${predicted} predicted cycles fall inside unobserved telescope gaps.`;
  }

  return {
    id: 'repetition',
    kind: 'repetition',
    status: 'inconclusive',
    title: 'Repetition Assessment',
    explanation,
    metrics: [
      { name: 'Dimming Events', value: 0, unit: 'events' },
      { name: 'Observed Flat', value: flat, unit: 'windows' },
      { name: 'Ambiguous Dips', value: ambiguous, unit: 'windows' },
      { name: 'Brightening Windows', value: brightening, unit: 'windows' },
      { name: 'Covered Windows', value: covered, unit: 'windows' },
      { name: 'Predicted Windows', value: predicted, unit: 'windows' },
    ],
    supportingView: 'time-series',
    limitations: ['No confirmed dimming events in candidate transit windows.'],
  };
}

/**
 * Diagnostic 2: Alternating Eclipse Depths (Odd vs Even comparison)
 */
function assessAlternatingDepths(
  points: readonly LightCurvePoint[],
  settings: InvestigationSettings,
  windows: PredictedWindow[]
): EvidenceItem {
  const coveredOdd = windows.filter(w => w.coverage !== 'absent' && Math.abs(w.cycle) % 2 === 1);
  const coveredEven = windows.filter(w => w.coverage !== 'absent' && Math.abs(w.cycle) % 2 === 0);

  if (coveredOdd.length === 0 || coveredEven.length === 0) {
    return {
      id: 'alternating_depths',
      kind: 'alternating_depths',
      status: 'inconclusive',
      title: 'Alternating Eclipse Depths',
      explanation: 'Cannot test alternating depths because either odd or even cycles lack observations.',
      metrics: [
        { name: 'Odd Observed Windows', value: coveredOdd.length, unit: 'windows' },
        { name: 'Even Observed Windows', value: coveredEven.length, unit: 'windows' },
      ],
      supportingView: 'phase-folded',
      limitations: ['Both odd and even cycles must be observed to compare alternating depths.'],
    };
  }

  // Fit odd and even cycles separately
  const oddPoints = points.filter(pt => {
    const { cycle } = computePhaseAndCycle(pt.time, settings.epochDays, settings.periodDays);
    return Math.abs(cycle) % 2 === 1;
  });

  const evenPoints = points.filter(pt => {
    const { cycle } = computePhaseAndCycle(pt.time, settings.epochDays, settings.periodDays);
    return Math.abs(cycle) % 2 === 0;
  });

  const oddFit = calculateBoxFit(oddPoints, settings);
  const evenFit = calculateBoxFit(evenPoints, settings);

  if (oddFit.status !== 'ok' || evenFit.status !== 'ok') {
    return {
      id: 'alternating_depths',
      kind: 'alternating_depths',
      status: 'inconclusive',
      title: 'Alternating Eclipse Depths',
      explanation: 'Insufficient in-transit points in either odd or even cycles to fit separate depths.',
      metrics: [
        { name: 'Odd Points In-Transit', value: oddFit.inTransitCount, unit: 'pts' },
        { name: 'Even Points In-Transit', value: evenFit.inTransitCount, unit: 'pts' },
      ],
      supportingView: 'phase-folded',
      limitations: ['Sub-cycles require sufficient samples to fit independent depths.'],
    };
  }

  const depthOdd = oddFit.depth;
  const depthEven = evenFit.depth;
  const depthDiff = Math.abs(depthOdd - depthEven);

  // Propagate pooled error from odd and even fit uncertainties
  const errOdd = oddFit.fractionalDepthStdErr;
  const errEven = evenFit.fractionalDepthStdErr;
  const pooledErr = errOdd !== null && errEven !== null ? Math.hypot(errOdd, errEven) : null;

  // Standardized difference (Z-score). If pooledErr is 0 (noiseless simulation), mark null / not-estimable.
  const diffSignificance = pooledErr !== null && pooledErr > 0 ? depthDiff / pooledErr : null;
  const depthRatio = Math.min(depthOdd, depthEven) / Math.max(depthOdd, depthEven || 1e-9);

  // Flag significant disparity:
  // Case 1: Error-bearing data with Z > 3.0 and ratio < 0.85
  // Case 2: Noiseless data with pooledErr <= 1e-6 and measurable difference > 0.001
  const isNoiselessDisparity = diffSignificance === null && depthDiff > 64 * Number.EPSILON && depthRatio < 0.85;
  const isStatisticalDisparity = diffSignificance !== null && diffSignificance > 3.0 && depthRatio < 0.85;

  if (isStatisticalDisparity || isNoiselessDisparity) {
    const sigLabel = diffSignificance !== null ? `${diffSignificance.toFixed(1)}σ standardized difference` : 'Not estimable (noiseless simulation)';
    return {
      id: 'alternating_depths',
      kind: 'alternating_depths',
      status: 'needs_review',
      title: 'Alternating Eclipse Depths (Impostor Flag)',
      explanation: `Alternating transit depths differ significantly (${(depthDiff * 100).toFixed(3)}% difference, ${sigLabel}). This evidence supports an Eclipsing Binary star system folded at half its true orbital period (alternating primary and secondary eclipses).`,
      metrics: [
        { name: 'Odd Cycle Depth', value: +(depthOdd * 100).toFixed(4), unit: '%' },
        { name: 'Even Cycle Depth', value: +(depthEven * 100).toFixed(4), unit: '%' },
        { name: 'Depth Difference', value: +(depthDiff * 100).toFixed(4), unit: '%' },
        {
          name: 'Standardized Diff',
          value: diffSignificance !== null ? +diffSignificance.toFixed(1) : null,
          unit: diffSignificance !== null ? 'σ' : null,
          formatted: diffSignificance !== null ? `${diffSignificance.toFixed(1)}σ` : 'Not estimable',
          isEstimable: diffSignificance !== null,
        },
      ],
      supportingView: 'phase-folded',
      limitations: [
        'Descriptive standardized difference assumes independent Gaussian scatter. It does not calibrate a false-positive probability after scanning multiple trial periods.',
        'Try doubling the period (2 × P) to test whether odd and even dips align as primary and secondary eclipses.',
      ],
    };
  }

  return {
    id: 'alternating_depths',
    kind: 'alternating_depths',
    status: 'measured',
    title: 'Alternating Eclipse Depths',
    explanation: `Odd and even transit depths are consistent (${(depthDiff * 100).toFixed(3)}% difference${diffSignificance !== null ? `, ${diffSignificance.toFixed(1)}σ` : ''}). No significant alternating difference detected.`,
    metrics: [
      { name: 'Odd Cycle Depth', value: +(depthOdd * 100).toFixed(4), unit: '%' },
      { name: 'Even Cycle Depth', value: +(depthEven * 100).toFixed(4), unit: '%' },
      { name: 'Depth Difference', value: +(depthDiff * 100).toFixed(4), unit: '%' },
      {
        name: 'Standardized Diff',
        value: diffSignificance !== null ? +diffSignificance.toFixed(1) : null,
        unit: diffSignificance !== null ? 'σ' : null,
        formatted: diffSignificance !== null ? `${diffSignificance.toFixed(1)}σ` : 'Consistent',
        isEstimable: diffSignificance !== null,
      },
    ],
    supportingView: 'phase-folded',
    limitations: [
      'Consistent depths support a transiting planet hypothesis, but twin stars with equal surface temperatures also produce equal depths.',
    ],
  };
}

/**
 * Diagnostic 3: Opposite-Phase Dip (Phase 0.5 Secondary Eclipse)
 */
function assessOppositePhaseDip(
  points: readonly LightCurvePoint[],
  settings: InvestigationSettings,
  primaryFit: BoxFitResult
): EvidenceItem {
  const secondaryEpoch = settings.epochDays + 0.5 * settings.periodDays;
  const secondaryFit = calculateBoxFit(points, {
    periodDays: settings.periodDays,
    epochDays: secondaryEpoch,
    durationHours: settings.durationHours,
  });

  if (secondaryFit.status === 'insufficient_data') {
    return {
      id: 'opposite_phase',
      kind: 'opposite_phase',
      status: 'not_assessed',
      title: 'Opposite-Phase Dip (Secondary Eclipse)',
      explanation: 'No observations exist in the opposite-phase window (phase = 0.5). Secondary eclipse status cannot be assessed.',
      metrics: [
        { name: 'Points at Phase 0.5', value: secondaryFit.inTransitCount, unit: 'pts' },
      ],
      supportingView: 'phase-folded',
      limitations: [
        'Gaps at phase 0.5 prevent checking for a secondary eclipse or reflection effect.',
      ],
    };
  }

  if (secondaryFit.depth > 0 && secondaryFit.fitImprovement > 0) {
    const secondarySignificance = secondaryFit.significance;

    if (secondarySignificance !== null && secondarySignificance > 3.0) {
      return {
        id: 'opposite_phase',
        kind: 'opposite_phase',
        status: 'needs_review',
        title: 'Opposite-Phase Dip (Secondary Eclipse Detected)',
        explanation: `Significant dimming (${(secondaryFit.depth * 100).toFixed(3)}%, ${secondarySignificance.toFixed(1)}σ) detected at phase 0.5. This evidence supports a secondary eclipse caused by a luminous stellar companion passing behind the host star.`,
        metrics: [
          { name: 'Secondary Depth', value: +(secondaryFit.depth * 100).toFixed(4), unit: '%' },
          { name: 'Secondary Significance', value: +secondarySignificance.toFixed(1), unit: 'σ' },
          { name: 'Primary Depth', value: +(primaryFit.depth * 100).toFixed(4), unit: '%' },
        ],
        supportingView: 'phase-folded',
        limitations: [
          'Exoplanets rarely exhibit secondary optical eclipses deeper than tens of ppm. A deep secondary eclipse strongly supports a stellar binary companion.',
        ],
      };
    }
  }

  return {
    id: 'opposite_phase',
    kind: 'opposite_phase',
    status: 'measured',
    title: 'Opposite-Phase Dip (Secondary Eclipse)',
    explanation: 'No significant secondary dip is observed at phase 0.5.',
    metrics: [
      { name: 'Secondary Depth', value: +(secondaryFit.depth * 100).toFixed(4), unit: '%' },
      { name: 'Points Sampled', value: secondaryFit.inTransitCount, unit: 'pts' },
    ],
    supportingView: 'phase-folded',
    limitations: [
      'Absence of an optical secondary eclipse supports a non-luminous planet hypothesis, though eccentric binary orbits can place secondary eclipses away from phase 0.5.',
    ],
  };
}

/**
 * Diagnostic 4: Observation Gaps Assessment
 * Gaps represent ONLY windows where observation coverage was absent.
 * Observed flat windows count as observed, never as gaps!
 */
function assessSamplingGaps(
  coveredCount: number,
  absentCount: number,
  predictedCount: number,
  adequateCount: number,
  partialCount: number
): EvidenceItem {
  const missingFraction = predictedCount > 0 ? absentCount / predictedCount : 0;

  if (absentCount === 0) {
    return {
      id: 'sampling_gaps',
      kind: 'sampling_gaps',
      status: 'measured',
      title: 'Observation Coverage & Gaps',
      explanation: `All ${predictedCount} predicted windows contain observations (${adequateCount} adequate, ${partialCount} partial; 0 unobserved gaps). Measurements in a window do not establish continuous coverage of its full duration.`,
      metrics: [
        { name: 'Covered Windows', value: coveredCount, unit: 'windows' },
        { name: 'Adequate Coverage', value: adequateCount, unit: 'windows' },
        { name: 'Partial Coverage', value: partialCount, unit: 'windows' },
        { name: 'Unobserved Gaps', value: 0, unit: 'gaps' },
      { name: 'Windows With Data', value: 100, unit: '%' },
      ],
      supportingView: 'time-series',
      limitations: [
        'Partial coverage and intervals between samples can hide dimming. Adequate coverage is an explicit sampling heuristic, not a guarantee that every possible transit was detected.',
      ],
    };
  }

  if (missingFraction > 0.5) {
    return {
      id: 'sampling_gaps',
      kind: 'sampling_gaps',
      status: 'needs_review',
      title: 'Observation Coverage & Gaps',
      explanation: `High gap frequency: ${absentCount} out of ${predictedCount} predicted transit windows (${Math.round(missingFraction * 100)}%) fall within unobserved telescope gaps.`,
      metrics: [
        { name: 'Covered Windows', value: coveredCount, unit: 'windows' },
        { name: 'Adequate Coverage', value: adequateCount, unit: 'windows' },
        { name: 'Partial Coverage', value: partialCount, unit: 'windows' },
        { name: 'Unobserved Gaps', value: absentCount, unit: 'gaps' },
        { name: 'Missing Ratio', value: Math.round(missingFraction * 100), unit: '%' },
      ],
      supportingView: 'time-series',
      limitations: [
        'Extensive observation gaps can cause false period alignments where a single transient event folds into non-existent repetitions.',
      ],
    };
  }

  return {
    id: 'sampling_gaps',
    kind: 'sampling_gaps',
    status: 'measured',
    title: 'Observation Coverage & Gaps',
    explanation: `Good observation continuity: ${coveredCount} of ${predictedCount} predicted transit windows contain photometric observations (${absentCount} unobserved gap${absentCount > 1 ? 's' : ''}).`,
    metrics: [
      { name: 'Covered Windows', value: coveredCount, unit: 'windows' },
      { name: 'Adequate Coverage', value: adequateCount, unit: 'windows' },
      { name: 'Partial Coverage', value: partialCount, unit: 'windows' },
      { name: 'Unobserved Gaps', value: absentCount, unit: 'gaps' },
      { name: 'Continuity', value: Math.round((1 - missingFraction) * 100), unit: '%' },
    ],
    supportingView: 'time-series',
    limitations: [
      'Gaps occur during spacecraft downlink or orbit turns; always check raw time-series to verify real events.',
    ],
  };
}

/**
 * Diagnostic 5: Scientific Boundaries & Follow-Up Limitations
 */
function assessUnassessedLimits(primaryFit: BoxFitResult): EvidenceItem {
  const depthPct = +(primaryFit.depth * 100).toFixed(4);

  return {
    id: 'unassessed_limits',
    kind: 'unassessed_limits',
    status: 'not_assessed',
    title: 'Scientific Boundaries & Follow-Up Tests',
    explanation: 'Single-band starlight dimming provides candidate evidence, but cannot definitively confirm a planet without external verification:',
    metrics: [
      { name: 'Selected Window Depth', value: depthPct, unit: '%' },
      { name: 'Geometric (Rp/R*)^2', value: depthPct, unit: '%', formatted: `~${depthPct}% (simplified)` },
      { name: 'Radial Velocity Mass', value: null, unit: 'm/s', formatted: 'Possible test (measures mass)' },
      { name: 'Centroid Shift Blend', value: null, unit: 'arcsec', formatted: 'Possible test (checks blend)' },
    ],
    supportingView: null,
    limitations: [
      'Geometric Depth vs Physical Depth: (Rp/R*)^2 is a simplified estimate assuming a spherical dark disc crossing a uniform spherical star. It neglects stellar limb darkening and potential flux dilution from nearby background stars.',
      'App Selected-Window Mean vs Reference Depth: The selected box depth is the empirical average flux deficit in the chosen window, which may differ slightly from published limb-darkened model fits.',
      'Mass vs Radius Ambiguity: Photometric dimming measures projected area ratio, not mass. A brown dwarf or late M-dwarf star can have the same physical radius as a gas giant planet.',
      'Follow-Up Observations: High-resolution radial velocity spectroscopy (to measure companion mass) and speckle imaging (to rule out blended background binaries) are standard avenues to test and validate candidate systems.',
    ],
  };
}

function createFallbackEvidenceItems(): EvidenceItem[] {
  return [
    {
      id: 'repetition',
      kind: 'repetition',
      status: 'inconclusive',
      title: 'Repetition Assessment',
      explanation: 'No valid data loaded or parameters out of bounds.',
      metrics: [],
      supportingView: null,
      limitations: [],
    },
  ];
}
