import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

// Real React view, with an in-memory workflow and every network request blocked.
const bundle = await build({
  stdin: { contents: `import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
    import {LaundryRouteV2View} from './src/components/laundry-share/LaundryRouteV2View';
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><LaundryRouteV2View token="test" /></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'local-workflow', setup(builder) {
    builder.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'mock', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const supabase = {functions:{invoke: async (name, options) => {const result = await window.mockWorkflow(name, options.body); return {data: name === "laundry-route-workflow" ? {success:true,workflow:result} : result, error:null};}}};' }));
  } }],
});
const css = readdirSync('dist/assets').filter(name => name.endsWith('.css')).map(name => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1100, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === 'http://laundry.test/'
      ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort());
    await page.goto('http://laundry.test/');
    await page.addStyleTag({ content: css });
    await page.evaluate(() => {
      const worker = { workerName: 'Equipo de prueba', routeWorkerId: 'worker', cleanerId: 'cleaner', sedeId: 'sede' };
      localStorage.setItem('laundry-route-access:test', JSON.stringify({ worker, sessionToken: 'session', expiresAt: '2099-01-01T00:00:00Z' }));
      const bag = taskId => ({ taskId, propertyCode: taskId, propertyName: taskId, date: '2026-10-09', textiles: { sheets: 1 }, amenities: {}, stockConsumables: [], bagStatus: { status: 'pending' }, deliveryTracking: { collectionStatus: 'pending', deliveryStatus: 'pending' } });
      const current = [bag('A1'), bag('A2')], next = [bag('B1'), bag('B2'), bag('B3')];
      window.calls = [];
      window.mockWorkflow = async (name, body) => {
        if (name === 'laundry-route-access') return { success: true, required: true, worker };
        if (body.action === 'prepare') {
          window.calls.push({ taskId: body.taskId, time: performance.now() });
          if (window.failNext) { window.failNext = false; throw new Error('Fallo local de prueba'); }
          if (window.holdNext) { window.holdNext = false; await new Promise(resolve => { window.releaseSave = resolve; }); }
          [...current, ...next].find(item => item.taskId === body.taskId).bagStatus.status = 'prepared';
        }
        return structuredClone({ workflowVersion: 'route_v2', route: { deliveryDate: '2026-10-09', nextDeliveryDate: '2026-10-10', nextRouteName: 'Siguiente' }, currentRouteBags: current, urgentBags: current.filter(item => item.bagStatus.status === 'pending'), nextRouteBags: next, blockingStep: 'prepare_next', stats: { nextTotal: next.length } });
      };
    });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const ready = () => page.getByRole('button', { name: 'Bolsa preparada', exact: true });
    const waiting = () => page.getByRole('button', { name: /^Espera \d s/ });
    await ready().waitFor();
    // Multiple same-event-loop activations exercise the synchronous guard too.
    await ready().evaluate(button => { button.click(); button.click(); button.click(); });
    await page.getByRole('heading', { name: 'A2', exact: true }).waitFor();
    await expect(waiting()).toBeDisabled();
    await waiting().evaluate(button => button.click());
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    await ready().waitFor();
    await ready().click();
    await page.getByRole('heading', { name: 'B1', exact: true }).waitFor();
    await expect(waiting()).toBeDisabled();
    // Cooldown survives the phase change and switching to the building list.
    await page.getByRole('button', { name: 'Ver bolsas' }).click();
    await page.locator('details').evaluateAll(items => items.forEach(item => { item.open = true; }));
    await expect(waiting().first()).toBeDisabled();
    await waiting().first().evaluate(button => button.click());
    assert.equal(await page.evaluate(() => window.calls.length), 2);
    const listed = () => page.getByRole('button', { name: 'Marcar bolsa preparada', exact: true });
    await listed().first().waitFor();
    await page.evaluate(() => { window.holdNext = true; });
    await listed().first().click();
    await expect(page.getByRole('button', { name: 'Guardando…', exact: true }).first()).toBeDisabled({ timeout: 5000 });
    assert.equal(await page.evaluate(() => window.calls.length), 3);
    await page.evaluate(() => window.releaseSave());
    await expect(listed().first()).toBeEnabled();
    // A failure before the 320ms animation must leave the bag pending.
    await page.getByRole('button', { name: 'Ver bolsas' }).click();
    await page.evaluate(() => { window.failNext = true; });
    await ready().click();
    await expect(waiting()).toBeDisabled();
    await ready().waitFor();
    await expect(page.getByRole('heading', { name: 'B2', exact: true })).toBeVisible();
    await ready().click();
    await page.getByRole('heading', { name: 'B3', exact: true }).waitFor();
    const calls = await page.evaluate(() => window.calls);
    assert.deepEqual(calls.map(item => item.taskId), ['A1', 'A2', 'B1', 'B2', 'B2']);
    for (let i = 1; i < calls.length; i++) assert.ok(calls[i].time - calls[i - 1].time >= 2990);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(`PASS ${viewport.width}: repeated clicks, cross-bag/phase/view cooldown, slow save, fast failure and retry`);
    await page.close();
  }
} finally { await browser.close(); }
