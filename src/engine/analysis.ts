/**
 * DimmingLab - Shared Scientific Analysis Pipeline
 * Guarantees a single, canonical analysis snapshot across workspace views,
 * evidence diagnostics, reports, and interactive plots.
 */

import { LightCurvePoint, InvestigationSettings } from '../domain/types';
import { normalizeLightCurve } from './normalization';
import { foldDataset, FoldedPoint } from './folding';
import { calculateBoxFit, BoxFitResult } from './fit';
import { assessEvidence, DetailedDiagnosticReport } from './evidence';

export interface TimePlotPoint {
  x: number;
  y: number;
  inTransit: boolean;
  quality?: number;
}

export interface PhasePlotPoint {
  x: number;
  y: number;
  inTransit: boolean;
  cycle: number;
  quality?: number;
}

export interface AnalysisSnapshot {
  settings: InvestigationSettings;
  rawPointCount: number;
  activePoints: readonly LightCurvePoint[];
  normalizedPoints: readonly LightCurvePoint[];
  normalizationFactor: number;
  foldedPoints: readonly FoldedPoint[];
  boxFit: BoxFitResult;
  diagnostics: DetailedDiagnosticReport;
  timePlotData: TimePlotPoint[];
  phasePlotData: PhasePlotPoint[];
  // Mathematical labels & units
  depthFormatted: {
    rawDeficitText: string;
    relativePercentText: string;
    relativePpmText: string;
    uncertaintyText: string | null;
    baselineNote: string;
    isNormalized: boolean;
  };
}

/**
 * Computes an immutable, reproducible scientific analysis snapshot for given points and settings.
 * Original points array is NEVER mutated, preserving provenance and canonical hashing.
 */
export function computeAnalysisSnapshot(
  points: readonly LightCurvePoint[],
  settings: InvestigationSettings
): AnalysisSnapshot {
  const { periodDays, epochDays, durationHours, normalization, qualityFilter } = settings;

  // 1. Filter points according to qualityFilter policy
  const activePoints = points.filter(p => Number.isFinite(p.time) && Number.isFinite(p.flux) &&
    (qualityFilter !== 'clean_only' || p.quality === undefined || p.quality === 0));

  // 2. Normalize light curve observations
  const normalizedResult = normalizeLightCurve(activePoints, normalization);
  const normalizedPoints = normalizedResult.points;
  const normalizationFactor = normalizedResult.baselineMedian;

  // 3. Evaluate primary two-level box transit model
  const boxFit = calculateBoxFit(normalizedPoints, settings);

  // 4. Compute phase-folded dataset
  const foldedPoints = foldDataset(normalizedPoints, epochDays, periodDays);

  // 5. Evaluate all 5 core scientific diagnostics
  const diagnostics = assessEvidence(normalizedPoints, settings, boxFit);

  // 6. Generate synchronized plot coordinates
  const durationDays = durationHours / 24.0;
  const halfPhase = (durationDays / periodDays) / 2.0;

  const timePlotData: TimePlotPoint[] = new Array(normalizedPoints.length);
  for (let i = 0; i < normalizedPoints.length; i++) {
    const p = normalizedPoints[i];
    const norm = (p.time - epochDays) / periodDays;
    const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
    timePlotData[i] = {
      x: p.time,
      y: p.flux,
      inTransit: Math.abs(phase) <= halfPhase,
      quality: p.quality,
    };
  }

  const phasePlotData: PhasePlotPoint[] = new Array(foldedPoints.length);
  for (let i = 0; i < foldedPoints.length; i++) {
    const fp = foldedPoints[i];
    phasePlotData[i] = {
      x: fp.phase,
      y: fp.flux,
      inTransit: Math.abs(fp.phase) <= halfPhase,
      cycle: fp.cycle,
      quality: fp.quality,
    };
  }

  // 7. Make percentage/ppm units mathematically explicit
  const isNormalized = normalization !== 'none';
  const outMean = boxFit.outOfTransitMean;
  const rawDeficit = boxFit.rawDepth;
  const fractionalDepth = boxFit.fractionalDepth;

  let rawDeficitText = `${rawDeficit.toFixed(4)} flux units`;
  let relativePercentText = 'N/A';
  let relativePpmText = 'N/A';
  let uncertaintyText: string | null = null;
  let baselineNote = '';

  if (isNormalized) {
    rawDeficitText = `${(rawDeficit * 100).toFixed(4)}% relative flux`;
    relativePercentText = `${(boxFit.depthPercent ?? 0).toFixed(4)}%`;
    relativePpmText = `${Math.round(boxFit.depthPpm ?? 0).toLocaleString()} ppm`;
    if (boxFit.fractionalDepthStdErr !== null) {
      uncertaintyText = `±${(boxFit.fractionalDepthStdErr * 100).toFixed(4)}% (±${Math.round(boxFit.fractionalDepthStdErr * 1e6)} ppm)`;
    } else if (boxFit.rawDepthStdErr !== null) {
      uncertaintyText = `±${boxFit.rawDepthStdErr.toFixed(4)} flux units`;
    }
    baselineNote = 'Normalized to median starlight baseline = 1.000.';
  } else {
    rawDeficitText = `${rawDeficit.toFixed(4)} input flux units`;
    if (fractionalDepth !== null && outMean > 0) {
      relativePercentText = `${(boxFit.depthPercent ?? 0).toFixed(4)}%`;
      relativePpmText = `${Math.round(boxFit.depthPpm ?? 0).toLocaleString()} ppm`;
      baselineNote = `Relative depth (out_mean - in_mean) / out_mean calculated assuming positive constant baseline of ${outMean.toFixed(4)} input flux units.`;
    } else {
      baselineNote = 'Relative percentage unavailable: out-of-transit baseline is zero or negative.';
    }
    if (boxFit.rawDepthStdErr !== null) {
      uncertaintyText = `±${boxFit.rawDepthStdErr.toFixed(4)} input flux units`;
      if (boxFit.fractionalDepthStdErr !== null) {
        uncertaintyText += ` (±${(boxFit.fractionalDepthStdErr * 100).toFixed(4)}%)`;
      }
    }
  }

  return {
    settings,
    rawPointCount: points.length,
    activePoints,
    normalizedPoints,
    normalizationFactor,
    foldedPoints,
    boxFit,
    diagnostics,
    timePlotData,
    phasePlotData,
    depthFormatted: {
      rawDeficitText,
      relativePercentText,
      relativePpmText,
      uncertaintyText,
      baselineNote,
      isNormalized,
    },
  };
}
