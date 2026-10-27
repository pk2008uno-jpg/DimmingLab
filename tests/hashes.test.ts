import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { hashLightCurvePoints } from '../src/engine/hash';
import { LightCurveData } from '../src/domain/types';

describe('Data Hash Verification', () => {
  const datasets = [
    { file: 'case_a_kepler8b.json', name: 'Case A (Kepler-8 b)' },
    { file: 'case_b_eclipsing_binary.json', name: 'Case B (Eclipsing Binary)' },
    { file: 'case_c_single_dropout.json', name: 'Case C (Mono-Transit)' },
    { file: 'case_d_injection.json', name: 'Case D (Injection)' },
  ];

  for (const d of datasets) {
    it(`reproduces exact canonical SHA-256 hash for ${d.name}`, () => {
      const raw = readFileSync(`public/data/${d.file}`, 'utf-8');
      const json: LightCurveData = JSON.parse(raw);
      const computedHash = hashLightCurvePoints(json.points);

      console.log(`${d.name} Canonical Hash: ${computedHash}`);
      expect(computedHash).toBe(json.manifest.canonicalDataSha256);
      expect(computedHash.length).toBe(64);
    });
  }
});
