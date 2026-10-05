import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {canonicalTsx, checkCss} from './guard.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateReview, reservedEffects, changeDigest, verifyDelivery} from './scope.mjs';
import {runOffline} from './offline.mjs';
import {eligible, assertProduction, deploymentBody, assertTransition, entryAssets, cachedFileHashes} from './controller.mjs';
const code = 'export const View = () => <button className="p-2" onClick={() => save(1)}>Guardar</button>;';
test('permite textos y clases sin alterar acciones',()=>assert.equal(canonicalTsx(ts,code),canonicalTsx(ts,code.replace('p-2','p-4').replace('Guardar','Aceptar'))));
test('bloquea cambios de acciones y argumentos',()=>assert.notEqual(canonicalTsx(ts,code),canonicalTsx(ts,code.replace('save(1)','save(2)'))));
test('bloquea nuevos hooks y contenido ejecutable',()=>assert.notEqual(canonicalTsx(ts,code),canonicalTsx(ts,code.replace('Guardar','{fetch("https://example.org")}'))));
test('no enmascara condiciones ni llamadas con efectos en atributos',()=>{
  const condition='export const View=()=> <div className={count > 5 ? "p-2" : "p-4"} />;';
  assert.notEqual(canonicalTsx(ts,condition),canonicalTsx(ts,condition.replace('> 5','> 6')));
  const call='export const View=()=> <div className={save("a")} />;';
  assert.notEqual(canonicalTsx(ts,call),canonicalTsx(ts,call.replace('"a"','"b"')));
});
test('no permite cambiar nombres de funciones dentro de className',()=>{
  const before='export const View=()=> <div className={clsx("p-2", enabled && "flex")} />;';
  assert.notEqual(canonicalTsx(ts,before),canonicalTsx(ts,before.replace('clsx','leak')));
  assert.equal(canonicalTsx(ts,before),canonicalTsx(ts,before.replace('p-2','p-4')));
});
test('bloquea nuevas URLs CSS',()=>assert.throws(()=>checkCss('a{color:red}','a{background:url(https://example.org)}')));
test('permite colores CSS y conserva recursos existentes',()=>checkCss('a{color:red;background:url(/logo.png)}','a{color:blue;background:url(/logo.png)}'));
const cfg={owner:'dani', repository:'dani/app',baseBranch:'main',label:'auto',projectId:'project',initialDeployment:'initial',initialFingerprint:'base'};
const pr={state:'open',draft:false,user:{login:'dani'},base:{ref:'main'},head:{repo:{full_name:'dani/app'},ref:'codex/view'},labels:[{name:'auto'}],body:'Delivery-Scope: presentation\n'};
test('solo admite propuestas propias etiquetadas y con alcance explícito',()=>{
  assert(eligible(pr,cfg));
  assert(!eligible({...pr,draft:true},cfg));
  assert(!eligible({...pr,user:{login:'outsider'}},cfg));
  assert(!eligible({...pr,body:'Delivery-Scope: functionality\n'},cfg));
  assert(eligible({...pr,body:'Delivery-Scope: application\n'},cfg));
  assert(!eligible({...pr,head:{...pr.head,repo:{full_name:'fork/app'}}},cfg));
});

const review=()=>({version:1,scope:'application',digest:'checked',request:'Petición explícita de Dani para una función',reason:'Cálculo local sin cambios sobre sistemas externos',verification:'Pruebas focalizadas con casos de límite y regresión',effects:Object.fromEntries(reservedEffects.map(k=>[k,false])),tests:['scripts/calculate.test.mjs']});
test('pruebas funcionales sin red, sin root y sin elevar privilegios',{skip:process.platform!=='linux'},t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'limpatex-offline-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  fs.writeFileSync(path.join(repo,'probe.mjs'),`import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';assert.notEqual(process.getuid(),0);await assert.rejects(fetch('https://example.org',{signal:AbortSignal.timeout(3000)}));assert.notEqual(spawnSync('sudo',['-n','true']).status,0);`);
  const result=runOffline(repo,'probe.mjs');assert.equal(result.status,0,result.stderr);
});
test('exige revisión exacta, efectos explícitos y pruebas locales',()=>{
  assert.equal(validateReview(review(),'checked').scope,'application');
  assert.throws(()=>validateReview(review(),'different'));
  for(const key of reservedEffects) {
    assert.throws(()=>validateReview({...review(),effects:{...review().effects,[key]:true}},'checked'));
    const missing=review();delete missing.effects[key];assert.throws(()=>validateReview(missing,'checked'));
  }
  assert.throws(()=>validateReview({...review(),tests:[]},'checked'));
  for(const file of ['scripts/../evil.mjs','scripts/test-db.mjs','scripts/test;evil.mjs','/tmp/evil.mjs']) assert.throws(()=>validateReview({...review(),tests:[file]},'checked'));
});
test('permite función y pantalla nuevas; bloquea efectos reservados y revisión obsoleta',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'limpatex-scope-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  git(['init']);git(['config','user.name','Test']);git(['config','user.email','test@example.org']);
  fs.writeFileSync(path.join(repo,'package.json'),'{}');git(['add','package.json']);git(['commit','-m','base']);const base=git(['rev-parse','HEAD']);
  const write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});fs.writeFileSync(path.join(repo,file),text);};
  const commit=()=>{git(['add','.']);git(['commit','-m','candidate']);return git(['rev-parse','HEAD']);};
  write('src/calculate.ts','export const calculate = (n:number) => n * 2;');
  write('src/pages/Example.tsx','export const Example = () => <div>Example</div>;');
  write('scripts/calculate.test.mjs','import assert from "node:assert/strict"; assert.equal(2*2,4);');let head=commit();
  assert.throws(()=>verifyDelivery(repo,base,head));
  const approve=()=>{const r=review();r.digest=changeDigest(repo,base,'HEAD');write('.delivery/request.json',JSON.stringify(r));return commit();};
  head=approve();assert.equal(verifyDelivery(repo,base,head).scope,'application');
  write('src/calculate.ts','export const calculate = (n:number) => n * 3;');head=commit();assert.throws(()=>verifyDelivery(repo,base,head),/vigente/);
  head=approve();assert.equal(verifyDelivery(repo,base,head).scope,'application');
  write('src/calculate.ts','export const calculate = () => client.from("tasks").delete();');commit();head=approve();assert.throws(()=>verifyDelivery(repo,base,head),/reservado/);
  write('supabase/migrations/change.sql','select 1;');commit();head=approve();assert.throws(()=>verifyDelivery(repo,base,head),/reservado/);
});
const deployment={id:'initial',projectId:'project',readyState:'READY',meta:{}};
test('comprueba base de producción y ambos alias',()=>{
  assertProduction([deployment,deployment],'base',cfg);
  assert.throws(()=>assertProduction([deployment,deployment],'stale',cfg));
  assert.throws(()=>assertProduction([deployment,{...deployment,id:'other'}],'base',cfg));
  assert.throws(()=>assertProduction([{...deployment,projectId:'wrong'},deployment],'base',cfg));
});
test('admite publicaciones del coordinador con la huella comprobada',()=>{
  const d={...deployment,id:'new',meta:{limpatexSourceFingerprint:'new-source'}};
  assertProduction([d,d],'new-source',cfg);
});
test('fija el commit de GitHub y construye sin mover los dominios',()=>{
  const commit='a'.repeat(40); const body=deploymentBody(commit,'source',cfg);
  assert.equal(body.project,cfg.projectId);
  assert.equal(body.gitMetadata.commitSha,commit);
  assert.equal(body.source,'cli');
  assert.equal(body.gitSource,undefined);
  assert.equal(body.autoAssignCustomDomains,false);
  assert.equal(body.meta.limpatexSourceFingerprint,'source');
  assert.throws(()=>deploymentBody('main','source',cfg));
});
test('acepta el alias propio y conserva el bloqueo de publicaciones ajenas',()=>{
  const current={...deployment,id:'own',meta:{limpatexCommit:'commit',limpatexSourceFingerprint:'new'}};
  assertTransition([deployment,current],current,'base','commit','new',cfg);
  assert.throws(()=>assertTransition([deployment,{...current,id:'foreign'}],current,'base','commit','new',cfg));
  assert.throws(()=>assertTransition([deployment,current],current,'base','wrong','new',cfg));
});
test('detecta assets relativos a raíz y absolutos',()=>{
  assert.deepEqual(entryAssets('<script src="/assets/index-a.js"></script><link href="/assets/index-b.css">'),['/assets/index-a.js','/assets/index-b.css']);
  assert.deepEqual(entryAssets('<script src="https://example.org/assets/a.js"></script>'),['https://example.org/assets/a.js']);
});
test('reutiliza por contenido exacto y no por nombre de archivo',()=>{
  const known='a'.repeat(40); const unknown='b'.repeat(40);
  const hashes=cachedFileHashes([{type:'directory',name:'src',children:[{type:'file',name:'view.tsx',uid:known},{type:'directory',uid:unknown}]}]);
  assert(hashes.has(known)); assert(!hashes.has(unknown)); assert(!hashes.has('view.tsx'));
});
