import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
const workspace=`
import {buildingInventory,pendingDemand} from '@/features/inventory/inventoryDomain';
const central={id:'central',name:'Simón Bolívar',is_active:true,location_type:'central'};
const warehouses=[central,...Array.from({length:23},(_,i)=>({id:'w'+i,name:'Edificio '+i,is_active:true,location_type:'building_storage'}))];
const products=[{id:'sheet',name:'Sábanas matrimonio',is_consumable:true,category:{kind:'laundry'},unit_of_measure:'unidades'},{id:'spare',name:'Edredones',is_consumable:false,category:{kind:'laundry'},unit_of_measure:'unidades'},{id:'soap',name:'Amenities baño',is_consumable:true,category:{kind:'amenity'},unit_of_measure:'unidades'}];
const levels=products.map((product,i)=>({id:'l'+i,warehouse_id:'central',product_id:product.id,product,current_quantity:i===0?2:10,minimum_quantity:0,target_quantity:0,cost_per_unit:null}));
levels.push({id:'sp',warehouse_id:'w0',product_id:'spare',product:products[1],current_quantity:0,minimum_quantity:1,target_quantity:2});
const bags=[{taskId:'t',propertyCode:'DEMO-1',date:'2026-10-13',warehouseId:'w0',state:'pending',lines:[{productId:'sheet',name:'Sábanas matrimonio',quantity:3}]},{taskId:'t2',propertyCode:'DEMO-2',date:'2026-10-13',warehouseId:'w1',state:'prepared',lines:[{productId:'sheet',name:'Sábanas matrimonio',quantity:3}]}];
export const useInventoryWorkspace=days=>({central,warehouses,products,levels,bags,centralLevels:levels.filter(l=>l.warehouse_id==='central'),buildings:buildingInventory(warehouses,levels,bags,'central'),demand:pendingDemand(bags),from:'2026-10-13',to:days===1?'2026-10-13':days===7?'2026-10-19':'2026-10-15',stockError:window.fixtureError==='stock',stockLoading:false,demandError:window.fixtureError==='demand',demandReady:!window.fixtureError,settings:{preparation_mode:true},settingsError:false,updatedAt:1791885600000,refresh:()=>{window.retries=(window.retries||0)+1;}});
`;
const mocks={
  '@/features/inventory/ProvisionalInventoryPanel':`export const ProvisionalInventoryPanel=()=>null;`,
  '@/features/inventory/useInventoryWorkspace':workspace,
  '@/components/sede/SedeSelector':`export const SedeSelector=()=>null;`,
  './StockWarehouseSelect':`export const StockWarehouseSelect=()=>null;`,
  '@/components/stock/WarehouseSettings':`export default ()=>null;`,
  '@/hooks/useRolePermissions':`export const useRolePermissions=()=>({hasPermission:()=>true,isAdminOrManager:()=>true});`,
};
for(const name of ['StockCountDialog','StockBulkSetupDialog','StockAdjustmentDialog','StockTransferDialog','StockProductDialog']) mocks['@/components/stock/'+name]=`export const ${name}=({open,onOpenChange,levels,initialWarehouseId})=>open?<div role="dialog" aria-label="${name}"><p>{initialWarehouseId||levels?.map(l=>l.product.name).join(', ')}</p><button onClick={()=>onOpenChange(false)}>Cerrar operación de prueba</button></div>:null;`;
const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Dashboard from './src/pages/InventoryDashboard';import Stock from './src/pages/InventoryStock';import Buildings from './src/pages/InventoryWarehouses';import Preparation from './src/pages/InventoryPreparation';const root=createRoot(document.getElementById('root'));window.renderFixture=()=>root.render(<MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/inventory']}><Routes><Route path='/inventory' element={<Dashboard/>}/><Route path='/inventory/stock' element={<Stock/>}/><Route path='/inventory/laundry' element={<Stock kind='laundry'/>}/><Route path='/inventory/warehouses' element={<Buildings/>}/><Route path='/inventory/preparation' element={<Preparation/>}/></Routes></MemoryRouter>);window.renderFixture();`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',metafile:true,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:process.cwd()}));}}]});
assert.ok(!Object.keys(built.metafile.inputs).some(p=>p.includes('integrations/supabase')),'No backend or session in fixture');
const cssSource=readFileSync('src/index.css','utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm,'');
const {css}=await postcss([tailwindcss('tailwind.config.ts'),autoprefixer]).process(cssSource,{from:'src/index.css'});
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
writeFileSync(join(tmpdir(),'inventory-simplification-fixture.html'),html);
const executablePath=process.platform==='linux'&&existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined;
const browser=await chromium.launch({headless:true,executablePath,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>r.request().url()==='https://inventory.local.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
await page.goto('https://inventory.local.test/');
await expect(page.getByRole('heading',{name:'Simón Bolívar'})).toBeVisible();await expect(page.getByText('Faltan 1',{exact:true})).toBeVisible();
await page.getByRole('link',{name:'Abrir almacén central'}).click();
await expect(page.getByRole('heading',{name:'Sábanas matrimonio'})).toBeVisible();await expect(page.getByText('Edificio 22',{exact:true})).not.toBeVisible();
await page.getByRole('button',{name:'Repuestos',exact:true}).click();await expect(page.getByRole('heading',{name:'Edredones'})).toBeVisible();await expect(page.getByRole('heading',{name:'Sábanas matrimonio'})).toHaveCount(0);
await page.getByRole('button',{name:'Contar existencias'}).click();await expect(page.getByRole('dialog')).toContainText('Edredones');await page.getByRole('button',{name:'Cerrar operación de prueba'}).click();
await page.getByRole('button',{name:'Todo',exact:true}).click();await page.getByRole('textbox',{name:'Buscar producto'}).fill('sabanas');await expect(page.getByRole('heading',{name:'Sábanas matrimonio'})).toBeVisible();await expect(page.getByRole('heading',{name:'Edredones'})).toHaveCount(0);
await page.getByRole('link',{name:'Edificios',exact:true}).click();await expect(page.getByRole('heading',{name:'Edificio 0',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Edificio 22',exact:true})).toHaveCount(0);await expect(page.getByText('Repuestos del edificio',{exact:true})).not.toBeVisible();
await page.getByRole('button',{name:'Todos los edificios'}).click();await expect(page.getByRole('heading',{name:'Edificio 22',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Buscar edificio'}).fill('Edificio 0');await page.locator('summary').filter({has:page.getByRole('heading',{name:'Edificio 0',exact:true})}).click();await expect(page.getByText('Repuestos del edificio',{exact:true})).toBeVisible();
await page.getByRole('link',{name:'Mudas y reparto',exact:true}).click();await expect(page.getByText('DEMO-1',{exact:true})).not.toBeVisible();await page.locator('summary').filter({hasText:'Edificio 0'}).click();await expect(page.getByText('DEMO-1',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Preparadas',exact:true}).click();await page.locator('summary').filter({hasText:'Edificio 1'}).click();await expect(page.getByText('Preparada · entrega sin confirmar',{exact:true})).toBeVisible();
for(const path of ['/inventory','/inventory/stock','/inventory/warehouses','/inventory/preparation']){
await page.setViewportSize({width:390,height:844});await page.evaluate(path=>{window.fixturePath=path;window.renderFixture();},path);await expect(page.getByRole('navigation',{name:'Secciones de inventario'})).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`No horizontal overflow ${path}`);
}
await page.evaluate(()=>{window.fixtureError='stock';window.fixturePath='/inventory/stock';window.renderFixture();});await expect(page.getByRole('alert')).toContainText('No se pudo consultar el inventario');await expect(page.getByRole('heading',{name:'Sábanas matrimonio'})).toHaveCount(0);await page.getByRole('button',{name:'Reintentar',exact:true}).click();assert.equal(await page.evaluate(()=>window.retries),1);
await page.evaluate(()=>{window.fixtureError='demand';window.fixturePath='/inventory/preparation';window.renderFixture();});await expect(page.getByText('No se pudieron cargar las mudas. Reintenta la consulta.')).toBeVisible();await expect(page.getByText('DEMO-1',{exact:true})).toHaveCount(0);
assert.deepEqual(errors,[]);console.log('PASS inventory browser: four pages, central default, folded buildings and bags, filters, accented search, count scope, mobile layout and truthful errors. Real components, mocked reads and operations, no network.');
}finally{await browser.close();}
