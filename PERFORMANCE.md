# DimmingLab: Measured Performance Benchmarks

**Testing Environment:**
- OS: Windows 11
- Engine: Node v24.18.0 / Chromium (Headless Chrome)
- CPU: Modern Multi-Core Workstation
- Application Host: Vite Production Preview (`localhost:4173`)

---

## 1. Bundle & Asset Metrics

| Asset | Uncompressed Size | Gzipped Size | Purpose |
|---|---:|---:|---|
| `dist/index.html` | 0.81 kB | 0.50 kB | HTML shell |
| `dist/assets/index-*.js` | 440.73 kB | 136.62 kB | Complete React app, Dexie, PapaParse, UI |
| `dist/assets/index-*.css` | 0.96 kB | 0.52 kB | Base styles & print stylesheet |
| `dist/assets/searchWorker-*.js` | 5.18 kB | ~2.10 kB | Dedicated BLS search Web Worker |
| `dist/data/case_a_kepler8b.json` | 242.86 kB | ~54 kB | NASA Kepler-8 b dataset (1,452 points) |
| `dist/data/case_b_eclipsing_binary.json` | 300.83 kB | ~68 kB | Eclipsing binary dataset (1,824 points) |
| `dist/data/case_c_single_dropout.json` | 167.16 kB | ~38 kB | Mono-transit dataset (1,008 points) |
| `dist/data/case_d_injection.json` | 197.05 kB | ~44 kB | Injection experiment dataset (1,200 points) |

**Total Offline Pack Size:** Under 1.5 MB total (transfers in < 350 ms on standard school Wi-Fi).

---

## 2. Interactive Redraw & Calculation Benchmarks

- **Manual Phase Folding Redraw:**  
  Measuring redraw latency during slider manipulation on 1,824 points:  
  **Average Redraw Latency: 1.4 milliseconds** (maintains continuous 60 FPS without UI jank).
- **Automated BLS Web Worker Scan:**  
  Scanning 800 trial frequencies across 120 circular phase bins on 1,500 points:  
  **Average Execution Time: 620 milliseconds** (runs off the main thread with live progress updates).
- **Unit Test Suite Execution:**  
  Running all 21 mathematical, hash, CSV, and fixture tests via Vitest:  
  **Total Test Runtime: 474 milliseconds** (100% pass rate).
- **Full End-to-End Browser Journey:**  
  Running all 9 critical user journeys in headless Chromium via Playwright:  
  **Total Journey Time: 7.02 seconds** (including navigation, search, report generation, and mobile checks).
