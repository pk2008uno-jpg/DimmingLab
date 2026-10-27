/**
 * DimmingLab - Project Export and Import System
 * Generates portable, reproducible JSON project files and validates schemas and data integrity on reimport.
 */

import { InvestigationProject, LightCurveData, LightCurvePoint, LearnerHypothesis } from '../../domain/types';
import { canonicalPointsRepresentation, computeSha256 } from '../../engine/hash';
import { CURATED_INVESTIGATIONS } from '../../data/curatedDatasets';

export const CURRENT_SCHEMA_VERSION = 1;
export const CURRENT_ENGINE_VERSION = '1.1.0';
export const CURRENT_APP_VERSION = '1.0.2';
export const CURATED_DATASET_HASHES: Record<string, string> = {
  case_a_kepler8b: 'ba188e8782ff0be96198b66424302c17a4f68a7cc472b7b1a2e4778312c48bf8',
  case_b_eclipsing_binary: 'a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c',
  case_c_single_dropout: 'd472c1dde4827b3d7ae5a5a7272a9fbc4e3548d39f4aa760c1d2b20d10adc12d',
  case_d_injection: 'e0aa16ce1b07d26c9be4e728bdc549657db29df8a59de8c4807c51717ea6c7f8',
};

export function assertDatasetMatchesProject(dataset: LightCurveData, project: Pick<InvestigationProject, 'datasetId' | 'datasetHash' | 'datasetVersion'>): void {
  if (!dataset?.manifest || !Array.isArray(dataset.points) || dataset.manifest.id !== project.datasetId ||
      dataset.manifest.version !== project.datasetVersion ||
      computeSha256(canonicalPointsRepresentation(dataset.points)) !== project.datasetHash ||
      dataset.manifest.canonicalDataSha256 !== project.datasetHash) {
    throw new Error('The loaded measurements do not match this investigation. Reload the official dataset or select the original project file.');
  }
}

export const VALID_HYPOTHESES: readonly LearnerHypothesis[] = [
  'candidate_planet',
  'eclipsing_binary',
  'noise_or_artifact',
  'insufficient_evidence',
];

export interface ProjectValidationResult {
  valid: boolean;
  project?: InvestigationProject;
  error?: string;
  recomputedHash?: string;
  isCustomUpload?: boolean;
}

/**
 * Validates whether an unknown JSON object conforms to InvestigationProject schema,
 * verifies parameter boundaries and mathematical relationships, and recomputes
 * cryptographic data hashes to ensure authentic data integrity.
 */
export function validateProjectJson(data: unknown): ProjectValidationResult {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Project data must be a JSON object.' };
  }

  const p = data as Record<string, unknown>;

  // 1. Schema version & engine version
  if (p.schemaVersion !== 1) {
    return {
      valid: false,
      error: `Unsupported schema version: ${String(p.schemaVersion)}. Expected schema version 1.`,
    };
  }
  if (p.engineVersion !== undefined && (typeof p.engineVersion !== 'string' || !['1.0.0', CURRENT_ENGINE_VERSION].includes(p.engineVersion))) {
    return {
      valid: false,
      error: `Unsupported engineVersion: '${String(p.engineVersion)}'. Expected engineVersion '${CURRENT_ENGINE_VERSION}'.`,
    };
  }

  // 2. Dataset identification
  if (typeof p.datasetId !== 'string' || !p.datasetId.trim()) {
    return { valid: false, error: 'Project missing required datasetId string.' };
  }
  const datasetId = p.datasetId.trim();
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(datasetId)) return { valid: false, error: 'Invalid dataset identifier.' };

  // 3. Dataset Hash syntax validation (must be 64-character hex string)
  if (typeof p.datasetHash !== 'string' || !/^[a-f0-9]{64}$/i.test(p.datasetHash.trim())) {
    return {
      valid: false,
      error: 'Project contains invalid datasetHash. Must be a 64-character SHA-256 hexadecimal hash.',
    };
  }
  const datasetHash = p.datasetHash.trim().toLowerCase();

  // 4. Investigation Settings validation
  if (typeof p.settings !== 'object' || p.settings === null) {
    return { valid: false, error: 'Project missing valid settings object.' };
  }

  const s = p.settings as Record<string, unknown>;

  if (s.periodDays === null || s.periodDays === undefined || typeof s.periodDays !== 'number' || !Number.isFinite(s.periodDays) || s.periodDays <= 0) {
    return { valid: false, error: 'Settings contains invalid periodDays. Must be a finite positive number.' };
  }
  if (s.epochDays === null || s.epochDays === undefined || typeof s.epochDays !== 'number' || !Number.isFinite(s.epochDays)) {
    return { valid: false, error: 'Settings contains invalid epochDays. Must be a finite number.' };
  }
  if (s.durationHours === null || s.durationHours === undefined || typeof s.durationHours !== 'number' || !Number.isFinite(s.durationHours) || s.durationHours <= 0) {
    return { valid: false, error: 'Settings contains invalid durationHours. Must be a finite positive number.' };
  }

  const periodDays = s.periodDays;
  const epochDays = s.epochDays;
  const durationHours = s.durationHours;

  // Valid relationship: transit duration cannot exceed or equal half the orbital period
  const durationDays = durationHours / 24.0;
  if (durationDays >= 0.5 * periodDays) {
    return {
      valid: false,
      error: `Transit duration (${durationHours.toFixed(1)}h = ${durationDays.toFixed(2)}d) cannot be greater than or equal to half the orbital period (0.5 * ${periodDays.toFixed(2)}d = ${(0.5 * periodDays).toFixed(2)}d).`,
    };
  }

  // Strict Enums (default to standard defaults if omitted, reject if invalid enum provided)
  const normalization = s.normalization === undefined ? 'median' : s.normalization;
  if (normalization !== 'median' && normalization !== 'none') {
    return { valid: false, error: `Invalid normalization setting: '${String(s.normalization)}'. Expected 'median' or 'none'.` };
  }
  const qualityFilter = s.qualityFilter === undefined ? 'clean_only' : s.qualityFilter;
  if (qualityFilter !== 'all' && qualityFilter !== 'clean_only') {
    return { valid: false, error: `Invalid qualityFilter setting: '${String(s.qualityFilter)}'. Expected 'all' or 'clean_only'.` };
  }

  // 5. Learner fields & enums
  let learnerHypothesis: LearnerHypothesis = 'insufficient_evidence';
  if (typeof p.learnerHypothesis === 'string' && VALID_HYPOTHESES.includes(p.learnerHypothesis as LearnerHypothesis)) {
    learnerHypothesis = p.learnerHypothesis as LearnerHypothesis;
  } else if (p.learnerHypothesis !== undefined) {
    return {
      valid: false,
      error: `Unsupported learnerHypothesis: '${String(p.learnerHypothesis)}'. Expected one of: ${VALID_HYPOTHESES.join(', ')}.`,
    };
  }

  if (!Array.isArray(p.evidence)) {
    return { valid: false, error: 'Project missing required evidence array.' };
  }
  const evidenceKinds = ['repetition', 'alternating_depths', 'opposite_phase', 'sampling_gaps', 'unassessed_limits'];
  const evidenceStatuses = ['measured', 'needs_review', 'inconclusive', 'not_assessed'];
  for (const item of p.evidence) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !evidenceKinds.includes(item.kind) ||
        !evidenceStatuses.includes(item.status) || typeof item.title !== 'string' || typeof item.explanation !== 'string' ||
        !Array.isArray(item.metrics) || !Array.isArray(item.limitations) || !item.limitations.every((v: unknown) => typeof v === 'string') ||
        !item.metrics.every((m: {name?: unknown; value?: unknown}) => m && typeof m.name === 'string' && (m.value === null || Number.isFinite(m.value)))) {
      return { valid: false, error: 'Project contains malformed evidence records.' };
    }
  }

  // 6. Anti-impersonation and Custom points validation
  const KNOWN_CURATED_HASHES = CURATED_DATASET_HASHES;

  const isCurated = CURATED_INVESTIGATIONS.some(c => c.id === datasetId) || datasetId in KNOWN_CURATED_HASHES;

  if (isCurated) {
    // Curated datasets must never allow injected custom points (Anti-Impersonation)
    if (p.customPoints !== undefined) {
      return {
        valid: false,
        error: `Anti-impersonation violation: Cannot provide customPoints for curated dataset '${datasetId}'. Official curated datasets cannot be modified or impersonated.`,
      };
    }
    const expectedHash = KNOWN_CURATED_HASHES[datasetId];
    if (expectedHash && expectedHash !== datasetHash) {
      return {
        valid: false,
        error: `Corrupted project: Curated dataset '${datasetId}' hash mismatch. Expected ${expectedHash}, found ${datasetHash}.`,
      };
    }
  } else {
    if (!datasetId.startsWith('custom_')) return { valid: false, error: 'Custom dataset identifiers must begin with custom_.' };
    // Custom uploads must provide customPoints
    if (p.customPoints === undefined) {
      return {
        valid: false,
        error: `Custom dataset '${datasetId}' missing required embedded customPoints array.`,
      };
    }
  }

  let customPoints: LightCurvePoint[] | undefined;
  if (p.customPoints !== undefined) {
    if (!Array.isArray(p.customPoints)) {
      return { valid: false, error: 'Embedded customPoints must be an array.' };
    }
    if (p.customPoints.length < 10) {
      return { valid: false, error: 'Embedded customPoints must contain at least 10 observations.' };
    }
    if (p.customPoints.length > 250000) {
      return { valid: false, error: 'Embedded customPoints exceeds maximum permitted limit (250,000 points).' };
    }

    // Validate points schema
    for (let i = 0; i < p.customPoints.length; i++) {
      const pt = p.customPoints[i];
      if (typeof pt !== 'object' || pt === null) {
        return { valid: false, error: `Point at index ${i} is not a valid object.` };
      }
      if (!Number.isFinite(pt.time) || !Number.isFinite(pt.flux)) {
        return { valid: false, error: `Point at index ${i} has non-finite time (${pt.time}) or flux (${pt.flux}).` };
      }
      if (pt.fluxErr !== undefined && (!Number.isFinite(pt.fluxErr) || pt.fluxErr <= 0)) {
        return { valid: false, error: `Point at index ${i} has invalid measurement uncertainty.` };
      }
      for (const field of ['quality', 'segment', 'originalIndex']) {
        if (pt[field] !== undefined && (!Number.isInteger(pt[field]) || (field !== 'segment' && pt[field] < 0))) {
          return { valid: false, error: `Point at index ${i} has invalid ${field}.` };
        }
      }
    }
    customPoints = p.customPoints as LightCurvePoint[];

    // Recompute SHA-256 hash from canonical representation
    const canonicalStr = canonicalPointsRepresentation(customPoints);
    const recomputed = computeSha256(canonicalStr);

    if (recomputed.toLowerCase() !== datasetHash) {
      return {
        valid: false,
        error: `Cryptographic data integrity mismatch: declared datasetHash (${datasetHash}) does not match recomputed data hash (${recomputed}). Points may be corrupted or modified.`,
        recomputedHash: recomputed,
      };
    }
  }

  // 7. Extract dataset metadata snapshot if present
  let datasetMetadata: InvestigationProject['datasetMetadata'];
  if (typeof p.datasetMetadata === 'object' && p.datasetMetadata !== null) {
    const raw = p.datasetMetadata as Record<string, unknown>;
    for (const [field, permitted] of Object.entries({
      mission: ['Kepler', 'TESS', 'other', 'simulation'],
      timeFormat: ['relative_days', 'BKJD', 'BTJD', 'BJD_TDB'],
      kind: ['observed', 'synthetic', 'injection'],
    })) {
      if (raw[field] !== undefined && !permitted.includes(raw[field] as string)) {
        return { valid: false, error: `Unsupported dataset metadata ${field}.` };
      }
    }
    const timeSpan = Number(raw.timeSpanDays);
    const count = Number(raw.pointCount);
    datasetMetadata = {
      timeSpanDays: Number.isFinite(timeSpan) && timeSpan > 0 ? timeSpan : 0,
      pointCount: Number.isFinite(count) && count > 0 ? count : 0,
      mission: typeof raw.mission === 'string' ? raw.mission : undefined,
      timeFormat: typeof raw.timeFormat === 'string' ? raw.timeFormat : undefined,
      attribution: typeof raw.attribution === 'string' ? raw.attribution : undefined,
      timeReference: typeof raw.timeReference === 'string' ? raw.timeReference : undefined,
      fluxUnit: typeof raw.fluxUnit === 'string' ? raw.fluxUnit : undefined,
      kind: typeof raw.kind === 'string' ? raw.kind : undefined,
      targetId: typeof raw.targetId === 'string' ? raw.targetId : null,
      sourceUrl: typeof raw.sourceUrl === 'string' ? raw.sourceUrl : null,
      sourceProductId: typeof raw.sourceProductId === 'string' ? raw.sourceProductId : null,
      sourceSha256: typeof raw.sourceSha256 === 'string' ? raw.sourceSha256 : null,
      retrievedAt: typeof raw.retrievedAt === 'string' ? raw.retrievedAt : null,
      segmentPolicy: typeof raw.segmentPolicy === 'string' ? raw.segmentPolicy : undefined,
      qualityPolicy: typeof raw.qualityPolicy === 'string' ? raw.qualityPolicy : undefined,
      preparationSteps: Array.isArray(raw.preparationSteps) && raw.preparationSteps.every(v => typeof v === 'string') ? raw.preparationSteps : undefined,
      reuseNotes: typeof raw.reuseNotes === 'string' ? raw.reuseNotes : undefined,
    };
  }

  const project: InvestigationProject = {
    schemaVersion: 1,
    appVersion: String(p.appVersion || CURRENT_APP_VERSION),
    engineVersion: String(p.engineVersion || CURRENT_ENGINE_VERSION),
    datasetId,
    datasetVersion: String(p.datasetVersion || '1.0.0'),
    datasetHash,
    datasetTitle: String(p.datasetTitle || datasetId),
    datasetMetadata,
    settings: {
      periodDays,
      epochDays,
      durationHours,
      normalization,
      qualityFilter,
    },
    evidence: p.evidence as InvestigationProject['evidence'],
    learnerHypothesis,
    learnerConclusion: typeof p.learnerConclusion === 'string' ? p.learnerConclusion : '',
    alternativeExplanation: typeof p.alternativeExplanation === 'string' ? p.alternativeExplanation : '',
    nextObservation: typeof p.nextObservation === 'string' ? p.nextObservation : '',
    customPoints,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { valid: true, project, isCustomUpload: customPoints !== undefined };
}

/**
 * Builds a clean LightCurveData object when restoring custom points from project export.
 * Preserves custom dataset manifest metadata snapshot and calculates span dynamically.
 */
export function restoreCustomDatasetFromProject(project: InvestigationProject): LightCurveData {
  if (!project.customPoints || project.customPoints.length === 0) {
    throw new Error('Project does not contain customPoints.');
  }

  const pts = project.customPoints;
  let minT = Infinity;
  let maxT = -Infinity;
  for (const pt of pts) {
    if (pt.time < minT) minT = pt.time;
    if (pt.time > maxT) maxT = pt.time;
  }
  const timeSpanDays = maxT - minT;
  if (!Number.isFinite(timeSpanDays) || timeSpanDays <= 0) throw new Error('Custom observations must span a positive time interval.');

  const pointCount = pts.length;
  const mission = (project.datasetMetadata?.mission as LightCurveData['manifest']['mission']) || 'other';
  const timeFormat = (project.datasetMetadata?.timeFormat as LightCurveData['manifest']['timeFormat']) || 'relative_days';
  const attribution = project.datasetMetadata?.attribution || 'User Upload (Custom Light Curve)';
  const kind = (project.datasetMetadata?.kind as LightCurveData['manifest']['kind']) || 'observed';

  return {
    manifest: {
      id: project.datasetId,
      version: project.datasetVersion,
      title: project.datasetTitle,
      subtitle: 'Restored from saved project file',
      kind,
      mission,
      targetId: project.datasetMetadata?.targetId || project.datasetTitle,
      sourceUrl: project.datasetMetadata?.sourceUrl ?? null,
      sourceProductId: project.datasetMetadata?.sourceProductId ?? null,
      retrievedAt: project.datasetMetadata?.retrievedAt ?? project.createdAt,
      sourceSha256: project.datasetMetadata?.sourceSha256 ?? null,
      canonicalDataSha256: project.datasetHash,
      timeFormat,
      timeReference: project.datasetMetadata?.timeReference || 'Legacy user timestamps assumed in days; confirm the time reference before interpreting epochs.',
      fluxUnit: project.datasetMetadata?.fluxUnit || 'Relative Flux',
      segmentPolicy: project.datasetMetadata?.segmentPolicy || 'Imported points',
      qualityPolicy: project.datasetMetadata?.qualityPolicy || 'Validated',
      preparationSteps: project.datasetMetadata?.preparationSteps || ['Imported from DimmingLab project JSON export.'],
      attribution,
      reuseNotes: project.datasetMetadata?.reuseNotes || 'Restored from learner project file.',
      pointCount,
      timeSpanDays,
    },
    points: pts,
  };
}

/**
 * Triggers a browser download of the investigation project as JSON
 */
export function downloadProjectFile(project: InvestigationProject): void {
  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeTitle = project.datasetTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `dimminglab_evidence_${safeTitle}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
