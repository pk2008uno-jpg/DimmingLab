import { describe, it, expect } from 'vitest';
import { assessEvidence } from '../src/engine/evidence';
import { calculateBoxFit } from '../src/engine/fit';
import { LightCurvePoint, InvestigationSettings } from '../src/domain/types';

describe('Student Task: Event Repetition & Coverage Diagnostics', () => {
  it('correctly reports 1 observed event as inconclusive repetition when gaps surround it (The Single-Event Trap)', () => {
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
    // Baseline points establishing time span (at t=0 and t=25)
    points.push({ time: 0.0, flux: 1.0, originalIndex: points.length });
    points.push({ time: 0.1, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.0, flux: 1.0, originalIndex: points.length });
    points.push({ time: 25.1, flux: 1.0, originalIndex: points.length });

    const settings: InvestigationSettings = {
      periodDays: 5.0,
      epochDays: 10.0,
      durationHours: 4.8,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep).toBeDefined();
    // Repetition must be inconclusive because only 1 single dip is observed
    expect(rep?.status).toBe('inconclusive');
    expect(rep?.explanation).toContain('Only 1 single transit event has observations');
  });

  it('correctly reports measured repetition when 3 or more separated transit events are observed', () => {
    // Generate 4 clear separated transit dips at t = 2, 5, 8, 11 (period 3.0)
    const points: LightCurvePoint[] = [];
    for (let t = 0; t <= 13.0; t += 0.05) {
      let flux = 1.0;
      for (const center of [2.0, 5.0, 8.0, 11.0]) {
        if (Math.abs(t - center) <= 0.08) {
          flux = 0.985;
        }
      }
      points.push({
        time: t,
        flux,
        originalIndex: points.length,
      });
    }

    const settings: InvestigationSettings = {
      periodDays: 3.0,
      epochDays: 2.0,
      durationHours: 4.0,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const rep = report.items.find(i => i.id === 'repetition');
    expect(rep?.status).toBe('measured');
    expect(report.sampledEventCount).toBe(4);
  });

  it('treats missing windows in gaps as missing windows, not measured non-detections', () => {
    // Data only at t = 2.0 and t = 11.0 (with a huge gap between 3 and 10)
    const points: LightCurvePoint[] = [];
    for (let t = 1.8; t <= 2.2; t += 0.04) {
      points.push({ time: t, flux: Math.abs(t - 2.0) <= 0.06 ? 0.98 : 1.0, originalIndex: points.length });
    }
    for (let t = 10.8; t <= 11.2; t += 0.04) {
      points.push({ time: t, flux: Math.abs(t - 11.0) <= 0.06 ? 0.98 : 1.0, originalIndex: points.length });
    }

    const settings: InvestigationSettings = {
      periodDays: 3.0,
      epochDays: 2.0,
      durationHours: 4.0,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const fit = calculateBoxFit(points, settings);
    const report = assessEvidence(points, settings, fit);

    const gaps = report.items.find(i => i.id === 'sampling_gaps');
    expect(gaps).toBeDefined();
    // Predicted cycles: min 0, max 3 -> 4 cycles total. Only cycles 0 and 3 sampled. Cycles 1 and 2 in gaps.
    expect(report.predictedEventCount).toBe(4);
    expect(report.sampledEventCount).toBe(2);
  });
});
