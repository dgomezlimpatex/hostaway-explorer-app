import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const modules = {
  '@/contexts/SedeContext': "export const useSede=()=>({activeSede:{id:'s',nombre:'Sede de prueba'}});",
  '@/hooks/useAuth': "export const useAuth=()=>({user:{id:'u'}});",
  '@/integrations/supabase/client': `
    const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
    const data={tasks:[{id:'t',type:'limpieza-turistica',date,status:'pending',coste:0,cliente_id:'c',propiedad_id:'p',property:'Apartamento Centro',cleaner_id:'w1',cleaner:'Ana',start_time:'10:00',end_time:'11:00',task_assignments:[{cleaner_id:'w1',cleaner_name:'Ana'},{cleaner_id:'w2',cleaner_name:'Bea'}],task_reports:[]}],
      properties:[{id:'p',nombre:'Apartamento Centro',cliente_id:'c',coste_servicio:100,duracion_servicio:120,numero_sabanas:2,numero_sabanas_pequenas:0,numero_sabanas_suite:0,numero_fundas_almohada:2,numero_toallas_grandes:2,numero_toallas_pequenas:2,numero_alfombrines:1,amenities_cocina:1,amenities_bano:1,kit_alimentario:1,cantidad_rollos_papel_higienico:2}],clients:[{id:'c',nombre:'Cliente de prueba'},{id:'c2',nombre:'Cliente sin servicios'}],cleaners:[{id:'w1',name:'Ana'},{id:'w2',name:'Bea'},{id:'nc',name:'NOT COUNT'}]};
    const task=data.tasks[0];
    data.tasks.push({...task,id:'excluded-nc',coste:999,task_assignments:[{cleaner_id:'nc',cleaner_name:'Nombre antiguo'}]},
      {...task,id:'excluded-past',date:'2000-01-01',coste:999,cleaner_id:null,task_assignments:[]},
      {...task,id:'excluded-cancelled',status:'cancelled',coste:999});
    export const supabase={from(table){const calls=[];const q={select(...a){calls.push(['select',...a]);return q},eq(...a){calls.push(['eq',...a]);return q},gte(...a){calls.push(['gte',...a]);return q},lte(...a){calls.push(['lte',...a]);return q},order(...a){calls.push(['order',...a]);return q},range(from,to){window.reads=window.reads||[];window.reads.push({table,calls,from,to});return Promise.resolve({data:data[table].slice(from,to+1),error:null})}};return q}};
  `,
};
const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from './src/features/financial/FinancialAnalysisPage';createRoot(document.getElementById('root')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'financial-fixture', setup(plugin) {
  plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules, args.path) ? { path: args.path, namespace: 'fixture' } : null);
  plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js', resolveDir: process.cwd() }));
} }] });
assert.ok(!Object.keys(built.metafile.inputs).some(path => path.startsWith('src/integrations/supabase')), 'Real production client must not be bundled');
const css = readFileSync(join('dist/assets', readdirSync('dist/assets').find(file => /^index-.*\.css$/.test(file))), 'utf8');
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'https://financial.local.test/' ? route.fulfill({ contentType: 'text/html', body: html }) : (requests.push(route.request().url()), route.abort()));
  await page.goto('https://financial.local.test/');
  await expect(page.getByRole('heading', { name: 'Análisis financiero', exact: true })).toBeVisible();
  await expect(page.getByText('100,00 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('31,00 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/1 servicios contabilizados/)).toBeVisible();
  await expect(page.getByText('Productos de limpieza', { exact: true })).toBeVisible();
  await expect(page.getByText('3,00 €', { exact: true }).first()).toBeVisible();
  const reads = await page.evaluate(() => window.reads);
  assert.equal(reads.length, 4);
  for (const read of reads) { assert.deepEqual(read.calls.find(call => call[0] === 'eq'), ['eq', 'sede_id', 's']); assert.deepEqual([read.from,read.to], [0,499]); }
  const previousEnd = await page.getByLabel('Hasta', { exact: true }).inputValue();
  const [year, month] = previousEnd.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  await page.getByLabel('Hasta', { exact: true }).fill(monthEnd);
  await expect(page.getByText('2317,00 €', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Hasta', { exact: true }).fill(previousEnd);
  await page.getByRole('button', { name: 'Tarifas', exact: true }).click();
  await expect(page.getByText('0,247 € / prenda')).toBeVisible();
  await expect(page.getByText('2317,00 € / mes · coste de empresa')).toBeVisible();
  await page.getByLabel('Concepto', { exact: true }).selectOption('tourismSalary');
  await page.getByLabel('Coste de empresa mensual').fill('0');
  await page.getByLabel('Aplicar desde').fill('2000-01-01');
  await page.getByRole('button', { name: 'Guardar tarifa' }).click();
  await page.getByLabel('Concepto', { exact: true }).selectOption('kitchenKit');
  await page.getByLabel('Precio unitario sin IVA').fill('1,17');
  await page.getByRole('button', { name: 'Guardar tarifa' }).click();
  await expect(page.getByRole('status')).toContainText('guardados');
  await page.getByLabel('Concepto', { exact: true }).selectOption('products');
  await page.getByLabel('Porcentaje sobre limpieza').fill('4,2');
  await page.getByRole('button', { name: 'Guardar tarifa' }).click();
  await page.getByRole('button', { name: 'General', exact: true }).click();
  await expect(page.getByText('4,20 €', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Otros gastos', exact: true }).click();
  await page.getByLabel('Concepto del gasto').fill('Alquiler de prueba');
  await page.getByLabel('Importe sin IVA', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Añadir al análisis' }).click();
  await expect(page.getByText('Alquiler de prueba', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'General', exact: true }).click();
  await expect(page.getByText('Gastos generales incluidos:')).toContainText('50,00 €');
  await page.locator('summary').filter({ hasText: 'Trabajadores:' }).click();
  await page.getByLabel('Ana', { exact: true }).check();
  await page.locator('summary').filter({ hasText: 'Trabajadores:' }).click();
  await expect(page.getByText('Gastos generales incluidos:')).toContainText('0,00 €');
  await expect(page.getByText('100,00 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('31,00 €', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver todo · mes actual' }).click();
  await page.getByRole('button', { name: 'Servicios', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar costes' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Ana/).fill('1,5');
  for (const input of await dialog.locator('input[inputmode="numeric"]').all()) if (!(await input.inputValue())) await input.fill('0');
  await dialog.getByLabel('He revisado todas las cantidades de este servicio').check();
  await dialog.getByRole('button', { name: 'Guardar ajustes del análisis' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('38,75 €', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('38,75 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Gastos generales incluidos:')).toContainText('50,00 €');
  await page.screenshot({ path: join(tmpdir(), 'limpatex-financial-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Análisis financiero', exact: true })).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No page-level horizontal overflow on mobile');
  await page.screenshot({ path: join(tmpdir(), 'limpatex-financial-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(requests.filter(url => !url.endsWith('.woff') && !url.endsWith('.woff2')), []);
  console.log('financial-browser: real page + real reader, offline fixtures, filters, multi-worker, tariffs, expenses, editor, persistence, desktop and mobile passed');
} finally { await browser.close(); }
