import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const components = new URL('../src/components/', import.meta.url);
const page = await readFile(new URL('properties/PropertiesPage.tsx', components), 'utf8');
const list = await readFile(new URL('properties/PropertyList.tsx', components), 'utf8');
const detail = await readFile(new URL('properties/PropertyDetailPanel.tsx', components), 'utf8');
const frame = await readFile(new URL('directory/CrmDetailFrame.tsx', components), 'utf8');
const directory = await readFile(new URL('directory/DirectoryPage.tsx', components), 'utf8');
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

const checks = [
  ['search covers property and client fields', /property\.direccion[\s\S]*getClientName\(property\)/.test(page)],
  ['status and client filters remain', /status === 'all'[\s\S]*clientFilter === 'all'/.test(page)],
  ['active properties are the default view', /useState\('active'\)/.test(page) && /setStatus\('active'\)/.test(page) && /showStats=\{false\}/.test(page)],
  ['loading, error and empty states remain', /Cargando propiedades[\s\S]*hasError[\s\S]*DirectoryEmpty/.test(page)],
  ['client grouping remains', /clienteId \|\| 'unassigned'/.test(list)],
  ['selection is keyboard-visible and announced', /aria-pressed=\{selected\}/.test(list) && /focus-visible:ring/.test(list)],
  ['all property tabs remain', /Ficha/.test(detail) && /Consumos/.test(detail) && /Limpiezas/.test(detail) && /Checklist/.test(detail)],
  ['delete confirmation remains', /AlertDialog/.test(detail) && /Eliminar propiedad/.test(detail)],
  ['responsive frame prevents horizontal overflow', /overflow-x-hidden/.test(directory) && /overflow-y-auto/.test(page) && /min-w-0/.test(frame) && /min-h-11/.test(frame)],
  ['properties use readable local typography', /properties-page/.test(page) && /Source Sans 3/.test(css) && /Manrope/.test(css)],
  ['properties opt into a non-gradient detail variant', /variant=\"properties\"/.test(detail) && /isProperties/.test(frame) && /bg-slate-950/.test(frame)],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, name);
  console.log(`PASS ${name}`);
}
console.log(`Properties UI contract: ${checks.length} checks passed`);