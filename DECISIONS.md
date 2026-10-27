# DimmingLab: Architecture & Engineering Decisions

This document records deliberate technical decisions, justification, and alternatives considered.

---

## Decision 1: Application Stack and Toolchain
- **Decision:** React 19 + TypeScript + Vite.
- **Rationale:** Fast compile times, strict type safety, zero backend required, simple static hosting (GitHub Pages, Vercel, Firebase Hosting, or local double-click preview).
- **Alternatives Considered:** Vanilla JS (lacks maintainable state management for complex reactive investigations), Next.js (requires SSR or complex static export, unnecessary server complexity for an offline-first tool).

## Decision 2: High-Performance Canvas Plotting Engine
- **Decision:** Build a dedicated, lightweight Canvas rendering component (`LightCurveCanvas`) for the time series and phase-folded plots rather than importing heavyweight general-purpose charting libraries.
- **Rationale:** 
  1. Astronomical light curves frequently contain 5,000–30,000 points. DOM-based SVGs degrade quickly with that many nodes.
  2. Canvas provides sub-millisecond redraws during period slider manipulation (60fps interactive phase folding).
  3. Clean zero-dependency implementation guarantees offline determinism, eliminates CDN/security issues, and easily exports crisp high-res raster or vector snapshots for the print evidence sheet.
  4. Allows custom astronomical visual conventions: error bars, in-transit window highlighting, transit box model overlays, cycle-colored folds, and gap boundaries without fight against chart library abstractions.

## Decision 3: Numerical Engine Boundaries
- **Decision:** All mathematical calculations (phase folding, median normalization, weighted box fit, $\chi^2$ / SSR improvement, repetition event grouping, alternating depth checks, opposite-phase secondary searches) are pure, headless TypeScript functions in `src/engine/`.
- **Rationale:**
  1. Separation of concerns: visual components never calculate science metrics; they only render domain outputs.
  2. Testability: pure functions can be validated against independent mathematical references and golden test cases with Vitest.
  3. Worker portability: the exact same functions run on the main thread for single fits and inside a Web Worker for multi-frequency parameter searches.

## Decision 4: Web Worker for Period Search
- **Decision:** Automated repeating dip search runs inside a dedicated Web Worker (`src/workers/searchWorker.ts`).
- **Rationale:**
  1. Prevents UI thread freezing during 1,000–2,000 frequency iterations over thousands of data points.
  2. Uses circular prefix sums over binned phase for fast $O(N + N_{bins})$ box evaluations per period.
  3. Fully cancellable: slider or dropdown changes immediately terminate and restart or discard worker jobs via request UUID tracking.

## Decision 5: Local Persistence & Offline First
- **Decision:** Use Dexie (IndexedDB) for local project persistence and a custom Service Worker for asset and dataset precaching.
- **Rationale:**
  1. Privacy & Zero-Setup: High school classrooms cannot require student logins, Google accounts, or external database credentials.
  2. Reliability: Network connections in school labs and classrooms are often filtered or spotty. The app must run completely offline once loaded.
  3. Data preservation: Auto-saves active investigation state to IndexedDB with export to standard JSON files.

## Decision 6: Scientific Integrity & Explicit Evidence States
- **Decision:** Diagnostic checks output typed statuses (`measured`, `inconclusive`, `not_assessed`, `needs_review`) and clear textual reasoning.
- **Rationale:**
  1. Light curve dips alone do not confirm an exoplanet (binary stars, background blends, and detector anomalies produce identical transit-like dips).
  2. Never emit a binary "Confirmed Planet" badge. Emphasize "Evidence consistent with repeating transit" alongside explicit statements of what is *not* assessed (radial velocities, spectroscopy, centroid pixel localization).
