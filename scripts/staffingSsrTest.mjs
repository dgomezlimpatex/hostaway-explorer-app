import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'staffing-ssr-'));
try {
  const outfile = join(dir, 'ssr.cjs');
  await build({
    stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { StaffingDashboard } from './src/features/staffing/StaffingDashboard';
      const dataset = { centers: [], workers: [], services: [], issues: [], inventory: [], fetchedAt: '2026-09-14T12:00:00Z' };
      export const html = renderToStaticMarkup(React.createElement(StaffingDashboard, { dataset, dateFrom: '2026-09-14', monthAnchor: '2026-09-01', asOf: '2026-09-14', weeks: 4, compute: () => ({ weeks: [], days: [], centers: [], issues: [] }) }));`, resolveDir: process.cwd(), loader: 'tsx' },
    outfile, jsx: 'automatic', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
    plugins: [{ name: 'offline-sede-selector', setup(plugin) { plugin.onResolve({ filter: /^@\/components\/sede\/SedeSelector$/ }, () => ({ path: 'staffing-sede-selector', namespace: 'fixture' })); plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const SedeSelector=()=>null;', loader: 'js' })); } }]
  });
  const { html } = (await import(pathToFileURL(outfile).href)).default;
  for (const label of ['Previsión de personal', 'Resumen por semana', 'No hay datos para dibujar el periodo', 'No hay semanas dentro del rango']) assert.ok(html.includes(label), `SSR label: ${label}`);
  assert.equal((html.match(/role="dialog"/g) || []).length, 0, 'editor is closed initially');
  assert.ok(!/supabase|\.insert\(|\.update\(|\.upsert\(/.test(html), 'SSR view does not persist');
  assert.ok(html.includes('Semanal') && html.includes('Mensual'), 'period selector remains discoverable');
  console.log('staffing-ssr-tests: OK (read-only redesigned summary and closed editor)');
} finally { rmSync(dir, { recursive: true, force: true }); }