# DimmingLab visual redesign — research and implementation

Release 1.0.2 · 26 October 2026 · scientific engine 1.1.0

The implemented direction is an observatory notebook: a quiet application frame, a purposeful scientific illustration, and plots with enough space to inspect. This document records the sources used for guidance and the specific design decisions made for DimmingLab. The interpretation and implementation are ours; these references do not endorse this app.

## References and what was adapted

| Reference | Relevant guidance | DimmingLab implementation |
| --- | --- | --- |
| [Linear — How we redesigned the Linear UI, part II](https://linear.app/now/how-we-redesigned-the-linear-ui) | Linear describes reducing noise in sidebars, tabs, headers and panels; aligning navigation; using a coherent theme system; and testing hierarchy across views. Its published interface image was also reviewed. | A compact library sidebar, a breadcrumb bar, one blue action color, consistent neutral surfaces, deliberate type hierarchy, shared light/dark tokens, and restrained dividers instead of nested colored cards. |
| [Observable Plot](https://observablehq.github.io/plot/) | Its documentation organizes charts around readable marks, scales, transforms and small multiples for comparison. | Each investigation has a small light-curve preview generated from its actual packaged measurements. The workspace separates the original time sequence from the phase-folded view, labels axes, and supplies a simple legend and accessible data table. The existing Canvas renderer is retained; Observable is a design reference, not a new dependency. |
| [NASA Eyes](https://science.nasa.gov/eyes/) | The official overview presents browser-based scientific exploration through real NASA data and imagery, including exoplanet systems. | A compact observatory panel establishes the astronomical subject. The orbit is an original CSS illustration, explicitly labeled, and the light curve beneath it uses observed Kepler measurements. The investigation remains about evidence and interpretation. |

## Library

The opening screen now answers three questions: what the learner will do, where to begin, and what other investigations teach. The main action starts or resumes Kepler-8 b. The four case cards distinguish observed data, simulations and an injection experiment in words, not color alone. Filters work for observed data and controlled experiments. Each card includes a real data preview, a target identifier, a skill and an estimated activity duration. A saved project has its own continuation strip.

The previous competition badge and repeated decorative status pills were removed from the introductory screen. A small offline status reports readiness only after verification; a session that cannot prepare the pack is labeled online rather than remaining in an indefinite loading state.

## Workspace and report

The workspace uses a broad analysis column and a narrower evidence column. Current period, relative depth, predicted windows with data and detected dimming counts are distinct quantities. Controls appear before the plots. The observation sequence and phase plot have their own sections, explanations and legends.

The evidence checklist exposes each diagnostic's status immediately. Opening a check reveals its explanation, measurements and limitations. All original evidence items and learner fields remain available. The report actions use the same visual language while the report itself stays a white printable document.

The plotted box overlay now uses the raw fitted deficit in the same units as the displayed points, including when normalization is disabled. Imported observed measurements are not labeled NASA data. These are display corrections; the numerical analysis engine is unchanged.

## Responsive and accessible behavior

The library sidebar becomes a compact navigation bar on smaller screens. The hero stacks on phones, cards use one column, and workspace controls stack inside their panel. The evidence report also fits the phone viewport. Keyboard focus remains visible, filter state is exposed with aria-pressed, and diagnostic disclosures have associated panels. The CSV dialog moves focus inside, traps Tab and Shift+Tab, closes on Escape and restores focus to its trigger. Reduced-motion preferences are respected. Coarse-pointer controls have at least a 44px minimum height.

## Assets and continuity

No fonts, analytics, imagery, charting libraries or services were added as network dependencies. The icon, orbital illustration and theme are original code. The four curated datasets, source FITS, and all scientific engine files are byte-identical to release 1.0.1. Existing JSON imports, provenance checks, saving and search remain in place. AI assistance is recorded in AI_USE.md and CONTRIBUTIONS.md.

See RELEASE_VERIFICATION.json and logs/redesign_* for the exact verification scope. Live preview checks do not substitute for a real localhost offline reload on the final submission machine.
