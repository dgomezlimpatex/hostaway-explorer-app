// Arnés offline del calendario global: página real, cliente Supabase simulado en memoria
// (sin red ni sesión), sede y propiedades controlables desde la prueba.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Semana de referencia: lunes 19 a domingo 25 de octubre de 2026 (incluye el cambio de hora).
const client = String.raw`
const day=(n)=>{const x=new Date('2026-10-19T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const at=(n,time)=>new Date(day(n)+'T'+time+':00+02:00').toISOString();
const T=(id,prop,n,start,extra)=>Object.assign({id,propiedad_id:prop,sede_id:'sede-1',property:'Propiedad '+prop,date:day(n),start_time:start,end_time:null,status:'pending',type:'Limpieza de salida',cleaner:null,task_assignments:[],task_reports:[]},extra||{});
const base={
  tasks:[
    T('t-done','orz-1',2,'11:00:00',{end_time:'13:00:00',task_assignments:[{cleaner_id:'w1',cleaner_name:'Ana Pérez'},{cleaner_id:'w2',cleaner_name:'Luis Gómez'}],
      task_reports:[{cleaner_id:'w1',overall_status:'completed',start_time:at(2,'11:02'),end_time:at(2,'12:40')},{cleaner_id:'w2',overall_status:'completed',start_time:at(2,'11:05'),end_time:at(2,'12:35')}]}),
    T('t-next','orz-1',2,'16:00:00',{type:'Repaso',task_assignments:[{cleaner_id:'w3',cleaner_name:'Begoña Ruiz'}]}),
    T('t-live','orz-4',2,'09:30:00',{task_assignments:[{cleaner_id:'w1',cleaner_name:'Ana Pérez'}],task_reports:[{cleaner_id:'w1',overall_status:'in_progress',start_time:at(2,'09:41'),end_time:null}]}),
    T('t-review','mar-2',1,'10:00:00',{cleaner:'Marta Sanz',task_reports:[{cleaner_id:null,overall_status:'needs_review',start_time:at(1,'10:00'),end_time:at(1,'11:10')}]}),
    T('t-old','old-1',4,'12:00:00'),
    T('t-orphan',null,3,'13:00:00',{property:'Local Calle Real'}),
    T('t-sun','orz-6',6,'11:00:00'),
  ],
  client_reservations:[
    {id:'cr-1',property_id:'orz-1',check_in_date:day(-2),check_out_date:day(2),status:'active',task_id:'t-done'},
    {id:'cr-cancel',property_id:'orz-2',check_in_date:day(0),check_out_date:day(2),status:'cancelled',task_id:null},
    {id:'cr-3',property_id:'orz-3',check_in_date:day(0),check_out_date:day(3),status:'active',task_id:null},
  ],
  avantio_reservations:[
    {id:'av-1',avantio_reservation_id:'AV-551',property_id:'orz-1',arrival_date:day(-2),departure_date:day(2),status:'CONFIRMED',task_id:'t-done',cancellation_date:null},
    {id:'av-2',avantio_reservation_id:'AV-552',property_id:'orz-2',arrival_date:day(3),departure_date:day(5),status:'CONFIRMED',task_id:null,cancellation_date:null},
  ],
  hostaway_reservations:[
    {id:'ha-1',hostaway_reservation_id:9001,property_id:'orz-3',arrival_date:day(2),departure_date:day(5),status:'new',task_id:null,cancellation_date:null},
  ],
  smoobu_reservations:[
    {id:'sm-1',external_id:'SM-77',property_id:'orz-1',check_in:day(2),check_out:day(9),status:'confirmed'},
    {id:'sm-2',external_id:'SM-78',property_id:'mar-3',check_in:day(4),check_out:day(6),status:'confirmed'},
    {id:'sm-3',external_id:'SM-79',property_id:null,check_in:day(1),check_out:day(3),status:'confirmed'},
  ],
  smoobu_property_mappings:[{id:'sm-map-1',property_id:'mar-3',is_active:true},{id:'sm-map-2',property_id:'orz-1',is_active:true}],
  lh_reservations:[{id:'lh-1',external_id:'LH-1',room:'Marina 1',rooms:['Marina 1'],check_in:day(-1),check_out:day(1),status:'confirmed'}],
  lh_room_mapping:[{id:'lhm-1',lh_room:'Marina 1',service_kind:'checkout',propiedad_id:'mar-1',is_active:true}],
  avirato_reservations:[{id:'avi-1',external_id:'AVI-1',space_name:'101',space_subtype_id:7,check_in:day(3),check_out:day(5),status:'Bloqueado',normalized_status:'block'}],
  avirato_room_mapping:[{id:'avim-1',space_subtype_id:7,service_kind:'checkout',propiedad_id:'hotel-1',is_active:true}],
  property_group_assignments:[
    ...['orz-1','orz-2','orz-3','orz-4','orz-5','orz-6'].map((p,i)=>({id:'ga-'+i,property_id:p,property_group_id:'g-orzan',property_groups:{id:'g-orzan',name:'orzan',display_name:'Edificio Orzán',is_active:true}})),
    ...['mar-1','mar-2','mar-3'].map((p,i)=>({id:'gb-'+i,property_id:p,property_group_id:'g-marina',property_groups:{id:'g-marina',name:'Marina',display_name:null,is_active:true}})),
  ],
};
function many(count){
  const data={tasks:[],client_reservations:[]};
  for(let i=0;i<count;i++){
    const p='bulk-'+i;
    const start=(i*3)%9-2;
    data.client_reservations.push({id:'b-'+i,property_id:p,check_in_date:day(start),check_out_date:day(start+2+(i%4)),status:'active',task_id:null});
    data.tasks.push(T('bt-'+i,p,(start+2+(i%4)+7)%7,'1'+(i%8)+':00:00',{task_assignments:[{cleaner_id:'w'+(i%9),cleaner_name:'Persona '+(i%9)}],status:i%3===0?'completed':'pending'}));
  }
  return data;
}
export function fixtureTables(){
  const extra=window.fixtureMany?many(window.fixtureMany):{tasks:[],client_reservations:[]};
  return Object.assign({},base,{tasks:base.tasks.concat(extra.tasks),client_reservations:base.client_reservations.concat(extra.client_reservations)},window.fixtureOverride||{});
}
const MUTATIONS=['insert','upsert','update','delete'];
function query(table){
  const ops=[];let signal;let mutation=null;
  const run=()=>new Promise((resolve,reject)=>{
    (window.queries=window.queries||[]).push({table,ops:ops.map(o=>o.slice())});
    if(mutation){(window.writes=window.writes||[]).push({table,mutation});}
    const delay=(window.fixtureDelay||{})[table]||0;
    const timer=setTimeout(()=>{
      if((window.fixtureFail||[]).includes(table)) return resolve({data:null,error:{message:'Fallo simulado en '+table}});
      let rows=(fixtureTables()[table]||[]).filter(row=>ops.every(([op,key,val])=>{const v=row[key];
        if(op==='eq') return v===val; if(op==='neq') return v!==val; if(op==='gte') return v!=null&&String(v)>=val; if(op==='lte') return v!=null&&String(v)<=val; if(op==='in') return val.includes(v); return true;}));
      const range=ops.find(o=>o[0]==='range'); if(range) rows=rows.slice(range[1],range[2]+1);
      resolve({data:rows,error:null});
    },delay);
    if(signal){signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));});}
  });
  const b=new Proxy({},{get(_,k){
    if(k==='then') return (res,rej)=>run().then(res,rej);
    if(k==='abortSignal') return s=>{signal=s;return b;};
    if(MUTATIONS.includes(k)) return ()=>{mutation=k;return b;};
    return (...args)=>{ops.push([k,...args]);return b;};
  }});
  return b;
}
export const supabase={from:query,rpc:async(name)=>{(window.writes=window.writes||[]).push({rpc:name});return {data:null,error:{message:'rpc no permitido'}};},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:()=>{}};
`;

const properties = String.raw`
const prop=(id,nombre,codigo,cliente,clientName,extra)=>Object.assign({id,nombre,codigo,direccion:'',clienteId:cliente,clientName,isActive:true,checkInPredeterminado:'16:00',checkOutPredeterminado:'11:00'},extra||{});
function list(){
  if(window.fixtureNoProperties) return [];
  const items=[
    prop('orz-1','Orzán 1º A','ORZ-1','c-houmi','Houmi Orzán'),prop('orz-2','Orzán 1º B','ORZ-2','c-houmi','Houmi Orzán'),
    prop('orz-3','Orzán 2º A','ORZ-3','c-houmi','Houmi Orzán'),prop('orz-4','Orzán 2º B','ORZ-4','c-houmi','Houmi Orzán'),
    prop('orz-5','Orzán 3º A','ORZ-5','c-houmi','Houmi Orzán'),prop('orz-6','Orzán 3º B','ORZ-6','c-houmi','Houmi Orzán'),
    prop('mar-1','Marina Habitación 1','MAR-1','c-coto','Coto Rivas'),prop('mar-2','Marina Habitación 2','MAR-2','c-coto','Coto Rivas'),
    prop('mar-3','Marina Habitación 3','MAR-3','c-coto','Coto Rivas'),
    prop('hotel-1','Hotel Atlántico · Doble','HAT-D','c-hotel','Hotel Atlántico'),
    prop('riazor','Casa Riazor','CR-1',null,null,{checkInPredeterminado:'',checkOutPredeterminado:''}),
    prop('old-1','Antiguo Bajo','OLD-1','c-coto','Coto Rivas',{isActive:false}),
    prop('old-2','Antiguo Ático','OLD-2','c-coto','Coto Rivas',{isActive:false}),
  ];
  for(let i=0;i<(window.fixtureMany||0);i++) items.push(prop('bulk-'+i,'Apartamento '+(i+1),'APT-'+String(i+1).padStart(3,'0'),'c-bulk-'+(i%12),'Cliente '+(i%12)));
  return items;
}
export const useProperties=()=>window.fixturePropertiesError
  ?{data:undefined,isLoading:false,isError:true,refetch:()=>{window.propertiesRefetched=(window.propertiesRefetched||0)+1;}}
  :{data:list(),isLoading:false,isError:false,refetch:()=>{}};
`;

const mocks = {
  '@/integrations/supabase/client': client,
  '@/contexts/SedeContext': `export const useSede=()=>{const activeSede={id:'sede-1',nombre:'Coruña'};return {activeSede,availableSedes:[activeSede],loading:false,isInitialized:true,isActiveSedeSet:()=>true,getActiveSedeId:()=>activeSede.id,setActiveSede:()=>{}};};`,
  '@/hooks/useProperties': properties,
  '@/components/sede/SedeSelector': `export const SedeSelector=()=>null;`,
};

export async function buildGlobalCalendarFixture() {
  const entry = String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import GlobalCalendar from './src/pages/GlobalCalendar';
function Where(){const l=useLocation();return <output data-testid="where" hidden>{l.pathname+l.search}</output>;}
function Elsewhere({name}){const l=useLocation();return <main><h1>{name}</h1><p data-testid="elsewhere">{l.pathname+l.search}</p></main>;}
const root=createRoot(document.getElementById('root'));
window.renderFixture=()=>root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/calendario-global']}><Where/><Routes>
<Route path='/calendario-global' element={<GlobalCalendar/>}/><Route path='/tasks' element={<Elsewhere name="Tareas"/>}/><Route path='/properties' element={<Elsewhere name="Propiedades"/>}/>
</Routes></MemoryRouter></QueryClientProvider>);`;
  const built = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent', loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_SUPABASE_URL":"https://offline.invalid","VITE_SUPABASE_PUBLISHABLE_KEY":"offline"}' },
    plugins: [{ name: 'offline', setup(b) {
      b.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'fixture' } : null);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  const real = Object.keys(built.metafile.inputs).filter(path => !path.startsWith('fixture:') && /integrations[\\/]supabase[\\/]client/.test(path));
  assert.deepEqual(real, [], 'El arnés no incluye el cliente real de Supabase');
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
