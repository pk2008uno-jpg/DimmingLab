/**
 * DimmingLab - Phase Folding Engine
 * Pure mathematical functions for folding time-series observations.
 * Implements centered phase in [-0.5, 0.5) with strict boundary and negative time handling.
 */

import { LightCurvePoint } from '../domain/types';

/**
 * Standard positive modulo handling negative numbers reliably:
 * positiveModulo(-0.2, 1.0) === 0.8
 */
export function positiveModulo(val: number, mod: number): number {
  if (mod <= 0) {
    throw new Error(`Modulo divisor must be positive, got ${mod}`);
  }
  const result = ((val % mod) + mod) % mod;
  // Handle edge case where result equals mod due to floating precision
  return result >= mod ? 0 : result;
}

export interface PhaseCycle {
  phase: number; // strictly in [-0.5, 0.5)
  cycle: number; // integer transit cycle index
}

/**
 * Computes centered phase and cycle index for an observation time:
 * Phase is centered on transit epoch t0, so phase = 0.0 is the center of the dip.
 * Phase runs from [-0.5, 0.5).
 */
export function computePhaseAndCycle(time: number, t0: number, periodDays: number): PhaseCycle {
  if (periodDays <= 0 || !Number.isFinite(periodDays)) {
    throw new Error(`Period must be a positive finite number, got ${periodDays}`);
  }
  if (!Number.isFinite(time) || !Number.isFinite(t0)) {
    throw new Error(`Time and t0 must be finite numbers, got time=${time}, t0=${t0}`);
  }

  const norm = (time - t0) / periodDays;
  // Shift by +0.5 before modulo 1, then subtract 0.5 to center in [-0.5, 0.5)
  const phase = positiveModulo(norm + 0.5, 1.0) - 0.5;
  const cycle = Math.floor(norm + 0.5);

  return { phase, cycle };
}

export interface FoldedPoint extends LightCurvePoint {
  phase: number;
  cycle: number;
}

/**
 * Folds a full array of light curve points.
 * Preserves original point references and immutability.
 */
export function foldDataset(
  points: readonly LightCurvePoint[],
  t0: number,
  periodDays: number
): FoldedPoint[] {
  if (periodDays <= 0 || !Number.isFinite(periodDays)) {
    return [];
  }

  const folded: FoldedPoint[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const { phase, cycle } = computePhaseAndCycle(pt.time, t0, periodDays);
    folded[i] = {
      ...pt,
      phase,
      cycle,
    };
  }
  return folded;
}
