import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
const mocks = {
  '@/contexts/SedeContext': `export const useSede=()=>({activeSede:{id:window.fixtureSede||'demo'}});`,
  '@/hooks/useAuth': `export const useAuth=()=>({user:{id:'demo-user'}});`,
  '@/hooks/useRolePermissions': `export const useRolePermissions=()=>({isAdminOrManager:()=>window.fixtureRole!=='supervisor'});`,
  './provisionalInventoryReads': `export async function readProvisionalInventory(){window.readCount=(window.readCount||0)+1;if(window.failReads) throw Error('Unavailable');return window.fixtureReads;}`,
};
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {ProvisionalInventoryPanel} from './src/features/inventory/ProvisionalInventoryPanel';
const products=[{id:'sheet',name:'Sábanas de prueba',is_active:true,category:{kind:'laundry'}},{id:'soap',name:'Amenities de prueba',is_active:true,category:{kind:'amenity'}}];
window.fixtureReads={movements:[{id:'r',product_id:'sheet',warehouse_id:'central',previous_quantity:100,new_quantity:110,created_at:'2026-10-14T10:00:00Z',reason:'Recepción 2026-10-08 v1 · fixture'},{id:'a',product_id:'soap',warehouse_id:'central',movement_type:'entrada',previous_quantity:0,new_quantity:200,created_at:'2026-10-14T11:00:00Z'}],preparations:[{id:'p',task_key:'task',action:'prepared',happened_at:'2026-10-08T11:00:00Z',bag_items:{textiles:{sheets:15}}}],mappings:[{product_id:'sheet',property_field:'numero_sabanas',multiplier:1,is_active:true}],estimates:[{product_id:'soap',warehouse_id:'central',state:'applied',scheduled_end_at:'2026-10-07T10:00:00Z',quantity:3}]};
function Fixture(){const location=useLocation();return <><ProvisionalInventoryPanel warehouseId='central' products={products} levels={[{product_id:'soap',warehouse_id:'central',current_quantity:7}]} cycleActive={!!window.cycleActive} refreshStock={()=>{window.stockRefreshes=(window.stockRefreshes||0)+1;}}/><output aria-label='Current location'>{location.search}</output></>;}
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const root=createRoot(document.getElementById('root'));window.renderFixture=()=>root.render(<QueryClientProvider client={client}><MemoryRouter key={window.fixtureSede||'demo'} initialEntries={['/inventory?seguimientoDesde=2026-10-08']}><Fixture/></MemoryRouter></QueryClientProvider>);window.renderFixture();
`;
const built = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(b) { b.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'fixture' } : null); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() })); } }] });
assert.ok(!Object.keys(built.metafile.inputs).some(p => p.includes('integrations/supabase')), 'no real backend or session');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, ''), { from: 'src/index.css' });
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
writeFileSync(join(tmpdir(), 'provisional-inventory-fixture.html'), html);
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url() === 'https://inventory.local.test/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
  await page.clock.install({ time: new Date('2026-10-14T18:00:00Z') });
  await page.goto('https://inventory.local.test/');
  await expect(page.getByRole('heading', { name: 'Seguimiento provisional' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Sábanas de prueba 10 15 -5' })).toBeVisible();
  await expect(page.getByText(/no significa que el almacén esté vacío/)).toBeVisible();
  const before = await page.evaluate(() => window.readCount);
  await page.clock.fastForward(61000);
  await expect.poll(() => page.evaluate(() => window.readCount)).toBeGreaterThan(before);
  await page.getByText('Amenities y consumibles · revisar los descuentos existentes', { exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Amenities de prueba' })).toContainText('200');
  await expect(page.getByRole('row').filter({ hasText: 'Amenities de prueba' })).toContainText('7');
  await page.getByLabel('Inicio del seguimiento provisional').fill('2026-10-09');
  await expect(page.getByRole('row', { name: 'Sábanas de prueba 0 0 0' })).toBeVisible();
  await expect(page.getByLabel('Current location')).toHaveText('?seguimientoDesde=2026-10-09');
  await page.getByLabel('Inicio del seguimiento provisional').fill('2026-10-15');
  await expect(page.getByRole('alert')).toContainText('no sea futura');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByLabel('Inicio del seguimiento provisional').fill('2026-10-08');
  await expect(page.getByRole('row', { name: 'Sábanas de prueba 10 15 -5' })).toBeVisible();
  await page.evaluate(() => { window.failReads = true; });
  await page.getByRole('button', { name: 'Actualizar seguimiento' }).click();
  await page.clock.fastForward(3000);
  await expect(page.getByRole('alert')).toContainText('Los saldos anteriores no se muestran como actuales');
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.evaluate(() => { window.failReads = false; });
  await page.getByRole('button', { name: 'Reintentar seguimiento' }).click();
  await expect(page.getByRole('row', { name: 'Sábanas de prueba 10 15 -5' })).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `viewport ${width} does not overflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Amenities y consumibles · revisar los descuentos existentes', { exact: true }).click();
  await page.screenshot({ path: join(tmpdir(), 'provisional-inventory-mobile.png'), fullPage: true });
  await page.evaluate(() => { window.fixtureSede = 'other'; window.fixtureReads = { movements: [], preparations: [], mappings: [], estimates: [] }; window.cycleActive = true; window.renderFixture(); });
  await expect(page.getByText(/El circuito completo está activo/)).toBeVisible();
  await expect(page.getByRole('row', { name: 'Sábanas de prueba 10 15 -5' })).toHaveCount(0);
  assert.deepEqual(errors, []);
  const readsBeforeHidden = await page.evaluate(() => window.readCount);
  await page.evaluate(() => { window.fixtureRole = 'supervisor'; window.fixtureSede = 'hidden-sede'; window.renderFixture(); });
  await expect(page.getByRole('heading', { name: 'Seguimiento provisional' })).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.readCount), readsBeforeHidden, 'no incomplete history reads for role outside existing policies');
  console.log('PASS provisional browser: real query lifecycle and component, automatic refresh, date and URL, negative differences, distinct supply balance, failure hides stale data, retry, sede isolation, active-cycle message and mobile; fixture reads, no session or network.');
} finally { await browser.close(); }
