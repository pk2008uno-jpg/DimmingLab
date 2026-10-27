# Teacher guide update

The guide is now a reading page with timed lesson notes, a short preparation sidebar, case-specific discussions behind expandable rows, a compact glossary, and the original data source. Repeated cards, blue glossary labels, slogans and promotional headings were replaced with restrained typography and ordinary classroom language. The print button uses the browser print dialog; expand any case notes you want included before printing.

## Run

Extract the entire ZIP into a new folder. Close the older DimmingLab preview terminal, then double-click Start_DimmingLab.cmd. The ready-to-run dist build is included; no npm installation is needed to open it.

In Anaconda PowerShell, open the extracted folder and run:

```powershell
node scripts/serve_release.mjs
```

Open http://localhost:4173 in a fresh Incognito window.

## Checks

78 tests pass across 11 suites. TypeScript and the production build pass. All packaged build resources pass the production HTTP/service-worker API harness. Browser checks covered guide navigation, all four note reveals, Enter/Space activation, both themes, and phone/tablet containment. Full details and scoped limits are in RELEASE_VERIFICATION.json and logs/teacher_guide_browser_qa.md.

The four dataset files, scientific engine and original FITS file match the supplied archive byte for byte. Existing screenshots and older verification sections describe earlier passes.
