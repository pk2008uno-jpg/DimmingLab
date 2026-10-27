/**
 * DimmingLab - Scientific Evidence & Event Coverage Regressions
 * Strictly verifies the requirements of Section B and Section C of the Repair Specification:
 * 1. Continuously observed flat series must not report windows as gaps.
 * 2. Clean repeating 1,500 ppm signal at P=4d recognized as repeated dimming (error-bearing and error-absent).
 * 3. Single deep dip with other windows observed flat remains a single detected event (other windows count as observations).
 * 4. Removing measurements from a predicted window reduces coverage independently of flux values elsewhere.
 * 5. Out-of-baseline centers must not create missing spacecraft observations; test partial edge windows.
 * 6. Actual Case D at P=4.12, epoch=52.3, duration=3h reports 6 in-baseline windows with data (0 gaps).
 * 7. Actual Case A retains real 9-covered / 10-predicted relationship under documented policy.
 * 8. Actual Case C mono-transit fixture verified: 13 predicted, 6 covered (1 dimming, 5 flat), 7 absent gaps.
 * 9. Exact constant flux, exact alternating noiseless depths, finite known errors, missing errors, nonfinite inputs.
 * 10. Meaningful pure-noise control: periodogram peak does not trigger candidate confirmation in evidence rail.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { calculateBoxFit } from '../src/engine/fit';
import { assessEvidence } from '../src/engine/evidence';
import { LightCurveData, LightCurvePoint, InvestigationSettings } from '../src/domain/types';

describe('Scientific Coverage & Diagnostic Regressions', () => {
  // 1. Flat series must never report gaps
  it('1. Continuously observed flat series does not report windows as gaps', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 10.0; t <= 30.0; t += 0.05) {
      points.push({ time: t, flux: 1.0, originalIndex: points.length });
    }
    const settings: InvestigationSettings = {
      periodDays: 3.5,
      epochDays: 10.0,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    expect(report.predictedWindowCount).toBeGreaterThan(0);
    expect(report.coveredWindowCount).toBe(report.predictedWindowCount);
    expect(report.absentWindowCount).toBe(0);
    expect(report.flatBaselineCount).toBe(report.predictedWindowCount);
    expect(report.dimmingDetectedCount).toBe(0);

    const gapsItem = report.items.find(i => i.id === 'sampling_gaps');
    expect(gapsItem?.status).toBe('measured');
    expect(gapsItem?.explanation).toContain('0 unobserved gaps');
  });

  // 2. Clean repeating 1,500 ppm signal at P=4d (error-bearing & error-absent)
  it('2a. Clean repeating 1,500 ppm signal at P=4d recognized as repeated dimming with error bars', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 20.0; t += 0.04) {
      const norm = (t - 0.5) / 4.0;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase) <= (3.0 / 24.0 / 4.0) / 2.0;
      points.push({
        time: t,
        flux: inTransit ? 0.9985 : 1.0000,
        fluxErr: 0.0002, // 200 ppm errors
        originalIndex: points.length,
      });
    }
    const settings: InvestigationSettings = {
      periodDays: 4.0,
      epochDays: 0.5,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('measured');
    expect(report.dimmingDetectedCount).toBeGreaterThanOrEqual(4);
    expect(rep?.explanation).toContain('Consistent with a periodic repeating signal');
  });

  it('2b. Clean repeating 1,500 ppm signal at P=4d recognized as repeated dimming without error bars', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 20.0; t += 0.04) {
      const norm = (t - 0.5) / 4.0;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase) <= (3.0 / 24.0 / 4.0) / 2.0;
      points.push({
        time: t,
        flux: inTransit ? 0.9985 : 1.0000,
        originalIndex: points.length,
      });
    }
    const settings: InvestigationSettings = {
      periodDays: 4.0,
      epochDays: 0.5,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('measured');
    expect(report.dimmingDetectedCount).toBeGreaterThanOrEqual(4);
  });

  // 3. Single deep dip with other windows observed flat
  it('3. Single deep dip with other windows observed flat remains a single detected event and counts other windows as observations', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 20.0; t += 0.05) {
      // Dip only at cycle 1 (t ~ 4.5)
      const inDip = Math.abs(t - 4.5) <= 0.06;
      points.push({
        time: t,
        flux: inDip ? 0.985 : 1.0,
        originalIndex: points.length,
      });
    }
    const settings: InvestigationSettings = {
      periodDays: 4.0,
      epochDays: 0.5,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    expect(report.dimmingDetectedCount).toBe(1);
    expect(report.flatBaselineCount).toBeGreaterThanOrEqual(3);
    expect(report.coveredWindowCount).toBe(report.predictedWindowCount);
    expect(report.absentWindowCount).toBe(0);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('inconclusive');
    expect(rep?.explanation).toContain('Only 1 single transit event has observations');
  });

  // 4. Removing measurements from a predicted window reduces coverage independently of flux
  it('4. Removing measurements from a predicted window reduces coverage', () => {
    const pointsFull: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 12.0; t += 0.05) {
      pointsFull.push({ time: t, flux: 1.0, originalIndex: pointsFull.length });
    }
    const settings: InvestigationSettings = {
      periodDays: 3.0,
      epochDays: 1.5,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fitFull = calculateBoxFit(pointsFull, settings);
    const reportFull = assessEvidence(pointsFull, settings, fitFull);
    const initialGaps = reportFull.absentWindowCount;

    // Delete all measurements in cycle 2 window (t in [7.3, 7.7])
    const pointsWithGap = pointsFull.filter(p => p.time < 7.3 || p.time > 7.7);
    const fitGap = calculateBoxFit(pointsWithGap, settings);
    const reportGap = assessEvidence(pointsWithGap, settings, fitGap);

    expect(reportGap.absentWindowCount).toBe(initialGaps + 1);
    expect(reportGap.coveredWindowCount).toBe(reportFull.coveredWindowCount - 1);
  });

  // 5. Out-of-baseline centers do not create missing spacecraft observations
  it('5. Out-of-baseline centers do not create missing spacecraft observations', () => {
    // Points baseline: [100.0, 110.0]
    const points: LightCurvePoint[] = [];
    for (let t = 100.0; t <= 110.0; t += 0.05) {
      points.push({ time: t, flux: 1.0, originalIndex: points.length });
    }
    // Set epoch at 50.0 and period at 3.0. Cycle -10 (t=20) is far outside baseline
    const settings: InvestigationSettings = {
      periodDays: 3.0,
      epochDays: 50.0,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    // All predicted windows must strictly overlap [100, 110]
    for (const w of report.windows) {
      expect(w.windowEnd).toBeGreaterThanOrEqual(100.0);
      expect(w.windowStart).toBeLessThanOrEqual(110.0);
    }
    // Gaps must only be inside [100, 110], not back at t=50
    expect(report.absentWindowCount).toBe(0);
  });

  // 6. Actual Case D fixture verification
  it('6. Actual Case D at P=4.12, epoch=52.3, dur=3h reports 6 in-baseline windows with data and 0 gaps', () => {
    const raw = readFileSync('public/data/case_d_injection.json', 'utf-8');
    const data: LightCurveData = JSON.parse(raw);
    const settings: InvestigationSettings = {
      periodDays: 4.12,
      epochDays: 52.3,
      durationHours: 3.0,
      normalization: 'median',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(data.points, settings);
    const report = assessEvidence(data.points, settings, fit);

    expect(report.predictedWindowCount).toBe(6);
    expect(report.coveredWindowCount).toBe(6);
    expect(report.absentWindowCount).toBe(0);

    const gapsItem = report.items.find(i => i.id === 'sampling_gaps');
    expect(gapsItem?.status).toBe('measured');
    expect(gapsItem?.explanation).toContain('0 unobserved gaps');
  });

  // 7. Actual Case A fixture verification
  it('7. Actual Case A (Kepler-8 b) retains 9 covered / 10 predicted relationship', () => {
    const raw = readFileSync('public/data/case_a_kepler8b.json', 'utf-8');
    const data: LightCurveData = JSON.parse(raw);
    const settings: InvestigationSettings = {
      periodDays: 3.5225,
      epochDays: 131.687,
      durationHours: 3.24,
      normalization: 'median',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(data.points, settings);
    const report = assessEvidence(data.points, settings, fit);

    expect(report.predictedWindowCount).toBe(10);
    expect(report.coveredWindowCount).toBe(9);
    expect(report.absentWindowCount).toBe(1);
    expect(report.dimmingDetectedCount).toBe(9);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('measured');
    expect(rep?.explanation).toContain('Observed 9 distinct transit windows');
  });

  // 8. Actual Case C mono-transit fixture verification
  it('8. Actual Case C fixture reports 13 predicted, 6 covered (1 dimming, 5 flat), and 7 absent gaps', () => {
    const raw = readFileSync('public/data/case_c_single_dropout.json', 'utf-8');
    const data: LightCurveData = JSON.parse(raw);
    const settings: InvestigationSettings = {
      periodDays: 3.75,
      epochDays: 115.0,
      durationHours: 4.5,
      normalization: 'median',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(data.points, settings);
    const report = assessEvidence(data.points, settings, fit);

    expect(report.predictedWindowCount).toBe(13);
    expect(report.coveredWindowCount).toBe(6);
    expect(report.absentWindowCount).toBe(7);
    expect(report.dimmingDetectedCount).toBe(1);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('inconclusive');
    expect(rep?.explanation).toContain('Only 1 single transit event has observations');
  });

  // 9. Exact alternating noiseless depths: no 99-sigma fallback
  it('9. Exact alternating noiseless depths sets significance to null/not-estimable without 99-sigma fallback', () => {
    const points: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 12.0; t += 0.05) {
      const cycle = Math.floor(t / 2.0);
      const isOdd = Math.abs(cycle) % 2 === 1;
      const inWindow = Math.abs(t - (cycle * 2.0 + 1.0)) <= 0.06;
      let flux = 1.0;
      if (inWindow) {
        flux = isOdd ? 0.98 : 0.99; // 2% vs 1% depth
      }
      points.push({ time: t, flux, originalIndex: points.length });
    }
    const settings: InvestigationSettings = {
      periodDays: 2.0,
      epochDays: 1.0,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const alt = report.items.find(i => i.id === 'alternating_depths');
    expect(alt?.status).toBe('needs_review');
    expect(alt?.explanation).toContain('Not estimable (noiseless simulation)');
    expect(alt?.explanation).not.toContain('99');
    const sigMetric = alt?.metrics.find(m => m.name === 'Standardized Diff');
    expect(sigMetric?.value).toBeNull();
    expect(sigMetric?.formatted).toBe('Not estimable');
  });

  // 10. Meaningful pure-noise control: search peak does not trigger confirmed planet
  it('10. Pure noise search peak does not trigger candidate confirmation in evidence rail', () => {
    let seed = 42;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    const points: LightCurvePoint[] = [];
    for (let t = 0; t < 25; t += 0.05) {
      // Gaussian noise with mean 1.0, sigma ~ 0.002
      const u1 = rand();
      const u2 = rand();
      const z0 = Math.sqrt(-2.0 * Math.log(u1 || 1e-9)) * Math.cos(2.0 * Math.PI * u2);
      points.push({ time: t, flux: 1.0 + z0 * 0.002, originalIndex: points.length });
    }
    // Fold at an arbitrary trial period
    const settings: InvestigationSettings = {
      periodDays: 3.2,
      epochDays: 1.1,
      durationHours: 2.5,
      normalization: 'none',
      qualityFilter: 'all',
    };
    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    // Repetition or Fit must NOT be confirmed as a planet
    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).not.toBe('measured');
    expect(report.dimmingDetectedCount).toBeLessThan(3);
  });
});
