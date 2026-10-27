import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateBoxFit } from '../src/engine/fit';
import { computeAnalysisSnapshot } from '../src/engine/analysis';
import { computePhaseAndCycle } from '../src/engine/folding';
import { assessEvidence } from '../src/engine/evidence';
import { hashLightCurvePoints } from '../src/engine/hash';
import { parseOfflineManifest, missingOfflineAssets, type OfflineManifest } from '../src/offline/offlineManager';
import { assertDatasetMatchesProject, validateProjectJson, restoreCustomDatasetFromProject } from '../src/features/evidence/exportImport';
import type { InvestigationSettings, LightCurveData, LightCurvePoint, InvestigationProject } from '../src/domain/types';

const settings: InvestigationSettings = { periodDays: 4, epochDays: 0.5, durationHours: 3, normalization: 'none', qualityFilter: 'all' };
function series(depth = 1 / 64, error?: number): LightCurvePoint[] {
  return Array.from({length:1001}, (_, i) => {
    const time = i * 0.02;
    const {phase} = computePhaseAndCycle(time, settings.epochDays, settings.periodDays);
    return { time, flux: Math.abs(phase) <= 3 / 24 / 4 / 2 ? 1 - depth : 1, fluxErr:error, originalIndex:i };
  });
}
function custom(): InvestigationProject {
  const customPoints = series();
  return { schemaVersion:1, appVersion:'1.0.0',engineVersion:'1.0.0',datasetId:'custom_release',datasetVersion:'1.0.0',
    datasetTitle:'Release control',datasetHash:hashLightCurvePoints(customPoints),customPoints,settings,evidence:[],learnerHypothesis:'insufficient_evidence',
    learnerConclusion:'Exact learner text',alternativeExplanation:'',nextObservation:'',createdAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T00:00:00Z' };
}

describe('Release blockers', () => {
  it('propagates known uncertainty to each mean and to the depth, even for zero residual scatter', () => {
    const fit = calculateBoxFit(series(1 / 64, 1 / 1024), settings);
    expect(fit.inTransitStdErr).toBeCloseTo(1 / 1024 / Math.sqrt(fit.inTransitCount), 12);
    expect(fit.outOfTransitStdErr).toBeCloseTo(1 / 1024 / Math.sqrt(fit.outOfTransitCount), 12);
    expect(fit.rawDepthStdErr! * 1e6).toBeCloseTo(168.032967, 4);
  });
  it('uses consistent empirical weights for incomplete errors and preserves scale invariance', () => {
    const points = series(); points[0].fluxErr = 0.001; points[0].flux += 0.001;
    const a = calculateBoxFit(points, settings);
    const b = calculateBoxFit(points.map(p => ({...p,flux:p.flux*1024,fluxErr:p.fluxErr === undefined ? undefined : p.fluxErr*1024})), settings);
    expect(a.uncertaintyModel).toBe('empirical_residuals');
    expect(b.depthPercent).toBeCloseTo(a.depthPercent!, 10);
    expect(b.fractionalDepthStdErr).toBeCloseTo(a.fractionalDepthStdErr!, 12);
  });
  it('does not count nonfinite timestamps as baseline observations', () => {
    const points = series(); const a = calculateBoxFit(points, settings);
    const b = calculateBoxFit([...points,{time:NaN,flux:1e6,originalIndex:1001}],settings);
    expect(b).toEqual(a);
    expect(computeAnalysisSnapshot([...points,{time:NaN,flux:1e6,quality:0,originalIndex:1001}],{...settings,qualityFilter:'clean_only'}).activePoints).toHaveLength(points.length);
  });
  it('retains exact shallow dips below one ppm without inventing significance', () => {
    const snapshot = computeAnalysisSnapshot(series(1 / 2 ** 22), settings);
    expect(snapshot.diagnostics.dimmingDetectedCount).toBe(5);
    expect(snapshot.boxFit.significance).toBeNull();
  });
  it('describes brightening windows without claiming all windows are flat', () => {
    const snapshot = computeAnalysisSnapshot(series(-1 / 64), settings);
    expect(snapshot.diagnostics.items[0].explanation).not.toContain('all are consistent with flat');
    expect(snapshot.diagnostics.items[0].metrics.find(m => m.name === 'Brightening Windows')?.value).toBe(5);
  });
  it('does not call tightly clustered partial measurements complete observation continuity', () => {
    const cfg={...settings,epochDays:2,durationHours:9.6};
    const points:LightCurvePoint[]=[];
    for(let i=0;i<=2400;i++){
      const time=i*.01;const {phase}=computePhaseAndCycle(time,2,4);
      if(Math.abs(phase)>.4/4/2)points.push({time,flux:1,originalIndex:points.length});
    }
    for(let c=0;c<6;c++)for(let j=0;j<4;j++)points.push({time:2+4*c-.195+j*.001,flux:1,originalIndex:points.length});
    points.sort((a,b)=>a.time-b.time);
    const result=assessEvidence(points,cfg,calculateBoxFit(points,cfg));
    expect(result.adequateCoverageCount).toBe(0);expect(result.partialCoverageCount).toBe(6);
    const item=result.items.find(i=>i.id==='sampling_gaps')!;
    expect(item.explanation).not.toContain('Complete observation continuity');
    expect(item.explanation).toContain('6 partial');
    expect(item.limitations.join(' ')).not.toContain('ensures no transits');
  });
  it('keeps known-error alternating-depth comparisons invariant under raw flux scaling', () => {
    const points=series(0,0.003).map(p=>{
      const {phase,cycle}=computePhaseAndCycle(p.time,settings.epochDays,settings.periodDays);
      return {...p,flux:Math.abs(phase)<=3/24/4/2 ? 1-(Math.abs(cycle)%2 ? .025 : .01):1};
    });
    const diagnostic=(p:LightCurvePoint[])=>assessEvidence(p,settings,calculateBoxFit(p,settings)).items.find(i=>i.id==='alternating_depths')!;
    const a=diagnostic(points), b=diagnostic(points.map(p=>({...p,flux:p.flux*1000,fluxErr:p.fluxErr!*1000})));
    expect(a.status).toBe('needs_review');
    expect(b.metrics.find(m=>m.name==='Standardized Diff')?.value).toBe(a.metrics.find(m=>m.name==='Standardized Diff')?.value);
  });
  it('keeps workspace and report measurements independent of detector-count scale', () => {
    const points=series().map(p=>({...p,flux:p.flux*1024}));
    for(const normalization of ['median','none'] as const) {
      const a=computeAnalysisSnapshot(points,{...settings,normalization});
      expect(a.boxFit.depthPercent).toBeCloseTo(1.5625,10);
      expect(computeAnalysisSnapshot(points,{...settings,normalization}).boxFit).toEqual(a.boxFit);
    }
  });
  it('rejects corrupt evidence and invalid optional measurement errors', () => {
    expect(validateProjectJson({...custom(),evidence:[null]}).valid).toBe(false);
    const p=custom();p.customPoints![0].fluxErr=-1;
    expect(validateProjectJson(p).valid).toBe(false);
  });
  it('rejects unsupported dataset metadata enums', () => {
    expect(validateProjectJson({...custom(),datasetMetadata:{pointCount:1001,timeSpanDays:20,timeFormat:'hours'}}).valid).toBe(false);
  });
  it('restores factual sample count and span instead of trusting stale metadata', () => {
    const data=restoreCustomDatasetFromProject({...custom(),datasetMetadata:{timeSpanDays:30,pointCount:999,timeFormat:'BTJD',kind:'synthetic'}});
    expect(data.manifest.timeSpanDays).toBe(20);expect(data.manifest.pointCount).toBe(1001);
    expect(data.manifest.kind).toBe('synthetic');expect(data.manifest.timeFormat).toBe('BTJD');
  });
  it('preserves source provenance in a project round trip', () => {
    const p={...custom(),datasetMetadata:{timeSpanDays:20,pointCount:1001,timeFormat:'BTJD',sourceUrl:'https://example.org/data',sourceProductId:'control',attribution:'Teaching control',preparationSteps:['Finite rows'],kind:'synthetic'}};
    const result=validateProjectJson(JSON.parse(JSON.stringify(p)));
    expect(result.valid).toBe(true);
    const data=restoreCustomDatasetFromProject(result.project!);
    expect(data.manifest.sourceUrl).toBe(p.datasetMetadata.sourceUrl);expect(data.manifest.preparationSteps).toEqual(['Finite rows']);
  });
  it('checks the resolved measurements against the saved identity, hash and version', () => {
    const data=JSON.parse(readFileSync('public/data/case_a_kepler8b.json','utf8')) as LightCurveData;
    const project={datasetId:data.manifest.id,datasetHash:data.manifest.canonicalDataSha256,datasetVersion:data.manifest.version};
    expect(()=>assertDatasetMatchesProject(data,project)).not.toThrow();
    data.points[0].flux+=.01;
    expect(()=>assertDatasetMatchesProject(data,project)).toThrow(/do not match/);
  });
});

describe('Exact offline build resources',()=>{
  const manifest:OfflineManifest={schemaVersion:1,buildId:'1234567890abcdef',cacheName:'dimminglab-build-1234567890abcdef',assets:[
    '/index.html','/offline-manifest.json',...['case_a_kepler8b','case_b_eclipsing_binary','case_c_single_dropout','case_d_injection'].map(id=>`/data/${id}.json`),
    '/assets/index-current.js','/assets/index-current.css','/assets/searchWorker-current.js','/assets/search-current.js']};
  it('requires all resource categories in a valid manifest',()=>{
    expect(parseOfflineManifest(manifest)).toEqual(manifest);
    expect(()=>parseOfflineManifest({...manifest,assets:manifest.assets.filter(p=>!p.includes('/assets/'))})).toThrow();
  });
  it('rejects a cache-name mismatch',()=>expect(()=>parseOfflineManifest({...manifest,cacheName:'dimminglab-old'})).toThrow());
  it('does not accept old assets as a replacement for a missing current script',async()=>{
    const present=new Set([...manifest.assets.filter(url=>url!=='/assets/index-current.js'),'/assets/index-old.js']);
    const cache={match:async(input:RequestInfo|URL)=>present.has(String(input))?new Response('cached'):undefined} as Pick<Cache,'match'>;
    expect(await missingOfflineAssets(cache,manifest)).toEqual(['/assets/index-current.js']);
  });
  it('accepts only the complete current pack',async()=>{
    const cache={match:async()=>new Response('cached')} as Pick<Cache,'match'>;
    expect(await missingOfflineAssets(cache,manifest)).toEqual([]);
  });
});
