/**
 * DimmingLab - Conclusion & Hypothesis Composer
 * Facilitates scientific interpretation and reasoning, separating observations
 * from qualified student conclusions.
 */

import React from 'react';
import { LearnerHypothesis } from '../../domain/types';
import { FileText, Download } from 'lucide-react';

export interface ConclusionComposerProps {
  hypothesis: LearnerHypothesis;
  onHypothesisChange: (h: LearnerHypothesis) => void;
  conclusion: string;
  onConclusionChange: (c: string) => void;
  alternativeExplanation: string;
  onAlternativeChange: (a: string) => void;
  nextObservation: string;
  onNextObservationChange: (n: string) => void;
  onOpenReport: () => void;
  onDownloadProject: () => void;
  theme?: 'dark' | 'light';
}

export const ConclusionComposer: React.FC<ConclusionComposerProps> = ({
  hypothesis,
  onHypothesisChange,
  conclusion,
  onConclusionChange,
  alternativeExplanation,
  onAlternativeChange,
  nextObservation,
  onNextObservationChange,
  onOpenReport,
  onDownloadProject,
  theme = 'dark',
}) => {
  const cardBg = 'var(--surface)';
  const borderCol = 'var(--border)';
  const inputBg = 'var(--surface-soft)';
  const textCol = 'var(--ink)';
  const subText = 'var(--muted)';

  return (
    <div
      className="conclusion-composer-card"
      data-appearance={theme}
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${borderCol}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
      }}
    >
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: textCol }}>
          Make your case
        </h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: subText }}>
          Use the checks above to write a careful claim, consider an alternative, and plan the next observation.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Hypothesis Selector */}
        <div>
          <label htmlFor="select-hypothesis" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
            Working Hypothesis:
          </label>
          <select
            id="select-hypothesis"
            value={hypothesis}
            onChange={(e) => onHypothesisChange(e.target.value as LearnerHypothesis)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: `1px solid ${borderCol}`,
              backgroundColor: inputBg,
              color: textCol,
              fontSize: '0.875rem',
            }}
          >
            <option value="candidate_planet">Candidate Transiting Exoplanet (Signal is periodic, consistent depths, no secondary)</option>
            <option value="eclipsing_binary">Eclipsing Binary Star System (Alternating depths or secondary eclipse detected)</option>
            <option value="noise_or_artifact">Transient Artifact / Mono-Transit (Gaps hide missing events, inadequate repetition)</option>
            <option value="insufficient_evidence">Inconclusive / Insufficient Evidence to Classify</option>
          </select>
        </div>

        {/* Conclusion TextArea */}
        <div>
          <label htmlFor="input-conclusion" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
            Evidence Summary & Reasoning:
          </label>
          <textarea
            id="input-conclusion"
            rows={3}
            value={conclusion}
            onChange={(e) => onConclusionChange(e.target.value)}
            placeholder="Explain why you chose this hypothesis. Cite observed event counts, transit depth, and whether odd/even cycles match..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: '6px',
              border: `1px solid ${borderCol}`,
              backgroundColor: inputBg,
              color: textCol,
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Alternative Explanation */}
        <div>
          <label htmlFor="input-alternative" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
            Alternative Explanation to Challenge This:
          </label>
          <textarea
            id="input-alternative"
            rows={2}
            value={alternativeExplanation}
            onChange={(e) => onAlternativeChange(e.target.value)}
            placeholder="What else could mimic this signal? (e.g. background blended binary, instrument systematic, or starspot modulation?)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: '6px',
              border: `1px solid ${borderCol}`,
              backgroundColor: inputBg,
              color: textCol,
              fontSize: '0.875rem',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Proposed Next Observation */}
        <div>
          <label htmlFor="input-next-obs" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: textCol, marginBottom: '6px' }}>
            Proposed Next Scientific Test:
          </label>
          <input
            id="input-next-obs"
            type="text"
            value={nextObservation}
            onChange={(e) => onNextObservationChange(e.target.value)}
            placeholder="e.g. High-resolution radial velocity spectroscopy to measure companion mass, or speckle imaging to check for blend."
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

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onOpenReport}
            style={{
              flex: 1,
              minWidth: '200px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#245be6',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <FileText size={16} />
            Generate Evidence Report (Print/PDF)
          </button>

          <button
            type="button"
            onClick={onDownloadProject}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: `1px solid ${borderCol}`,
              backgroundColor: inputBg,
              color: textCol,
              cursor: 'pointer',
            }}
          >
            <Download size={16} />
            Download Project (.json)
          </button>
        </div>
      </div>
    </div>
  );
};
