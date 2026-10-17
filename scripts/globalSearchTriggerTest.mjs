import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Runs the real custom-trigger wiring of the global search: no DOM, database or network.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `export * from './src/components/navigation/searchTrigger'; export { createElement } from 'react';` },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true, external: ['react'],
});
assert.equal(Object.keys(built.metafile.inputs).some((path) => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'global-search-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `search-trigger-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const click = () => ({ defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

// A plain icon button (as in GlobalSearchIconTrigger / mobile header) now opens the search.
let opened = 0;
const plain = m.withSearchTrigger(m.createElement('button', { className: 'p-2' }), () => { opened += 1; });
assert.equal(plain.props['aria-label'], 'Buscar en la aplicación', 'icon-only button gets an accessible name');
assert.equal(plain.props.className, 'p-2', 'own props are kept');
plain.props.onClick(click());
assert.equal(opened, 1);

// The button's own handler still runs first, and its explicit name is kept.
const calls = [];
const own = m.withSearchTrigger(m.createElement('button', { 'aria-label': 'Buscar', onClick: () => calls.push('own') }), () => calls.push('open'));
assert.equal(own.props['aria-label'], 'Buscar');
own.props.onClick(click());
assert.deepEqual(calls, ['own', 'open']);

// A handler that cancels the click keeps the search closed.
let cancelledOpen = 0;
const cancelling = m.withSearchTrigger(m.createElement('button', { onClick: (event) => event.preventDefault() }), () => { cancelledOpen += 1; });
cancelling.props.onClick(click());
assert.equal(cancelledOpen, 0);

console.log('globalSearchTriggerTest: ok');
