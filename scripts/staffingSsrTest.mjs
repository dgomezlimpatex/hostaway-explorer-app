import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
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
    outfile, jsx: 'automatic', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'
  });
  const { html } = (await import(pathToFileURL(outfile).href)).default;
  for (const label of ['Previsión de personal', 'Datos y criterios', 'Sin semanas/datos calculables para este mes', 'Equipo y carga simulada', 'Comparación de escenarios']) assert.ok(html.includes(label), `SSR label: ${label}`);
  assert.ok(html.includes('Secciones de previsión'), 'section navigation remains discoverable');
  assert.equal((html.match(/role="dialog"/g) || []).length, 0, 'editor is closed initially');
  assert.ok(!/supabase|\.insert\(|\.update\(|\.upsert\(/.test(html), 'SSR view does not persist');
  const order = ['Trabajo y capacidad por semana', 'Opciones para esta semana', 'Equipo y carga simulada', 'Comparación de escenarios'].map(label => html.indexOf(label));
  assert.ok(order.every(index => index >= 0) && order.every((index, i) => i === 0 || index > order[i - 1]), 'SSR composition order');
  const source = readFileSync('src/features/staffing/StaffingMonthly.tsx', 'utf8');
  assert.ok(!source.includes('onOpenData'), 'monthly component has no stale prop');
  console.log('staffing-ssr-tests: OK (read-only labels, composition and closed editor)');
} finally { rmSync(dir, { recursive: true, force: true }); }
