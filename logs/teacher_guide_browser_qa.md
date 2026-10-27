# Teacher guide browser check

Verified in the interactive development preview on 26 October 2026.

- Desktop guide visually inspected in light and dark themes.
- The four native disclosure rows begin collapsed and each reveals its own observation, interpretation and classroom question.
- Enter opens the first disclosure and Space closes it.
- Key terms link scrolls to the terms section; Back to library returns to the investigation library.
- At a 375px iframe viewport, the document client and scroll widths were both 360px (excluding the vertical scrollbar).
- At a 768px iframe viewport, the document client and scroll widths were both 753px.
- The same containment measurements passed with case notes expanded in both viewports.
- App console review found no app-origin warnings or errors; browser extension metadata errors were excluded.

The temporary layout-check page was removed before packaging. Existing docs/screenshots images are historical. The production HTTP/service-worker harness passed separately. The operating-system print dialog, destructive clear-data operation and real-browser production offline reload were not exercised in this pass.
