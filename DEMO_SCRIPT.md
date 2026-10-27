# DimmingLab: 3-Minute Video Demonstration Script

**Target Duration:** 2 minutes 45 seconds – 2 minutes 55 seconds (Strictly under the 3:00 CAC limit).  
**Presenter:** Pardhu Kandipati  
**App:** DimmingLab — The Exoplanet Evidence Lab  
**Status:** Rehearsal Draft — Subject to actual recording  

---

### [0:00 – 0:15] Hook & Purpose
*(Camera on Pardhu, then transition to DimmingLab Library screen)*

> **Pardhu:** "Hi, I'm Pardhu Kandipati, and this is **DimmingLab — The Exoplanet Evidence Lab**. DimmingLab helps high-school students and astronomy clubs investigate real NASA space telescope data, align repeating dips in starlight, challenge misleading signals, and produce reproducible evidence reports—all in the browser, with no Python installation, no student accounts, and zero server dependencies."

---

### [0:15 – 0:35] Exploring Real NASA Data
*(Screen recording of DimmingLab Library; cursor hovers over Case A card and clicks 'Start Investigation')*

> **Pardhu:** "In the classroom, finding an exoplanet shouldn't be a black-box guessing game. In DimmingLab, students start with authentic NASA observations. Here, I'm opening thirty-three days of photometric observations from the Kepler space telescope for Kepler-8, a confirmed transiting system. In the time-series plot, you can see subtle dips where starlight drops by nearly one percent."

---

### [0:35 – 1:05] Phase Folding & Periodic Search
*(Screen recording: cursor adjusts the period slider, then clicks 'Search for Repeating Dips')*

> **Pardhu:** "By adjusting the trial period, the app performs real-time phase folding, computing Euclidean modulo to wrap time into periodic orbits. As we approach 3.52 days, the scattered dips align at phase 0.0. Students can also launch our search worker, which scans frequency bins in the background using circular prefix sums, identifying candidate periods and harmonic aliases like half-period and double-period."

---

### [1:05 – 1:40] Challenging the Signal: The Convincing Impostor
*(Screen recording: navigates to Library, opens Case B 'The Convincing Impostor', inspects Evidence Rail)*

> **Pardhu:** "A neat fold alone is not enough to confirm a planet. Look at this second case: 'The Convincing Impostor'. When folded at 2.1 days, the dips align. But when we inspect our Scientific Evidence Rail, our Alternating Depths diagnostic flags an alert. The odd and even dips differ significantly—suggesting an eclipsing binary star system with primary and secondary eclipses. DimmingLab also reminds students that photometric dips alone cannot measure mass, illustrating the true boundaries of photometric analysis."

---

### [1:40 – 2:05] Offline Classroom Readiness
*(Screen recording: browser disconnects Wi-Fi / DevTools Offline toggle, page is fully reloaded)*

> **Pardhu:** "Because school Wi-Fi is often filtered or spotty, DimmingLab is built offline-first. Once the site and datasets are initially cached, our Service Worker allows the entire lab to reload and function without an active network connection."

---

### [2:05 – 2:30] Evidence Report & Local Persistence
*(Screen recording: filling hypothesis, clicking 'Generate Evidence Report', showing printable sheet)*

> **Pardhu:** "Finally, learners record their working hypothesis, summarize their reasoning, and address alternative explanations. With one click, DimmingLab generates a print-ready Evidence Report containing embedded plots, fitted measurements with units, diagnostic limitations, and the dataset's cryptographic SHA-256 hash for scientific reproducibility."

---

### [2:30 – 2:50] Architecture & Development Transparency
*(Camera on Pardhu with split screen of code architecture)*

> **Pardhu:** "DimmingLab is built using React, TypeScript, and HTML5 Canvas, running deterministic client-side algorithms for phase folding, box fits, and diagnostic checks. My experience working with NASA TESS research inspired me to make authentic exoplanet science accessible to every student. I used Google Antigravity as an AI pairing assistant during development, and I focused my own programming on [AWAITING CONFIRMATION: Pardhu's specific task]. Thank you!"
