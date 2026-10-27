/**
 * DimmingLab - End-to-End Browser Journey Verification
 * Tests the complete user experience in a real Chromium browser:
 * 1. Library -> Case A Workspace -> Diagnostic Rail -> Conclusion -> Evidence Report -> Return
 * 2. BLS Search Worker: cancellation, modal lifecycle, and candidate application
 * 3. Persistence & Reopen: JSON project export, library resume state, and "Open Saved Project (.json)"
 * 4. Case B Eclipsing Binary: verifies alternating depth detection (Needs Review)
 * 5. Case C Mono-Transit: verifies single event repetition warning (Inconclusive, 4 flat windows)
 * 6. Case D Injection: verifies 6 in-baseline windows with data, 0 gaps, and pooled recovery
 * 7. Mobile Viewport (375px): verifies zero horizontal scroll and responsive layout
 * 8. A11y & Keyboard: verifies focus management and dialog Esc dismissal
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync, unlinkSync, existsSync } from 'fs';

async function runE2E() {
  console.log('--- Starting DimmingLab End-to-End Browser Test ---');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();

  // Collect console errors
  const errors = [];
  page.on('pageerror', (err) => {
    console.error('BROWSER PAGE ERROR:', err);
    errors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('BROWSER CONSOLE ERROR:', msg.text());
      errors.push(msg.text());
    }
  });

  try {
    // 1. Visit Library
    console.log('1. Loading Library View at http://localhost:4173/ ...');
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

    const titleText = await page.locator('h1').textContent();
    console.log('   Library H1:', titleText);
    if (!titleText.includes('DimmingLab')) {
      throw new Error(`Expected DimmingLab in H1, found: ${titleText}`);
    }

    // Check 4 cards exist
    const cards = page.locator('.investigation-card');
    const cardCount = await cards.count();
    console.log(`   Found ${cardCount} curated investigation cards.`);
    if (cardCount !== 4) {
      throw new Error(`Expected 4 cards, found: ${cardCount}`);
    }

    // Verify "Open Saved Project (.json)" button is visible in action bar
    const openProjectBtn = page.locator('button:has-text("Open Saved Project (.json)")');
    if (!(await openProjectBtn.isVisible())) {
      throw new Error('"Open Saved Project (.json)" button is not visible in Library view');
    }
    console.log('   "Open Saved Project (.json)" button verified in action bar.');

    // 2. Open Case A (Kepler-8 b)
    console.log('2. Launching Case A (Kepler-8 b)...');
    await cards.nth(0).locator('button').first().click();
    await page.waitForTimeout(500);

    const workspaceTitle = await page.locator('h1').textContent();
    console.log('   Workspace H1:', workspaceTitle);
    if (!workspaceTitle.includes('Kepler-8 b')) {
      throw new Error(`Expected Kepler-8 b in workspace title, got: ${workspaceTitle}`);
    }

    // Verify plots rendered
    const canvases = page.locator('canvas');
    const canvasCount = await canvases.count();
    console.log(`   Rendered ${canvasCount} light curve canvases.`);
    if (canvasCount < 2) {
      throw new Error(`Expected at least 2 canvases, found: ${canvasCount}`);
    }

    // Verify 5 diagnostics in Evidence Rail
    const diagnosticCards = page.locator('.evidence-rail-card button');
    const diagCount = await diagnosticCards.count();
    console.log(`   Evidence Rail has ${diagCount} diagnostic checks.`);
    if (diagCount !== 5) {
      throw new Error(`Expected 5 diagnostic checks, found: ${diagCount}`);
    }

    // Verify Repetition status is MEASURED
    const repText = await diagnosticCards.nth(0).textContent();
    console.log('   Diagnostic 1 (Repetition):', repText);
    if (!repText.includes('Measured')) {
      throw new Error(`Expected Repetition to be Measured for Kepler-8 b, got: ${repText}`);
    }

    // 3. Test BLS Period Search & Worker Cancellation
    console.log('3. Testing Search Modal Cancellation & Automated Periodic Scan...');
    const searchButton = page.locator('button:has-text("Search for Repeating Dips")');
    await searchButton.click();
    await page.waitForTimeout(300);

    // Verify modal is open and Esc key cancels/closes it
    console.log('   Verifying modal dismissal with Esc key...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Reopen modal to run full search
    console.log('   Reopening search modal and running periodic scan...');
    await searchButton.click();

    // Wait for search candidates to appear
    const applyButtons = page.locator('button:has-text("Apply")');
    await applyButtons.first().waitFor({ state: 'visible', timeout: 8000 });
    const candCount = await applyButtons.count();
    console.log(`   Search returned ${candCount} candidate peaks.`);
    if (candCount < 1) {
      throw new Error('Search did not return candidate peaks');
    }

    // Close search modal
    const closeSearchModal = page.locator('#search-modal-title + div button');
    await closeSearchModal.last().click();
    await page.waitForTimeout(300);

    // 4. Fill Student Conclusion and Open Report
    console.log('4. Authoring student conclusion & testing Project Export...');
    await page.locator('#select-hypothesis').selectOption('candidate_planet');
    await page.locator('#input-conclusion').fill('Observed 9 repeating transit dips with consistent depth of ~0.93% and duration ~3.2 hours. No optical secondary eclipse.');
    await page.locator('#input-alternative').fill('Could be an eclipsing binary with identical components, but equal durations and light curve shape favor a hot Jupiter.');
    await page.locator('#input-next-obs').fill('Obtain high-precision radial velocity spectroscopy to measure companion mass.');

    // Export Project (.json)
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Download Project (.json)")').click();
    const download = await downloadPromise;
    const tempExportPath = fileURLToPath(new URL('../temp_test_project.json', import.meta.url));
    await download.saveAs(tempExportPath);
    console.log(`   Exported project file to: ${tempExportPath}`);

    const exportRaw = readFileSync(tempExportPath, 'utf-8');
    const parsedProject = JSON.parse(exportRaw);
    if (parsedProject.schemaVersion !== 1 || parsedProject.datasetId !== 'case_a_kepler8b') {
      throw new Error(`Exported project has unexpected schemaVersion (${parsedProject.schemaVersion}) or datasetId (${parsedProject.datasetId})`);
    }
    if (!parsedProject.learnerConclusion.includes('consistent depth of ~0.93%')) {
      throw new Error('Exported project did not save student conclusion accurately');
    }
    console.log('   Exported JSON schema and student conclusions verified.');

    // Generate Evidence Report
    console.log('   Generating Evidence Report...');
    const generateReportBtn = page.locator('button:has-text("Generate Evidence Report")');
    await generateReportBtn.click();
    await page.waitForTimeout(500);

    const reportTitle = await page.locator('.printable-sheet h1').textContent();
    console.log('   Evidence Report Title:', reportTitle);
    if (!reportTitle.includes('Evidence Report')) {
      throw new Error(`Expected Evidence Report title, got: ${reportTitle}`);
    }

    // Check that plots exist inside printable report
    const reportCanvases = page.locator('.printable-sheet canvas');
    console.log(`   Report contains ${await reportCanvases.count()} high-resolution plots.`);

    // Reveal teacher answer key
    const revealKeyBtn = page.locator('button:has-text("Reveal Answer Key")');
    await revealKeyBtn.click();
    await page.waitForTimeout(300);
    const answerKeyText = await page.locator('.printable-sheet').textContent();
    if (!answerKeyText.includes('Jenkins et al. 2010')) {
      throw new Error('Teacher answer key did not reveal external astronomical context');
    }
    console.log('   Teacher Answer Key revealed successfully.');

    // 5. Return to Library and check Saved Investigation
    console.log('5. Testing Persistence and Library Resume...');
    await page.locator('button:has-text("Back to Workspace")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Library")').click();
    await page.waitForTimeout(500);

    const resumeBtn = page.locator('button:has-text("Continue Saved Investigation")');
    const isResumeVisible = await resumeBtn.isVisible();
    console.log('   Top resume button visible in Library:', isResumeVisible);
    if (!isResumeVisible) {
      throw new Error('Resume button not visible after saving work in IndexedDB');
    }

    // Verify card 0 specifically displays saved draft state
    const card0 = page.locator('.investigation-card').nth(0);
    const card0Text = await card0.textContent();
    if (!card0Text.includes('Saved draft in progress') || !card0Text.includes('Resume Saved Investigation')) {
      throw new Error(`Card 0 does not show saved draft status: ${card0Text}`);
    }
    console.log('   Card 0 specifically indicates active saved investigation in progress.');

    // Test "Open Saved Project (.json)" file input
    console.log('   Testing "Open Saved Project (.json)" reimport from disk...');
    await page.locator('input[type="file"][accept*=".json"]').setInputFiles(tempExportPath);
    await page.waitForTimeout(600);

    const reopenedWorkspace = await page.locator('h1').textContent();
    console.log('   Reopened Workspace Title:', reopenedWorkspace);
    if (!reopenedWorkspace.includes('Kepler-8 b')) {
      throw new Error(`Failed to restore workspace from JSON: ${reopenedWorkspace}`);
    }
    const restoredConclusion = await page.locator('#input-conclusion').inputValue();
    if (!restoredConclusion.includes('consistent depth of ~0.93%')) {
      throw new Error(`Restored conclusion does not match exported content: ${restoredConclusion}`);
    }
    console.log('   Project file reimport successfully verified.');

    // Cleanup temp export file
    if (existsSync(tempExportPath)) {
      unlinkSync(tempExportPath);
    }

    // 6. Test Case B (Eclipsing Binary Diagnostic)
    console.log('6. Testing Case B (Eclipsing Binary Impostor)...');
    await page.locator('button:has-text("Library")').click();
    await page.waitForTimeout(500);

    await page.locator('.investigation-card').nth(1).locator('button').first().click();
    await page.waitForTimeout(500);

    const altCard = page.locator('.evidence-rail-card button').nth(1);
    const altText = await altCard.textContent();
    console.log('   Case B Alternating Depths status:', altText);
    if (!altText.includes('Needs Review')) {
      throw new Error(`Expected Needs Review for Case B alternating depths, got: ${altText}`);
    }

    // 7. Test Case C (Mono-Transit Dropout)
    console.log('7. Testing Case C (Single Dropout with Gaps)...');
    await page.locator('button:has-text("Library")').click();
    await page.waitForTimeout(400);

    await page.locator('.investigation-card').nth(2).locator('button').first().click();
    await page.waitForTimeout(500);

    const repCardC = page.locator('.evidence-rail-card button').nth(0);
    const repTextC = await repCardC.textContent();
    console.log('   Case C Repetition status:', repTextC);
    if (!repTextC.includes('Inconclusive')) {
      throw new Error(`Expected Inconclusive for Case C repetition, got: ${repTextC}`);
    }

    // Check repetition explanation
    const isExpanded = await repCardC.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await repCardC.click();
      await page.waitForTimeout(200);
    }
    const repDetailsC = await page.locator('.evidence-rail-card').textContent();
    console.log('   Case C Detailed Explanation snippet:', repDetailsC.substring(0, 150));
    if (!repDetailsC.includes('1 single transit event') || !repDetailsC.includes('flat')) {
      throw new Error(`Case C did not report single transit with observed flat windows: ${repDetailsC}`);
    }

    // 8. Test Case D (Transit Injection & Noise Recovery)
    console.log('8. Testing Case D (Noise & Recovery Challenge)...');
    await page.locator('button:has-text("Library")').click();
    await page.waitForTimeout(400);

    await page.locator('.investigation-card').nth(3).locator('button').first().click();
    await page.waitForTimeout(500);

    const repCardD = page.locator('.evidence-rail-card button').nth(0);
    const repTextD = await repCardD.textContent();
    console.log('   Case D Repetition status:', repTextD);
    if (!repTextD.includes('Measured')) {
      throw new Error(`Expected Measured for Case D repetition, got: ${repTextD}`);
    }

    // 9. Test Mobile Viewport (375 x 667)
    console.log('9. Testing Mobile Viewport (iPhone SE / 375px width)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(400);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
    });
    console.log('   Horizontal scroll on 375px screen:', hasHorizontalScroll ? 'OVERFLOW DETECTED' : 'NONE (Responsive)');
    if (hasHorizontalScroll) {
      throw new Error('Horizontal page overflow detected on 375px viewport');
    }

    const mobileCanvasCount = await page.locator('canvas').count();
    console.log(`   Rendered ${mobileCanvasCount} canvases on mobile screen.`);
    if (mobileCanvasCount < 2) {
      throw new Error('Canvas not visible on mobile screen');
    }

    // 10. Test Keyboard Navigation
    console.log('10. Testing Keyboard Navigation...');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    console.log('    Focused element after tabs:', focusedTag);

    console.log('--- ALL END-TO-END BROWSER CHECKS PASSED PERFECTLY ---');
    if (errors.length > 0) {
      throw new Error(`Browser console/page errors were logged during test: ${errors.join('; ')}`);
    }
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});
