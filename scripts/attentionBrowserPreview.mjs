import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const repo=path.resolve(import.meta.dirname,'..');
const output=process.env.ATTENTION_PREVIEW_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'limpatex-attention-browser-'));
fs.mkdirSync(output,{recursive:true});
const storage=`
const base={sedeId:'s1',date:'2026-10-05',startTime:'09:00',endTime:'10:00',propertyDurationMinutes:60,cleanerId:'c1',cleaner:'Ana',status:'pending',client:'Cliente de ejemplo',address:'Dirección de ejemplo'};
const tasks=Array.from({length:7},(_,i)=>({...base,id:'t'+(i+1),property:'Apartamento '+(i+1)}));
tasks[2]={...tasks[2],startTime:'11:30',endTime:'12:30'}; tasks[6]={...tasks[6],startTime:'11:35',endTime:'12:35'};
tasks[5]={...tasks[5],status:'completed',propertyDurationMinutes:120,endTime:'11:00',assignmentCount:2,assignments:[{cleaner_id:'c1',cleaner_name:'Ana'},{cleaner_id:'c2',cleaner_name:'Bea'}]};
const report=(task_id,end_time,cleaner_id='c1')=>({id:task_id+cleaner_id,task_id,cleaner_id,overall_status:end_time?'completed':'in_progress',start_time:'2026-10-05T07:00:00Z',end_time});
const reports=[report('t1'),report('t4','2026-10-05T07:40:00Z'),report('t5','2026-10-05T08:20:00Z'),report('t6','2026-10-05T08:00:00Z'),report('t6',null,'c2')];
tasks[3].status='completed';tasks[4].status='completed';export const previewTasks=tasks;const reviews=[];
export async function readAttentionDay(sede,date){ window.readCount=(window.readCount||0)+1;if(window.failRead)throw Error('No se pudieron cargar los avisos.');return {tasks:window.empty?[]:tasks,reports,reviews:reviews.filter(r=>r.sede_id===sede&&r.task_date===date)}; }
export async function reviewAlert(alert){if(window.failReview)throw Error('No se pudo guardar la revisión.');if(!reviews.some(r=>r.alert_key===alert.key))reviews.push({id:alert.key,sede_id:alert.sedeId,task_id:alert.taskId,task_date:alert.taskDate,alert_key:alert.key,kind:alert.kind,snapshot:alert,reviewed_by:'u1',reviewed_by_name:'Dani (ejemplo)',reviewed_at:new Date().toISOString()});}
export async function readReviewHistory(sede,from,to,kind,offset){return reviews.filter(r=>r.sede_id===sede&&r.task_date>=from&&r.task_date<=to&&(kind==='all'||r.kind===kind)).slice(offset,offset+100);}
`;
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {previewTasks} from '@/features/attention/storage';import {AttentionWidget} from '@/features/attention/AttentionWidget';
import DesktopManagerDashboard from '@/components/dashboard/DesktopManagerDashboard';import {MobileManagerDashboard} from '@/components/dashboard/MobileManagerDashboard';
const client=new QueryClient({defaultOptions:{queries:{retryDelay:10}}});window.queryClient=client;
const props={todayTasks:previewTasks,unassignedTasks:[],monthlyMetrics:{currentMonth:0,lastMonth:0,percentageChange:0,isPositive:true},pendingIncidents:0,onTaskClick:()=>{},onOpenCreateModal:()=>{},onOpenBatchModal:()=>{},showRouteV2:false,showWorkloadWidget:false,showLinenWidget:false,workloadWidget:null,linenWidget:null,attentionWidget:<AttentionWidget onTask={task=>window.openedTask=task.id}/>};
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><BrowserRouter>{location.search.includes('mobile')?<MobileManagerDashboard {...props}/>:<DesktopManagerDashboard {...props}/>}</BrowserRouter></QueryClientProvider>);
`;
await build({stdin:{contents:entry,resolveDir:repo,loader:'tsx'},outfile:path.join(output,'preview.js'),bundle:true,jsx:'automatic',tsconfig:path.join(repo,'tsconfig.app.json'),plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/features\/attention\/storage$|^\.\/storage$/},()=>({path:'storage',namespace:'fixture'}));
 b.onResolve({filter:/\/contexts\/SedeContext$/},()=>({path:'sede',namespace:'fixture'}));
 b.onResolve({filter:/\/hooks\/useRolePermissions$/},()=>({path:'roles',namespace:'fixture'}));
 b.onResolve({filter:/\/hooks\/useClientData$/},()=>({path:'clients',namespace:'fixture'}));
 b.onResolve({filter:/\/sede\/SedeSelector$/},()=>({path:'selector',namespace:'fixture'}));
 b.onResolve({filter:/\/mobile\/MobileBottomNav$/},()=>({path:'nav',namespace:'fixture'}));
 b.onResolve({filter:/\/modals\/GroupedTaskReportModal$/},()=>({path:'reports',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'tsx',resolveDir:repo,contents:args.path==='storage'?storage:args.path==='sede'?"export const useSede=()=>({activeSede:{id:'s1'},isInitialized:true,loading:false});":args.path==='roles'?"export const useRolePermissions=()=>({isAdminOrManager:()=>true});":args.path==='clients'?"export const useClientData=()=>({getClientName:()=> 'Cliente de ejemplo'});":args.path==='selector'?"export const SedeSelector=()=> <span>Sede de ejemplo</span>;":args.path==='nav'?"export const MobileBottomNav=()=>null;":"export const GroupedTaskReportModal=({task,open})=>open?<div role='dialog'>Reportes de ejemplo: {task.property}</div>:null;"}));
}}]});
const css=fs.readdirSync(path.join(repo,'dist/assets')).find(n=>n.startsWith('index-')&&n.endsWith('.css'));
fs.copyFileSync(path.join(repo,'dist/assets',css),path.join(output,'preview.css'));
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Requiere tu atención · Ejemplo local</title><link rel="stylesheet" href="preview.css"><div id="root"></div><script src="preview.js"></script></html>');
const server=http.createServer((req,res)=>{const filename=req.url.startsWith('/preview.')?req.url.slice(1):'index.html';res.setHeader('Content-Type',filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(output,filename)));}).listen(8098,'127.0.0.1');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const forbidden=[];await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith('http://127.0.0.1:8098/'))return route.continue();forbidden.push(url);return route.abort();});
 await page.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-05T12:00:00+02:00']));}static now(){return new NativeDate('2026-10-05T12:00:00+02:00').getTime();}};});
 await page.goto('http://127.0.0.1:8098/');
 const panel=page.getByRole('region',{name:'Requiere tu atención'});await panel.getByLabel('7 tareas afectadas').waitFor();
 assert.equal(await panel.getByRole('button',{name:/Apartamento/}).count(),5);
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await panel.getByRole('button',{name:/Ver todas las alertas/}).click();
 assert.equal(await page.getByRole('dialog').getByRole('button',{name:/Apartamento/}).count(),7);
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 await panel.getByRole('button',{name:'Duración a revisar (2)',exact:true}).click();
 assert.equal(await panel.getByRole('button',{name:/Apartamento/}).count(),2);
 await panel.getByRole('button',{name:/Apartamento 4/}).click();
 await page.evaluate(()=>{window.failReview=true;});await page.getByRole('button',{name:'Marcar como revisado',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'No se pudo guardar'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Marcar como revisado',exact:true}).count(),1);
 await page.evaluate(()=>{window.failReview=false;});await page.getByRole('button',{name:'Marcar como revisado',exact:true}).click();
 await page.getByText('No quedan avisos pendientes en esta tarea.').waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 await panel.getByRole('button',{name:'Historial',exact:true}).click();await page.getByText(/Revisado por Dani/).waitFor();
 await page.getByLabel('Tipo').selectOption('unfinished');await page.getByText('No hay avisos revisados en este periodo.').waitFor();
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8098/?mobile');await panel.getByLabel('7 tareas afectadas').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 await panel.getByRole('button',{name:/Apartamento 1/}).click();await page.getByRole('button',{name:'Ver tarea',exact:true}).click();assert.equal(await page.evaluate(()=>window.openedTask),'t1');
 await page.evaluate(async()=>{window.empty=true;await window.queryClient.invalidateQueries({queryKey:['operational-attention']});});await page.getByText('No hay tareas que requieran atención ahora',{exact:true}).waitFor();
 await page.evaluate(async()=>{window.failRead=true;await window.queryClient.invalidateQueries({queryKey:['operational-attention']});});await panel.getByRole('alert').waitFor();
 await page.evaluate(()=>{window.failRead=false;window.empty=false;});await panel.getByRole('button',{name:'Reintentar'}).click();await panel.getByLabel('7 tareas afectadas').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 console.log('attention-browser: OK (real desktop/mobile dashboards, four filters, five-row limit, detail, failed/successful review, history, empty/error/retry, task link; zero external requests)');
 console.log('Preview artifacts: '+output);
}finally{await browser.close();if(!process.argv.includes('--serve'))server.close();}
if(process.argv.includes('--serve'))console.log('Example running at http://127.0.0.1:8098/ and ?mobile');
