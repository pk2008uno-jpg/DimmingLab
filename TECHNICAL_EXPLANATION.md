# DimmingLab: Comprehensive Technical & Scientific Walkthrough

Prepared for Pardhu Kandipati to study, explain, and defend during Congressional App Challenge judging, video presentation, and code interviews.

---

## 1. What Problem Does DimmingLab Solve?

When astronomers search for exoplanets, they measure the brightness of distant stars over days, months, or years, producing a **light curve**. If an orbiting planet passes directly between its host star and the telescope, it temporarily blocks a tiny fraction of starlight—a **transit**.

In classroom settings, teaching this is notoriously difficult:
- Existing tools either require installing complex Python environments (`astropy`, `lightkurve`) that high-school computer labs cannot support.
- Or they treat exoplanet detection as a black box: an algorithm prints "Planet Confirmed!" without teaching students how to challenge misleading signals.

**DimmingLab's Core Innovation:**  
A zero-installation, offline-first browser lab that gives students authentic NASA space telescope data and asks: **"Find it. Challenge it. Explain it."** It equips learners with real scientific diagnostics (cycle counting, alternating depth checks, secondary eclipse detection) so they discover why a neat alignment is only a hypothesis, not confirmation.

---

## 2. Core Mathematical & Numerical Foundations

### 2.1 Phase Folding & Euclidean Modulo
To reveal repeating dips across thousands of observations, observations are phase-folded onto a trial period $P$ and reference epoch $t_0$:

$$\text{norm} = \frac{t - t_0}{P}$$
$$\text{phase} = \left(\left(\text{norm} + 0.5\right) \bmod 1.0\right) - 0.5$$
$$\text{cycle} = \left\lfloor \text{norm} + 0.5 \right\rfloor$$

#### The Negative Time Edge Case in JavaScript:
In JavaScript, `-0.2 % 1.0 === -0.2` (a remainder, not a true Euclidean modulo). If an observation occurred before reference time $t_0$, standard `%` produces a negative phase outside $[0, 1)$.  
To solve this, `src/engine/folding.ts` implements `positiveModulo`:
```ts
export function positiveModulo(val: number, mod: number): number {
  return ((val % mod) + mod) % mod;
}
```
This guarantees phase is strictly centered in $[-0.5, 0.5)$, placing the transit trough exactly at phase $0.0$.

---

### 2.2 Selected-Window Two-Level Box Model Fit
A transit light curve is modeled as a two-level step function:
- Out-of-transit flux: $\mu_{\text{out}}$ (points with $|\text{phase}| > q_{\text{phase}} / 2$)
- In-transit flux: $\mu_{\text{in}}$ (points with $|\text{phase}| \le q_{\text{phase}} / 2$)

Transit Depth:
$$\delta = \mu_{\text{out}} - \mu_{\text{in}}$$

#### Weighting & Statistical Fit Improvement ($\Delta WRSS$):
Weights are assigned based on observational flux uncertainties $\sigma_i$:
$$w_i = \frac{1}{\sigma_i^2} \quad (\text{or } w_i = 1.0 \text{ if errors unavailable})$$

We compare the Weighted Residual Sum of Squares (WRSS) of a flat constant model versus the two-level box model:
$$WRSS_{\text{flat}} = \sum_{i=1}^N w_i (y_i - \mu_{\text{all}})^2$$
$$WRSS_{\text{box}} = \sum_{i \in \text{in}} w_i (y_i - \mu_{\text{in}})^2 + \sum_{j \in \text{out}} w_j (y_j - \mu_{\text{out}})^2$$
$$\Delta WRSS = WRSS_{\text{flat}} - WRSS_{\text{box}}$$

#### Scientific Guard: Rejection of Brightenings
If $\mu_{\text{in}} > \mu_{\text{out}}$, the star *brightened* rather than dimmed (e.g. a stellar flare). The engine explicitly flags `brightening_detected` and forces $\Delta WRSS = 0$. A brightening is never scored as a positive dimming candidate.

---

### 2.3 Automated Periodic Dip Scan (Web Worker BLS)
Running thousands of trial periods on 2,000+ data points on the main thread would freeze the browser UI. DimmingLab moves this to a dedicated Web Worker (`src/workers/searchWorker.ts`).

#### Fast Circular Prefix Sums:
Instead of re-sorting all points for every trial period, the worker:
1. Chooses a uniform frequency grid $f \in [f_{\text{min}}, f_{\text{max}}]$ (where $P = 1/f$).
2. Bins the folded points into $N_{\text{bins}} = 120$ phase bins in $O(N)$ time.
3. Uses circular prefix sums to test all candidate transit start bins in $O(N_{\text{bins}})$ time.
4. Returns top peaks and tags harmonic aliases:
   - **$P/2$ (Half-Period):** Common when an eclipsing binary star with equal eclipses is folded at half its true orbital period.
   - **$2P$ (Double-Period):** The true orbital period of a binary system.

---

## 3. The 5 Scientific Evidence Diagnostics

| Diagnostic | How It Works | Why It Matters Scientifically |
|---|---|---|
| **1. Repetition** | Identifies all predicted transit cycles $[cycle_{\text{min}}, cycle_{\text{max}}]$ across the time span. Checks how many distinct cycles contain actual observed dips. | Prevents confusing a single transient dropout (e.g. asteroid crossing, detector artifact) with a periodic repeating orbit. |
| **2. Alternating Depths** | Fits depth for odd cycles ($\delta_{\text{odd}}$) and even cycles ($\delta_{\text{even}}$) separately. Computes statistical difference and significance ($\sigma$). | Eclipsing binary stars often have a hotter primary star and cooler secondary star, producing deeper primary and shallower secondary eclipses. If folded at $P/2$, alternating transits show unequal depths. |
| **3. Opposite-Phase Dip** | Tests for a secondary eclipse at phase $\pm 0.5$. | A hot planet only reflects negligible optical light. A deep secondary eclipse at phase 0.5 proves the companion is self-luminous (a star or brown dwarf). |
| **4. Sampling Gaps** | Tracks predicted transit windows that fell inside data gaps (spacecraft downlink turns). | Large gaps can create aliasing artifacts where a single dip appears to fold cleanly across multiple false periods. |
| **5. Unassessed Boundaries** | Transparently lists external tests: radial velocity mass measurement, high-resolution speckle imaging, and centroid pixel shift analysis. | Starlight dimming only measures radius ratio $(R_p/R_*)^2$, not mass! A Jupiter-sized planet, brown dwarf, and M-dwarf star all have roughly the same radius. Independent radial velocity is mandatory for confirmation. |

---

## 4. Key Questions You Can Expect & How to Answer Them

### Q1: "What does phase folding do, and why can half a period be misleading?"
**Answer:**  
"Phase folding wraps time into periodic cycles: `phase = ((t - t0)/P) mod 1`. It aligns scattered dips into a single transit profile. However, if a binary star system has two stars that eclipse each other every 4 days (primary eclipse at day 0, secondary at day 2), folding at half the period (2 days) will superimpose both eclipses on top of each other! It looks like a single planet with a 2-day period, until you examine the Alternating Depths diagnostic and discover that odd and even events have different depths."

### Q2: "Which data values are transformed, and which remain immutable?"
**Answer:**  
"The raw observational arrays (time, flux, flux error, quality) are completely immutable. When normalization is selected, the engine divides flux by the segment median, creating a normalized view. Phase folding calculates derived phase coordinates on the fly. Downsampling is only used for rendering display elements on canvas; all mathematical box fits and diagnostics always calculate against the full, unbinned precision data."

### Q3: "How does an observation gap differ from an observed absence of a dip?"
**Answer:**  
"An observation gap means the telescope wasn't collecting data—no measurements exist. An observed absence means data was collected during the predicted transit window, but the flux stayed at baseline (no dip occurred). In DimmingLab, our Sampling Gaps diagnostic strictly separates missing data from observed non-detections, which prevents misleading conclusions."

### Q4: "Why does a good fit score not prove an exoplanet exists?"
**Answer:**  
"Transit depth only measures the transit cross-sectional area: $\Delta F / F \approx (R_p / R_*)^2$. Because degenerate electron pressure causes brown dwarfs and low-mass stars to have almost the exact same physical radius as Jupiter, a 1% dimming could be a gas giant, a brown dwarf, a low-mass star, or a background eclipsing binary blended into the same camera pixel. DimmingLab explicitly teaches this boundary."
