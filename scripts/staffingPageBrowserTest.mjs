import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const modules = {
  '@/contexts/SedeContext': "export const useSede=()=>({activeSede:{id:'s',nombre:'Sede sintética'},isInitialized:true});",
  '@/hooks/useRolePermissions': 'export const useRolePermissions=()=>({isAdminOrManager:()=>true});',
  '@/hooks/useAuth': "export const useAuth=()=>({user:{id:'u'}});",
  '@/features/staffing/readClient': 'export const createStaffingPageReader=signal=>signal;',
  '@/features/staffing/data': `export {datePlus} from '${process.cwd().replaceAll('\\', '/')}/src/features/staffing/dataUtils';
    export const readStaffingDataset=(signal,sede,from,to)=>new Promise((resolve,reject)=>{
      window.reads=(window.reads||0)+1;window.lastRange={from,to,sede};
      signal.addEventListener('abort',()=>{window.aborts=(window.aborts||0)+1;reject(Error('Cancelada'));});
      window.finish=()=>resolve({fetchedAt:String(window.reads),issues:[],inventory:[],centers:[{id:'c',name:'Centro sintético',startMinute:600,endMinute:960}],workers:[{id:'w',name:'Persona sintética',weeklyMinutes:1200,homeCenterIds:['c'],availability:[0,1,2,3,4,5,6].map(day=>({day,startMinute:600,endMinute:960})),restDay:0,flexibleRest:false,canMove:true,unavailableDates:[],confirmedRestDates:[]}],services:[{id:'t',date:from,centerId:'c',personMinutes:60,startMinute:600,endMinute:960,requiredWorkers:1,source:'task',kind:'fixed'}]});
      window.fail=()=>reject(Error('Error sintético de lectura'));
    });`,
};
const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from './src/pages/StaffingForecastPage';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><Page/></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'offline-page', setup(plugin) { plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules, args.path) ? { path: args.path, namespace: 'fixture' } : null); plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js', resolveDir: process.cwd() })); } }] });
expect(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase'))).toBe(false);
const browser = await chromium.launch({ headless: true });
const errors = [], requests = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent(`<html><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`);
  await expect(page.locator('h1')).toHaveCount(1);
  expect(await page.evaluate(() => window.reads || 0)).toBe(0);
  await page.getByRole('button', { name: 'Consultar datos de la sede' }).click();
  await expect(page.getByRole('status')).toContainText('Leyendo fuentes');
  await page.getByRole('button', { name: 'Cancelar consulta' }).click();
  expect(await page.evaluate(() => window.aborts)).toBe(1);
  await expect(page.getByLabel('Resumen semanal de sede')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar datos de la sede' }).click();
  await page.evaluate(() => window.fail());
  await expect(page.getByRole('alert')).toContainText('Error sintético de lectura');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await page.evaluate(() => window.finish());
  await expect(page.getByLabel('Resumen semanal de sede')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await page.getByRole('button', { name: 'Simular cambios', exact: true }).click();
  await page.getByLabel('Horas de Persona sintética', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Cerrar Simular cambios' }).click();
  const defaultWeeks = await page.getByLabel('Horizonte de previsión').inputValue();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByLabel('Horizonte de previsión').selectOption('4');
  await expect(page.getByLabel('Horizonte de previsión')).toHaveValue(defaultWeeks);
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Horizonte de previsión').selectOption('4');
  await expect(page.getByLabel('Resumen semanal de sede')).toHaveCount(0);
  await page.getByLabel('Mes inicial de previsión').fill('2026-10-07');
  await expect(page.getByLabel('Mes inicial de previsión')).toHaveValue('2026-10-07');
  await page.getByRole('button', { name: 'Consultar datos de la sede' }).click();
  await page.evaluate(() => window.finish());
  await page.getByLabel('Periodicidad').selectOption('week');
  await expect(page.getByLabel('Semana de análisis').locator('option')).toHaveCount(14);
  expect(await page.evaluate(() => window.lastRange)).toEqual({ from: '2026-09-28', to: '2027-01-03', sede: 's' });
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByLabel('Resumen semanal de sede')).toHaveCount(0);
  await page.evaluate(() => window.finish());
  await expect(page.getByLabel('Resumen semanal de sede')).toBeVisible();
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  console.log('PASS real page + React Query with synthetic reader: explicit read, loading, cancellation, error/retry, one header, confirmed period discard, Monday normalization, refresh hides stale result; zero network/errors');
} finally { await browser.close(); }
