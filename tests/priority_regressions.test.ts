import { describe, it, expect } from 'vitest';
import { computeAnalysisSnapshot } from '../src/engine/analysis';
import { calculateBoxFit } from '../src/engine/fit';
import { assessEvidence } from '../src/engine/evidence';
import {
  validateProjectJson,
  restoreCustomDatasetFromProject,
  CURRENT_ENGINE_VERSION,
} from '../src/features/evidence/exportImport';
import { LightCurvePoint, InvestigationSettings, InvestigationProject } from '../src/domain/types';

describe('Priority 1: One Consistent Scientific Analysis Path', () => {
  it('Baseline 1,024, transit level 1,008: relative depth is 1.5625%, and workspace/report agree', () => {
    // P=4 days, epoch=0.5 days, duration=3 hours (0.125 days)
    // Days 0 to 20 at 0.02-day cadence
    const points: LightCurvePoint[] = [];
    const P = 4.0;
    const t0 = 0.5;
    const durDays = 3.0 / 24.0;
    const halfDur = durDays / 2.0;

    for (let t = 0.0; t <= 20.0; t += 0.02) {
      const norm = (t - t0) / P;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase * P) <= halfDur;
      const flux = inTransit ? 1008.0 : 1024.0;
      points.push({
        time: +t.toFixed(4),
        flux,
        originalIndex: points.length,
      });
    }

    const settings: InvestigationSettings = {
      periodDays: P,
      epochDays: t0,
      durationHours: 3.0,
      normalization: 'none', // Raw detector counts
      qualityFilter: 'all',
    };

    const snapshot = computeAnalysisSnapshot(points, settings);

    // Baseline 1024, transit 1008 -> raw deficit is 16.0 counts
    expect(snapshot.boxFit.rawDepth).toBeCloseTo(16.0, 4);
    // Relative fractional depth: (1024 - 1008) / 1024 = 16 / 1024 = 0.015625 = 1.5625%
    expect(snapshot.boxFit.fractionalDepth).toBeCloseTo(0.015625, 6);
    expect(snapshot.boxFit.depthPercent).toBeCloseTo(1.5625, 4);
    expect(snapshot.depthFormatted.relativePercentText).toBe('1.5625%');
    expect(snapshot.depthFormatted.rawDeficitText).toBe('16.0000 input flux units');

    // Both workspace and report use computeAnalysisSnapshot directly
    const reportSnapshot = computeAnalysisSnapshot(points, settings);
    expect(reportSnapshot.boxFit.depthPercent).toBe(snapshot.boxFit.depthPercent);
    expect(reportSnapshot.depthFormatted.relativePercentText).toBe(snapshot.depthFormatted.relativePercentText);
    expect(reportSnapshot.depthFormatted.rawDeficitText).toBe(snapshot.depthFormatted.rawDeficitText);

    // Repeat after multiplying all fluxes and errors by a constant factor (x10)
    const scaledPoints = points.map(p => ({
      ...p,
      flux: p.flux * 10.0,
      fluxErr: p.fluxErr !== undefined ? p.fluxErr * 10.0 : undefined,
    }));

    const scaledSnapshot = computeAnalysisSnapshot(scaledPoints, settings);
    expect(scaledSnapshot.boxFit.rawDepth).toBeCloseTo(160.0, 3);
    // Relative depth remains exactly 1.5625%
    expect(scaledSnapshot.boxFit.fractionalDepth).toBeCloseTo(0.015625, 6);
    expect(scaledSnapshot.boxFit.depthPercent).toBeCloseTo(1.5625, 4);
    expect(scaledSnapshot.depthFormatted.relativePercentText).toBe('1.5625%');
    expect(scaledSnapshot.depthFormatted.rawDeficitText).toBe('160.0000 input flux units');
  });

  it('Quality-flagged outlier is included or excluded consistently across workspace, report, plots, and diagnostics', () => {
    const points: LightCurvePoint[] = [];
    for (let i = 0; i < 100; i++) {
      points.push({
        time: i * 0.1,
        flux: 1.0,
        quality: 0,
        originalIndex: i,
      });
    }
    // Add 1 extreme outlier with non-zero quality flag
    points.push({
      time: 5.05,
      flux: 0.1, // huge fake dip
      quality: 128, // bad quality flag
      originalIndex: 100,
    });

    const baseSettings: InvestigationSettings = {
      periodDays: 2.0,
      epochDays: 1.0,
      durationHours: 2.4,
      normalization: 'median',
      qualityFilter: 'clean_only',
    };

    // Under clean_only: outlier must be excluded from activePoints, plots, and diagnostics
    const cleanSnapshot = computeAnalysisSnapshot(points, baseSettings);
    expect(cleanSnapshot.activePoints.length).toBe(100);
    expect(cleanSnapshot.timePlotData.length).toBe(100);
    expect(cleanSnapshot.phasePlotData.length).toBe(100);
    expect(cleanSnapshot.activePoints.some(p => p.quality === 128)).toBe(false);

    // Under all: outlier must be included in activePoints, plots, and diagnostics
    const allSnapshot = computeAnalysisSnapshot(points, {
      ...baseSettings,
      qualityFilter: 'all',
    });
    expect(allSnapshot.activePoints.length).toBe(101);
    expect(allSnapshot.timePlotData.length).toBe(101);
    expect(allSnapshot.phasePlotData.length).toBe(101);
    expect(allSnapshot.activePoints.some(p => p.quality === 128)).toBe(true);
  });
});

describe('Priority 2: Honest Coverage, Cadence Policy, and Uncertainty Propagation', () => {
  it('Shallow dip (1/4096 = 244.14 ppm) retains clean repeating pattern without being labeled flat', () => {
    // P=4 days, epoch=0.5 days, duration=3 hours (0.125 days), days 0–20 at 0.02-day cadence
    // Baseline 1.0, dip = 1/4096 = 0.000244140625
    const points: LightCurvePoint[] = [];
    const P = 4.0;
    const t0 = 0.5;
    const durDays = 3.0 / 24.0;
    const halfDur = durDays / 2.0;
    const dip = 1.0 / 4096.0;

    for (let t = 0.0; t <= 20.0; t += 0.02) {
      const norm = (t - t0) / P;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase * P) <= halfDur;
      points.push({
        time: +t.toFixed(4),
        flux: inTransit ? 1.0 - dip : 1.0,
        originalIndex: points.length,
      });
    }

    const settings: InvestigationSettings = {
      periodDays: P,
      epochDays: t0,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const snapshot = computeAnalysisSnapshot(points, settings);

    // Depth is exactly 244.140625 ppm
    expect(snapshot.boxFit.depthPpm).toBeCloseTo(244.140625, 3);

    // Check repetition diagnostics: windows must NOT be labeled flat_baseline
    const repCard = snapshot.diagnostics.items.find(i => i.kind === 'repetition');
    expect(repCard).toBeDefined();
    expect(snapshot.diagnostics.dimmingDetectedCount).toBeGreaterThanOrEqual(4);
    expect(snapshot.diagnostics.flatBaselineCount).toBe(0);
    // Repetition is confirmed, not rejected as flat
    expect(repCard?.status).toBe('measured');
  });

  it('Independent point errors 1/1024 propagate to depth error of approx 168.03 ppm', () => {
    // P=4 days, epoch=0.5 days, duration=3 hours (0.125 days), days 0–20 at 0.02-day cadence
    // Dip 1/64, independent point errors 1/1024
    const points: LightCurvePoint[] = [];
    const P = 4.0;
    const t0 = 0.5;
    const durDays = 3.0 / 24.0;
    const halfDur = durDays / 2.0;
    const dip = 1.0 / 64.0;
    const sigma = 1.0 / 1024.0;

    for (let t = 0.0; t <= 20.0; t += 0.02) {
      const norm = (t - t0) / P;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase * P) <= halfDur;
      points.push({
        time: +t.toFixed(4),
        flux: inTransit ? 1.0 - dip : 1.0,
        fluxErr: sigma,
        originalIndex: points.length,
      });
    }

    const settings: InvestigationSettings = {
      periodDays: P,
      epochDays: t0,
      durationHours: 3.0,
      normalization: 'none',
      qualityFilter: 'all',
    };

    const snapshot = computeAnalysisSnapshot(points, settings);
    expect(snapshot.boxFit.uncertaintyModel).toBe('known_errors');

    // Expected depth error: sqrt(sigma^2 / N_in + sigma^2 / N_out)
    // N_in = 35 points, N_out = 966 points
    // sqrt((1/1024)^2 / 35 + (1/1024)^2 / 966) = 0.000168033 = 168.033 ppm
    const depthErrPpm = (snapshot.boxFit.rawDepthStdErr ?? 0) * 1_000_000;
    expect(depthErrPpm).toBeCloseTo(168.03, 1);
  });

  it('Distinguishes known errors vs empirical residuals vs noiseless degenerate models', () => {
    // 1. Known errors
    const pointsWithErrors: LightCurvePoint[] = [
      { time: 1.0, flux: 1.0, fluxErr: 0.01, originalIndex: 0 },
      { time: 2.0, flux: 0.98, fluxErr: 0.01, originalIndex: 1 },
      { time: 3.0, flux: 1.0, fluxErr: 0.01, originalIndex: 2 },
      { time: 4.0, flux: 1.0, fluxErr: 0.01, originalIndex: 3 },
      { time: 5.0, flux: 1.0, fluxErr: 0.01, originalIndex: 4 },
      { time: 6.0, flux: 1.0, fluxErr: 0.01, originalIndex: 5 },
      { time: 7.0, flux: 1.0, fluxErr: 0.01, originalIndex: 6 },
      { time: 8.0, flux: 1.0, fluxErr: 0.01, originalIndex: 7 },
      { time: 9.0, flux: 1.0, fluxErr: 0.01, originalIndex: 8 },
      { time: 10.0, flux: 1.0, fluxErr: 0.01, originalIndex: 9 },
      { time: 11.0, flux: 1.0, fluxErr: 0.01, originalIndex: 10 },
      { time: 12.0, flux: 1.0, fluxErr: 0.01, originalIndex: 11 },
      { time: 13.0, flux: 1.0, fluxErr: 0.01, originalIndex: 12 },
    ];
    const fitKnown = calculateBoxFit(pointsWithErrors, { periodDays: 4.0, epochDays: 2.0, durationHours: 5.0 });
    expect(fitKnown.uncertaintyModel).toBe('known_errors');

    // 2. Empirical residuals (errors absent, points contain scatter)
    const pointsWithoutErrors = pointsWithErrors.map(p => ({
      time: p.time,
      flux: p.flux + (p.originalIndex % 2 === 0 ? 0.005 : -0.005),
      originalIndex: p.originalIndex,
    }));
    const fitEmpirical = calculateBoxFit(pointsWithoutErrors, { periodDays: 4.0, epochDays: 2.0, durationHours: 5.0 });
    expect(fitEmpirical.uncertaintyModel).toBe('empirical_residuals');

    // 3. Noiseless constant (no scatter, no errors)
    const noiseless = pointsWithErrors.map(p => ({
      time: p.time,
      flux: 1.0,
      originalIndex: p.originalIndex,
    }));
    const fitNoiseless = calculateBoxFit(noiseless, { periodDays: 4.0, epochDays: 2.0, durationHours: 5.0 });
    expect(fitNoiseless.uncertaintyModel).toBe('not_estimable');
  });

  it('Clustered coverage control: 4 points in 4.32 min inside 9.6h window is classified as partial, not adequate', () => {
    // 9.6 hours = 0.4 days window
    // 4.32 minutes = 0.003 days cluster inside cycle 0 window [0.3, 0.7] (center = 0.5)
    const points: LightCurvePoint[] = [
      { time: 0.499, flux: 0.98, originalIndex: 0 },
      { time: 0.500, flux: 0.98, originalIndex: 1 },
      { time: 0.501, flux: 0.98, originalIndex: 2 },
      { time: 0.502, flux: 0.98, originalIndex: 3 }, // 4 points in a 0.003d (4.32m) burst
      // Out of transit points spanning days 1.0 to 10.0
      ...Array.from({ length: 50 }, (_, i) => ({
        time: 1.0 + i * 0.2,
        flux: 1.0,
        originalIndex: 4 + i,
      })),
    ];

    const diag = assessEvidence(points, {
      periodDays: 5.0,
      epochDays: 0.5,
      durationHours: 9.6, // 0.4 days
      normalization: 'none',
      qualityFilter: 'all',
    });

    // The window containing the 4 points in 4.32 min must be PARTIAL, not adequate
    const cycle0 = diag.windows.find(w => w.cycle === 0);
    expect(cycle0).toBeDefined();
    expect(cycle0?.sampleCount).toBe(4);
    expect(cycle0?.coverage).toBe('partial');
  });

  it('Periodic brightenings are reported with explicit category counts and appropriate warning', () => {
    // Light curve where in-transit windows are brighter (+2% flux) instead of dimmer
    const points: LightCurvePoint[] = [];
    for (let t = 0.0; t <= 12.0; t += 0.05) {
      const norm = (t - 0.5) / 3.0;
      const phase = (((norm + 0.5) % 1.0) + 1.0) % 1.0 - 0.5;
      const inTransit = Math.abs(phase * 3.0) <= (3.0 / 24.0 / 2.0);
      points.push({
        time: +t.toFixed(4),
        flux: inTransit ? 1.02 : 1.00, // brightening
        originalIndex: points.length,
      });
    }

    const diag = assessEvidence(points, {
      periodDays: 3.0,
      epochDays: 0.5,
      durationHours: 3.0,
      normalization: 'median',
      qualityFilter: 'all',
    });

    expect(diag.brighteningCount).toBeGreaterThanOrEqual(3);
    const repCard = diag.items.find(i => i.kind === 'repetition');
    expect(repCard?.status).toBe('needs_review');
    expect(repCard?.title).toContain('Periodic Brightening Detected');
    expect(repCard?.explanation).toContain('brightening');
  });
});

describe('Priority 3: Reliable Project Identity, Anti-Impersonation & Validation', () => {
  it('Anti-impersonation: rejects custom-points project attempting to claim a curated dataset ID', () => {
    const fakeCustomPoints: LightCurvePoint[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 0.1,
      flux: 1.0,
      originalIndex: i,
    }));

    const result = validateProjectJson({
      schemaVersion: 1,
      datasetId: 'case_b_eclipsing_binary', // Official curated ID
      datasetHash: 'a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c',
      settings: {
        periodDays: 2.0,
        epochDays: 0.5,
        durationHours: 2.0,
        normalization: 'median',
        qualityFilter: 'clean_only',
      },
      evidence: [],
      customPoints: fakeCustomPoints, // Custom points supplied for curated case!
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Anti-impersonation violation');
  });

  it('Strict validation rejects null epoch, invalid enums, unsupported engineVersion, and duration >= 0.5P', () => {
    const validBase = {
      schemaVersion: 1,
      datasetId: 'case_a_kepler8b',
      datasetHash: 'ba188e8782ff0be96198b66424302c17a4f68a7cc472b7b1a2e4778312c48bf8',
      settings: {
        periodDays: 3.5,
        epochDays: 0.5,
        durationHours: 3.0,
        normalization: 'median',
        qualityFilter: 'clean_only',
      },
      evidence: [],
    };

    // 1. Null epochDays
    const nullEpochRes = validateProjectJson({
      ...validBase,
      settings: { ...validBase.settings, epochDays: null },
    });
    expect(nullEpochRes.valid).toBe(false);
    expect(nullEpochRes.error).toContain('invalid epochDays');

    // 2. Invalid normalization enum
    const invalidNormRes = validateProjectJson({
      ...validBase,
      settings: { ...validBase.settings, normalization: 'bogus_normalization' },
    });
    expect(invalidNormRes.valid).toBe(false);
    expect(invalidNormRes.error).toContain('Invalid normalization setting');

    // 3. Invalid qualityFilter enum
    const invalidQualityRes = validateProjectJson({
      ...validBase,
      settings: { ...validBase.settings, qualityFilter: 'strict_mode' },
    });
    expect(invalidQualityRes.valid).toBe(false);
    expect(invalidQualityRes.error).toContain('Invalid qualityFilter setting');

    // 4. Unsupported engineVersion
    const invalidEngineRes = validateProjectJson({
      ...validBase,
      engineVersion: '2.5.0',
    });
    expect(invalidEngineRes.valid).toBe(false);
    expect(invalidEngineRes.error).toContain('Unsupported engineVersion');

    // 5. Invalid duration >= 0.5P (e.g. period=4 days, duration=50 hours = 2.083 days >= 2.0 days)
    const invalidDurationRes = validateProjectJson({
      ...validBase,
      settings: {
        ...validBase.settings,
        periodDays: 4.0,
        durationHours: 50.0, // 50 / 24 = 2.083 days > 2.0 days (0.5 * P)
      },
    });
    expect(invalidDurationRes.valid).toBe(false);
    expect(invalidDurationRes.error).toContain('cannot be greater than or equal to half the orbital period');
  });

  it('Custom dataset metadata snapshot preservation and restoration without hardcoded 30 days', () => {
    const customPoints: LightCurvePoint[] = Array.from({ length: 30 }, (_, i) => ({
      time: 10.0 + i * 0.25, // Span is 29 * 0.25 = 7.25 days
      flux: 1.0,
      originalIndex: i,
    }));

    const project: InvestigationProject = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      engineVersion: CURRENT_ENGINE_VERSION,
      datasetId: 'custom_upload_survey',
      datasetVersion: '1.0.0',
      datasetHash: '1111111111111111111111111111111111111111111111111111111111111111',
      datasetTitle: 'Target Star Survey',
      datasetMetadata: {
        timeSpanDays: 7.25,
        pointCount: 30,
        mission: 'other',
        timeFormat: 'relative_days',
        attribution: 'Amateur Observatory Survey',
      },
      settings: {
        periodDays: 2.5,
        epochDays: 10.5,
        durationHours: 2.0,
        normalization: 'none',
        qualityFilter: 'all',
      },
      evidence: [],
      learnerHypothesis: 'candidate_planet',
      learnerConclusion: 'Initial detection test',
      alternativeExplanation: '',
      nextObservation: '',
      customPoints,
      createdAt: '2026-10-26T20:00:00.000Z',
      updatedAt: '2026-10-26T20:00:00.000Z',
    };

    const restored = restoreCustomDatasetFromProject(project);

    // Verified: exactly preserves 7.25 days, NOT hardcoded 30.0 days
    expect(restored.manifest.timeSpanDays).toBe(7.25);
    expect(restored.manifest.pointCount).toBe(30);
    expect(restored.manifest.attribution).toBe('Amateur Observatory Survey');
    expect(restored.points.length).toBe(30);
  });
});
