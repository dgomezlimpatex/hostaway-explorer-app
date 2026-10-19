// Actual preparation hook + IndexedDB, synthetic identities, no production client.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';

const fixtures={
  '@/hooks/useAuth':`export const useAuth=()=>({user:{id:window.fixtureScope.owner}});`,
  '@/contexts/SedeContext':`export const useSede=()=>({activeSede:{id:window.fixtureScope.sede},isInitialized:true,loading:false});`,
  './CleanerOfflineProvider':'export const useCleanerOfflineStatus=()=>null;',
  '@/services/taskStorage':`export const taskStorageService={async getTasks(options){window.fixtureReads.push({table:'tasks',options});return Array.from({length:20},(_,i)=>({id:'task'+i,propertyId:'p'+Math.floor(i/4),cleanerId:options.cleanerId,cleaner:'Prueba',date:'2026-10-19',status:'pending',updated_at:'2026-10-19T00:00:00Z',additionalTasks:[]}))}};`,
  '@/services/storage/taskReportsStorage':`export const taskReportsStorageService={async getChecklistTemplates(){window.fixtureReads.push({table:'templates'});return []}};`,
  '@/integrations/supabase/client':`export const supabase={from(table){const filters={};const property=id=>({notas:filters.sede_id+':'+id,numero_camas:0,numero_banos:2});
    const execute=async batch=>{window.fixtureReads.push({table,filters});await new Promise(resolve=>setTimeout(resolve,3));return {data:table==='cleaners'?{id:'w:'+filters.user_id+':'+filters.sede_id,name:'Prueba',is_active:true,user_id:filters.user_id}:table==='properties'?(batch?filters.id.map(id=>({id,...property(id)})).reverse():property(filters.id)):null,error:null}};
    const q={select(){return q},eq(k,v){filters[k]=v;return q},in(k,v){filters[k]=v;return q},maybeSingle(){return execute(false)},then(resolve,reject){return execute(true).then(resolve,reject)}};return q}};`,
};
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useCleanerTasks,useCleanerIdentity,useCleanerCachedQuery,cleanerBundleKey,loadCleanerBundle} from './src/features/cleaner/useCleanerData';
import {readCleanerCache} from './src/features/cleaner/offlineStore';window.readFixtureCache=readCleanerCache;
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Detail({task}){const identity=useCleanerIdentity();const key=cleanerBundleKey(identity.ownerId,identity.sedeId,task.id);const bundle=useCleanerCachedQuery(['cleaner-bundle',key],key,()=>loadCleanerBundle(identity.ownerId,identity.sedeId,task,identity.data.id),!!identity.data);return <output id="property">{bundle.data?.property?.notas||'Cargando'}</output>}
function App(){const [scope,setScope]=useState(window.fixtureScope),[selected,setSelected]=useState(null);const data=useCleanerTasks(new Date('2026-10-19T12:00:00Z'));window.changeFixtureScope=(owner,sede)=>{window.fixtureScope={owner,sede};sessionStorage.setItem('fixture-scope',JSON.stringify(window.fixtureScope));setSelected(null);setScope(window.fixtureScope)};return <><output id="scope">{scope.owner+':'+scope.sede}</output><output id="count">{data.tasks.length}</output><output id="prepared">{String(data.prepared)}</output><button onClick={()=>setSelected(data.tasks[0])}>Abrir limpieza</button>{selected&&<Detail task={selected}/>}</>}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`;
const built=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline-fixtures',setup(p){p.onResolve({filter:/.*/},a=>Object.hasOwn(fixtures,a.path)?{path:a.path,namespace:'fixture'}:null);p.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],loader:'js'}));}}]});
assert.ok(!Object.keys(built.metafile.inputs).some(path=>path.startsWith('src/integrations/supabase')),'Never bundle the production client');
const html=`<html><body><div id="root"></div><script>window.fixtureReads=[];window.fixtureScope=JSON.parse(sessionStorage.getItem('fixture-scope')||'null')||{owner:'owner-a',sede:'sede-a'};</script><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const executablePath=process.platform==='linux'&&existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined;
const browser=await chromium.launch({headless:true,executablePath});
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://property-preparation.local/'?route.fulfill({contentType:'text/html',body:html}):(unexpected.push(route.request().url()),route.abort()));
  const ready=(scope)=>page.waitForFunction(scope=>document.querySelector('#scope')?.textContent===scope&&document.querySelector('#count')?.textContent==='20'&&document.querySelector('#prepared')?.textContent==='true',scope);
  const count=table=>page.evaluate(table=>window.fixtureReads.filter(r=>r.table===table).length,table);
  await page.goto('https://property-preparation.local/');await ready('owner-a:sede-a');
  assert.equal(await count('properties'),1);assert.equal(await count('task_reports'),20);assert.equal(await count('property_checklist_assignments'),20);
  await page.getByRole('button',{name:'Abrir limpieza'}).click();await page.waitForFunction(()=>document.querySelector('#property')?.textContent==='sede-a:p0');
  await page.evaluate(()=>window.changeFixtureScope('owner-b','sede-a'));await ready('owner-b:sede-a');
  assert.equal(await count('properties'),2,'A new account must fetch its own properties, even at the same site');
  await page.evaluate(()=>window.changeFixtureScope('owner-b','sede-b'));await ready('owner-b:sede-b');
  assert.equal(await count('properties'),3,'A new site must fetch its own properties');
  const saved=await page.evaluate(async()=>Promise.all(Array.from({length:20},async(_,i)=>{
    const bundle=await window.readFixtureCache('owner-b:sede-b:task:task'+i);return bundle?.data.property;
  })));
  saved.forEach((property,i)=>{assert.equal(property.notas,'sede-b:p'+Math.floor(i/4));assert.equal(property.numero_camas,0);assert.equal(Object.hasOwn(property,'id'),false);});
  await page.getByRole('button',{name:'Abrir limpieza'}).click();await page.waitForFunction(()=>document.querySelector('#property')?.textContent==='sede-b:p0');
  await context.setOffline(true);await page.reload();await ready('owner-b:sede-b');
  assert.equal(await count('properties'),0);assert.equal(await count('task_reports'),0);
  await page.getByRole('button',{name:'Abrir limpieza'}).click();await page.waitForFunction(()=>document.querySelector('#property')?.textContent==='sede-b:p0');
  assert.equal(await count('properties'),0,'Opening offline must read its saved per-task bundle');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS actual hook: 20 complete independent offline-ready task bundles, 1 property batch; fresh account/site cycles; IndexedDB reload and opening without coverage; no external traffic');
}finally{await browser.close();}
