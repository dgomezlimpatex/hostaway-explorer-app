// Offline harness for the global search: real search, pages and detail panels,
// with an in-memory Supabase double that serves synthetic rows and records any write.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const fakeSupabase = String.raw`
const today = new Date().toISOString().slice(0, 10);
const client = (id, nombre, sede_id, is_active = true, extra = {}) => ({ id, nombre, sede_id, is_active, cif_nif: 'B' + id.toUpperCase(), telefono: '600000000', email: id + '@cliente.test', direccion_facturacion: 'Calle Falsa 1', codigo_postal: '15001', ciudad: 'A Coruña', tipo_servicio: 'limpieza-turistica', metodo_pago: 'transferencia', supervisor: 'Supervisión', factura: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra });
const clients = [
  client('c-dup-1', 'Hostal Duplicado', 'sede-a'),
  client('c-dup-2', 'Hostal Duplicado', 'sede-a', false, { cif_nif: 'B-SEGUNDO' }),
  client('c-other', 'Cliente Corriente', 'sede-a'),
  client('c-sede-b', 'Hostal Duplicado', 'sede-b'),
];
const byClient = Object.fromEntries(clients.map((c) => [c.id, c]));
const property = (id, nombre, codigo, cliente_id, sede_id = 'sede-a') => ({ id, nombre, codigo, direccion: 'Rúa ' + codigo, cliente_id, sede_id, is_active: true, duracion_servicio: 90, coste_servicio: 30, numero_camas: 2, numero_banos: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', clients: byClient[cliente_id] ? { nombre: byClient[cliente_id].nombre, is_active: byClient[cliente_id].is_active, linen_control_enabled: false } : null });
const properties = [
  ...Array.from({ length: 40 }, (_, i) => property('p-' + i, 'Apartamento ' + String(i).padStart(2, '0'), 'APT-' + i, 'c-other')),
  property('p-dup-1', 'Zeta Duplicado', 'DUP-UNO', 'c-dup-1'),
  property('p-dup-2', 'Zeta Duplicado', 'DUP-DOS', 'c-dup-2'),
  property('p-sede-b', 'Zeta Duplicado', 'DUP-B', 'c-sede-b', 'sede-b'),
];
const cleaner = (id, name, is_active, sede_id = 'sede-a') => ({ id, name, email: id + '@personal.test', telefono: '611111111', is_active, sede_id, user_id: null, sort_order: 1, contract_hours_per_week: 20, created_at: '2026-01-01T00:00:00Z' });
const cleaners = [cleaner('w-ana-1', 'Ana Repetida', true), cleaner('w-ana-2', 'Ana Repetida', false), cleaner('w-sede-b', 'Ana Repetida', true, 'sede-b')];
const task = (id, date, propiedad_id, extra = {}) => { const p = properties.find((x) => x.id === propiedad_id); return { id, date, property: p.nombre, address: p.direccion, propiedad_id, cliente_id: p.cliente_id, sede_id: p.sede_id, start_time: '10:00', end_time: '11:30', type: 'limpieza-turistica', status: 'pending', check_in: '15:00', check_out: '11:00', cleaner: 'Ana Repetida', cleaner_id: 'w-ana-1', duracion: 90, notes: 'Nota ' + id, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra }; };
const tasks = [
  task('t-old', '2025-01-10', 'p-dup-2', { notes: 'Tarea antigua fuera de la semana' }),
  task('t-now', today, 'p-dup-1', { notes: 'Tarea de hoy' }),
  ...Array.from({ length: 30 }, (_, i) => task('t-' + i, today, 'p-' + i)),
  task('t-sede-b', today, 'p-sede-b'),
];
const tables = { clients, properties, cleaners, tasks, sedes: [{ id: 'sede-a', nombre: 'Coruña' }, { id: 'sede-b', nombre: 'Vigo' }] };
window.fixtureTables = tables;
window.writes = [];
window.rpcs = [];
window.reads = [];
const ok = (data) => ({ data, error: null, count: Array.isArray(data) ? data.length : null });
const like = (value, pattern) => String(value ?? '').toLowerCase().includes(pattern.replace(/%/g, '').toLowerCase());
const builder = (table) => {
  const filters = [];
  let mode = 'many';
  let write = null;
  let limit = Infinity;
  const exec = async () => {
    if (write) return ok(null);
    window.reads.push(table);
    const delay = table === 'tasks' && window.fixtureDelays ? window.fixtureDelays(filters) : 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const rows = (tables[table] || []).filter((row) => filters.every((f) => f.test(row))).slice(0, limit);
    if (mode === 'single') return rows.length ? ok(rows[0]) : { data: null, error: { code: 'PGRST116', message: 'No rows' } };
    if (mode === 'maybe') return ok(rows[0] ?? null);
    return ok(rows);
  };
  const add = (key, value, test) => { filters.push({ key, value, test }); return proxy; };
  const proxy = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (resolve, reject) => exec().then(resolve, reject);
      if (['insert', 'update', 'upsert', 'delete'].includes(prop)) return (...args) => { write = prop; window.writes.push({ table, op: prop, args }); return proxy; };
      if (prop === 'eq') return (c, v) => add(c, v, (r) => r[c] === v);
      if (prop === 'neq') return (c, v) => add(c, v, (r) => r[c] !== v);
      if (prop === 'in') return (c, vs) => add(c, vs, (r) => vs.includes(r[c]));
      if (prop === 'gte') return (c, v) => add(c, v, (r) => r[c] == null || r[c] >= v);
      if (prop === 'lte') return (c, v) => add(c, v, (r) => r[c] == null || r[c] <= v);
      if (prop === 'ilike') return (c, v) => add(c, v, (r) => like(r[c], v));
      if (prop === 'or') return (expr) => {
        const parts = String(expr).split(',').map((s) => s.split('.ilike.')).filter((p) => p.length === 2);
        return parts.length ? add('or', expr, (r) => parts.some(([c, v]) => like(r[c], v))) : proxy;
      };
      if (prop === 'single') return () => { mode = 'single'; return proxy; };
      if (prop === 'maybeSingle') return () => { mode = 'maybe'; return proxy; };
      if (prop === 'limit') return (n) => { limit = n; return proxy; };
      return () => proxy;
    },
  });
  return proxy;
};
const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
export const supabase = {
  from: builder,
  rpc: async (name, args) => { window.rpcs.push(name); return ok([]); },
  channel: () => channel,
  removeChannel: () => {},
  functions: { invoke: async (name) => { window.writes.push({ fn: name }); return ok(null); } },
  storage: { from: () => ({ upload: async () => { window.writes.push({ storage: 'upload' }); return ok(null); }, getPublicUrl: () => ({ data: { publicUrl: '' } }), createSignedUrl: async () => ok({ signedUrl: '' }) }) },
  auth: { getUser: async () => ok({ user: { id: 'u-admin' } }), getSession: async () => ok({ session: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
};
`;

const sede = String.raw`
import React from 'react';
const sedes = [{ id: 'sede-a', nombre: 'Coruña', codigo: 'COR', is_active: true }, { id: 'sede-b', nombre: 'Vigo', codigo: 'VGO', is_active: true }];
localStorage.setItem('activeSede', JSON.stringify(sedes[0]));
export const useSede = () => {
  const [ready, setReady] = React.useState(!window.fixtureSlowSede);
  React.useEffect(() => { if (!ready) { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t); } }, [ready]);
  return { activeSede: ready ? sedes[0] : null, availableSedes: sedes, loading: !ready, isInitialized: ready, setActiveSede: () => { window.sedeChanges = (window.sedeChanges || 0) + 1; }, refreshSedes: async () => {}, isActiveSedeSet: () => ready, getActiveSedeId: () => (ready ? 'sede-a' : null), hasAccessToSede: (id) => id === 'sede-a' };
};
export const SedeProvider = ({ children }) => children;
`;

const auth = String.raw`
export const useAuth = () => ({ user: { id: 'u-admin', email: 'admin@test' }, session: {}, profile: { id: 'u-admin', full_name: 'Admin Prueba', email: 'admin@test' }, userRole: 'admin', loading: false, isLoading: false, signOut: async () => {} });
export const AuthContext = null;
`;

const mocks = [
  [/(^|\/)supabase\/client$/, fakeSupabase],
  [/(^|\/)SedeContext$/, sede],
  [/(^|\/)useAuth$/, auth],
];

export async function buildGlobalSearchFixture() {
  const entry = String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GlobalSearch } from './src/components/navigation/GlobalSearch';
import { MobileDashboardSidebar } from './src/components/dashboard/MobileDashboardSidebar';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from './src/components/ui/drawer';
import { ClientsPage } from './src/components/clients/ClientsPage';
import { PropertiesPage } from './src/components/properties/PropertiesPage';
import TasksPage from './src/components/tasks/TasksPage';
import PersonnelProfile from './src/features/personnel/PersonnelProfile';
import { Toaster } from './src/components/ui/toaster';
function Where() { const l = useLocation(); return <output aria-label="Ubicación actual" data-testid="where">{l.pathname + l.search}</output>; }
function MobileMenu() {
  const [open, setOpen] = React.useState(false);
  return <Drawer open={open} onOpenChange={setOpen}><DrawerTrigger asChild><button type="button">Menú</button></DrawerTrigger><DrawerContent className="max-h-[88dvh]"><DrawerTitle className="sr-only">Menú</DrawerTitle><MobileDashboardSidebar onNavigate={() => setOpen(false)} /></DrawerContent></Drawer>;
}
const mobile = window.innerWidth < 768;
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter>
      <header className="flex items-center gap-2 border-b p-2"><Where />{mobile ? <MobileMenu /> : <div className="w-64"><GlobalSearch /></div>}<Link to="/">Inicio</Link></header>
      <Routes>
        <Route path="/" element={<p>Inicio de prueba</p>} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/workers/:workerId" element={<PersonnelProfile />} />
      </Routes>
    </BrowserRouter>
    <Toaster />
  </QueryClientProvider>,
);`;
  const built = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent',
    loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"test"}' },
    plugins: [{ name: 'offline', setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => { const hit = mocks.find(([re]) => re.test(a.path)); return hit ? { path: a.path, namespace: 'fixture' } : null; });
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ contents: mocks.find(([re]) => re.test(a.path))[1], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  const real = Object.keys(built.metafile.inputs).filter((path) => /integrations\/supabase\/client\.ts$/.test(path));
  assert.deepEqual(real, [], 'The real Supabase client must not be bundled');
  let cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
  if (existsSync('src/features/personnel/personnel.css')) cssSource += readFileSync('src/features/personnel/personnel.css', 'utf8');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
