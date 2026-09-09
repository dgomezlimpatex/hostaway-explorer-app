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
  for (const viewport of [{width:390,height:844}, {width:360,height:640}, {width:844,height:390}]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.setContent('<html><head></head><body><div id="root"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.evaluate(() => {
      const bag = (taskId, long) => ({taskId, propertyCode: taskId, textiles: long ? {bathMats:2,towelsSmall:4,pillowCases:4,sheets:9,towelsLarge:4} : {sheets:1}, amenities: {}, stockConsumables: long ? Array.from({length:18}, (_, i) => ({name:`Amenitie de alimentación ${i}`, quantity:1})) : [], bagStatus:{status:'pending'}, deliveryTracking:{collectionStatus:'pending',deliveryStatus:'pending'}});
      const bags = [bag('LONG',true), bag('SHORT',false), bag('NEXT',true)];
      for (const item of bags) item.textiles = {bathMats:0,towelsSmall:0,pillowCases:0,sheets:0,sheetsSmall:0,sheetsSuite:0,towelsLarge:0,...item.textiles};
      window.mockWorkflow = async (name, body) => {
        if(name === 'laundry-route-access') return {success:true,required:false};
        if(body.action === 'prepare' || body.action === 'issue') bags.find(b => b.taskId === body.taskId).bagStatus.status = body.action === 'prepare' ? 'prepared' : 'issue';
        return {workflowVersion:'route_v2',route:{nextRouteName:'Siguiente',nextDeliveryDate:'2026-09-10'},currentRouteBags:bags.slice(0,2),urgentBags:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending'),nextRouteBags:bags.slice(2),blockingStep:'prepare_next',stats:{urgentPending:bags.slice(0,2).filter(b => b.bagStatus.status === 'pending').length,nextTotal:1}};
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const prepare = page.getByRole('button', {name:'Bolsa preparada',exact:true});
    const issue = page.getByRole('button', {name:'Marcar incidencia',exact:true});
    await prepare.waitFor();
    const positions = async () => [await prepare.boundingBox(), await issue.boundingBox()];
    const initial = await positions();
    assert.ok(initial[1].y + initial[1].height <= viewport.height);
    await page.locator('[data-laundry-scroll]').evaluate(el => {el.scrollTop = el.scrollHeight;});
    assert.deepEqual(await positions(), initial, 'Scrolling must not move either action');
    await prepare.click();
    await page.getByRole('heading',{name:'SHORT',exact:true}).waitFor();
    assert.equal(await page.locator('[data-laundry-scroll]').evaluate(el => el.scrollTop), 0);
    assert.deepEqual(await positions(), initial, 'Short bags must keep both actions in place');
    await issue.click();
    await page.getByRole('combobox').selectOption('Bolsa dañada');
    await page.getByRole('button',{name:'Guardar incidencia'}).click();
    await page.getByRole('heading',{name:'NEXT',exact:true}).waitFor();
    assert.deepEqual(await positions(), initial, 'Next-route actions must keep the same positions');
    assert.deepEqual(errors, []);
    await page.screenshot({path:`${process.env.TEMP}/laundry-fixed-${viewport.width}.png`});
    console.log(`PASS ${viewport.width}x${viewport.height}: scroll, long/short/next bag, incident, stable buttons`);
    await page.close();
  }
} finally { await browser.close(); }
