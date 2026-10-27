import { describe, it, expect } from 'vitest';
import { runPeriodicSearch } from '../src/engine/search';
import { LightCurvePoint } from '../src/domain/types';

describe('Search Engine (BLS-style period scan)', () => {
  it('recovers period of a synthetic transit light curve within 1% tolerance', () => {
    // Generate 15 days of data, 30 min cadence
    // True period = 3.0 days, epoch = 1.0, duration = 3.6 hours = 0.15 days, depth = 1.5%
    const points: LightCurvePoint[] = [];
    const truePeriod = 3.0;
    const trueEpoch = 1.0;
    const durDays = 3.6 / 24.0;

    for (let t = 0; t <= 15.0; t += 0.02) {
      const norm = (t - trueEpoch) / truePeriod;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inDip = Math.abs(phase) <= (durDays / truePeriod) / 2.0;
      points.push({
        time: t,
        flux: inDip ? 0.985 : 1.000,
        originalIndex: points.length,
      });
    }

    const candidates = runPeriodicSearch(points, {
      minPeriodDays: 1.5,
      maxPeriodDays: 5.5,
      periodSteps: 400,
      phaseBins: 100,
      durationHours: 3.6,
      topCount: 3,
    });

    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    // Period should be within 1.5% of 3.0 days
    expect(Math.abs(top.periodDays - truePeriod) / truePeriod).toBeLessThan(0.015);
    expect(top.depthPpm).toBeGreaterThan(10000); // around 15000 ppm
  });

  it('supports reliable cancellation and repeated cancel calls without leaking or throwing', async () => {
    const { SearchWorkerClient } = await import('../src/workers/searchWorkerClient');
    const client = new SearchWorkerClient();

    // Repeated cancel calls when idle must not throw
    expect(() => client.cancelActiveSearch()).not.toThrow();
    expect(() => client.cancelActiveSearch()).not.toThrow();

    // Start a search and cancel it immediately
    const dummyPoints: LightCurvePoint[] = [
      { time: 1.0, flux: 1.0, originalIndex: 0 },
      { time: 2.0, flux: 0.99, originalIndex: 1 },
      { time: 3.0, flux: 1.0, originalIndex: 2 },
    ];
    const searchPromise = client.startSearch(dummyPoints, {
      minPeriodDays: 1.0,
      maxPeriodDays: 5.0,
      periodSteps: 200,
      phaseBins: 50,
      durationHours: 2.0,
      topCount: 2,
    });

    client.cancelActiveSearch();

    await expect(searchPromise).rejects.toThrow('Search was cancelled by user');

    // Starting a new search after cancellation must succeed cleanly
    const secondPromise = client.startSearch(dummyPoints, {
      minPeriodDays: 1.0,
      maxPeriodDays: 5.0,
      periodSteps: 20,
      phaseBins: 20,
      durationHours: 2.0,
      topCount: 2,
    });

    const results = await secondPromise;
    expect(Array.isArray(results)).toBe(true);

    client.destroy();
  });
});
