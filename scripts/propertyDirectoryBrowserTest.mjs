// Real directory, service, mapper, React Query and cleaning schedule; synthetic reads only.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
const baseline=process.argv.includes('--baseline');
const fixtures={
  '@/contexts/SedeContext':`export const useSede=()=>({activeSede:{id:'site-a'},isInitialized:true,loading:false});`,
  '@/hooks/useClients':`export const useClients=()=>({data:window.directoryClients,isLoading:false,isError:false});`,
  '@/hooks/use-mobile':`export const useDeviceType=()=>({isDesktop:window.innerWidth>1000});`,
  '@/hooks/useStock':`const empty=[];export const useStockProducts=()=>({data:empty,isSuccess:true,isLoading:false,isError:false});export const usePropertyStockConsumptionRules=()=>({data:empty,isSuccess:true,isLoading:false,isError:false});export const useSavePropertyStockConsumptionRules=()=>({mutateAsync:()=>{throw Error('Unexpected write')}});`,
  '@/services/aiObservedEvents':`export const recordAiObservedEvent=()=>{throw Error('Unexpected write')};`,
  '@/integrations/supabase/client':`export const supabase={from(table){const read={table,filters:{}};const q={select(selection){read.selection=selection;return q},eq(k,v){read.filters[k]=v;return q},in(k,v){read.filters[k]=v;return q},order(){return q},then(resolve,reject){window.directoryReads.push(read);if(!['properties','tasks'].includes(table))throw Error('Unexpected table '+table);
    let data;if(table==='properties'){const fields=read.selection.split('clients:')[0].split(',').map(s=>s.trim()).filter(Boolean);data=window.directoryRows.filter(r=>r.sede_id===read.filters.sede_id).map(row=>fields.includes('*')?row:Object.fromEntries([...fields.map(f=>[f,row[f]]),['clients',row.clients]]));}
    else data=[{id:'last',propiedad_id:read.filters.propiedad_id[0],date:'2000-01-01',start_time:'09:00',status:'completed'},{id:'next',propiedad_id:read.filters.propiedad_id[0],date:'2099-01-01',start_time:'10:00',status:'pending'}];
    return Promise.resolve({data:table==='tasks'&&window.directoryFailHistory?null:data,error:table==='tasks'&&window.directoryFailHistory?{message:'Synthetic history failure'}:null}).then(resolve,reject)}};return q}};`,
};
const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PropertiesPage} from './src/components/properties/PropertiesPage';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[location.pathname+location.search]}><PropertiesPage/></MemoryRouter></QueryClientProvider>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,metafile:true,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'directory-read-fixtures',setup(b){
  b.onResolve({filter:/.*/},a=>Object.hasOwn(fixtures,a.path)?{path:a.path,namespace:'fixture'}:null);
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],loader:'js',resolveDir:process.cwd()}));
  b.onResolve({filter:/(CreatePropertyModal|AssignChecklistModal|PropertyChecklistInfo|PropertyPreferredCleaners)$/},a=>({path:a.path.split('/').pop(),namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:`export const ${a.path}=()=>null;`,loader:'js'}));
  if(baseline)b.onLoad({filter:/PropertyDetailPanel\.tsx$/},()=>({contents:execFileSync('git',['show','5c6940189d0d9dfae06caa4b295e2c0d53d1a93d:src/components/properties/PropertyDetailPanel.tsx'],{encoding:'utf8'}),loader:'tsx'}));
}}]});
assert(!Object.keys(built.metafile.inputs).some(p=>p.endsWith('integrations/supabase/client.ts')));
// Functional harness does not need a dist build or font requests; styled form
// behavior is covered separately by propertyInlineEditBrowserTest.
const css='body{font-family:sans-serif} [role=dialog]{position:fixed;inset:1rem;overflow:auto;background:white}';
const executablePath=process.platform==='linux'&&existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined;
const browser=await chromium.launch({headless:true,executablePath});
try {
for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{
    localStorage.setItem('activeSede',JSON.stringify({id:'site-a'}));window.directoryReads=[];
    window.directoryClients=[{id:'client-a',nombre:'Cliente A',isActive:true,linenControlEnabled:true,amenitiesControlEnabled:true},{id:'client-b',nombre:'Cliente B',isActive:false,linenControlEnabled:false,amenitiesControlEnabled:false}];
    const p={id:'a',sede_id:'site-a',codigo:'A2',nombre:'Ático 2',direccion:'Calle Uno',numero_camas:2,numero_camas_pequenas:0,numero_camas_suite:0,numero_sofas_cama:0,numero_banos:1,numero_cocinas:1,duracion_servicio:60,coste_servicio:35,check_in_predeterminado:'15:00',check_out_predeterminado:'11:00',numero_sabanas:3,numero_sabanas_pequenas:0,numero_sabanas_suite:0,numero_toallas_grandes:2,numero_toallas_pequenas:2,numero_alfombrines:1,numero_fundas_almohada:2,kit_alimentario:1,amenities_bano:1,amenities_cocina:1,cantidad_rollos_papel_higienico:2,cantidad_rollos_papel_cocina:0,bayetas_cocina:1,bolsas_basura:1,notas:'Nota conservada',cliente_id:'client-a',linen_control_enabled:null,amenities_control_enabled:null,is_active:null,exclude_from_export:false,created_at:'2026-10-01',updated_at:'2026-10-01',clients:{nombre:'Cliente A',is_active:true,linen_control_enabled:true}};
    window.directoryRows=[p,{...p,id:'b',codigo:'B1',nombre:'Loft B',cliente_id:'client-b',clients:{nombre:'Cliente B',is_active:false,linen_control_enabled:false}},{...p,id:'c',codigo:'C1',nombre:'Villa C',cliente_id:null,is_active:true,clients:null},{...p,id:'other',sede_id:'site-b',nombre:'Otra sede'}];
  });
  const html=`<html><head><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
  await page.route('**/*',route=>route.request().url().startsWith('https://directory.test/properties')?route.fulfill({contentType:'text/html',body:html}):(unexpected.push(route.request().url()),route.abort()));
  const count=table=>page.evaluate(table=>window.directoryReads.filter(r=>r.table===table).length,table);
  await page.goto('https://directory.test/properties');
  await page.getByRole('button',{name:/Ático 2/}).waitFor();
  if(width<1000)await page.getByRole('button',{name:/Ático 2/}).click();
  await expect(page.getByLabel(/Nombre del Piso/)).toHaveValue('Ático 2');
  if(baseline)await page.waitForFunction(()=>window.directoryReads.some(r=>r.table==='tasks'));
  assert.equal(await count('tasks'),baseline?1:0,'Only the cleaning tab should read cleaning history');
  console.log(JSON.stringify({width,propertyReads:await count('properties'),initialHistoryReads:await count('tasks'),stage:baseline?'before-defer':'after-defer'}));
  await page.getByRole('tab',{name:'Limpiezas',exact:true}).click();
  await page.getByText('01/01/2000 · 09:00',{exact:true}).waitFor();await page.getByText('01/01/2099 · 10:00',{exact:true}).waitFor();
  assert.equal(await count('tasks'),1,'Cleaning dates still load on demand');
  await page.getByRole('tab',{name:'Ficha',exact:true}).click();await page.getByRole('tab',{name:'Limpiezas',exact:true}).click();assert.equal(await count('tasks'),1,'Fresh schedule cache is reused');
  await page.getByRole('tab',{name:'Ficha',exact:true}).click();if(width<1000)await page.keyboard.press('Escape');
  const search=page.getByPlaceholder('Buscar nombre, código, dirección o cliente');
  await search.fill('atico');await page.getByRole('button',{name:/Ático 2/}).waitFor();assert.equal(await page.getByRole('button',{name:/Villa C/}).count(),0);
  await search.fill('sin coincidencia');await page.getByText('No hay coincidencias',{exact:true}).waitFor();await search.fill('');
  await page.getByRole('button',{name:/Inactivas/}).click();await page.getByRole('button',{name:/Loft B/}).waitFor();
  await page.getByRole('button',{name:/Todas/}).click();await page.getByRole('combobox',{name:'Filtrar por cliente'}).click();await page.getByRole('option',{name:'Sin cliente asignado',exact:true}).click();await page.getByRole('button',{name:/Villa C/}).waitFor();assert.equal(await page.getByRole('button',{name:/Ático 2/}).count(),0);
  await page.getByRole('button',{name:'Limpiar',exact:true}).click();await page.getByRole('button',{name:/Ático 2/}).waitFor();
  // Direct URL keeps the cleaning tab available, including error/retry.
  await context.addInitScript(()=>{window.directoryFailHistory=true});
  await page.goto('https://directory.test/properties?propertyId=b&seccion=limpiezas');
  await page.getByText('No se han podido cargar las fechas.',{exact:false}).waitFor();
  await page.evaluate(()=>{window.directoryFailHistory=false});await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.getByText('01/01/2099 · 10:00',{exact:true}).waitFor();
  assert((await page.evaluate(()=>window.directoryReads.filter(r=>r.table==='tasks').map(r=>r.filters.propiedad_id[0]))).includes('b'));
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await context.close();
  console.log('PASS real directory '+width+': site isolation, search/accents, active/client filters, dates on demand, cache, direct cleaning link and retry; no writes or external traffic');
}
}finally{await browser.close();}
