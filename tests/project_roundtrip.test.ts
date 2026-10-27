import { describe, it, expect } from 'vitest';
import { validateProjectJson } from '../src/features/evidence/exportImport';
import { InvestigationProject } from '../src/domain/types';

describe('Project Export/Import Round-Trip Verification', () => {
  it('preserves exact project state across serialization and import', () => {
    const originalProject: InvestigationProject = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      engineVersion: '1.0.0',
      datasetId: 'case_b_eclipsing_binary',
      datasetVersion: '1.0.0',
      datasetHash: 'a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c',
      datasetTitle: 'The Convincing Impostor: Alternating Depths',
      settings: {
        periodDays: 4.200,
        epochDays: 101.500,
        durationHours: 4.0,
        normalization: 'median',
        qualityFilter: 'clean_only',
      },
      evidence: [
        {
          id: 'alternating_depths',
          kind: 'alternating_depths',
          status: 'needs_review',
          title: 'Alternating Eclipse Depths',
          explanation: 'Odd and even cycle depths differ significantly.',
          metrics: [{ name: 'Depth Difference', value: 1.7, unit: '%' }],
          supportingView: 'phase-folded',
          limitations: ['Binary star system'],
        },
      ],
      learnerHypothesis: 'eclipsing_binary',
      learnerConclusion: 'I determined this is an eclipsing binary because doubling the period reveals primary and secondary eclipses.',
      alternativeExplanation: 'Could be two resonant planets, but identical transit durations support binary stars.',
      nextObservation: 'Collect high-resolution spectra to measure double-lined radial velocity curves.',
      createdAt: '2026-10-26T20:00:00.000Z',
      updatedAt: '2026-10-26T20:30:00.000Z',
    };

    // Serialize to JSON string (export)
    const jsonStr = JSON.stringify(originalProject);
    const parsedObj = JSON.parse(jsonStr);

    // Re-import and validate
    const validation = validateProjectJson(parsedObj);
    expect(validation.valid).toBe(true);
    expect(validation.project).toBeDefined();

    const imported = validation.project!;
    expect(imported.datasetId).toBe('case_b_eclipsing_binary');
    expect(imported.datasetHash).toBe('a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c');
    expect(imported.settings.periodDays).toBe(4.200);
    expect(imported.settings.epochDays).toBe(101.500);
    expect(imported.learnerHypothesis).toBe('eclipsing_binary');
    expect(imported.learnerConclusion).toBe(originalProject.learnerConclusion);
    expect(imported.alternativeExplanation).toBe(originalProject.alternativeExplanation);
    expect(imported.nextObservation).toBe(originalProject.nextObservation);
    expect(imported.evidence[0].status).toBe('needs_review');
  });

  it('rejects corrupt, missing, or invalid project files', () => {
    // 1. Not an object
    expect(validateProjectJson('not json').valid).toBe(false);
    expect(validateProjectJson(null).valid).toBe(false);

    // 2. Unsupported schema version
    expect(validateProjectJson({ schemaVersion: 2, datasetId: 'test' }).valid).toBe(false);

    // 3. Missing datasetId
    expect(validateProjectJson({ schemaVersion: 1, datasetHash: '123' }).valid).toBe(false);

    // 4. Missing or invalid settings
    expect(validateProjectJson({ schemaVersion: 1, datasetId: 'test', datasetHash: '123' }).valid).toBe(false);
    expect(validateProjectJson({
      schemaVersion: 1,
      datasetId: 'test',
      datasetHash: 'a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c',
      settings: { periodDays: -2.0, epochDays: 0, durationHours: 2.0 },
    }).valid).toBe(false);

    // 5. Duration >= Period
    expect(validateProjectJson({
      schemaVersion: 1,
      datasetId: 'test',
      datasetHash: 'a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c',
      settings: { periodDays: 1.0, epochDays: 0, durationHours: 25.0 }, // 25h > 24h (1.0d)
      evidence: [],
    }).valid).toBe(false);

    // 6. Cryptographic hash mismatch on custom points
    const customPoints = [
      { time: 1.0, flux: 1.0, originalIndex: 0 },
      { time: 2.0, flux: 0.99, originalIndex: 1 },
      { time: 3.0, flux: 1.0, originalIndex: 2 },
      { time: 4.0, flux: 1.0, originalIndex: 3 },
      { time: 5.0, flux: 1.0, originalIndex: 4 },
      { time: 6.0, flux: 1.0, originalIndex: 5 },
      { time: 7.0, flux: 1.0, originalIndex: 6 },
      { time: 8.0, flux: 1.0, originalIndex: 7 },
      { time: 9.0, flux: 1.0, originalIndex: 8 },
      { time: 10.0, flux: 1.0, originalIndex: 9 },
    ];
    const mismatchRes = validateProjectJson({
      schemaVersion: 1,
      datasetId: 'custom_upload_1',
      datasetHash: '0000000000000000000000000000000000000000000000000000000000000000', // corrupt fake hash
      settings: { periodDays: 2.0, epochDays: 0, durationHours: 2.0 },
      evidence: [],
      customPoints,
    });
    expect(mismatchRes.valid).toBe(false);
    expect(mismatchRes.error).toContain('Cryptographic data integrity mismatch');
  });
});
