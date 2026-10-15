import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import postcss from 'postcss';import tailwindcss from 'tailwindcss';import autoprefixer from 'autoprefixer';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
const t=await stockBagDatabase();
const mocks={
 '@/hooks/useAuth':`export const useAuth=()=>({user:{id:${JSON.stringify(t.admin)}}});`,
 '@/contexts/SedeContext':`export const useSede=()=>({activeSede:{id:${JSON.stringify(t.sede)}}});`,
 '@/hooks/useRolePermissions':`export const useRolePermissions=()=>({isAdminOrManager:()=>true});`,
 '@/hooks/useStock':`import{useMutation}from'@tanstack/react-query';import{stockStorage}from'@/services/storage/stockStorage';export const useAdjustStock=()=>useMutation({mutationFn:input=>stockStorage.adjustStock(input)});export const useStockWarehouses=()=>({data:[{id:${JSON.stringify(t.central)},name:'Almacén de prueba',location_type:'central',is_active:true,is_default:true}]});`,
 '@/services/laundryCycleService':`export const cycleRpc=async(name,args)=>{const r=await window.fixtureRPC(name,args);if(r.error)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.data;};`,
 './laundryCycleService':`export const cycleRpc=async(name,args)=>{const r=await window.fixtureRPC(name,args);if(r.error)throw Object.assign(Error(r.error.message),{code:r.error.code});return r.data;};`,
 '@/integrations/supabase/client':`export const supabase={rpc(){throw Error('Unexpected direct client call')}};`,
 '@/services/aiObservedEvents':`export const recordAiObservedEvent=()=>{};`,
};
const built=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Setup from './src/components/stock/BagAccountingSetup';import{StockCountDialog}from'./src/components/stock/StockCountDialog';import{StockAdjustmentDialog}from'./src/components/stock/StockAdjustmentDialog';const root=createRoot(document.getElementById('root'));const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.renderFixture=()=>root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/inventory/config?seguimientoDesde=${t.start}']}><Setup/><StockCountDialog open={!!window.showCount} onOpenChange={v=>{window.showCount=v;window.renderFixture();}} levels={window.fixtureLevels||[]}/><StockAdjustmentDialog open={!!window.showAdjustment} onOpenChange={v=>{window.showAdjustment=v;window.renderFixture();}} level={window.fixtureLevel||null}/></MemoryRouter></QueryClientProvider>);window.renderFixture();`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
const {css}=await postcss([tailwindcss('tailwind.config.ts'),autoprefixer]).process(readFileSync('src/index.css','utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm,''),{from:'src/index.css'});
const html=`<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>${css}</style></head><body><div id='root'></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:existsSync('/usr/bin/google-chrome')?{executablePath:'/usr/bin/google-chrome'}:{})});
let loseActivation=true,loseManual=true;const requests=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRPC',async(name,args)=>{
  requests.push({name,args});
  try{const data=await t.rpc(name,args);if(name==='activate_stock_bag_accounting_checked'&&loseActivation){loseActivation=false;return{error:{message:'Connection lost after commit'}};}if(name==='adjust_bag_stock_checked'&&args._kind==='entrada'&&loseManual){loseManual=false;return{error:{message:'Connection lost after manual commit'}};}return{data};}
  catch(error){return{error:{message:error.message,code:error.code}};}
 });
 await page.route('**/*',r=>r.request().url()==='https://bag-stock.local.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.goto('https://bag-stock.local.test/');
 await page.getByRole('button',{name:'Calcular vista previa'}).click();
 await expect(page.getByText('12 productos · 2 bolsas registradas.',{exact:false})).toBeVisible();
 const activate=page.getByRole('button',{name:'Activar descuento por bolsas con estos saldos'});
 await expect(activate).toBeDisabled();
 await page.getByLabel('He revisado estas cantidades.',{exact:false}).check();await activate.click();
 await expect(page.getByRole('button',{name:'Reintentar operación pendiente'})).toBeVisible();
 assert.equal(Number((await t.level()).current_quantity),-3,'server committed once despite missing acknowledgment');
 const original=requests.find(r=>r.name==='activate_stock_bag_accounting_checked');
 await page.reload();await page.getByRole('button',{name:'Reintentar operación pendiente'}).click();
 await expect(page.getByText('Descuento por bolsas activo desde',{exact:false})).toBeVisible();
 assert.deepEqual(requests.filter(r=>r.name===original.name)[1].args,original.args,'reload preserves exact request and operation identity');
 assert.equal(Number((await t.level()).current_quantity),-3);
 const soap=await t.level(t.soap);
 await page.evaluate(level=>{window.fixtureLevels=[{...level,current_quantity:Number(level.current_quantity),stock_version:Number(level.stock_version),bag_accounting_active:true,product:{name:'Amenities de prueba',unit_of_measure:'unidades'},warehouse:{name:'Almacén de prueba'}}];window.showCount=true;window.renderFixture();},soap);
 await page.getByLabel('Contado: Amenities de prueba en Almacén de prueba').fill('18');
 await page.getByRole('button',{name:'Guardar recuento (1 línea)',exact:true}).click();
 await expect.poll(async()=>(await t.level(t.soap)).quantity_basis).toBe('counted');
 assert.equal(Number((await t.level(t.soap)).current_quantity),18,'same quantity became a checked physical count');
 await expect(page.getByRole('dialog')).toBeHidden();
 const showAdjustment=async()=>{
  const level=await t.level(t.soap);
  await page.evaluate(level=>{window.fixtureLevel={...level,current_quantity:Number(level.current_quantity),stock_version:Number(level.stock_version),bag_accounting_active:true,product:{name:'Amenities de prueba'},warehouse:{name:'Almacén de prueba'}};window.showAdjustment=true;window.renderFixture();},level);
 };
 await showAdjustment();await page.getByLabel('Cantidad',{exact:true}).fill('2');await page.getByLabel('Motivo',{exact:true}).fill('Compra comprobada');
 await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
 await expect(page.getByRole('button',{name:'Reintentar movimiento pendiente'})).toBeVisible();
 assert.equal(Number((await t.level(t.soap)).current_quantity),20);
 const pendingManual=requests.filter(r=>r.name==='adjust_bag_stock_checked'&&r.args._kind==='entrada')[0];
 await page.reload();await showAdjustment();
 await expect(page.getByLabel('Cantidad',{exact:true})).toHaveValue('2');await expect(page.getByLabel('Motivo',{exact:true})).toHaveValue('Compra comprobada');
 await page.getByRole('button',{name:'Reintentar movimiento pendiente'}).click();await expect(page.getByRole('dialog')).toBeHidden();
 assert.deepEqual(requests.filter(r=>r.name===pendingManual.name&&r.args._kind==='entrada')[1],pendingManual);
 assert.equal(Number((await t.level(t.soap)).current_quantity),20,'manual retry after reload never duplicates stock');

 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(tmpdir(),'stock-bag-accounting-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS real setup/count UI + exact SQL: preview, deliberate start, lost activation acknowledgment, reload and identity reuse, same-value physical count, manual acknowledgment lost and recovered after reload, mobile/desktop and no external network.');
}finally{await browser.close();await t.db.close();}
