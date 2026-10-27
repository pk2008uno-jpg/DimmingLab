> Historical input document. Current verification is in 00_START_HERE.md, RELEASE_VERIFICATION.json and logs/release_*.log. Earlier pass claims do not cover the final repair.

# DimmingLab: The Exoplanet Evidence Lab — Reviewer Guide

**Entry Title:** DimmingLab — The Exoplanet Evidence Lab  
**Target Competition:** Congressional App Challenge (CAC) 2026  
**Applicant:** Pardhu Kandipati  
**Review Snapshot Date:** October 26, 2026  
**Status:** Audit & Verification Complete — Awaiting Student Technical Contribution  

---

## 1. Executive Summary

DimmingLab is an offline-first, browser-based exoplanet science workstation designed for high school physics, earth science, and astronomy classrooms. It empowers students to analyze authentic NASA photometric observations, fold starlight curves in real-time, search for periodic transits using background Web Workers, systematically challenge false positives (such as eclipsing binary stars and instrument dropouts), and generate print-ready scientific evidence sheets.

DimmingLab requires **zero Python installations, zero student accounts, zero telemetry, and zero runtime AI APIs**.

---

## 2. Verified Toolchain & Environment

- **Operating System:** Windows 11 / x64
- **Node.js:** v24.18.0
- **npm:** 11.16.0
- **Python:** 3.14.3
- **TypeScript:** 5.9.3
- **Vite:** 8.3.5
- **Vitest:** 5.0.5
- **Playwright:** 1.64.1
- **Git HEAD:** `bbdbc72`

---

## 3. Quick Start & Verification Instructions

### A. Install Dependencies
```bash
npm install
```

### B. Run TypeScript Static Verification
Ensures 100% strict type coverage across application UI, scientific engine, Web Workers, and test suites:
```bash
npx tsc --noEmit
```

### C. Run All Automated Unit & Numerical Control Tests
Executes 61 unit tests across 10 test suites, verifying numerical controls, scientific regressions, hash reproducibility, CSV parsing, worker lifecycle, priority regression suites, and edge cases:
```bash
npm test -- --run
```

### D. Build Production Distribution
Compiles optimized ES modules, generates precached Service Worker manifest, and bundles CSS/assets:
```bash
npm run build
```

### E. Start Production Preview Server
Serves the production build at `http://localhost:4173`:
```bash
npm run preview -- --port 4173
```

### F. Run Playwright End-to-End Browser Journeys
Executes 10 comprehensive browser journeys testing Library view, "Open Saved Project (.json)", Case A workspace, canvas rendering, search worker cancellation, periodic dip scan, student conclusion authoring, project JSON export and re-import from disk, Case B alternating depths impostor flag, Case C mono-transit gap warning, Case D injection recovery, mobile 375px responsive layout without horizontal overflow, and keyboard navigation:
```bash
node scripts/test_e2e_browser.mjs
```

### G. Run Real Offline Verification
Simulates online service worker installation, cuts network connectivity completely (`context.setOffline(true)`), performs a full page reload (`page.reload()`), verifies offline calculations and report generation, and tests cold offline failure:
```bash
node scripts/test_offline_reload.mjs
```

### H. Capture Visual Review Screenshots
Captures high-resolution screenshots of all 8 core views into `docs/screenshots/`:
```bash
node scripts/capture_all_screenshots.mjs
```

---

## 4. Key Documentation Index

| Document | Description |
|---|---|
| [`AUDIT_RESULTS.md`](AUDIT_RESULTS.md) | Exhaustive 15-point claim-by-claim verification matrix with pass/fail statuses and remediation notes. |
| [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) | Clear division of authorship between external specification, AI-generated scaffold, established scientific methods, and student contribution. |
| [`AI_USE.md`](AI_USE.md) | Full AI assistance disclosure statement for CAC entry portal, confirming zero runtime AI models in the app. |
| [`STUDENT_IMPLEMENTATION_TASKS.md`](STUDENT_IMPLEMENTATION_TASKS.md) | Coherent, substantive programming task designated for Pardhu to establish authentic student technical contribution. |
| [`TECHNICAL_EXPLANATION.md`](TECHNICAL_EXPLANATION.md) | Deep-dive mathematical and software engineering documentation of phase folding, box-least-squares search, and diagnostic statistics. |
| [`SUBMISSION_DRAFT.md`](SUBMISSION_DRAFT.md) | Official CAC entry draft with honest disclaimers and placeholders for student reflections. |
| [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | Timed 2-minute 45-second video demonstration script for the student presentation. |

---

## 5. Curated Datasets & Provenance

| Case | Title | Kind | Source / Generation | SHA-256 Canonical Hash | Key Metric Verified |
|---|---|---|---|---|---|
| **A** | **Kepler-8 b: The Repeating Transit** | Observed NASA | STScI Mikulski Archive for Space Telescopes (MAST)<br>KIC 006922244, Quarter 1 Long Cadence | `ba188e8782ff0be96198b66424302c17a4f68a7cc472b7b1a2e4778312c48bf8` | 1,452 points, 33.47d span, $P \approx 3.5225\text{d}$, depth $\approx 0.93\%$, 9 observed events (Cycle 9 occurred during downlink gap). |
| **B** | **The Convincing Impostor** | Synthetic Simulation | Simulates eclipsing binary star with primary & secondary eclipses (Seed 42) | `a374184d137bed94ed8b59421c7ca779a8ef098f1c838e78ea85feae72aadd0c` | 1,824 points, alternating depths diagnostic flags odd/even disparity at $P = 1.76\text{d}$. |
| **C** | **One Dip, Many Illusions: The Gap Trap** | Synthetic Simulation | Single transit dropout with telescope downlink gaps (Seed 99) | `d472c1dde4827b3d7ae5a5a7272a9fbc4e3548d39f4aa760c1d2b20d10adc12d` | 1,008 points, repetition diagnostic flags mono-transit warning (only 1 event observed). |
| **D** | **Noise & Recovery Challenge** | Synthetic Injection | Faint transit signal ($0.4\%$) injected into Gaussian noise (Seed 1234) | `e0aa16ce1b07d26c9be4e728bdc549657db29df8a59de8c4807c51717ea6c7f8` | 1,200 points, demonstrates phase-folding signal-to-noise ratio amplification ($\sqrt{N}$). |

---

## 6. Review Visual Gallery (`docs/screenshots/`)

- `01_library_view.png`: Investigation library catalog showing observed vs synthetic cards and offline pack readiness badge.
- `02_csv_import_modal.png`: Custom CSV light curve import modal with column auto-mapping and validation.
- `03_teacher_guide.png`: Teacher curriculum, 10–15 min lesson plan, vocabulary, and answer key behind intentional reveal.
- `04_workspace_kepler8b.png`: Real-time interactive workspace displaying Kepler-8 b time series, folded light curve, and parameter steppers.
- `05_evidence_report.png`: Scientific Evidence Report printable sheet showing embedded plots, calculated measurements, and dataset hash.
- `06_case_b_eclipsing_binary.png`: False-positive diagnostic flagging alternating depths in an eclipsing binary system.
- `07_case_c_instrument_dropout.png`: Diagnostic engine flagging mono-transit warning when observation gaps create an illusory fold.
- `offline_reload_verified.png`: Proof of service worker full page reload and workspace calculation with network disconnected.
