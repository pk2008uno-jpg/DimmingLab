# DimmingLab: Scope and Assumptions

## 1. Selected Scope: Competition MVP
We are building the full **Competition MVP** scope as defined in the Master Prompt (Section 5):
- Complete investigation workflow: Dataset selection -> interactive folding -> evidence challenge -> conclusion authoring -> evidence export.
- Curated Datasets:
  - **Case A (Observed):** Sourced NASA Kepler/TESS transiting exoplanet observation with full metadata and provenance (WASP-12b or Kepler-8b).
  - **Case B (Synthetic - Eclipsing Binary):** Labeled synthetic binary star simulation with alternating primary and secondary eclipse depths.
  - **Case C (Synthetic - Single Dropout):** Labeled synthetic single-event artifact with irregular observation gaps, demonstrating the illusion of folded alignment without true repetition.
  - **Case D (Synthetic - Controlled Injection):** Synthetic signal injected into noisy baseline to investigate depth and noise recovery.
- Interactive Parameter Controls: Period (with fine/coarse steps), Epoch $t_0$, Duration $q$.
- Numerical Engine: Phase folding $[-0.5, 0.5)$, median normalization, box fit model, weighted residual sum of squares improvement, odd/even depth tests, opposite-phase secondary eclipse tests, gap metrics.
- Web Worker BLS-style search with live progress reporting and cancellation.
- Evidence Challenge Rail: 5 core diagnostics with clear metric explanations and limitation warnings.
- Evidence Report: Printable DOM sheet with embedded high-resolution canvas plots, parameter tables, student conclusion, external catalog comparison, and JSON project export.
- Offline Capability: Service worker precaching app assets and dataset JSONs, with offline status badge.
- CSV Importer: Mapping modal with RFC-4180 parsing, NaN/bad row rejection, and preview.
- Local Persistence: IndexedDB storage for saving and resuming investigations.
- Teacher Guide & Sources: Curriculum guide, vocabulary glossary, and hidden answer discussion.

## 2. Technical Constraints and Environmental Assumptions
- Target OS: Windows (user workstation), modern desktop and tablet browsers (Chrome, Edge, Firefox, Safari).
- Zero Server Dependency: Client-only execution. No backend server, cloud database, or AI API required at runtime.
- Package Management: `npm.cmd` on Windows with PowerShell execution policy awareness.
- Data Provenance: All datasets must be cryptographically hashed (SHA-256) and strictly tagged as `observed`, `synthetic`, or `injection`. Simulated data must never be passed off as NASA observations.

## 3. Competition Context & Authorship Boundaries
- Congressional District: Left unconfirmed/blank in submission drafts as instructed until verified by the student.
- AI Authorship Transparency: AI is used as a development pairing assistant. The project maintains an honest `AI_USE.md` ledger and explicitly specifies student implementation and understanding tasks in `STUDENT_IMPLEMENTATION_TASKS.md`.
