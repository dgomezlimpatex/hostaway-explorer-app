import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Runs the real URL contract of the global search with local fixtures only:
// no database, session or network.
const built = await build({
  entryPoints: ['src/components/navigation/entityLinks.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', metafile: true,
});
assert.equal(Object.keys(built.metafile.inputs).some((path) => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'global-search-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `entity-links-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

// Each result type opens its own detail by id, never a filtered listing by name.
assert.equal(m.entityDetailPath('task', 't-1'), '/tasks?taskId=t-1');
assert.equal(m.entityDetailPath('property', 'p-1'), '/properties?propertyId=p-1');
assert.equal(m.entityDetailPath('client', 'c-1'), '/clients?clientId=c-1');
assert.equal(m.entityDetailPath('worker', 'w-1'), '/workers/w-1', 'workers open their profile, not the task list');
for (const type of ['task', 'property', 'client', 'worker']) {
  assert.doesNotMatch(m.entityDetailPath(type, 'x'), /search=/, `${type} must not navigate by text`);
}
// The property param matches the links already used by the buildings CRM.
assert.equal(m.ENTITY_LINK_PARAM.property, 'propertyId');
// Unexpected characters cannot inject extra params or path segments.
assert.equal(m.entityDetailPath('client', 'a&clientId=b'), '/clients?clientId=a%26clientId%3Db');
assert.equal(new URL(m.entityDetailPath('client', 'a&clientId=b'), 'https://x').searchParams.getAll('clientId').join(), 'a&clientId=b');
assert.equal(m.entityDetailPath('worker', '../admin'), '/workers/..%2Fadmin');

// Closing a linked detail removes only its param and keeps the rest of the context.
const params = new URLSearchParams('clientId=c-1&tab=summary&back=%2Fworkers');
const next = m.withoutSearchParam(params, 'clientId');
assert.equal(next.toString(), 'tab=summary&back=%2Fworkers');
assert.equal(params.get('clientId'), 'c-1', 'the original params are not mutated');

// Resolution is by identity among the records of the active sede.
const twins = [
  { id: 'p-a', nombre: 'Ático Centro' },
  { id: 'p-b', nombre: 'Ático Centro' },
  { id: 'p-c', nombre: 'Bajo Riazor' },
];
assert.deepEqual(m.resolveLinkedEntity(null, twins, { ready: true }), { status: 'none' });
assert.deepEqual(m.resolveLinkedEntity('p-b', twins, { ready: true }), { status: 'found', id: 'p-b', entity: twins[1] }, 'duplicated names resolve to the selected id');
assert.deepEqual(m.resolveLinkedEntity('p-a', twins, { ready: true }).entity, twins[0]);
// Still loading: neither a stale nor a guessed record.
assert.deepEqual(m.resolveLinkedEntity('p-b', twins, { ready: false }), { status: 'loading', id: 'p-b' });
assert.deepEqual(m.resolveLinkedEntity('p-b', undefined, { ready: true }), { status: 'loading', id: 'p-b' });
// Deleted or inaccessible ids are reported, never replaced by the first or a similar record.
assert.deepEqual(m.resolveLinkedEntity('p-zz', twins, { ready: true }), { status: 'unavailable', id: 'p-zz' });
assert.deepEqual(m.resolveLinkedEntity('p-zz', [], { ready: true }), { status: 'unavailable', id: 'p-zz' });
assert.deepEqual(m.resolveLinkedEntity('Ático Centro', twins, { ready: true }).status, 'unavailable', 'a name is not an id');
// A record from another sede is not opened and the sede is not switched.
const task = { id: 't-1', sedeId: 'sede-b' };
assert.deepEqual(m.resolveLinkedEntity('t-1', [task], { ready: true, sedeId: 'sede-a' }), { status: 'unavailable', id: 't-1' });
assert.equal(m.resolveLinkedEntity('t-1', [task], { ready: true, sedeId: 'sede-b' }).status, 'found');
assert.equal(m.resolveLinkedEntity('t-1', [{ id: 't-1' }], { ready: true, sedeId: 'sede-a' }).status, 'found', 'records without sede come from a sede-scoped query');

console.log('globalSearchEntityLinksTest: ok');
