/**
 * DimmingLab - Normalization Engine
 * Pure functions for data normalization preserving raw observation integrity.
 */

import { LightCurvePoint } from '../domain/types';

/**
 * Calculates the exact median of an array of numbers.
 */
export function calculateMedian(values: readonly number[]): number {
  if (values.length === 0) return 1.0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2.0;
  }
  return sorted[mid];
}

export interface NormalizationResult {
  points: LightCurvePoint[];
  method: 'median' | 'none';
  baselineMedian: number;
  segmentMedians?: Record<number, number>;
}

/**
 * Normalizes light curve flux values.
 * Default is division by positive median per segment (or global median if no segments).
 * Returns fresh array of LightCurvePoint with normalized flux and error.
 */
export function normalizeLightCurve(
  points: readonly LightCurvePoint[],
  method: 'median' | 'none' = 'median'
): NormalizationResult {
  if (method === 'none' || points.length === 0) {
    return {
      points: points.map(p => ({ ...p })),
      method: 'none',
      baselineMedian: 1.0,
    };
  }

  // Check if points contain segment groupings
  const hasSegments = points.some(p => p.segment !== undefined && p.segment !== null);

  if (hasSegments) {
    // Group by segment
    const segmentFluxes = new Map<number, number[]>();
    for (const p of points) {
      const seg = p.segment ?? 0;
      let list = segmentFluxes.get(seg);
      if (!list) {
        list = [];
        segmentFluxes.set(seg, list);
      }
      if (Number.isFinite(p.flux) && p.flux > 0) {
        list.push(p.flux);
      }
    }

    const segmentMedians: Record<number, number> = {};
    const globalPositiveFlux = points.filter(p => Number.isFinite(p.flux) && p.flux > 0).map(p => p.flux);
    const globalMedian = calculateMedian(globalPositiveFlux) || 1.0;

    for (const [seg, fluxes] of segmentFluxes.entries()) {
      const segMed = calculateMedian(fluxes);
      segmentMedians[seg] = segMed > 0 ? segMed : globalMedian;
    }

    const normalizedPoints = points.map(p => {
      const seg = p.segment ?? 0;
      const baseline = segmentMedians[seg] ?? globalMedian;
      const normFlux = p.flux / baseline;
      const normErr = p.fluxErr !== undefined ? p.fluxErr / baseline : undefined;
      return {
        ...p,
        flux: normFlux,
        fluxErr: normErr,
      };
    });

    return {
      points: normalizedPoints,
      method: 'median',
      baselineMedian: globalMedian,
      segmentMedians,
    };
  }

  // Global median normalization
  const positiveFluxes = points
    .filter(p => Number.isFinite(p.flux) && p.flux > 0)
    .map(p => p.flux);

  const baselineMedian = calculateMedian(positiveFluxes);
  const factor = baselineMedian > 0 ? baselineMedian : 1.0;

  const normalizedPoints = points.map(p => ({
    ...p,
    flux: p.flux / factor,
    fluxErr: p.fluxErr !== undefined ? p.fluxErr / factor : undefined,
  }));

  return {
    points: normalizedPoints,
    method: 'median',
    baselineMedian: factor,
  };
}
