import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Renders the real month strip with local rows; no network.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { FinancialMonthBar } from './src/features/financial/FinancialMonthBar';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  loader: { '.css': 'empty' }, external: ['react', 'react-dom', 'react-dom/server', 'lucide-react'],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'financial-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `month-bar-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
const { FinancialMonthBar, createElement, renderToStaticMarkup } = await import(pathToFileURL(bundlePath).href);

const rows = [{ start: '2026-08-01', revenue: 40000, result: 9000 }, { start: '2026-09-01', revenue: 58000, result: 12000 }, { start: '2026-10-01', revenue: 35000, result: 6000 }];
const noop = () => undefined;
const html = renderToStaticMarkup(createElement(FinancialMonthBar, {
  start: '2026-10-01', end: '2026-10-31', annualYear: '', monthValue: '2026-10', filterCount: 0, busy: false, rows,
  onMove: noop, onPickMonth: noop, onMonthInput: noop, onFullMonth: noop, onAnnual: noop, onMonthly: noop, filtersOpen: false, onToggleFilters: noop, years: ['2026'], onYear: noop,
}));
assert.equal(html.includes('Facturación de cada mes'), false, 'the strip heading is gone');
assert.equal(html.includes('parte oscura'), false, 'the long legend is gone');
assert.match(html, /var\(--fin-income-ink\)[^>]*><\/span>Beneficio<\/span>/, 'legend is the dark swatch plus "Beneficio"');
assert.ok(html.includes('aria-label="Facturación de los últimos 12 meses"'), 'the group keeps its accessible name');
assert.ok(html.includes('Ajustar escala'), 'the scale control stays');
console.log('financial-month-bar-labels: no strip heading, short Beneficio legend, accessible name and scale control kept passed');
