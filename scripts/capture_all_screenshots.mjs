/**
 * DimmingLab - Comprehensive Screenshot Capture Script
 * Captures all critical review screens:
 * 1. Library View
 * 2. CSV Import Modal
 * 3. Teacher Guide View (Answer Key & Lesson Plan)
 * 4. Workspace View (Kepler-8 b folded light curve)
 * 5. Printable Evidence Report
 * 6. Diagnostics Rail (Case B - Eclipsing Binary showing alternating depths)
 * 7. Diagnostics Rail (Case C - Instrument Dropout showing isolated event)
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

async function captureScreenshots() {
  console.log('=== Capturing Review Screenshots ===');

  if (!existsSync('docs/screenshots')) {
    mkdirSync('docs/screenshots', { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  // 1. Library View
  console.log('1. Capturing Library View...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/01_library_view.png' });

  // 2. CSV Import Modal
  console.log('2. Capturing CSV Import Modal...');
  await page.locator('button:has-text("Import Light Curve (CSV)")').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/02_csv_import_modal.png' });
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(300);

  // 3. Teacher Guide View
  console.log('3. Capturing Teacher Guide View...');
  await page.locator('button:has-text("Teacher Guide & Sources")').click();
  await page.waitForTimeout(500);
  // Reveal Kepler-8 b teacher answer key
  const revealBtn = page.locator('button:has-text("Reveal Discussion & Analysis")').first();
  if (await revealBtn.count() > 0) {
    await revealBtn.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'docs/screenshots/03_teacher_guide.png' });
  await page.locator('button:has-text("Back to Library")').click();
  await page.waitForTimeout(400);

  // 4. Workspace View: Case A (Kepler-8 b)
  console.log('4. Capturing Case A Kepler-8 b Workspace...');
  await page.locator('.investigation-card button').first().click();
  await page.waitForTimeout(600);
  const periodInput = page.locator('#input-period');
  await periodInput.fill('3.5225');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/screenshots/04_workspace_kepler8b.png' });

  // 5. Case A Evidence Report Printable Sheet
  console.log('5. Capturing Printable Evidence Report...');
  await page.locator('button:has-text("Generate Evidence Report")').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/screenshots/05_evidence_report.png' });
  await page.locator('button:has-text("Back to Workspace")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Library")').click();
  await page.waitForTimeout(400);

  // 6. Case B (Eclipsing Binary) Diagnostics
  console.log('6. Capturing Case B Eclipsing Binary Diagnostics...');
  await page.locator('.investigation-card:has-text("The Convincing Impostor") button').first().click();
  await page.waitForTimeout(600);
  await page.locator('#input-period').fill('1.76');
  await page.waitForTimeout(500);
  // Expand Alternating Depths card
  const altCard = page.locator('button:has-text("Alternating Eclipse Depths")');
  if (await altCard.count() > 0) {
    await altCard.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'docs/screenshots/06_case_b_eclipsing_binary.png' });
  await page.locator('button:has-text("Library")').click();
  await page.waitForTimeout(400);

  // 7. Case C (Instrument Dropout) Diagnostics
  console.log('7. Capturing Case C Instrument Dropout Diagnostics...');
  await page.locator('.investigation-card:has-text("The Gap Trap") button').first().click();
  await page.waitForTimeout(600);
  await page.locator('#input-period').fill('4.00');
  await page.waitForTimeout(500);
  // Expand Repetition card
  const repCard = page.locator('button:has-text("Repetition Assessment")');
  if (await repCard.count() > 0) {
    await repCard.click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: 'docs/screenshots/07_case_c_instrument_dropout.png' });

  await browser.close();
  console.log('=== All Screenshots Successfully Captured ===');
}

captureScreenshots().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
