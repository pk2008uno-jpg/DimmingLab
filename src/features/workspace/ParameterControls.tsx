/**
 * DimmingLab - Parameter Controls Component
 * Provides responsive, accessible controls for Period, Epoch (t0), Duration,
 * Normalization, and launches the cancellable Web Worker BLS search.
 */

import React, { useState } from 'react';
import { InvestigationSettings, SearchCandidate, SearchProgress } from '../../domain/types';
import { RotateCcw, Search, X, Check, Loader2 } from 'lucide-react';

export interface ParameterControlsProps {
  settings: InvestigationSettings;
  onSettingsChange: (newSettings: InvestigationSettings) => void;
  defaultSettings: InvestigationSettings;
  onStartSearch: (onProgress: (p: SearchProgress) => void) => Promise<SearchCandidate[]>;
  onCancelSearch: () => void;
  isSearching: boolean;
  searchProgress?: SearchProgress;
  searchCandidates: SearchCandidate[];
  onApplyCandidate: (candidate: SearchCandidate) => void;
  theme?: 'dark' | 'light';
}

export const ParameterControls: React.FC<ParameterControlsProps> = ({
  settings,
  onSettingsChange,
  defaultSettings,
  onStartSearch,
  onCancelSearch,
  isSearching,
  searchProgress,
  searchCandidates,
  onApplyCandidate,
  theme = 'dark',
}) => {
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!showSearchModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchModal]);

  const isDark = theme === 'dark';
  const cardBg = 'var(--surface)';
  const borderCol = 'var(--border)';
  const inputBg = 'var(--surface-soft)';
  const textCol = 'var(--ink)';
  const subText = 'var(--muted)';

  const updateField = <K extends keyof InvestigationSettings>(
    field: K,
    value: InvestigationSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [field]: value,
    });
  };

  const handleLaunchSearch = async () => {
    setSearchError(null);
    setShowSearchModal(true);
    try {
      await onStartSearch(() => {});
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        // User cancelled, quiet
      } else {
        setSearchError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  return (
    <div
      className="parameter-controls-card"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${borderCol}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: textCol }}>
            Set your trial model
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: subText }}>
            Change the period, epoch, and duration. The plots and evidence update together.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onSettingsChange({ ...defaultSettings })}
            title="Reset parameters to initial values"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              fontSize: '0.8125rem',
              borderRadius: '6px',
              border: `1px solid ${borderCol}`,
              backgroundColor: inputBg,
              color: textCol,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button
            type="button"
            onClick={handleLaunchSearch}
            disabled={isSearching}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#245be6',
              color: '#ffffff',
              cursor: isSearching ? 'not-allowed' : 'pointer',
            }}
          >
            {isSearching ? <Loader2 size={14} className="spin-animate" /> : <Search size={14} />}
            {isSearching ? 'Scanning...' : 'Search for Repeating Dips'}
          </button>
        </div>
      </div>

      <div className="parameter-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
        {/* Period Control */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="input-period" style={{ fontSize: '0.8125rem', fontWeight: 600, color: textCol }}>
            Trial Period (days):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <input
              id="input-period"
              type="number"
              step="0.001"
              min="0.1"
              max="100.0"
              value={settings.periodDays}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) updateField('periodDays', val);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => updateField('periodDays', +(settings.periodDays - 0.001).toFixed(4))}
                title="Subtract 0.001 days"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                -0.001
              </button>
              <button
                type="button"
                onClick={() => updateField('periodDays', +(settings.periodDays + 0.001).toFixed(4))}
                title="Add 0.001 days"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                +0.001
              </button>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: subText }}>
            Frequency: {(1.0 / settings.periodDays).toFixed(4)} cycles/day
          </span>
        </div>

        {/* Epoch t0 Control */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="input-epoch" style={{ fontSize: '0.8125rem', fontWeight: 600, color: textCol }}>
            Reference Epoch t₀ (days):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <input
              id="input-epoch"
              type="number"
              step="0.01"
              value={settings.epochDays}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val)) updateField('epochDays', val);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => updateField('epochDays', +(settings.epochDays - 0.05).toFixed(3))}
                title="Shift earlier by 0.05 days"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                -0.05
              </button>
              <button
                type="button"
                onClick={() => updateField('epochDays', +(settings.epochDays + 0.05).toFixed(3))}
                title="Shift later by 0.05 days"
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                +0.05
              </button>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: subText }}>
            Aligns transit center to phase = 0.0
          </span>
        </div>

        {/* Duration Control */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="input-duration" style={{ fontSize: '0.8125rem', fontWeight: 600, color: textCol }}>
            Transit Duration (hours):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <input
              id="input-duration"
              type="number"
              step="0.1"
              min="0.2"
              max="24.0"
              value={settings.durationHours}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) updateField('durationHours', val);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
            <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => updateField('durationHours', Math.max(0.2, +(settings.durationHours - 0.2).toFixed(2)))}
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                -0.2h
              </button>
              <button
                type="button"
                onClick={() => updateField('durationHours', +(settings.durationHours + 0.2).toFixed(2))}
                style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: `1px solid ${borderCol}`, backgroundColor: inputBg, color: textCol, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                +0.2h
              </button>
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: subText }}>
            Phase width: {((settings.durationHours / 24.0) / settings.periodDays).toFixed(4)}
          </span>
        </div>

        {/* Normalization & Quality Policy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: textCol }}>
            Data Normalization & Filter:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={settings.normalization}
              aria-label="Flux Normalization"
              onChange={(e) => updateField('normalization', e.target.value as 'median' | 'none')}
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontSize: '0.8125rem',
              }}
            >
              <option value="median">Normalized (Median = 1.0)</option>
              <option value="none">Raw Photometry</option>
            </select>

            <select
              value={settings.qualityFilter}
              aria-label="Quality Flag Filter"
              onChange={(e) => updateField('qualityFilter', e.target.value as 'all' | 'clean_only')}
              style={{
                flex: 1,
                minWidth: '130px',
                padding: '6px 8px',
                borderRadius: '6px',
                border: `1px solid ${borderCol}`,
                backgroundColor: inputBg,
                color: textCol,
                fontSize: '0.8125rem',
              }}
            >
              <option value="all">All Quality Flags</option>
              <option value="clean_only">Clean Data Only (Flag = 0)</option>
            </select>
          </div>
          <span style={{ fontSize: '0.75rem', color: subText }}>
            Original measurements are preserved
          </span>
        </div>
      </div>

      {/* Search Candidates Modal / Drawer */}
      {showSearchModal && (
        <div
          role="region"
          aria-labelledby="search-modal-title"
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '6px',
            backgroundColor: 'var(--surface-soft)',
            border: `1px solid ${borderCol}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 id="search-modal-title" style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: textCol }}>
              Repeating-dip search results
            </h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isSearching && (
                <button
                  type="button"
                  onClick={onCancelSearch}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #ef4444',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel Scan
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                aria-label="Close search results"
                style={{
                  background: 'none',
                  border: 'none',
                  color: subText,
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {isSearching && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: subText, marginBottom: '4px' }}>
                <span>Scanning frequency grid across time baseline...</span>
                <span>{searchProgress?.progressPercent ?? 0}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${searchProgress?.progressPercent ?? 0}%`,
                    height: '100%',
                    backgroundColor: '#245be6',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              {searchProgress?.bestCandidateSoFar && (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: isDark ? '#38bdf8' : '#245be6' }}>
                  Best candidate peak so far: P = {searchProgress.bestCandidateSoFar.periodDays.toFixed(4)} days (depth: {searchProgress.bestCandidateSoFar.depthPpm} ppm)
                </p>
              )}
            </div>
          )}

          {searchError && (
            <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #f87171', borderRadius: '4px', color: '#b91c1c', fontSize: '0.8125rem', marginBottom: '10px' }}>
              {searchError}
            </div>
          )}

          {!isSearching && searchCandidates.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', color: subText }}>
                Detected candidate peaks ranked by fit improvement:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchCandidates.map((cand, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface)',
                      border: `1px solid ${borderCol}`,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9375rem', color: textCol }}>
                          P = {cand.periodDays.toFixed(4)} days
                        </span>
                        {cand.isHarmonic === 'half_period' && (
                          <span style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                            P/2 Harmonic (Check Binary!)
                          </span>
                        )}
                        {cand.isHarmonic === 'double_period' && (
                          <span style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>
                            2P Harmonic
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: subText, marginTop: '2px' }}>
                        Depth: {cand.depthPpm} ppm ({(cand.depthPpm / 10000).toFixed(2)}%) | Epoch: {cand.epochDays.toFixed(3)} | Fit Score: {cand.score}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onApplyCandidate(cand);
                        setShowSearchModal(false);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: '1px solid #0284c7',
                        backgroundColor: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe',
                        color: isDark ? '#38bdf8' : '#0369a1',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={14} />
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
