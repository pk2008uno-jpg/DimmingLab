/**
 * DimmingLab - Main Investigation Workspace View
 * Hosts interactive time-series & phase-folded charts, parameter controls,
 * Web Worker periodic search, diagnostic evidence checks, and conclusion composer.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LightCurveData,
  InvestigationSettings,
  InvestigationProject,
  SearchCandidate,
  SearchProgress,
  LearnerHypothesis,
} from '../../domain/types';
import { LightCurveCanvas } from './LightCurveCanvas';
import { ParameterControls } from './ParameterControls';
import { EvidenceRail } from '../evidence/EvidenceRail';
import { ConclusionComposer } from '../evidence/ConclusionComposer';
import { SearchWorkerClient } from '../../workers/searchWorkerClient';
import { saveActiveProject } from '../../storage/db';
import { downloadProjectFile, CURRENT_APP_VERSION, CURRENT_ENGINE_VERSION } from '../evidence/exportImport';
import { computeAnalysisSnapshot } from '../../engine/analysis';
import { ArrowLeft, Save, Sun, Moon, Info, FileText, Telescope, FlaskConical } from 'lucide-react';
import { LabBrand } from '../../components/LabBrand';

export interface WorkspaceViewProps {
  dataset: LightCurveData;
  initialProject?: InvestigationProject;
  onBackToLibrary: () => void;
  onOpenReport: (project: InvestigationProject) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  dataset,
  initialProject,
  onBackToLibrary,
  onOpenReport,
  theme,
  onToggleTheme,
}) => {
  const { manifest, teaching } = dataset;

  const defaultSettings: InvestigationSettings = useMemo(() => ({
    periodDays: teaching?.suggestedPeriodDays ?? 3.5,
    epochDays: teaching?.suggestedEpochDays ?? dataset.points[0]?.time ?? 0,
    durationHours: teaching?.suggestedDurationHours ?? 3.0,
    normalization: 'median',
    qualityFilter: 'all',
  }), [teaching, dataset]);

  // Workspace state
  const [settings, setSettings] = useState<InvestigationSettings>(() => {
    return initialProject?.settings || defaultSettings;
  });

  const [hypothesis, setHypothesis] = useState<LearnerHypothesis>(() => {
    return initialProject?.learnerHypothesis || 'insufficient_evidence';
  });

  const [conclusion, setConclusion] = useState<string>(() => {
    return initialProject?.learnerConclusion || '';
  });

  const [alternativeExplanation, setAlternativeExplanation] = useState<string>(() => {
    return initialProject?.alternativeExplanation || '';
  });

  const [nextObservation, setNextObservation] = useState<string>(() => {
    return initialProject?.nextObservation || '';
  });

  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | undefined>(undefined);
  const [searchCandidates, setSearchCandidates] = useState<SearchCandidate[]>([]);
  const workerClientRef = useRef<SearchWorkerClient | null>(null);

  // Single shared scientific analysis snapshot
  const analysis = useMemo(() => {
    return computeAnalysisSnapshot(dataset.points, settings);
  }, [dataset.points, settings]);

  const { normalizedPoints, boxFit: primaryFit, diagnostics: diagnosticReport, timePlotData, phasePlotData } = analysis;

  // Current project representation
  const currentProject: InvestigationProject = useMemo(() => ({
    schemaVersion: 1,
    appVersion: CURRENT_APP_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    datasetId: manifest.id,
    datasetVersion: manifest.version,
    datasetHash: manifest.canonicalDataSha256,
    datasetTitle: manifest.title,
    datasetMetadata: {
      timeSpanDays: manifest.timeSpanDays,
      pointCount: manifest.pointCount,
      timeFormat: manifest.timeFormat,
      timeReference: manifest.timeReference,
      fluxUnit: manifest.fluxUnit,
      kind: manifest.kind,
      mission: manifest.mission,
      targetId: manifest.targetId,
      sourceUrl: manifest.sourceUrl,
      sourceProductId: manifest.sourceProductId,
      sourceSha256: manifest.sourceSha256,
      retrievedAt: manifest.retrievedAt,
      attribution: manifest.attribution,
      segmentPolicy: manifest.segmentPolicy,
      qualityPolicy: manifest.qualityPolicy,
      preparationSteps: manifest.preparationSteps,
      reuseNotes: manifest.reuseNotes,
    },
    settings,
    evidence: diagnosticReport.items,
    learnerHypothesis: hypothesis,
    learnerConclusion: conclusion,
    alternativeExplanation,
    nextObservation,
    customPoints: manifest.id.startsWith('custom_') ? dataset.points : undefined,
    createdAt: initialProject?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [manifest, settings, diagnosticReport.items, hypothesis, conclusion, alternativeExplanation, nextObservation, initialProject, dataset.points]);

  // Synchronous flush save function ensuring no lost edits on navigation
  const flushSave = async (): Promise<boolean> => {
    try {
      await saveActiveProject(currentProject);
      setSaveIndicator('saved');
      return true;
    } catch {
      setSaveIndicator('error');
      setSaveError('Local browser save failed (quota exceeded or storage disabled). Export to JSON to save your work.');
      return false;
    }
  };

  const handleBackToLibrary = async () => {
    if (await flushSave()) onBackToLibrary();
  };

  const handleOpenReport = async () => {
    if (await flushSave()) onOpenReport(currentProject);
  };

  // Auto-save to IndexedDB debounced
  useEffect(() => {
    setSaveIndicator('saving');
    setSaveError(null);
    const timer = setTimeout(async () => {
      try {
        await saveActiveProject(currentProject);
        setSaveIndicator('saved');
      } catch (err: unknown) {
        setSaveIndicator('error');
        setSaveError('Local browser save failed (quota exceeded or storage disabled). Export to JSON to save your work.');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [currentProject]);

  // Clean up Web Worker on unmount
  useEffect(() => {
    return () => {
      if (workerClientRef.current) {
        workerClientRef.current.cancelActiveSearch();
        workerClientRef.current.destroy();
        workerClientRef.current = null;
      }
    };
  }, []);

  // Cancel any running search when dataset changes
  useEffect(() => {
    if (workerClientRef.current) {
      workerClientRef.current.cancelActiveSearch();
      setSearchCandidates([]);
      setIsSearching(false);
    }
  }, [manifest.id]);

  // Search execution
  const handleStartSearch = async (): Promise<SearchCandidate[]> => {
    if (!workerClientRef.current) {
      workerClientRef.current = new SearchWorkerClient();
    }
    setIsSearching(true);
    setSearchProgress(undefined);

    const timeSpan = manifest.timeSpanDays || 30.0;
    const minP = Math.max(0.5, settings.durationHours / 24.0 * 2.5);
    const maxP = Math.min(timeSpan / 2.0, 20.0);

    try {
      const candidates = await workerClientRef.current.startSearch(
        normalizedPoints,
        {
          minPeriodDays: minP,
          maxPeriodDays: maxP,
          periodSteps: 800,
          phaseBins: 120,
          durationHours: settings.durationHours,
          topCount: 4,
        },
        {
          onProgress: (p) => setSearchProgress(p),
        }
      );
      setSearchCandidates(candidates);
      setIsSearching(false);
      return candidates;
    } catch (e) {
      setIsSearching(false);
      throw e;
    }
  };

  const handleCancelSearch = () => {
    if (workerClientRef.current) {
      workerClientRef.current.cancelActiveSearch();
      setIsSearching(false);
    }
  };

  const handleApplyCandidate = (candidate: SearchCandidate) => {
    setSettings(prev => ({
      ...prev,
      periodDays: candidate.periodDays,
      epochDays: candidate.epochDays,
    }));
  };

  const halfPhase = (settings.durationHours / 24.0 / settings.periodDays) / 2.0;

  // In-transit time windows for time series highlight
  const highlightWindows = useMemo(() => {
    const durDays = settings.durationHours / 24.0;
    return diagnosticReport.events.map((e) => ({
      start: e.centerTime - durDays / 2.0,
      end: e.centerTime + durDays / 2.0,
    }));
  }, [diagnosticReport.events, settings.durationHours]);

  const isDark = theme === 'dark';
  const timeLabel = manifest.timeFormat === 'relative_days' ? 'Relative days' : manifest.timeFormat;
  const fluxLabel = settings.normalization === 'none' ? 'Input flux' : 'Normalized flux';

  return (
    <main className="workspace-page">
      <header className="workspace-masthead">
        <div><LabBrand /><span className="masthead-divider" /><span className="breadcrumb">Investigation workspace</span></div>
        <div className="workspace-tools">
          <span className={`save-status ${saveIndicator === 'error' ? 'error' : ''}`} role="status"><Save size={12} />{saveIndicator === 'saving' ? 'Saving…' : saveIndicator === 'error' ? 'Save failed' : 'Saved to browser'}</span>
          <button type="button" onClick={handleBackToLibrary} className="button button-secondary"><ArrowLeft size={13} />Library</button>
          <button type="button" onClick={onToggleTheme} className="icon-button" title="Toggle Dark/Light theme" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>{isDark ? <Sun size={15} /> : <Moon size={15} />}</button>
        </div>
      </header>
      <div className="workspace-titlebar"><div><span className="eyebrow">OBSERVE / TEST / INTERPRET</span><h1>{manifest.title}</h1><p>{manifest.targetId || 'Custom dataset'} · {analysis.activePoints.length.toLocaleString()} observations · {timeLabel} time reference</p></div><span className={`data-kind ${manifest.kind}`}>{manifest.kind === 'observed' ? <Telescope size={13} /> : <FlaskConical size={13} />}{manifest.kind === 'observed' ? (manifest.id.startsWith('custom_') ? 'Observed data' : 'Observed NASA data') : manifest.kind === 'injection' ? 'Injection experiment' : 'Synthetic simulation'}</span></div>
      {teaching?.guidedQuestions?.length ? <div className="task-note"><Info size={16} /><span><strong>Your question:</strong> {teaching.guidedQuestions[0]}</span></div> : null}
      {saveError && <div className="save-error" role="alert"><span>{saveError}</span><button type="button" className="button button-secondary" onClick={() => downloadProjectFile(currentProject)}>Export Project to JSON</button></div>}
      <dl className="analysis-summary" aria-label="Current analysis summary">
        <div><dt>TRIAL PERIOD</dt><dd>{settings.periodDays.toFixed(4)} <small>days</small></dd></div>
        <div><dt>RELATIVE BOX DEPTH</dt><dd>{analysis.depthFormatted.relativePercentText}</dd></div>
        <div><dt>PREDICTED WINDOWS WITH DATA</dt><dd>{diagnosticReport.coveredWindowCount} <small>/ {diagnosticReport.predictedWindowCount} predicted</small></dd></div>
        <div><dt>DETECTED DIMMING EVENTS</dt><dd>{diagnosticReport.dimmingDetectedCount} <small>at this trial period</small></dd></div>
      </dl>
      <div className="workspace-grid">
        <div className="workspace-analysis">
          <ParameterControls settings={settings} onSettingsChange={setSettings} defaultSettings={defaultSettings} onStartSearch={handleStartSearch} onCancelSearch={handleCancelSearch} isSearching={isSearching} searchProgress={searchProgress} searchCandidates={searchCandidates} onApplyCandidate={handleApplyCandidate} theme={theme} />
          <section className="analysis-panel" aria-label="Observation plots">
            <div className="panel-heading"><span className="panel-number">01</span><div><h2>Inspect the observations</h2><p>Look for dips in the original sequence of observations.</p></div></div>
            <LightCurveCanvas title="Full observation light curve" data={timePlotData} xLabel={`Time (${timeLabel})`} yLabel={fluxLabel} highlightWindows={highlightWindows} theme={theme} height={250} />
            <div className="plot-legend"><span><i className="legend-dot" />Brightness measurements</span><span><i className="legend-window" />Predicted transit windows</span></div>
          </section>
          <section className="analysis-panel" aria-label="Phase folded plot">
            <div className="panel-heading"><span className="panel-number">02</span><div><h2>Compare repeated cycles</h2><p>Fold observations at your trial period. Does the signal line up?</p></div></div>
            <LightCurveCanvas title="Phase-folded light curve" data={phasePlotData} xLabel="Orbital phase" yLabel={fluxLabel} boxModel={{ centerPhase: 0, halfPhaseWidth: halfPhase, baseline: primaryFit.outOfTransitMean, depth: primaryFit.rawDepth }} theme={theme} height={285} />
            <div className="plot-legend"><span><i className="legend-dot" />Folded measurements</span><span><i className="legend-fit" />Two-level box model</span></div>
          </section>
        </div>
        <aside className="workspace-aside" aria-label="Evidence and interpretation">
          <EvidenceRail evidence={diagnosticReport.items} theme={theme} />
          <ConclusionComposer hypothesis={hypothesis} onHypothesisChange={setHypothesis} conclusion={conclusion} onConclusionChange={setConclusion} alternativeExplanation={alternativeExplanation} onAlternativeChange={setAlternativeExplanation} nextObservation={nextObservation} onNextObservationChange={setNextObservation} onOpenReport={handleOpenReport} onDownloadProject={() => downloadProjectFile(currentProject)} theme={theme} />
        </aside>
      </div>
      <footer className="workspace-footer"><FileText size={11} /> Project exports include settings, evidence, and your conclusion.</footer>
    </main>
  );
};
