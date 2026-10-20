// Pruebas offline de Clientes: reglas del formulario, permisos de pantalla, duplicados,
// búsqueda, propiedades y borrado protegido. Usa el código real empaquetado con esbuild y
// un doble de Supabase en memoria (sin red, sin sesión, sin datos reales).
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const fakeSupabase = String.raw`
const state = globalThis.__fake = { calls: [], counts: {}, failing: new Set(), deleteRows: 1, deleteError: null };
const builder = (table) => {
  const call = { table, op: 'select', filters: [], selectArgs: null, head: false };
  state.calls.push(call);
  const exec = async () => {
    if (call.op === 'delete') {
      if (state.deleteError) return { data: null, error: state.deleteError };
      return { data: call.returning ? Array.from({ length: state.deleteRows }, (_, i) => ({ id: 'row-' + i })) : null, error: null, count: null };
    }
    if (call.head) {
      if (state.failing.has(table)) return { data: null, error: { message: 'relation does not exist' }, count: null };
      return { data: null, error: null, count: state.counts[table] ?? 0 };
    }
    return { data: [], error: null };
  };
  const proxy = new Proxy({}, { get(_, prop) {
    if (prop === 'then') return (res, rej) => exec().then(res, rej);
    if (prop === 'select') return (cols, opts) => { if (call.op === 'delete') call.returning = cols; else { call.selectArgs = cols; call.head = !!opts?.head; call.countMode = opts?.count; } return proxy; };
    if (['insert', 'update', 'upsert', 'delete'].includes(prop)) return (payload) => { call.op = prop; call.payload = payload ?? null; return proxy; };
    if (prop === 'eq') return (c, v) => { call.filters.push([c, v]); return proxy; };
    return () => proxy;
  } });
  return proxy;
};
export const supabase = { from: builder, rpc: async () => ({ data: null, error: null }) };
`;

const folder = mkdtempSync(join(tmpdir(), 'clients-rules-'));
try {
  const file = join(folder, 'bundle.cjs');
  const built = await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export * from './src/components/clients/clientRules';
      export { clientStorage } from './src/services/storage/clientStorage';
      export { DeleteNotAppliedError } from './src/services/storage/baseStorage';
      export { propertyStorage } from './src/services/storage/propertyStorage';
      export { vacationRequestsStorage } from './src/services/storage/vacationRequestsStorage';
      export { ROLE_PERMISSIONS } from './src/lib/rolePermissions';
      export { mapClientFromDB } from './src/services/storage/mappers/clientMappers';
    ` },
    bundle: true, platform: 'node', format: 'cjs', outfile: file, logLevel: 'silent', metafile: true,
    plugins: [{ name: 'offline', setup(b) {
      b.onResolve({ filter: /(^|\/)integrations\/supabase\/client$/ }, () => ({ path: 'fake', namespace: 'fake' }));
      b.onResolve({ filter: /(^|\/)aiObservedEvents$/ }, () => ({ path: 'events', namespace: 'fake' }));
      b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path === 'fake' ? fakeSupabase : 'export const recordAiObservedEvent = async () => {};', loader: 'js' }));
    } }],
  });
  assert.equal(Object.keys(built.metafile.inputs).some(path => /integrations\/supabase\/client\.ts$/.test(path)), false, 'El cliente Supabase real no debe empaquetarse');
  globalThis.localStorage = { getItem: (key) => key === 'activeSede' ? JSON.stringify({ id: 'sede-a' }) : null };
  const api = createRequire(import.meta.url)(file);
  const fake = globalThis.__fake;
  let checks = 0;
  const ok = (cond, message) => { assert.ok(cond, message); checks++; };
  const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
  const issues = (schema, values) => { const r = schema.safeParse(values); return r.success ? [] : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`); };

  // CLI-03: valores nulos de la base se convierten en vacío y no rompen el formulario.
  const incompleteRow = { id: 'c-inc', nombre: 'Cliente Importado', cif_nif: '', telefono: null, email: '', direccion_facturacion: null, codigo_postal: '', ciudad: null, tipo_servicio: 'limpieza-turistica', metodo_pago: 'transferencia', supervisor: null, factura: false, is_active: true };
  const incomplete = api.clientToFormValues(api.mapClientFromDB(incompleteRow));
  eq(Object.values(incomplete).filter(v => v === null || v === undefined), [], 'Sin null en el formulario');
  const editIncomplete = api.buildClientSchema('edit', incomplete);
  eq(issues(editIncomplete, { ...incomplete, isActive: false }), [], 'Inactivar una ficha incompleta no exige datos');
  eq(api.buildClientUpdate({ ...incomplete, isActive: false }, incomplete, { canEditFiscal: true }), { isActive: false }, 'Solo se envía el estado');
  eq(issues(editIncomplete, { ...incomplete, supervisor: '  Laura  ' }), [], 'Cambio operativo sin completar fiscales');
  eq(api.buildClientUpdate({ ...incomplete, supervisor: '  Laura  ' }, incomplete, { canEditFiscal: true }), { supervisor: 'Laura' }, 'Recorta espacios al guardar');
  eq(issues(editIncomplete, { ...incomplete, email: 'mal' }), ['email: Escribe un email válido, por ejemplo nombre@empresa.com'], 'Formato de email si se informa');
  eq(issues(editIncomplete, { ...incomplete, email: 'ok@empresa.com' }), [], 'Email válido aceptado');
  const enabling = issues(editIncomplete, { ...incomplete, factura: true });
  ok(['cifNif', 'email', 'direccionFacturacion', 'codigoPostal', 'ciudad'].every(f => enabling.some(i => i.startsWith(f + ':'))), 'Activar factura exige los datos fiscales actuales');

  // Alta: se conservan los requisitos actuales, con mensajes en español.
  const createIssues = issues(api.buildClientSchema('create'), api.clientToFormValues(null));
  ok(createIssues.length >= 8, 'El alta exige todos los datos');
  ok(createIssues.every(i => !/Expected|Required|Invalid/.test(i)), 'Mensajes del alta en español: ' + createIssues.join(' | '));
  const complete = { ...api.clientToFormValues(null), nombre: 'Hostal Mar', cifNif: 'B15000001', telefono: '600000000', email: 'a@b.es', direccionFacturacion: 'Rúa 1', codigoPostal: '15001', ciudad: 'A Coruña', supervisor: 'Laura' };
  eq(issues(api.buildClientSchema('create'), complete), [], 'Alta completa válida');
  eq(api.formValuesToCreateData({ ...complete, nombre: ' Hostal Mar ' }).nombre, 'Hostal Mar', 'El alta recorta espacios');

  // Edición de ficha completa: vaciar un dato existente sigue sin estar permitido.
  const full = api.clientToFormValues({ ...complete, factura: true, tipoServicio: 'limpieza-turistica', metodoPago: 'bizum', isActive: true });
  eq(issues(api.buildClientSchema('edit', full), { ...full, telefono: '' }), ['telefono: El teléfono es obligatorio'], 'No se vacía un dato que existía');
  // Ficha que ya factura con datos incompletos: avisa pero deja guardar otros cambios.
  const billingIncomplete = { ...incomplete, factura: true };
  eq(issues(api.buildClientSchema('edit', billingIncomplete), { ...billingIncomplete, telefono: '611' }), [], 'Factura ya activa: no bloquea cambios no fiscales');
  eq(api.missingBillingData(billingIncomplete), ['CIF/NIF', 'email', 'dirección de facturación', 'código postal', 'ciudad'], 'Aviso de datos de facturación');
  eq(api.missingBillingData({ ...billingIncomplete, factura: false }), [], 'Sin factura no hay aviso');

  // Supervisión: los fiscales no se envían aunque se modifiquen en el formulario.
  eq(api.buildClientUpdate({ ...full, nombre: 'Otro', cifNif: 'X', metodoPago: 'efectivo', factura: false, telefono: '699', ciudad: 'Oleiros', email: 'n@b.es', isActive: false }, full, { canEditFiscal: false }), { telefono: '699', ciudad: 'Oleiros', email: 'n@b.es', isActive: false }, 'Supervisión solo envía datos operativos');

  // Permisos de pantalla: admin y gerencia sin regresión; borrar solo admin; supervisión con el contrato acordado.
  const caps = (role, override) => {
    const p = override || api.ROLE_PERMISSIONS[role].clients;
    return api.getClientCapabilities({ canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, isAdmin: api.ROLE_PERMISSIONS[role]?.admin.canView ?? false, isAdminOrManager: role === 'admin' || role === 'manager' });
  };
  eq(caps('admin'), { canCreate: true, canEdit: true, canEditFiscal: true, canDelete: true, canManagePortal: true }, 'Admin');
  eq(caps('manager'), { canCreate: true, canEdit: true, canEditFiscal: true, canDelete: false, canManagePortal: true }, 'Gerencia: todo salvo borrar');
  eq(caps('supervisor', { canView: true, canCreate: false, canEdit: true, canDelete: false }), { canCreate: false, canEdit: true, canEditFiscal: false, canDelete: false, canManagePortal: false }, 'Supervisión: edición operativa, sin fiscales ni portal');
  eq(caps('supervisor', { canView: true, canCreate: true, canEdit: true, canDelete: true }).canDelete, false, 'Supervisión nunca borra ni crea aunque la matriz se amplíe');
  eq(caps('cleaner'), { canCreate: false, canEdit: false, canEditFiscal: false, canDelete: false, canManagePortal: false }, 'Limpieza sin acciones');

  // CLI-07: duplicados (aviso) y búsqueda normalizada.
  const clients = [
    { id: 'c1', nombre: 'Hostal Mar', cifNif: 'B15000001', supervisor: 'Laura', isActive: true },
    { id: 'c2', nombre: 'Hostal  Mar', cifNif: 'b-15000001', supervisor: 'laura ', isActive: true },
    { id: 'c3', nombre: 'Árbol Rentals', cifNif: '', supervisor: '', isActive: false },
    { id: 'c4', nombre: 'apartamentos alfa', cifNif: 'B1', supervisor: 'Pedro', isActive: true },
  ];
  eq(api.findPossibleDuplicates({ nombre: 'hostal mar', cifNif: '' }, clients).map(d => d.client.id), ['c1', 'c2'], 'Nombre con espacios y mayúsculas');
  eq(api.findPossibleDuplicates({ nombre: 'Otro', cifNif: 'B-15.000.001' }, clients).map(d => [d.client.id, d.reasons]), [['c1', ['cif']], ['c2', ['cif']]], 'CIF con separadores');
  eq(api.findPossibleDuplicates({ nombre: 'Hostal Mar', cifNif: 'B15000001' }, clients, 'c1').map(d => d.client.id), ['c2'], 'Excluye la propia ficha');
  eq(api.findPossibleDuplicates({ nombre: 'Nuevo', cifNif: 'B1' }, clients), [], 'CIF muy corto no genera falsos avisos');
  eq(clients.filter(c => api.clientMatchesSearch(c, 'B15000001')).map(c => c.id), ['c1', 'c2'], 'Búsqueda por CIF sin separadores');
  eq(clients.filter(c => api.clientMatchesSearch(c, 'hostal mar')).map(c => c.id), ['c1', 'c2'], 'Búsqueda con espacios dobles');
  eq(clients.filter(c => api.clientMatchesSearch(c, 'arbol')).map(c => c.id), ['c3'], 'Sin acentos');
  eq(clients.filter(c => api.clientMatchesSearch(c, 'ALF-1A', c.id === 'c4' ? ['Alfa 1A', 'ALF-1A'] : [])).map(c => c.id), ['c4'], 'Por código de propiedad');
  // CLI-10 / CLI-13
  eq(api.supervisorSuggestions(clients), ['Laura', 'Pedro'], 'Sugerencias sin variantes ni vacíos');
  eq(api.sortClientsByName(clients).map(c => c.id).slice(0, 2), ['c4', 'c3'], 'Orden alfabético español (minúsculas y acentos)');

  // CLI-08 / CLI-09: propiedades y herencia de estado.
  const props = [
    { id: 'p2', nombre: 'Alfa 2B', clienteId: 'c4', isActive: null },
    { id: 'p1', nombre: 'Alfa 1A', clienteId: 'c4', isActive: true },
    { id: 'p3', nombre: 'Otra', clienteId: 'c1', isActive: false },
  ];
  const summary = api.summarizeClientProperties(props, 'c4');
  eq([summary.total, summary.inheriting.map(p => p.id), summary.ownState, summary.properties.map(p => p.id)], [2, ['p2'], 1, ['p1', 'p2']], 'Resumen de propiedades');

  // CLI-01: evaluación del borrado.
  eq(api.evaluateClientDeletion({ properties: 2, tasks: 0 }).status, 'blocked', 'Bloquea con propiedades');
  const allZero = Object.fromEntries(Object.keys(api.CLIENT_DEPENDENCY_LABELS).map(k => [k, 0]));
  eq(api.evaluateClientDeletion(allZero), { status: 'allowed' }, 'Sin dependencias');
  eq(api.evaluateClientDeletion({ ...allZero, tasks: 1 }).items, [{ key: 'tasks', label: 'tareas (incluido el histórico)', count: 1 }], 'Histórico de tareas también bloquea');
  eq(api.evaluateClientDeletion({ ...allZero, budgets: null }).status, 'unknown', 'Comprobación fallida no permite borrar');
  eq(api.evaluateClientDeletion({}).status, 'unknown', 'Sin datos no permite borrar');
  ok(api.deletionConfirmationMatches('  hostal mar ', 'Hostal Mar') && !api.deletionConfirmationMatches('Hostal', 'Hostal Mar') && !api.deletionConfirmationMatches('', ''), 'Confirmación por nombre');

  // Recuento real de dependencias contra el doble: todas las tablas y sin leer filas.
  fake.calls.length = 0;
  fake.counts = { properties: 2, tasks: 5, lh_room_mapping: 1, avirato_room_mapping: 1 };
  const counts = await api.clientStorage.getDeletionDependencies('c-alfa');
  eq([counts.properties, counts.tasks, counts.pmsMappings, counts.portalAccess, counts.budgets], [2, 5, 2, 0, 0], 'Recuentos agregados');
  ok(fake.calls.every(c => c.op === 'select' && c.head && c.countMode === 'exact' && c.filters.length === 1 && c.filters[0][1] === 'c-alfa'), 'Solo recuentos head, filtrados por cliente, sin sede');
  eq(fake.calls.map(c => c.table).sort(), ['avantio_reservations', 'avirato_room_mapping', 'budget_rate_profiles', 'cleaning_incidents', 'client_extraordinary_requests', 'client_portal_access', 'client_portal_access_logs', 'client_reservation_logs', 'client_reservations', 'hostaway_reservations', 'lh_room_mapping', 'properties', 'recurring_tasks', 'tasks', 'tourist_budgets'], 'Todas las tablas relacionadas');

  // Borrado protegido: con dependencias no se emite DELETE.
  fake.calls.length = 0;
  await assert.rejects(api.clientStorage.assertDeletable('c-alfa'), e => e.name === 'ClientDeletionBlockedError' && e.check.status === 'blocked'); checks++;
  eq(fake.calls.filter(c => c.op !== 'select'), [], 'La comprobación no escribe');
  fake.counts = {}; fake.failing = new Set(['tourist_budgets']); fake.calls.length = 0;
  await assert.rejects(api.clientStorage.assertDeletable('c-x'), e => e.name === 'ClientDeletionBlockedError' && e.check.status === 'unknown'); checks++;
  fake.failing = new Set(); fake.calls.length = 0; fake.deleteRows = 1;
  await api.clientStorage.assertDeletable('c-x'); checks++;
  // Los borrados de esta prueba solo llegan al doble en memoria.
  const remove = (storage, id) => storage['delete'].call(storage, id);
  eq(await remove(api.clientStorage, 'c-x'), true, 'Sin dependencias borra');
  const del = fake.calls.find(c => c.op === 'delete');
  eq([del.table, del.filters, del.returning], ['clients', [['id', 'c-x'], ['sede_id', 'sede-a']], 'id'], 'DELETE por id y sede pidiendo las filas borradas');

  // CLI-02: 0 filas borradas no es un éxito (RLS u otra sede), en todos los consumidores de BaseStorage.
  fake.deleteRows = 0;
  for (const [name, storage] of [['clients', api.clientStorage], ['properties', api.propertyStorage], ['vacation', api.vacationRequestsStorage]]) {
    await assert.rejects(remove(storage, 'x'), e => e instanceof api.DeleteNotAppliedError && /No se ha eliminado ningún registro/.test(e.message), name); checks++;
  }
  fake.deleteRows = 1;
  for (const storage of [api.propertyStorage, api.vacationRequestsStorage]) eq(await remove(storage, 'x'), true, 'Con una fila borrada sigue siendo éxito');
  fake.deleteError = { message: 'violates foreign key', code: '23503' };
  await assert.rejects(remove(api.clientStorage, 'x'), e => e.code === '23503'); checks++;
  fake.deleteError = null;

  console.log(`PASS clientsRulesTest: ${checks} checks (validación edición/alta, permisos, duplicados, búsqueda, propiedades, borrado protegido y filas afectadas en BaseStorage)`);
} finally {
  rmSync(folder, { recursive: true, force: true });
}
