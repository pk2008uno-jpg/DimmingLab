/**
 * DimmingLab - CSV Import Modal
 * Allows students and teachers to import custom light curves.
 * Provides live column auto-detection, row validation counts, and duplicate timestamp handling.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ColumnMapping, parseLightCurveCsv, ParseValidationResult } from './csvParser';
import { LightCurveData, DatasetManifest, TimeFormat, DatasetKind } from '../../domain/types';
import { hashLightCurvePoints } from '../../engine/hash';
import { Upload, X, AlertTriangle, CheckCircle } from 'lucide-react';

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (dataset: LightCurveData) => void;
  theme?: 'dark' | 'light';
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  theme = 'dark',
}) => {
  const [csvContent, setCsvContent] = useState('');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [validation, setValidation] = useState<ParseValidationResult | null>(null);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [timeFormat, setTimeFormat] = useState<TimeFormat | ''>('');
  const [dataKind, setDataKind] = useState<DatasetKind | ''>('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalBg = 'var(--surface)';
  const borderCol = 'var(--border)';
  const inputBg = 'var(--surface-soft)';
  const textCol = 'var(--ink)';
  const subText = 'var(--muted)';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const suggestedTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    setTitle(suggestedTitle);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const res = parseLightCurveCsv(text);
      setValidation(res);
      setCustomMapping(res.suggestedMapping);
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (field: keyof ColumnMapping, colName: string) => {
    const updated = { ...customMapping, [field]: colName || undefined };
    setCustomMapping(updated);
    if (csvContent) {
      const res = parseLightCurveCsv(csvContent, updated);
      setValidation(res);
    }
  };

  const handleConfirmImport = () => {
    if (!validation || validation.validPoints.length === 0 || validation.errors.length > 0 || !timeFormat || !dataKind) return;

    const dataHash = hashLightCurvePoints(validation.validPoints);
    const datasetId = 'custom_' + Date.now();

    const manifest: DatasetManifest = {
      id: datasetId,
      version: '1.0.0',
      title: title.trim() || 'Imported Light Curve',
      subtitle: `Imported from ${filename || 'CSV file'}`,
      kind: dataKind,
      mission: 'other',
      targetId: title.trim() || filename,
      sourceUrl: null,
      sourceProductId: filename || 'custom_upload.csv',
      retrievedAt: new Date().toISOString(),
      sourceSha256: null,
      canonicalDataSha256: dataHash,
      timeFormat,
      timeReference: `User-confirmed ${timeFormat}; timestamps in days`,
      fluxUnit: 'User-supplied flux units',
      segmentPolicy: 'Imported segments',
      qualityPolicy: 'Validated finite numeric values',
      preparationSteps: [
        `Parsed ${validation.totalParsedRows} rows from ${filename}`,
        `Retained ${validation.validPoints.length} valid points`,
        `Sorted by time ascending`,
      ],
      attribution: 'User uploaded dataset',
      reuseNotes: 'Imported student/teacher dataset',
      pointCount: validation.validPoints.length,
      timeSpanDays: validation.timeSpanDays,
    };

    const dataset: LightCurveData = {
      manifest,
      points: validation.validPoints,
    };

    onImportComplete(dataset);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        role="dialog"
        ref={dialogRef}
        data-appearance={theme}
        aria-modal="true"
        aria-labelledby="import-title"
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: modalBg,
          border: `1px solid ${borderCol}`,
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${borderCol}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} color="#0284c7" />
            <h3 id="import-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: textCol }}>
              Import Light Curve CSV
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CSV import"
            style={{ background: 'none', border: 'none', color: subText, cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label htmlFor="csv-time-format">Time convention (all numeric timestamps must be in days)
            <select id="csv-time-format" value={timeFormat} onChange={e => setTimeFormat(e.target.value as TimeFormat | '')} style={{display:'block',width:'100%',marginTop:6,padding:8}}>
              <option value="">Choose the time convention</option>
              <option value="relative_days">Relative days</option><option value="BKJD">BKJD</option>
              <option value="BTJD">BTJD</option><option value="BJD_TDB">BJD (TDB)</option>
            </select>
          </label>
          <label htmlFor="csv-data-kind">Data origin
            <select id="csv-data-kind" value={dataKind} onChange={e => setDataKind(e.target.value as DatasetKind | '')} style={{display:'block',width:'100%',marginTop:6,padding:8}}>
              <option value="">Choose the data origin</option><option value="observed">Observed measurements</option>
              <option value="synthetic">Synthetic simulation</option><option value="injection">Signal injection</option>
            </select>
          </label>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
              Select CSV File:
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: `1px dashed ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontSize: '0.875rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: subText, marginTop: '4px', display: 'block' }}>
              Supports RFC 4180 CSV files with BOM, quotes, and NASA Kepler/TESS formats.
            </span>
          </div>

          {validation && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
                  Investigation / Star Title:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. My Observation or TIC 12345678"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${borderCol}`,
                    backgroundColor: inputBg,
                    color: textCol,
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              {/* Column Mapping Section */}
              <div style={{ backgroundColor: 'var(--surface-soft)', padding: '12px', borderRadius: '6px', border: `1px solid ${borderCol}` }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.8125rem', fontWeight: 600, color: textCol }}>
                  Column Mapping:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: subText, marginBottom: '4px' }}>
                      Time Column (Mandatory):
                    </label>
                    <select
                      value={customMapping.timeCol || ''}
                      onChange={(e) => handleMappingChange('timeCol', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: modalBg, color: textCol, fontSize: '0.8125rem' }}
                    >
                      {validation.detectedColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: subText, marginBottom: '4px' }}>
                      Flux Column (Mandatory):
                    </label>
                    <select
                      value={customMapping.fluxCol || ''}
                      onChange={(e) => handleMappingChange('fluxCol', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: modalBg, color: textCol, fontSize: '0.8125rem' }}
                    >
                      {validation.detectedColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: subText, marginBottom: '4px' }}>
                      Flux Error (Optional):
                    </label>
                    <select
                      value={customMapping.fluxErrCol || ''}
                      onChange={(e) => handleMappingChange('fluxErrCol', e.target.value)}
                      style={{ width: '100%', padding: '6px', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: modalBg, color: textCol, fontSize: '0.8125rem' }}
                    >
                      <option value="">(None - Equal Weights)</option>
                      {validation.detectedColumns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Validation Summary */}
              <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: validation.errors.length > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${validation.errors.length > 0 ? '#f87171' : '#86efac'}` }}>
                {validation.errors.length > 0 ? (
                  <div style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} /> Validation Failed:
                    </div>
                    {validation.errors.map((err, i) => (
                      <div key={i}>&bull; {err}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#166534', fontSize: '0.8125rem' }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={14} /> Validated Light Curve Data
                    </div>
                    <div>
                      {validation.validPoints.length} valid rows accepted ({validation.timeSpanDays.toFixed(2)} days span).
                    </div>
                    {validation.warnings.map((warn, i) => (
                      <div key={i} style={{ color: '#854d0e', marginTop: '2px' }}>&bull; {warn}</div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: `1px solid ${borderCol}`, backgroundColor: 'var(--surface-soft)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${borderCol}`, backgroundColor: modalBg, color: textCol, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!validation || validation.validPoints.length === 0 || validation.errors.length > 0 || !timeFormat || !dataKind}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#245be6',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: (!validation || validation.validPoints.length === 0 || validation.errors.length > 0) ? 'not-allowed' : 'pointer',
              opacity: (!validation || validation.validPoints.length === 0 || validation.errors.length > 0) ? 0.5 : 1.0,
            }}
          >
            Open in Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
