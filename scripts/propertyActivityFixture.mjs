// Arnés offline de la ficha de propiedades con su pestaña Actividad: componentes reales,
// cliente Supabase simulado en memoria (sin red ni sesión) y permisos/sede controlables.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const client = String.raw`
const at=(day,time)=>new Date(day+'T'+time+':00+02:00').toISOString();
const P='prop-a', Q='prop-b';
export const fixtureData={
  tasks:[
    {id:'t1',propiedad_id:P,sede_id:'sede-1',property:'Ático Centro',date:'2026-10-15',start_time:'11:00:00',end_time:'13:00:00',status:'completed',type:'Salida',cleaner:'Ana',task_assignments:[{cleaner_name:'Ana'},{cleaner_name:'Luis'}],
      task_reports:[{id:'r1',start_time:at('2026-10-15','11:05'),end_time:at('2026-10-16','09:40'),overall_status:'completed',cleaner:{name:'Ana'}}]},
    {id:'t2',propiedad_id:P,sede_id:'sede-1',property:'Ático Centro',date:'2026-10-12',start_time:null,end_time:null,status:'completed',type:null,cleaner:null,task_assignments:[],task_reports:[]},
    {id:'t3',propiedad_id:P,sede_id:'sede-1',property:'Ático Centro',date:'2026-09-01',start_time:'10:00:00',end_time:'12:00:00',status:'completed',type:'Repaso',cleaner:'Luis',task_assignments:[{cleaner_name:'Luis'}],task_reports:[]},
    {id:'t9',propiedad_id:Q,sede_id:'sede-1',property:'Ático Centro',date:'2026-10-14',start_time:'09:00:00',end_time:null,status:'pending',type:'Entrada',cleaner:null,task_assignments:[],task_reports:[]},
  ],
  cleaning_incidents:[{id:'i1',property_id:P,sede_id:'sede-1',task_id:'t1',created_at:at('2026-10-15','12:15'),status:'open',description:'Mancha en el sofá del salón',category:{label:'Daños'},cleaner:{name:'Ana'}}],
  cleaning_incident_events:[
    {id:'e1',incident_id:'i1',event_type:'status_change',from_status:'open',to_status:'resolved',actor_name:'Marta',created_at:at('2026-10-16','10:00'),incident:{property_id:P,sede_id:'sede-1',description:'Mancha en el sofá'}},
    {id:'e2',incident_id:'i1',event_type:'status_change',from_status:'resolved',to_status:'open',actor_name:'Marta',created_at:at('2026-10-16','11:00'),incident:{property_id:P,sede_id:'sede-1',description:'Mancha en el sofá'}},
  ],
  supervision_reviews:[{id:'s1',property_id:P,task_id:'t1',review_type:'full',state:'returned_for_rework',result:'incorrect',rework_reason:'Polvo en estanterías',started_at:at('2026-10-15','14:00'),completed_at:at('2026-10-15','14:20'),created_at:at('2026-10-15','14:00'),route:{route_date:'2026-10-15',sede_id:'sede-1'}}],
  laundry_bag_preparations:[{task_id:'t1',status:'prepared',prepared_at:at('2026-10-14','18:00'),prepared_by_name:'Pepe',issue_at:null,issue_by_name:null,issue_reason:null,undone_at:at('2026-10-14','17:30'),undone_by_name:'Pepe',undone_reason:'Faltaban fundas',cancelled_at:null,cancelled_by_name:null,task:{id:'t1',date:'2026-10-15',propiedad_id:P,sede_id:'sede-1'}}],
  laundry_delivery_tracking:[{id:'d1',task_id:'t1',prepared_at:at('2026-10-14','18:01'),prepared_by_name:'Pepe',delivered_at:at('2026-10-15','10:00'),delivered_by_name:'Rosa',collected_at:null,collected_by_name:null,task:{id:'t1',date:'2026-10-15',propiedad_id:P,sede_id:'sede-1'}}],
  stock_movements:[
    {id:'m1',property_id:P,task_id:'t1',movement_type:'consumo_automatico',quantity:4,reason:'Consumo de la limpieza',created_at:at('2026-10-15','15:00'),product_id:'sab',warehouse_id:'w1',product:{name:'Sábanas 150',unit_of_measure:'unidades',sede_id:'sede-1'},warehouse:{name:'Trastero Orzán'}},
    {id:'m2',property_id:null,task_id:null,movement_type:'ajuste',quantity:10,reason:'Recuento global',created_at:at('2026-10-15','15:00'),product_id:'sab',warehouse_id:'w1',product:{name:'Sábanas 150',unit_of_measure:'unidades',sede_id:'sede-1'},warehouse:{name:'Trastero Orzán'}},
  ],
};
const get=(row,path)=>path.split('.').reduce((v,k)=>v==null?v:v[k],row);
const MUTATIONS=['insert','upsert','update','delete'];
function query(table){
  const filters=[];let signal;let mutation=null;
  const run=()=>new Promise((resolve,reject)=>{
    (window.queries=window.queries||[]).push({table,filters:filters.map(f=>f.slice())});
    if(mutation){(window.writes=window.writes||[]).push({table,mutation});}
    const delay=(window.fixtureDelay||{})[table]||0;
    const timer=setTimeout(()=>{
      if((window.fixtureFail||[]).includes(table)) return resolve({data:null,error:{message:'Fallo simulado en '+table}});
      let rows=(fixtureData[table]||[]).filter(row=>filters.every(([op,key,val])=>{const v=get(row,key);
        if(op==='eq') return v===val; if(op==='gte') return v!=null&&String(v)>=val; if(op==='lte') return v!=null&&String(v)<=val; if(op==='lt') return v!=null&&String(v)<val; if(op==='in') return val.includes(v); return true;}));
      resolve({data:rows,error:null});
    },delay);
    if(signal){signal.addEventListener('abort',()=>{clearTimeout(timer);(window.aborted=window.aborted||[]).push(table);reject(new DOMException('Aborted','AbortError'));});}
  });
  const b=new Proxy({},{get(_,k){
    if(k==='then') return (res,rej)=>run().then(res,rej);
    if(k==='abortSignal') return s=>{signal=s;return b;};
    if(['eq','gte','lte','lt','in'].includes(k)) return (key,val)=>{filters.push([k,key,val]);return b;};
    if(MUTATIONS.includes(k)) return ()=>{mutation=k;return b;};
    return ()=>b;
  }});
  return b;
}
export const supabase={from:query,rpc:async()=>({data:null,error:null}),channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:()=>{},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}};
`;

const mocks = {
  '@/integrations/supabase/client': client,
  '@/contexts/SedeContext': `export const useSede=()=>{const activeSede={id:window.fixtureSede||'sede-1',nombre:'Coruña'};return {activeSede,availableSedes:[activeSede],loading:false,isInitialized:true,isActiveSedeSet:()=>true,getActiveSedeId:()=>activeSede.id,setActiveSede:()=>{}};};`,
  '@/hooks/useAuth': `export const useAuth=()=>({user:{id:'u1'},userRole:window.fixtureRole||'manager',userRoles:[window.fixtureRole||'manager'],isLoading:false});`,
  '@/hooks/useRolePermissions': `import {getRolePermissions} from '@/lib/rolePermissions';
    export const useRolePermissions=()=>{const p=()=>{const base=getRolePermissions('manager');const deny=window.fixtureDeny||[];return Object.fromEntries(Object.entries(base).map(([k,v])=>[k,deny.includes(k)?{canView:false,canCreate:false,canEdit:false,canDelete:false}:v]));};
      return {permissions:p(),hasPermission:(m,a)=>!!p()[m]?.[a],canAccessModule:m=>!!p()[m]?.canView,isAdminOrManager:()=>true,isSupervisor:()=>false,isCleaner:()=>false,userRole:'manager'};};`,
  '@/hooks/useProperties': `
    const base={codigo:'',direccion:'Calle Real 1',numeroCamas:1,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:1,duracionServicio:120,costeServicio:50,clienteId:'c1',isActive:true,checkInPredeterminado:'16:00',checkOutPredeterminado:'11:00',notas:'',fechaCreacion:'',fechaActualizacion:''};
    const props=[{...base,id:'prop-a',nombre:'Ático Centro',codigo:'ATC-1'},{...base,id:'prop-b',nombre:'Ático Centro',codigo:'ATC-2'}];
    export const useProperties=()=>({data:props,isLoading:false,isError:false,refetch:()=>{}});
    export const usePropertyCleaningSchedule=()=>({data:{},isLoading:false,isError:false,refetch:()=>{}});
    export const useCreateProperty=()=>({mutateAsync:async()=>{},isPending:false});
    export const useDeleteProperty=()=>({mutate:()=>{},isPending:false});
    export const useUpdateProperty=()=>({mutateAsync:async()=>{},isPending:false});`,
  '@/hooks/useClients': `export const useClients=()=>({data:[{id:'c1',nombre:'Cliente Uno',isActive:true}],isLoading:false,isError:false,refetch:()=>{}});`,
  '@/hooks/use-mobile': `export const useDeviceType=()=>({isDesktop:window.innerWidth>=1024,isMobile:window.innerWidth<768,isTablet:false});export const useIsMobile=()=>window.innerWidth<768;`,
};

export async function buildPropertyActivityFixture() {
  const entry = String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useLocation,useNavigate} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PropertiesPage} from './src/components/properties/PropertiesPage';
function Where(){const l=useLocation();return <output aria-label="Ubicación actual" hidden>{l.pathname+l.search}</output>;}
function Elsewhere({name}){const n=useNavigate();const l=useLocation();return <main><h1>{name}</h1><p>{l.search}</p><button onClick={()=>n(-1)}>Volver</button></main>;}
const root=createRoot(document.getElementById('root'));
window.renderFixture=()=>root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/properties']}><Where/><Routes>
<Route path='/properties' element={<PropertiesPage/>}/><Route path='/calendar' element={<Elsewhere name="Calendario"/>}/><Route path='/cleaning-reports' element={<Elsewhere name="Incidencias"/>}/><Route path='/inventory/movements' element={<Elsewhere name="Historial de inventario"/>}/>
</Routes></MemoryRouter></QueryClientProvider>);
window.renderFixture();`;
  const built = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_SUPABASE_URL":"https://offline.invalid","VITE_SUPABASE_PUBLISHABLE_KEY":"offline"}' },
    plugins: [{ name: 'offline', setup(b) { b.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'fixture' } : null); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() })); } }] });
  const real = Object.keys(built.metafile.inputs).filter(path => !path.startsWith('fixture:') && /integrations[\\/]supabase[\\/]client/.test(path));
  assert.deepEqual(real, [], 'El arnés no incluye el cliente real de Supabase');
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
