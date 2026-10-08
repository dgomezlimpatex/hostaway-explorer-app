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
      const bag = (taskId, long) => ({taskId, propertyCode: taskId, textiles: long ? {bathMats:2,towelsSmall:4,pillowCases:4,sheets:9,sheetsSmall:2,sheetsSuite:1,towelsLarge:4} : {sheets:1}, amenities: {trashSacks100L:2}, stockConsumables: long ? names.map(name=>({name,quantity:1})) : [], bagStatus:{status:'pending'}, deliveryTracking:{collectionStatus:'pending',deliveryStatus:'pending'}});
      const bags = [bag('LONG',true), bag('SHORT',false), bag('NEXT',true)];
      const recordedIssue={...bag('ISSUE',false),bagStatus:{status:'issue'}};
      for (const item of bags) item.textiles = {bathMats:0,towelsSmall:0,pillowCases:0,sheets:0,sheetsSmall:0,sheetsSuite:0,towelsLarge:0,...item.textiles};
      window.mockWorkflow = async (name, body) => {
        if(name === 'laundry-route-access') return {success:true,required:true,worker};
        if(body.action === 'prepare' || body.action === 'issue') bags.find(b => b.taskId === body.taskId).bagStatus.status = body.action === 'prepare' ? 'prepared' : 'issue';
        const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
        return {workflowVersion:'route_v2',route:{deliveryDate:`${parts.year}-${parts.month}-${parts.day}`,nextRouteName:'Siguiente',nextDeliveryDate:'2026-09-10'},currentRouteBags:[...bags.slice(0,2),recordedIssue],urgentBags:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending'),nextRouteBags:bags.slice(2),blockingStep:'prepare_next',stats:{urgentPending:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending').length,nextTotal:1}};
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const prepare = page.getByRole('button', {name:'Bolsa preparada',exact:true});
    const issue = page.getByRole('button', {name:'Marcar incidencia',exact:true});
    await prepare.waitFor();
    await page.getByRole('heading',{name:'LONG',exact:true}).waitFor();
    await page.getByText(/^Sacos de basura 100l$/i).waitFor();
    const sack=page.getByText(/^Sacos de basura 100l$/i);
    assert.equal(await sack.count(),1);
    assert.ok((await page.locator('[data-bag-contents]').innerText()).includes('Bolsa de basura 30l'));
    const box=await sack.boundingBox();assert.ok(box && box.width>0 && box.y>=0 && box.y+box.height<viewport.height);
    await page.screenshot({path:`${process.env.TEMP}/trash-sacks-${viewport.width}-${viewport.height}.png`});
    await prepare.click();
    await page.getByRole('heading',{name:'SHORT',exact:true}).waitFor();
    await page.getByText(/^Sacos de basura 100l$/i).waitFor();
    assert.equal(await page.locator('[data-bag-progress]').innerText(),'1 de 3 bolsas preparadas');
    await issue.click();
    await page.getByRole('combobox').selectOption('Falta de stock de ropa');
    await page.getByRole('button',{name:'Guardar incidencia'}).click();
    await page.getByRole('heading',{name:'NEXT',exact:true}).waitFor();
    await page.getByText(/^Sacos de basura 100l$/i).waitFor();
    assert.deepEqual(errors,[]);
    console.log(`PASS sacks browser ${viewport.width}x${viewport.height}: sacks + small bags, prepare, issue, next route`);
    await page.close();
  }
} finally { await browser.close(); }
