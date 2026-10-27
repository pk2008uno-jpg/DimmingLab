# DimmingLab — The Exoplanet Evidence Lab

DimmingLab is a browser-based astronomy lab for investigating how changes in starlight can reveal repeating transit-like signals. Students can explore light curves, test trial periods, check whether dimming repeats, and review possible false positives such as eclipsing binaries and observation gaps.

## Run DimmingLab on your computer

You need [Node.js](https://nodejs.org/) with npm installed.

In Windows PowerShell, run:

```powershell
git clone https://github.com/pk2008uno-jpg/DimmingLab.git
cd DimmingLab
npm ci
npm run build
node scripts/serve_release.mjs
```

Then open **http://localhost:4173** in your browser. Keep the PowerShell window open while using the app. Press **Ctrl+C** in that window to stop the local server.

After building, Windows users can also start the production app by double-clicking `Start_DimmingLab.cmd` in the project folder.

## What is included

- NASA Kepler observations of Kepler-8 b, retrieved from the Mikulski Archive for Space Telescopes (MAST).
- Clearly labeled synthetic examples for investigating eclipsing binaries, single-event traps, and signal recovery in noise.
- Interactive light-curve analysis, period searching, evidence checks, and reproducible reports.

Repeated dimming is evidence to investigate; it does not by itself determine the astrophysical object type.

## Local access and judging

`localhost` is only reachable from the computer running the server. A judge cannot open your computer's `localhost` from a GitHub link. Judges can download or clone this repository and follow the steps above to run DimmingLab on their own computer. To provide a browser link that opens without local setup, the app must be deployed to a public web host.

## AI development disclosure

AI tools assisted with development. DimmingLab does not use an AI model or cloud AI service while running. See [`AI_USE.md`](AI_USE.md) and [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) for the project’s development and contribution records.
