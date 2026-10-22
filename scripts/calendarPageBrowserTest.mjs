import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Real /calendar page (CleaningCalendar and its hooks) in Chromium with
// local fixtures. The Supabase client is a fake that only records calls and
// answers with fictitious rows, honouring the selected columns like the real
// API; auth, sede and the task list are local stubs. Every browser request is
// aborted. Nothing reaches a database, an inbox or production.
// Local only (needs Chromium): CAL_EVIDENCE_DIR=<dir> node scripts/calendarPageBrowserTest.mjs
const repo = process.cwd();
const outDir = process.env.CAL_EVIDENCE_DIR || path.join(repo, 'node_modules', '.cache', 'calendar-page-browser');
mkdirSync(outDir, { recursive: true });
const abs = (file) => path.join(repo, file).replace(/\\/g, '/');

const overrides = {
  // Fake Supabase client: records every call, answers from window.__db.
  'src/integrations/supabase/client': `
    const W = window;
    const pick = (row, columns) => {
      if (!columns || columns.trim() === '*') return { ...row };
      const out = {};
      columns.split(',').map(c => c.trim()).filter(Boolean).forEach(c => { if (c in row) out[c] = row[c]; });
      return out;
    };
    const builder = (table) => {
      const op = { table, select: '*', filters: [], kind: 'read' };
      const b = new Proxy(function () {}, {
        get(_, prop) {
          if (prop === 'then') return async (resolve, reject) => {
            W.__db.calls.push(op);
            if (W.__slow && ['worker_fixed_days_off', 'worker_absences', 'worker_maintenance_cleanings', 'tasks'].includes(table)) await new Promise(r => setTimeout(r, 1000));
            if (table === 'tasks' && op.kind === 'update' && W.__slow) {
              const expected = Object.fromEntries(op.filters.filter(f => f[0] === 'eq').map(f => [f[1], f[2]]));
              const t = W.__tasks.find(t => t.id === expected.id && t.startTime === expected.start_time && t.endTime === expected.end_time && t.status === expected.status);
              if (t) Object.assign(t, { startTime: op.payload.start_time, endTime: op.payload.end_time });
              return resolve({ data: t ? [{ id: t.id }] : [], error: null });
            }
            if (op.kind !== 'read') return Promise.resolve({ data: [{ id: 'x' }], error: null }).then(resolve, reject);
            const match = (row) => op.filters.every(([name, column, value]) => {
              if (name === 'eq') return row[column] === value;
              if (name === 'in') return value.includes(row[column]);
              if (name === 'lte') return row[column] <= value;
              if (name === 'gte') return row[column] >= value;
              if (name === 'is') return (row[column] ?? null) === value;
              if (name === 'contains') return Array.isArray(row[column]) && value.every(v => row[column].includes(v));
              return true; // order, limit...
            });
            const rows = (W.__db.tables[table] || []).filter(match).map(row => pick(row, op.select));
            return Promise.resolve({ data: op.single ? (rows[0] || null) : rows, error: null, count: rows.length }).then(resolve, reject);
          };
          return (...args) => {
            if (prop === 'select' && op.kind === 'read') op.select = args[0] || '*';
            else if (['insert', 'update', 'upsert', 'delete'].includes(prop)) { op.kind = prop; op.payload = args[0]; }
            else if (prop === 'maybeSingle' || prop === 'single') op.single = true;
            else op.filters.push([prop, ...args]);
            return b;
          };
        },
      });
      return b;
    };
    const channel = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {} }; return c; };
    export const supabase = {
      from: builder,
      rpc: (name, args) => { W.__db.calls.push({ rpc: name, args }); return Promise.resolve({ data: null, error: null }); },
      channel, removeChannel: () => {},
      functions: { invoke: (name, payload) => { W.__db.calls.push({ fn: name, payload }); return Promise.resolve({ data: {}, error: null }); } },
      auth: {
        getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    };
  `,
  'src/contexts/SedeContext': `
    const sede = { id: 'sede-ficticia', nombre: 'Sede ficticia' };
    const value = { activeSede: sede, availableSedes: [sede], isInitialized: true, loading: false,
      setActiveSede() {}, refreshSedes: async () => {}, hasAccessToSede: () => true };
    export const useSede = () => value;
    export const SedeProvider = ({ children }) => children;
  `,
  'src/hooks/useAuth': `
    export * from '${abs('src/hooks/useAuth.ts')}?real';
    export const useAuth = () => {
      const role = window.__role;
      return { user: { id: 'u-ficticio' }, session: null, profile: null, userRole: role, userRoles: [role],
        operationalMode: 'supervision', canSwitchOperationalMode: false, setOperationalMode() {}, isLoading: false,
        signOut: async () => {} };
    };
  `,
  // Role matrix: the agreed supervisor contract (calendar canEdit only) can be
  // injected, as the coordinator allowed, without editing rolePermissions.ts.
  'src/lib/rolePermissions': `
    import * as real from '${abs('src/lib/rolePermissions.ts')}?real';
    export * from '${abs('src/lib/rolePermissions.ts')}?real';
    export const getRolePermissions = (role) => {
      const base = real.getRolePermissions(role);
      return role === 'supervisor' && window.__agreedSupervisorMatrix
        ? { ...base, calendar: { canView: true, canCreate: false, canEdit: true, canDelete: false } }
        : base;
    };
  `,
  'src/services/taskStorage': `
    export * from '${abs('src/services/taskStorage.ts')}?real';
    import { taskStorageService as real } from '${abs('src/services/taskStorage.ts')}?real';
    export const taskStorageService = { ...real,
      getTasks: async () => {
        window.__db.calls.push({ getTasks: true });
        if (window.__slow) await new Promise(r => setTimeout(r, 1000));
        if (window.__tasksFail) throw new Error('fallo de red simulado');
        return structuredClone(window.__tasks);
      },
      createTask: async (task) => { window.__db.calls.push({ createTask: task }); return { ...task, id: 'nueva' }; },
    };
  `,
  'src/services/storage/taskAssignmentService': `
    const assign = async (taskId, cleanerName, cleanerId, startTime, endTime) => {
      window.__db.calls.push({ fixtureAssignment: taskId });
      await new Promise(r => setTimeout(r, window.__slow ? 1000 : 0));
      window.__tasks = window.__tasks.map(t => t.id === taskId ? { ...t, cleanerId, cleaner: cleanerName,
        assignments: [{ task_id: taskId, cleaner_id: cleanerId, cleaner_name: cleanerName }],
        ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) } : t);
    };
    export const taskAssignmentService = { assignTaskWithSchedule: assign };
  `,
  'src/hooks/useCalendarWorkload': `
    export * from '${abs('src/hooks/useCalendarWorkload.ts')}?real';
    export const useCalendarWorkload = () => ({ workloadMap: {} });
  `,
  'src/hooks/useRecurringTaskInstances': `
    export * from '${abs('src/hooks/useRecurringTaskInstances.ts')}?real';
    export const useRecurringTaskInstances = () => ({ virtualTasks: [] });
  `,
};
const overrideKeys = Object.keys(overrides);
const resolveOverride = (importPath, resolveDir) => {
  let file = importPath.startsWith('@/') ? 'src/' + importPath.slice(2)
    : importPath.startsWith('.') ? path.relative(repo, path.join(resolveDir, importPath)).replace(/\\/g, '/') : null;
  if (!file) return null;
  file = file.replace(/\.(tsx?|jsx?)$/, '');
  return overrideKeys.includes(file) ? file : null;
};

const entry = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { BrowserRouter } from 'react-router-dom';
  import { TooltipProvider } from '@/components/ui/tooltip';
  import { Toaster } from '@/components/ui/toaster';
  import CleaningCalendar from '@/components/CleaningCalendar';
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  window.__queryClient = qc;
  createRoot(document.getElementById('root')).render(
    <QueryClientProvider client={qc}><BrowserRouter><TooltipProvider>
      <CleaningCalendar /><Toaster />
    </TooltipProvider></BrowserRouter></QueryClientProvider>
  );
`;
const built = await build({
  stdin: { resolveDir: repo, loader: 'tsx', contents: entry },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, logLevel: 'error',
  tsconfig: path.join(repo, 'tsconfig.app.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_SUPABASE_URL":"http://fake.invalid","VITE_SUPABASE_ANON_KEY":"fake"}' },
  plugins: [{ name: 'calendar-page-fixtures', setup(plugin) {
    plugin.onResolve({ filter: /\?real$/ }, (args) => ({ path: args.path.replace(/\?real$/, ''), namespace: 'file' }));
    plugin.onResolve({ filter: /.*/ }, (args) => {
      if (args.namespace === 'override') return null;
      const key = resolveOverride(args.path, args.resolveDir);
      return key ? { path: key, namespace: 'override' } : null;
    });
    plugin.onLoad({ filter: /.*/, namespace: 'override' }, (args) => ({ contents: overrides[args.path], loader: 'jsx', resolveDir: repo }));
  } }],
});
const bundled = Object.keys(built.metafile.inputs);
assert.equal(bundled.some((p) => p.includes('node_modules/@supabase/')), false, 'no real Supabase client bundled');
const indexCss = (await import('node:fs')).readFileSync(path.join(repo, 'src/index.css'), 'utf8');
const css = await postcss([tailwindcss({ config: path.join(repo, 'tailwind.config.ts'), content: [path.join(repo, 'src/**/*.tsx')] })])
  .process(indexCss, { from: path.join(repo, 'src/index.css') });
const script = built.outputFiles[0].text.replaceAll('</script', '<\\/script');

// ---- Fictitious fixtures (no real people, properties or clients) ----
const D = '2026-10-05'; // Monday
const cleaners = [
  { id: 'c1', name: 'Ana Prueba', is_active: true, sede_id: 'sede-ficticia' },
  { id: 'c2', name: 'Berta Prueba', is_active: true, sede_id: 'sede-ficticia' },
  { id: 'c3', name: 'Carmen Prueba', is_active: true, sede_id: 'sede-ficticia' },
  { id: 'c4', name: 'Dora Prueba', is_active: true, sede_id: 'sede-ficticia' },
];
const clients = [
  { id: 'k1', nombre: 'Cliente Uno', is_active: true, sede_id: 'sede-ficticia' },
  { id: 'k2', nombre: 'Cliente Dos', is_active: true, sede_id: 'sede-ficticia' },
];
const base = { date: D, address: 'Calle Ficticia 1', type: 'limpieza-turistica', checkIn: '', checkOut: '', status: 'pending' };
const asg = (taskId, ids) => ids.map((id) => ({ id: taskId + id, task_id: taskId, cleaner_id: id, cleaner_name: cleaners.find((c) => c.id === id).name }));
const one = (taskId, id, extra) => ({ ...base, id: taskId, cleanerId: id, cleaner: cleaners.find((c) => c.id === id).name, assignments: asg(taskId, [id]), ...extra });
const tasks = [
  one('t-early', 'c1', { property: 'Madrugada', startTime: '05:30', endTime: '07:00', clienteId: 'k1' }),
  one('t-short', 'c1', { property: 'Corta media hora', startTime: '09:00', endTime: '09:30', clienteId: 'k2' }),
  one('t-next', 'c1', { property: 'Siguiente', startTime: '09:30', endTime: '10:30', clienteId: 'k1' }),
  { ...base, id: 't-shared', property: 'Compartida', startTime: '12:00', endTime: '15:00', clienteId: 'k2', cleanerId: 'c1', cleaner: 'Ana Prueba, Carmen Prueba', assignments: asg('t-shared', ['c1', 'c3']), assignmentCount: 2 },
  one('t-incoh', 'c1', { property: 'Parte pendiente', startTime: '15:30', endTime: '17:00', clienteId: 'k1', status: 'completed', calendarStatus: 'pending' }),
  one('t-late', 'c3', { property: 'Nocturna', startTime: '22:00', endTime: '23:30', clienteId: 'k2' }),
  one('t-b1', 'c2', { property: 'Solape uno', startTime: '10:00', endTime: '11:30', clienteId: 'k1' }),
  one('t-b2', 'c2', { property: 'Solape dos', startTime: '11:00', endTime: '12:00', clienteId: 'k2' }),
  { ...base, id: 'u-alfa', property: 'Alfa sin asignar', startTime: '16:00', endTime: '17:00', clienteId: 'k1' },
  { ...base, id: 'u-zeta', property: 'Zeta sin asignar', startTime: '08:00', endTime: '09:00', clienteId: 'k2' },
];
const MEDICAL_NOTE = 'Nota médica ficticia';
const db = () => ({
  calls: [],
  tables: {
    cleaners, clients,
    // Ana and Carmen configured on Mondays; Berta and Dora without configuration (unknown).
    cleaner_availability: ['c1', 'c3'].map((id) => ({ id: 'av' + id, cleaner_id: id, day_of_week: 1, is_available: true, start_time: '05:00', end_time: '23:59' })),
    // Raw rows as the database would hold them: medical type and notes included.
    worker_absences: [
      { id: 'abs1', cleaner_id: 'c3', absence_type: 'sick', start_date: D, end_date: D, start_time: '16:00', end_time: '18:00', location_name: null, notes: MEDICAL_NOTE },
      { id: 'abs2', cleaner_id: 'c4', absence_type: 'sick', start_date: D, end_date: D, start_time: null, end_time: null, location_name: null, notes: MEDICAL_NOTE },
    ],
    worker_fixed_days_off: [], worker_maintenance_cleanings: [], property_preferred_cleaners: [],
  },
});

const browser = await chromium.launch({ headless: true });
const results = {};
const errors = [];
let blockedRequests = 0;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css.css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;

const open = async ({ role, url = `/calendar?date=${D}`, viewport = { width: 1440, height: 900 }, agreed = false, fail = false, storage }) => {
  const context = await browser.newContext({ viewport, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${role}: ${e.message}`));
  await context.route('**/*', (route) => {
    const req = route.request().url();
    if (req.startsWith('http://calendar.test/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    blockedRequests += 1;
    return route.abort();
  });
  await page.addInitScript(({ role, agreed, fail, tasks, db, storage }) => {
    window.__role = role; window.__agreedSupervisorMatrix = agreed; window.__tasksFail = fail; window.__tasks = tasks; window.__db = db;
    if (storage) Object.entries(storage).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { role, agreed, fail, tasks, db: db(), storage });
  await page.goto('http://calendar.test' + url);
  return { page, context };
};
const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) });
const bodyText = (page) => page.evaluate(() => document.body.innerText);

try {
  // ---------- Admin, desktop ----------
  {
    const { page, context } = await open({ role: 'admin', storage: { 'calendar.unavailableWorkersExpanded': 'true' } });
    await page.getByText('Madrugada').first().waitFor();
    await page.waitForTimeout(400);
    await shot(page, 'calendar-admin-desktop.png');
    const info = await page.evaluate(() => {
      const box = (id) => { const el = document.querySelector(`[role="button"][data-task-id="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; };
      const pressed = [...document.querySelectorAll('[aria-label="Vista del calendario"] button')].map((b) => [b.textContent.trim(), b.getAttribute('aria-pressed')]);
      const column = document.querySelector('.sticky.left-0').getBoundingClientRect();
      const incoherent = document.querySelector('[role="button"][data-task-id="t-incoh"]');
      return {
        pressed, columnRight: column.right,
        early: box('t-early'), short: box('t-short'), next: box('t-next'), late: box('t-late'),
        incoherentRing: incoherent?.className.includes('ring-success'), incoherentBadge: incoherent?.querySelector('[role="img"]')?.getAttribute('aria-label'),
        incoherentLabel: incoherent?.getAttribute('aria-label'),
        footer: document.body.innerText.match(/\d+\s*servicios?[^\n]*/)?.[0],
        breakdown: document.querySelector('[data-testid="footer-breakdown"]')?.innerText.replace(/\s+/g, ' '),
        banner: document.body.innerText.match(/\d+ trabajadoras? con solapes[^\n]*/)?.[0],
        unassigned: [...document.querySelectorAll('h4, p, span, div')].map((e) => e.childElementCount === 0 ? e.textContent.trim() : '').filter((t) => /sin asignar$/.test(t) && /^(Alfa|Zeta)/.test(t)),
        searchLabel: document.querySelector('input[type="search"]')?.getAttribute('aria-label'),
        sinHorario: [...document.querySelectorAll('span')].filter((s) => s.textContent.trim() === 'Sin horario').length,
        createButtons: [...document.querySelectorAll('button')].filter((b) => /Nueva Tarea|Múltiples/.test(b.textContent)).length,
        draggable: document.querySelector('[role="button"][data-task-id="t-next"]')?.getAttribute('draggable'),
        url: location.search,
      };
    });
    const text = await bodyText(page);
    results.admin = { ...info, medicalLabelVisible: /Baja médica/.test(text), medicalNoteVisible: text.includes(MEDICAL_NOTE) };
    assert.deepEqual(info.pressed, [['Día', 'true'], ['3 Días', 'false'], ['Semana', 'false']], 'CAL-16 aria-pressed');
    assert.ok(info.early.left >= info.columnRight - 1, 'CAL-08: the 05:30 task starts after the team column');
    assert.ok(info.short.right <= info.next.left + 0.5, 'CAL-09: contiguous tasks do not overlap in pixels ' + JSON.stringify([info.short, info.next]));
    assert.equal(info.incoherentRing, false, 'CAL-07: no green ring for a pending report');
    assert.equal(info.incoherentBadge, 'Estado: Sin iniciar');
    assert.match(info.footer, /servicios el lun 5\/10/, 'CAL-15: footer names the day shown');
    assert.match(info.breakdown, /2 sin asignar · \d+ sin iniciar/, 'CAL-15: breakdown');
    assert.match(info.banner, /^1 trabajadora con solapes \(2 tareas\)/, 'CAL-17: precise banner');
    assert.equal(info.searchLabel?.startsWith('Buscar tareas'), true, 'CAL-16: labelled search');
    assert.ok(info.sinHorario >= 1, 'CAL-13: unconfigured availability flagged');
    assert.equal(info.createButtons, 2);
    assert.equal(info.draggable, 'true');
    assert.ok(results.admin.medicalLabelVisible, 'admin sees the absence type');
    assert.ok(results.admin.medicalNoteVisible, 'admin sees the absence notes in the unavailable panel');
    // CAL-12: queue order (Zeta 08:00 before Alfa 16:00).
    const order = await page.evaluate(() => {
      const t = document.body.innerText;
      return [t.indexOf('Zeta sin asignar'), t.indexOf('Alfa sin asignar')];
    });
    assert.ok(order[0] > -1 && order[0] < order[1], 'CAL-12: unassigned ordered by time');

    // CAL-17: a banner chip opens the task detail.
    await page.getByRole('button', { name: /^Abrir Solape uno/ }).click();
    await page.waitForTimeout(400);
    results.admin.bannerOpensDetail = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    assert.ok(results.admin.bannerOpensDetail, 'banner chip opens the detail');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // CAL-10: view + client filter in the URL survive a reload.
    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await page.getByPlaceholder('Buscar...').fill('Solape');
    await page.waitForTimeout(300);
    const urlWeek = await page.evaluate(() => location.search);
    await page.reload();
    await page.getByText('Solape uno').first().waitFor();
    const afterReload = await page.evaluate(() => ({
      url: location.search,
      pressed: [...document.querySelectorAll('[aria-label="Vista del calendario"] button')].find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent.trim(),
      search: document.querySelector('input[type="search"]')?.value,
    }));
    results.admin.urlAfterWeek = urlWeek;
    results.admin.afterReload = afterReload;
    assert.match(urlWeek, /date=2026-10-05.*view=week.*q=Solape/);
    assert.deepEqual([afterReload.pressed, afterReload.search], ['Semana', 'Solape'], 'CAL-10: same view and search after reload');
    await shot(page, 'calendar-admin-week-after-reload.png');

    // CAL-10: date picker jumps to any day.
    await page.getByRole('button', { name: /^Elegir fecha/ }).click();
    await page.waitForTimeout(200);
    await shot(page, 'calendar-date-picker.png');
    await page.getByRole('gridcell', { name: '20' }).first().click();
    await page.waitForTimeout(300);
    results.admin.urlAfterPicker = await page.evaluate(() => location.search);
    assert.match(results.admin.urlAfterPicker, /date=2026-10-20/, 'date picker updates the date');
    await context.close();
  }

  // ---------- Admin: cascade preview, cancel writes nothing ----------
  {
    const { page, context } = await open({ role: 'admin' });
    await page.getByText('Zeta sin asignar').first().waitFor();
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.__db.calls.filter((c) => c.kind && c.kind !== 'read' || c.fn || c.rpc).length);
    // Drop "Zeta" (08:00-09:00) on Ana at 08:30: it overlaps "Corta media hora" and the chain after it.
    const card = page.locator('[draggable="true"]', { hasText: 'Zeta sin asignar' }).first();
    const slot = page.locator('[data-cleaner-id="c1"][data-time="08:30"]');
    await card.dragTo(slot);
    await page.getByRole('alertdialog').waitFor();
    await page.waitForTimeout(500); // let the dialog finish its opening animation
    await shot(page, 'calendar-cascade-preview.png');
    const dialogText = await page.getByRole('alertdialog').innerText();
    results.cascade = { dialogText };
    assert.match(dialogText, /Corta media hora: 09:00–09:30 → 09:30–10:00/);
    assert.match(dialogText, /Asignar sin desplazar/);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => window.__db.calls.filter((c) => c.kind && c.kind !== 'read' || c.fn || c.rpc).length);
    results.cascade.writesAfterCancel = after - before;
    assert.equal(after - before, 0, 'CAL-03: cancel makes no writes, no function calls');

    // Real page + hooks + mutations; 1 s controlled delay at service boundaries.
    // The measurement starts at the actual native drop/click, excluding Playwright.
    await page.evaluate(() => {
      window.__slow = true;
      document.addEventListener('drop', () => { window.__dropAt = performance.now(); }, { capture: true });
      const observer = new MutationObserver(() => {
        if (!window.__previewMs && document.querySelector('[role="alertdialog"]')) window.__previewMs = performance.now() - window.__dropAt;
        const card = document.querySelector('[role="button"][data-task-id="t-short"]');
        if (window.__confirmAt && !window.__visibleMs && card?.getAttribute('aria-label').includes('09:30 a 10:00')) window.__visibleMs = performance.now() - window.__confirmAt;
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      document.addEventListener('click', e => {
        if (e.target.closest('button')?.textContent.includes('Desplazar y asignar')) window.__confirmAt = performance.now();
      }, { capture: true });
    });
    await card.dragTo(slot);
    await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button', { name: 'Desplazar y asignar', exact: true }).click();
    await page.waitForFunction(() => window.__visibleMs !== undefined);
    const timing = await page.evaluate(() => ({ previewMs: window.__previewMs, cascadeVisibleMs: window.__visibleMs, serverStartTime: window.__tasks.find(t => t.id === 't-short').startTime }));
    assert.ok(timing.previewMs <= 100, `local preview ${timing.previewMs} ms`);
    assert.ok(timing.cascadeVisibleMs <= 100, `local cascade ${timing.cascadeVisibleMs} ms`);
    assert.equal(timing.serverStartTime, '09:00', 'cards move before the simulated server writes');
    await page.getByRole('status').filter({ hasText: /Aún no se ha guardado|pendientes/ }).waitFor();
    await shot(page, 'calendar-cascade-pending.png');
    await page.waitForFunction(() => !document.body.textContent.includes('Los horarios mostrados están pendientes.') && window.__tasks.find(t => t.id === 't-short').startTime === '09:30');
    timing.persistenceMs = await page.evaluate(() => performance.now() - window.__confirmAt);
    results.cascade.immediate = timing;
    await shot(page, 'calendar-cascade-saved.png');
    await context.close();
  }

  // ---------- Supervisor with the current matrix (consultation) ----------
  {
    const { page, context } = await open({ role: 'supervisor', storage: { 'calendar.unavailableWorkersExpanded': 'true' } });
    await page.getByText('Madrugada').first().waitFor();
    await page.waitForTimeout(400);
    await shot(page, 'calendar-supervisor-current-matrix.png');
    const text = await bodyText(page);
    const html = await page.content();
    const info = await page.evaluate(() => ({
      createButtons: [...document.querySelectorAll('button')].filter((b) => /Nueva Tarea|Múltiples/.test(b.textContent)).length,
      draggableCards: document.querySelectorAll('[data-task-id][draggable="true"]').length,
      absenceSelects: window.__db.calls.filter((c) => c.table === 'worker_absences').map((c) => c.select),
    }));
    results.supervisorCurrent = { ...info, medicalLabel: /Baja médica/.test(text), medicalNoteInDom: html.includes(MEDICAL_NOTE), genericAbsence: /Ausencia/.test(text) };
    assert.equal(info.createButtons, 0, 'no create buttons');
    assert.equal(info.draggableCards, 0, 'cards not draggable (read-only matrix)');
    assert.equal(results.supervisorCurrent.medicalLabel, false, 'no medical leave type in the DOM');
    assert.equal(results.supervisorCurrent.medicalNoteInDom, false, 'no absence notes in the DOM');
    assert.ok(info.absenceSelects.every((s) => s !== '*' && !s.includes('notes')), 'notes never requested for supervision');
    // Context menu offers only the detail.
    await page.locator('[role="button"][data-task-id="t-next"]').first().click({ button: 'right' });
    await page.waitForTimeout(200);
    const menu = await page.getByRole('menu').innerText();
    results.supervisorCurrent.menu = menu;
    assert.match(menu, /Ver detalles/);
    assert.doesNotMatch(menu, /Mover a|Duración|Duplicar|Desasignar|Quitar|Eliminar/);
    await page.keyboard.press('Escape');
    await context.close();
  }

  // ---------- Supervisor with the agreed contract (edit, no create/delete) ----------
  {
    const { page, context } = await open({ role: 'supervisor', agreed: true });
    await page.getByText('Compartida').first().waitFor();
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({
      createButtons: [...document.querySelectorAll('button')].filter((b) => /Nueva Tarea|Múltiples/.test(b.textContent)).length,
      draggableCards: document.querySelectorAll('[data-task-id][draggable="true"]').length,
    }));
    await page.locator('[role="button"][data-task-id="t-shared"]').first().click({ button: 'right' });
    await page.waitForTimeout(200);
    const menu = await page.getByRole('menu').innerText();
    await shot(page, 'calendar-supervisor-agreed-menu.png');
    results.supervisorAgreed = { ...info, menu };
    assert.equal(info.createButtons, 0, 'agreed contract: still no creation');
    assert.ok(info.draggableCards > 0, 'agreed contract: operational edit (drag)');
    assert.match(menu, /Mover a/);
    assert.match(menu, /Quitar a Ana Prueba/, 'CAL-19: remove only this person');
    assert.match(menu, /Desasignar a todas/);
    assert.doesNotMatch(menu, /Duplicar|Eliminar/, 'no duplicate (create) nor delete');
    await page.keyboard.press('Escape');
    await context.close();
  }

  // ---------- Admin: menu of a shared task ----------
  {
    const { page, context } = await open({ role: 'admin' });
    await page.getByText('Compartida').first().waitFor();
    await page.locator('[role="button"][data-task-id="t-shared"]').first().click({ button: 'right' });
    await page.waitForTimeout(200);
    const menu = await page.getByRole('menu').innerText();
    results.adminSharedMenu = menu;
    assert.match(menu, /Quitar a Ana Prueba/);
    assert.match(menu, /Duplicar sin asignar/);
    assert.match(menu, /Eliminar/);
    await page.getByRole('menuitem', { name: 'Mover a' }).hover();
    await page.waitForTimeout(300);
    const submenu = (await page.getByRole('menu').allInnerTexts()).join(' | ');
    results.adminMoveSubmenu = submenu;
    assert.match(submenu, /Día siguiente \(06\/10\)/, 'CAL-14: moves relative to the task day');
    await page.keyboard.press('Escape');
    await context.close();
  }

  // ---------- Load error: never an empty day ----------
  {
    const { page, context } = await open({ role: 'admin', fail: true });
    await page.getByText('No se han podido cargar las tareas').waitFor();
    await shot(page, 'calendar-load-error.png');
    const text = await bodyText(page);
    results.loadError = { retry: /Reintentar/.test(text), zero: /0 servicios/.test(text) };
    assert.ok(results.loadError.retry);
    assert.equal(results.loadError.zero, false, 'CAL-06: never "0 servicios" on a failed load');
    await context.close();
  }

  // ---------- Mobile agenda (390 px) ----------
  for (const role of ['admin', 'supervisor']) {
    const { page, context } = await open({ role, viewport: { width: 390, height: 844 } });
    await page.getByText('Agenda diaria').waitFor();
    await page.waitForTimeout(400);
    await shot(page, `calendar-mobile-${role}.png`);
    const info = await page.evaluate(() => ({
      search: !!document.querySelector('input[aria-label="Buscar tareas del día"]'),
      datePicker: !!document.querySelector('button[aria-label^="Elegir fecha"]'),
      clientFilter: !!document.querySelector('select[aria-label="Filtrar por cliente"]'),
      counters: document.body.innerText.replace(/\s+/g, ' ').match(/\d+ Total \d+ Sin asig\. \d+ Curso \d+ OK/)?.[0],
      create: /Crear tarea/.test(document.body.innerText),
      createNav: !!document.querySelector('[aria-label="Crear"], [aria-label="Ir al calendario para crear"]'),
    }));
    await page.getByLabel('Buscar tareas del día').fill('Zeta');
    await page.waitForTimeout(200);
    info.afterSearch = await page.evaluate(() => document.body.innerText.includes('Zeta sin asignar') && !document.body.innerText.includes('Alfa sin asignar'));
    info.url = await page.evaluate(() => location.search);
    results[`mobile-${role}`] = info;
    assert.ok(info.search && info.datePicker && info.clientFilter, 'mobile agenda: search, date and client filter');
    assert.match(info.counters, /10 Total 2 Sin asig\. 0 Curso 0 OK/, 'CAL-07: counters use the displayed status');
    assert.ok(info.afterSearch, 'mobile search filters the day');
    assert.match(info.url, /q=Zeta/, 'mobile search kept in the URL');
    assert.equal(info.createNav, role === 'admin', 'Crear only for roles that can create');
    await context.close();
  }
} finally {
  await browser.close();
}

results.blockedRequests = blockedRequests;
results.pageErrors = errors;
console.log(JSON.stringify(results, null, 2));
assert.deepEqual(errors, [], 'no page errors');
console.log(`calendar-page-browser: OK (real /calendar page; admin, supervisor current and agreed matrix, cascade preview cancel, URL reload, date picker, load error, mobile agenda; ${blockedRequests} external requests blocked; screenshots in ${outDir})`);
