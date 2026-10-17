import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Prueba local de navegador (la cola no tiene Chromium: no se lista en la revisión).
// Renderiza la página REAL con un cliente de datos falso que solo admite lecturas y lo registra todo.

const supabaseFake = `
  const ALLOWED = new Set(['select', 'order', 'limit', 'gte', 'eq']);
  window.__calls = [];
  window.__violations = [];
  export const supabase = {
    from(table) {
      const entry = { table, ops: [] };
      window.__calls.push(entry);
      const chain = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            const fixture = window.__db[table];
            const eq = entry.ops.filter((o) => o.op === 'eq');
            return (resolve) => resolve(typeof fixture === 'function' ? fixture(eq) : fixture);
          }
          if (!ALLOWED.has(prop)) { window.__violations.push(table + '.' + String(prop)); throw new Error('Operación no permitida: ' + String(prop)); }
          return (...args) => { entry.ops.push({ op: prop, args }); return chain; };
        },
      });
      return chain;
    },
  };
`;
const sedeFake = `
  import { useSyncExternalStore } from 'react';
  let listeners = [];
  window.__sede = { id: 'sede-a', nombre: 'A Coruña' };
  window.__setSede = (sede) => { window.__sede = sede; listeners.forEach((l) => l()); };
  const subscribe = (l) => { listeners = [...listeners, l]; return () => { listeners = listeners.filter((x) => x !== l); }; };
  export const useSede = () => ({ activeSede: useSyncExternalStore(subscribe, () => window.__sede), loading: false });
`;
const mocks = {
  '@/integrations/supabase/client': supabaseFake,
  '@/contexts/SedeContext': sedeFake,
};

const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import Page from './src/pages/PmsHealth';
  const Dest = ({ name }) => <div data-testid="destino">DESTINO {name}</div>;
  createRoot(document.getElementById('root')).render(
    <MemoryRouter initialEntries={['/sincronizaciones']}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/sincronizaciones" element={<Page />} />
          <Route path="/smoobu" element={<Dest name="smoobu" />} />
          <Route path="/little-hotelier" element={<Dest name="little-hotelier" />} />
          <Route path="/" element={<Dest name="inicio" />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
`;
const built = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'pms-fixtures',
    setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, (args) => (Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : null));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
    },
  }],
});
assert.ok(!Object.keys(built.metafile.inputs).some((path) => path.startsWith('src/integrations/supabase')), 'el cliente real no entra en la prueba');
const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;

// 17/10/2026 15:20 Madrid (UTC+2).
const NOW = new Date('2026-10-17T13:20:00Z');
const ok = (data) => ({ data, error: null });
const bad = { data: null, error: { message: 'permission denied for table lh_sync_logs, user ana@example.com' } };
const run = (over = {}) => ({ id: 'r' + (over.cuando ?? 'x'), cuando: '2026-10-17T13:02:00Z', disparo: 'programada', modo: 'real', reservas: 11, altas: 0, actualizaciones: 0, sin_cambios: 11, canceladas: 0, errores: 0, sin_mapear: 0, detalle: [], ...over });
const lhLogs = (start, count, over = {}) => Array.from({ length: count }, (_, i) => ({ id: start + i, success: true, status_code: 200, error_message: null, created_at: new Date(new Date(start).getTime() + i * 2000).toISOString(), result: {}, ...over }));
const sedeRes = (map) => (eq) => ok(map[eq.find((o) => o.args[0] === 'sede_id')?.args[1]] ?? []);

const SCENARIOS = {
  sano: {
    smoobu_sync_runs: ok([run({ altas: 1 })]),
    smoobu_sync_requests: ok([]),
    smoobu_reservations: ok([{ property_name: 'Houmi 3', status: 'confirmed' }]),
    smoobu_property_mappings: ok([{ smoobu_property_name: 'Houmi 3', is_active: true }]),
    lh_sync_logs: ok(lhLogs('2026-10-17T12:30:00Z', 28)),
    lh_reservations: sedeRes({ 'sede-a': [{ id: '1', room: 'Hab 9', rooms: ['Hab 9'], status: 'confirmed', needs_room_assignment: false }], 'sede-b': [] }),
    lh_room_mapping: ok([]),
  },
  fallo: {
    smoobu_sync_runs: ok([run({ cuando: '2026-10-17T13:03:00Z', reservas: 11, errores: 11, detalle: [{ ok: false, respuesta: 'Sesión caducada para ana@example.com https://secreto.example/x?token=abc' }] }), run({ cuando: '2026-10-17T06:02:00Z' })]),
    smoobu_sync_requests: ok([]),
    smoobu_reservations: ok([]),
    smoobu_property_mappings: ok([]),
    lh_sync_logs: ok(lhLogs('2026-10-17T12:00:00Z', 4, { success: false, status_code: 502, error_message: 'Fallo con maria@example.com' })),
    lh_reservations: ok([]),
    lh_room_mapping: ok([]),
  },
  lectura: Object.fromEntries(['smoobu_sync_runs', 'smoobu_sync_requests', 'smoobu_reservations', 'smoobu_property_mappings', 'lh_sync_logs', 'lh_reservations', 'lh_room_mapping'].map((t) => [t, bad])),
  vacio: {
    smoobu_sync_runs: ok([]), smoobu_sync_requests: ok([]), smoobu_reservations: ok([]), smoobu_property_mappings: ok([]),
    lh_sync_logs: ok([]), lh_reservations: ok([]), lh_room_mapping: ok([]),
  },
  atascada: {
    smoobu_sync_runs: ok([run()]),
    smoobu_sync_requests: ok([{ id: 'q', pedida_at: '2026-10-17T12:20:00Z', estado: 'en_curso', completada_at: null }]),
    smoobu_reservations: ok([]), smoobu_property_mappings: ok([]),
    lh_sync_logs: ok(lhLogs('2026-10-17T13:18:00Z', 10)),
    lh_reservations: ok([]), lh_room_mapping: ok([]),
  },
  antigua: {
    smoobu_sync_runs: ok([run({ cuando: '2026-10-15T17:05:00Z' })]),
    smoobu_sync_requests: ok([]), smoobu_reservations: ok([]), smoobu_property_mappings: ok([]),
    lh_sync_logs: ok(lhLogs('2026-09-01T09:00:00Z', 28)),
    lh_reservations: ok([]), lh_room_mapping: ok([]),
  },
};

const executablePath = process.platform === 'linux' && existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
const browser = await chromium.launch({ headless: true, executablePath });
const URL_ = 'https://pms.local.test/';

async function open(viewport, scenario) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  const blocked = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: NOW });
  await page.route('**/*', (route) => {
    if (route.request().url() === URL_) return route.fulfill({ contentType: 'text/html', body: html });
    blocked.push(route.request().url());
    return route.abort();
  });
  // Los fixtures con funciones (por sede) se reconstruyen dentro de la página.
  const serialised = Object.fromEntries(Object.entries(SCENARIOS[scenario]).map(([k, v]) => [k, typeof v === 'function' ? { __bySede: Object.fromEntries(['sede-a', 'sede-b'].map((s) => [s, v([{ op: 'eq', args: ['sede_id', s] }]).data])) } : v]));
  await page.addInitScript((data) => {
    window.__db = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v && v.__bySede
      ? (eq) => ({ data: v.__bySede[eq.find((o) => o.args[0] === 'sede_id')?.args[1]] ?? [], error: null })
      : v]));
  }, serialised);
  await page.goto(URL_);
  await expect(page.getByRole('heading', { name: 'Estado de los PMS' })).toBeVisible();
  return { page, context, errors, blocked };
}

const status = (page, id) => page.getByTestId(`pms-status-${id}`);
const shots = [];
try {
  for (const [name, viewport] of [['escritorio', { width: 1280, height: 900 }], ['movil', { width: 390, height: 844 }]]) {
    // ---- Sano: éxito reciente con cambios, y Little Hotelier sin frecuencia de referencia ----
    {
      const { page, context, errors, blocked } = await open(viewport, 'sano');
      await expect(status(page, 'smoobu')).toHaveText('Al día');
      await expect(page.getByTestId('pms-headline-smoobu')).toContainText('1 nuevas');
      await expect(status(page, 'little_hotelier')).toHaveText('Con advertencias');
      await expect(page.getByTestId('pms-card-little_hotelier')).toContainText('Sin frecuencia registrada');
      await expect(page.getByTestId('pms-card-little_hotelier')).toContainText('Habitación «Hab 9» sin propiedad');
      assert.equal(await page.getByTestId('pms-card-little_hotelier').getAttribute('data-status'), 'warnings');

      // Actualizar vuelve a leer, nada más.
      const before = await page.evaluate(() => window.__calls.length);
      await page.getByTestId('pms-refresh').click();
      await expect.poll(() => page.evaluate(() => window.__calls.length)).toBeGreaterThan(before);
      assert.deepEqual(await page.evaluate(() => window.__violations), [], 'ninguna operación que no sea lectura');
      const tables = await page.evaluate(() => [...new Set(window.__calls.map((c) => c.table))].sort());
      assert.deepEqual(tables, ['lh_reservations', 'lh_room_mapping', 'lh_sync_logs', 'smoobu_property_mappings', 'smoobu_reservations', 'smoobu_sync_requests', 'smoobu_sync_runs']);
      assert.ok(await page.evaluate(() => window.__calls.every((c) => c.ops.every((o) => ['select', 'order', 'limit', 'gte', 'eq'].includes(o.op)))));

      // Cambio de sede: Little Hotelier se relee acotado a la nueva sede; Smoobu no.
      const smoobuReads = await page.evaluate(() => window.__calls.filter((c) => c.table === 'smoobu_sync_runs').length);
      await page.evaluate(() => window.__setSede({ id: 'sede-b', nombre: 'Vigo' }));
      await expect(page.getByTestId('pms-card-little_hotelier')).not.toContainText('Hab 9');
      await expect(page.getByText('(Vigo)')).toBeVisible();
      assert.equal(await page.evaluate(() => window.__calls.filter((c) => c.table === 'smoobu_sync_runs').length), smoobuReads, 'Smoobu no depende de la sede');
      const sedeIds = await page.evaluate(() => window.__calls.filter((c) => c.table === 'lh_reservations').map((c) => c.ops.find((o) => o.op === 'eq').args[1]));
      assert.ok(sedeIds.includes('sede-a') && sedeIds.includes('sede-b'));
      await page.evaluate(() => window.__setSede({ id: 'sede-a', nombre: 'A Coruña' }));
      await expect(page.getByTestId('pms-card-little_hotelier')).toContainText('Hab 9');

      // Navegar a los destinos existentes no escribe nada.
      await page.getByTestId('pms-card-smoobu').getByRole('link', { name: /Abrir historial/ }).click();
      await expect(page.getByTestId('destino')).toHaveText('DESTINO smoobu');
      assert.deepEqual(await page.evaluate(() => window.__violations), []);
      assert.deepEqual(blocked, [], 'ninguna petición de red fuera de la propia página');
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordamiento horizontal (${name})`);
      await context.close();
    }
    // ---- Fallo posterior a un éxito y detalle de error seguro ----
    {
      const { page, context, errors } = await open(viewport, 'fallo');
      await expect(status(page, 'smoobu')).toHaveText('Error');
      await expect(status(page, 'little_hotelier')).toHaveText('Error');
      await expect(page.getByTestId('pms-card-smoobu')).toContainText('Última importación correcta');
      await page.getByTestId('pms-card-smoobu').getByRole('button', { name: 'Ver último error' }).click();
      const detail = page.getByTestId('pms-error-detail-smoobu');
      await expect(detail).toBeVisible();
      const text = await detail.innerText();
      assert.doesNotMatch(text, /@|https?:|example|token/);
      await page.screenshot({ path: join(tmpdir(), `pms-health-fallo-${name}.png`), fullPage: true });
      shots.push(join(tmpdir(), `pms-health-fallo-${name}.png`));
      await page.getByTestId('pms-card-little_hotelier').getByRole('button', { name: 'Ver último error' }).click();
      assert.doesNotMatch(await page.getByTestId('pms-error-detail-little_hotelier').innerText(), /@|example/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `sin desbordamiento horizontal (${name})`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    // ---- Error de lectura: nunca verde, sin filtrar el mensaje técnico ----
    {
      const { page, context } = await open(viewport, 'lectura');
      for (const id of ['smoobu', 'little_hotelier']) {
        await expect(status(page, id)).toHaveText('Sin información suficiente');
        await expect(page.getByTestId(`pms-headline-${id}`)).toContainText('No se pudo consultar el diagnóstico');
      }
      assert.doesNotMatch(await page.locator('body').innerText(), /permission denied|ana@example/);
      await context.close();
    }
    // ---- Historial vacío ----
    {
      const { page, context } = await open(viewport, 'vacio');
      await expect(status(page, 'smoobu')).toHaveText('Sin información suficiente');
      await expect(page.getByTestId('pms-headline-smoobu')).toContainText('No hay ninguna ejecución registrada');
      await context.close();
    }
    // ---- Atascada y en ejecución ----
    {
      const { page, context } = await open(viewport, 'atascada');
      await expect(status(page, 'smoobu')).toHaveText('Error');
      await expect(page.getByTestId('pms-headline-smoobu')).toContainText('atascada');
      await expect(status(page, 'little_hotelier')).toHaveText('En ejecución');
      await page.screenshot({ path: join(tmpdir(), `pms-health-atascada-${name}.png`), fullPage: true });
      shots.push(join(tmpdir(), `pms-health-atascada-${name}.png`));
      await context.close();
    }
    // ---- Información antigua ----
    {
      const { page, context } = await open(viewport, 'antigua');
      await expect(status(page, 'smoobu')).toHaveText('Datos desactualizados');
      await expect(page.getByTestId('pms-headline-smoobu')).toContainText('No se ha ejecutado la pasada de las 08:00');
      await expect(status(page, 'little_hotelier')).toHaveText('Sin información suficiente');
      await expect(page.getByTestId('pms-card-little_hotelier')).toContainText('hace 46 días');
      await page.screenshot({ path: join(tmpdir(), `pms-health-antigua-${name}.png`), fullPage: true });
      shots.push(join(tmpdir(), `pms-health-antigua-${name}.png`));
      await context.close();
    }
  }
  console.log('pmsHealthBrowserTest: OK');
  console.log(shots.join('\n'));
} finally {
  await browser.close();
}
