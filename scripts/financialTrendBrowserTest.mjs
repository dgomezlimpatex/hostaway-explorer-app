import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The 12-month evolution, mounted alone with local data: lines, axis, tooltip, legend toggles, collapse and widths.
const fixture = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {FinancialTrend} from './src/features/financial/FinancialEvolution';import {QUANTITY_ITEMS} from './src/features/financial/financialModel';
const names=Array.from({length:26},(_,i)=>({id:'c'+String(i).padStart(2,'0'),name:'Cliente '+String(i).padStart(2,'0')}));
const services=names.flatMap((client,i)=>['2026-08-20','2026-09-20'].map((date,index)=>({id:client.id+date,type:'limpieza',date,clientId:client.id,clientName:client.name,propertyId:'p'+i,propertyName:'Piso '+i,revenue:(i+1)*1000*(index+1),revenueEstimated:false,workers:[{id:'w',name:'Ana',minutes:60,actual:true}],quantities:Object.fromEntries(QUANTITY_ITEMS.map(item=>[item.id,0]))})));
const settings={version:1,rates:[],adjustments:{},expenses:[]};
function Fixture(){const [view,setView]=useState({open:true,matchingDays:false,comparison:'balance',chart:'lines'});const filters={start:'2026-09-01',end:'2026-09-30',clients:[],properties:[],workers:[]};
return <main className="fin-root mx-auto max-w-[1440px] space-y-5 p-4"><FinancialTrend services={services} settings={settings} filters={filters} view={view} onViewChange={patch=>setView(v=>({...v,...patch}))} onDetails={(id,period)=>{window.detail={id,period}}}/></main>}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
const built = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outdir: join(tmpdir(), 'financial-trend-bundle'), platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' } });
assert.ok(!Object.keys(built.metafile.inputs).some(path => /integrations\/supabase|useFinancialData|financialPersistence/.test(path)), 'Fixture must not bundle a backend');
const source = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(source + built.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n'), { from: 'src/index.css' });
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles.find(file => !file.path.endsWith('.css')).text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const executablePath = process.platform === 'linux' && existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'https://financial-trend.local.test/' ? route.fulfill({ contentType: 'text/html', body: html }) : (requests.push(route.request().url()), route.abort()));
  await page.goto('https://financial-trend.local.test/');
  const trend = page.getByRole('region', { name: 'Evolución mensual' });
  await expect(trend.locator('.recharts-line')).toHaveCount(3);
  await expect(trend.locator('.recharts-xAxis .recharts-cartesian-axis-tick')).toHaveCount(12);
  await trend.locator('.recharts-line').first().locator('.recharts-dot').last().hover();
  await expect(trend.getByRole('tooltip')).toContainText('Ingresos: 7.020,00 €');
  await trend.getByRole('button', { name: 'Ingresos', exact: true }).click();
  await expect(trend.getByRole('button', { name: 'Ingresos', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await trend.getByRole('button', { name: 'Ingresos', exact: true }).click();
  await expect(trend.locator('.recharts-line')).toHaveCount(3);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No page overflow at ' + width);
    await expect(trend).toBeVisible();
  }
  await trend.getByRole('button', { name: 'Ocultar evolución', exact: true }).click();
  await expect(trend.locator('svg.recharts-surface')).toHaveCount(0);
  await expect(trend.locator('.recharts-cartesian-axis-tick')).toHaveCount(0);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('financial-trend: three lines, twelve visible months, real tooltip and legend toggles, collapse and four responsive widths passed');
} finally { await browser.close(); }
