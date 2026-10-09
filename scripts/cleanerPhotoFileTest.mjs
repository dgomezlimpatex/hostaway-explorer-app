import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export { prepareLocalPhoto, localPhotoErrorMessage } from './src/features/cleaner/prepareLocalPhoto';
export { savePhotoWithDraft } from './src/features/cleaner/offlineStore';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const originalChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;
const { prepareLocalPhoto, localPhotoErrorMessage, savePhotoWithDraft } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
globalThis.BroadcastChannel = originalChannel;

const bytes = new Uint8Array(5 * 1024 * 1024 + 17);
for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
const picked = new File([bytes], 'android.jpg', { type: 'image/jpeg' });
const ranges = [];
const slice = picked.slice.bind(picked);
picked.slice = (start, end) => { ranges.push([start, end]); return slice(start, end); };
const owned = await prepareLocalPhoto(picked, 'image/jpeg');
assert.equal(owned instanceof File, false, 'Storage must receive a detached Blob, not the picker File');
assert.notEqual(owned, picked);
assert.equal(owned.type, 'image/jpeg');
assert.deepEqual(new Uint8Array(await owned.arrayBuffer()), bytes);
assert.equal(ranges.length, 3, 'Read large attachments in bounded chunks');
assert.ok(ranges.every(([start, end]) => end - start <= 2 * 1024 * 1024));
const small = new File(['small photo'], 'small.jpg', { type: '' });
assert.equal((await prepareLocalPhoto(small, 'image/jpeg')).type, 'image/jpeg', 'Handle Android files with empty MIME type');
await assert.rejects(prepareLocalPhoto(new Blob([]), 'image/jpeg'), /Vuelve a seleccionarla/);
await assert.rejects(prepareLocalPhoto({ size: 3, slice: () => ({ arrayBuffer: async () => { throw new DOMException('Source gone', 'NotReadableError'); } }) }, 'image/jpeg'), /Vuelve a seleccionarla/);
await assert.rejects(prepareLocalPhoto({ size: 3, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(2) }) }, 'image/jpeg'), /Vuelve a seleccionarla/);
assert.match(localPhotoErrorMessage(new DOMException('Failed to write blobs (InvalidBlob)', 'DataError')), /Foto o Galería/);
assert.match(localPhotoErrorMessage(new DOMException('Full', 'QuotaExceededError')), /espacio/);
assert.match(localPhotoErrorMessage(null), /No se ha guardado/);

// A minimal transactional storage fixture exercises the real save function.
// The browser regression additionally verifies these properties in real IndexedDB.
const rows = { drafts: new Map(), photos: new Map() };
let transactions = 0;
let failWrite = false;
const originalDatabase = globalThis.indexedDB;
const db = {
  transaction() {
    transactions++;
    let aborted = false;
    const pending = [];
    const tx = {
      error: null,
      abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
      objectStore(name) {
        return {
          get(key) {
            const request = {};
            queueMicrotask(() => {
              request.result = structuredClone(rows[name].get(key));
              request.onsuccess?.();
              queueMicrotask(() => {
                if (aborted) return;
                pending.forEach(([store, value]) => rows[store].set(value.key, structuredClone(value)));
                tx.oncomplete?.();
              });
            });
            return request;
          },
          put(value) {
            if (name === 'photos' && (value.file instanceof File || failWrite)) throw new DOMException('Failed to write blobs (InvalidBlob)', 'DataError');
            pending.push([name, value]);
          },
        };
      },
    };
    return tx;
  },
};
globalThis.indexedDB = { open() {
  const request = {};
  queueMicrotask(() => { request.result = db; request.onsuccess?.(); });
  return request;
} };
try {
  const draft = { key: 'owner:task', ownerId: 'owner', revision: 1, finishRequested: false, report: { task_id: 'task', checklist_completed: {} }, subtasks: {}, task: { additionalTasks: [] } };
  rows.drafts.set(draft.key, structuredClone(draft));
  const photo = { key: 'owner:photo', ownerId: 'owner', taskId: 'task', id: 'photo', file: small, mimeType: 'image/jpeg', name: 'small.jpg', checklistItemId: 'general.photo' };
  const saved = await savePhotoWithDraft(draft.key, photo);
  assert.equal(saved.revision, 2);
  assert.deepEqual(saved.report.checklist_completed['general.photo'].media_urls, ['cleaner-photo:photo']);
  assert.equal(saved.report.checklist_completed['general.photo'].completed, true);
  assert.equal(rows.photos.size, 1);
  assert.equal(await rows.photos.get(photo.key).file.text(), 'small photo');
  assert.equal(rows.photos.get(photo.key).file.type, 'image/jpeg');
  const before = structuredClone(rows.drafts.get(draft.key));
  const beforeTransactions = transactions;
  await assert.rejects(savePhotoWithDraft(draft.key, { ...photo, file: { size: 3, slice: () => ({ arrayBuffer: async () => { throw new Error('Expired source'); } }) } }), /Vuelve a seleccionarla/);
  assert.equal(transactions, beforeTransactions, 'Never open a transaction while reading an inaccessible file');
  failWrite = true;
  await assert.rejects(savePhotoWithDraft(draft.key, { ...photo, id: 'failed', key: 'owner:failed' }), /InvalidBlob/);
  assert.deepEqual(rows.drafts.get(draft.key), before, 'Failed transaction must not mark the photo or advance the revision');
  assert.equal(rows.photos.size, 1, 'A failed photo must leave existing evidence intact');
  failWrite = false;
  await assert.rejects(savePhotoWithDraft(draft.key, { ...photo, ownerId: 'other' }));
  assert.deepEqual(rows.drafts.get(draft.key), before, 'Preserve ownership validation');
  console.log('PASS: actual byte detachment, small/large/empty/unreadable files, MIME, bounded chunks, error messages, atomic photo/checklist commit and rollback.');
} finally { globalThis.indexedDB = originalDatabase; }
