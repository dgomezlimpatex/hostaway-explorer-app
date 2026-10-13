import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
const t=await completeCycleDatabase();const product=t.productMap.bath_towels;
await t.configure();await t.open();await t.activate();await t.db.query('UPDATE properties SET numero_toallas_grandes=CASE WHEN id=$1 THEN 4 ELSE 5 END',[t.property]);await t.route(t.task,'prepare');
const bags=[t.task,t.second,t.direct].map((taskId,i)=>({taskId,propertyId:i===2?t.solo:t.property,propertyCode:'DEMO-'+i,date:t.date,warehouseId:i===2?null:t.building,state:'pending',issue:null,lines:[{productId:product,name:'Toalla',quantity:99}]}));
const mocks={
 '@/contexts/SedeContext':`export const useSede=()=>({activeSede:{id:'${t.sede}'}});`,
 '@/hooks/useAuth':`export const useAuth=()=>({user:{id:'${t.admin}'}});`,
 '@/hooks/useRolePermissions':`export const useRolePermissions=()=>({isAdminOrManager:()=>false,hasPermission:()=>false});`,
 '@/hooks/useStock':`const query=data=>({data,isSuccess:true,isLoading:false,isError:false,dataUpdatedAt:1,refetch:async()=>{}});const product={id:'${product}',name:'Toallas de baño',unit_of_measure:'unidades',is_consumable:true,is_active:true,category:{kind:'laundry'}};export const useStockProducts=()=>query([product]);export const useStockWarehouses=()=>query([{id:'${t.central}',name:'Central de prueba',location_type:'central',is_active:true,is_default:true}]);export const useStockLevels=()=>query([{id:'fixture-level',product_id:product.id,warehouse_id:'${t.central}',product,current_quantity:999,minimum_quantity:0,target_quantity:0,cost_per_unit:null}]);export const useStockSedeSettings=()=>query({auto_consumption_enabled:false});`,
 './inventoryReadiness':`export const readInventoryBags=async()=>${JSON.stringify(bags)};`,
 '@/integrations/supabase/client':`export const supabase={rpc:async(name,args)=>window.failRead?{data:null,error:{message:'Read failed',code:'XX000'}}:window.fixtureRpc(name,args)};`,
 '@/components/sede/SedeSelector':`export const SedeSelector=()=>null;`,
 './StockWarehouseSelect':`export const StockWarehouseSelect=()=>null;`,
};
for(const name of ['StockCountDialog','StockBulkSetupDialog','StockAdjustmentDialog','StockTransferDialog','StockProductDialog'])mocks['@/components/stock/'+name]=`export const ${name}=()=>null;`;
const built=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Stock from './src/pages/InventoryStock';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/inventory/stock']}><Stock/></MemoryRouter></QueryClientProvider>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty'},metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
assert.ok(!Object.keys(built.metafile.inputs).some(p=>p.includes('integrations/supabase/client.ts')));
const {css}=await postcss([tailwindcss('tailwind.config.ts'),autoprefixer]).process(readFileSync('src/index.css','utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm,''),{from:'src/index.css'});
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRpc',async(name,args)=>{try{return {data:await t.rpc(name,args),error:null};}catch(e){return{data:null,error:{message:e.message,code:e.code}};}});
 await page.route('**/*',r=>r.request().url()==='https://cycle-stock.local.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());await page.goto('https://cycle-stock.local.test/');
 await expect(page.getByText('Faltan 3',{exact:true})).toBeVisible();await expect(page.getByText('999',{exact:true})).toHaveCount(0);await expect(page.getByText('99',{exact:true})).toHaveCount(0);
 await page.locator('summary').filter({hasText:'Toallas de baño'}).click();await expect(page.getByText('6 disponibles · 4 reservadas en bolsas, incluidas en el stock registrado.',{exact:false})).toBeVisible();
 await page.evaluate(()=>{window.failRead=true;});await page.getByRole('button',{name:'Actualizar inventario',exact:true}).click();await expect(page.getByText('No se pudo consultar el inventario',{exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Toallas de baño',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{window.failRead=false;});await page.getByRole('button',{name:'Reintentar',exact:true}).click();await expect(page.getByText('Faltan 3',{exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);console.log('PASS real workspace hook and stock page: canonical quantity overrides legacy preview; physical 10, reserved 4, free 6, pending 9, shortage 3; failed live read hides stale balances. Exact database, no external network.');
}finally{await browser.close();await t.db.close();}
