# Live browser design verification

Context date: 2026-10-26 (America/New_York). Browser: managed Chrome. Target: Vite development preview at http://terminal.local:4173/. These are observed interactive checks, not the output of the portable production browser test runner.

- The library rendered the new sidebar, hero, real light-curve previews, four case cards and working observed-data filter.
- Case A loaded 1,452 measurements. The summary showed period 3.5225 days, depth 0.7190%, nine predicted windows with data out of ten, and nine detected dimming events.
- Entered a distinctive conclusion and immediately navigated to Library. Resuming Case A restored the exact latest text.
- Case A's generated report retained the conclusion and matched the 0.7190% depth.
- Downloaded project JSON, opened it through the file chooser, and confirmed the exact conclusion was restored.
- Imported examples/release_control.csv with Relative days and Synthetic simulation. Set period 4 days, epoch 0.5 days and duration 3 hours. The report showed 1.5625% (15,625 ppm), 1,001 measurements and the supplied time/data-origin metadata.
- Case D at defaults showed six predicted windows with data out of six; its expanded coverage check showed six adequate, zero partial and zero unobserved windows.
- The Case D worker search returned four candidates. Applying the first changed the trial period to 4.108392 days and closed the results panel.
- Light and dark appearances rendered correctly in the workspace. Theme changes persisted through later app reloads.
- A QA-only page embedded the real app at 375px and 768px iframe widths. Both library documents had equal scrollWidth and clientWidth (360 and 753 pixels respectively after internal scrollbars), so neither had horizontal overflow.
- At the 375px phone viewport, all three numeric parameter inputs were inside the panel bounds. The phone evidence report also had equal scrollWidth and clientWidth (360 pixels).
- In CSV import, Shift+Tab from the close button wrapped to Cancel; Tab from Cancel wrapped to the close button. Escape dismissed the dialog and restored focus to the Import Light Curve trigger.
- The teacher guide opened and navigation returned to the library.

The browser produced extension metadata errors from its chrome-extension content script; these were separate from the app. No failure occurred in the app flows listed above. This was not a comprehensive browser console/pageerror recording.

Not verified here: real production service-worker installation, network-off hard reload, offline worker execution, OS print dialogs, every browser or assistive technology. The preview origin did not prepare an offline pack and truthfully displayed Online session. Run the final localhost checks described in 00_START_HERE.md. The independent packaged-resource/service-worker API harness is recorded separately and must not be called a live-browser offline pass.

The QA-only responsive page is omitted from the deliverable. Current screenshots were used for visual review and are not packaged; supplied older screenshots remain historical artifacts.
