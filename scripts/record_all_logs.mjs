/**
 * DimmingLab - Automated Verification Log Recorder
 * Runs all test and verification commands, verifies zero exit codes,
 * and writes clean UTF-8 log records to logs/.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

const commands = [
  {
    name: 'Unit Tests',
    cmd: 'npm.cmd test -- --run',
    log: 'logs/unit_tests.log',
  },
  {
    name: 'TypeScript Typecheck',
    cmd: 'node ./node_modules/typescript/bin/tsc --noEmit',
    log: 'logs/typecheck.log',
  },
  {
    name: 'Production Build',
    cmd: 'npm.cmd run build',
    log: 'logs/build.log',
  },
  {
    name: 'Playwright E2E Browser Tests',
    cmd: 'node scripts/test_e2e_browser.mjs',
    log: 'logs/e2e_browser.log',
  },
  {
    name: 'Offline Reload & Service Worker Verification',
    cmd: 'node scripts/test_offline_reload.mjs',
    log: 'logs/offline_reload.log',
  },
];

for (const { name, cmd, log } of commands) {
  console.log(`Running: ${name} (${cmd})...`);
  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    writeFileSync(log, output, 'utf-8');
    console.log(`  -> SUCCESS: Written to ${log}`);
  } catch (err) {
    const combined = (err.stdout || '') + '\n' + (err.stderr || '');
    writeFileSync(log, combined, 'utf-8');
    console.error(`  -> FAILED: ${name}`);
    console.error(combined);
    process.exit(1);
  }
}

console.log('All verification commands executed and logged successfully!');
