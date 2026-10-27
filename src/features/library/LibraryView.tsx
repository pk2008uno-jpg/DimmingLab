import React, { useRef, useState } from 'react';
import { CURATED_INVESTIGATIONS, CuratedInvestigationCard } from '../../data/curatedDatasets';
import { InvestigationProject } from '../../domain/types';
import { ArrowUpRight, ArrowRight, Upload, BookOpen, Clock, CheckCircle2, Wifi, WifiOff, FolderOpen, LayoutGrid, ChevronRight, Sun, Moon, Telescope, FlaskConical } from 'lucide-react';
import { LabBrand } from '../../components/LabBrand';
import { SignalPreview } from './SignalPreview';

export interface LibraryViewProps {
  onSelectInvestigation: (card: CuratedInvestigationCard, resumeSaved?: boolean) => void;
  savedProject: InvestigationProject | null;
  savedProjectsMap?: Record<string, InvestigationProject>;
  onResumeSaved: () => void;
  onOpenImport: () => void;
  onOpenProjectFile: (fileContent: string) => void;
  onOpenTeacherGuide: () => void;
  offlineReady: boolean;
  offlineChecking?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme: () => void;
}

const CASE_COPY = [
  { title: 'The repeating transit', question: 'Can you find a planet in real starlight?', skill: 'Align repeating dips', category: 'Observed NASA data' },
  { title: 'The convincing impostor', question: 'Compare eclipse depths to test a binary-star explanation.', skill: 'Compare alternating depths', category: 'Synthetic simulation' },
  { title: 'One dip, many illusions', question: 'Check how gaps can make a single dip look periodic.', skill: 'Test gaps & repetition', category: 'Synthetic simulation' },
  { title: 'Hidden in the noise', question: 'Recover a shallow transit added to simulated noise.', skill: 'Recover an injected signal', category: 'Injection experiment' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({ onSelectInvestigation, savedProject, savedProjectsMap = {}, onResumeSaved, onOpenImport, onOpenProjectFile, onOpenTeacherGuide, offlineReady, offlineChecking = false, theme = 'light', onToggleTheme }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<'all' | 'observed' | 'controls'>('all');
  const first = CURATED_INVESTIGATIONS[0];
  const openProject = () => fileInputRef.current?.click();

  return (
    <div className="library-layout">
      <a className="skip-link" href="#library-main">Skip to investigations</a>
      <aside className="library-sidebar" aria-label="Lab navigation">
        <LabBrand />
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav className="sidebar-nav">
          <button className="sidebar-link active" type="button" aria-current="page" onClick={() => { setFilter('all'); document.getElementById('investigations')?.scrollIntoView({ behavior: 'smooth' }); }}><LayoutGrid size={17} />Investigations<span className="nav-count">04</span></button>
          <button className="sidebar-link" type="button" onClick={openProject} aria-label="Open Saved Project (.json)"><FolderOpen size={17} />Open project</button>
          <button className="sidebar-link" type="button" onClick={onOpenImport} aria-label="Import Light Curve (CSV)"><Upload size={17} />Import data</button>
        </nav>
        <div className="sidebar-section-label">RESOURCES</div>
        <nav className="sidebar-nav" aria-label="Resources"><button className="sidebar-link" type="button" onClick={onOpenTeacherGuide}><BookOpen size={17} />Teacher Guide & Sources<ArrowUpRight size={13} /></button></nav>
        
        <div className="sidebar-bottom"><span className="sidebar-version">THE EXOPLANET EVIDENCE LAB</span><button className="theme-switch" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span></button></div>
      </aside>

      <div className="library-content">
        <header className="library-topbar"><span className="breadcrumb">Workspace <ChevronRight size={13} /><strong>Investigations</strong></span><span className={`offline-state ${offlineReady ? 'ready' : ''}`} role="status" title={offlineReady ? 'The complete classroom pack is cached for offline use.' : offlineChecking ? 'Checking the classroom pack.' : 'The offline pack is not ready in this session. Keep the browser online.'}>{offlineReady ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{offlineReady ? 'Offline Classroom Pack Ready' : offlineChecking ? 'Preparing offline pack…' : 'Online session'}</span></span></header>
        <main id="library-main" className="library-main">
          <section className="library-hero" aria-labelledby="library-heading">
            <div className="hero-copy"><div className="eyebrow"><span className="small-cross">+</span> EXOPLANET LIGHT-CURVE INVESTIGATIONS</div><h1 id="library-heading">Find the story<br />in the <span>starlight.</span></h1><p>Explore Kepler observations, align repeating dips, and compare the evidence for different explanations.</p><div className="hero-actions"><button type="button" className="button button-primary" onClick={() => onSelectInvestigation(first, !!savedProjectsMap[first.id])}>{savedProjectsMap[first.id] ? 'Continue Kepler-8 b' : 'Start with Kepler-8 b'}<ArrowRight size={17} /></button><button type="button" className="text-button" onClick={onOpenTeacherGuide}>How the lab works<ArrowUpRight size={15} /></button></div></div>
            <div className="hero-observatory"><div className="observatory-top"><span>FIELD NOTES / 01</span><span className="observatory-live"><span />KEPLER-8 b</span></div><div className="orbit-scene" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="star-disc" /><div className="planet-disc" /><span className="orbit-marker" /><div className="scene-coordinate coordinate-top">KIC 006922244</div><div className="scene-coordinate coordinate-bottom">TRANSIT GEOMETRY · ILLUSTRATION</div></div><div className="observatory-chart"><div className="observatory-caption"><span>ARCHIVE LIGHT CURVE</span><span>NASA / KEPLER</span></div><SignalPreview path={first.dataPath} title="Kepler-8 b" hero /></div><div className="observatory-foot">Orbit illustration above · observed measurements below</div></div>
          </section>

          {savedProject && <section className="resume-strip" aria-label="Continue your work"><span className="resume-icon"><FolderOpen size={20} /></span><div><span className="eyebrow">SAVED INVESTIGATION</span><p>{savedProject.datasetTitle}</p></div><button type="button" className="button button-secondary" onClick={onResumeSaved}>Continue Saved Investigation<ArrowRight size={16} /></button></section>}

          <section id="investigations" className="investigations-section" aria-labelledby="investigations-heading">
            <div className="section-heading"><div><div className="eyebrow">THE INVESTIGATION LIBRARY</div><h2 id="investigations-heading">Choose an investigation</h2><p>Work with Kepler observations or one of three controlled experiments.</p></div><span className="catalog-count">01 observed dataset · 03 controlled experiments</span></div>
            <div className="catalog-toolbar"><div className="filter-tabs" role="group" aria-label="Filter investigations">{([{ id: 'all', label: 'All investigations', count: 4 }, { id: 'observed', label: 'Observed data', count: 1 }, { id: 'controls', label: 'Experiments', count: 3 }] as const).map(tab => <button key={tab.id} type="button" className={filter === tab.id ? 'selected' : ''} aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</div><span className="catalog-hint"><Clock size={13} />10–12 minutes each</span></div>
            <div className="investigation-grid">{CURATED_INVESTIGATIONS.map((card, index) => {
              if ((filter === 'observed' && card.kind !== 'observed') || (filter === 'controls' && card.kind === 'observed')) return null;
              const copy = CASE_COPY[index], saved = savedProjectsMap[card.id];
              return <article className={`investigation-card case-${index}`} key={card.id}><div className="case-topline"><span className="case-index">CASE 0{index + 1}</span><span className={`data-kind ${card.kind}`}>{card.kind === 'observed' ? <Telescope size={12} /> : <FlaskConical size={12} />}{copy.category}</span></div><div className="case-visual"><SignalPreview path={card.dataPath} title={card.title} /></div><div className="case-copy"><span className="case-target">{card.targetId}</span><h3>{copy.title}</h3><p>{copy.question}</p><div className="case-skill"><span>IN THIS INVESTIGATION</span><strong>{copy.skill}</strong></div><div className="case-footer"><span><Clock size={13} />{card.approximateMinutes} min</span><button type="button" className="case-open" onClick={() => onSelectInvestigation(card, !!saved)} aria-label={saved ? `Resume Saved Investigation: ${card.title}` : `Open Investigation: ${card.title}`}>{saved ? 'Resume investigation' : 'Open investigation'}<ArrowUpRight size={17} /></button></div>{saved && <div className="saved-case-row"><span><CheckCircle2 size={12} />Saved draft</span><button type="button" onClick={() => onSelectInvestigation(card, false)}>Start fresh</button></div>}</div></article>;
            })}</div>
          </section>

          <section className="method-strip" aria-label="The investigation process"><div><span className="eyebrow">THE WORKFLOW</span><h2>From observations<br />to a conclusion.</h2></div><ol><li><span>01</span><div><strong>Find it.</strong><p>Explore the light. Align the dips.</p></div></li><li><span>02</span><div><strong>Challenge it.</strong><p>Check repetition, depths, and gaps.</p></div></li><li><span>03</span><div><strong>Explain it.</strong><p>Write a claim your evidence supports.</p></div></li></ol></section>
          <footer className="library-footer"><LabBrand /><span>Kepler data & controlled experiments</span><button type="button" className="text-button" onClick={onOpenTeacherGuide}>Data sources & scientific limits<ArrowUpRight size={13} /></button></footer>
        </main>
      </div>
      <input type="file" ref={fileInputRef} accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = event => { if (typeof event.target?.result === 'string') onOpenProjectFile(event.target.result); }; reader.readAsText(file); e.target.value = ''; } }} />
    </div>
  );
};
