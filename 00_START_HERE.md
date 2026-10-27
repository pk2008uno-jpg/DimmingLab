# DimmingLab — teacher guide update

The teacher guide has been rewritten and restyled. See TEACHER_GUIDE_UPDATE.md for this update and its current checks. The earlier redesign notes below remain for reference.

App 1.0.2 · scientific engine 1.1.0. The redesigned source and production build are both included.

## Open the app

1. Extract the entire ZIP into a new folder. Keep your previous project as a backup.
2. Close any older DimmingLab terminal using port 4173.
3. On Windows, double-click **Start_DimmingLab.cmd**. Node.js must be installed. No package installation is needed to run the bundled build.
4. Open **http://localhost:4173** in Chrome and keep the terminal open. A fresh Incognito window avoids an older preview's cache.

On other systems, run `node scripts/serve_release.mjs` from the extracted folder. Do not open dist/index.html directly.

## What changed

The app now has an investigation library with clear navigation, an original observatory illustration, real dataset previews, functioning case filters, a focused analysis workspace, simpler evidence disclosures, consistent report controls and complete light/dark themes. Phone/tablet layouts and CSV keyboard access were checked in a live browser. DESIGN_REFERENCES.md explains how Linear, Observable and NASA Eyes informed the implementation.

The scientific engine, curated measurements and source FITS are unchanged. Two display corrections keep the box overlay in the plotted flux units and avoid attributing user-imported observed data to NASA.

## Check your final machine before recording

- Open Case A, write a distinctive conclusion, immediately return to Library and resume. Confirm the latest answer remains.
- Generate a report and compare its depth with the workspace; download and reopen the project JSON.
- Open Case D at its default settings and expand the coverage check: six predicted windows contain observations and zero are absent. Run a period search and apply a result.
- For a precise units control, import examples/release_control.csv as Relative days and Synthetic simulation. Set period 4, epoch 0.5 and duration 3 hours. The relative depth is 1.5625%, including in the report.
- To demonstrate offline support, wait for **Offline Classroom Pack Ready**, disconnect the network, reload, open a case, search and generate a report. The online development preview does not establish this final localhost workflow.

## Verification and scope

All 78 existing tests pass across 11 suites, TypeScript and the production build pass, and all 11 exact build resources pass the packaged HTTP/service-worker API harness. The four canonical datasets and seven engine files match the previous repaired release byte for byte.

Live Chrome preview checks covered save/resume, report consistency, project JSON export/reopen, CSV import and its known-depth control, Case D coverage, worker search/application, filters, light/dark appearance, keyboard focus trapping/Escape, and responsive containment. Phone and tablet checks used actual iframe viewports at 375px and 768px. The phone report also had no horizontal document overflow.

A real-browser offline hard reload of the production build on localhost remains a required local check. The packaged API harness passed; it is not a live browser. The portable production browser runner was not executed in this environment. Do not turn these scoped results into an all-platform or competition-success guarantee.

Current evidence: RELEASE_VERIFICATION.json, logs/redesign_unit_tests.log, logs/redesign_build.log, logs/redesign_packaged_check.log and logs/redesign_browser_qa.md. Earlier release logs and supplied screenshots are historical. The previous repair patch and the new visual redesign patch are both included.

## Rebuild or hand off to Flash

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
node scripts/test_packaged_release.mjs
node scripts/test_release_browser.mjs
```

The browser runner uses installed Chrome, falling back to a Playwright browser. FLASH_HANDOFF.md contains a ready-to-paste prompt. DEMO_QUICK_SCRIPT.md remains a useful recording sequence; match its wording to the current screen labels and describe your actual contribution.

The original student contribution ledger remains in CONTRIBUTIONS.md. This design pass is recorded as AI assistance; it does not establish independent student implementation. Check the live competition portal or your organizer for your submission requirements and deadline.
