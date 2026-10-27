import { describe, it, expect } from 'vitest';
import { positiveModulo, computePhaseAndCycle, foldDataset } from '../src/engine/folding';
import { calculateBoxFit } from '../src/engine/fit';
import { assessEvidence } from '../src/engine/evidence';
import { hashLightCurvePoints } from '../src/engine/hash';
import { LightCurvePoint, InvestigationSettings } from '../src/domain/types';

describe('Phase Folding Engine', () => {
  it('handles positive and negative numbers with positiveModulo', () => {
    expect(positiveModulo(0.2, 1.0)).toBeCloseTo(0.2);
    expect(positiveModulo(-0.2, 1.0)).toBeCloseTo(0.8);
    expect(positiveModulo(-1.2, 1.0)).toBeCloseTo(0.8);
    expect(positiveModulo(1.0, 1.0)).toBe(0);
    expect(positiveModulo(0, 1.0)).toBe(0);
  });

  it('centers phase strictly in [-0.5, 0.5)', () => {
    const p1 = computePhaseAndCycle(10.0, 10.0, 2.0);
    expect(p1.phase).toBe(0.0);
    expect(p1.cycle).toBe(0);

    const p2 = computePhaseAndCycle(11.0, 10.0, 2.0);
    // 11 is exactly half-way (period 2), norm = 0.5, norm+0.5 = 1.0, modulo 1 = 0, phase = -0.5
    expect(p2.phase).toBe(-0.5);
    expect(p2.cycle).toBe(1);

    const p3 = computePhaseAndCycle(10.5, 10.0, 2.0);
    expect(p3.phase).toBeCloseTo(0.25);
    expect(p3.cycle).toBe(0);

    // Negative times before t0
    const p4 = computePhaseAndCycle(8.0, 10.0, 2.0);
    expect(p4.phase).toBe(0.0);
    expect(p4.cycle).toBe(-1);

    const p5 = computePhaseAndCycle(7.5, 10.0, 2.0);
    expect(p5.phase).toBeCloseTo(-0.25);
    expect(p5.cycle).toBe(-1);
  });

  it('preserves phase when epoch is shifted by an integer number of periods', () => {
    const orig = computePhaseAndCycle(15.3, 10.0, 2.5);
    const shifted = computePhaseAndCycle(15.3, 10.0 + 3 * 2.5, 2.5);
    expect(orig.phase).toBeCloseTo(shifted.phase);
    expect(orig.cycle).toBe(shifted.cycle + 3);
  });

  it('folds an entire dataset into FoldedPoints', () => {
    const rawPts: LightCurvePoint[] = [
      { time: 10.0, flux: 1.0, originalIndex: 0 },
      { time: 11.0, flux: 0.98, originalIndex: 1 },
      { time: 12.0, flux: 1.0, originalIndex: 2 },
    ];
    const folded = foldDataset(rawPts, 10.0, 2.0);
    expect(folded.length).toBe(3);
    expect(folded[0].phase).toBe(0.0);
    expect(folded[0].cycle).toBe(0);
    expect(folded[1].phase).toBe(-0.5);
    expect(folded[1].cycle).toBe(1);
    expect(folded[2].phase).toBe(0.0);
    expect(folded[2].cycle).toBe(1);
  });

  it('throws for non-positive or non-finite period', () => {
    expect(() => computePhaseAndCycle(10.0, 10.0, 0)).toThrow();
    expect(() => computePhaseAndCycle(10.0, 10.0, -2.5)).toThrow();
    expect(() => computePhaseAndCycle(10.0, 10.0, NaN)).toThrow();
  });
});

describe('Selected-Window Box Fit Engine', () => {
  it('returns zero depth and zero fit improvement on flat constant data', () => {
    const points: LightCurvePoint[] = [];
    for (let i = 0; i < 50; i++) {
      points.push({
        time: i * 0.1,
        flux: 1.0,
        originalIndex: i,
      });
    }

    const fit = calculateBoxFit(points, {
      periodDays: 1.0,
      epochDays: 0.0,
      durationHours: 2.4, // 0.1 days = 0.1 phase width
    });

    expect(fit.status).toBe('ok');
    expect(fit.depth).toBeCloseTo(0.0, 6);
    expect(fit.fitImprovement).toBeCloseTo(0.0, 6);
    expect(fit.isBrightening).toBe(false);
  });

  it('recovers exact two-level box model depth and in/out means', () => {
    // Period = 2.0 days, epoch = 1.0, duration = 4.8 hours = 0.2 days (phase width = 0.1)
    // In-transit points within |phase| <= 0.05
    const points: LightCurvePoint[] = [];
    for (let i = 0; i < 100; i++) {
      const time = i * 0.04;
      const { phase } = computePhaseAndCycle(time, 1.0, 2.0);
      const inTransit = Math.abs(phase) <= 0.05;
      const flux = inTransit ? 0.98 : 1.00; // 2% depth
      points.push({
        time,
        flux,
        originalIndex: i,
      });
    }

    const fit = calculateBoxFit(points, {
      periodDays: 2.0,
      epochDays: 1.0,
      durationHours: 4.8,
    });

    expect(fit.status).toBe('ok');
    expect(fit.inTransitMean).toBeCloseTo(0.98, 4);
    expect(fit.outOfTransitMean).toBeCloseTo(1.00, 4);
    expect(fit.depth).toBeCloseTo(0.02, 4);
    expect(fit.depthPercent).toBeCloseTo(2.0, 2);
    expect(fit.isBrightening).toBe(false);
    expect(fit.fitImprovement).toBeGreaterThan(0.001);
  });

  it('never assigns positive dimming score to a brightening', () => {
    // Generate star brightening (+2% in-transit flux instead of dip)
    const points: LightCurvePoint[] = [];
    for (let i = 0; i < 100; i++) {
      const time = i * 0.04;
      const { phase } = computePhaseAndCycle(time, 1.0, 2.0);
      const inTransit = Math.abs(phase) <= 0.05;
      const flux = inTransit ? 1.02 : 1.00; // brightening
      points.push({
        time,
        flux,
        originalIndex: i,
      });
    }

    const fit = calculateBoxFit(points, {
      periodDays: 2.0,
      epochDays: 1.0,
      durationHours: 4.8,
    });

    expect(fit.status).toBe('brightening_detected');
    expect(fit.isBrightening).toBe(true);
    expect(fit.depth).toBeLessThan(0);
    expect(fit.fitImprovement).toBe(0); // fit improvement strictly zero for brightening
  });

  it('returns insufficient_data when in-transit points are too few', () => {
    // Only 1 point inside transit window
    const points: LightCurvePoint[] = [
      { time: 1.0, flux: 0.98, originalIndex: 0 },
      { time: 1.5, flux: 1.0, originalIndex: 1 },
      { time: 1.6, flux: 1.0, originalIndex: 2 },
    ];

    const fit = calculateBoxFit(points, {
      periodDays: 2.0,
      epochDays: 1.0,
      durationHours: 1.0,
    });

    expect(fit.status).toBe('insufficient_data');
  });
});

describe('Evidence Diagnostics Engine', () => {
  it('correctly reports 1 observed event as inconclusive repetition when gaps surround it', () => {
    // Light curve with points ONLY around time 10.0 (one single sampled transit window, with large gaps elsewhere)
    const points: LightCurvePoint[] = [];
    for (let t = 9.8; t <= 10.2; t += 0.02) {
      const inDip = Math.abs(t - 10.0) <= 0.08;
      points.push({
        time: t,
        flux: inDip ? 0.98 : 1.0,
        originalIndex: points.length,
      });
    }
    // Add out-of-transit baseline points at time 0 and time 25 to establish time span
    points.push({ time: 0.0, flux: 1.0, originalIndex: points.length });
    points.push({ time: 0.1, flux: 1.0, originalIndex: points.length });
    points.push({ time: 0.2, flux: 1.0, originalIndex: points.length });
    points.push({ time: 24.8, flux: 1.0, originalIndex: points.length });
    points.push({ time: 24.9, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.0, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.1, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.2, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.3, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.4, flux: 1.0, originalIndex: points.length });

    const settings: InvestigationSettings = {
      periodDays: 5.0,
      epochDays: 10.0,
      durationHours: 4.8, // 0.2 days window
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep).toBeDefined();
    expect(rep?.status).toBe('inconclusive');
    expect(rep?.explanation).toContain('Only 1 single transit event has observations');
  });

  it('detects alternating depths in eclipsing binary simulation', () => {
    // Binary star with 3% primary and 1% secondary eclipses, period 4.0 days
    const points: LightCurvePoint[] = [];
    for (let t = 0; t < 20; t += 0.05) {
      let flux = 1.0;
      // Primary dips at t = 0, 4, 8, 12, 16
      // Secondary dips at t = 2, 6, 10, 14, 18
      for (let c = 0; c <= 5; c++) {
        if (Math.abs(t - c * 4.0) <= 0.08) flux = 0.97;
        if (Math.abs(t - (c * 4.0 + 2.0)) <= 0.08) flux = 0.99;
      }
      points.push({
        time: t,
        flux,
        originalIndex: points.length,
      });
    }

    // Folded at half-period (2.0 days) where primary and secondary are folded together as odd/even
    const settings: InvestigationSettings = {
      periodDays: 2.0,
      epochDays: 0.0,
      durationHours: 3.8,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const alt = report.items.find(i => i.id === 'alternating_depths');
    expect(alt).toBeDefined();
    expect(alt?.status).toBe('needs_review');
    expect(alt?.explanation).toContain('Eclipsing Binary');
  });

  it('marks opposite-phase dip not_assessed when phase 0.5 has zero observations', () => {
    // Generate data only around phase 0, completely gapped around phase 0.5
    const points: LightCurvePoint[] = [];
    for (let c = 0; c < 5; c++) {
      for (let offset = -0.2; offset <= 0.2; offset += 0.05) {
        points.push({
          time: c * 3.0 + offset,
          flux: Math.abs(offset) < 0.05 ? 0.98 : 1.0,
          originalIndex: points.length,
        });
      }
    }

    const settings: InvestigationSettings = {
      periodDays: 3.0,
      epochDays: 0.0,
      durationHours: 2.4,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const sec = report.items.find(i => i.id === 'opposite_phase');
    expect(sec?.status).toBe('not_assessed');
    expect(sec?.explanation).toContain('No observations exist in the opposite-phase window');
  });
});

describe('Canonical Hash Engine', () => {
  it('computes deterministic SHA-256 independent of input row order', () => {
    const pts1: LightCurvePoint[] = [
      { time: 10.5, flux: 1.002, originalIndex: 0 },
      { time: 10.0, flux: 0.985, originalIndex: 1 },
      { time: 11.0, flux: 1.000, originalIndex: 2 },
    ];
    const pts2: LightCurvePoint[] = [
      { time: 10.0, flux: 0.985, originalIndex: 1 },
      { time: 11.0, flux: 1.000, originalIndex: 2 },
      { time: 10.5, flux: 1.002, originalIndex: 0 },
    ];

    const hash1 = hashLightCurvePoints(pts1);
    const hash2 = hashLightCurvePoints(pts2);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
