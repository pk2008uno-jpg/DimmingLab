import { describe, it, expect } from 'vitest';
import { parseLightCurveCsv } from '../src/features/import/csvParser';
import { validateProjectJson } from '../src/features/evidence/exportImport';

describe('CSV Parser and Validator', () => {
  it('parses standard time,flux,flux_err CSV correctly', () => {
    const csv = `time,flux,flux_err\n100.1,1.002,0.001\n100.2,0.985,0.001\n100.3,1.001,0.001\n`;
    const res = parseLightCurveCsv(csv);
    expect(res.errors.length).toBe(0);
    expect(res.validPoints.length).toBe(3);
    expect(res.validPoints[0].time).toBe(100.1);
    expect(res.validPoints[1].flux).toBe(0.985);
    expect(res.validPoints[1].fluxErr).toBe(0.001);
  });

  it('rejects non-numeric rows and reports rejected count', () => {
    const csv = `time,flux\n100.1,1.00\nNaN,1.00\n100.3,corrupted\n100.4,0.99\n`;
    const res = parseLightCurveCsv(csv);
    expect(res.validPoints.length).toBe(2);
    expect(res.rejectedRowCount).toBe(2);
    expect(res.warnings.some(w => w.includes('missing or non-numeric'))).toBe(true);
  });

  it('detects duplicate timestamps and emits warning', () => {
    const csv = `time,flux\n100.0,1.00\n100.0,1.01\n100.5,0.99\n`;
    const res = parseLightCurveCsv(csv);
    expect(res.validPoints.length).toBe(3);
    expect(res.duplicateTimeCount).toBe(1);
    expect(res.warnings.some(w => w.includes('duplicate timestamps'))).toBe(true);
  });

  it('sorts out-of-order rows by time ascending', () => {
    const csv = `time,flux\n105.0,1.00\n101.0,0.99\n103.0,1.01\n`;
    const res = parseLightCurveCsv(csv);
    expect(res.validPoints[0].time).toBe(101.0);
    expect(res.validPoints[1].time).toBe(103.0);
    expect(res.validPoints[2].time).toBe(105.0);
  });

  it('handles UTF-8 BOM transparently', () => {
    const bomCsv = '\uFEFFtime,flux\n100.1,1.00\n100.2,0.98\n';
    const res = parseLightCurveCsv(bomCsv);
    expect(res.validPoints.length).toBe(2);
    expect(res.errors.length).toBe(0);
  });

  it('correctly handles the exact review four-row CSV: 2 valid rows, 2 rejected, no invented zeros', () => {
    // Row 1: valid time=0, flux=1.0 (numeric zero must be accepted)
    // Row 2: empty time cell ",1.0" (must NOT become 0.0, must be rejected)
    // Row 3: empty flux cell "1.0," (must NOT become 0.0, must be rejected)
    // Row 4: valid time=2.0, flux=0.99
    const csv = 'time,flux\n0,1.0\n,1.0\n1.0,\n2.0,0.99\n';
    const res = parseLightCurveCsv(csv);
    expect(res.validPoints.length).toBe(2);
    expect(res.rejectedRowCount).toBe(2);
    expect(res.validPoints[0].time).toBe(0);
    expect(res.validPoints[0].flux).toBe(1.0);
    expect(res.validPoints[1].time).toBe(2.0);
    expect(res.validPoints[1].flux).toBe(0.99);
    expect(res.validPoints.some(p => p.time === 1.0 && p.flux === 0.0)).toBe(false);
  });
});

describe('Project Export and Schema Validator', () => {
  it('validates a conformant project schema', () => {
    const validProject = {
      schemaVersion: 1,
      appVersion: '1.0.0',
      engineVersion: '1.0.0',
      datasetId: 'case_a_kepler8b',
      datasetVersion: '1.0.0',
      datasetHash: 'ba188e8782ff0be96198b66424302c17a4f68a7cc472b7b1a2e4778312c48bf8',
      datasetTitle: 'Kepler-8 b',
      settings: {
        periodDays: 3.5225,
        epochDays: 131.687,
        durationHours: 3.2,
        normalization: 'median',
        qualityFilter: 'clean_only',
      },
      evidence: [],
      learnerHypothesis: 'candidate_planet',
      learnerConclusion: 'Strong periodic signal with 9 repeating dips.',
      alternativeExplanation: 'Could be blended binary, but depth and duration fit hot Jupiter.',
      nextObservation: 'Request radial velocity spectrum.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = validateProjectJson(validProject);
    expect(res.valid).toBe(true);
    expect(res.project?.datasetId).toBe('case_a_kepler8b');
    expect(res.project?.settings.periodDays).toBe(3.5225);
  });

  it('rejects project with invalid schema version or missing settings', () => {
    const invalidVer = {
      schemaVersion: 99,
      datasetId: 'test',
    };
    expect(validateProjectJson(invalidVer).valid).toBe(false);

    const missingSettings = {
      schemaVersion: 1,
      datasetId: 'test',
      datasetHash: '123',
    };
    expect(validateProjectJson(missingSettings).valid).toBe(false);
  });
});
