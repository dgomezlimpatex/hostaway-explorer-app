// Local fixtures only: no network, no Supabase, no real sign-out.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// A minimal hook runtime runs the real hook, its effects and cleanups without a DOM.
const runtime = `
let hooks = [], index = 0, pending = [];
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
export function useRef(value) { const i = index++; if (!(i in hooks)) hooks[i] = { current: value }; return hooks[i]; }
export function useCallback(fn, deps) { const i = index++; const previous = hooks[i]; if (previous && same(previous.deps, deps)) return previous.fn; hooks[i] = { fn, deps }; return fn; }
export function useEffect(effect, deps) {
  const i = index++; const previous = hooks[i];
  if (previous && same(previous.deps, deps)) return;
  pending.push(() => { previous?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; });
}
export function render(hook) { index = 0; pending = []; const result = hook(); pending.forEach(run => run()); return result; }
export function unmount() { hooks.forEach(hook => hook?.cleanup?.()); hooks = []; }
`;
const result = await build({
  stdin: { contents: `export { useSessionTimeout } from './src/hooks/useSessionTimeout'; export { render, unmount } from 'react';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'fixtures', setup(builder) {
    builder.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'fixture' }));
    builder.onResolve({ filter: /useAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onResolve({ filter: /CleanerOfflineProvider$/ }, () => ({ path: 'offline', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: {
      react: runtime,
      auth: 'export const useAuth = () => globalThis.testAuth;',
      offline: 'export const useCleanerOfflineStatus = () => globalThis.testCleaner;',
    }[args.path] }));
  } }],
});
const { useSessionTimeout, render, unmount } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));

const timers = new Map();
let nextTimer = 1;
const listeners = {};
const calls = { signOut: 0, alert: 0, confirm: 0 };
const saved = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document, confirm: globalThis.confirm, alert: globalThis.alert };
globalThis.setTimeout = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
globalThis.document = {
  addEventListener: (type, fn) => { (listeners[type] ||= new Set()).add(fn); },
  removeEventListener: (type, fn) => { listeners[type]?.forEach(item => { if (item === fn) listeners[type] = new Set([...listeners[type]].filter(other => other !== fn)); }); },
};
globalThis.confirm = () => { calls.confirm++; return false; };
globalThis.alert = () => { calls.alert++; };
const user = { id: 'user-1' };
globalThis.testAuth = { user, signOut: () => { calls.signOut++; } };
const delays = () => [...timers.values()].map(timer => timer.ms).sort((a, b) => a - b);
const fire = ms => [...timers.entries()].filter(([, timer]) => timer.ms === ms).forEach(([id, timer]) => { timers.delete(id); timer.fn(); });

try {
  // 1. Management keeps the 25-minute warning and the 30-minute sign-out.
  globalThis.testCleaner = null;
  render(useSessionTimeout);
  assert.deepEqual(delays(), [25 * 60_000, 30 * 60_000]);
  fire(25 * 60_000);
  assert.equal(calls.confirm, 1, 'Management still gets the warning');
  fire(30 * 60_000);
  assert.equal(calls.signOut, 1, 'Management is still signed out after 30 minutes');
  assert.equal(calls.alert, 1);
  unmount();
  assert.equal(timers.size, 0);

  // 2. A cleaner is never signed out for inactivity and gets no blocking warning.
  Object.assign(calls, { signOut: 0, alert: 0, confirm: 0 });
  globalThis.testCleaner = { pending: 0 };
  render(useSessionTimeout);
  assert.equal(timers.size, 0, 'No inactivity timers for cleaners');
  listeners.touchstart?.forEach(fn => fn());
  assert.equal(timers.size, 0, 'Activity does not schedule them either');
  unmount();

  // 3. The cleaner role loads after start-up: the scheduled timers are cancelled,
  //    and a timer that still fires on resume (frozen tab) never signs her out.
  globalThis.testCleaner = null;
  render(useSessionTimeout);
  const scheduled = [...timers.values()];
  assert.equal(scheduled.length, 2);
  globalThis.testCleaner = { pending: 1 };
  render(useSessionTimeout);
  assert.equal(timers.size, 0, 'Cleaner role cancels the inactivity timers');
  scheduled.forEach(timer => timer.fn());
  assert.deepEqual(calls, { signOut: 0, alert: 0, confirm: 0 }, 'A late timer must not sign out or interrupt a cleaner');

  // 4. Leaving cleaner mode restores the management timeout.
  globalThis.testCleaner = null;
  render(useSessionTimeout);
  assert.deepEqual(delays(), [25 * 60_000, 30 * 60_000]);
  unmount();

  // 5. Signed out: nothing is scheduled.
  globalThis.testAuth = { user: null, signOut: () => { calls.signOut++; } };
  render(useSessionTimeout);
  assert.equal(timers.size, 0);
  unmount();
  console.log('PASS: management keeps the 30-minute sign-out; cleaners are never signed out for inactivity, including late role loading and resumed timers.');
} finally {
  Object.assign(globalThis, saved);
  delete globalThis.testAuth; delete globalThis.testCleaner;
}
