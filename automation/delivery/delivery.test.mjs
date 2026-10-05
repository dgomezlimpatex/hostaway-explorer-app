import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {canonicalTsx, checkCss} from './guard.mjs';
import {eligible, assertProduction} from './controller.mjs';
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
  assert(!eligible({...pr,head:{...pr.head,repo:{full_name:'fork/app'}}},cfg));
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
