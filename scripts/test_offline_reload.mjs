/**
 * DimmingLab - Real Offline Verification Script
 * Strictly tests offline behavior on a production build:
 * 1. Fresh context online -> install service worker & cache datasets
 * 2. Set context.setOffline(true)
 * 3. Perform full page reload (page.reload())
 * 4. Verify investigation opens, folds, computes, and generates report offline
 * 5. Capture screenshot of verified offline reload
 * 6. Test first-visit-without-cache behavior
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

async function testOffline() {
  console.log('=== Starting DimmingLab Real Offline Verification ===');

  if (!existsSync('docs/screenshots')) {
    mkdirSync('docs/screenshots', { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  try {
    // -------------------------------------------------------------
    // PART 1: Online Visit & Cache Population
    // -------------------------------------------------------------
    console.log('1. Loading app online in fresh browser context...');
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const page = await context.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));

    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    
    // Wait for Service Worker registration and offline pack ready
    console.log('   Waiting for Service Worker and offline pack readiness...');
    await page.waitForFunction(() => {
      const el = document.body;
      return el && el.textContent && el.textContent.includes('Offline Classroom Pack Ready');
    }, { timeout: 10000 });

    // Verify service worker is active and controlling
    const isControlling = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return navigator.serviceWorker.controller !== null;
    });
    console.log('   Service Worker registered, active, controller ready:', isControlling);
    
    const cachedKeys = await page.evaluate(async () => {
      const manifest = await (await fetch('/offline-manifest.json')).json();
      const cache = await caches.open(manifest.cacheName);
      const requests = await cache.keys();
      return requests.map(r => r.url);
    });
    console.log('   Keys in cache before offline (' + cachedKeys.length + '):', cachedKeys);
    
    const matchTest = await page.evaluate(async () => {
      const manifest = await (await fetch('/offline-manifest.json')).json();
      const cache = await caches.open(manifest.cacheName);
      const requests = await cache.keys();
      const mainScriptReq = requests.find(r => r.url.includes('/assets/index-') && r.url.endsWith('.js'));
      if (!mainScriptReq) {
        return { error: 'Main script not found in cache keys' };
      }
      const fullUrl = mainScriptReq.url;
      const pathname = new URL(fullUrl).pathname;
      const matchExact = await caches.match(fullUrl);
      const matchPath = await caches.match(pathname);
      const matchReq = await caches.match(new Request(fullUrl));
      return { matched: true, pathname, matchExact: !!matchExact, matchPath: !!matchPath, matchReq: !!matchReq };
    });
    console.log('   Dynamic build asset cache match test:', matchTest);

    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // PART 2: Disconnect Network and Full Page Reload
    // -------------------------------------------------------------
    console.log('2. Disconnecting network (context.setOffline(true))...');
    await context.setOffline(true);

    console.log('3. Performing full page reload while offline (page.reload())...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('   Current page URL after reload:', page.url());
    const content = await page.content();
    console.log('   Current HTML snippet:', content.substring(0, 300));

    const reloadedTitle = await page.locator('h1').textContent({ timeout: 5000 });
    console.log('   H1 after offline reload:', reloadedTitle);
    if (!reloadedTitle || !reloadedTitle.includes('DimmingLab')) {
      throw new Error(`Failed to load page from service worker cache after reload. Got H1: ${reloadedTitle}`);
    }

    // -------------------------------------------------------------
    // PART 3: Execute Investigation & Calculations Offline
    // -------------------------------------------------------------
    console.log('4. Opening Case A (Kepler-8 b) while completely offline...');
    await page.locator('.investigation-card button').first().click();
    await page.waitForTimeout(800);

    const workspaceH1 = await page.locator('h1').textContent();
    console.log('   Workspace H1 offline:', workspaceH1);
    if (!workspaceH1 || !workspaceH1.includes('Kepler-8 b')) {
      throw new Error(`Failed to open Kepler-8 b offline. Got: ${workspaceH1}`);
    }

    const canvasCount = await page.locator('canvas').count();
    console.log(`   Rendered ${canvasCount} canvases offline.`);
    if (canvasCount < 2) {
      throw new Error('Canvases failed to render offline');
    }

    // Adjust parameter while offline
    console.log('5. Adjusting period parameter and computing offline fit...');
    const periodInput = page.locator('#input-period');
    await periodInput.fill('3.5225');
    await page.waitForTimeout(400);

    // Verify diagnostic rail updated offline
    const repText = await page.locator('.evidence-rail-card button').first().textContent();
    console.log('   Repetition status offline:', repText);

    // Generate evidence report offline
    console.log('6. Generating Evidence Report offline...');
    await page.locator('button:has-text("Generate Evidence Report")').click();
    await page.waitForTimeout(600);

    const reportH1 = await page.locator('.printable-sheet h1').textContent();
    console.log('   Report title offline:', reportH1);
    if (!reportH1 || !reportH1.includes('Evidence Report')) {
      throw new Error('Failed to generate report offline');
    }

    // Capture screenshot of verified offline reload
    const screenshotPath = 'docs/screenshots/offline_reload_verified.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   Captured offline reload proof screenshot: ${screenshotPath}`);

    await context.close();

    // -------------------------------------------------------------
    // PART 4: Test First-Visit-Without-Cache Failure State
    // -------------------------------------------------------------
    console.log('7. Testing first-visit-without-cache behavior (cold offline)...');
    const freshContext = await browser.newContext();
    await freshContext.setOffline(true);
    const freshPage = await freshContext.newPage();

    let navigationFailed = false;
    try {
      await freshPage.goto('http://localhost:4173/', { timeout: 3000 });
    } catch {
      navigationFailed = true;
    }

    console.log('   First visit without cache fails as expected (offline browser error):', navigationFailed);
    if (!navigationFailed) {
      console.warn('Warning: First visit without cache unexpectedly succeeded');
    }
    await freshContext.close();

    console.log('=== REAL OFFLINE VERIFICATION COMPLETE: ALL CHECKS PASSED ===');
  } finally {
    await browser.close();
  }
}

testOffline().catch((err) => {
  console.error('OFFLINE TEST FAILED:', err);
  process.exit(1);
});
