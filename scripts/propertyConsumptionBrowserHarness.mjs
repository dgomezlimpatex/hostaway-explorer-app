import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';

// Arnés manual de navegador para consumos de propiedades (sin red externa ni producción).
// UI real de propiedades + useStock real + stockStorage real; solo el cliente Supabase es
// una base en memoria. Los joins a stock_products de las reglas simulan el 57014 de producción.
// Uso: npm run build (para el CSS) y node scripts/propertyConsumptionBrowserHarness.mjs [puerto]
const port = Number(process.argv[2] || 8791);

const fakeClient = `
const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
const db = window.harnessDb;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const respond = async call => {
  db.log.unshift(call); db.notify();
  await sleep(db.controls.latencyMs);
  const c = db.controls;
  const fail = (error) => { call.result = error.code || 'error'; db.notify(); return { data: null, error }; };
  const ok = (data) => { call.result = 'ok'; db.notify(); return { data, error: null }; };
  if (call.table === 'stock_products') {
    if (c.failProducts) return fail(timeout);
    return ok(db.products.map(p => ({ ...p })));
  }
  if (call.table === 'stock_property_consumption_rules') {
    const propertyId = call.filters.find(f => f[1] === 'property_id')?.[2];
    if (call.op === 'upsert') {
      if (c.failUpsert) return fail(timeout);
      for (const row of call.payload) {
        const rules = db.rules[row.property_id] ||= [];
        const index = rules.findIndex(r => r.product_id === row.product_id);
        const next = { ...(rules[index] || { id: row.property_id + ':' + row.product_id }), ...row, updated_at: new Date().toISOString() };
        if (index >= 0) rules[index] = next; else rules.push(next);
      }
      return ok(null);
    }
    if (/stock_products\\s*\\(/.test(call.select || '') && c.wideJoinTimeout) return fail(timeout);
    if (c.failRulesRead) return fail(timeout);
    return ok((db.rules[propertyId] || []).filter(r => r.is_active).map(r => ({ ...r })));
  }
  return ok(call.single ? null : []);
};
const query = (table) => {
  const call = { at: new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' }), table, op: 'select', select: null, filters: [], payload: null, single: false, result: '…' };
  const chain = new Proxy({}, { get: (_t, key) => {
    if (key === 'then') return (resolve, reject) => respond(call).then(resolve, reject);
    if (key === 'select') return (columns) => { if (call.op === 'select') call.select = columns; return chain; };
    if (['upsert', 'insert', 'update', 'delete'].includes(key)) return (payload) => { call.op = key; call.payload = payload; return chain; };
    if (key === 'maybeSingle' || key === 'single') return () => { call.single = true; return chain; };
    return (...args) => { call.filters.push([key, ...args]); return chain; };
  } });
  return chain;
};
const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
export const supabase = {
  from: query,
  rpc: async () => ({ data: null, error: null }),
  channel: () => channel,
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};`;

const mocks = {
  client: fakeClient,
  events: `export const recordAiObservedEvent = async (event) => { window.harnessDb.events.unshift(event); window.harnessDb.notify(); };`,
  bags: `export const adjustBagStock = async () => { throw new Error('No usado en el arnés'); };`,
  useProperties: `import {useSyncExternalStore} from 'react';
    const db = window.harnessDb;
    export const useProperties=()=>{useSyncExternalStore(db.subscribe,()=>db.version);return {data:db.properties,isLoading:false}};
    export const usePropertyCleaningSchedule=()=>({data:{},isLoading:false});
    export const useCreateProperty=()=>({isPending:false,mutateAsync:async()=>{throw Error('No usado')}});
    export const useDeleteProperty=()=>({isPending:false,mutate:()=>{throw Error('No usado')}});
    export const useUpdateProperty=()=>({mutateAsync:async ({id,updates})=>{db.log.unshift({at:new Date().toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid'}),table:'properties (simulado)',op:'update',payload:updates,filters:[['eq','id',id]],result:'ok'});db.properties=db.properties.map(p=>p.id===id?{...p,...updates}:p);db.notify();}});`,
  useClients: `export const useClients=()=>({data:window.harnessDb.clients,isLoading:false});`,
  useSede: `export const useSede=()=>({activeSede:{id:'sede-local'},loading:false,isInitialized:true});`,
  useMobile: `export const useDeviceType=()=>({isDesktop:window.innerWidth>1000});`,
};

const app = `
import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { PropertiesPage } from './src/components/properties/PropertiesPage';
const db = window.harnessDb;
const queryClient = new QueryClient();
const toggles = [['wideJoinTimeout','Joins amplios expiran (57014, como producción)'],['failProducts','Fallar lectura de productos'],['failRulesRead','Fallar lectura de reglas'],['failUpsert','Fallar guardado (upsert)']];
function Panel() {
  useSyncExternalStore(db.subscribe, () => db.version);
  const set = (key, value) => { db.controls[key] = value; db.notify(); };
  return <aside aria-label="Controles del arnés" style={{position:'fixed',right:8,bottom:8,zIndex:9999,width:420,maxHeight:'45vh',overflow:'auto',background:'#fff',border:'2px solid #334155',borderRadius:8,padding:8,font:'12px system-ui'}}>
    <strong>Arnés local (sin red, BD simulada)</strong>
    {toggles.map(([key,label]) => <label key={key} style={{display:'block'}}><input type="checkbox" checked={db.controls[key]} onChange={e => set(key, e.target.checked)} /> {label}</label>)}
    <label style={{display:'block'}}>Latencia (ms) <input aria-label="Latencia (ms)" type="number" min="0" step="100" value={db.controls.latencyMs} onChange={e => set('latencyMs', Number(e.target.value) || 0)} style={{width:80}} /></label>
    <button type="button" onClick={() => { db.log.length = 0; db.events.length = 0; db.notify(); }}>Limpiar registro</button>
    <p style={{margin:'6px 0 2px'}}><strong>Reglas guardadas</strong></p>
    <pre data-testid="harness-rules" style={{whiteSpace:'pre-wrap',margin:0}}>{Object.entries(db.rules).map(([p, rules]) => p + ': ' + rules.map(r => r.product_id + '=' + r.quantity_per_cleaning + (r.warehouse_id ? '@' + r.warehouse_id : '@null') + (r.notes ? ' «' + r.notes + '»' : '')).join(', ')).join('\\n')}</pre>
    <p style={{margin:'6px 0 2px'}}><strong>Avisos registrados: {db.events.length}</strong></p>
    <p style={{margin:'6px 0 2px'}}><strong>Llamadas ({db.log.length})</strong></p>
    <ol data-testid="harness-log" style={{margin:0,paddingLeft:18}}>{db.log.slice(0, 30).map((c, i) => <li key={i}>{c.at} {c.op} {c.table} {(c.filters.find(f => f[1]==='property_id')||[])[2] || ''} {c.select && /\\(/.test(c.select) ? '[con joins]' : ''} → {c.result}</li>)}</ol>
  </aside>;
}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><MemoryRouter><PropertiesPage/></MemoryRouter><Toaster/><Panel/></QueryClientProvider>);`;

const bundle = await build({
  stdin: { contents: app, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-consumptions', setup(b) {
    b.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'client', namespace: 'mock' }));
    b.onResolve({ filter: /services\/aiObservedEvents$/ }, () => ({ path: 'events', namespace: 'mock' }));
    b.onResolve({ filter: /services\/stockBagAccounting$/ }, () => ({ path: 'bags', namespace: 'mock' }));
    b.onResolve({ filter: /hooks\/use(Properties|Clients)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'mock' }));
    b.onResolve({ filter: /contexts\/SedeContext$/ }, () => ({ path: 'useSede', namespace: 'mock' }));
    b.onResolve({ filter: /hooks\/use-mobile$/ }, () => ({ path: 'useMobile', namespace: 'mock' }));
    b.onResolve({ filter: /(CreatePropertyModal|AssignChecklistModal|PropertyChecklistInfo|PropertyPreferredCleaners|PropertyActivityPanel)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: `export const ${args.path}=()=>null;`, loader: 'js' }));
  } }],
});

const fixture = `
(() => {
  const base = {clienteId:'client',direccion:'Calle ficticia',numeroCamas:1,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:1,numeroCocinas:1,duracionServicio:60,costeServicio:35,checkInPredeterminado:'15:00',checkOutPredeterminado:'11:00',numeroSabanas:3,numeroSabanasRequenas:0,numeroSabanasSuite:0,numeroToallasGrandes:2,numeroTotallasPequenas:2,numeroAlfombrines:1,numeroFundasAlmohada:2,kitAlimentario:1,amenitiesBano:1,amenitiesCocina:1,cantidadRollosPapelHigienico:2,cantidadRollosPapelCocina:0,bayetasCocina:1,bolsasBasura:1,notas:'',linenControlEnabled:true,amenitiesControlEnabled:true,isActive:true,excludeFromExport:false};
  const listeners = new Set();
  const rule = (property_id, product_id, quantity_per_cleaning, warehouse_id, notes = null) => ({ id: property_id + ':' + product_id, property_id, product_id, quantity_per_cleaning, warehouse_id, notes, is_active: true, updated_at: '2026-10-22T10:00:00Z' });
  const db = window.harnessDb = {
    version: 0, log: [], events: [],
    controls: { wideJoinTimeout: true, failProducts: false, failRulesRead: false, failUpsert: false, latencyMs: 400 },
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    notify: () => { db.version++; for (const fn of listeners) fn(); },
    clients: [{ id: 'client', nombre: 'Cliente ficticio', isActive: true, linenControlEnabled: true, amenitiesControlEnabled: true }],
    properties: [
      { ...base, id: 'p-cga83', codigo: 'CGA8.3', nombre: 'Apartamento ficticio CGA8.3' },
      { ...base, id: 'p-cga84', codigo: 'CGA8.4', nombre: 'Apartamento ficticio CGA8.4', numeroSabanas: 5 },
    ],
    products: [
      { id: 'sheets', name: 'Sábanas grandes', is_consumable: true, is_active: true, unit_of_measure: 'ud', sede_id: 'sede-local', category: { kind: 'laundry', name: 'Lencería' } },
      { id: 'paper', name: 'Rollos de papel higiénico', is_consumable: true, is_active: true, unit_of_measure: 'ud', sede_id: 'sede-local', category: { kind: 'consumable', name: 'Consumibles' } },
      { id: 'kit', name: 'Amenities baño', is_consumable: true, is_active: true, unit_of_measure: 'ud', sede_id: 'sede-local', category: { kind: 'amenity', name: 'Amenities' } },
    ],
    rules: {
      'p-cga83': [rule('p-cga83', 'sheets', 3, 'almacen-cga8', 'Nota a conservar'), rule('p-cga83', 'paper', 2, null), rule('p-cga83', 'oculto', 4, 'almacen-cga8')],
      'p-cga84': [rule('p-cga84', 'sheets', 5, 'almacen-otro')],
    },
  };
})();`;

const css = readdirSync('dist/assets').filter(n => n.endsWith('.css')).map(n => readFileSync('dist/assets/' + n, 'utf8')).join('\n');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Arnés consumos</title><style>${css}</style></head><body><div id="root"></div><script>${fixture}</script><script src="/app.js"></script></body></html>`;
const js = bundle.outputFiles[0].text;

createServer((req, res) => {
  if (req.url === '/app.js') { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(js); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self' 'unsafe-inline' data: blob:" });
  res.end(html);
}).listen(port, '127.0.0.1', () => console.log(`Arnés de consumos en http://127.0.0.1:${port}/`));
