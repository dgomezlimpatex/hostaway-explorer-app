import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const result = await build({
  entryPoints: ['src/services/storage/propertyGroupStorage.ts'], bundle: true,
  write: false, platform: 'node', format: 'cjs', plugins: [{name: 'isolated-storage', setup(plugin) {
    plugin.onResolve({filter: /integrations\/supabase\/client/}, () => ({path: 'client', namespace: 'mock'}));
    plugin.onLoad({filter: /.*/, namespace: 'mock'}, () => ({contents: 'export const supabase=globalThis.client;'}));
  }}],
});
const calls = [];
let error = null;
const module = {exports: {}};
vm.runInNewContext(result.outputFiles[0].text, {module, exports: module.exports, console, client: {
  rpc: async (...args) => { calls.push(args); return {error}; },
  from: () => ({select: () => ({order: async () => ({data: [{id: 'g', is_active: false, retired_at: '2026-10-08'}], error: null})})}),
}});
const storage = module.exports.propertyGroupStorage;
await storage.retirePropertyGroup('g');
assert.equal(JSON.stringify(calls), JSON.stringify([['retire_property_group', {p_group_id: 'g'}]]));
assert.equal((await storage.getPropertyGroups())[0].retiredAt, '2026-10-08');
error = {message: 'Permiso denegado'};
await assert.rejects(storage.retirePropertyGroup('g'), /Permiso denegado/);
console.log('Retirement storage: one RPC, mapped retired state and errors propagated; no production client.');
