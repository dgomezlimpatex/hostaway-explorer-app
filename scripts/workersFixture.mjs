// Arnés offline de Trabajadores: páginas reales dentro del layout real con barra lateral,
// cliente Supabase simulado en memoria (sin red ni sesión) que registra lecturas y escrituras.
// Personas, teléfonos, DNI y PIN son ficticios.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const client = String.raw`
const W=(id,name,h,active,category,ext,uid,extra)=>Object.assign({id,name,contract_hours_per_week:h,is_active:active,category,external_id:ext,user_id:uid,
  email:uid?id+'@example.test':null,telefono:'',dni:ext?'00000000T':null,pin:ext?'4321':null,start_date:null,sort_order:0,sede_id:'sede-1',
  delegation_name:ext?'Delegación ficticia':null,office_name:null,avatar:null,created_at:'2026-01-01',updated_at:'2026-01-01',
  planning_max_daily_minutes:null,planning_zone:null,planning_operational_restrictions:null,planning_can_handle_linen_load:null,planning_can_handle_complex_cleanings:null},extra||{});
const base={
  cleaners:[
    W('w1','Persona Uno Ejemplo',20,true,'Operario de limpieza','reg-1','u1',{telefono:'+34 600 000 001',start_date:'2025-03-01',sort_order:0,planning_max_daily_minutes:360,planning_zone:'Centro'}),
    W('w2','Persona Dos Ejemplo',30,true,'Supervisor','reg-2','u2',{sort_order:1}),
    W('w3','Persona Tres',0,true,null,null,null,{sort_order:2}),
    W('w4','Persona Cuatro Cristalera',40,true,'Cristalera',null,'u4',{sort_order:3,telefono:'600 000 004'}),
    W('w5','Persona Cinco',25,false,'Operario de limpieza','reg-5',null,{sort_order:4}),
    W('w6','Persona Seis',20,true,'Operario de limpieza','reg-6',null,{sort_order:5}),
  ],
  worker_absences:[
    {id:'a1',cleaner_id:'w1',absence_type:'sick',start_date:'2026-10-19',end_date:'2026-10-23',start_time:null,end_time:null,location_name:null,notes:'Nota médica ficticia',created_at:'2026-10-01'},
    {id:'a2',cleaner_id:'w1',absence_type:'vacation',start_date:'2026-10-26',end_date:'2026-10-30',start_time:null,end_time:null,location_name:null,notes:null,created_at:'2026-10-01'},
    {id:'a3',cleaner_id:'w2',absence_type:'day_off',start_date:'2026-10-21',end_date:'2026-10-21',start_time:'09:00:00',end_time:'12:00:00',location_name:null,notes:null,created_at:'2026-10-01'},
    {id:'a4',cleaner_id:'w4',absence_type:'vacation',start_date:'2026-10-19',end_date:'2026-10-20',start_time:null,end_time:null,location_name:null,notes:null,created_at:'2026-10-01'},
  ],
  worker_fixed_days_off:[{id:'f1',cleaner_id:'w1',day_of_week:0,is_active:true},{id:'f2',cleaner_id:'w6',day_of_week:3,is_active:true}],
  worker_maintenance_cleanings:[{id:'s1',cleaner_id:'w1',schedule_type:'unavailability',location_name:'Trabajo externo',days_of_week:[1,2,3,4,5],start_time:'14:45:00',end_time:'23:00:00',is_active:true,notes:null}],
  cleaner_availability:[
    ...[0,1,2,3,4,5,6].map(d=>({id:'ca-'+d,cleaner_id:'w1',day_of_week:d,is_available:d!==0,start_time:'06:00:00',end_time:'23:00:00'})),
  ],
  task_assignments:[],
  tasks:[],
  worker_contract_hours_history:[],worker_schedule_history:[],worker_hour_adjustments:[],recurring_task_executions:[],
};
function tasksFor(){
  const rows=[];
  for(let d=1;d<=31;d++){
    const date='2026-10-'+String(d).padStart(2,'0');
    rows.push({id:'t'+d,cleaner_id:'w1',property:d%2?'Apartamento ficticio A':'Hotel ficticio B',date,start_time:'09:30:00',end_time:'12:00:00',duracion:150,status:d<10?'completed':'pending',sede_id:'sede-1',type:'Limpieza'});
  }
  return rows;
}
function many(n){return Array.from({length:n},(_,i)=>W('v'+i,'Persona Volumen '+String(i+1).padStart(3,'0'),20,i%7!==0,i%3?'Operario de limpieza':null,i%2?'reg-v'+i:null,i%4?'uv'+i:null,{sort_order:i}));}
export function tables(){
  const t=Object.assign({},base,{tasks:tasksFor()});
  if(window.fixtureMany) t.cleaners=many(window.fixtureMany);
  return Object.assign(t,window.fixtureOverride||{});
}
const read=(row,key)=>key.split('.').reduce((v,k)=>v==null?v:v[k],row);
function query(table){
  const ops=[];let mutation=null,payload=null,single=null;
  const run=()=>new Promise(resolve=>{
    (window.queries=window.queries||[]).push({table,ops:ops.map(o=>o.slice()),mutation});
    const delay=(window.fixtureDelay||{})[table]||0;
    setTimeout(()=>{
      if((window.fixtureFail||[]).includes(table)) return resolve({data:null,error:{message:'Fallo simulado en '+table,code:'XX000'}});
      const filters=ops.filter(([op])=>['eq','neq','gte','lte','in','is'].includes(op));
      const match=row=>filters.every(([op,key,val])=>{const v=read(row,key);
        if(op==='eq') return v===val; if(op==='neq') return v!==val; if(op==='gte') return v!=null&&String(v)>=val; if(op==='lte') return v!=null&&String(v)<=val; if(op==='in') return val.includes(v); if(op==='is') return v===val; return true;});
      let rows=(tables()[table]||[]).filter(match);
      if(mutation){
        (window.writes=window.writes||[]).push({table,mutation,payload,filters:filters.map(f=>f.slice())});
        if(window.fixtureRejectWrites) return resolve(single?{data:null,error:{code:'PGRST116',message:'0 rows'}}:{data:[],error:null});
        if(mutation==='update') rows=rows.map(r=>Object.assign({},r,payload));
        if(mutation==='insert'||mutation==='upsert') rows=(Array.isArray(payload)?payload:[payload]).map((r,i)=>Object.assign({id:'new-'+i},r));
      }
      const range=ops.find(o=>o[0]==='range'); if(range) rows=rows.slice(range[1],range[2]+1);
      if(single==='single') return resolve(rows.length?{data:rows[0],error:null}:{data:null,error:{code:'PGRST116',message:'0 rows'}});
      if(single==='maybe') return resolve({data:rows[0]||null,error:null});
      resolve({data:rows,error:null,count:rows.length});
    },delay);
  });
  const b=new Proxy({},{get(_,k){
    if(k==='then') return (res,rej)=>run().then(res,rej);
    if(['insert','upsert','update','delete'].includes(k)) return (p)=>{mutation=k;payload=p;return b;};
    if(k==='single') return ()=>{single='single';return b;};
    if(k==='maybeSingle') return ()=>{single='maybe';return b;};
    return (...args)=>{ops.push([k,...args]);return b;};
  }});
  return b;
}
export const supabase={
  from:query,
  // Las RPC get_* (p. ej. avisos de la barra lateral) son lecturas; el resto se registra como escritura.
  rpc:async(name,args)=>{const list=/^get_/.test(name)?"rpcReads":"writes";(window[list]=window[list]||[]).push({rpc:name,args});return {data:null,error:null};},
  functions:{invoke:async(name,opts)=>{(window.invokes=window.invokes||[]).push({name,body:opts&&opts.body});
    if(window.fixtureInvokeFail) return {data:null,error:{message:'Fallo simulado de la función'}};
    return {data:{success:true,access:null,hasRegistroPin:true,isLinkedToRegistro:true,workerIsActive:true},error:null};}},
  channel:()=>{const c={on:()=>c,subscribe:()=>c,unsubscribe(){}};return c;},removeChannel(){},
  auth:{getSession:async()=>({data:{session:null}}),getUser:async()=>({data:{user:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
};
`;

const auth = String.raw`
export const useAuth=()=>{const role=window.fixtureRole||'admin';return {userRole:role,userRoles:[role],operationalMode:'supervision',canSwitchOperationalMode:false,setOperationalMode(){},user:{id:'fixture-user',email:'fixture@example.test'},profile:{full_name:'Usuaria Ficticia'},isLoading:false,signOut:async()=>{}};};
export const AuthProvider=({children})=>children;
`;
const sede = String.raw`
const activeSede={id:'sede-1',nombre:'Sede ficticia',name:'Sede ficticia'};
export const useSede=()=>window.fixtureSedePending
  ?{activeSede:null,availableSedes:[],loading:true,isInitialized:false,isActiveSedeSet:()=>false,getActiveSedeId:()=>null,setActiveSede(){},refreshSedes(){}}
  :{activeSede,availableSedes:[activeSede,{id:'sede-2',nombre:'Otra sede ficticia'}],loading:false,isInitialized:true,isActiveSedeSet:()=>true,getActiveSedeId:()=>activeSede.id,setActiveSede(){},refreshSedes(){}};
export const SedeProvider=({children})=>children;
`;

// Se sustituyen por ruta de archivo para cubrir también importaciones relativas.
const mocks = [
  [/src[\\/]integrations[\\/]supabase[\\/]client\.ts$/, client],
  [/src[\\/]hooks[\\/]useAuth\.ts$/, auth],
  [/src[\\/]contexts[\\/]SedeContext\.tsx$/, sede],
];

export async function buildWorkersFixture() {
  const entry = String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from './src/components/ui/toaster';
import {ManagementAppLayout} from './src/components/layout/ManagementAppLayout';
import Directory from './src/features/personnel/PersonnelDirectory';
import Profile from './src/features/personnel/PersonnelProfile';
import Hours from './src/features/personnel/HoursControl';
function Where(){const l=useLocation();return <output data-testid="where" hidden>{l.pathname+l.search}</output>;}
const root=createRoot(document.getElementById('root'));
window.renderFixture=()=>{localStorage.setItem('activeSede',JSON.stringify({id:'sede-1',nombre:'Sede ficticia'}));root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/workers']}><Where/><Routes>
<Route element={window.fixtureNoLayout?undefined:<ManagementAppLayout/>}>
<Route path='/workers' element={<Directory/>}/><Route path='/workers/hours' element={<Hours/>}/><Route path='/workers/:workerId/hours' element={<Hours/>}/><Route path='/workers/:workerId' element={<Profile/>}/>
<Route path='*' element={<main><h1>Otra pantalla</h1></main>}/>
</Route></Routes></MemoryRouter><Toaster/></QueryClientProvider>);};`;
  const built = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent', loader: { '.css': 'empty', '.woff2': 'empty', '.woff': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_SUPABASE_URL":"https://offline.invalid","VITE_SUPABASE_PUBLISHABLE_KEY":"offline","DEV":false,"PROD":true,"MODE":"production"}' },
    plugins: [{ name: 'offline', setup(b) {
      b.onLoad({ filter: /\.(tsx?|jsx?)$/ }, a => {
        const mock = mocks.find(([pattern]) => pattern.test(a.path));
        return mock ? { contents: mock[1], loader: 'tsx', resolveDir: process.cwd() } : null;
      });
    } }],
  });
  // El cliente real crea la conexión con createClient; el simulado no lo usa.
  assert.ok(!built.outputFiles[0].text.includes('supabase.co'), 'El arnés no incluye el cliente real de Supabase');
  const strip = text => text.replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(strip(readFileSync('src/index.css', 'utf8')), { from: 'src/index.css' });
  const personnel = strip(readFileSync('src/features/personnel/personnel.css', 'utf8'));
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${personnel}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
