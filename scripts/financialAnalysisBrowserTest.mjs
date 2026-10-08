import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const modules = {
  '@/contexts/SedeContext': "export const useSede=()=>({activeSede:{id:'s',nombre:'Sede de prueba'}});",
  '@/hooks/useAuth': "export const useAuth=()=>({user:{id:'u'}});",
  '@/integrations/supabase/client': `
    const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
    const data={tasks:[{id:'t',type:'limpieza-turistica',date,status:'pending',coste:0,cliente_id:'c',propiedad_id:'p',property:'Apartamento Centro',cleaner_id:'w1',cleaner:'Ana',start_time:'10:00',end_time:'11:00',task_assignments:[{cleaner_id:'w1',cleaner_name:'Ana'},{cleaner_id:'w2',cleaner_name:'Bea'}],task_reports:[]}],
      properties:[{id:'p',nombre:'Apartamento Centro',cliente_id:'c',coste_servicio:100,duracion_servicio:120,numero_sabanas:2,numero_sabanas_pequenas:0,numero_sabanas_suite:0,numero_fundas_almohada:2,numero_toallas_grandes:2,numero_toallas_pequenas:2,numero_alfombrines:1,amenities_cocina:1,amenities_bano:1,kit_alimentario:1,cantidad_rollos_papel_higienico:2}],clients:[{id:'c',nombre:'Cliente de prueba'},{id:'c2',nombre:'Cliente sin servicios'}],cleaners:[{id:'w1',name:'Ana'},{id:'w2',name:'Bea'},{id:'nc',name:'NOT COUNT'}]};
    const task=data.tasks[0]; task.duracion=120; task.end_time='12:00'; // Two hours total, one hour per each of two people.
    data.properties.push({...data.properties[0],id:'pzero',nombre:'Jornada Hotel de prueba',coste_servicio:0});
    data.tasks.push({...task,id:'no-income',propiedad_id:'pzero',coste:0},
      {...task,id:'missing-income',propiedad_id:'missing',property:'Servicio con precio pendiente',coste:null});
    data.tasks.push({...task,id:'excluded-nc',coste:999,task_assignments:[{cleaner_id:'nc',cleaner_name:'Nombre antiguo'}]},
      {...task,id:'excluded-past',date:'2000-01-01',coste:999,cleaner_id:null,task_assignments:[]},
      {...task,id:'excluded-cancelled',status:'cancelled',coste:999});
    data.stock_property_consumption_rules=[];
    export const supabase={from(table){const calls=[];let payload=null;const q={select(...a){calls.push(['select',...a]);return q},insert(value){payload=value;return q},update(value){payload=value;return q},eq(...a){calls.push(['eq',...a]);return q},gte(...a){calls.push(['gte',...a]);return q},lte(...a){calls.push(['lte',...a]);return q},order(...a){calls.push(['order',...a]);return q},async maybeSingle(){if(table!=='financial_settings')throw new Error('Unexpected table');if(window.failFinance)return {data:null,error:{message:'Fallo simulado'}};return fetch('https://financial.local.test/config',{method:payload?'POST':'GET',headers:{'Content-Type':'application/json'},body:payload?JSON.stringify({payload,calls}):undefined}).then(r=>r.json())},range(from,to){window.reads=window.reads||[];window.reads.push({table,calls,from,to});return Promise.resolve({data:data[table].slice(from,to+1),error:null})}};return q}};
  `,
};
const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from './src/features/financial/FinancialAnalysisPage';createRoot(document.getElementById('root')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'financial-fixture', setup(plugin) {
  plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules, args.path) ? { path: args.path, namespace: 'fixture' } : null);
  plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js', resolveDir: process.cwd() }));
} }] });
assert.ok(!Object.keys(built.metafile.inputs).some(path => path.startsWith('src/integrations/supabase')), 'Real production client must not be bundled');
// Functional checks run before the production build. Compile actual app styles
// directly, omitting font downloads so this fixture remains fully offline.
const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  let shared={document:{version:1,rates:[],expenses:[],adjustments:{}},revision:1};
  const handle=async route=>{
    if(route.request().url()==='https://financial.local.test/')return route.fulfill({contentType:'text/html',body:html});
    if(route.request().url()==='https://financial.local.test/config'){
      let data=shared;
      if(route.request().method()==='POST') {const {payload,calls}=route.request().postDataJSON();const expected=calls.find(c=>c[0]==='eq' && c[1]==='revision')?.[2];if(expected!==shared.revision)data=null;else shared=data={document:payload.document,revision:payload.revision};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null})});
    }
    requests.push(route.request().url());return route.abort();
  };
  await page.route('**/*',handle);
  await page.goto('https://financial.local.test/');
  await expect(page.getByRole('heading', { name: 'Análisis financiero', exact: true })).toBeVisible();
  await expect(page.getByText('100,00 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('29,00 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/1 servicios contabilizados/)).toBeVisible();
  await page.locator('summary').filter({hasText:'Servicios fuera del balance:'}).click();
  await expect(page.getByText(/1 con ingreso cero · 1 con precio pendiente/)).toBeVisible();
  await expect(page.getByRole('listitem').filter({hasText:'Jornada Hotel de prueba'})).toBeVisible();
  await expect(page.getByRole('listitem').filter({hasText:'Servicio con precio pendiente'})).toBeVisible();
  await page.locator('summary').filter({hasText:'Servicios fuera del balance:'}).click();
  await expect(page.getByText('Productos de limpieza', { exact: true })).toBeVisible();
  await expect(page.getByText('3,00 €', { exact: true }).first()).toBeVisible();
  const reads = await page.evaluate(() => window.reads);
  assert.equal(reads.length, 5);
  for (const read of reads) { assert.deepEqual(read.calls.find(call => call[0] === 'eq'), ['eq', read.table==='stock_property_consumption_rules'?'property.sede_id':'sede_id', 's']); assert.deepEqual([read.from,read.to], [0,499]); }
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
  await expect(page.getByRole('status')).toContainText('Borrador actualizado');
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
  await expect(page.getByText('29,00 €', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver todo · mes actual' }).click();
  await page.getByRole('button', { name: 'Servicios', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar costes' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Ana/).fill('1,5');
  for (const input of await dialog.locator('input[inputmode="numeric"]').all()) if (!(await input.inputValue())) await input.fill('0');
  await dialog.getByLabel('He revisado todas las cantidades de este servicio').check();
  await dialog.getByRole('button', { name: 'Guardar ajustes del análisis' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('36,25 €', { exact: true })).toBeVisible();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('guardados y compartidos');
  await page.reload();
  await expect(page.getByText('36,25 €', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Gastos generales incluidos:')).toContainText('50,00 €');
  await page.getByRole('button',{name:'Otros ingresos',exact:true}).click();
  await page.getByLabel('Concepto del ingreso').fill('Lavandería externa de prueba');
  await page.getByLabel('Ingreso sin IVA',{exact:true}).fill('300');
  await page.getByLabel('Coste externo sin IVA').fill('200');
  await page.getByLabel('Categoría del coste').selectOption('laundry');
  await page.getByRole('button',{name:'Añadir ingreso',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Lavandería externa de prueba'})).toContainText('100,00 €');
  await page.getByLabel('Concepto del ingreso').fill('Recepción de prueba');
  await page.getByLabel('Tipo de ingreso').selectOption('monthly');
  await page.getByLabel('Ingreso sin IVA',{exact:true}).fill('1329,60');
  await page.getByLabel('Horas de personal por semana').fill('16');
  await page.getByLabel('Cliente del ingreso').selectOption('c2');
  await page.getByRole('button',{name:'Añadir ingreso',exact:true}).click();
  await page.getByLabel('Hasta',{exact:true}).fill(monthEnd);
  await expect(page.getByRole('row').filter({hasText:'Recepción de prueba'})).toContainText('1008,04 €');
  await page.getByLabel('Concepto del ingreso').fill('Virtual por limpieza de prueba');
  await page.getByLabel('Tipo de ingreso').selectOption('perCleaning');
  await page.getByLabel('Ingreso sin IVA',{exact:true}).fill('2,75');
  await page.getByLabel('Cliente del ingreso').selectOption('c');
  await page.getByRole('button',{name:'Añadir ingreso',exact:true}).click();
  await page.getByRole('button',{name:'General',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Cliente de prueba'}).first()).toContainText('102,75 €');
  await page.getByRole('button',{name:'Por cliente',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Cliente de prueba'}).first()).toContainText('4,20 €');
  await expect(page.getByRole('row').filter({hasText:'Cliente sin servicios'})).toContainText('1329,60 €');
  await page.getByRole('button',{name:'Otros ingresos',exact:true}).click();
  await page.locator('div.rounded-lg').filter({hasText:'Recepción de prueba'}).getByRole('button',{name:'Editar ingreso'}).click();
  await page.getByLabel('Cambiar importes solo este mes · opcional').fill(previousEnd.slice(0,7));
  await page.getByLabel('Ingreso sin IVA',{exact:true}).fill('1500');
  await page.getByRole('button',{name:'Actualizar ingreso',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Recepción de prueba'})).toContainText('1500,00 €');
  await page.evaluate(()=>{window.failFinance=true});
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Tu borrador se conserva');
  assert.equal(shared.document.incomes,undefined,'Failed save must not persist draft');
  await page.evaluate(()=>{window.failFinance=false});
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('guardados y compartidos');
  const second=await browser.newPage();await second.route('**/*',handle);await second.goto('https://financial.local.test/');
  await second.getByRole('button',{name:'Otros ingresos',exact:true}).click();
  await expect(second.getByText('Lavandería externa de prueba',{exact:true})).toBeVisible();
  assert.equal(await second.evaluate(()=>localStorage.length),0,'Shared settings work without browser-local configuration');
  await second.close();
  shared={...shared,revision:shared.revision+1};
  await page.getByLabel('Concepto del ingreso').fill('Borrador en conflicto');
  await page.getByRole('button',{name:'Añadir ingreso',exact:true}).click();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Otra persona ha cambiado');
  assert.ok(!shared.document.incomes.some(i=>i.label==='Borrador en conflicto'));
  await page.getByRole('button',{name:'Descartar y recargar',exact:true}).click();
  await expect(page.getByText('Ingresos totales',{exact:true})).toBeVisible();
  await page.evaluate(()=>{window.failFinance=true});
  await page.getByRole('button',{name:'Descartar y recargar',exact:true}).click();
  await expect(page.getByText('Ingresos totales',{exact:true})).not.toBeVisible();
  await expect(page.getByText(/Configuración sin cargar/)).toBeVisible();
  await page.evaluate(()=>{window.failFinance=false});
  await page.getByRole('button',{name:'Descartar y recargar',exact:true}).click();
  await expect(page.getByText('Ingresos totales',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Servicios',exact:true}).click();
  await page.getByRole('button',{name:'Margen inferior al 10%',exact:true}).click();
  await expect(page.getByText('No hay servicios contabilizables con estos filtros.')).toBeVisible();
  await page.getByRole('button',{name:'Todos los servicios',exact:true}).click();
  await page.getByRole('button',{name:'Revisar costes',exact:true}).click();
  await page.getByRole('dialog').getByLabel(/^Paño de cocina/).fill('1');
  await page.getByRole('dialog').getByRole('button',{name:'Guardar ajustes del análisis',exact:true}).click();
  await page.getByRole('button',{name:'Tarifas',exact:true}).click();
  await page.getByLabel('Cliente de la regla').selectOption('c');
  await page.getByLabel('Propiedad de la regla').selectOption('p');
  await page.getByLabel(/^Cobro de paño de cocina/).selectOption('yes');
  await page.getByRole('button',{name:'Aplicar regla al borrador',exact:true}).click();
  await page.getByRole('button',{name:'Servicios',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'Apartamento Centro'})).toContainText('103,00 €');
  await page.getByRole('button',{name:'Revisar costes',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('paño de cocina: 0,25 €');
  await expect(page.getByRole('dialog')).toContainText('otros suplementos: 2,75 €');
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('guardados y compartidos');
  assert.equal(shared.document.policies.find(p=>p.propertyId==='p').kitchenClothIncome,true);
  await page.getByRole('button',{name:'General',exact:true}).click();
  await page.screenshot({ path: join(tmpdir(), 'limpatex-financial-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Análisis financiero', exact: true })).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No page-level horizontal overflow on mobile');
  await page.screenshot({ path: join(tmpdir(), 'limpatex-financial-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(requests.filter(url => !url.endsWith('.woff') && !url.endsWith('.woff2')), []);
  console.log('financial-browser: real page + real reader, offline fixtures, filters, multi-worker, tariffs, expenses, editor, persistence, desktop and mobile passed');
} finally { await browser.close(); }
