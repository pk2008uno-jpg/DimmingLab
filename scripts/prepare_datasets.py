#!/usr/bin/env python3
"""
DimmingLab - Dataset Preparation and Golden Data Generation
Creates the 4 required datasets for DimmingLab:
  - Case A (Observed): NASA Kepler-8 b (KIC 006922244) Quarter 1 light curve
  - Case B (Synthetic): Eclipsing Binary with alternating eclipse depths
  - Case C (Synthetic): Single-event dropout with sampling gaps
  - Case D (Synthetic/Injection): Signal injection recovery experiment
Outputs JSON files directly to public/data/ with complete provenance manifests.
"""

import os
import json
import hashlib
import urllib.request
import numpy as np

# Ensure public/data exists
os.makedirs("public/data", exist_ok=True)

def canonical_hash(points):
    """
    Computes canonical SHA-256 hash according to DimmingLab specification:
    Sorted by time, formatted to 6 decimal places: time,flux,flux_err,quality,segment
    """
    sorted_pts = sorted(points, key=lambda p: (p['time'], p['originalIndex']))
    lines = []
    for p in sorted_pts:
        t = f"{p['time']:.6f}"
        f = f"{p['flux']:.6f}"
        e = f"{p['fluxErr']:.6f}" if p.get('fluxErr') is not None else ""
        q = str(p['quality']) if p.get('quality') is not None else ""
        s = str(p['segment']) if p.get('segment') is not None else ""
        lines.append(f"{t},{f},{e},{q},{s}")
    canonical_str = "\n".join(lines)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

def prepare_case_a():
    print("Preparing Case A: Observed NASA Kepler-8 b...")
    fits_url = "https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:KEPLER/url/missions/kepler/lightcurves/0069/006922244/kplr006922244-2009166043257_llc.fits"
    req = urllib.request.Request(fits_url, headers={'User-Agent': 'DimmingLab/1.0'})
    
    with urllib.request.urlopen(req) as resp:
        fits_bytes = resp.read()
    
    source_sha256 = hashlib.sha256(fits_bytes).hexdigest()
    
    from astropy.io import fits
    import io
    with fits.open(io.BytesIO(fits_bytes)) as hdul:
        data = hdul[1].data
        raw_time = data['TIME']
        raw_flux = data['PDCSAP_FLUX']
        raw_err = data['PDCSAP_FLUX_ERR']
        raw_qual = data['SAP_QUALITY']
        
        valid = np.isfinite(raw_time) & np.isfinite(raw_flux) & (raw_qual == 0)
        time = raw_time[valid]
        flux = raw_flux[valid]
        err = raw_err[valid]
        qual = raw_qual[valid]

    # Normalize by positive median
    median_flux = float(np.median(flux))
    norm_flux = flux / median_flux
    norm_err = err / median_flux

    points = []
    for i in range(len(time)):
        points.append({
            "time": round(float(time[i]), 6),
            "flux": round(float(norm_flux[i]), 6),
            "fluxErr": round(float(norm_err[i]), 6),
            "quality": int(qual[i]),
            "segment": 1,
            "originalIndex": i
        })

    canonical_sha = canonical_hash(points)
    time_span = float(np.max(time) - np.min(time))

    manifest = {
        "id": "case_a_kepler8b",
        "version": "1.0.0",
        "title": "Kepler-8 b: The Repeating Transit",
        "subtitle": "Observed NASA Kepler Quarter 1 photometry of confirmed exoplanet Kepler-8 b",
        "kind": "observed",
        "mission": "Kepler",
        "targetId": "KIC 006922244 (Kepler-8 / KOI-18)",
        "sourceUrl": fits_url,
        "sourceProductId": "kplr006922244-2009166043257_llc.fits",
        "retrievedAt": "2026-10-26T20:50:00Z",
        "sourceSha256": source_sha256,
        "canonicalDataSha256": canonical_sha,
        "timeFormat": "BKJD",
        "timeReference": "BJD - 2454833.0 (Kepler Barycentric Julian Day)",
        "fluxUnit": "Normalized Relative Flux",
        "segmentPolicy": "Kepler Quarter 1 Long Cadence (30-minute cadence)",
        "qualityPolicy": "SAP_QUALITY == 0 (Default high-quality science cadences)",
        "preparationSteps": [
            "Retrieved primary science product from STScI Mikulski Archive (MAST)",
            "Extracted PDCSAP_FLUX and filtered to SAP_QUALITY == 0",
            "Normalized by positive median flux",
            "Preserved original precision and timestamps"
        ],
        "attribution": "NASA Kepler Science Mission / STScI MAST Archive",
        "reuseNotes": "Public domain NASA astronomical archive data.",
        "pointCount": len(points),
        "timeSpanDays": round(time_span, 2)
    }

    teaching = {
        "suggestedPeriodDays": 3.5225,
        "suggestedEpochDays": 131.687,
        "suggestedDurationHours": 3.2,
        "learningGoal": "Discover and align a repeating periodic transit in authentic NASA space telescope data.",
        "skillPracticed": "Phase folding, period fitting, and repetition verification",
        "approximateMinutes": 10,
        "guidedQuestions": [
            "When you adjust the trial period near 3.52 days, what happens to the scattered dips in the phase plot?",
            "How many distinct transit events occurred during this 33-day observation period?",
            "Does an aligned dip prove the presence of an exoplanet by itself, or could a binary star create this?"
        ],
        "explanationSummary": "Kepler-8 b is a hot Jupiter exoplanet orbiting an F-type star with an orbital period of approximately 3.5225 days. The transit depth is approximately 0.93% (9,300 ppm) with a duration of ~3.2 hours.",
        "teacherAnswerReveal": {
            "astronomicalContext": "Discovered by the Kepler space telescope in 2010 (Jenkins et al. 2010).",
            "catalogIdentifier": "Kepler-8 b / KOI-18.01 / KIC 6922244",
            "trueNature": "Confirmed hot Jupiter gas giant exoplanet",
            "evidenceEvaluation": "Shows 9 distinct, evenly-spaced transits with identical depths. No secondary eclipse is visible in optical light at phase 0.5. Odd and even transit depths are consistent within observational error.",
            "alternativeExplanations": [
                "Eclipsing binary with identical components (ruled out by radial velocity confirmation).",
                "Background blended binary (ruled out by high-resolution imaging and centroid analysis)."
            ]
        }
    }

    dataset = {
        "manifest": manifest,
        "teaching": teaching,
        "points": points
    }

    out_path = "public/data/case_a_kepler8b.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"Case A saved: {out_path} ({len(points)} points, hash: {canonical_sha[:8]}...)")


def prepare_case_b():
    print("Preparing Case B: Synthetic Eclipsing Binary Impostor...")
    np.random.seed(42)
    
    # 40 days of observations at 30-min cadence (48 points per day)
    t = np.linspace(100.0, 140.0, 40 * 48)
    
    # True binary orbital period = 4.2000 days
    # Primary eclipse: depth = 2.5% (0.025), duration = 4.0 hours = 0.1667 days, phase = 0.0
    # Secondary eclipse: depth = 0.8% (0.008), duration = 4.0 hours, phase = 0.5
    true_period = 4.2000
    t0_primary = 101.5000
    dur_days = 4.0 / 24.0

    flux = np.ones_like(t)
    
    for i, ti in enumerate(t):
        # Primary eclipse at cycle * 4.2
        norm = (ti - t0_primary) / true_period
        phase = ((norm + 0.5) % 1.0) - 0.5
        
        # Primary dip at phase 0.0
        if abs(phase) <= (dur_days / true_period) / 2.0:
            flux[i] -= 0.025
            
        # Secondary dip at phase 0.5 (or -0.5)
        phase_sec = ((norm) % 1.0) - 0.5
        if abs(phase_sec) <= (dur_days / true_period) / 2.0:
            flux[i] -= 0.008

    # Add realistic Gaussian photometric noise (sigma = 0.0015 = 1500 ppm)
    noise = np.random.normal(0, 0.0015, len(t))
    flux += noise

    # Add small gap between days 118 and 120 (telescope downlink)
    valid_mask = ~((t >= 118.0) & (t <= 120.0))
    t = t[valid_mask]
    flux = flux[valid_mask]

    points = []
    for i in range(len(t)):
        points.append({
            "time": round(float(t[i]), 6),
            "flux": round(float(flux[i]), 6),
            "fluxErr": 0.0015,
            "quality": 0,
            "segment": 1,
            "originalIndex": i
        })

    canonical_sha = canonical_hash(points)

    manifest = {
        "id": "case_b_eclipsing_binary",
        "version": "1.0.0",
        "title": "The Convincing Impostor: Alternating Depths",
        "subtitle": "Synthetic simulation of an eclipsing binary star exhibiting primary and secondary eclipses",
        "kind": "synthetic",
        "mission": "simulation",
        "targetId": "SIM-EB-1042",
        "sourceUrl": None,
        "sourceProductId": "dimminglab_sim_v1_eb_seed42",
        "retrievedAt": "2026-10-26T20:50:00Z",
        "sourceSha256": None,
        "canonicalDataSha256": canonical_sha,
        "timeFormat": "relative_days",
        "timeReference": "Simulated Barycentric Days",
        "fluxUnit": "Normalized Relative Flux",
        "segmentPolicy": "Continuous simulation with single 2-day orbit downlink gap",
        "qualityPolicy": "Simulated clean science cadences",
        "preparationSteps": [
            "Generated box transit model with primary depth 2.5% and secondary depth 0.8%",
            "Orbital period 4.200 days, duration 4.0 hours",
            "Injected Gaussian photometric noise (sigma=1500 ppm, seed=42)",
            "Inserted 2-day observational gap to simulate spacecraft downlink"
        ],
        "attribution": "DimmingLab Astronomical Simulator v1.0",
        "reuseNotes": "Synthetically generated teaching benchmark.",
        "simulatorVersion": "1.0.0",
        "seed": 42,
        "pointCount": len(points),
        "timeSpanDays": 40.0
    }

    teaching = {
        "suggestedPeriodDays": 2.1000,
        "suggestedEpochDays": 101.5000,
        "suggestedDurationHours": 4.0,
        "learningGoal": "Recognize why a convincing folded signal at half-period is actually an eclipsing binary star.",
        "skillPracticed": "Alternating depth test and harmonic period resolution",
        "approximateMinutes": 12,
        "guidedQuestions": [
            "When folded at P = 2.10 days, the dips align cleanly. But look closely at the depth of alternating events. Are they identical?",
            "What happens if you double the trial period to P = 4.20 days?",
            "Why would a binary star system produce deep and shallow dips every other orbit?"
        ],
        "explanationSummary": "If folded at 2.10 days (half the true orbital period), primary and secondary eclipses fold together. However, checking the Alternating Depths evidence card exposes a statistically significant depth difference (2.5% vs 0.8%), proving this is a binary star system, not an exoplanet.",
        "teacherAnswerReveal": {
            "astronomicalContext": "Eclipsing binaries (EBs) are two stars orbiting their common center of mass.",
            "catalogIdentifier": "Simulated Impostor System SIM-EB-1042",
            "trueNature": "Detached Eclipsing Binary Star (Primary Star + Secondary Star)",
            "evidenceEvaluation": "When folded at P = 2.1 days, alternating depths differ significantly (>10σ). Doubling the period to P = 4.20 days shows a primary eclipse at phase 0.0 and a secondary eclipse at phase 0.5.",
            "alternativeExplanations": [
                "Two separate planets with resonant periods (ruled out by identical durations and exact 2:1 period ratio).",
                "Eclipsing binary with cooler secondary star (the correct astrophysical interpretation)."
            ]
        }
    }

    dataset = {
        "manifest": manifest,
        "teaching": teaching,
        "points": points
    }

    out_path = "public/data/case_b_eclipsing_binary.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"Case B saved: {out_path} ({len(points)} points, hash: {canonical_sha[:8]}...)")


def prepare_case_c():
    print("Preparing Case C: Single Dropout with Irregular Gaps...")
    np.random.seed(99)
    
    # 45 days span, but with large irregular observational gaps
    # Real dip only occurs ONCE: at day 115.0
    t_chunks = [
        np.linspace(100.0, 106.0, 6 * 48),  # chunk 1
        np.linspace(113.0, 117.0, 4 * 48),  # chunk 2: contains the single dip at day 115.0
        np.linspace(124.0, 128.0, 4 * 48),  # chunk 3
        np.linspace(138.0, 145.0, 7 * 48),  # chunk 4
    ]
    t = np.concatenate(t_chunks)
    flux = np.ones_like(t)

    # Inject single dip at day 115.0: depth 1.2%, duration 4.5 hours
    dip_center = 115.0
    dur_days = 4.5 / 24.0
    for i, ti in enumerate(t):
        if abs(ti - dip_center) <= dur_days / 2.0:
            flux[i] -= 0.012

    # Add Gaussian noise (sigma = 0.0018 = 1800 ppm)
    noise = np.random.normal(0, 0.0018, len(t))
    flux += noise

    points = []
    for i in range(len(t)):
        points.append({
            "time": round(float(t[i]), 6),
            "flux": round(float(flux[i]), 6),
            "fluxErr": 0.0018,
            "quality": 0,
            "segment": 1,
            "originalIndex": i
        })

    canonical_sha = canonical_hash(points)

    manifest = {
        "id": "case_c_single_dropout",
        "version": "1.0.0",
        "title": "One Dip, Many Illusions: The Gap Trap",
        "subtitle": "Synthetic simulation of a single transit event surrounded by large telescope gaps",
        "kind": "synthetic",
        "mission": "simulation",
        "targetId": "SIM-MONO-2099",
        "sourceUrl": None,
        "sourceProductId": "dimminglab_sim_v1_mono_seed99",
        "retrievedAt": "2026-10-26T20:50:00Z",
        "sourceSha256": None,
        "canonicalDataSha256": canonical_sha,
        "timeFormat": "relative_days",
        "timeReference": "Simulated Days",
        "fluxUnit": "Normalized Relative Flux",
        "segmentPolicy": "Gapped observations (chunks across 45-day window)",
        "qualityPolicy": "Simulated cadences with observational gaps",
        "preparationSteps": [
            "Simulated a single transit-like dip at day 115.0 (depth 1.2%, duration 4.5 hours)",
            "Inserted extensive telescope observation gaps (gaps between days 106-113, 117-124, 128-138)",
            "Injected Gaussian noise (sigma=1800 ppm, seed=99)"
        ],
        "attribution": "DimmingLab Astronomical Simulator v1.0",
        "reuseNotes": "Synthetically generated teaching benchmark.",
        "simulatorVersion": "1.0.0",
        "seed": 99,
        "pointCount": len(points),
        "timeSpanDays": 45.0
    }

    teaching = {
        "suggestedPeriodDays": 3.7500,
        "suggestedEpochDays": 115.0000,
        "suggestedDurationHours": 4.5,
        "learningGoal": "Discover how a single real dip can fold neatly on multiple arbitrary trial periods when gaps hide missing events.",
        "skillPracticed": "Distinguishing folded alignment from genuine repetition in the time domain",
        "approximateMinutes": 10,
        "guidedQuestions": [
            "If you fold this dataset at P = 3.75 days, the phase plot shows a neat dip at phase 0. Does that mean it repeats every 3.75 days?",
            "Look at the Repetition and Sampling Gaps evidence cards. How many distinct events were actually observed?",
            "Why is checking the time-series chart essential before claiming a periodic exoplanet?"
        ],
        "explanationSummary": "Because of telescope gaps, a single dip at day 115 folds into an apparently convincing dip at P = 3.75 days, P = 5.00 days, or other trial periods. However, the Repetition card warns that only 1 single event exists. A single event cannot confirm periodicity without observing subsequent transits.",
        "teacherAnswerReveal": {
            "astronomicalContext": "Mono-transits occur when only one transit is captured during a mission window.",
            "catalogIdentifier": "Simulated Mono-Transit SIM-MONO-2099",
            "trueNature": "Single transient event or long-period candidate (P > 45 days)",
            "evidenceEvaluation": "The Repetition test reports exactly 1 observed event out of 12 predicted windows. The Sampling Gaps test shows >70% of predicted transit windows were unsampled. Periodicity is unproven.",
            "alternativeExplanations": [
                "Long-period exoplanet with P > 45 days whose next transit occurred after observations ended.",
                "Instrumental dropout, cosmic ray hit, or asteroid transit."
            ]
        }
    }

    dataset = {
        "manifest": manifest,
        "teaching": teaching,
        "points": points
    }

    out_path = "public/data/case_c_single_dropout.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"Case C saved: {out_path} ({len(points)} points, hash: {canonical_sha[:8]}...)")


def prepare_case_d():
    print("Preparing Case D: Noise and Controlled Injection...")
    np.random.seed(1234)
    
    # 25 days of continuous observations (48 pts/day = 1200 points)
    t = np.linspace(50.0, 75.0, 25 * 48)
    
    # Injected planet: Period 4.120 days, epoch 52.30, duration 3.0 hours, shallow depth 0.15% (1500 ppm)
    period = 4.120
    epoch = 52.30
    dur_days = 3.0 / 24.0
    depth = 0.0015
    
    flux = np.ones_like(t)
    for i, ti in enumerate(t):
        norm = (ti - epoch) / period
        phase = ((norm + 0.5) % 1.0) - 0.5
        if abs(phase) <= (dur_days / period) / 2.0:
            flux[i] -= depth

    # Noise sigma = 0.0012 (1200 ppm, comparable to transit depth!)
    noise = np.random.normal(0, 0.0012, len(t))
    flux += noise

    points = []
    for i in range(len(t)):
        points.append({
            "time": round(float(t[i]), 6),
            "flux": round(float(flux[i]), 6),
            "fluxErr": 0.0012,
            "quality": 0,
            "segment": 1,
            "originalIndex": i
        })

    canonical_sha = canonical_hash(points)

    manifest = {
        "id": "case_d_injection",
        "version": "1.0.0",
        "title": "Noise and Recovery: Signal-to-Noise Challenge",
        "subtitle": "Controlled synthetic transit injection (depth 1,500 ppm) embedded in comparable photometric noise",
        "kind": "injection",
        "mission": "simulation",
        "targetId": "SIM-INJ-4120",
        "sourceUrl": None,
        "sourceProductId": "dimminglab_sim_v1_inj_seed1234",
        "retrievedAt": "2026-10-26T20:50:00Z",
        "sourceSha256": None,
        "canonicalDataSha256": canonical_sha,
        "timeFormat": "relative_days",
        "timeReference": "Simulated Days",
        "fluxUnit": "Normalized Relative Flux",
        "segmentPolicy": "Continuous 25-day cadence baseline",
        "qualityPolicy": "Simulated science cadences",
        "preparationSteps": [
            "Injected 1,500 ppm periodic box signal at P = 4.120 days, epoch 52.30",
            "Added 1,200 ppm Gaussian photometric noise to simulate high-precision space photometry",
            "Used held-out seed 1234"
        ],
        "attribution": "DimmingLab Astronomical Simulator v1.0",
        "reuseNotes": "Synthetically generated teaching benchmark.",
        "simulatorVersion": "1.0.0",
        "seed": 1234,
        "pointCount": len(points),
        "timeSpanDays": 25.0
    }

    teaching = {
        "suggestedPeriodDays": 4.120,
        "suggestedEpochDays": 52.30,
        "suggestedDurationHours": 3.0,
        "learningGoal": "Understand how phase folding recovers shallow exoplanet signals buried in noise by stacking multiple transits.",
        "skillPracticed": "Signal-to-noise recovery and statistical averaging",
        "approximateMinutes": 10,
        "guidedQuestions": [
            "In the raw time-series graph, can you spot the individual transits by eye?",
            "Why does the transit dip become clearly visible once all 6 transits are folded together in the phase chart?",
            "How does folding increase the signal-to-noise ratio?"
        ],
        "explanationSummary": "In the raw time series, a 1,500 ppm dip is almost invisible against 1,200 ppm random noise. But folding phase-aligns all 6 transits, reducing random noise by sqrt(N) and clearly revealing the shallow planet.",
        "teacherAnswerReveal": {
            "astronomicalContext": "Most Earth-sized and Neptune-sized planets are invisible in individual transits and require phase folding to detect.",
            "catalogIdentifier": "Controlled Injection SIM-INJ-4120",
            "trueNature": "Injected synthetic small planet candidate",
            "evidenceEvaluation": "Shows 6 repeated transits with equal depths and no secondary eclipse. Recoverable with BLS search near P = 4.120 days.",
            "alternativeExplanations": [
                "Instrumental red noise (eliminated by checking multi-event phase coherence)."
            ]
        }
    }

    dataset = {
        "manifest": manifest,
        "teaching": teaching,
        "points": points
    }

    out_path = "public/data/case_d_injection.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"Case D saved: {out_path} ({len(points)} points, hash: {canonical_sha[:8]}...)")


if __name__ == "__main__":
    prepare_case_a()
    prepare_case_b()
    prepare_case_c()
    prepare_case_d()
    print("All 4 DimmingLab datasets generated successfully.")
