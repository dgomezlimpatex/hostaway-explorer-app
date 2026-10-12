// Local fixtures only: no network, no Supabase, no real accounts.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The account hook would load the real Supabase client; the recovery logic only needs the user id.
const isolatedAuth = { name: 'isolated-auth', setup(builder) {
  builder.onResolve({ filter: /^@\/hooks\/useAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useAuth = () => ({ user: { id: "owner" } });', loader: 'js' }));
} };
const load = async entry => {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
    packages: 'external', alias: { '@': join(process.cwd(), 'src') }, logLevel: 'silent', plugins: [isolatedAuth],
  });
  const source = result.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};
const memory = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
const never = () => new Promise(() => {});

// 1. Phone storage that stops answering ends in a recoverable error and reopens the connection.
const { withStorageTimeout } = await load('src/features/cleaner/storageTimeout.ts');
assert.equal(await withStorageTimeout(Promise.resolve('saved'), 50, 'stalled'), 'saved');
let resets = 0;
await assert.rejects(withStorageTimeout(never(), 10, 'El guardado no responde', () => { resets++; }), /El guardado no responde/);
assert.equal(resets, 1);
const failure = new Error('QuotaExceededError');
await assert.rejects(withStorageTimeout(Promise.reject(failure), 50, 'stalled', () => { resets++; }), error => error === failure);
let finishLate;
const late = new Promise(resolve => { finishLate = resolve; });
await assert.rejects(withStorageTimeout(late, 10, 'stalled'), /stalled/);
finishLate('committed later');
assert.equal(await late, 'committed later', 'A late commit still completes; the screen simply stopped waiting');
assert.equal(resets, 1, 'Normal results and errors do not reset storage');

// 2. The real save handler of the report: a stalled write releases "Guardando…" and the queue.
const modalSource = await readFile('src/features/cleaner/CleanerTaskReportModal.tsx', 'utf8');
const ast = ts.createSourceFile('modal.tsx', modalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
(function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(ast) === 'useCallback') callbacks[node.name.text] = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
})(ast);
const compile = (node, names) => new Function(...names, ts.transpileModule(`return (${node.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
assert.ok(callbacks.save && callbacks.uploadPhoto, 'Test the actual handlers');
const saveNames = ['setSaving', 'setError', 'saveChain', 'withStorageTimeout', 'changeDraft', 'key', 'SAVE_TIMEOUT_MS', 'STORAGE_STALLED', 'resetCleanerDatabase', 'saveErrorRef', 'applyDraft'];
const harness = () => {
  const state = { saving: 0, error: null, applied: [], resets: 0, writes: [] };
  const deps = {
    setSaving: update => { state.saving = update(state.saving); },
    setError: value => { state.error = value; },
    saveChain: { current: Promise.resolve() }, withStorageTimeout, key: 'owner:task', SAVE_TIMEOUT_MS: 15,
    STORAGE_STALLED: 'El guardado del móvil no ha respondido. Pulsa Reintentar guardar. No borres los datos de la app.',
    resetCleanerDatabase: () => { state.resets++; }, saveErrorRef: { current: null }, applyDraft: draft => state.applied.push(draft),
    changeDraft: (key, change) => { state.writes.push(key); return state.nextWrite(change); },
  };
  return { state, deps, save: compile(callbacks.save, saveNames)(...saveNames.map(name => deps[name])) };
};
{
  const { state, deps, save } = harness();
  state.nextWrite = () => never();
  await assert.rejects(save(current => current), /Pulsa Reintentar guardar/);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(state.saving, 0, 'Stalled storage must not leave the screen on "Guardando…"');
  assert.match(state.error, /Reintentar guardar/);
  assert.equal(deps.saveErrorRef.current, state.error, 'Closing stays blocked until the retry saves');
  assert.equal(state.resets, 1, 'The retry uses a fresh storage connection');
  state.nextWrite = change => Promise.resolve(change({ revision: 7 }));
  const saved = await save(current => ({ ...current, revision: current.revision + 1 }));
  assert.equal(saved.revision, 8, 'The next save is not queued behind the stalled one');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(state.error, null);
  assert.equal(deps.saveErrorRef.current, null);
  assert.deepEqual(state.applied, [saved]);
  assert.equal(state.saving, 0);
}

// 3. The real photo handler: a stalled photo write ends with a visible message, not a blocked screen.
{
  const { localPhotoErrorMessage } = await load('src/features/cleaner/prepareLocalPhoto.ts');
  const { getMimeType } = await load('src/utils/imageCompression.ts');
  const photoNames = ['getMimeType', 'setPreparingPhotos', 'saveChain', 'crypto', 'withStorageTimeout', 'savePhotoWithDraft', 'key', 'identity', 'taskId',
    'PHOTO_SAVE_TIMEOUT_MS', 'PHOTO_STALLED', 'resetCleanerDatabase', 'applyDraft', 'setPhotoErrors', 'navigator', 'LOCAL_PHOTO_PREFIX', 'localPhotoErrorMessage'];
  const state = { preparing: 0, errors: {}, resets: 0 };
  const deps = {
    getMimeType, setPreparingPhotos: update => { state.preparing = update(state.preparing); }, saveChain: { current: Promise.resolve() },
    crypto: { randomUUID: () => 'photo-1' }, withStorageTimeout, savePhotoWithDraft: () => never(), key: 'owner:task',
    identity: { ownerId: 'owner' }, taskId: 'task', PHOTO_SAVE_TIMEOUT_MS: 15,
    PHOTO_STALLED: 'El móvil ha tardado demasiado en guardar la foto. Comprueba si aparece en el apartado; si no, vuelve a adjuntarla.',
    resetCleanerDatabase: () => { state.resets++; }, applyDraft: () => {}, setPhotoErrors: update => { state.errors = update(state.errors); },
    navigator: {}, LOCAL_PHOTO_PREFIX: 'cleaner-photo:', localPhotoErrorMessage,
  };
  const uploadPhoto = compile(callbacks.uploadPhoto, photoNames)(...photoNames.map(name => deps[name]));
  const photo = new File([new Uint8Array(10)], 'foto.jpg', { type: 'image/jpeg' });
  await assert.rejects(uploadPhoto(photo, 'general.foto'), /tardado demasiado/);
  assert.equal(state.preparing, 0, 'Finishing is no longer blocked by a stalled photo');
  assert.match(state.errors['general.foto'], /vuelve a adjuntarla/);
  assert.equal(state.resets, 1);
  deps.savePhotoWithDraft = async () => ({ report: { id: 'report' } });
  const ok = compile(callbacks.uploadPhoto, photoNames)(...photoNames.map(name => deps[name]));
  const media = await ok(photo, 'general.foto');
  assert.equal(media.file_url, 'cleaner-photo:photo-1');
  assert.deepEqual(state.errors, {}, 'A saved photo clears the previous error');
}

// 4. The open report survives the phone reloading the tab; the photo choice is detected.
const recovery = await load('src/features/cleaner/cleanerSessionRecovery.ts');
{
  const local = memory();
  recovery.rememberOpenTask('owner', 'task-1', 1_000, local);
  assert.equal(recovery.readOpenTask('owner', 2_000, local), 'task-1');
  assert.equal(recovery.readOpenTask('other-account', 2_000, local), null, 'Never reopen another account\'s task');
  assert.equal(recovery.readOpenTask('owner', 1_000 + 6 * 60 * 60_000, local), null, 'Old marks expire');
  recovery.forgetOpenTask(local);
  assert.equal(recovery.readOpenTask('owner', 2_000, local), null);
  local.setItem('limpatex:cleaner-open-task', '{broken');
  assert.equal(recovery.readOpenTask('owner', 2_000, local), null, 'Corrupt data is ignored');
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  assert.doesNotThrow(() => recovery.rememberOpenTask('owner', 'task', 1, throwing), 'Private mode: recovery is optional');
  assert.equal(recovery.readOpenTask('owner', 1, throwing), null);
  assert.doesNotThrow(() => recovery.forgetOpenTask(throwing));
  const tasks = [{ id: 'a_assignment_b', originalTaskId: 'a' }, { id: 'c' }];
  assert.equal(recovery.findOpenTask(tasks, 'a_assignment_b'), tasks[0]);
  assert.equal(recovery.findOpenTask(tasks, 'a'), tasks[0]);
  assert.equal(recovery.findOpenTask(tasks, 'c'), tasks[1]);
  assert.equal(recovery.findOpenTask(tasks, 'missing'), null);

  const session = memory();
  assert.equal(recovery.consumePhotoPickingRestart(1_000, session), false);
  recovery.markPhotoPicking(1_000, session);
  assert.equal(recovery.consumePhotoPickingRestart(2_000, session), true, 'Reload during the camera is reported');
  assert.equal(recovery.consumePhotoPickingRestart(2_000, session), false, 'Reported once');
  recovery.markPhotoPicking(1_000, session);
  assert.equal(recovery.consumePhotoPickingRestart(1_000 + 16 * 60_000, session), false, 'An old mark is not a camera restart');
  recovery.markPhotoPicking(1_000, session);
  recovery.clearPhotoPicking(session);
  assert.equal(recovery.consumePhotoPickingRestart(2_000, session), false, 'A chosen or cancelled photo clears the mark');

  // In a living page, returning from the picker clears the mark.
  const listeners = { window: {}, document: {} };
  const timers = [];
  const previous = { window: globalThis.window, document: globalThis.document, setTimeout: globalThis.setTimeout };
  globalThis.window = { addEventListener: (type, fn) => { listeners.window[type] = fn; }, removeEventListener: type => { delete listeners.window[type]; } };
  globalThis.document = { visibilityState: 'hidden', addEventListener: (type, fn) => { listeners.document[type] = fn; }, removeEventListener: type => { delete listeners.document[type]; } };
  globalThis.setTimeout = fn => { timers.push(fn); return 0; };
  try {
    const picking = memory();
    recovery.markPhotoPicking(5, picking);
    assert.equal(Object.keys(listeners.window).length, 0, 'Listeners wait until after the click');
    timers.forEach(fn => fn());
    listeners.document.visibilitychange();
    assert.equal(picking.data.size, 1, 'Still in the camera: keep the mark');
    globalThis.document.visibilityState = 'visible';
    listeners.window.focus();
    assert.equal(picking.data.size, 0, 'Back in the page: not a restart');
    assert.deepEqual(listeners, { window: {}, document: {} }, 'Listeners are removed');
  } finally {
    globalThis.window = previous.window; globalThis.document = previous.document; globalThis.setTimeout = previous.setTimeout;
  }
}

// 5. Send state after finishing: sent, sending, offline, pending and error with retry.
{
  const { getCleanerSendState, CleanerSendStatus } = await load('src/features/cleaner/CleanerSendStatus.tsx');
  const online = { isOnline: true, isSyncing: false };
  assert.equal(getCleanerSendState(null, online), 'sent', 'Already completed on the server');
  assert.equal(getCleanerSendState({ revision: 4, syncedRevision: 4 }, online), 'sent');
  assert.equal(getCleanerSendState({ revision: 5, syncedRevision: 4 }, { isOnline: false, isSyncing: false }), 'offline');
  assert.equal(getCleanerSendState({ revision: 5, syncedRevision: 4, error: 'x' }, { isOnline: true, isSyncing: true }), 'sending');
  assert.equal(getCleanerSendState({ revision: 5, syncedRevision: 4, error: 'Sin respuesta' }, online), 'error');
  assert.equal(getCleanerSendState({ revision: 5, syncedRevision: 4 }, online), 'pending');
  assert.equal(getCleanerSendState({ revision: 5, syncedRevision: 4 }, null), 'pending');
  const html = props => renderToStaticMarkup(createElement(CleanerSendStatus, props));
  assert.match(html({ state: 'sent' }), /Limpieza enviada/);
  assert.doesNotMatch(html({ state: 'sent', onRetry: () => {} }), /Reintentar envío/);
  assert.match(html({ state: 'offline' }), /Guardada en el móvil, sin enviar.*No borres los datos/);
  assert.match(html({ state: 'sending' }), /Enviando la limpieza/);
  const error = html({ state: 'error', error: 'Esta tarea se ha reasignado.', onRetry: () => {} });
  assert.match(error, /No se ha podido enviar.*Esta tarea se ha reasignado.*Reintentar envío/);
  assert.match(html({ state: 'pending', onRetry: () => {} }), /Pendiente de enviar.*Reintentar envío/);
  assert.doesNotMatch(html({ state: 'pending' }), /Reintentar envío/, 'No retry button while offline');
  assert.match(html({ state: 'error', onRetry: () => {}, retrying: true }), /disabled/);
}

// 6. Image compression never blocks: a decoder that never answers keeps the original photo.
{
  const { compressImage } = await load('src/utils/imageCompression.ts');
  const previous = { Image: globalThis.Image, document: globalThis.document, setTimeout: globalThis.setTimeout, URL: globalThis.URL };
  const canvases = [];
  const images = [];
  let decode = 'never';
  globalThis.document = { createElement: () => { const canvas = { width: 1, height: 1, getContext: () => ({ drawImage: () => {} }), toBlob: callback => setImmediate(() => callback(new Blob(['small'], { type: 'image/jpeg' }))) }; canvases.push(canvas); return canvas; } };
  globalThis.Image = class {
    constructor() { this.width = 4000; this.height = 3000; this.removed = false; images.push(this); }
    set src(value) { this._src = value; if (decode === 'load') setImmediate(() => this.onload()); }
    get src() { return this._src; }
    removeAttribute(name) { if (name === 'src') this.removed = true; }
  };
  const realURL = URL;
  globalThis.URL = { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} };
  globalThis.setTimeout = (fn, ms) => previous.setTimeout(fn, ms === 20_000 ? 5 : ms);
  globalThis.console = Object.assign(Object.create(console), { warn: () => {} });
  try {
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'foto.jpg', { type: 'image/jpeg' });
    const kept = await compressImage(big);
    assert.equal(kept, big, 'Stalled decoder: keep the original instead of blocking the report');
    assert.equal(canvases[0].width, 0, 'Release memory');
    assert.equal(images[0].removed, true);
    decode = 'load';
    const compressed = await compressImage(big, { maxWidth: 1600, maxHeight: 1600 });
    assert.notEqual(compressed, big);
    assert.equal(compressed.type, 'image/jpeg');
    assert.equal(compressed.name, 'foto.jpg');
    assert.equal(canvases[1].width, 0, 'Decoded bitmap released after compression');
    await new Promise(resolve => previous.setTimeout(resolve, 20));
    const small = new File([new Uint8Array(10)], 'small.jpg', { type: 'image/jpeg' });
    assert.equal(await compressImage(small), small);
  } finally {
    globalThis.Image = previous.Image; globalThis.document = previous.document; globalThis.setTimeout = previous.setTimeout; globalThis.URL = realURL;
  }
}

// 7. The screens use the recoverable selection and the photo inputs mark the picker.
for (const file of ['src/features/cleaner/CleanerTasksScreen.tsx', 'src/features/cleaner/CleanerCalendarScreen.tsx']) {
  assert.match(await readFile(file, 'utf8'), /useOpenCleanerTask\(tasks, (data\.)?hasData\)/, file);
}
assert.match(await readFile('src/components/modals/task-report/components/MediaUploadButtons.tsx', 'utf8'), /if \(local\) markPhotoPicking\(\);/);
assert.match(await readFile('src/components/modals/task-report/ChecklistSection.tsx', 'utf8'), /if \(cleanerWork\) markPhotoPicking\(\);\s+fileInputRefs\.current\[key\]\?\.click\(\);/);

console.log('PASS: storage timeouts in the real save/photo handlers, open report and camera-restart recovery, send states, non-blocking compression. No network.');
