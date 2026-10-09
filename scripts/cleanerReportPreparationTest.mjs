import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

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

// Exercise the real recovery boundary and its click handlers without a DOM.
const boundaryBundle = await build({
  entryPoints: ['src/features/cleaner/CleanerReportErrorBoundary.tsx'], bundle: true, write: false,
  platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external',
  alias: { '@': join(process.cwd(), 'src') }, logLevel: 'silent',
});
const boundaryCode = boundaryBundle.outputFiles[0].text.replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { CleanerReportErrorBoundary } = await import('data:text/javascript;base64,' + Buffer.from(boundaryCode).toString('base64'));
let closed = false;
const child = { type: 'saved-task', props: { taskId: 'same-task' } };
const boundary = new CleanerReportErrorBoundary({ children: child, onClose: () => { closed = true; } });
boundary.setState = change => { boundary.state = { ...boundary.state, ...(typeof change === 'function' ? change(boundary.state) : change) }; };
assert.equal(boundary.render().props.children, child);
const renderError = new Error('Photo could not render');
boundary.state = { ...boundary.state, ...CleanerReportErrorBoundary.getDerivedStateFromError(renderError) };
const elements = function* (value) {
  if (Array.isArray(value)) { for (const item of value) yield* elements(item); }
  else if (value?.props) { yield value; yield* elements(value.props.children); }
};
const retry = [...elements(boundary.render())].find(element => element.props.children === 'Reabrir este reporte');
assert.ok(retry, 'A report failure offers recovery inside the same task');
retry.props.onClick();
assert.equal(boundary.state.error, null);
assert.equal(boundary.state.attempt, 1);
assert.equal(boundary.render().props.children, child, 'Retry preserves the selected task');
assert.equal(closed, false, 'Retry must not return to the task list');
assert.ok(CleanerReportErrorBoundary.getDerivedStateFromError(null).error instanceof Error);

// Execute the actual loading expression, including the guard after read failure.
const modalSource = readFileSync('src/features/cleaner/CleanerTaskReportModal.tsx', 'utf8');
const ast = ts.createSourceFile('modal.tsx', modalSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loading;
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loading') loading = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(loading);
const isLoading = new Function('preparationError', 'loadedLocal', 'identity', 'virtual', 'bundle', `return (${loading});`);
assert.equal(isLoading(null, false, { isLoading: false }, false, { data: {} }), true);
assert.equal(isLoading('Read stalled', false, { isLoading: true }, false, { isLoading: true }), false);
assert.equal(isLoading(null, true, { isLoading: false }, false, { data: {}, isLoading: false }), false);
console.log('PASS: actual report boundary recovery, unchanged task, non-Error exceptions and loading/error transitions.');
