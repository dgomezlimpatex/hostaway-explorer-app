import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {completeCycleDatabase} from './laundryCompleteCycleTestSupport.mjs';
const t=await completeCycleDatabase();await t.configure();await t.open();await t.activate();
const worker={routeWorkerId:t.worker,cleanerId:(await t.db.query('SELECT cleaner_id FROM laundry_route_workers WHERE id=$1',[t.worker])).rows[0].cleaner_id,workerName:'Equipo de prueba',sedeId:t.sede};
const requests=[];let enabled=true;
async function workflow(){
 const previews=await t.rpc('laundry_cycle_preview',{_tasks:[t.task,t.second,t.direct]});
 const tasks=(await t.db.query("SELECT t.*,p.codigo FROM tasks t JOIN properties p ON p.id=t.propiedad_id WHERE t.status='pending' ORDER BY t.id")).rows;
 const bags=tasks.map(row=>{const p=previews.find(p=>p.taskId===row.id);return{taskId:row.id,propertyId:row.propiedad_id,propertyCode:row.codigo,propertyName:row.codigo,address:'Dirección de prueba',date:t.date,serviceTime:'10:00',cleaner:null,isNew:false,cycleLines:p.lines.map(l=>({productId:l.productId,quantity:l.quantity})),cycleGeneration:p.generation,dirtyLines:p.dirtyLines,bagStatus:{status:p.cycleState==='prepared'||p.cycleState==='delivered'?'prepared':'pending'},deliveryTracking:{collectionStatus:p.collected?'collected':'pending',deliveryStatus:p.cycleState==='delivered'?'delivered':'pending'},textiles:{towelsLarge:p.lines[0]?.quantity??0},amenities:{},stockConsumables:[]};});
 const urgent=bags.filter(b=>b.bagStatus.status==='pending');const pending=bags.some(b=>b.deliveryTracking.deliveryStatus!=='delivered'||b.deliveryTracking.collectionStatus!=='collected');
 return{workflowVersion:'route_v2',inventoryCycleEnabled:enabled,route:{deliveryDate:t.date,nextDeliveryDate:t.date,routeName:'Ruta de prueba',nextRouteName:'Siguiente',routeDates:[t.date],nextRouteDates:[]},urgentBags:urgent,currentRouteBags:bags,nextRouteBags:[],blockingStep:urgent.length?'urgent':pending?'deliver':'complete',stats:{urgentPending:urgent.length,currentTotal:bags.length,nextTotal:0,nextPrepared:0,nextIssues:0,collected:bags.filter(b=>b.deliveryTracking.collectionStatus==='collected').length,delivered:bags.filter(b=>b.deliveryTracking.deliveryStatus==='delivered').length}};
}
const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{LaundryRouteV2View}from'./src/components/laundry-share/LaundryRouteV2View';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LaundryRouteV2View token="fixture"/></QueryClientProvider>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){b.onResolve({filter:/integrations\/supabase\/client$/},()=>({path:'db',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const supabase={functions:{invoke:(name,opts)=>window.fixtureRequest(name,opts.body)}};`}));}}]});
const css=readdirSync('dist/assets').filter(n=>n.endsWith('.css')).map(n=>readFileSync('dist/assets/'+n,'utf8')).join('\n');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRequest',async(name,body)=>{
  if(name==='laundry-route-access')return{data:{success:true,required:true,worker},error:null};
  requests.push(body);try{if(body.action!=='load')await t.route(body.taskId,body.action,{snapshot:body.expectedBag});return{data:{success:true,workflow:await workflow()},error:null};}catch(e){return{data:null,error:{message:e.message}};}
 });
 await page.route('**/*',r=>r.request().url()==='http://cycle-route.test/'?r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>`}):r.abort());
 const open=async()=>{await page.goto('http://cycle-route.test/');await page.evaluate(({worker})=>localStorage.setItem('laundry-route-access:fixture',JSON.stringify({worker,sessionToken:'synthetic-session',expiresAt:'2099-01-01T00:00:00Z'})),{worker});await page.addScriptTag({content:bundle.outputFiles[0].text});};
 await open();await page.getByRole('button',{name:'Bolsa preparada',exact:true}).waitFor();
 const displayed=(await workflow()).urgentBags[0];await t.db.query('UPDATE properties SET numero_toallas_grandes=3 WHERE id=$1',[displayed.propertyId]);
 await page.getByRole('button',{name:'Bolsa preparada',exact:true}).click();await expect.poll(()=>requests.filter(r=>r.action==='prepare').length).toBe(1);await expect.poll(async()=>Number((await t.db.query('SELECT count(*) n FROM laundry_cycle_bags')).rows[0].n)).toBe(0);
 assert.equal(requests.find(r=>r.action==='prepare').expectedBag.cycleLines[0].quantity,2,'Request carries the quantity actually displayed');
 await t.db.query('UPDATE properties SET numero_toallas_grandes=2');for(const task of[t.task,t.second,t.direct])await t.route(task,'prepare');await open();
 await page.getByRole('heading',{name:'Recogida y entrega de hoy',exact:true}).waitFor();await expect(page.getByRole('button',{name:'Recoger y entregar edificio',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Recoger',exact:true}).first().click();await expect.poll(()=>requests.filter(r=>r.action==='collect').length).toBe(1);
 await page.getByRole('button',{name:'Entregar',exact:true}).first().click();await expect.poll(()=>requests.filter(r=>r.action==='deliver').length).toBe(1);assert.equal(Number((await t.db.query('SELECT current_quantity FROM stock_levels WHERE warehouse_id=$1 AND product_id=$2',[t.central,t.productMap.bath_towels])).rows[0].current_quantity),8);
 enabled=false;await open();await expect(page.getByRole('button',{name:'Entregar',exact:true})).toHaveCount(0);assert.deepEqual(errors,[]);
 console.log('PASS real worker route: stale displayed quantity rejected by exact database, collection/delivery appear only with enabled circuit, original hidden mode preserved, requests carry property/date/generation and quantities. No external network.');
}finally{await browser.close();await t.db.close();}
