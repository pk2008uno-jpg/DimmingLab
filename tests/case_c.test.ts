import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { calculateBoxFit } from '../src/engine/fit';
import { assessEvidence } from '../src/engine/evidence';
import { LightCurveData } from '../src/domain/types';

describe('Case C Real Fixture Test', () => {
  it('correctly assesses Case C as inconclusive repetition', () => {
    const raw = readFileSync('public/data/case_c_single_dropout.json', 'utf-8');
    const data: LightCurveData = JSON.parse(raw);
    const settings = {
      periodDays: 3.75,
      epochDays: 115.0,
      durationHours: 4.5,
      normalization: 'median' as const,
      qualityFilter: 'all' as const,
    };

    const fit = calculateBoxFit(data.points, settings);
    const rep = assessEvidence(data.points, settings, fit);

    console.log('Case C fit depth:', fit.depth, 'fitImprovement:', fit.fitImprovement);
    console.log('Events:');
    for (const e of rep.windows) {
      console.log(`Cycle ${e.cycle}: center=${e.centerTime}, sampleCount=${e.sampleCount}, depth=${e.depth}, err=${e.depthStdErr}, sig=${e.significance}, ev=${e.evidence}`);
    }

    const item = rep.items.find(i => i.id === 'repetition');
    console.log('Repetition status:', item?.status);
    console.log('Explanation:', item?.explanation);
    expect(item?.status).toBe('inconclusive');
  });
});
