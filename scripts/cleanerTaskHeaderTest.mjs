import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compiled = await build({
  stdin: { contents: `export { CleanerTaskHeaderActions, getCleanerTaskStatus } from './src/features/cleaner/CleanerTaskHeaderActions';`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  alias: { '@': join(process.cwd(),'src') }, packages: 'external', logLevel: 'silent',
});
const source = compiled.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { CleanerTaskHeaderActions, getCleanerTaskStatus } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
let syncCalls = 0;
const status = { isOnline: true, isSyncing: false, pending: 0, pendingPhotos: 0, error: null, shellReady: true, shellError: false, sync: async () => { syncCalls++; } };
for (const [changes, state, label, color, text] of [
  [{}, 'confirmed', 'Sincronizado', 'green', /No hay cambios pendientes/],
  [{pending:1}, 'pending', 'Sin sincronizar', 'red', /pendiente de enviar/],
  [{pendingPhotos:1}, 'pending', 'Sin sincronizar', 'red', /pendiente de enviar/],
  [{error:'Local test'}, 'pending', 'Sin sincronizar', 'red', /No se ha podido confirmar/],
  [{isOnline:false}, 'pending', 'Sin sincronizar', 'red', /Sin cobertura/],
  [{isOnline:false,pending:1}, 'pending', 'Sin sincronizar', 'red', /recuperes conexión/],
  [{isSyncing:true,pending:1}, 'sending', 'Sincronizando', 'blue', /enviando tus cambios/],
  [{isSyncing:true,error:'Previous attempt'}, 'sending', 'Sincronizando', 'blue', /enviando tus cambios/],
  [{isOnline:false,isSyncing:true}, 'pending', 'Sin sincronizar', 'red', /Sin cobertura/],
]) {
  const current = {...status,...changes};
  const view = getCleanerTaskStatus(current);
  assert.equal(view.state,state); assert.equal(view.label,label);
  assert.match(view.color,new RegExp(`text-${color}-`)); assert.match(view.text,text);
  const html = renderToStaticMarkup(createElement(CleanerTaskHeaderActions, {property:{notas:'Hidden until opened'},taskNotes:'Task notes',propertyName:'Piso de prueba',loading:false,status:current,showNotes:true}));
  assert.match(html, />NOTAS<\/button>/);
  assert.match(html,new RegExp(`data-work-state="${state}"`));
  assert.match(html,new RegExp(`aria-label="Sincronización: ${label}"`));
  assert.doesNotMatch(html,/Hidden until opened|Task notes|Datos e indicaciones del piso|Textiles y amenities/);
}
const noStatus = renderToStaticMarkup(createElement(CleanerTaskHeaderActions,{propertyName:'Piso',loading:true,status:null,showNotes:true}));
assert.match(noStatus,/>NOTAS<\/button>/);
assert.doesNotMatch(noStatus,/data-work-state/);
const beforeStart = renderToStaticMarkup(createElement(CleanerTaskHeaderActions,{propertyName:'Piso',loading:false,status,showNotes:false}));
assert.doesNotMatch(beforeStart,/>NOTAS<\/button>/);
assert.match(beforeStart,/data-work-state="confirmed"/);
assert.equal(syncCalls,0,'Rendering indicators or notes must not trigger sync');
console.log('PASS: task header buttons, hidden popup content, red/blue/green mapping, pending photos, errors, offline states and no side effects.');
