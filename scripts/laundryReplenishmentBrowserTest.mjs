import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
const patch=readFileSync(new URL('../supabase/migrations/20261015173000_laundry_replenishment_start.sql',import.meta.url),'utf8');
async function completeCycleDatabase(){const t=await stockBagDatabase();await t.db.exec(patch);return t;}
const t=await completeCycleDatabase();const product=t.productMap.bath_towels;
await t.configure('all',false,'central','central');
await t.db.query("UPDATE laundry_cycle_config SET opening_unknown_kinds=ARRAY['outside'] WHERE sede_id=$1",[t.sede]);
await t.rpc('open_laundry_cycle_checked',{_sede:t.sede,_counts:t.counts.filter(c=>c.kind!=='outside'),_measured:new Date(Date.now()-1000).toISOString()});
await t.rpc('activate_laundry_cycle_checked',{_sede:t.sede});
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
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRpc',async(name,args)=>t.rpc(name,args));
 await page.route('**/*',r=>r.request().url()==='https://laundry-replenishment.local.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.goto('https://laundry-replenishment.local.test/');
 await expect(page.getByText('Activo en las propiedades elegidas',{exact:true})).toBeVisible();
 await expect(page.getByRole('note')).toContainText('Saldo inicial sin contabilizar');
 await expect(page.getByRole('note')).toContainText('Pendiente en lavandería');
 await expect(page.getByRole('note')).toContainText('no representan el total anterior');
 for(const width of[320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow at '+width);await page.screenshot({path:join(artifacts,'unknown-opening-'+width+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS actual setup UI: explicit unknown laundry opening, movements-only explanation, mobile and desktop; no external network.');console.log('Artifacts: '+artifacts);
}finally{await browser.close();await t.db.close();}

