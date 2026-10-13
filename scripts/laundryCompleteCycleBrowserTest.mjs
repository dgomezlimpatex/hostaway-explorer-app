import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
const t=await completeCycleDatabase();const product=t.productMap.bath_towels;
await t.db.query("UPDATE stock_products SET name='Toallas de baño' WHERE id=$1",[product]);
const mocks={
 '@/contexts/SedeContext':`export const useSede=()=>({activeSede:{id:'${t.sede}'}});`,
 '@/hooks/useAuth':`export const useAuth=()=>({user:{id:'${t.admin}'}});`,
 '@/hooks/useRolePermissions':`export const useRolePermissions=()=>({isAdminOrManager:()=>window.fixtureRole!=='logistics'});`,
 '@/hooks/useProperties':`export const useProperties=()=>({data:[{id:'${t.property}',codigo:'DEMO-EDIFICIO',isActive:true,linenControlEnabled:true},{id:'${t.solo}',codigo:'DEMO-DIRECTA',isActive:true,linenControlEnabled:true}]});`,
 '@/hooks/useStock':`export const useStockWarehouses=()=>({data:[{id:'${t.central}',name:'Central de prueba',is_active:true,location_type:'central'},{id:'${t.building}',name:'Edificio de prueba',is_active:true,location_type:'building_storage'}]});export const useStockProducts=()=>({data:[{id:'${product}',name:'Toallas de baño'}]});`,
 '@/integrations/supabase/client':`export const supabase={rpc:async(name,args)=>{try{return {data:await window.fixtureRpc(name,args),error:null};}catch(e){return {data:null,error:{message:e.message}};}}};`,
};
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Setup from './src/components/stock/LaundryCycleSetup';const root=createRoot(document.getElementById('root'));const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.renderFixture=()=>root.render(<QueryClientProvider client={client}><div className="mx-auto max-w-5xl p-4"><Setup/></div></QueryClientProvider>);window.renderFixture();`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-fixture',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>p.includes('integrations/supabase/client.ts')),'No real Supabase client, credentials or auth in browser');
const {css}=await postcss([tailwindcss('tailwind.config.ts'),autoprefixer]).process(readFileSync('src/index.css','utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm,''),{from:'src/index.css'});
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const artifacts=mkdtempSync(join(tmpdir(),'laundry-cycle-browser-'));writeFileSync(join(artifacts,'fixture.html'),html);
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];let dropped=null;const operations=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRpc',async(name,args)=>{operations.push({name,args});const result=await t.rpc(name,args);if(name===dropped){dropped=null;throw new Error('Conexión interrumpida después de guardar');}return result;});
 await page.route('**/*',r=>r.request().url()==='https://laundry-cycle.local.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.goto('https://laundry-cycle.local.test/');await expect(page.getByText('Preparación · sin automatizar',{exact:true})).toBeVisible();
 await page.getByLabel('Primer día del circuito').fill(t.date);await page.getByLabel('Modo de recogida').selectOption('all');await page.getByLabel('Destino de la ropa sucia').selectOption('central');await page.getByLabel('Destino de la ropa rechazada').selectOption('immediate');
 await page.getByRole('button',{name:'Seleccionar todas con lencería',exact:true}).click();await expect(page.getByLabel('DEMO-EDIFICIO',{exact:true})).toBeChecked();await expect(page.getByLabel('DEMO-DIRECTA',{exact:true})).toBeChecked();await page.getByRole('button',{name:'Guardar alcance y operativa'}).click();
 await expect(page.getByRole('heading',{name:'Recuento inicial'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar recuento comprobado'})).toBeDisabled();
 const tabs={clean:'Limpia en almacenes',installed:'Instalada',dirty:'Sucia por propiedad',outside:'Pendiente en lavandería',rejected:'Rechazada en el almacén',collected:'Sucia recogida en el almacén'};
 for(const [kind,label]of Object.entries(tabs)){
  await page.getByRole('button',{name:label,exact:true}).click();const req=(await t.rpc('read_laundry_cycle_checked',{_sede:t.sede})).requirements.filter(r=>r.kind===kind);
  for(const r of req){const count=t.counts.find(c=>c.productId===r.productId&&c.kind===r.kind&&(c.warehouseId??null)===r.warehouseId&&(c.propertyId??null)===r.propertyId);await page.getByLabel(`${r.productName} · ${r.locationName} · total`,{exact:true}).fill(String(count.quantity));if(kind==='clean')await page.getByLabel(`${r.productName} · ${r.locationName} · ya preparada`,{exact:true}).fill('0');}
 }
 await page.getByText('He comprobado las cantidades físicas antes de guardar o activar.',{exact:true}).click();dropped='open_laundry_cycle_checked';await page.getByRole('button',{name:'Guardar recuento comprobado'}).click();
 await expect(page.getByRole('button',{name:'Reintentar la operación',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Reintentar la operación',exact:true})).toBeVisible();await page.getByRole('button',{name:'Reintentar la operación',exact:true}).click();await expect(page.getByText('Guardado correctamente.',{exact:true})).toBeVisible();
 const countOps=operations.filter(o=>o.name==='open_laundry_cycle_checked');assert.equal(countOps.length,2);assert.deepEqual(countOps[0].args,countOps[1].args,'Reload retries same measured count');
 await page.getByText('He comprobado las cantidades físicas antes de guardar o activar.',{exact:true}).click();await page.getByRole('button',{name:'Activar estas propiedades'}).click();await expect(page.getByText('Activo en las propiedades elegidas',{exact:true})).toBeVisible();
 await t.route(t.task,'prepare');await t.route(t.task,'deliver');await t.db.query("UPDATE tasks SET status='completed' WHERE id=$1",[t.task]);await t.route(t.second,'collect');await page.reload();
 await page.getByRole('button',{name:'Registrar envío conjunto a lavandería'}).click();await page.getByLabel('Enviar Toallas de baño',{exact:true}).fill('1');await page.getByLabel('Motivo del envío').fill('Entrega conjunta comprobada');dropped='laundry_cycle_send_checked';await page.getByRole('button',{name:'Confirmar cantidades enviadas'}).click();
 await expect(page.getByRole('button',{name:'Reintentar la operación',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Reintentar la operación',exact:true}).click();await expect(page.getByText('Guardado correctamente.',{exact:true})).toBeVisible();
 const sends=operations.filter(o=>o.name==='laundry_cycle_send_checked');assert.equal(sends.length,2);assert.deepEqual(sends[0].args,sends[1].args,'Same UUID after dropped confirmation');assert.equal(sends[0].args._lines[0].expectedQuantity,2);
 assert.equal(Number((await t.db.query('SELECT quantity FROM laundry_cycle_collected WHERE sede_id=$1 AND product_id=$2',[t.sede,product])).rows[0].quantity),1);
 await page.evaluate(()=>{window.fixtureRole='logistics';window.renderFixture();});await expect(page.getByRole('button',{name:'Registrar envío conjunto a lavandería'})).toHaveCount(0);
 for(const width of[320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow at ${width}`);await page.screenshot({path:join(artifacts,`active-${width}.png`),fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS real setup UI + exact database: unknown counts, activation, mobile/desktop, role controls, stored count and dispatch retry after lost acknowledgment. No external network.');console.log('Artifacts: '+artifacts);
}finally{await browser.close();await t.db.close();}
