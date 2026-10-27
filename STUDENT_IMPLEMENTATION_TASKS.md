# DimmingLab: Student Implementation & Technical Ownership Tasks

This document defines substantive coding tasks, interfaces, edge cases, and test contracts designed for Pardhu to study, implement, and explain during competition reviews.

---

## Task 1: Event Window Grouping & Single-Event Guard
- **File:** `src/engine/evidence.ts`
- **Objective:** Separate raw observation coverage from actual transit event detection.
- **Contract:**
  ```ts
  export interface EventDetail {
    cycle: number;
    centerTime: number;
    sampleCount: number;
    isSampled: boolean; // Must be true only if samples >= 2 AND dimming is observed
    meanFlux?: number;
    depth?: number;
  }
  ```
- **Edge Cases to Handle:**
  1. Window falls completely inside a telescope downlink gap (0 samples): `isSampled = false`, `sampleCount = 0`.
  2. Window contains observations, but star is at flat baseline (no transit): `isSampled = false` (or non-event), `depth <= 0`.
  3. Single-event dropout: Only 1 cycle exhibits transit depth; all other cycles are gaps or flat baseline. Repetition must return `status: 'inconclusive'`.
- **Unit Test Reference:** `tests/case_c.test.ts` and `tests/engine.test.ts`.

---

## Task 2: Alternating Eclipse Depth Statistical Test
- **File:** `src/engine/evidence.ts`
- **Objective:** Compare odd versus even cycle transit depths to detect Eclipsing Binary stars.
- **Contract:**
  - Group observations by `Math.abs(cycle) % 2 === 1` (odd) versus `Math.abs(cycle) % 2 === 0` (even).
  - Compute box-fit depths $\delta_{\text{odd}}$ and $\delta_{\text{even}}$ and their standard errors $\sigma_{\text{odd}}, \sigma_{\text{even}}$.
  - Compute pooled standard error:
    $$\sigma_{\text{diff}} = \sqrt{\sigma_{\text{odd}}^2 + \sigma_{\text{even}}^2}$$
  - Compute significance:
    $$Z = \frac{|\delta_{\text{odd}} - \delta_{\text{even}}|}{\sigma_{\text{diff}}}$$
  - If $Z > 3.0$ and depth ratio $< 0.85$, trigger `needs_review` with Eclipsing Binary warning.
- **Unit Test Reference:** `tests/engine.test.ts` (`detects alternating depths in eclipsing binary simulation`).

---

## Task 3: Controlled Transit Signal Injection Experiment
- **File:** `scripts/prepare_datasets.py` (`prepare_case_d`)
- **Objective:** Implement a reproducible synthetic signal injection experiment into realistic space telescope photometric noise.
- **Contract:**
  - Base baseline: Gaussian white noise $\sigma = 1,200$ ppm.
  - Injected periodic signal: $P = 4.120$ days, $t_0 = 52.30$, depth = $1,500$ ppm (depth comparable to noise!).
  - Demonstrates how multi-transit phase folding stacks $N$ transits to increase signal-to-noise ratio by $\sqrt{N}$.
- **Unit Test Reference:** `tests/search.test.ts`.

---

## Task 4: Canonical Dataset Hashing
- **File:** `src/engine/hash.ts`
- **Objective:** Implement deterministic canonical string serialization and SHA-256 calculation.
- **Contract:**
  - Points sorted by `time` ascending, tie-breaking by `originalIndex`.
  - Format: `${time.toFixed(6)},${flux.toFixed(6)},${err},${quality},${segment}`.
  - Generates 64-character hexadecimal SHA-256 hash.
- **Unit Test Reference:** `tests/engine.test.ts` (`computes deterministic SHA-256 independent of input row order`).
