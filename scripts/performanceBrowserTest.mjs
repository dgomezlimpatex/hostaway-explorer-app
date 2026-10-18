// Real components and React Query; synthetic data, all external traffic blocked.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const measuring = process.argv.includes('--measure');
const count = 60;
const fixture = {
  reports: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, task_id: `t${i}`, cleaner_id: 'w', created_at: '2026-10-19T10:00:00Z', overall_status: 'completed' })),
  tasks: Array.from({ length: count }, (_, i) => ({ id: `t${i}`, propertyId: 'p', date: '2026-10-19' })),
  media: Array.from({ length: count }, (_, i) => ({ task_report_id: `r${i}`, media_type: 'photo', file_url: `https://images.local/${i}.svg` })),
};
const modules = {
  '@/contexts/SedeContext': `export const useSede=()=>({activeSede:{id:'s'},isInitialized:true,loading:false});`,
  '@/hooks/useTaskReports': `export const useTaskReports=()=>({reports:${JSON.stringify(fixture.reports)},isLoading:false});`,
  '@/hooks/useTaskMedia': `const media=${JSON.stringify(fixture.media)};export const useAllTaskMedia=()=>({data:media});export const useTaskMedia=()=>({data:[]});`,
  '@/hooks/useCleaners': `const cleaners=[{id:'w',name:'Trabajadora de prueba'}];export const useCleaners=()=>({cleaners});`,
  '@/hooks/useProperties': `const properties=[{id:'p',nombre:'Apartamento de prueba',codigo:'P1'}];export const useProperties=()=>({data:properties});`,
  '@/services/taskStorage': `export const taskStorageService={getTasks:async()=>${JSON.stringify(fixture.tasks)}};`,
  '@/integrations/supabase/client': `export const supabase={from(table){window.reads.push(table);const q={select(){return q},in(){return q},eq(){return q},lte(){return q},gte(){return q},contains(){return q},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};`,
};
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WorkersColumn} from './src/components/calendar/WorkersColumn';
import {useWorkersAbsenceStatus} from './src/hooks/useWorkersAbsenceStatus';
import {CleaningReportsGallery} from './src/components/cleaning-reports/CleaningReportsGallery';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.client=client;
const cleaners=Array.from({length:150},(_,i)=>({id:'w'+i,name:'Trabajadora '+i})), noop=()=>{};
function RenderCase(){const [tick,setTick]=useState(0),[workers,setWorkers]=useState(cleaners);window.tick=()=>setTick(x=>x+1);window.rename=()=>setWorkers(rows=>rows.map((row,i)=>i===0?{...row,name:'Nombre actualizado'}:row));return <><output id="tick">{tick}</output><WorkersColumn cleaners={workers} onDrop={noop} onDragOver={noop}/></>}
function QueryCase(){const [ids,setIds]=useState(['b','a']);const [date,setDate]=useState('2026-10-19');window.setIds=setIds;window.setDate=setDate;const q=useWorkersAbsenceStatus(ids,new Date(date+'T12:00:00'));return <output id="query">{q.isSuccess?'ready':'loading'}</output>}
const filters={dateRange:'all',cleaner:'all',status:'all',property:'all',hasIncidents:'all'};
const mode=new URL(location.href).searchParams.get('mode');createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>{mode==='renders'?<RenderCase/>:mode==='queries'?<QueryCase/>:<CleaningReportsGallery filters={filters}/>}</QueryClientProvider>);`;
const built = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'offline-fixtures', setup(p) {
  p.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules, args.path) ? { path: args.path, namespace: 'fixture' } : null);
  p.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }));
  p.onLoad({ filter: /WorkersColumn\.tsx$/ }, args => ({ contents: readFileSync(args.path, 'utf8').replace('const handleDragOver =', 'window.workerRenders = (window.workerRenders || 0) + 1; const handleDragOver ='), loader: 'tsx' }));
} }] });
const html = `<html><style>body{margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.grid>div{height:340px}img{width:240px;height:200px;object-fit:cover}</style><div id="root"></div><script>window.reads=[];window.workerRenders=0;</script><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></html>`;
const browser = await chromium.launch({ headless: true });
const metrics = {};
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [], unexpected = [], images = new Set();
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('https://performance.local/')) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.startsWith('https://images.local/')) { images.add(url);return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="200"><rect width="240" height="200" fill="purple"/></svg>' }); }
    unexpected.push(url); return route.abort();
  });
  await page.goto('https://performance.local/?mode=renders');
  await page.waitForFunction(() => window.workerRenders > 0);
  for (let i = 1; i <= 20; i++) { await page.evaluate(() => window.tick());await page.waitForFunction(n => document.querySelector('#tick').textContent === String(n), i); }
  metrics.workerColumnRenders = await page.evaluate(() => window.workerRenders);
  assert.equal(await page.getByText('Trabajadora 149', { exact: true }).count(), 1);
  await page.evaluate(()=>window.rename());await page.getByText('Nombre actualizado',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.workerRenders),metrics.workerColumnRenders+1,'Changed props must still render');
  await page.goto('https://performance.local/?mode=queries');
  await page.waitForFunction(() => document.querySelector('#query').textContent === 'ready');
  for (const ids of [['a','b'],['b','a','b']]) { await page.evaluate(ids => window.setIds(ids), ids);await page.waitForTimeout(80); }
  metrics.absenceReadsAfterReorder = await page.evaluate(() => window.reads.length);
  await page.evaluate(() => window.setDate('2026-10-20'));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.reads.length), metrics.absenceReadsAfterReorder + 3, 'A new day must fetch new data');
  await page.evaluate(() => window.client.invalidateQueries({queryKey:['workers-absence-status']}));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.reads.length), metrics.absenceReadsAfterReorder + 6, 'Invalidation must still refresh immediately');
  await page.goto('https://performance.local/?mode=gallery');
  await page.waitForFunction(n => document.images.length === n, count);
  await page.waitForTimeout(200);
  metrics.galleryInitialImages = images.size;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => [...document.images].at(-1).complete && [...document.images].at(-1).naturalWidth > 0);
  assert.ok(images.size > metrics.galleryInitialImages || metrics.galleryInitialImages === count);
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  if (!measuring) { assert.equal(metrics.workerColumnRenders, 1); assert.equal(metrics.absenceReadsAfterReorder, 3); assert.ok(metrics.galleryInitialImages < count); }
  console.log(JSON.stringify(metrics));
  const output = process.env.PERFORMANCE_RESULT;
  if (output) writeFileSync(output, JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
