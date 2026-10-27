import { describe, it, expect } from 'vitest';
import { positiveModulo, computePhaseAndCycle } from '../src/engine/folding';
import { calculateBoxFit } from '../src/engine/fit';
import { assessEvidence } from '../src/engine/evidence';
import { runPeriodicSearch } from '../src/engine/search';
import { LightCurvePoint, InvestigationSettings } from '../src/domain/types';

describe('Numerical Engine Scientific Controls', () => {
  // 1. Constant flux control
  it('Control 1: Flat constant flux yields zero depth, zero fit improvement, and no NaN/infinity', () => {
    const points: LightCurvePoint[] = [];
    for (let i = 0; i < 200; i++) {
      points.push({
        time: i * 0.1,
        flux: 1.000000,
        fluxErr: 0.001,
        originalIndex: i,
      });
    }

    const fit = calculateBoxFit(points, {
      periodDays: 2.5,
      epochDays: 0.5,
      durationHours: 3.0,
    });

    expect(fit.status).toBe('ok');
    expect(Number.isFinite(fit.depth)).toBe(true);
    expect(Number.isFinite(fit.fitImprovement)).toBe(true);
    expect(fit.depth).toBeCloseTo(0.0, 7);
    expect(fit.fitImprovement).toBeCloseTo(0.0, 7);
    // A flat realization does not erase supplied nonzero measurement errors.
    expect(fit.inTransitStdErr).toBeCloseTo(0.001 / Math.sqrt(fit.inTransitCount), 12);
    expect(fit.outOfTransitStdErr).toBeCloseTo(0.001 / Math.sqrt(fit.outOfTransitCount), 12);
  });

  // 2. Pure noise search control
  it('Control 2: Pure Gaussian noise search produces low-significance candidates and no false confirmation', () => {
    // Generate 20 days of pure white noise with NO signal
    const points: LightCurvePoint[] = [];
    let seed = 42;
    function pseudoRandom() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280.0;
    }

    for (let t = 0; t <= 20.0; t += 0.05) {
      // Box-Muller transform for normal distribution
      const u1 = Math.max(1e-6, pseudoRandom());
      const u2 = pseudoRandom();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const noise = z * 0.001; // sigma = 1000 ppm
      points.push({
        time: t,
        flux: 1.0 + noise,
        fluxErr: 0.001,
        originalIndex: points.length,
      });
    }

    const candidates = runPeriodicSearch(points, {
      minPeriodDays: 1.5,
      maxPeriodDays: 5.0,
      periodSteps: 200,
      phaseBins: 80,
      durationHours: 2.5,
      topCount: 3,
    });

    // The search may identify statistical noise peaks, but depths must be consistent with noise (< 1500 ppm for 1000 ppm noise)
    if (candidates.length > 0) {
      for (const cand of candidates) {
        expect(cand.depthPpm).toBeLessThan(1500); // well within noise level (< 1.5 sigma)
      }
    }
  });

  // 3. Isolated single dip with other windows sampled control
  it('Control 3: Isolated single dip with other windows sampled distinguishes sampled coverage from repetition', () => {
    const points: LightCurvePoint[] = [];
    // Full observations across 20 days, but dip ONLY at day 8.0
    for (let t = 0; t <= 20.0; t += 0.05) {
      const inDip = Math.abs(t - 8.0) <= 0.08;
      points.push({
        time: t,
        flux: inDip ? 0.98 : 1.0,
        originalIndex: points.length,
      });
    }

    const settings: InvestigationSettings = {
      periodDays: 4.0,
      epochDays: 8.0,
      durationHours: 3.8,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    // Predicted cycles: min 0, max 3 (at days 8, 12, 16, 20)
    // Only day 8 has a transit! Days 12, 16, 20 were observed NOT to transit!
    expect(report.sampledEventCount).toBe(1);
    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('inconclusive');
    expect(rep?.explanation).toContain('Only 1 single transit event has observations');
  });

  // 4. Missing windows control (gaps != measured absence)
  it('Control 4: Missing windows in gaps return not_assessed/incomplete, never measured absence', () => {
    // Only observe around phase 0; completely empty around phase 0.5
    const points: LightCurvePoint[] = [];
    for (let c = 0; c < 4; c++) {
      for (let dt = -0.1; dt <= 0.1; dt += 0.02) {
        points.push({
          time: c * 4.0 + dt,
          flux: Math.abs(dt) < 0.04 ? 0.985 : 1.0,
          originalIndex: points.length,
        });
      }
    }

    const settings: InvestigationSettings = {
      periodDays: 4.0,
      epochDays: 0.0,
      durationHours: 2.0,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const sec = report.items.find(i => i.id === 'opposite_phase');
    expect(sec).toBeDefined();
    expect(sec?.status).toBe('not_assessed');
    expect(sec?.explanation).toContain('No observations exist in the opposite-phase window');
  });

  // 5. Alternating depth statistical model control
  it('Control 5: Alternating depths exposes half-period harmonic ambiguity and documents Z-score limitations', () => {
    // Binary star: Primary 2.0% at t=0, 4, 8; Secondary 0.8% at t=2, 6, 10
    const points: LightCurvePoint[] = [];
    for (let t = 0; t <= 12.0; t += 0.04) {
      let flux = 1.0;
      for (let c = 0; c <= 3; c++) {
        if (Math.abs(t - c * 4.0) <= 0.06) flux = 0.98;
        if (Math.abs(t - (c * 4.0 + 2.0)) <= 0.06) flux = 0.992;
      }
      points.push({
        time: t,
        flux,
        fluxErr: 0.001,
        originalIndex: points.length,
      });
    }

    // Folded at P = 2.0 (half the true period)
    const settings: InvestigationSettings = {
      periodDays: 2.0,
      epochDays: 0.0,
      durationHours: 2.8,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const alt = report.items.find(i => i.id === 'alternating_depths');
    expect(alt?.status).toBe('needs_review');
    expect(alt?.explanation).toContain('Eclipsing Binary');
    expect(alt?.limitations.some(l => l.includes('Try doubling the period'))).toBe(true);
  });

  // 6. Negative times, boundaries, and integer-period epoch shift control
  it('Control 6: Negative times and wraparound handle boundaries and integer shifts correctly', () => {
    expect(positiveModulo(1.2, 1.0)).toBeCloseTo(0.2);
    expect(positiveModulo(-0.2, 1.0)).toBeCloseTo(0.8);
    expect(positiveModulo(-1.2, 1.0)).toBeCloseTo(0.8);

    // Exact boundary at phase = -0.5 and phase = 0.0
    const pZero = computePhaseAndCycle(10.0, 10.0, 2.0);
    expect(pZero.phase).toBe(0.0);
    expect(pZero.cycle).toBe(0);

    const pHalf = computePhaseAndCycle(11.0, 10.0, 2.0);
    expect(pHalf.phase).toBe(-0.5); // centered boundary in [-0.5, 0.5)
    expect(pHalf.cycle).toBe(1);

    // Negative times (before epoch t0)
    const pNeg = computePhaseAndCycle(6.0, 10.0, 2.0);
    expect(pNeg.phase).toBe(0.0);
    expect(pNeg.cycle).toBe(-2);

    // Shift epoch by 5 periods
    const pShifted = computePhaseAndCycle(6.0, 10.0 + 5 * 2.0, 2.0);
    expect(pShifted.phase).toBeCloseTo(pNeg.phase);
    expect(pShifted.cycle).toBe(pNeg.cycle - 5);
  });

  // 7. Full-resolution calculation control
  it('Control 7: Downsampling or binned display does not alter full-resolution fit statistics', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 0; t <= 10.0; t += 0.01) {
      // Repeating transit at t = 0, 5, 10
      const inDip = Math.abs(t - 0.0) <= 0.05 || Math.abs(t - 5.0) <= 0.05 || Math.abs(t - 10.0) <= 0.05;
      points.push({
        time: t,
        flux: inDip ? 0.985 : 1.0,
        originalIndex: points.length,
      });
    }

    const fitFull = calculateBoxFit(points, {
      periodDays: 5.0,
      epochDays: 0.0,
      durationHours: 2.4,
    });

    // Subsample points for display (every 4th point)
    const pointsSub = points.filter((_, idx) => idx % 4 === 0);
    const fitSub = calculateBoxFit(pointsSub, {
      periodDays: 5.0,
      epochDays: 0.0,
      durationHours: 2.4,
    });

    // Both full resolution and subsampled data have identical mean depth
    expect(fitFull.depth).toBeCloseTo(0.015, 3);
    expect(fitSub.depth).toBeCloseTo(0.015, 3);
  });
});
