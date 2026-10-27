import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, Printer } from 'lucide-react';
import { LabBrand } from '../../components/LabBrand';
import { CURATED_INVESTIGATIONS } from '../../data/curatedDatasets';
import { clearAllLocalData } from '../../storage/db';

export interface TeacherGuideViewProps {
  onBack: () => void;
  theme?: 'dark' | 'light';
}

const CASE_NOTES: Record<string, { title: string; observation: string; interpretation: string; question: string }> = {
  case_a_kepler8b: {
    title: 'Kepler-8 b',
    observation: 'Try a period near 3.52 days. The dips line up in the folded view; return to the time plot to check that they come from separate events.',
    interpretation: 'This is observed Kepler data from a known planet. Students can recover its repeating signal here. The planet classification comes from research beyond this classroom light curve.',
    question: 'What evidence in this dataset supports repetition? What would you still need to check for an unknown object?',
  },
  case_b_eclipsing_binary: {
    title: 'The convincing impostor',
    observation: 'At 2.10 days, deep and shallow eclipses fall on top of one another. Compare odd and even events, then try 4.20 days to separate the two eclipses.',
    interpretation: 'The simulation contains an eclipsing binary with a 4.20-day orbit. Unequal alternating depths are the clue that the shorter trial period combines two different events.',
    question: 'Why can a tidy folded dip give you the wrong orbital period?',
  },
  case_c_single_dropout: {
    title: 'The gap trap',
    observation: 'Begin at 3.75 days, then try 5 days. Both can put the single dip at the centre of the folded plot. Count distinct events in the original time sequence and inspect the gaps.',
    interpretation: 'Only one dip was inserted into this simulation. Folding it at a trial period does not create additional observations. Unsampled windows and observed windows with no dip need different explanations.',
    question: 'Where would the next dip fall, and did the telescope actually collect data there?',
  },
  case_d_injection: {
    title: 'Noise and recovery',
    observation: 'Compare the raw plot with a fold near 4.12 days. Check the separate event windows as well as the combined dip.',
    interpretation: 'The simulation contains a 1,500 ppm signal, or 0.15%, added to noisy data. Aligning repeated events makes the pattern easier to see; averaging independent measurements can reduce random noise.',
    question: 'What changes when you combine several events? What information do you lose by looking only at the fold?',
  },
};

const LESSON_STEPS = [
  {
    time: '0–3 min',
    title: 'Read the light curve',
    text: 'Open Kepler-8 b. Ask students what each axis measures and have them point out two dips in the original time plot. Leave the settings alone at first.',
  },
  {
    time: '3–7 min',
    title: 'Try a period',
    text: 'Change the trial period and watch the folded plot. If a pair gets stuck, suggest a value near 3.52 days. Ask them to explain why the dips line up.',
  },
  {
    time: '7–12 min',
    title: 'Check the evidence',
    text: 'Open the repetition, alternating-depth and observation-coverage checks. Have each pair choose one measurement that supports their explanation and one limitation they still need to consider.',
  },
  {
    time: '12–15 min',
    title: 'Write a conclusion',
    text: 'Ask for two or three sentences: what they found, which measurement supports it, and what remains uncertain. Generate an evidence report so they can compare answers.',
  },
];

export const TeacherGuideView: React.FC<TeacherGuideViewProps> = ({ onBack }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{ error: boolean; message: string } | null>(null);

  const handleDeleteAll = async () => {
    if (!window.confirm('Clear all saved investigations, cached datasets and offline files from this browser? Download any work you want to keep first.')) return;
    setIsDeleting(true);
    setDeleteStatus(null);
    try {
      await clearAllLocalData();
      setDeleteStatus({ error: false, message: 'Saved investigations and offline files have been cleared.' });
    } catch {
      setDeleteStatus({ error: true, message: 'Some data could not be cleared. Please try again.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="teacher-page" aria-labelledby="teacher-title">
      <div className="guide-masthead no-print">
        <div className="guide-masthead-brand"><LabBrand /><span>For teachers</span></div>
        <button type="button" className="text-button" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" />Back to library
        </button>
      </div>

      <header className="guide-header">
        <div>
          <p className="guide-kicker">Classroom notes</p>
          <h1 id="teacher-title">Teacher’s guide</h1>
          <p className="guide-intro">Start with Kepler-8 b. Give students a few minutes with the light curve before opening the case notes below.</p>
          <ul className="guide-meta" aria-label="Lesson details">
            <li>Grades 9–12</li><li>About 15 minutes</li><li>Work in pairs</li>
          </ul>
        </div>
        <button type="button" className="button button-secondary guide-print no-print" onClick={() => window.print()}>
          <Printer size={15} aria-hidden="true" />Print guide
        </button>
      </header>

      <div className="guide-layout">
        <div className="guide-content">
          <section className="guide-section guide-lesson" id="guide-lesson" aria-labelledby="guide-lesson-title">
            <h2 id="guide-lesson-title">A 15-minute lesson</h2>
            <p className="guide-section-intro">The aim is for students to find a repeating dip and explain how far the evidence takes them.</p>
            <ol className="guide-lesson-steps">
              {LESSON_STEPS.map(step => (
                <li key={step.time}>
                  <span className="guide-time">{step.time}</span>
                  <div><h3>{step.title}</h3><p>{step.text}</p></div>
                </li>
              ))}
            </ol>
            <div className="guide-exit-question">
              <h3>Before they leave</h3>
              <p>“You found a dip that repeats. What would make you change your explanation?”</p>
            </div>
          </section>

          <section className="guide-section" id="guide-cases" aria-labelledby="guide-cases-title">
            <h2 id="guide-cases-title">Case notes</h2>
            <p className="guide-section-intro">For discussion after students have tried a case. Open a note when you’re ready to compare explanations.</p>
            <div className="guide-cases">
              {CURATED_INVESTIGATIONS.map((card, index) => {
                const note = CASE_NOTES[card.id];
                if (!note) return null;
                return (
                  <details className="guide-case" key={card.id}>
                    <summary>
                      <span className="guide-case-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                      <span className="guide-case-heading">
                        <strong>{note.title}</strong>
                        <span>{card.kind === 'observed' ? 'Observed Kepler data' : card.kind === 'injection' ? 'Simulated signal in noise' : 'Simulation'}<span className="guide-case-target"> · {card.targetId}</span></span>
                      </span>
                      <span className="guide-case-action"><span className="guide-case-show">Show notes</span><span className="guide-case-hide">Hide notes</span><ChevronDown size={16} aria-hidden="true" /></span>
                    </summary>
                    <div className="guide-case-body">
                      <h3>What to look for</h3><p>{note.observation}</p>
                      <h3>How to read it</h3><p>{note.interpretation}</p>
                      <p className="guide-discussion"><strong>Ask the class</strong>{note.question}</p>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          <section className="guide-section" id="guide-terms" aria-labelledby="guide-terms-title">
            <h2 id="guide-terms-title">Terms students will use</h2>
            <dl className="guide-glossary">
              <div><dt>Light curve</dt><dd>A star’s measured brightness plotted against time. A dip means less light reached the telescope.</dd></div>
              <div><dt>Transit</dt><dd>A dimming event caused by a planet passing in front of its star. Other events can produce a similar-looking dip.</dd></div>
              <div><dt>Phase folding</dt><dd>Wrapping the time axis into cycles of a chosen period so events from different cycles can be compared. It does not add new observations.</dd></div>
              <div><dt>Transit depth</dt><dd>The fractional drop in brightness: (outside-dip flux − inside-dip flux) / outside-dip flux. For a dark companion crossing a uniform, unblended stellar disc, this is approximately the squared ratio of companion radius to stellar radius.</dd></div>
              <div><dt>Eclipsing binary</dt><dd>Two orbiting stars that pass in front of each other from our viewpoint. Their two eclipses may have different depths.</dd></div>
              <div><dt>Period alias</dt><dd>An apparent repeat interval that differs from the orbital period. For example, folding a binary at half its orbital period can combine its primary and secondary eclipses.</dd></div>
            </dl>
          </section>

          <section className="guide-section" id="guide-sources" aria-labelledby="guide-sources-title">
            <h2 id="guide-sources-title">Data sources and limits</h2>
            <div className="guide-source">
              <h3>Kepler-8 b: observations from NASA’s Kepler mission</h3>
              <p>Case A uses Quarter 1 long-cadence measurements from the MAST archive: KIC 006922244, file <code>kplr006922244-2009166043257_llc.fits</code>. The app uses PDCSAP_FLUX, keeps cadences with SAP_QUALITY = 0, and divides the flux by its positive median.</p>
              <a href="https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:KEPLER/url/missions/kepler/lightcurves/0069/006922244/kplr006922244-2009166043257_llc.fits" target="_blank" rel="noreferrer">Original Kepler FITS file at MAST ↗<span className="guide-sr-only"> (opens in a new tab)</span></a>
            </div>
            <div className="guide-source">
              <h3>The other three cases are simulations</h3>
              <p>Cases B–D were generated for teaching with fixed random seeds. Their signals, noise and observation gaps are controlled examples. The preparation code is included in <code>scripts/prepare_datasets.py</code>.</p>
            </div>
            <div className="guide-science-note">
              <h3>Keep the conclusion within the evidence</h3>
              <p>A repeating dip supports a periodic dimming signal. Its cause may still be a planet, an eclipsing binary or a blended source. Classifying an unknown companion can require further observations, such as radial-velocity measurements or higher-resolution imaging.</p>
            </div>
          </section>
        </div>

        <aside className="guide-sidebar" aria-label="Lesson preparation">
          <div className="guide-sidebar-inner">
            <h2>Before class</h2>
            <p>One device per pair is enough. Open Kepler-8 b and check that both plots load.</p>
            <p>Planning to work offline? Open the app while connected and wait for the offline classroom pack to finish downloading.</p>
            <nav className="guide-contents no-print" aria-label="On this page">
              <h2>On this page</h2>
              <a href="#guide-lesson">Lesson plan</a>
              <a href="#guide-cases">Case notes</a>
              <a href="#guide-terms">Key terms</a>
              <a href="#guide-sources">Sources and limits</a>
            </nav>
            <div className="guide-extension">
              <h2>Have more time?</h2>
              <p>Give pairs the impostor case next. Ask them to explain what changed when they doubled the period.</p>
            </div>
          </div>
        </aside>
      </div>

      <footer className="guide-data-footer no-print">
        <div>
          <h2>Clear this browser for the next class</h2>
          <p>Download any project files you want to keep first. Clearing removes saved investigations, cached datasets and offline files.</p>
          {deleteStatus && <p className={deleteStatus.error ? 'guide-delete-error' : 'guide-delete-success'} role={deleteStatus.error ? 'alert' : 'status'}>{deleteStatus.message}</p>}
        </div>
        <button type="button" className="guide-clear-button" disabled={isDeleting} onClick={handleDeleteAll}>{isDeleting ? 'Clearing…' : 'Clear saved data'}</button>
      </footer>
    </main>
  );
};
