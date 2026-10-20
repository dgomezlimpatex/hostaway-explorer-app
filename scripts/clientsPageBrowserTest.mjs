// Prueba de navegador offline de /clients (local; la cola de entrega no tiene Chromium).
// Renderiza las páginas reales con un doble de Supabase en memoria que registra lecturas y
// escrituras, sesión y sede simuladas, y Playwright abortando toda petición a otro origen.
// Uso: node scripts/clientsPageBrowserTest.mjs [carpeta-capturas]
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { chromium } from '@playwright/test';

const shots = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const fakeSupabase = String.raw`
const params = new URLSearchParams(location.search);
const base = { cif_nif: 'B00000000', telefono: '600000000', direccion_facturacion: 'Rúa Ficticia 1', codigo_postal: '15001', ciudad: 'A Coruña', tipo_servicio: 'limpieza-turistica', metodo_pago: 'transferencia', supervisor: 'Laura', factura: true, linen_control_enabled: false, amenities_control_enabled: true, photos_visible_to_client: false, is_active: true };
let serial = 10000000;
const mk = (id, nombre, created, extra = {}) => ({ id, nombre, sede_id: 'sede-a', created_at: created, updated_at: created, ...base, cif_nif: 'B' + (serial++), email: id + '@cliente.test', ...extra });
const clients = [
  mk('c-zeta', 'Zeta Rentals', '2026-09-01T00:00:00Z', { supervisor: 'laura ', ciudad: 'Oleiros' }),
  mk('c-alfa', 'Apartamentos Alfa', '2026-03-01T00:00:00Z'),
  mk('c-incompleto', 'Cliente Importado Incompleto', '2026-08-01T00:00:00Z', { cif_nif: '', telefono: null, email: '', direccion_facturacion: null, codigo_postal: '', supervisor: null, factura: false }),
  mk('c-libre', 'Cliente Libre', '2026-08-02T00:00:00Z'),
  mk('c-hist', 'Hostal Antiguo', '2025-01-01T00:00:00Z', { is_active: false }),
  mk('c-dup-1', 'Hostal Mar', '2026-05-01T00:00:00Z', { cif_nif: 'B15000001' }),
  mk('c-dup-2', 'Hostal  Mar', '2026-05-02T00:00:00Z', { cif_nif: 'b-15000001' }),
  mk('c-largo', 'Comunidad de Propietarios Edificio Residencial Avenida de la Marina Número Doscientos', '2026-04-01T00:00:00Z', { tipo_servicio: 'limpieza-mantenimiento', metodo_pago: 'bizum' }),
];
const prop = (id, nombre, codigo, cliente_id, is_active) => ({ id, nombre, codigo, direccion: 'Rúa ' + codigo, cliente_id, sede_id: 'sede-a', is_active, duracion_servicio: 90, coste_servicio: 30, numero_camas: 2, numero_banos: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
const properties = [prop('p-1', 'Alfa 1A', 'ALF-1A', 'c-alfa', true), prop('p-2', 'Alfa 2B', 'ALF-2B', 'c-alfa', null), prop('p-z', 'Zeta Ático', 'ZET-1', 'c-zeta', null)];
const tables = {
  clients, properties,
  tasks: [{ id: 't-old', cliente_id: 'c-hist', propiedad_id: null, sede_id: 'sede-a', date: '2025-02-01', status: 'completed' }],
  client_portal_access: [{ id: 'pa-1', client_id: 'c-alfa', access_pin: '123456', portal_token: 'tok', short_code: 'abc12def', is_active: true, last_access_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' }],
};
window.fixtureTables = tables; window.writes = []; window.reads = []; window.rpcs = [];
window.deleteBlockedByRls = params.get('rls') === 'block';
const withJoin = (table, row) => table === 'properties' ? { ...row, clients: (() => { const c = clients.find(x => x.id === row.cliente_id); return c ? { nombre: c.nombre, is_active: c.is_active, linen_control_enabled: c.linen_control_enabled } : null; })() } : row;
const builder = (table) => {
  const filters = []; let mode = 'many'; let write = null; let payload = null; let head = false; let returning = false;
  const matching = () => (tables[table] || []).filter((row) => filters.every((f) => f(row)));
  const exec = async () => {
    let rows;
    if (write === 'insert' || write === 'upsert') { const row = { id: 'new-' + ((tables[table] || []).length + 1), created_at: new Date().toISOString(), ...payload }; (tables[table] = tables[table] || []).push(row); rows = [row]; }
    else if (write === 'update') { rows = matching(); rows.forEach((r) => Object.assign(r, payload)); }
    else if (write === 'delete') {
      rows = window.deleteBlockedByRls ? [] : matching();
      tables[table] = (tables[table] || []).filter((r) => !rows.includes(r));
      return { data: returning ? rows.map(r => ({ id: r.id })) : null, error: null, count: null };
    }
    else { window.reads.push(table); rows = matching(); }
    if (head) return { data: null, error: null, count: rows.length };
    rows = rows.map((r) => withJoin(table, { ...r }));
    if (mode === 'single') return rows.length ? { data: rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'No rows' } };
    if (mode === 'maybe') return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null, count: rows.length };
  };
  const proxy = new Proxy({}, { get(_, prop) {
    if (prop === 'then') return (res, rej) => exec().then(res, rej);
    if (prop === 'select') return (cols, opts) => { if (write) returning = true; head = !!opts?.head; return proxy; };
    if (['insert', 'update', 'upsert', 'delete'].includes(prop)) return (p) => { write = prop; payload = p; window.writes.push({ table, op: prop, payload: p ?? null }); return proxy; };
    if (prop === 'eq') return (c, v) => { filters.push((r) => r[c] === v); return proxy; };
    if (prop === 'in') return (c, vs) => { filters.push((r) => vs.includes(r[c])); return proxy; };
    if (prop === 'single') return () => { mode = 'single'; return proxy; };
    if (prop === 'maybeSingle') return () => { mode = 'maybe'; return proxy; };
    return () => proxy;
  } });
  return proxy;
};
const channel = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
export const supabase = { from: builder, rpc: async (n) => { window.rpcs.push(n); return { data: [], error: null }; }, channel: () => channel, removeChannel: () => {},
  functions: { invoke: async (n) => { window.writes.push({ fn: n }); return { data: null, error: null }; } },
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  auth: { getUser: async () => ({ data: { user: { id: 'u-1' } }, error: null }), getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
`;
const sede = String.raw`
const sedes = [{ id: 'sede-a', nombre: 'Coruña', codigo: 'COR', is_active: true }];
localStorage.setItem('activeSede', JSON.stringify(sedes[0]));
export const useSede = () => ({ activeSede: sedes[0], availableSedes: sedes, loading: false, isInitialized: true, setActiveSede: () => {}, refreshSedes: async () => {}, isActiveSedeSet: () => true, getActiveSedeId: () => 'sede-a', hasAccessToSede: () => true });
export const SedeProvider = ({ children }) => children;
`;
const auth = String.raw`
const role = new URLSearchParams(location.search).get('role') || 'admin';
export const useAuth = () => ({ user: { id: 'u-1' }, session: {}, profile: { id: 'u-1' }, userRole: role, userRoles: [role], operationalMode: 'management', loading: false, isLoading: false, signOut: async () => {} });
export const AuthContext = null;
`;
// Matriz real de roles; solo la supervisión recibe el contrato acordado (Trabajadores lo activará).
const permissions = String.raw`
import * as real from './src/lib/rolePermissions.ts';
export * from './src/lib/rolePermissions.ts';
const contract = { ...real.ROLE_PERMISSIONS, supervisor: { ...real.ROLE_PERMISSIONS.supervisor, clients: { canView: true, canCreate: false, canEdit: true, canDelete: false } } };
export const ROLE_PERMISSIONS = contract;
export const getRolePermissions = (role) => (role && contract[role]) || real.getRolePermissions(null);
export const canRoleAccessModule = (role, module) => getRolePermissions(role)[module]?.canView ?? false;
`;
const mocks = [[/(^|\/)supabase\/client$/, fakeSupabase], [/(^|\/)SedeContext$/, sede], [/(^|\/)useAuth$/, auth], [/(^|\/)lib\/rolePermissions$/, permissions]];
const entry = String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientsPage } from './src/components/clients/ClientsPage';
import { PropertiesPage } from './src/components/properties/PropertiesPage';
import { Toaster } from './src/components/ui/toaster';
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
window.qc = qc;
function Where() { const l = useLocation(); return <output data-testid="where" className="sr-only">{l.pathname + l.search}</output>; }
createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><BrowserRouter><Where /><Routes><Route path="/clients" element={<ClientsPage />} /><Route path="/properties" element={<PropertiesPage />} /></Routes></BrowserRouter><Toaster /></QueryClientProvider>);`;

const built = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'silent',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"test"}' },
  plugins: [{ name: 'offline', setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => (mocks.find(([re]) => re.test(a.path)) ? { path: a.path, namespace: 'fixture' } : null));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, (a) => ({ contents: mocks.find(([re]) => re.test(a.path))[1], loader: 'tsx', resolveDir: process.cwd() }));
  } }],
});
assert.deepEqual(Object.keys(built.metafile.inputs).filter((p) => /integrations\/supabase\/client\.ts$/.test(p)), [], 'El cliente Supabase real no debe empaquetarse');
const cssSource = fs.readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const blocked = []; const pageErrors = [];
let checks = 0;
const check = (cond, message) => { assert.ok(cond, message); checks++; };
const same = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
// Captura del viewport: una captura de página completa cambia el tamaño y remonta la ficha.
const shot = async (page, name) => { if (shots) { await page.waitForTimeout(350); await page.screenshot({ path: path.join(shots, name + '.png') }); } };

const open = async (query = '', viewport = { width: 1440, height: 900 }, route = '/clients') => {
  const ctx = await browser.newContext({ viewport });
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(origin)) return r.continue(); blocked.push(u); return r.abort(); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(`${origin}${route}?${query}`);
  return page;
};
const writes = (page) => page.evaluate(() => window.writes);
// Texto visible y atributos del DOM (sin el script empaquetado, que contiene los fixtures).
const visibleText = (page) => page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('input, [value]')].map(e => e.value || e.getAttribute('value') || '').join(' '));
const names = (page) => page.locator('button[aria-pressed] span.block.break-words').allTextContents();
const select = async (page, name) => { await page.locator('button[aria-pressed]').filter({ hasText: name }).first().click(); await page.locator('[data-entity-detail-title]').filter({ hasText: name }).first().waitFor(); };
const toast = (page) => page.locator('[data-state="open"]').filter({ hasText: /Cliente|eliminado|PIN|guardado/ });

try {
  // ---------- Administración, escritorio ----------
  let p = await open('role=admin');
  await p.getByText('de 8 clientes').waitFor();
  await p.waitForTimeout(200);
  same(await writes(p), [], 'Abrir no escribe');
  const order = await names(p);
  same(order.slice(0, 4), ['Apartamentos Alfa', 'Cliente Importado Incompleto', 'Cliente Libre', 'Comunidad de Propietarios Edificio Residencial Avenida de la Marina Número Doscientos'], 'CLI-13 orden alfabético');
  check(!(await visibleText(p)).includes('Gestión comercial'), 'CLI-14 antetítulo operativo');
  await shot(p, '01-admin-escritorio');

  // CLI-07 / CLI-08 búsqueda normalizada y por propiedad
  await p.getByLabel('Buscar clientes').fill('B15000001');
  same((await names(p)).length, 2, 'CLI-07 CIF con separadores encuentra ambos');
  await p.getByLabel('Buscar clientes').fill('ALF-1A');
  same(await names(p), ['Apartamentos Alfa'], 'CLI-08 buscar por código de propiedad');
  await p.getByLabel('Buscar clientes').fill('');

  // CLI-08 pestaña Propiedades y métrica
  await select(p, 'Apartamentos Alfa');
  check(await p.getByText('Propiedades', { exact: true }).first().isVisible(), 'Métrica de propiedades en cabecera');
  await p.getByRole('tab', { name: 'Propiedades' }).click();
  const links = await p.getByRole('tabpanel').locator('a').evaluateAll(as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
  same(links, [['Ver en Propiedades', '/properties?cliente=c-alfa'], ['Alfa 1A', '/properties?propertyId=p-1'], ['Alfa 2B', '/properties?propertyId=p-2']], 'CLI-08 enlaces a propiedades');
  check(await p.getByText('Activa · heredado').isVisible(), 'Estado heredado visible');
  await shot(p, '02-admin-propiedades');

  // CLI-11 portal fuera del formulario, con confirmación
  await p.getByRole('tab', { name: 'Portal' }).click();
  await p.getByText('Portal activo').waitFor();
  await p.getByRole('button', { name: 'Regenerar PIN' }).click();
  await p.getByRole('alertdialog').getByText('¿Regenerar el PIN?').waitFor();
  same((await writes(p)).length, 0, 'CLI-11 regenerar no escribe sin confirmar');
  await shot(p, '03-admin-portal-confirmacion');
  await p.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  same((await writes(p)).length, 0, 'Cancelar no escribe');
  await p.getByRole('button', { name: 'Regenerar PIN' }).click();
  await p.getByRole('alertdialog').getByRole('button', { name: 'Regenerar PIN' }).click();
  await p.waitForTimeout(200);
  same((await writes(p)).map(w => [w.table, w.op, Object.keys(w.payload)]), [['client_portal_access', 'update', ['access_pin']]], 'Confirmar regenera una vez');
  await p.evaluate(() => { window.writes.length = 0; });

  // CLI-04 / CLI-06 edición: conflicto sin cerrar y foco al cerrar
  await p.getByRole('tab', { name: 'Ficha' }).click();
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  let dialog = p.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill('Apartamentos Alfa Editado');
  check(!(await dialog.textContent()).includes('Portal de reservas'), 'CLI-11 el portal ya no está en el formulario');
  same(await dialog.getByText('Posible cliente duplicado en esta sede').count(), 0, 'Sin aviso de duplicado si no coincide');
  await p.evaluate(() => { window.fixtureTables.clients.find(c => c.id === 'c-alfa').telefono = '699999999'; window.qc.invalidateQueries({ queryKey: ['clients'] }); });
  await dialog.getByText('Este cliente ha cambiado mientras lo editabas').waitFor();
  same(await dialog.getByLabel('Nombre').inputValue(), 'Apartamentos Alfa Editado', 'CLI-04 se conserva lo escrito');
  await shot(p, '04-admin-conflicto');
  await p.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  same(await p.evaluate(() => document.activeElement?.textContent?.trim()), 'Editar cliente', 'CLI-06 foco vuelve a Editar cliente');
  same(await writes(p), [], 'Cerrar sin guardar no escribe');

  // CLI-03 ficha incompleta: inactivar directo y edición operativa sin inventar datos
  await select(p, 'Cliente Importado Incompleto');
  await p.getByRole('tab', { name: 'Facturación' }).click();
  await p.getByRole('button', { name: 'Inactivar' }).click();
  await p.getByRole('alertdialog').getByText('¿Inactivar a Cliente Importado Incompleto?').waitFor();
  await p.getByRole('alertdialog').getByRole('button', { name: 'Inactivar cliente' }).click();
  await p.getByText('Cliente inactivado').first().waitFor();
  same((await writes(p)).map(w => [w.table, w.op, w.payload]), [['clients', 'update', { is_active: false }]], 'CLI-03 inactivar envía solo is_active');
  await p.evaluate(() => { window.writes.length = 0; });
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  await dialog.getByLabel('Supervisor').fill(' Laura ');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await dialog.waitFor({ state: 'detached' });
  same((await writes(p)).map(w => w.payload), [{ supervisor: 'Laura' }], 'CLI-03/10 guarda solo el cambio, recortado');
  await p.evaluate(() => { window.writes.length = 0; });
  // Activar factura sin datos fiscales: se mantiene la validación, en español
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  await dialog.getByRole('checkbox', { name: /Emite factura/ }).click();
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await dialog.getByText('El CIF/NIF es obligatorio').waitFor();
  const messages = await dialog.locator('p[id$="-form-item-message"]').allTextContents();
  check(messages.length >= 4 && messages.every(m => !/Expected|Required|Invalid/.test(m)), 'Mensajes en español: ' + messages.join(' | '));
  same(await writes(p), [], 'Factura sin datos fiscales no se guarda');
  await shot(p, '05-admin-validacion-factura');
  await p.keyboard.press('Escape');

  // CLI-09 aviso de herencia al inactivar desde el formulario
  await select(p, 'Apartamentos Alfa');
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  await dialog.getByRole('checkbox', { name: /Cliente activo/ }).click();
  check(await dialog.getByText('1 propiedad sin estado propio pasará a mostrarse como inactiva').isVisible(), 'CLI-09 aviso con 1 propiedad heredada');
  check(await dialog.getByText('1 con estado propio no cambian.', { exact: false }).isVisible(), 'CLI-09 propiedades con estado propio');
  await p.keyboard.press('Escape');

  // CLI-07 aviso de duplicado en el alta
  await p.getByRole('button', { name: 'Nuevo cliente' }).click();
  await dialog.getByLabel('Nombre').fill('hostal mar');
  await dialog.getByText('Posible cliente duplicado en esta sede').waitFor();
  same(await dialog.getByRole('link', { name: 'Ver ficha' }).count(), 2, 'Aviso con enlace a ambos');
  await shot(p, '06-admin-duplicado');
  await p.keyboard.press('Escape');

  // CLI-01 borrado bloqueado con propiedades e histórico
  await select(p, 'Apartamentos Alfa');
  await p.getByRole('button', { name: 'Eliminar cliente' }).click();
  await p.getByText('No se puede eliminar: tiene registros relacionados.').waitFor();
  const blockedText = await p.getByRole('alertdialog').textContent();
  check(blockedText.includes('2 propiedades') && blockedText.includes('1 acceso al portal'), 'Lista de dependencias');
  same(await p.getByRole('button', { name: 'Eliminar definitivamente' }).count(), 0, 'Sin botón de borrar');
  await shot(p, '07-admin-borrado-bloqueado');
  await p.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await select(p, 'Hostal Antiguo');
  await p.getByRole('button', { name: 'Eliminar cliente' }).click();
  await p.getByText('1 tareas (incluido el histórico)').waitFor();
  await p.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  same((await writes(p)).filter(w => w.op === 'delete'), [], 'CLI-01 ningún DELETE con dependencias');
  await p.context().close();

  // CLI-02 borrado sin dependencias: confirmación reforzada y 0 filas no es éxito
  p = await open('role=admin&rls=block');
  await p.getByText('de 8 clientes').waitFor();
  await select(p, 'Cliente Libre');
  await p.getByRole('button', { name: 'Eliminar cliente' }).click();
  const confirm = p.getByRole('button', { name: 'Eliminar definitivamente' });
  await confirm.waitFor();
  check(await confirm.isDisabled(), 'Deshabilitado hasta escribir el nombre');
  await p.getByLabel('Nombre del cliente para confirmar').fill('cliente libre');
  await confirm.click();
  await p.getByText('No se ha eliminado el cliente').first().waitFor();
  check(!(await visibleText(p)).includes('El cliente ha sido eliminado'), 'CLI-02 sin falso éxito');
  await shot(p, '08-admin-borrado-rls');
  await p.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await p.waitForTimeout(150);
  check((await names(p)).includes('Cliente Libre'), 'Sigue listado tras 0 filas');
  await p.evaluate(() => { window.deleteBlockedByRls = false; });
  await p.getByRole('button', { name: 'Eliminar cliente' }).click();
  await p.getByLabel('Nombre del cliente para confirmar').fill('Cliente Libre');
  await p.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await p.getByText('El cliente ha sido eliminado.').first().waitFor();
  await p.waitForTimeout(200);
  check(!(await names(p)).includes('Cliente Libre'), 'Con 1 fila borrada desaparece');
  await p.context().close();

  // ---------- Gerencia ----------
  p = await open('role=manager');
  await p.getByText('de 8 clientes').waitFor();
  await select(p, 'Cliente Libre');
  same(await p.getByRole('button', { name: 'Eliminar cliente' }).count(), 0, 'Gerencia no borra');
  check(await p.getByRole('tab', { name: 'Portal' }).isVisible() && await p.getByRole('button', { name: 'Nuevo cliente' }).isVisible() && await p.getByRole('button', { name: 'Editar cliente' }).isVisible(), 'Gerencia conserva alta, edición y portal');
  await p.context().close();

  // ---------- Supervisión (contrato acordado) ----------
  p = await open('role=supervisor');
  dialog = p.getByRole('dialog');
  await p.getByText('de 8 clientes').waitFor();
  await select(p, 'Apartamentos Alfa');
  same([await p.getByRole('button', { name: 'Nuevo cliente' }).count(), await p.getByRole('button', { name: 'Eliminar cliente' }).count(), await p.getByRole('tab', { name: 'Portal' }).count()], [0, 0, 0], 'Supervisión sin alta, borrado ni portal');
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  check(await dialog.getByLabel(/CIF\/NIF/).isDisabled() && await dialog.getByLabel(/^Nombre/).isDisabled() && await dialog.getByRole('checkbox', { name: /Emite factura/ }).isDisabled(), 'Nombre y fiscales en solo lectura');
  await dialog.getByLabel('Teléfono').fill('611222333');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await dialog.waitFor({ state: 'detached' });
  same((await writes(p)).map(w => [w.table, w.payload]), [['clients', { telefono: '611222333' }]], 'Supervisión guarda solo el dato operativo');
  const reads = await p.evaluate(() => window.reads);
  check(!reads.includes('client_portal_access'), 'La pantalla no consulta el portal para supervisión');
  check(!(await visibleText(p)).includes('123456'), 'Sin PIN en el DOM');
  await shot(p, '09-supervision');
  await p.context().close();

  // ---------- Móvil ----------
  p = await open('role=admin', { width: 390, height: 844 });
  await p.getByText('de 8 clientes').waitFor();
  const firstTop = await p.locator('button[aria-pressed]').filter({ hasText: 'Apartamentos Alfa' }).evaluate(el => el.getBoundingClientRect().top);
  check(firstTop < 422, `CLI-14 primer cliente en la primera mitad (${Math.round(firstTop)} px)`);
  await shot(p, '10-movil-directorio');
  await p.locator('button[aria-pressed]').filter({ hasText: 'Apartamentos Alfa' }).click();
  await p.getByRole('button', { name: 'Editar cliente' }).click();
  const box = await p.getByRole('dialog').last().evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  check(box.scrollWidth <= box.clientWidth, `CLI-05 editor sin desbordar (${JSON.stringify(box)})`);
  await shot(p, '11-movil-editor');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  await p.getByRole('tab', { name: 'Portal' }).click();
  await p.getByText('Portal activo').waitFor();
  const portalBox = await p.getByRole('dialog').evaluate(el => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  check(portalBox.scrollWidth <= portalBox.clientWidth, `Ficha con portal sin desbordar (${JSON.stringify(portalBox)})`);
  await shot(p, '12-movil-portal');
  await p.context().close();

  // ---------- Propiedades filtradas desde la ficha ----------
  p = await open('cliente=c-alfa', { width: 1440, height: 900 }, '/properties');
  await p.getByText(/2 de 3 propiedades/).waitFor();
  same(await p.getByLabel('Filtrar por cliente').textContent(), 'Apartamentos Alfa', 'Filtro de cliente desde la URL');
  await p.context().close();

  same(blocked, [], 'Ninguna petición externa');
  same(pageErrors, [], 'Sin errores de página');
  console.log(`PASS clientsPageBrowserTest: ${checks} checks (admin/gerencia/supervisión, escritorio y móvil, sin red)`);
} catch (error) {
  if (shots) for (const ctx of browser.contexts()) for (const page of ctx.pages()) await page.screenshot({ path: path.join(shots, 'fallo.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  server.close();
}
