/**
 * DimmingLab - Selected Window Box Fit Engine
 * Fits a two-level periodic box model to light curve data.
 * Adheres strictly to scientific requirements:
 * - Inverse-variance or equal weighting
 * - Weighted Residual Sum of Squares (WRSS) calculation
 * - Brightening rejection (never yields positive score for brightening)
 * - Insufficient data guards
 */

import { LightCurvePoint } from '../domain/types';
import { computePhaseAndCycle } from './folding';

export interface BoxFitParams {
  periodDays: number;
  epochDays: number;
  durationHours: number;
}

export type FitStatus = 'ok' | 'insufficient_data' | 'brightening_detected' | 'invalid_parameters';

export type UncertaintyModel = 'known_errors' | 'empirical_residuals' | 'not_estimable';

export interface BoxFitResult {
  status: FitStatus;
  errorMessage?: string;
  inTransitCount: number;
  outOfTransitCount: number;
  totalPoints: number;
  inTransitMean: number;
  outOfTransitMean: number;
  inTransitStdErr: number;
  outOfTransitStdErr: number;
  rawDepth: number; // outOfTransitMean - inTransitMean (in input flux units)
  fractionalDepth: number | null; // (outOfTransitMean - inTransitMean) / outOfTransitMean when outOfTransitMean > 0
  depth: number; // relative fractional depth if outOfTransitMean > 0, else raw deficit
  depthPpm: number | null; // fractional depth in parts per million
  depthPercent: number | null; // fractional depth in %
  uncertaintyModel: UncertaintyModel;
  rawDepthStdErr: number | null; // propagated uncertainty in input flux units
  fractionalDepthStdErr: number | null; // propagated uncertainty in fractional depth
  depthStdErr: number | null; // fractionalDepthStdErr ?? rawDepthStdErr
  significance: number | null; // rawDepth / rawDepthStdErr when estimable, else null
  isBrightening: boolean;
  wrssFlat: number; // weighted RSS for flat constant model
  wrssBox: number; // weighted RSS for two-level box model
  fitImprovement: number; // wrssFlat - wrssBox (>= 0 for genuine dips, 0 if brightening)
  durationPhase: number; // q_phase = durationDays / periodDays
}

/**
 * Evaluates a box transit model on light curve observations.
 */
export function calculateBoxFit(
  points: readonly LightCurvePoint[],
  params: BoxFitParams
): BoxFitResult {
  const { periodDays, epochDays, durationHours } = params;

  if (periodDays <= 0 || !Number.isFinite(periodDays)) {
    return createEmptyResult('invalid_parameters', 'Period must be a positive finite number');
  }
  if (!Number.isFinite(epochDays)) {
    return createEmptyResult('invalid_parameters', 'Epoch must be a finite number');
  }
  if (durationHours <= 0 || !Number.isFinite(durationHours)) {
    return createEmptyResult('invalid_parameters', 'Duration must be positive');
  }

  const durationDays = durationHours / 24.0;
  const durationPhase = durationDays / periodDays;

  if (durationPhase >= 0.5) {
    return createEmptyResult('invalid_parameters', 'Transit duration must be less than half the orbital period');
  }

  const halfWidth = durationPhase / 2.0;

  const validPoints = points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.flux));
  // Never mix inverse-variance weights with invented unit errors for missing values.
  const hasCompleteErrors = validPoints.length > 0 && validPoints.every(p =>
    p.fluxErr !== undefined && Number.isFinite(p.fluxErr) && p.fluxErr > 0 &&
    Number.isFinite(1 / (p.fluxErr * p.fluxErr))
  );

  // Accumulate weighted sums for in-transit, out-of-transit, and all points
  let sumWIn = 0;
  let sumWYIn = 0;
  let countIn = 0;

  let sumWOut = 0;
  let sumWYOut = 0;
  let countOut = 0;

  let sumWAll = 0;
  let sumWYAll = 0;

  // First pass: collect points and compute means
  const filtered: Array<{ phase: number; flux: number; weight: number }> = [];

  for (let i = 0; i < validPoints.length; i++) {
    const pt = validPoints[i];

    const { phase } = computePhaseAndCycle(pt.time, epochDays, periodDays);
    
    // Weight: 1/err^2 if positive finite err exists, otherwise 1.0
    let weight = 1.0;
    if (hasCompleteErrors) {
      weight = 1.0 / (pt.fluxErr! * pt.fluxErr!);
    }

    filtered.push({ phase, flux: pt.flux, weight });

    sumWAll += weight;
    sumWYAll += weight * pt.flux;

    if (Math.abs(phase) <= halfWidth) {
      sumWIn += weight;
      sumWYIn += weight * pt.flux;
      countIn++;
    } else {
      sumWOut += weight;
      sumWYOut += weight * pt.flux;
      countOut++;
    }
  }

  if (countIn < 3 || countOut < 10) {
    return createEmptyResult(
      'insufficient_data',
      `Need >= 3 in-transit and >= 10 out-of-transit points (found in=${countIn}, out=${countOut})`
    );
  }

  const meanIn = sumWYIn / sumWIn;
  const meanOut = sumWYOut / sumWOut;
  const meanAll = sumWYAll / sumWAll;

  // Compute weighted residuals
  let wrssFlat = 0;
  let wrssBox = 0;
  let varianceInSum = 0;
  let varianceOutSum = 0;

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const diffFlat = item.flux - meanAll;
    wrssFlat += item.weight * diffFlat * diffFlat;

    if (Math.abs(item.phase) <= halfWidth) {
      const diffIn = item.flux - meanIn;
      wrssBox += item.weight * diffIn * diffIn;
      varianceInSum += diffIn * diffIn;
    } else {
      const diffOut = item.flux - meanOut;
      wrssBox += item.weight * diffOut * diffOut;
      varianceOutSum += diffOut * diffOut;
    }
  }

  // Uncertainty modeling
  const isKnownErrorModel = hasCompleteErrors;

  let inStdErr = 0;
  let outStdErr = 0;
  let rawDepthStdErr: number | null = null;
  let fractionalDepthStdErr: number | null = null;
  let uncertaintyModel: UncertaintyModel = 'not_estimable';

  if (isKnownErrorModel && sumWIn > 0 && sumWOut > 0) {
    uncertaintyModel = 'known_errors';
    const varIn = 1.0 / sumWIn;
    const varOut = 1.0 / sumWOut;
    inStdErr = Math.sqrt(varIn);
    outStdErr = Math.sqrt(varOut);
    rawDepthStdErr = Math.sqrt(varIn + varOut);
    if (meanOut > 0) {
      // Propagate uncertainty to fractional depth (meanOut - meanIn) / meanOut = 1 - meanIn/meanOut
      const relVar = (varIn / (meanOut * meanOut)) + ((meanIn * meanIn * varOut) / (meanOut * meanOut * meanOut * meanOut));
      fractionalDepthStdErr = Math.sqrt(relVar);
    }
  } else {
    // Empirical residual noise model
    const dof = Math.max(1, filtered.length - 2);
    const pooledVariance = wrssBox / dof;
    const pooledStd = Math.sqrt(pooledVariance);

    const roundoffFloor = 64 * Number.EPSILON * Math.max(Math.abs(meanIn), Math.abs(meanOut), Number.MIN_VALUE);
    if (pooledStd > roundoffFloor) {
      uncertaintyModel = 'empirical_residuals';
      const varIn = pooledVariance / countIn;
      const varOut = pooledVariance / countOut;
      inStdErr = Math.sqrt(varIn);
      outStdErr = Math.sqrt(varOut);
      rawDepthStdErr = Math.sqrt(varIn + varOut);
      if (meanOut > 0) {
        fractionalDepthStdErr = Math.sqrt(varIn / meanOut ** 2 + meanIn ** 2 * varOut / meanOut ** 4);
      }
    } else {
      // Noiseless simulation without error bars
      uncertaintyModel = 'not_estimable';
      inStdErr = 0;
      outStdErr = 0;
      rawDepthStdErr = null;
      fractionalDepthStdErr = null;
    }
  }

  // Raw and fractional depths
  const rawDepth = meanOut - meanIn;
  const isBrightening = rawDepth < 0;
  const fractionalDepth = meanOut > 0 ? rawDepth / meanOut : null;
  const depth = fractionalDepth !== null ? fractionalDepth : rawDepth;
  const depthPercent = fractionalDepth !== null ? fractionalDepth * 100 : null;
  const depthPpm = fractionalDepth !== null ? fractionalDepth * 1_000_000 : null;
  const depthStdErr = fractionalDepthStdErr ?? rawDepthStdErr;

  const significance = (rawDepthStdErr !== null && rawDepthStdErr > 0 && !isBrightening)
    ? rawDepth / rawDepthStdErr
    : null;

  let fitImprovement = wrssFlat - wrssBox;
  if (isBrightening || fitImprovement < 0) {
    fitImprovement = 0;
  }

  return {
    status: isBrightening ? 'brightening_detected' : 'ok',
    inTransitCount: countIn,
    outOfTransitCount: countOut,
    totalPoints: filtered.length,
    inTransitMean: meanIn,
    outOfTransitMean: meanOut,
    inTransitStdErr: inStdErr,
    outOfTransitStdErr: outStdErr,
    rawDepth,
    fractionalDepth,
    depth,
    depthPpm,
    depthPercent,
    uncertaintyModel,
    rawDepthStdErr,
    fractionalDepthStdErr,
    depthStdErr,
    significance,
    isBrightening,
    wrssFlat,
    wrssBox,
    fitImprovement,
    durationPhase,
  };
}

function createEmptyResult(status: FitStatus, errorMessage: string): BoxFitResult {
  return {
    status,
    errorMessage,
    inTransitCount: 0,
    outOfTransitCount: 0,
    totalPoints: 0,
    inTransitMean: 0,
    outOfTransitMean: 0,
    inTransitStdErr: 0,
    outOfTransitStdErr: 0,
    rawDepth: 0,
    fractionalDepth: 0,
    depth: 0,
    depthPpm: 0,
    depthPercent: 0,
    uncertaintyModel: 'not_estimable',
    rawDepthStdErr: null,
    fractionalDepthStdErr: null,
    depthStdErr: null,
    significance: null,
    isBrightening: false,
    wrssFlat: 0,
    wrssBox: 0,
    fitImprovement: 0,
    durationPhase: 0,
  };
}
