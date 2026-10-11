import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Renders the real calendar footer with a local client list; no network.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { CalendarFooterSummary } from './src/components/calendar/CalendarFooterSummary';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server'],
  plugins: [{ name: 'clients', setup(plugin) {
    plugin.onResolve({ filter: /^@\/hooks\/useClientData$/ }, () => ({ path: 'clients', namespace: 'stub' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: `
      export const useClientData = () => ({
        clients: globalThis.clientFixture,
        getClientName: id => globalThis.clientFixture.find(c => c.id === id)?.nombre ?? id,
      });` }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `footer-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const uuid = '7a1c2b3d-0000-4000-8000-000000000001';
const tasks = [{ id: 't', date: '2026-10-06', clienteId: uuid, cleanerId: 'c1', property: 'Piso', startTime: '09:00', endTime: '10:00', status: 'pending' }];
const render = clients => { globalThis.clientFixture = clients; return m.renderToStaticMarkup(m.createElement(m.CalendarFooterSummary, { tasks, cleaners: [{ id: 'c1', name: 'Ana' }] })); };

// Regression: while clients were loading the legend showed the raw id.
const loading = render([]);
assert.doesNotMatch(loading, new RegExp(uuid));
assert.match(loading, />Cliente</);
assert.match(render([{ id: uuid, nombre: 'Apartamentos Centro' }]), />Apartamentos Centro</);
console.log('calendar-footer-client-names: OK (legend never shows a raw client id; no network)');
