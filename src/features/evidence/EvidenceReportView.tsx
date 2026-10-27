/**
 * DimmingLab - Evidence Report View
 * Formal scientific evidence sheet designed for digital review, print, and PDF export.
 * Exposes full data provenance, algorithm settings, diagnostic checks, and student reasoning.
 */

import React, { useState } from 'react';
import { InvestigationProject, LightCurveData } from '../../domain/types';
import { LightCurveCanvas } from '../workspace/LightCurveCanvas';
import { computeAnalysisSnapshot } from '../../engine/analysis';
import { Printer, Download, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { downloadProjectFile } from './exportImport';

export interface EvidenceReportViewProps {
  project: InvestigationProject;
  dataset: LightCurveData;
  onBackToWorkspace: () => void;
  theme?: 'dark' | 'light';
}

export const EvidenceReportView: React.FC<EvidenceReportViewProps> = ({
  project,
  dataset,
  onBackToWorkspace,
}) => {
  const [showCatalogTruth, setShowCatalogTruth] = useState(false);

  const { manifest, teaching } = dataset;
  const { settings, learnerConclusion, alternativeExplanation, nextObservation, learnerHypothesis } = project;

  // Compute single shared scientific analysis snapshot
  const analysis = computeAnalysisSnapshot(dataset.points, settings);
  const { boxFit: fit, timePlotData, phasePlotData, depthFormatted } = analysis;
  const halfPhaseWidth = (settings.durationHours / 24.0 / settings.periodDays) / 2.0;
  const evidenceCards = analysis.diagnostics.items;

  const hypothesisLabelMap: Record<string, string> = {
    candidate_planet: 'Candidate Transiting Exoplanet',
    eclipsing_binary: 'Eclipsing Binary Star System',
    noise_or_artifact: 'Transient Artifact / Mono-Transit (Gaps)',
    insufficient_evidence: 'Inconclusive / Insufficient Evidence',
  };

  return (
    <div className="evidence-report-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      <div className="report-action-bar no-print">
        <button type="button" onClick={onBackToWorkspace} className="button button-secondary"><ArrowLeft size={15} />Back to Workspace</button>
        <div><button type="button" onClick={() => downloadProjectFile(project)} className="button button-secondary"><Download size={15} />Download Project JSON</button><button type="button" onClick={() => window.print()} className="button button-primary"><Printer size={15} />Print / Save to PDF</button></div>
      </div>

      {/* Main Printable Document */}
      <div
        className="printable-sheet"
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          borderRadius: '8px',
          padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                DimmingLab — The Exoplanet Evidence Lab
              </div>
              <h1 style={{ margin: '4px 0 2px', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                Scientific Evidence Report
              </h1>
              <div style={{ fontSize: '0.875rem', color: '#475569' }}>
                Target: <strong>{manifest.title}</strong> ({manifest.targetId || 'Custom Dataset'})
              </div>
            </div>

            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
              <div>Report Date: {new Date().toLocaleDateString()}</div>
              <div>Engine Version: v{project.engineVersion}</div>
              <div>Dataset SHA-256: {manifest.canonicalDataSha256.substring(0, 12)}...</div>
            </div>
          </div>
        </div>

        {/* Section 1: Provenance & Analysis Settings */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.8125rem', textTransform: 'uppercase', color: '#475569' }}>
              Data Provenance & Source
            </h4>
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
              <div><strong>Category:</strong> {manifest.kind.toUpperCase()}</div>
              <div><strong>Mission/Source:</strong> {manifest.mission}</div>
              <div><strong>Time Format:</strong> {manifest.timeFormat} ({manifest.timeReference})</div>
              <div><strong>Total Observations:</strong> {manifest.pointCount} points ({manifest.timeSpanDays} days span)</div>
              <div><strong>Attribution:</strong> {manifest.attribution}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.8125rem', textTransform: 'uppercase', color: '#475569' }}>
              Fitted Model Parameters & Pipeline
            </h4>
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
              <div><strong>Quality Filter:</strong> {settings.qualityFilter === 'clean_only' ? 'Clean quality only' : 'All points'} ({analysis.activePoints.length}/{dataset.points.length} points analyzed)</div>
              <div><strong>Flux Normalization:</strong> {settings.normalization === 'median' ? 'Median normalized (baseline ~ 1.0)' : 'None (input flux units)'}</div>
              <div><strong>Trial Period:</strong> {settings.periodDays.toFixed(4)} days</div>
              <div><strong>Reference Epoch t₀:</strong> {settings.epochDays.toFixed(4)} days</div>
              <div><strong>Transit Duration:</strong> {settings.durationHours.toFixed(2)} hours</div>
              <div><strong>Fitted Transit Depth:</strong> {depthFormatted.isNormalized ? `${depthFormatted.relativePercentText} (${depthFormatted.relativePpmText})` : `${depthFormatted.rawDeficitText} (Relative: ${depthFormatted.relativePercentText})`}</div>
              {depthFormatted.uncertaintyText && (
                <div><strong>Depth Uncertainty (1σ):</strong> {depthFormatted.uncertaintyText} ({fit.uncertaintyModel === 'known_errors' ? 'from measurement uncertainties' : 'from empirical residual scatter'})</div>
              )}
              <div><strong>Fit Improvement (ΔWRSS):</strong> {fit.fitImprovement.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Linked Astronomical Plots */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
            Observational Evidence Plots
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <LightCurveCanvas
              title="1. Full Observation Time Series (Cyan = Predicted In-Transit Windows)"
              data={timePlotData}
              xLabel={`Time (${manifest.timeFormat})`}
              yLabel={depthFormatted.isNormalized ? "Normalized Flux" : "Raw Flux"}
              theme="light"
              height={220}
            />

            <LightCurveCanvas
              title="2. Phase-Folded Light Curve with Two-Level Box Transit Model (Amber)"
              data={phasePlotData}
              xLabel="Orbital Phase [-0.5 to 0.5]"
              yLabel={depthFormatted.isNormalized ? "Normalized Flux" : "Raw Flux"}
              boxModel={{
                centerPhase: 0.0,
                halfPhaseWidth,
                baseline: fit.outOfTransitMean,
                depth: fit.rawDepth,
              }}
              theme="light"
              height={240}
            />
          </div>
        </div>

        {/* Section 3: Diagnostic Evidence Cards */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
            Scientific Diagnostic Checks
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {evidenceCards.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor:
                        item.status === 'measured' ? '#d1fae5' :
                        item.status === 'needs_review' ? '#fee2e2' :
                        item.status === 'inconclusive' ? '#fef3c7' : '#f1f5f9',
                      color:
                        item.status === 'measured' ? '#065f46' :
                        item.status === 'needs_review' ? '#991b1b' :
                        item.status === 'inconclusive' ? '#92400e' : '#475569',
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '0.8125rem', color: '#334155' }}>
                  {item.explanation}
                </p>
                {item.limitations.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                    Limitations: {item.limitations.join(' ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Student Reasoning & Hypothesis */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
            Learner Scientific Interpretation
          </h3>
          <div style={{ backgroundColor: '#f0fdf4', padding: '14px', borderRadius: '6px', border: '1px solid #bbf7d0', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '2px' }}>
              Working Hypothesis Selected by Learner:
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#15803d' }}>
              {hypothesisLabelMap[learnerHypothesis] || learnerHypothesis}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
            <div>
              <strong>Evidence Summary & Reasoning:</strong>
              <p style={{ margin: '2px 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {learnerConclusion || '(No conclusion entered by student)'}
              </p>
            </div>

            <div>
              <strong>Alternative Explanation Addressed:</strong>
              <p style={{ margin: '2px 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {alternativeExplanation || '(No alternative explanation entered)'}
              </p>
            </div>

            <div>
              <strong>Proposed Next Observation / Test:</strong>
              <p style={{ margin: '2px 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {nextObservation || '(No next observation proposed)'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 5: Intentional Catalog Truth Reveal */}
        {teaching?.teacherAnswerReveal && (
          <div className="no-print" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '16px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                  NASA Archive / Teacher Answer Key
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                  (Intentional reveal for classroom discussion)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogTruth(!showCatalogTruth)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                {showCatalogTruth ? <EyeOff size={14} /> : <Eye size={14} />}
                {showCatalogTruth ? 'Hide Answer Key' : 'Reveal Answer Key'}
              </button>
            </div>

            {showCatalogTruth && (
              <div style={{ marginTop: '10px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                <div><strong>Catalog Status:</strong> {teaching.teacherAnswerReveal.catalogIdentifier || manifest.targetId}</div>
                <div><strong>True Nature:</strong> {teaching.teacherAnswerReveal.trueNature}</div>
                <div><strong>Evaluation:</strong> {teaching.teacherAnswerReveal.evidenceEvaluation}</div>
                <div><strong>Context:</strong> {teaching.teacherAnswerReveal.astronomicalContext}</div>
              </div>
            )}
          </div>
        )}

        {/* Document Footer */}
        <div style={{ marginTop: '30px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
          DimmingLab — The Exoplanet Evidence Lab &bull; {manifest.kind === 'observed' ? 'Observed measurements' : manifest.kind === 'injection' ? 'Injection experiment' : 'Synthetic simulation'} &bull; Reproducible settings and dataset identity
        </div>
      </div>
    </div>
  );
};
