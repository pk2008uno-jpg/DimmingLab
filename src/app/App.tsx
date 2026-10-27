/**
 * DimmingLab - Root Application Component
 * Manages view routing, dataset loading, offline readiness, and theme switching.
 */

import React, { useState, useEffect } from 'react';
import { LightCurveData, InvestigationProject } from '../domain/types';
import { CURATED_INVESTIGATIONS, CuratedInvestigationCard } from '../data/curatedDatasets';
import { LibraryView } from '../features/library/LibraryView';
import { WorkspaceView } from '../features/workspace/WorkspaceView';
import { EvidenceReportView } from '../features/evidence/EvidenceReportView';
import { TeacherGuideView } from '../features/teacher/TeacherGuideView';
import { CsvImportModal } from '../features/import/CsvImportModal';
import { listAllProjects, getCachedDataset, cacheDatasetLocally, loadActiveProject, saveActiveProject } from '../storage/db';
import { validateProjectJson, restoreCustomDatasetFromProject, assertDatasetMatchesProject, CURATED_DATASET_HASHES } from '../features/evidence/exportImport';
import { initOfflineSupport } from '../offline/offlineManager';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'library' | 'workspace' | 'report' | 'teacher'>('library');
  const [activeDataset, setActiveDataset] = useState<LightCurveData | null>(null);
  const [activeProject, setActiveProject] = useState<InvestigationProject | null>(null);
  const [savedProject, setSavedProject] = useState<InvestigationProject | null>(null);
  const [savedProjectsMap, setSavedProjectsMap] = useState<Record<string, InvestigationProject>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineChecking, setOfflineChecking] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return localStorage.getItem('dimminglab_theme') === 'dark' ? 'dark' : 'light';
  });
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [currentView]);

  const refreshSavedProjects = async () => {
    try {
      const projects = await listAllProjects();
      const map: Record<string, InvestigationProject> = {};
      for (const p of projects) {
        if (!map[p.datasetId]) {
          map[p.datasetId] = p;
        }
      }
      setSavedProjectsMap(map);
      if (projects.length > 0) {
        setSavedProject(projects[0]);
      } else {
        setSavedProject(null);
      }
    } catch {
      // IndexedDB fallback in non-supported environments
    }
  };

  // Initialize offline pack and check for saved investigations
  useEffect(() => {
    initOfflineSupport().then(ready => { setOfflineReady(ready); setOfflineChecking(false); }).catch(() => setOfflineChecking(false));
    refreshSavedProjects();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dimminglab_theme', next);
  };

  const handleSelectInvestigation = async (card: CuratedInvestigationCard, resumeSaved = false) => {
    setIsLoadingDataset(true);
    setLoadError(null);

    try {
      // First check local Dexie cache
      let data = await getCachedDataset(card.id);
      if (data) {
        try {
          assertDatasetMatchesProject(data, { datasetId: card.id, datasetVersion: data.manifest.version, datasetHash: CURATED_DATASET_HASHES[card.id] });
        } catch { data = undefined; }
      }

      if (!data) {
        // Fetch JSON from public/data/
        const res = await fetch(card.dataPath);
        if (!res.ok) {
          throw new Error(`Failed to load dataset file: ${res.statusText}`);
        }
        data = await res.json() as LightCurveData;
        assertDatasetMatchesProject(data, { datasetId: card.id, datasetVersion: data.manifest.version, datasetHash: CURATED_DATASET_HASHES[card.id] });
        await cacheDatasetLocally(data);
      }

      let projectToLoad: InvestigationProject | null = null;
      if (resumeSaved) {
        projectToLoad = savedProjectsMap[card.id] || (await loadActiveProject(card.id)) || null;
      }
      if (projectToLoad) assertDatasetMatchesProject(data, projectToLoad);

      setActiveDataset(data);
      setActiveProject(projectToLoad);
      setCurrentView('workspace');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleOpenProjectFile = async (jsonText: string) => {
    setIsLoadingDataset(true);
    setLoadError(null);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error('Selected file is not valid JSON.');
      }

      const result = validateProjectJson(parsed);
      if (!result.valid || !result.project) {
        throw new Error(result.error || 'Project validation failed.');
      }

      const project = result.project;
      let data: LightCurveData | undefined;

      if (project.customPoints && project.customPoints.length > 0) {
        data = restoreCustomDatasetFromProject(project);
        await cacheDatasetLocally(data);
      } else {
        data = await getCachedDataset(project.datasetId);
        if (!data) {
          const curated = CURATED_INVESTIGATIONS.find((c) => c.id === project.datasetId);
          const fetchPath = curated ? curated.dataPath : `/data/${project.datasetId}.json`;
          const res = await fetch(fetchPath);
          if (res.ok) {
            data = (await res.json()) as LightCurveData;
            await cacheDatasetLocally(data);
          }
        }
      }

      if (!data) {
        throw new Error(`Could not find or load underlying dataset '${project.datasetId}' for this project.`);
      }

      assertDatasetMatchesProject(data, project);

      await saveActiveProject(project);
      await refreshSavedProjects();

      setActiveDataset(data);
      setActiveProject(project);
      setCurrentView('workspace');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleResumeSaved = async () => {
    if (!savedProject) return;

    setIsLoadingDataset(true);
    setLoadError(null);

    try {
      let data: LightCurveData | undefined;

      if (savedProject.customPoints && savedProject.customPoints.length > 0) {
        data = restoreCustomDatasetFromProject(savedProject);
      } else {
        data = await getCachedDataset(savedProject.datasetId);
        if (!data) {
          const curated = CURATED_INVESTIGATIONS.find((c) => c.id === savedProject.datasetId);
          const fetchPath = curated ? curated.dataPath : `/data/${savedProject.datasetId}.json`;
          const res = await fetch(fetchPath);
          if (res.ok) {
            data = await res.json();
          }
        }
      }

      if (!data) {
        throw new Error('Could not find underlying dataset for saved investigation.');
      }

      assertDatasetMatchesProject(data, savedProject);

      setActiveDataset(data);
      setActiveProject(savedProject);
      setCurrentView('workspace');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingDataset(false);
    }
  };

  const handleImportComplete = (dataset: LightCurveData) => {
    setActiveDataset(dataset);
    setActiveProject(null);
    setCurrentView('workspace');
  };

  const handleOpenReport = (project: InvestigationProject) => {
    setActiveProject(project);
    setCurrentView('report');
  };

  return (
    <div className="app-shell" data-theme={theme}>
      {loadError && (
        <div className="app-error" role="alert">
          {loadError}
        </div>
      )}

      {isLoadingDataset && (
        <div className="loading-bar" role="progressbar" aria-label="Loading investigation" />
      )}

      {currentView === 'library' && (
        <LibraryView
          onSelectInvestigation={handleSelectInvestigation}
          savedProject={savedProject}
          savedProjectsMap={savedProjectsMap}
          onResumeSaved={handleResumeSaved}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenProjectFile={handleOpenProjectFile}
          onOpenTeacherGuide={() => setCurrentView('teacher')}
          offlineReady={offlineReady}
          offlineChecking={offlineChecking}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {currentView === 'workspace' && activeDataset && (
        <WorkspaceView
          dataset={activeDataset}
          initialProject={activeProject || undefined}
          onBackToLibrary={() => {
            refreshSavedProjects();
            setCurrentView('library');
          }}
          onOpenReport={handleOpenReport}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      )}

      {currentView === 'report' && activeProject && activeDataset && (
        <EvidenceReportView
          project={activeProject}
          dataset={activeDataset}
          onBackToWorkspace={() => setCurrentView('workspace')}
          theme={theme}
        />
      )}

      {currentView === 'teacher' && (
        <TeacherGuideView
          onBack={() => setCurrentView('library')}
          theme={theme}
        />
      )}

      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
        theme={theme}
      />
    </div>
  );
};
