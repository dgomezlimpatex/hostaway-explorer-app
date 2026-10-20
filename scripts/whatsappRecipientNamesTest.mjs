// Nombres de los envíos por comprobar: lectura en lote real (whatsappRecipientNames.ts)
// contra un cliente simulado en memoria que imita el filtrado por políticas.
// Sin red ni Supabase real; nombres y IDs inventados.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const fake = String.raw`
const calls = [];
const state = { events: [], cleaners: [], fail: null, visibleEvents: null };
export const __fake = { calls, state };
export function fromUntypedTable(table) {
  return {
    select(columns) {
      return {
        in(column, ids) {
          calls.push({ table, columns, column, ids: [...ids] });
          if (state.fail === table) return Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table ' + table } });
          const source = table === 'notification_events' ? state.events.filter((row) => !state.visibleEvents || state.visibleEvents.includes(row.id)) : table === 'cleaners' ? state.cleaners : null;
          if (!source) return Promise.resolve({ data: null, error: { message: 'tabla no prevista ' + table } });
          const wanted = columns.split(',');
          const data = source.filter((row) => ids.includes(row[column])).map((row) => Object.fromEntries(wanted.map((key) => [key, row[key] ?? null])));
          return Promise.resolve({ data, error: null });
        },
      };
    },
  };
}
export function rpcUntyped() { throw new Error('rpc no previsto'); }
`;

const result = await build({
  stdin: { contents: `export * from './src/features/whatsapp-monitor/whatsappRecipientNames.ts'; export { __fake } from '@/lib/supabaseUntyped';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'fake', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabaseUntyped$/ }, () => ({ path: 'fake', namespace: 'fake' }));
    b.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: a.path === 'query' ? 'export const useQuery = () => { throw new Error("hook no usado en esta prueba"); };' : fake, loader: 'js' }));
    b.onResolve({ filter: /^@\// }, (a) => ({ path: `${process.cwd()}/src/${a.path.slice(2)}.ts` }));
  } }],
});
assert.ok(!Object.keys(result.metafile.inputs).some((p) => /integrations[\\/]supabase/.test(p)), 'sin cliente real de Supabase');
const mod = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const { fetchRecipientNames, RECIPIENT_EVENT_COLUMNS, CLEANER_NAME_COLUMNS, __fake } = mod;

let passed = 0;
const test = async (name, fn) => {
  __fake.calls.length = 0; __fake.state.fail = null; __fake.state.visibleEvents = null;
  try { await fn(); passed += 1; } catch (error) { console.error(`✗ ${name}`); throw error; }
};

const SENSITIVE = /phone|telefono|pin|dni|snapshot(?!_)|payload|email/i;

__fake.state.events = [
  { id: 'e1', cleaner_id: 'c1', recipient_worker_id: null, recipient_name_snapshot: 'Ana Pérez', recipient_phone_snapshot: '+34600111222', snapshot: { recipient: { telefono: '600111222' } } },
  { id: 'e2', cleaner_id: 'c2', recipient_worker_id: null, recipient_name_snapshot: null, recipient_phone_snapshot: '+34600333222' },
  { id: 'e3', cleaner_id: 'c-borrada', recipient_worker_id: null, recipient_name_snapshot: null },
  { id: 'e4', cleaner_id: 'c1', recipient_worker_id: 'c2', recipient_name_snapshot: null },
  { id: 'e5', cleaner_id: 'c3', recipient_worker_id: null, recipient_name_snapshot: null },
  ...Array.from({ length: 60 }, (_, i) => ({ id: `b${i}`, cleaner_id: `c${i % 3 + 1}`, recipient_worker_id: null, recipient_name_snapshot: null })),
];
__fake.state.cleaners = [
  { id: 'c1', name: 'Ana Ruiz', telefono: '600111222', pin: '1234', dni: '00000000T' },
  { id: 'c2', name: 'Rosa Díaz', telefono: '600333222' },
  { id: 'c3', name: 'Marta Sanz (inactiva)', active: false },
];

await test('Columnas mínimas explícitas, nunca teléfonos, PIN, DNI ni snapshot JSON', async () => {
  assert.equal(RECIPIENT_EVENT_COLUMNS, 'id,cleaner_id,recipient_worker_id,recipient_name_snapshot');
  assert.equal(CLEANER_NAME_COLUMNS, 'id,name');
  await fetchRecipientNames(['e1', 'e2']);
  for (const call of __fake.calls) {
    for (const column of call.columns.split(',')) assert.ok(!SENSITIVE.test(column) || column === 'recipient_name_snapshot', `columna no permitida ${column}`);
    assert.equal(call.column, 'id');
  }
});

await test('Casos: snapshot, ficha por ID, misma terminación, borrada, ambigua e inactiva', async () => {
  const r = await fetchRecipientNames(['e1', 'e2', 'e3', 'e4', 'e5', 'e1']);
  assert.deepEqual(r.get('e1'), { state: 'known', name: 'Ana Pérez', source: 'snapshot' });
  assert.deepEqual(r.get('e2'), { state: 'known', name: 'Rosa Díaz', source: 'record' });
  assert.equal(r.get('e3').state, 'missing');
  assert.equal(r.get('e4').state, 'ambiguous');
  assert.deepEqual(r.get('e5'), { state: 'known', name: 'Marta Sanz (inactiva)', source: 'record' });
  // Dos lecturas en total: eventos (sin repetir) y solo las fichas que faltan.
  assert.equal(__fake.calls.length, 2);
  assert.deepEqual(__fake.calls[0].ids.sort(), ['e1', 'e2', 'e3', 'e4', 'e5']);
  assert.deepEqual(__fake.calls[1].ids.sort(), ['c-borrada', 'c2', 'c3']);
});

await test('Sin N+1: 65 eventos se leen en lotes de 100, no uno por aviso', async () => {
  const ids = __fake.state.events.map((row) => row.id);
  const r = await fetchRecipientNames(ids);
  assert.equal(r.size, ids.length);
  assert.equal(__fake.calls.filter((c) => c.table === 'notification_events').length, 1);
  assert.equal(__fake.calls.filter((c) => c.table === 'cleaners').length, 1);
  const many = Array.from({ length: 230 }, (_, i) => `z${i}`);
  __fake.calls.length = 0;
  await fetchRecipientNames(many);
  assert.deepEqual(__fake.calls.map((c) => c.ids.length), [100, 100, 30]);
});

await test('Sede ajena o sin acceso: el evento no devuelto no recibe nombre', async () => {
  __fake.state.visibleEvents = ['e1'];
  const r = await fetchRecipientNames(['e1', 'e2']);
  assert.equal(r.get('e1').name, 'Ana Pérez');
  assert.equal(r.has('e2'), false);
});

await test('Fallos de lectura se propagan (sin éxito falso) y no se consultan fichas', async () => {
  __fake.state.fail = 'notification_events';
  await assert.rejects(() => fetchRecipientNames(['e2']), (error) => /permission denied/.test(error.message));
  assert.equal(__fake.calls.length, 1);
  __fake.state.fail = 'cleaners';
  await assert.rejects(() => fetchRecipientNames(['e2']), (error) => /permission denied/.test(error.message));
});

await test('Sin eventos no se hace ninguna lectura', async () => {
  const r = await fetchRecipientNames([]);
  assert.equal(r.size, 0);
  assert.equal(__fake.calls.length, 0);
});

console.log(`whatsappRecipientNamesTest: ${passed} grupos correctos`);
