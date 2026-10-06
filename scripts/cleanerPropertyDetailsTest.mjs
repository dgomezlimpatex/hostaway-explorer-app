import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const compiled = await build({
  stdin: { contents: `export { CleanerPropertyDetails } from './src/features/cleaner/CleanerPropertyDetails';`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  packages: 'external', logLevel: 'silent',
});
// A data URL cannot resolve bare packages: use their absolute file URLs.
const source = compiled.outputFiles[0].text.replace(/from "react\/jsx-runtime"/g, `from ${JSON.stringify(import.meta.resolve('react/jsx-runtime'))}`);
const { CleanerPropertyDetails } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const render = props => renderToStaticMarkup(createElement(CleanerPropertyDetails, props));
const fields = ['numero_camas','numero_camas_pequenas','numero_camas_suite','numero_sofas_cama','numero_banos','numero_sabanas','numero_sabanas_pequenas','numero_sabanas_suite','numero_toallas_grandes','numero_toallas_pequenas','numero_alfombrines','numero_fundas_almohada','kit_alimentario','cantidad_rollos_papel_higienico','cantidad_rollos_papel_cocina'];
const property = { notas: 'Primera indicación\nSegunda indicación', duracion_servicio: 75, ...Object.fromEntries(fields.map((field,index) => [field,index + 1])) };
const html = render({ property, taskNotes: 'Instrucción de esta tarea' });
assert.match(html, /Primera indicación\nSegunda indicación/);
assert.match(html, /Instrucción de esta tarea/);
assert.match(html, /75 min/);
assert.match(html, /Características del piso/);
assert.match(html, /Textiles y amenities/);
assert.doesNotMatch(html, /<details|Coste|coste_servicio/);
for (let index = 0; index < fields.length; index++) assert.match(html, new RegExp(`<dd[^>]*>${index + 1}</dd>`));
const compact = render({ property, compact: true });
assert.match(compact, /<details[^>]*><summary/);
assert.match(compact, /Datos e indicaciones del piso/);
assert.match(compact, /Primera indicación/);
const empty = render({ property: { notas: '  ', numero_camas: null } });
assert.match(empty, /No hay notas específicas guardadas para este piso/);
assert.match(empty, /<dd[^>]*>0<\/dd>/);
assert.match(empty, /<dd[^>]*>—<\/dd>/);
assert.equal(render({ property: null }), '');
assert.match(render({ property: null, taskNotes: 'Solo tarea' }), /Solo tarea/);
const loader = await readFile('src/features/cleaner/useCleanerData.ts', 'utf8');
const selection = loader.match(/from\('properties'\)\.select\('([^']+)'\)/)?.[1].split(',');
assert.ok(selection);
for (const field of [...fields,'notas','duracion_servicio']) assert.ok(selection.includes(field), `Property loader must include ${field}`);
assert.match(loader, /\.eq\('id', task\.propertyId\)\.eq\('sede_id', sedeId\)\.maybeSingle\(\)/);
const modal = await readFile('src/features/cleaner/CleanerTaskReportModal.tsx', 'utf8');
assert.match(modal, /<CleanerPropertyDetails property=\{bundle\.data\?\.property\} taskNotes=\{task\.notes\} compact=\{started\}/);
console.log('PASS: property notes, all characteristics/supplies, task notes, compact view, old offline caches and scoped loader.');
