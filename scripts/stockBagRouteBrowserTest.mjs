import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';
import {stockBagDatabase} from './stockBagAccountingTestSupport.mjs';
const t=await stockBagDatabase();await t.activate();
const worker={routeWorkerId:t.worker,cleanerId:(await t.db.query('SELECT cleaner_id FROM laundry_route_workers WHERE id=$1',[t.worker])).rows[0].cleaner_id,workerName:'Equipo de prueba',sedeId:t.sede};
const requests=[];
async function workflow(){
 const bags=[];
 for(const id of [t.task,t.second]){
  const row=(await t.db.query('SELECT * FROM stock_bag_consumption WHERE task_key=$1',[id])).rows[0];
  const prep=(await t.db.query('SELECT content_snapshot FROM laundry_bag_preparations WHERE task_id=$1',[id])).rows[0].content_snapshot;
  const delivered=(await t.db.query("SELECT count(*)::int n FROM laundry_delivery_tracking WHERE task_id=$1 AND status='delivered' AND delivered_at>=$2",[id,row.changed_at])).rows[0].n>0;
  bags.push({...prep,taskId:id,propertyId:t.property,propertyCode:'DEMO',propertyName:'Propiedad de prueba',address:'Dirección de prueba',date:t.date,serviceTime:'10:00',cleaner:null,isNew:false,stockChangedAt:row.changed_at.toISOString(),bagStatus:{status:'prepared'},deliveryTracking:{collectionStatus:'pending',deliveryStatus:delivered?'delivered':'pending'}});
 }
 return{workflowVersion:'route_v2',inventoryCycleEnabled:true,stockTrackingMode:'partial',route:{deliveryDate:t.date,nextDeliveryDate:t.date,routeName:'Ruta de prueba',nextRouteName:'Siguiente',routeDates:[t.date],nextRouteDates:[]},urgentBags:[],currentRouteBags:bags,nextRouteBags:[],blockingStep:'deliver',stats:{urgentPending:0,currentTotal:bags.length,nextTotal:0,nextPrepared:0,nextIssues:0,collected:0,delivered:bags.filter(b=>b.deliveryTracking.deliveryStatus==='delivered').length}};
}
const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{LaundryRouteV2View}from'./src/components/laundry-share/LaundryRouteV2View';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LaundryRouteV2View token="fixture"/></QueryClientProvider>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline',setup(b){b.onResolve({filter:/integrations\/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={functions:{invoke:(name,{body})=>window.fixtureRequest(name,body)}};'}));}}]});
const css=readdirSync('dist/assets').filter(f=>/^index-.*\.css$/.test(f)).map(f=>readFileSync('dist/assets/'+f,'utf8')).join('\n');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureRequest',async(name,body)=>{
  if(name==='laundry-route-access')return{data:{success:true,required:true,worker},error:null};
  requests.push(body);
  try{if(body.action==='deliver')await t.rpc('deliver_stock_bag_checked',{_task:body.taskId,_link:t.link,_worker:t.worker,_cleaner:worker.cleanerId,_name:worker.workerName,_snapshot:body.expectedBag});return{data:{success:true,workflow:await workflow()},error:null};}
  catch(error){return{data:null,error:{message:error.message}};}
 });
 await page.route('**/*',r=>r.request().url()==='http://partial-route.test/'?r.fulfill({contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div></body></html>`}):r.abort());
 const open=async()=>{await page.goto('http://partial-route.test/');await page.evaluate(({worker})=>localStorage.setItem('laundry-route-access:fixture',JSON.stringify({worker,sessionToken:'synthetic-session',expiresAt:'2099-01-01T00:00:00Z'})),{worker});await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('heading',{name:'Recogida y entrega de hoy',exact:true}).waitFor();};
 await open();const displayed=await workflow();await t.prepare(t.task,t.snapshot(3,1,1));
 await page.getByRole('button',{name:'Entregar',exact:true}).first().click();
 await expect.poll(()=>requests.filter(r=>r.action==='deliver').length).toBe(1);
 await expect.poll(async()=>(await t.db.query('SELECT count(*)::int n FROM laundry_delivery_tracking')).rows[0].n).toBe(0);
 assert.equal(requests.find(r=>r.action==='deliver').expectedBag.stockChangedAt,displayed.currentRouteBags[0].stockChangedAt);
 await open();const before=Number((await t.level()).current_quantity);
 await page.getByRole('button',{name:'Entregar',exact:true}).first().click();
 await expect.poll(async()=>(await t.db.query('SELECT count(*)::int n FROM laundry_delivery_tracking')).rows[0].n).toBe(1);
 assert.equal(Number((await t.level()).current_quantity),before,'delivery never debits central stock a second time');assert.deepEqual(errors,[]);
 console.log('PASS partial worker route + exact SQL: displayed version retained, stale delivery refused, fresh delivery recorded and no second stock deduction; no external network.');
}finally{await browser.close();await t.db.close();}
