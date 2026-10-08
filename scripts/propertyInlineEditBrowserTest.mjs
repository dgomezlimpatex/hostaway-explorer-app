import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const mocks = {
  useProperties: `import {useSyncExternalStore} from 'react';
    const listeners=new Set(); const refresh=()=>{for(const fn of listeners)fn()}; window.refreshFixture=refresh;
    export const useProperties=()=>{useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.fixture.version);return {data:window.fixture.properties,isLoading:false}};
    export const usePropertyCleaningSchedule=()=>({data:{},isLoading:false});
    export const useCreateProperty=()=>({isPending:false,mutateAsync:async()=>{throw Error('Unexpected create')}});
    export const useDeleteProperty=()=>({isPending:false,mutate:()=>{throw Error('Unexpected delete')}});
    export const useUpdateProperty=()=>({mutateAsync:async ({id,updates})=>{window.fixture.calls.push({kind:'property',id,updates}); if(window.fixture.waitSaves) await new Promise((resolve,reject)=>{window.fixture.pendingSaves[id]={resolve,reject}}); if(window.fixture.failProperty)throw Error('Simulated failure'); await new Promise(r=>setTimeout(r,30));window.fixture.properties=window.fixture.properties.map(p=>p.id===id?{...p,...updates}:p);window.fixture.version++;refresh();}});`,
  useStock: `import {useSyncExternalStore} from 'react';
    const listeners=new Set();const refresh=()=>{for(const fn of listeners)fn()};
    const watch=()=>useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.fixture.version);
    export const useStockProducts=()=>{watch();return {data:window.fixture.products,isSuccess:!window.fixture.loadError,isError:window.fixture.loadError,isLoading:false,refetch:async()=>{window.fixture.loadError=false;window.fixture.version++;refresh();}}};
    export const usePropertyStockConsumptionRules=id=>{watch();return {data:window.fixture.rules[id],isSuccess:!window.fixture.loadError,isError:window.fixture.loadError,isLoading:false,refetch:async()=>{window.fixture.loadError=false;window.fixture.version++;refresh();}}};
    export const useSavePropertyStockConsumptionRules=()=>({mutateAsync:async ({propertyId,rules})=>{window.fixture.calls.push({kind:'rules',propertyId,rules});if(window.fixture.failRules)throw Error('Simulated failure');window.fixture.rules[propertyId]=window.fixture.rules[propertyId].map(r=>({...r,...rules.find(x=>x.product_id===r.product_id)}));window.fixture.version++;refresh();}});`,
  useClients: `export const useClients=()=>({data:window.fixture.clients,isLoading:false});`,
  useSede: `export const useSede=()=>({activeSede:{id:'local'},loading:false,isInitialized:true});`,
  useMobile: `export const useDeviceType=()=>({isDesktop:window.innerWidth>1000});`,
};
const bundle = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {PropertiesPage} from './src/components/properties/PropertiesPage';createRoot(document.getElementById('root')).render(<MemoryRouter><PropertiesPage/></MemoryRouter>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-property-data',setup(b){
  b.onResolve({filter:/hooks\/use(Properties|Stock|Clients)$/},args=>({path:args.path.split('/').pop(),namespace:'mock'}));
  b.onResolve({filter:/contexts\/SedeContext$/},()=>({path:'useSede',namespace:'mock'}));
  b.onResolve({filter:/hooks\/use-mobile$/},()=>({path:'useMobile',namespace:'mock'}));
  b.onResolve({filter:/(CreatePropertyModal|AssignChecklistModal|PropertyChecklistInfo|PropertyPreferredCleaners)$/},args=>({path:args.path.split('/').pop(),namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
  b.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:`export const ${args.path}=()=>null;`,loader:'js'}));
  b.onResolve({filter:/integrations\/supabase\/client$/},()=>{throw Error('Test attempted to import production client')});
}}]});
const css=readdirSync('dist/assets').filter(n=>n.endsWith('.css')).map(n=>readFileSync('dist/assets/'+n,'utf8')).join('\n');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}:{})});
try {
for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
 await page.route('**/*',route=>route.request().url()==='http://property.test/'?route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}):route.abort());
 await page.goto('http://property.test/');
 await page.evaluate(()=>{
  const p={id:'a',codigo:'A1',nombre:'Apartamento A',direccion:'Calle de prueba',clienteId:'client',numeroCamas:1,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:1,numeroCocinas:1,duracionServicio:60,costeServicio:35,checkInPredeterminado:'15:00',checkOutPredeterminado:'11:00',numeroSabanas:3,numeroSabanasRequenas:0,numeroSabanasSuite:0,numeroToallasGrandes:2,numeroTotallasPequenas:2,numeroAlfombrines:1,numeroFundasAlmohada:2,kitAlimentario:1,amenitiesBano:1,amenitiesCocina:1,cantidadRollosPapelHigienico:2,cantidadRollosPapelCocina:0,bayetasCocina:1,bolsasBasura:1,notas:'Nota original',linenControlEnabled:true,amenitiesControlEnabled:true,isActive:true,excludeFromExport:false};
  window.fixture={version:0,properties:[p,{...p,id:'b',codigo:'B2',nombre:'Apartamento B'}],products:[{id:'sheets',name:'Sábanas grandes',is_consumable:true,unit_of_measure:'ud',category:{kind:'laundry'}},{id:'kit',name:'Amenities baño',is_consumable:true,unit_of_measure:'ud',category:{kind:'amenity'}}],rules:{a:[{product_id:'sheets',quantity_per_cleaning:3,notes:'Conservar nota'},{product_id:'kit',quantity_per_cleaning:1}],b:[]},clients:[{id:'client',nombre:'Cliente ficticio',isActive:true,linenControlEnabled:true,amenitiesControlEnabled:true}],calls:[],loadError:true};
 });
 await page.addStyleTag({content:css});await page.addScriptTag({content:bundle.outputFiles[0].text});
 if(width<1000){await page.getByRole('button',{name:/Apartamento A/}).click();}
 const save=page.getByRole('button',{name:'Guardar cambios',exact:true});
 const name=page.getByLabel(/Nombre del Piso/);await name.waitFor({timeout:5000}).catch(async e=>{console.log(await page.locator('body').innerText());throw e;});
 assert.equal(await name.isDisabled(),true);
 await page.getByRole('button',{name:'Reintentar',exact:true}).click();
 await name.fill('Apartamento editado');
 await page.evaluate(()=>{window.fixture.properties=window.fixture.properties.map(p=>({...p}));window.fixture.version++;window.refreshFixture()});
 assert.equal(await name.inputValue(),'Apartamento editado');
 await page.getByRole('tab',{name:'Consumos',exact:true}).click();
 const sheets=page.getByLabel(/Sábanas grandes/);await sheets.fill('7');
 await page.getByRole('tab',{name:'Ficha',exact:true}).click();assert.equal(await name.inputValue(),'Apartamento editado');
 await page.getByRole('tab',{name:'Consumos',exact:true}).click();assert.equal(await sheets.inputValue(),'7');
 assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[]);
 await page.getByRole('button',{name:'Descartar',exact:true}).click();assert.equal(await sheets.inputValue(),'3');
 await page.getByRole('tab',{name:'Ficha',exact:true}).click();assert.equal(await name.inputValue(),'Apartamento A');
 await name.fill('Solo ficha');await save.click();await page.getByText('Cambios guardados.',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[{kind:'property',id:'a',updates:{nombre:'Solo ficha'}}]);
 await page.evaluate(()=>{window.fixture.calls=[]});
 await page.getByRole('tab',{name:'Consumos',exact:true}).click();await sheets.fill('8');
 await page.getByRole('tab',{name:'Checklist',exact:true}).click();await page.getByLabel(/Observaciones adicionales/).fill('Nota editada');
 await save.click();await page.waitForFunction(()=>window.fixture.properties[0].notas==='Nota editada');
 assert.equal(await page.evaluate(()=>window.fixture.rules.a[0].quantity_per_cleaning),8);
 assert.equal(await page.evaluate(()=>window.fixture.rules.a[0].notes),'Conservar nota');
 assert.equal(await page.evaluate(()=>window.fixture.calls.filter(c=>c.kind==='rules')[0].rules.length),1);
 // Validation and failed save preserve the draft.
 await page.getByRole('tab',{name:'Ficha',exact:true}).click();await name.fill('');await save.click();await page.getByText('El nombre es obligatorio',{exact:true}).waitFor();
 await name.fill('Reintento');await page.evaluate(()=>{window.fixture.failProperty=true});await save.click();await page.getByText(/No se han podido guardar los cambios/).waitFor();assert.equal(await name.inputValue(),'Reintento');
 await page.evaluate(()=>{window.fixture.failProperty=false});await save.click();await page.waitForFunction(()=>window.fixture.properties[0].nombre==='Reintento');
 // Partial save: explicitly reported, repeated safely, no loss of edited quantities.
 await page.getByRole('tab',{name:'Consumos',exact:true}).click();await sheets.fill('9');await page.evaluate(()=>{window.fixture.failProperty=true});await save.click();await page.getByText(/Los consumos se han guardado, pero faltan/).waitFor();assert.equal(await sheets.inputValue(),'9');
 await page.evaluate(()=>{window.fixture.failProperty=false});await save.click();await page.waitForFunction(()=>window.fixture.properties[0].numeroSabanas===9);
 await page.getByRole('tab',{name:'Ficha',exact:true}).click();await page.getByRole('switch',{name:/Gestión de lavandería/}).click();
 await page.getByRole('tab',{name:'Consumos',exact:true}).click();assert.equal(await sheets.inputValue(),'0');assert.equal(await sheets.isDisabled(),true);
 await page.getByRole('button',{name:'Descartar',exact:true}).click();assert.equal(await sheets.inputValue(),'9');assert.equal(await sheets.isDisabled(),false);
 await page.getByRole('tab',{name:'Ficha',exact:true}).click();await name.fill('Pendiente');
 if(width>1000){page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:/Apartamento B/}).click();assert.equal(await name.inputValue(),'Pendiente');}
 if(width<1000){page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');assert.equal(await name.inputValue(),'Pendiente');}
 await page.getByRole('button',{name:'Descartar',exact:true}).click();
 // Independent in-flight saves survive selection changes, including mobile dialog closure.
 await page.evaluate(()=>{window.fixture.waitSaves=true;window.fixture.pendingSaves={};window.fixture.calls=[]});
 await name.fill('A segundo plano');await save.click();
 await page.waitForFunction(()=>!!window.fixture.pendingSaves.a);
 const selectProperty=async code=>{if(width<1000)await page.keyboard.press('Escape');await page.getByRole('button',{name:new RegExp(code)}).click();};
 await selectProperty('B2');assert.equal(await name.inputValue(),'Apartamento B');
 assert.equal(await page.evaluate(()=>window.fixture.properties[0].nombre),'Reintento');
 await selectProperty('A1');assert.equal(await name.inputValue(),'A segundo plano');assert.equal(await name.isDisabled(),true);
 await selectProperty('B2');await name.fill('B segundo plano');await save.click();await page.waitForFunction(()=>!!window.fixture.pendingSaves.b);
 await page.evaluate(()=>window.fixture.pendingSaves.a.resolve());await page.waitForFunction(()=>window.fixture.properties[0].nombre==='A segundo plano');
 assert.equal(await name.inputValue(),'B segundo plano');assert.equal(await name.isDisabled(),true);
 await selectProperty('A1');assert.equal(await name.inputValue(),'A segundo plano');
 await page.evaluate(()=>window.fixture.pendingSaves.b.reject(Error('Background failure')));
 if(width<1000)await page.keyboard.press('Escape');
 await page.getByRole('alert').filter({hasText:'Cambios pendientes en Apartamento B'}).waitFor();
 await page.getByRole('button',{name:'Ver propiedad',exact:true}).click();assert.equal(await name.inputValue(),'B segundo plano');
 await page.evaluate(()=>{window.fixture.waitSaves=false});await save.click();await page.waitForFunction(()=>window.fixture.properties[1].nombre==='B segundo plano');
 assert.equal(await page.evaluate(()=>window.fixture.calls.filter(c=>c.id==='a').length),1);
 assert.equal(await page.evaluate(()=>window.fixture.calls.filter(c=>c.id==='b').length),2);
 assert.equal(await name.inputValue(),'B segundo plano');
 await page.screenshot({path:(process.env.TEMP||'/tmp')+'/property-inline-'+width+'.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS inline property editing '+width+': tabs, discard, scoped save, validation, failure/retry, partial save, navigation, background saves and recoverable failure');await page.close();
}
} finally {await browser.close()}
