import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Runs the real overlap banner with a tiny hook runtime that keeps state
// between renders. No database, session or network.
const runtime = `
let values = [], cursor = 0;
export const reset = () => { cursor = 0; };
export function useState(initial) {
  const i = cursor++;
  if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
  return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }];
}
export const useMemo = f => f(); export const useCallback = f => f; export const useEffect = () => {};
export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } });
export default { createElement };
`;
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { OverlapAlertsBanner } from './src/components/calendar/OverlapAlertsBanner';
    export { reset } from 'react';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  plugins: [{ name: 'runtime', setup(plugin) {
    plugin.onResolve({ filter: /^(react(\/jsx-runtime)?|lucide-react|date-fns(\/locale)?|@\/components\/ui\/badge)$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
      contents: runtime + ['AlertTriangle', 'ChevronDown', 'ChevronRight', 'X', 'Clock', 'Badge'].map(n => `export const ${n}='${n}';`).join('\n') + '\nexport const format=()=>"";export const es={};',
      loader: 'js',
    }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

const find = (node, predicate) => !node || typeof node !== 'object' ? [] : Array.isArray(node)
  ? node.flatMap(child => find(child, predicate))
  : [...(predicate(node) ? [node] : []), ...find(node.props?.children, predicate)];
const render = props => { m.reset(); return m.OverlapAlertsBanner(props); };

const cleaners = [{ id: 'c1', name: 'Ana Prueba' }];
const overlaps = { c1: [
  { id: 'a', property: 'Piso A', date: '2026-10-06', startTime: '10:00', endTime: '12:00' },
  { id: 'b', property: 'Piso B', date: '2026-10-06', startTime: '11:00', endTime: '12:00' },
] };
const props = resetKey => ({ overlapsByCleanerMap: overlaps, cleaners, resetKey });

let tree = render(props('2026-10-06'));
assert.ok(tree, 'banner visible with conflicts');
const hide = find(tree, n => n.props?.['aria-label'] === 'Ocultar avisos')[0];
hide.props.onClick();
assert.equal(render(props('2026-10-06')), null, 'hidden for the same day');
// Regression: hiding it on one day used to hide every later day until reload.
assert.ok(render(props('2026-10-07')), 'the next day shows its conflicts');
assert.ok(render(props('2026-10-05,2026-10-06,2026-10-07')), 'a different view shows its conflicts');
assert.equal(render(props('2026-10-06')), null, 'returning to the hidden day keeps it hidden');
assert.equal(render({ ...props('2026-10-08'), overlapsByCleanerMap: {} }), null, 'no conflicts, no banner');
console.log('calendar-overlap-banner: OK (hide per period, other days and views visible; no network)');
