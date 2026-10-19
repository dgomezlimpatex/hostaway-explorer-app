import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {fingerprint} from './guard.mjs';

test('controlador real recupera el turno auditado; cierra ambas reservas solo tras verificar publicación',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'limpatex-reviewed-recovery-')),repo=path.join(root,'control');
  t.after(()=>{assert(root.startsWith(path.join(os.tmpdir(),'limpatex-reviewed-recovery-')));fs.rmSync(root,{recursive:true,force:true});});
  fs.mkdirSync(repo);fs.cpSync(new URL('./',import.meta.url),path.join(repo,'automation/delivery'),{recursive:true});
  const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const write=(file,contents)=>{fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});fs.writeFileSync(path.join(repo,file),contents);};
  git(['init']);git(['config','user.name','Local Test']);git(['config','user.email','test@example.invalid']);
  write('package.json','{}');write('src/app.tsx','export const App=()=>"previous";');git(['add','.']);git(['commit','-m','previous production']);
  const base=git(['rev-parse','HEAD']),source=fingerprint(repo);
  git(['checkout','-b','codex/original']);write('src/app.tsx','export const App=()=>"escape fixed";');git(['add','.']);git(['commit','-m','app fix']);const head=git(['rev-parse','HEAD']);
  git(['checkout','-b','main',base]);git(['merge','--no-ff','codex/original','-m','reviewed app merge']);const main=git(['rev-parse','HEAD']);
  git(['checkout','-b','codex/repair']);write('docs/ENTREGA-AUTOMATICA.md','Coordinador revisado');git(['add','.']);git(['commit','-m','reviewed control repair']);const repair=git(['rev-parse','HEAD']);
  git(['checkout','main']);git(['merge','--no-ff','codex/repair','-m','repair merge']);const merged=git(['rev-parse','HEAD']);
  git(['checkout','--detach',repair]);git(['remote','add','origin',repo]);
  const cfg=JSON.parse(fs.readFileSync(path.join(repo,'automation/delivery/config.json')));
  const input={pr_number:'169',head_sha:repair,claim:'12345678-1234-1234-1234-123456789abc',authorization:'Dani autoriza reparar coordinador y recuperar publicación',recovery_reservation:'100',recovery_audit:'b'.repeat(64)};
  const fixture={base,source,head,main,repair,merged,cfg,input};
  const fixtureFile=path.join(root,'fixture.json'),trace=path.join(root,'trace.json'),output=path.join(root,'output');
  fs.writeFileSync(fixtureFile,JSON.stringify(fixture));fs.writeFileSync(path.join(root,'event.json'),JSON.stringify({inputs:input}));
  const preload=path.join(root,'mock.mjs');
  fs.writeFileSync(preload,`import fs from 'node:fs';
const f=JSON.parse(fs.readFileSync(process.env.FIXTURE)),calls=[];let polls=0,ready=false;
const originalTimer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>originalTimer(fn,Math.min(ms,1),...args);
const previous={number:168,state:'closed',draft:false,merged:true,merge_commit_sha:f.main,user:{login:f.cfg.owner},head:{sha:f.head,ref:'codex/original',repo:{full_name:f.cfg.repository}},base:{ref:'main'}};
const repair=()=>({...previous,number:169,state:ready?'closed':'open',merged:ready,merge_commit_sha:ready?f.merged:null,head:{...previous.head,sha:f.repair,ref:'codex/repair'}});
const marker={id:100,environment:'limpatex-release-reservation',payload:{kind:'limpatex-manual-v1',number:168,head:f.head,base:f.base,source:f.source,authorization:'Dani pidió corregir Escape sin afectar trabajo offline',runId:10}};
globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;
  calls.push({url:u.pathname,method,body});fs.writeFileSync(process.env.TRACE,JSON.stringify(calls));
  const api='/repos/'+f.cfg.repository,p=u.pathname.replace(api,'');let data;
  if(u.hostname==='api.vercel.com'&&u.pathname.startsWith('/v13/deployments/')) data={id:'previous-live',projectId:f.cfg.projectId,readyState:'READY',meta:{limpatexSourceFingerprint:process.env.DRIFT?'foreign':f.source}};
  else if(u.hostname!=='api.github.com') throw new Error('Unexpected external traffic '+url);
  else if(method==='POST'&&p==='/deployments')data={id:200,payload:body.payload};
  else if(method==='POST'&&/\\/deployments\\/\\d+\\/statuses$/.test(p))data=body;
  else if(p==='/pulls/168')data=previous;
  else if(p==='/pulls/169')data=repair();
  else if(p==='/git/ref/heads/main')data={object:{sha:ready?f.merged:f.main}};
  else if(p==='/deployments')data=[marker];
  else if(p==='/deployments/100')data=marker;
  else if(p==='/deployments/200')data={payload:{recoveryOf:100}};
  else if(p==='/deployments/100/statuses')data=[{state:'failure'}];
  else if(p==='/deployments/200/statuses'){ready=++polls>1;data=[{state:'in_progress',creator:{login:f.cfg.owner},description:ready?'Limpatex ready:'+f.merged:'Limpatex reservation active'}];}
  else if(p==='/actions/runs/10')data={id:10,status:'completed',event:'workflow_dispatch',actor:{login:f.cfg.owner},path:'.github/workflows/limpatex-reviewed-release.yml'};
  else if(p==='/git/commits/'+f.main)data={parents:[{sha:f.base},{sha:f.head}]};
  else if(/\\/commits\\/[^/]+\\/status$/.test(p))data={statuses:[{context:f.cfg.statusContext,state:'success'}]};
  else if(/\\/commits\\/[^/]+\\/check-runs$/.test(p))data={check_runs:[{name:'delivery-checks',conclusion:'success'}]};
  else throw new Error('Unexpected mock endpoint '+method+' '+p);
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};`);
  const env={...process.env,FIXTURE:fixtureFile,TRACE:trace,GITHUB_WORKSPACE:root,GITHUB_EVENT_PATH:path.join(root,'event.json'),GITHUB_OUTPUT:output,
    GITHUB_ACTOR:cfg.owner,GITHUB_SHA:repair,GITHUB_RUN_ID:'20',GH_TOKEN:'synthetic',VERCEL_TOKEN:'synthetic',RESERVATION_ID:'200',RECOVERY_RESERVATION_ID:'100'};
  const run=(command,extra={})=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,path.join(repo,'automation/delivery/controller.mjs'),command],{env:{...env,...extra},encoding:'utf8'});
  const held=run('manual-hold');assert.equal(held.status,0,held.stdout+held.stderr);
  assert.equal(git(['rev-parse','HEAD']),repair,'Later steps retain the exact reviewed recovery controller');
  const outputs=fs.readFileSync(output,'utf8');assert.match(outputs,/reservation=200/);assert.match(outputs,/recoveryReservation=100/);assert.match(outputs,new RegExp('commit='+merged));
  const writes=JSON.parse(fs.readFileSync(trace)).filter(c=>c.method==='POST');
  assert.equal(writes[0].body.payload.recoveryOf,100);assert.equal(writes[0].body.payload.source,source);
  assert(writes.every(c=>c.url.endsWith('/deployments')||c.url.endsWith('/deployments/200/statuses')),'Hold never changes the failed reservation or production');
  for(const result of ['failure','success']) {
    const closed=run('manual-close',{RELEASE_RESULT:result});assert.equal(closed.status,0,closed.stderr);
    const updates=JSON.parse(fs.readFileSync(trace)).filter(c=>c.method==='POST');
    assert.equal(updates.some(c=>c.url.endsWith('/deployments/100/statuses')),result==='success','Original turn only closes on verified success');
  }
  // Production drift must fail before granting a new turn.
  git(['checkout','--detach',repair]);
  const drift=run('manual-hold',{DRIFT:'1'});assert.notEqual(drift.status,0);
  assert.equal(JSON.parse(fs.readFileSync(trace)).filter(c=>c.method==='POST').length,0);
});
