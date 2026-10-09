import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['src/features/cleaner/readCleanerDraft.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'isolated-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/offlineStore$/ }, () => ({ path: 'storage', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const readLocal = (...args) => globalThis.testDraftRead(...args);', loader: 'js' }));
  } }],
});
const { readCleanerDraft } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
try {
  const draft = { key: 'owner:task', revision: 4, report: { notes: 'Saved', checklist_completed: { photo: { media_urls: ['cleaner-photo:example'] } } } };
  globalThis.testDraftRead = async (store, key) => {
    assert.equal(store, 'drafts'); assert.equal(key, draft.key); return draft;
  };
  assert.equal(await readCleanerDraft(draft.key), draft, 'Preserve the saved draft exactly');
  globalThis.testDraftRead = async () => undefined;
  assert.equal(await readCleanerDraft(draft.key), undefined, 'An absent draft permits a new task');
  const failure = new Error('Storage is unavailable');
  globalThis.testDraftRead = async () => { throw failure; };
  await assert.rejects(readCleanerDraft(draft.key), error => error === failure);
  let finishLate;
  globalThis.testDraftRead = () => new Promise(resolve => { finishLate = resolve; });
  await assert.rejects(readCleanerDraft(draft.key, 10), /Reintentar preparación/);
  finishLate(draft);
  globalThis.testDraftRead = async () => draft;
  assert.equal(await readCleanerDraft(draft.key), draft, 'Retry reads storage again without creating or changing a draft');
  console.log('PASS: saved/absent/error/stalled/late draft reads and safe retry; no writes or network.');
} finally { delete globalThis.testDraftRead; }
