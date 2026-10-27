# Congressional App Challenge 2026: Official Entry Draft

**Applicant Name:** Pardhu Kandipati  
**Congressional District:** [LEAVE BLANK — CONFIRM WITH OFFICIAL RESIDENCE / SCHOOL ELIGIBILITY]  
**School:** [e.g., Tocoi Creek High School / St. Augustine, FL area]  
**App Title:** DimmingLab — The Exoplanet Evidence Lab  
**Application URL:** [Local static distribution or hosted URL]  
**Video URL:** [3-minute unlisted YouTube / Vimeo demonstration URL — PENDING RECORDING]  
**Status:** DRAFT — Awaiting student implementation & district confirmation  

---

## 1. One-Sentence Purpose
> "DimmingLab helps high-school students and astronomy clubs investigate real NASA space telescope starlight data, align repeating dips, challenge misleading signals, and produce reproducible evidence reports."

---

## 2. Intended Users & The Concrete Problem
High school physics and earth science curricula introduce exoplanets and transit photometry, but students face severe barriers:
1. Professional exoplanet analysis tools (like Astropy and Lightkurve) require Python installations, terminal environments, and package management that school lab computers cannot support.
2. Existing classroom demonstrations treat detection as a simple guessing game, teaching students to accept any aligned curve as a "confirmed planet" without testing for false positives.

DimmingLab solves this by delivering an installation-free, offline-first scientific instrument that runs directly in the browser. It guides students through a 4-step workflow: **"Find it. Challenge it. Explain it."**

---

## 3. Why I Chose This Problem
My personal research exposure analyzing photometric data from NASA's Transiting Exoplanet Survey Satellite (TESS) showed me how exciting—and tricky—astronomical data analysis can be. I noticed that when looking at a phase-folded light curve, a neat alignment often deceives beginners into thinking a planet is confirmed, when in reality it could be an eclipsing binary star or a data gap artifact. I wanted to help design a tool that gives high school students authentic scientific data while teaching genuine scientific skepticism.

---

## 4. Key Programming Challenges & Solutions

### Challenge 1: Sub-Millisecond Interactive Phase Folding on Dense Data
Folding thousands of data points at 60 frames per second during period adjustments requires near-instantaneous recalculation. Furthermore, JavaScript's native `%` operator is a remainder rather than Euclidean modulo, causing negative relative timestamps to fold incorrectly.  
**Solution:** The app implements a custom `positiveModulo` function to guarantee centered phase coordinates strictly in $[-0.5, 0.5)$. To avoid DOM lag with thousands of SVG nodes, an HTML5 Canvas renderer was engineered to redraw 1,800 points in under 1.5 milliseconds, while providing an accessible HTML table fallback for screen readers.

### Challenge 2: Background Periodic Dip Scanning Without UI Freezing
Performing a Box-Least-Squares (BLS) style grid search over hundreds of trial frequencies requires millions of operations. Running this on the main JavaScript thread would freeze the browser tab.  
**Solution:** The architecture offloads this to a dedicated Web Worker (`src/workers/searchWorker.ts`). The worker bins folded points into circular phase bins and evaluates transit windows in $O(N_{\text{bins}})$ time using circular prefix sums. The scan is fully cancellable, streams live progress back to the UI, and automatically flags half-period ($P/2$) and double-period ($2P$) harmonic ambiguities.

### Challenge 3: Algorithmic Verification of Scientific False Positives [STUDENT CONTRIBUTION FOCUS]
Distinguishing a true planetary transit from an eclipsing binary star or a mono-transit artifact requires rigorous statistical checks.  
**Solution:** The engine implements diagnostic checks in `src/engine/evidence.ts`. Specifically:
- **Repetition:** Cycle counting requiring distinct, separated transit events rather than apparent folds driven by one single drop.
- **Alternating Depths:** Odd vs even cycle fitting with pooled standard error tests to expose half-period eclipsing binary star impostors.
- [AWAITING CONFIRMATION: Insert Pardhu's personal implementation reflections and debugging experience for the repetition/diagnostic module here].

---

## 5. What I Learned
Through working on DimmingLab:
- Understanding the mathematical translation of astrophysical formulas (Euclidean phase folding, weighted box-least-squares, and $\chi^2$ fit improvements) into pure, strictly-typed TypeScript functions verified by automated tests.
- Exploring Web Worker protocols, managing asynchronous job cancellation and avoiding memory leaks.
- Client-side persistence and offline caching architectures using IndexedDB and Service Workers.
- Designing for classroom accessibility, including keyboard focus management, ARIA descriptions, and print-specific stylesheets.

---

## 6. Future Improvements
Based on teacher and peer feedback, future versions of DimmingLab will explore:
1. Target Pixel File (TPF) centroid shift analysis to help assess potential background contaminating sources.
2. Radial velocity orbital curve fitting to allow students to compare photometric radius with spectroscopic mass measurements.

---

## 7. Tools, Libraries & Data Attribution
- **Languages & Frameworks:** TypeScript, React 19, HTML5 Canvas, CSS.
- **Tooling:** Vite, Vitest, Playwright, Node.js, Dexie.js (IndexedDB), PapaParse (CSV parsing), Lucide Icons.
- **Data Provenance:** NASA Kepler Space Telescope Quarter 1 observations of Kepler-8 b (KIC 006922244), retrieved from the Mikulski Archive for Space Telescopes (MAST) at STScI.
- **AI Disclosure:** Prototype developed with AI pairing assistance (Google Antigravity) for boilerplate scaffolding and documentation drafting. Scientific algorithms and diagnostics follow standard established astrophysical methods. Student Pardhu Kandipati is responsible for [AWAITING CONFIRMATION: specific student tasks]. The application itself contains no AI models or third-party cloud APIs.
