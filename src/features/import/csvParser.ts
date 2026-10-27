/**
 * DimmingLab - CSV Parser and Light Curve Importer
 * Robust RFC 4180 parsing with BOM handling, column auto-detection,
 * detailed row validation, and duplicate time reporting.
 */

import Papa from 'papaparse';
import { LightCurvePoint } from '../../domain/types';

export interface ColumnMapping {
  timeCol: string;
  fluxCol: string;
  fluxErrCol?: string;
  qualityCol?: string;
  segmentCol?: string;
}

export interface ParseValidationResult {
  validPoints: LightCurvePoint[];
  rejectedRowCount: number;
  duplicateTimeCount: number;
  totalParsedRows: number;
  warnings: string[];
  errors: string[];
  detectedColumns: string[];
  suggestedMapping: ColumnMapping;
  timeSpanDays: number;
}

/**
 * Auto-detects light curve columns from headers
 */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.trim().toLowerCase());
  
  let timeCol = headers[0] || 'time';
  let fluxCol = headers[1] || 'flux';
  let fluxErrCol: string | undefined;
  let qualityCol: string | undefined;
  let segmentCol: string | undefined;

  for (let i = 0; i < lower.length; i++) {
    const col = lower[i];
    const orig = headers[i];

    if (/^(time|bjd|btjd|bkjd|date|t)$/.test(col)) {
      timeCol = orig;
    } else if (/^(pdcsap_flux|sap_flux|flux|rel_flux|brightness|f)$/.test(col)) {
      fluxCol = orig;
    } else if (/^(pdcsap_flux_err|sap_flux_err|flux_err|error|err|e)$/.test(col)) {
      fluxErrCol = orig;
    } else if (/^(quality|qual|flags|flag|q)$/.test(col)) {
      qualityCol = orig;
    } else if (/^(segment|quarter|sector|sec|qtr|s)$/.test(col)) {
      segmentCol = orig;
    }
  }

  return { timeCol, fluxCol, fluxErrCol, qualityCol, segmentCol };
}

/**
 * Parses raw CSV text into validated LightCurvePoints
 */
export function parseLightCurveCsv(
  csvText: string,
  userMapping?: Partial<ColumnMapping>
): ParseValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Remove UTF-8 BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  if (!cleanText.trim()) {
    return {
      validPoints: [],
      rejectedRowCount: 0,
      duplicateTimeCount: 0,
      totalParsedRows: 0,
      warnings: [],
      errors: ['File is empty.'],
      detectedColumns: [],
      suggestedMapping: { timeCol: '', fluxCol: '' },
      timeSpanDays: 0,
    };
  }

  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: 'greedy',
  });

  if (parsed.errors && parsed.errors.length > 0) {
    for (const err of parsed.errors.slice(0, 5)) {
      warnings.push(`CSV Row ${err.row}: ${err.message}`);
    }
  }

  const headers = parsed.meta.fields || [];
  if (headers.length < 2) {
    return {
      validPoints: [],
      rejectedRowCount: 0,
      duplicateTimeCount: 0,
      totalParsedRows: parsed.data.length,
      warnings,
      errors: ['CSV must have at least 2 columns (time and flux).'],
      detectedColumns: headers,
      suggestedMapping: { timeCol: '', fluxCol: '' },
      timeSpanDays: 0,
    };
  }

  const mapping = {
    ...guessColumnMapping(headers),
    ...userMapping,
  };

  const rows = parsed.data;
  const validPoints: LightCurvePoint[] = [];
  let rejectedCount = 0;
  const timeSeen = new Set<string>();
  let duplicateTimeCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawTime = row[mapping.timeCol];
    const rawFlux = row[mapping.fluxCol];

    if (rawTime === undefined || rawFlux === undefined) {
      rejectedCount++;
      continue;
    }

    const trimmedTime = typeof rawTime === 'string' ? rawTime.trim() : String(rawTime).trim();
    const trimmedFlux = typeof rawFlux === 'string' ? rawFlux.trim() : String(rawFlux).trim();

    // Reject empty or whitespace-only cells before calling Number() so Number("") does NOT coerce to 0.0
    if (trimmedTime === '' || trimmedFlux === '') {
      rejectedCount++;
      continue;
    }

    const time = Number(trimmedTime);
    const flux = Number(trimmedFlux);

    if (!Number.isFinite(time) || !Number.isFinite(flux)) {
      rejectedCount++;
      continue;
    }

    // Check duplicate timestamp
    const timeKey = time.toFixed(7);
    if (timeSeen.has(timeKey)) {
      duplicateTimeCount++;
    } else {
      timeSeen.add(timeKey);
    }

    let fluxErr: number | undefined;
    if (mapping.fluxErrCol && row[mapping.fluxErrCol] !== undefined) {
      const trimmedErr = String(row[mapping.fluxErrCol]).trim();
      if (trimmedErr !== '') {
        const parsedErr = Number(trimmedErr);
        if (Number.isFinite(parsedErr) && parsedErr > 0) {
          fluxErr = parsedErr;
        }
      }
    }

    let quality: number | undefined;
    if (mapping.qualityCol && row[mapping.qualityCol] !== undefined) {
      const trimmedQ = String(row[mapping.qualityCol]).trim();
      if (trimmedQ !== '') {
        const parsedQ = Number(trimmedQ);
        if (Number.isInteger(parsedQ)) {
          quality = parsedQ;
        }
      }
    }

    let segment: number | undefined;
    if (mapping.segmentCol && row[mapping.segmentCol] !== undefined) {
      const trimmedSeg = String(row[mapping.segmentCol]).trim();
      if (trimmedSeg !== '') {
        const parsedSeg = Number(trimmedSeg);
        if (Number.isInteger(parsedSeg)) {
          segment = parsedSeg;
        }
      }
    }

    validPoints.push({
      time,
      flux,
      fluxErr,
      quality,
      segment,
      originalIndex: i,
    });
  }

  if (validPoints.length === 0) {
    errors.push('No valid numeric time and flux values found.');
    return {
      validPoints: [],
      rejectedRowCount: rejectedCount,
      duplicateTimeCount,
      totalParsedRows: rows.length,
      warnings,
      errors,
      detectedColumns: headers,
      suggestedMapping: mapping,
      timeSpanDays: 0,
    };
  }

  // Stable sort by time ascending
  validPoints.sort((a, b) => a.time - b.time);

  const minTime = validPoints[0].time;
  const maxTime = validPoints[validPoints.length - 1].time;
  const timeSpanDays = maxTime - minTime;

  if (timeSpanDays <= 0) {
    errors.push('Observations must span a nonzero duration of time.');
  }

  if (duplicateTimeCount > 0) {
    warnings.push(`Dataset contains ${duplicateTimeCount} rows with duplicate timestamps.`);
  }

  if (rejectedCount > 0) {
    warnings.push(`Ignored ${rejectedCount} rows with missing or non-numeric values.`);
  }

  return {
    validPoints,
    rejectedRowCount: rejectedCount,
    duplicateTimeCount,
    totalParsedRows: rows.length,
    warnings,
    errors,
    detectedColumns: headers,
    suggestedMapping: mapping,
    timeSpanDays,
  };
}
