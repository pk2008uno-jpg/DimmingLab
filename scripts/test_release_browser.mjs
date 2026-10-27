// Portable production smoke test. Requires the project's Playwright package and a local browser.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=4175, origin=`http://localhost:${port}`;
const server=spawn(process.execPath,['scripts/serve_release.mjs'],{cwd:root,env:{...process.env,DIMMINGLAB_PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser;
const errors=[];
try {
  let started=false;
  for(let i=0;i<60;i++){try{const r=await fetch(origin);if(r.ok){started=true;break;}}catch{}await delay(100);}
  assert.ok(started,'The production server did not start.');
  try{browser=await chromium.launch({channel:'chrome',headless:true});}
  catch{browser=await chromium.launch({headless:true});}
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.investigation-card').count(),4);
  await page.waitForFunction(()=>document.body.textContent.includes('Offline Classroom Pack Ready'),null,{timeout:20000});
  console.log('PASS: library and exact offline pack readiness');

  await page.locator('.investigation-card').nth(0).locator('button').first().click();
  const conclusion='Release check: retain the very latest answer.';
  await page.locator('#input-conclusion').fill(conclusion);
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await page.locator('.investigation-card').nth(0).getByRole('button',{name:'Resume Saved Investigation'}).click();
  assert.equal(await page.locator('#input-conclusion').inputValue(),conclusion);
  console.log('PASS: immediate navigation flush and saved answer restore');
  await page.getByRole('button',{name:'Library',exact:true}).click();

  await page.getByRole('button',{name:'Import Light Curve (CSV)'}).click();
  let csv='time,flux\n';
  for(let i=0;i<=1000;i++){const time=i*.02;const center=.5+4*Math.round((time-.5)/4);csv+=`${time},${Math.abs(time-center)<=.0625?1008:1024}\n`;}
  await page.locator('input[type=file][accept*=".csv"]').setInputFiles({name:'release_control.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.locator('#csv-time-format').selectOption('BTJD');
  await page.locator('#csv-data-kind').selectOption('synthetic');
  await page.getByRole('button',{name:'Open in Workspace'}).click();
  await page.locator('#input-period').fill('4');
  await page.locator('#input-epoch').fill('0.5');
  await page.locator('#input-duration').fill('3');
  await page.locator('#input-conclusion').fill('The same 1.5625 percent depth must appear in the report.');
  await page.getByRole('button',{name:'Generate Evidence Report'}).click();
  assert.match(await page.locator('.printable-sheet').innerText(),/1\.5625/);
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download Project JSON'}).click();
  const download=await downloadEvent;
  const stream=await download.createReadStream();const buffers=[];
  for await(const part of stream)buffers.push(part);
  const projectBuffer=Buffer.concat(buffers),project=JSON.parse(projectBuffer.toString());
  assert.equal(project.datasetMetadata.timeFormat,'BTJD');assert.equal(project.datasetMetadata.kind,'synthetic');
  assert.equal(project.customPoints.length,1001);
  console.log('PASS: custom data, consistent report units and provenance export');

  await context.setOffline(true);
  await page.reload({waitUntil:'networkidle'});
  await page.locator('input[type=file][accept*=".json"]').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:projectBuffer});
  assert.equal(await page.locator('#input-conclusion').inputValue(),project.learnerConclusion);
  await page.getByRole('button',{name:'Generate Evidence Report'}).click();
  assert.match(await page.locator('.printable-sheet').innerText(),/1\.5625/);
  console.log('PASS: offline hard reload, JSON reopen and regenerated report');
  await page.getByRole('button',{name:'Back to Workspace'}).click();
  await page.getByRole('button',{name:'Library',exact:true}).click();
  await page.locator('.investigation-card').nth(3).locator('button').first().click();
  await page.getByRole('button',{name:'Search for Repeating Dips'}).click();
  await page.getByRole('button',{name:'Apply',exact:true}).first().click({timeout:20000});
  assert.ok(Number(await page.locator('#input-period').inputValue())>0);
  console.log('PASS: offline worker search and candidate application');

  for(const width of [375,768,1280]){
    await page.setViewportSize({width,height:850});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`Page overflow at ${width}px`);
    const contained=await page.locator('.parameter-controls-card input').evaluateAll(inputs=>inputs.every(input=>{
      const card=input.closest('.parameter-controls-card').getBoundingClientRect(),rect=input.getBoundingClientRect();
      return rect.left>=card.left-1&&rect.right<=card.right+1;
    }));
    assert.ok(contained,`Parameter inputs escape their card at ${width}px`);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: responsive containment and no browser page errors');
  console.log('RELEASE BROWSER CHECKS PASSED');
}finally{if(browser)await browser.close();server.kill();}
