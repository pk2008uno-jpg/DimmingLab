/**
 * DimmingLab - Domain Types
 * Strict domain models for astronomical datasets, investigation settings,
 * evidence diagnostics, and saved projects.
 */

export type DatasetKind = 'observed' | 'synthetic' | 'injection';
export type MissionKind = 'TESS' | 'Kepler' | 'other' | 'simulation';
export type TimeFormat = 'BTJD' | 'BKJD' | 'BJD_TDB' | 'relative_days';

export interface DatasetManifest {
  id: string;
  version: string;
  title: string;
  subtitle: string;
  kind: DatasetKind;
  mission: MissionKind;
  targetId: string | null;
  sourceUrl: string | null;
  sourceProductId: string | null;
  retrievedAt: string | null;
  sourceSha256: string | null;
  canonicalDataSha256: string;
  timeFormat: TimeFormat;
  timeReference: string;
  fluxUnit: string;
  segmentPolicy: string;
  qualityPolicy: string;
  preparationSteps: string[];
  attribution: string;
  reuseNotes: string;
  simulatorVersion?: string;
  seed?: number;
  baseDatasetId?: string;
  pointCount: number;
  timeSpanDays: number;
}

export interface TeachingMetadata {
  suggestedPeriodDays: number;
  suggestedEpochDays: number;
  suggestedDurationHours: number;
  learningGoal: string;
  skillPracticed: string;
  approximateMinutes: number;
  guidedQuestions: string[];
  explanationSummary: string;
  teacherAnswerReveal: {
    astronomicalContext: string;
    catalogIdentifier?: string;
    trueNature: string;
    evidenceEvaluation: string;
    alternativeExplanations: string[];
  };
}

export interface LightCurvePoint {
  time: number;
  flux: number;
  fluxErr?: number;
  quality?: number;
  segment?: number;
  originalIndex: number;
}

export interface LightCurveData {
  manifest: DatasetManifest;
  teaching?: TeachingMetadata;
  points: LightCurvePoint[];
}

export interface InvestigationSettings {
  periodDays: number;
  epochDays: number;
  durationHours: number; // in hours, converted internally to days/phase
  normalization: 'median' | 'none';
  qualityFilter: 'all' | 'clean_only';
}

export type EvidenceStatus = 'measured' | 'inconclusive' | 'not_assessed' | 'needs_review';

/**
 * Temporal and sample coverage for a predicted transit window:
 * - 'adequate': Sufficient samples spanning the transit window duration.
 * - 'partial': Observations exist, but coverage is truncated by gap/edge or sparse.
 * - 'absent': Zero valid observations; true telescope downlink gap or unobserved window.
 */
export type ObservationCoverage = 'adequate' | 'partial' | 'absent';

/**
 * Dimming evidence status for an individual transit window:
 * - 'dimming_detected': Statistically significant flux deficit relative to baseline.
 * - 'flat_baseline': Observed to be consistent with baseline (confirmed non-event).
 * - 'ambiguous_dip': Marginal dip or noise scatter that does not reach detection threshold.
 * - 'brightening': Measured flux is significantly above baseline.
 * - 'insufficient_samples': Too few samples in window to estimate depth.
 * - 'unobserved': Window was in an unobserved gap (absent coverage).
 */
export type DimmingEvidence =
  | 'dimming_detected'
  | 'flat_baseline'
  | 'ambiguous_dip'
  | 'brightening'
  | 'insufficient_samples'
  | 'unobserved';

export interface PredictedWindow {
  cycle: number;
  centerTime: number;
  windowStart: number;
  windowEnd: number;
  overlapsBaseline: boolean;
  sampleCount: number;
  coverage: ObservationCoverage;
  evidence: DimmingEvidence;
  meanFlux?: number;
  depth?: number;
  depthStdErr?: number | null;
  significance?: number | null;
  isEdgeTruncated?: boolean;
}

export interface MetricEntry {
  name: string;
  value: number | null;
  unit: string | null;
  formatted?: string;
  isEstimable?: boolean;
}

export interface EvidenceItem {
  id: string;
  kind: 'repetition' | 'alternating_depths' | 'opposite_phase' | 'sampling_gaps' | 'unassessed_limits';
  status: EvidenceStatus;
  title: string;
  explanation: string;
  metrics: MetricEntry[];
  supportingView: string | null;
  limitations: string[];
}

export type LearnerHypothesis = 
  | 'candidate_planet'
  | 'eclipsing_binary'
  | 'noise_or_artifact'
  | 'insufficient_evidence';

export interface InvestigationProject {
  schemaVersion: number;
  appVersion: string;
  engineVersion: string;
  datasetId: string;
  datasetVersion: string;
  datasetHash: string;
  datasetTitle: string;
  datasetMetadata?: {
    timeSpanDays: number;
    pointCount: number;
    mission?: string;
    timeFormat?: string;
    attribution?: string;
    timeReference?: string;
    fluxUnit?: string;
    kind?: string;
    targetId?: string | null;
    sourceUrl?: string | null;
    sourceProductId?: string | null;
    sourceSha256?: string | null;
    retrievedAt?: string | null;
    segmentPolicy?: string;
    qualityPolicy?: string;
    preparationSteps?: string[];
    reuseNotes?: string;
  };
  settings: InvestigationSettings;
  evidence: EvidenceItem[];
  learnerHypothesis: LearnerHypothesis;
  learnerConclusion: string;
  alternativeExplanation: string;
  nextObservation: string;
  customPoints?: LightCurvePoint[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchCandidate {
  periodDays: number;
  epochDays: number;
  durationHours: number;
  depthPpm: number;
  fitImprovement: number;
  score: number;
  isHarmonic?: 'half_period' | 'double_period' | null;
}

export interface SearchProgress {
  jobId: string;
  progressPercent: number;
  trialCount: number;
  totalTrials: number;
  bestCandidateSoFar?: SearchCandidate;
}

export interface SearchResult {
  jobId: string;
  candidates: SearchCandidate[];
  scannedFrequencyCount: number;
  elapsedMs: number;
}
