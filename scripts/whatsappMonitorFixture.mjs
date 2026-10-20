// Arnés offline del monitor de WhatsApp: página real /whatsapp-notifications con
// rpcUntyped simulado en memoria, sesión simulada y sin cliente real de Supabase.
// Datos sintéticos (nombres y teléfonos inventados). "Ahora" = martes 20/10/2026 12:00 Madrid.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const rpc = String.raw`
const NOW=Date.parse('2026-10-20T10:00:00Z');
const ago=(min)=>new Date(NOW-min*60000).toISOString();
const D=(id,o)=>Object.assign({id,notification_event_id:'ev-'+id,provider_message_ref:null,recipient_masked:'•••• 1234',template_name:'task_assigned_v1',status:'queued',error_code:null,error_detail:null,sent_at:null,delivered_at:null,read_at:null,failed_at:null,created_at:ago(5),event_type:'task_assigned',cleaner_name:'Ana Pérez',property:'Orzán 1º A',task_date:'2026-10-21'},o);
const baseRows=[
  D('d1',{status:'read',provider_message_ref:'…a1b2c3d4',sent_at:ago(120),delivered_at:ago(119),read_at:ago(100),created_at:ago(121)}),
  D('d2',{status:'delivered',provider_message_ref:'…e5f6a7b8',sent_at:ago(90),delivered_at:ago(89),created_at:ago(91),cleaner_name:'Luis Gómez',recipient_masked:'•••• 5678',event_type:'task_modified',template_name:'task_modified_v1'}),
  D('d3',{status:'sent',provider_message_ref:'…c9d0e1f2',sent_at:ago(45),created_at:ago(46),cleaner_name:'Begoña Ruiz',recipient_masked:'•••• 9012',property:'Marina Habitación 2'}),
  D('d4',{status:'failed',error_code:'131026',error_detail:'Message undeliverable',failed_at:ago(30),sent_at:ago(31),created_at:ago(32),cleaner_name:'Marta Sanz',recipient_masked:'•••• 3456',event_type:'task_cancelled',template_name:'task_cancelled_v1'}),
  D('d5',{status:'skipped',error_code:'channel_unavailable',error_detail:'Limpiadora sin teléfono/opt-in de WhatsApp',created_at:ago(20),cleaner_name:'Rosa Díaz',recipient_masked:'••••'}),
  D('d6',{status:'queued',error_code:'reconciliation_required',error_detail:'Intento 1/2 sin respuesta de Meta',created_at:ago(18),cleaner_name:'Ana Pérez',event_type:'task_approval_reminder',template_name:'task_approval_reminder_v1'}),
  D('d7',{status:'queued',created_at:ago(1),cleaner_name:'Luis Gómez',recipient_masked:'•••• 5678'}),
  D('d8',{status:'skipped',error_code:null,error_detail:'WhatsApp no está activo (modo preparación / dry-run).',created_at:ago(240),cleaner_name:null,recipient_masked:'•••• 0000',property:null,task_date:null,event_type:'task_rejected_alert',template_name:'task_rejected_admin_v1'}),
  D('d9',{status:'undeliverable',error_code:'131049',error_detail:'Llamada [teléfono oculto] bloqueada por Meta',failed_at:ago(600),created_at:ago(601),cleaner_name:'Ana Pérez',event_type:'task_late_start_reminder',template_name:'late_start_v1'}),
  D('d10',{status:'processing_unknown',created_at:ago(700),cleaner_name:'Luis Gómez'}),
];
// Escenario parecido a producción (20/10/2026): seis WhatsApp 2/2 agotados y antiguos,
// con el enmascarado mal codificado que devuelve hoy el servidor, más casos recientes.
const MOJI='â€¢'.repeat(4);
const EXHAUSTED='Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual';
const Q=(id,o)=>Object.assign({delivery_id:id,notification_event_id:'ev-'+id,channel:'whatsapp',provider:'meta_cloud_api',recipient_masked:MOJI+' 7093',template_name:'task_assigned_approval_es',uncertainty_state:'meta_uncertain',detail:EXHAUSTED,created_at:ago(5),open_action_status:null},o);
const prodQueue=()=>[
  Q('p1',{created_at:'2026-09-04T18:12:00Z'}),
  Q('p2',{created_at:'2026-09-15T18:26:00Z',template_name:'task_modified_es'}),
  Q('p3',{created_at:'2026-09-28T07:58:00Z',recipient_masked:MOJI+' 4439',template_name:null}),
  Q('p4',{created_at:'2026-09-29T14:06:00Z',recipient_masked:MOJI+' 4439',template_name:'task_cancelled_es'}),
  Q('p5',{created_at:'2026-10-02T09:15:00Z',recipient_masked:MOJI+' 6755',template_name:'plantilla_desconocida_x'}),
  Q('p6',{created_at:'2026-10-08T16:40:00Z',recipient_masked:'Oculto',template_name:'task_approval_reminder_es'}),
];
const mixedQueue=()=>[
  ...prodQueue().slice(0,2),
  Q('d6',{created_at:ago(18),recipient_masked:'•••• 1234',template_name:'task_approval_reminder_es',detail:'Resultado de Meta incierto (network_error): tras 15 minutos se permitirá un único reintento 2/2 para priorizar entrega; existe riesgo excepcional de duplicado'}),
  Q('r2',{created_at:ago(3*1440),recipient_masked:'•••• 5678',template_name:'task_modified_es',open_action_status:'pending'}),
  Q('r3',{created_at:ago(2),recipient_masked:'•••• 9012',uncertainty_state:'meta_contacting',detail:'Contactando con Meta'}),
  {delivery_id:'e1',notification_event_id:'ev-e1',channel:'email',provider:'resend',recipient_masked:'•••• 4321',template_name:'task_rejected_admin_fallback_email',uncertainty_state:'resend_uncertain',detail:'Resultado incierto: comprobar el proveedor antes de resolver',created_at:ago(60),open_action_status:null},
];
const fiftyQueue=()=>Array.from({length:50},(_,i)=>Q('f'+i,{created_at:ago((60-i)*1440)}));
const sendQueue=()=>(window.fx||{}).queue==='prod'?prodQueue():(window.fx||{}).queue==='mixed'?mixedQueue():(window.fx||{}).queue==='fifty'?fiftyQueue():[
  {delivery_id:'d6',notification_event_id:'ev-d6',channel:'whatsapp',provider:'meta_cloud_api',recipient_masked:'•••• 1234',template_name:'task_approval_reminder_v1',uncertainty_state:(window.fx||{}).contacting?'meta_contacting':'meta_uncertain',detail:'Intento 1/2 sin respuesta de Meta',created_at:ago(18),open_action_status:null},
  {delivery_id:'e1',notification_event_id:'ev-e1',channel:'email',provider:'resend',recipient_masked:'•••• 4321',template_name:'task_rejected_admin_fallback_email',uncertainty_state:'resend_uncertain',detail:'Resultado incierto: comprobar el proveedor antes de resolver',created_at:ago(60),open_action_status:null},
  {delivery_id:'e2',notification_event_id:'ev-e2',channel:'email',provider:'resend',recipient_masked:'•••• 8765',template_name:'task_rejected_admin_fallback_email',uncertainty_state:'resend_uncertain',detail:'Resultado incierto antiguo',created_at:ago(25*60),open_action_status:null},
];
const webhookQueue=[
  {callback_kind:'status',provider_message_ref:'…ffff0001',sender_masked:'—',callback_state:'pending',detail:'Pendiente de correlación',attempts:3,received_at:ago(40)},
];
function rowsFor(args){
  const s=window.fx||{};
  let rows=s.empty?[]:baseRows.slice();
  if(s.many){rows=[];for(let i=0;i<s.many;i++){rows.push(D('m'+i,{status:['read','delivered','sent','failed','skipped'][i%5],created_at:ago(i*7),cleaner_name:'Persona '+(i%23),property:'Apartamento '+(i%61)}));}}
  // Réplica del filtro ILIKE de la RPC con escape por barra invertida.
  const raw=(args._search||'').trim();
  const BS=String.fromCharCode(92);const lit=(ch)=>('.*+?^$()[]{}|/'.includes(ch)||ch===BS)?BS+ch:ch;
  if(raw){let src='';for(let i=0;i<raw.length;i++){const c=raw[i];if(c===BS&&i+1<raw.length){src+=lit(raw[++i]);}else if(c==='%'){src+='.*';}else if(c==='_'){src+='.';}else{src+=lit(c);}}const re=new RegExp(src,'i');rows=rows.filter(r=>[r.cleaner_name,r.property,r.template_name].some(v=>re.test(v||'')));}
  const st=args._status;
  if(st&&st!=='all'){rows=rows.filter(r=>st==='attention'?(['failed','undeliverable','skipped'].includes(r.status)||(r.status==='queued'&&r.error_code==='reconciliation_required')||(r.status==='sent'&&Date.parse(r.sent_at)<NOW-30*60000)):(r.status===st||(st==='failed'&&r.status==='undeliverable')));}
  const total=rows.length;
  return rows.slice(args._offset,args._offset+args._limit).map(r=>Object.assign({},r,{total_count:total}));
}
function stats(){
  const s=window.fx||{};
  if(s.empty) return {sent:0,delivered:0,read:0,failed:0,skipped:0,unconfirmed:0,unresolved:0};
  return {sent:1,delivered:2,read:1,failed:2,skipped:2,unconfirmed:1,unresolved:6};
}
const detail={attempts:[
  {attempt_no:1,state:'completed_uncertain',started_at:ago(18),finalized_at:ago(17),last_status:null,status_occurred_at:null,error_code:'network_error',error_detail:'HTTP 503',provider_message_ref:null},
  {attempt_no:2,state:'accepted',started_at:ago(3),finalized_at:ago(3),last_status:'delivered',status_occurred_at:ago(2),error_code:null,error_detail:null,provider_message_ref:'…a1b2c3d4'},
],actions:[],recipient_name_snapshot:'Ana Pérez',snapshot_property:null,snapshot_task_date:null};
export function rpcUntyped(fn,args){
  const s=window.fx||{};
  (window.rpcCalls=window.rpcCalls||[]).push({fn,args});
  const delay=(s.delay||{})[fn]||0;
  return new Promise(res=>setTimeout(()=>{
    if((s.fail||[]).includes(fn)) return res({data:null,error:{message:'Fallo simulado en '+fn}});
    if(s.role==='manager'&&fn==='get_notification_send_reconciliation_queue') return res({data:null,error:{message:'forbidden',code:'42501'}});
    switch(fn){
      case 'get_whatsapp_delivery_monitor': return res({data:rowsFor(args),error:null});
      case 'get_whatsapp_delivery_monitor_stats': return res({data:stats(),error:null});
      case 'get_whatsapp_webhook_pending_count': return res({data:s.empty||s.role==='manager'?0:webhookQueue.length,error:null});
      case 'get_notification_send_reconciliation_queue': return res({data:s.empty?[]:sendQueue(),error:null});
      case 'get_whatsapp_webhook_reconciliation_queue': return res({data:s.empty||s.role==='manager'?[]:webhookQueue,error:null});
      case 'get_whatsapp_delivery_detail': return s.detailRpc?res({data:detail,error:null}):res({data:null,error:{code:'PGRST202',message:'Could not find the function public.get_whatsapp_delivery_detail'}});
      case 'request_notification_send_reconciliation':
        (window.writes=window.writes||[]).push({fn,args});
        return s.resolutionError?res({data:null,error:{message:s.resolutionError}}):res({data:'action-1',error:null});
      default: (window.writes=window.writes||[]).push({fn,args,unexpected:true}); return res({data:null,error:{message:'rpc no previsto'}});
    }
  },delay));
}
export function fromUntypedTable(t){throw new Error('tabla no prevista '+t);}
`;

const auth = String.raw`
export const useAuth=()=>{const role=(window.fx||{}).role||'admin';return {userRole:role,userRoles:[role]};};
`;
const clientMock = `export const supabase=new Proxy({}, {get(){throw new Error('cliente Supabase real no permitido en el arnés');}});`;
const mocks = { '@/lib/supabaseUntyped': rpc, '@/integrations/supabase/client': clientMock, '@/hooks/useAuth': auth };

export async function buildWhatsAppMonitorFixture() {
  const entry = String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {Toaster} from 'sonner';
import Page from './src/pages/WhatsAppNotifications';
function Where(){const l=useLocation();return <output data-testid="where" hidden>{l.pathname+l.search}</output>;}
const root=createRoot(document.getElementById('root'));
window.renderFixture=()=>root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/whatsapp-notifications']}><Page/><Where/><Toaster/></MemoryRouter></QueryClientProvider>);`;
  const built = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent', loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_SUPABASE_URL":"https://offline.invalid","VITE_SUPABASE_PUBLISHABLE_KEY":"offline"}' },
    plugins: [{ name: 'offline', setup(b) {
      b.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'fixture' } : null);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  const real = Object.keys(built.metafile.inputs).filter(p => !p.startsWith('fixture:') && /integrations[\\/]supabase[\\/]client|lib[\\/]supabaseUntyped|hooks[\\/]useAuth\.ts/.test(p));
  assert.deepEqual(real, [], 'El arnés no incluye el cliente real de Supabase ni la sesión real');
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
