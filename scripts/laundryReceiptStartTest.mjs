import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the real entry component with local JSX/UI adapters; no network or backend.
const folder = await mkdtemp(join(tmpdir(), 'receipt-start-'));
try {
  const output = join(folder, 'component.mjs');
  await build({
    entryPoints: ['src/components/inventory/LaundryReceiptStart.tsx'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
    plugins: [{ name: 'local-ui', setup(b) {
      b.onResolve({filter: /^(react\/jsx-runtime|lucide-react|@\/components\/ui\/(button|input))$/}, args => ({path: args.path, namespace: 'local'}));
      b.onLoad({filter: /.*/, namespace: 'local'}, args => ({loader: 'js', contents:
        args.path === 'react/jsx-runtime' ? 'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;'
          : args.path === 'lucide-react' ? 'export const ArrowRight="svg",CalendarDays="svg",ClipboardList="svg",History="svg",Info="svg",MapPin="svg",UserRound="svg";'
            : args.path.endsWith('button') ? 'export const Button="button";' : 'export const Input="input";'}));
    }}],
  });
  const { default: Start } = await import(pathToFileURL(output));
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
  const selections = []; let starts = 0;
  const props = { workerName: 'Repartidor de prueba', warehouseName: 'Almacén de prueba', date: '2026-10-13', today: '2026-10-13', pendingDates: [], locked: false, resumeDisabled: false, adminMode: false, onSelectDate: d => selections.push(d), onStart: () => starts++ };
  let tree = Start(props);
  assert.equal(nodes(tree).filter(n => n.type === 'h1').length, 1);
  assert.ok(text(tree).includes(props.workerName));
  assert.ok(text(tree).includes(props.warehouseName));
  assert.equal(nodes(tree).some(n => n.props?.['aria-label'] === 'Recuentos pendientes'), false);
  let input = nodes(tree).find(n => n.type === 'input');
  assert.equal(input.props.max, props.today);
  assert.equal(input.props.value, props.date);
  input.props.onChange({target: {value: '2026-10-11'}});
  nodes(tree).find(n => n.type === 'button' && text(n).includes('Iniciar recuento')).props.onClick();
  assert.equal(starts, 1); assert.deepEqual(selections, ['2026-10-11']);
  tree = Start({...props, date: '2026-10-11', pendingDates: ['2026-10-05', '2026-10-07']});
  assert.ok(text(tree).includes('11 de octubre de 2026'));
  assert.ok(text(tree).includes('se actualizará el stock actual'));
  const buttons = nodes(tree).filter(n => n.type === 'button');
  buttons.find(n => text(n) === 'Volver a hoy').props.onClick();
  buttons.find(n => text(n).includes('5 de octubre')).props.onClick();
  assert.deepEqual(selections, ['2026-10-11', props.today, '2026-10-05']);
  tree = Start({...props, date: '2026-10-11', pendingDates: ['2026-10-05'], locked: true, resumeDisabled: true, adminMode: true});
  assert.equal(nodes(tree).filter(n => n.type === 'h3').length, 1);
  assert.ok(nodes(tree).filter(n => ['input', 'button'].includes(n.type)).every(n => n.props.disabled));
  assert.equal(nodes(tree).find(n => n.type === 'input').props.id, 'receipt-date-admin');
  console.log('receipt-start: fecha, hoy, pendientes, callbacks, bloqueos y encabezado administrativo correctos; sin red.');
} finally { await rm(folder, {recursive: true, force: true}); }
