/**
 * DimmingLab - Curated Investigations Catalog
 * Defines the core investigation cards for the library with metadata,
 * activity length, skills practiced, and JSON resource paths.
 */

export interface CuratedInvestigationCard {
  id: string;
  title: string;
  subtitle: string;
  kind: 'observed' | 'synthetic' | 'injection';
  mission: 'Kepler' | 'simulation';
  targetId: string;
  dataPath: string;
  skillPracticed: string;
  approximateMinutes: number;
  description: string;
  learningGoal: string;
}

export const CURATED_INVESTIGATIONS: CuratedInvestigationCard[] = [
  {
    id: 'case_a_kepler8b',
    title: 'Kepler-8 b: The Repeating Transit',
    subtitle: 'Observed NASA Kepler Space Telescope data',
    kind: 'observed',
    mission: 'Kepler',
    targetId: 'KIC 006922244',
    dataPath: '/data/case_a_kepler8b.json',
    skillPracticed: 'Phase folding & repetition verification',
    approximateMinutes: 10,
    description: 'Investigate 33 days of real space telescope observations. Find the repeating signal, align scattered dips, and examine whether the evidence supports a planet.',
    learningGoal: 'Find and measure a real periodic exoplanet signal using space telescope data.',
  },
  {
    id: 'case_b_eclipsing_binary',
    title: 'The Convincing Impostor',
    subtitle: 'Controlled synthetic stellar simulation',
    kind: 'synthetic',
    mission: 'simulation',
    targetId: 'SIM-EB-1042',
    dataPath: '/data/case_b_eclipsing_binary.json',
    skillPracticed: 'Alternating depth diagnostic & harmonic resolution',
    approximateMinutes: 12,
    description: 'A periodic signal looks convincing at first glance! Test whether all dips are truly identical or whether a hidden alternating pattern challenges the exoplanet hypothesis.',
    learningGoal: 'Investigate periodic dimming and distinguish true planetary transits from stellar impostors.',
  },
  {
    id: 'case_c_single_dropout',
    title: 'One Dip, Many Illusions: The Gap Trap',
    subtitle: 'Synthetic simulation with irregular observation gaps',
    kind: 'synthetic',
    mission: 'simulation',
    targetId: 'SIM-MONO-2099',
    dataPath: '/data/case_c_single_dropout.json',
    skillPracticed: 'Sampling gap analysis & time-series verification',
    approximateMinutes: 10,
    description: 'When spacecraft downlinks leave gaps in data, a single random dip can appear to align on multiple fake periods. Learn why folding alone is never enough.',
    learningGoal: 'Recognize the illusion of phase folding when only a single event was actually observed.',
  },
  {
    id: 'case_d_injection',
    title: 'Noise & Recovery: Signal-to-Noise Challenge',
    subtitle: 'Controlled synthetic transit injection in noise',
    kind: 'injection',
    mission: 'simulation',
    targetId: 'SIM-INJ-4120',
    dataPath: '/data/case_d_injection.json',
    skillPracticed: 'Phase folding signal-to-noise amplification',
    approximateMinutes: 10,
    description: 'A shallow 1,500 ppm transit is completely invisible to the eye in raw data. Watch how phase folding stacks multiple transits to pull the signal out of the noise.',
    learningGoal: 'Understand how multi-transit phase folding amplifies weak signals above random noise.',
  },
];
