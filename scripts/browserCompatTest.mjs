// Local fixtures only: no network, no Supabase.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { build } from 'esbuild';

const load = async entry => {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
    packages: 'external', alias: { '@': join(process.cwd(), 'src') }, logLevel: 'silent',
  });
  const source = result.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};
const compat = await load('src/utils/browserCompat.ts');
const {
  randomUUIDFallback, installRandomUUID, protectFromTranslation, guardDomAgainstTranslation,
  isChunkLoadError, reloadOnceForNewVersion,
} = compat;

// 1. crypto.randomUUID for Chrome < 92: valid RFC 4122 v4 identifiers, never overriding a native one.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert.match(randomUUIDFallback(bytes => bytes.fill(255)), uuidPattern);
assert.match(randomUUIDFallback(bytes => bytes.fill(0)), uuidPattern);
const oldCrypto = { getRandomValues: bytes => globalThis.crypto.getRandomValues(bytes) };
installRandomUUID({ crypto: oldCrypto });
const ids = new Set(Array.from({ length: 500 }, () => oldCrypto.randomUUID()));
assert.equal(ids.size, 500, 'Unique identifiers for reports and photos');
[...ids].forEach(id => assert.match(id, uuidPattern));
const native = () => 'native';
const modernCrypto = { randomUUID: native, getRandomValues: oldCrypto.getRandomValues };
installRandomUUID({ crypto: modernCrypto });
assert.equal(modernCrypto.randomUUID, native, 'Keep the native implementation');
assert.doesNotThrow(() => installRandomUUID({}), 'No crypto object: leave it unchanged');
assert.doesNotThrow(() => installRandomUUID({ crypto: Object.freeze({ getRandomValues: oldCrypto.getRandomValues }) }));

// 2. Document declared in Spanish and excluded from automatic translation.
const appended = [];
const attributes = {};
const classes = new Set();
const fakeDocument = {
  documentElement: { lang: 'en', setAttribute: (name, value) => { attributes[name] = value; }, classList: { add: name => classes.add(name) } },
  head: { querySelector: () => appended.find(node => node.name === 'google') || null, appendChild: node => appended.push(node) },
  createElement: tag => ({ tag }),
};
protectFromTranslation(fakeDocument);
protectFromTranslation(fakeDocument);
assert.equal(fakeDocument.documentElement.lang, 'es');
assert.equal(attributes.translate, 'no');
assert.ok(classes.has('notranslate'));
assert.deepEqual(appended, [{ tag: 'meta', name: 'google', content: 'notranslate' }], 'A single notranslate meta tag');

// 3. Translation moved React's text nodes: removing/inserting relative to them must not throw.
class FakeNode {
  constructor() { this.childNodes = []; this.parentNode = null; }
  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new Error('NotFoundError: The node to be removed is not a child of this node.');
    this.childNodes.splice(index, 1); child.parentNode = null; return child;
  }
  insertBefore(node, reference) {
    const index = reference ? this.childNodes.indexOf(reference) : this.childNodes.length;
    if (index < 0) throw new Error('NotFoundError: The node before which the new node is to be inserted is not a child of this node.');
    this.childNodes.splice(index, 0, node); node.parentNode = this; return node;
  }
}
const parent = new FakeNode();
const text = new FakeNode();
parent.insertBefore(text, null);
const font = new FakeNode();
parent.removeChild(text); parent.insertBefore(font, null); font.insertBefore(text, null); // what Google Translate does
assert.throws(() => parent.removeChild(text), /NotFoundError/, 'The fixture reproduces the crash');
guardDomAgainstTranslation(FakeNode.prototype);
guardDomAgainstTranslation(FakeNode.prototype); // idempotent
assert.equal(parent.removeChild(text), text, 'Moved node: ignore instead of crashing the screen');
const added = new FakeNode();
assert.equal(parent.insertBefore(added, text), added, 'Moved reference: no crash');
const own = new FakeNode();
parent.insertBefore(own, null);
assert.equal(parent.removeChild(own), own);
assert.ok(!parent.childNodes.includes(own), 'Normal removals still work');
const second = new FakeNode();
parent.insertBefore(second, font);
assert.equal(parent.childNodes[0], second, 'Normal insertions still work');

// 4. Chunk failures after a deployment in Chrome, Firefox and Safari.
for (const message of [
  'Failed to fetch dynamically imported module: https://gestionlimpatex.vercel.app/assets/Tasks-old.js',
  'error loading dynamically imported module',
  'Importing a module script failed.',
  'Unable to preload CSS for /assets/index-old.css',
  "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". Strict MIME type checking is enforced for module scripts per HTML spec. 'text/html' is not a valid JavaScript MIME type.",
]) assert.ok(isChunkLoadError(new TypeError(message)), message);
assert.ok(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 3 failed' }));
for (const other of [new Error('Cannot read properties of undefined'), null, undefined, 'x', new Error('NotFoundError')]) assert.equal(isChunkLoadError(other), false);

// 5. Reload once per minute; never while offline or without storage.
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
let reloads = 0;
const reload = () => { reloads++; };
const storage = memory();
assert.equal(reloadOnceForNewVersion({ storage, now: 1_000_000, online: true, reload }), true);
assert.equal(reloadOnceForNewVersion({ storage, now: 1_030_000, online: true, reload }), false, 'Avoid a reload loop');
assert.equal(reloadOnceForNewVersion({ storage, now: 1_061_000, online: true, reload }), true, 'Later deployments still recover');
assert.equal(reloads, 2);
assert.equal(reloadOnceForNewVersion({ storage: memory(), now: 5, online: false, reload }), false, 'Offline: keep the saved work on screen');
assert.equal(reloadOnceForNewVersion({ storage: null, now: 5, online: true, reload }), false);
assert.equal(reloadOnceForNewVersion({ storage: { getItem: () => null, setItem: () => { throw new Error('Quota'); } }, now: 5, online: true, reload }), false);
assert.equal(reloads, 2);

// 6. The real error boundary: chunk errors reload; other errors keep the previous retry.
const sessionData = memory();
let pageReloads = 0;
globalThis.window = { sessionStorage: sessionData, location: { reload: () => { pageReloads++; } }, setTimeout, clearTimeout };
try {
  const { LazyLoadErrorBoundary } = await load('src/components/common/LazyLoadErrorBoundary.tsx');
  const chunk = new TypeError('Failed to fetch dynamically imported module: /assets/Index-old.js');
  const state = LazyLoadErrorBoundary.getDerivedStateFromError(chunk);
  assert.equal(state.isLazyLoadError, true);
  const boundary = new LazyLoadErrorBoundary({ children: null });
  boundary.setState = update => { boundary.state = { ...boundary.state, ...(typeof update === 'function' ? update(boundary.state) : update) }; };
  boundary.state = { ...boundary.state, ...state };
  const originalError = console.error;
  console.error = () => {};
  try { boundary.componentDidCatch(chunk, { componentStack: '' }); } finally { console.error = originalError; }
  assert.equal(pageReloads, 1, 'Automatic single reload for an old chunk');
  boundary.handleRetry();
  assert.equal(pageReloads, 2, 'Retry reloads: React.lazy keeps the failed import');
  const ordinary = new LazyLoadErrorBoundary({ children: null });
  ordinary.state = { ...ordinary.state, ...LazyLoadErrorBoundary.getDerivedStateFromError(new Error('Render failed')) };
  ordinary.setState = () => {};
  console.error = () => {};
  try { ordinary.componentDidCatch(new Error('Render failed'), { componentStack: '' }); } finally { console.error = originalError; }
  assert.equal(pageReloads, 2, 'Other errors do not reload automatically');
} finally { delete globalThis.window; }

console.log('PASS: randomUUID fallback, translation protection, DOM guard, chunk detection, single reload and error boundary.');
