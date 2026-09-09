import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Render the real component with deterministic local data; never call production.
const bundle = await build({
  stdin: { contents: `import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
    import {LaundryRouteV2View} from './src/components/laundry-share/LaundryRouteV2View';
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><LaundryRouteV2View token="test" /></QueryClientProvider>);`,
    resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'local-workflow', setup(builder) {
    builder.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'mock', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = {functions:{invoke: async (name, options) => {const result = await window.mockWorkflow(name, options.body); return {data: name === "laundry-route-workflow" ? {success:true,workflow:result} : result, error:null};}}};' }));
  } }],
});
const css = readdirSync('dist/assets').filter(name => name.endsWith('.css')).map(name => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
try {
  for (const viewport of [{width:390,height:844}, {width:390,height:680}, {width:360,height:640}, {width:844,height:390}]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.route('http://laundry.test/', route => route.fulfill({contentType:'text/html',body:'<html><head></head><body><div id="root"></div></body></html>'}));
    await page.goto('http://laundry.test/');
    await page.addStyleTag({ content: css });
    await page.evaluate(() => {
      const worker={workerName:'VICENTE MORENO LOUREDA',routeWorkerId:'worker',cleanerId:'cleaner',sedeId:'sede'};
      localStorage.setItem('laundry-route-access:test',JSON.stringify({worker,sessionToken:'session',expiresAt:'2099-01-01T00:00:00Z'}));
      const names=['Bolsa de basura 30L','Paño de cocina','Amenitie de alimentación','Amenities de baño','Amenitie de cocina','Papel higiénico','Papel de cocina','Otros consumibles'];
      const bag = (taskId, long) => ({taskId, propertyCode: taskId, textiles: long ? {bathMats:2,towelsSmall:4,pillowCases:4,sheets:9,sheetsSmall:2,sheetsSuite:1,towelsLarge:4} : {sheets:1}, amenities: {}, stockConsumables: long ? names.map(name=>({name,quantity:1})) : [], bagStatus:{status:'pending'}, deliveryTracking:{collectionStatus:'pending',deliveryStatus:'pending'}});
      const bags = [bag('LONG',true), bag('SHORT',false), bag('NEXT',true)];
      const recordedIssue={...bag('ISSUE',false),bagStatus:{status:'issue'}};
      for (const item of bags) item.textiles = {bathMats:0,towelsSmall:0,pillowCases:0,sheets:0,sheetsSmall:0,sheetsSuite:0,towelsLarge:0,...item.textiles};
      window.mockWorkflow = async (name, body) => {
        if(name === 'laundry-route-access') return {success:true,required:true,worker};
        if(body.action === 'prepare' || body.action === 'issue') bags.find(b => b.taskId === body.taskId).bagStatus.status = body.action === 'prepare' ? 'prepared' : 'issue';
        return {workflowVersion:'route_v2',route:{nextRouteName:'Siguiente',nextDeliveryDate:'2026-09-10'},currentRouteBags:[...bags.slice(0,2),recordedIssue],urgentBags:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending'),nextRouteBags:bags.slice(2),blockingStep:'prepare_next',stats:{urgentPending:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending').length,nextTotal:1}};
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const prepare = page.getByRole('button', {name:'Bolsa preparada',exact:true});
    const issue = page.getByRole('button', {name:'Marcar incidencia',exact:true});
    await prepare.waitFor();
    const positions = async () => [await prepare.boundingBox(), await issue.boundingBox()];
    const initial = await positions();
    const contentBefore = await page.locator('[data-bag-contents]').boundingBox();
    const dockBefore = await page.locator('[data-laundry-actions]').boundingBox();
    assert.ok(Math.abs(contentBefore.y + contentBefore.height - (dockBefore.y - 12)) < 2, 'List must fill the available height');
    assert.equal(await page.locator('[data-laundry-scroll]').evaluate(el => getComputedStyle(el).overflowY), 'clip');
    const longFont = await page.locator('[data-bag-contents]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(await page.locator('[data-bag-contents]').evaluate(container => Array.from(container.querySelectorAll('[data-bag-item]')).every(row => Array.from(row.children).every(child => child.scrollHeight <= row.clientHeight - 4 && child.scrollWidth <= child.clientWidth + 1))), 'Every label and quantity must fit without clipping');
    assert.ok(initial[1].y + initial[1].height <= viewport.height);
    assert.equal(await page.locator('[data-bag-progress]').innerText(),'0 de 3 bolsas preparadas','Incidents are not prepared bags');
    if(viewport.height>=640) {
      const content=await page.locator('[data-bag-contents]').boundingBox();
      const dock=await page.locator('[data-laundry-actions]').boundingBox();
      assert.ok(content.y+content.height<=dock.y,`All 15 items must fit above the buttons at ${viewport.width}x${viewport.height}`);
      assert.equal(await page.locator('[data-laundry-scroll]').evaluate(el=>el.scrollHeight>el.clientHeight),false,'No scrolling for the full bag');
      await page.screenshot({path:`${process.env.TEMP}/laundry-compact-${viewport.width}-${viewport.height}.png`});
    }
    await page.locator('[data-laundry-scroll]').evaluate(el => {el.scrollTop = el.scrollHeight;});
    await page.mouse.move(150,200);
    await page.mouse.wheel(0,600);
    assert.equal(await page.locator('[data-laundry-scroll]').evaluate(el => el.scrollTop),0,'Scrolling is disabled');
    assert.equal(await page.evaluate(()=>window.scrollY),0);
    assert.deepEqual(await positions(), initial, 'Scrolling must not move either action');
    await prepare.click();
    await page.getByRole('heading',{name:'SHORT',exact:true}).waitFor();
    const shortFont = await page.locator('[data-bag-contents]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(shortFont >= longFont, 'Short bags must expand their text');
    assert.equal(await page.locator('[data-bag-progress]').innerText(),'1 de 3 bolsas preparadas');
    assert.equal(await page.locator('[data-laundry-scroll]').evaluate(el => el.scrollTop), 0);
    assert.deepEqual(await positions(), initial, 'Short bags must keep both actions in place');
    await issue.click();
    await page.getByRole('combobox').selectOption('Bolsa dañada');
    await page.getByRole('button',{name:'Guardar incidencia'}).click();
    await page.getByRole('heading',{name:'NEXT',exact:true}).waitFor();
    assert.equal(await page.locator('[data-bag-progress]').innerText(),'0 de 1 bolsas preparadas');
    if(viewport.height>=640) {
      const content=await page.locator('[data-bag-contents]').boundingBox();
      const dock=await page.locator('[data-laundry-actions]').boundingBox();
      assert.ok(content.y+content.height<=dock.y,'Next-route content must also fit above the dock');
    }
    assert.deepEqual(await positions(), initial, 'Next-route actions must keep the same positions');
    assert.deepEqual(errors, []);
    await page.screenshot({path:`${process.env.TEMP}/laundry-fixed-${viewport.width}.png`});
    console.log(`PASS ${viewport.width}x${viewport.height}: scroll, long/short/next bag, incident, stable buttons`);
    await page.close();
  }
} finally { await browser.close(); }
