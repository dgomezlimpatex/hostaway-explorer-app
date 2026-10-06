import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the real page and bypass hook with local fixtures. No network or database.
const runtime = `
export const state = { slots: [], cursor: 0, rows: [], calls: [], toasts: [], loading: false, error: false, pending: false };
export const useState = initial => {
  const index = state.cursor++;
  if (!(index in state.slots)) state.slots[index] = initial;
  return [state.slots[index], value => { state.slots[index] = typeof value === 'function' ? value(state.slots[index]) : value; }];
};
export const useMemo = fn => fn();
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = 'Fragment';
export const useToast = () => ({ toast: value => state.toasts.push(value) });
export const useAdminClientPortals = () => ({ data: state.rows, isLoading: state.loading, isError: state.error, refetch: () => state.calls.push(['refetch']) });
const mutation = name => ({ isPending: state.pending, variables: { clientId: 'one' }, mutate: args => state.calls.push([name, args]) });
export const useToggleClientPhotosVisibility = () => mutation('photos');
export const useToggleClientReservationCreation = () => mutation('reservations');
export const useToggleClientIncidents = () => mutation('incidents');
export const useCreatePortalAccess = () => mutation('create');
export const useAdminPortalBypass = () => mutation('bypass');
export const ClientReservationHistoryModal = 'HistoryModal';
export const useMutation = options => options;
export const supabase = { functions: { invoke: async (...args) => { state.calls.push(['invoke', ...args]); return state.response; } } };
`;
const components = ['Card','CardContent','Input','Button','Badge','Switch','Dialog','DialogContent','DialogHeader','DialogTitle','DialogDescription','Select','SelectContent','SelectItem','SelectTrigger','SelectValue'];
const icons = ['Search','Copy','Link2','LogIn','Loader2','History','Pencil'];
const plugins = [{ name: 'local-fixtures', setup(builder) {
  builder.onResolve({ filter: /^fixture-runtime$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
  builder.onResolve({ filter: /^react(?:\/jsx-runtime)?$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
  builder.onResolve({ filter: /^@\/components\/ui\// }, () => ({ path: 'components', namespace: 'fixture' }));
  builder.onResolve({ filter: /^lucide-react$/ }, () => ({ path: 'icons', namespace: 'fixture' }));
  builder.onResolve({ filter: /^@\/hooks\// }, () => ({ path: 'runtime', namespace: 'fixture' }));
  builder.onResolve({ filter: /^@\/components\/client-portal\// }, () => ({ path: 'runtime', namespace: 'fixture' }));
  builder.onResolve({ filter: /^@tanstack\/react-query$|^@\/integrations\/supabase\/client$/ }, () => ({ path: 'runtime', namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'runtime' ? runtime
    : (args.path === 'icons' ? icons : components).map(name => `export const ${name} = '${name}';`).join('\n'), loader: 'js' }));
} }];
const outdir = mkdtempSync(join(tmpdir(), 'client-portals-ui-'));
const globals = { window: Object.getOwnPropertyDescriptor(globalThis, 'window'), navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
try {
  const outfile = join(outdir, 'tests.mjs');
  await build({ stdin: { contents: `export {default as Page} from './src/pages/ClientPortalsAdmin'; export {useAdminPortalBypass as Bypass} from './src/hooks/useAdminPortalBypass'; export {state} from 'fixture-runtime';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile,
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', plugins, logLevel: 'silent' });
  const { Page, Bypass, state } = await import(pathToFileURL(outfile).href);
  const navigation = [], copied = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://local.test', assign: url => navigation.push(url) } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => copied.push(text) } } });
  const access = { id: 'access-one', accessPin: '123456', shortCode: 'abc12345', isActive: true, lastAccessAt: null };
  state.rows = [
    { clientId: 'one', clientName: 'Ático Centro', photosVisibleToClient: true, allowReservationCreation: true, allowIncidents: false, access },
    { clientId: 'two', clientName: 'Hotel Norte', photosVisibleToClient: false, allowReservationCreation: false, allowIncidents: true, access: { ...access, id: 'access-two', isActive: false } },
    { clientId: 'three', clientName: 'Sin acceso', photosVisibleToClient: false, allowReservationCreation: true, allowIncidents: false, access: null },
  ];
  const render = () => { state.cursor = 0; return Page(); };
  const nodes = (node, type) => {
    if (node == null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => nodes(item, type));
    if ((node.type === 'Dialog' || node.type === 'HistoryModal') && !node.props.open) return [];
    return [...(node.type === type ? [node] : []), ...nodes(node.props?.children, type)];
  };
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
  const button = (tree, label) => nodes(tree, 'Button').find(node => text(node).trim() === label);
  let tree = render();
  assert.equal(nodes(tree, 'li').length, 3);
  assert.equal(nodes(tree, 'Switch').length, 0, 'options must be hidden until edit');
  assert.equal(nodes(tree, 'Input').length, 1, 'PIN and link must be hidden until share');
  assert.deepEqual(nodes(nodes(tree, 'li')[0], 'Button').map(node => text(node).trim()), ['Compartir acceso','Editar cliente','Historial','Acceder']);
  assert.equal(button(nodes(tree,'li')[1], 'Acceder').props.disabled, true);
  assert.equal(button(nodes(tree,'li')[2], 'Acceder').props.disabled, true);
  assert.equal(button(nodes(tree,'li')[2], 'Compartir acceso').props.disabled, true);
  assert.deepEqual(state.calls, [], 'rendering must not write or generate access');

  button(tree, 'Compartir acceso').props.onClick(); tree = render();
  assert.equal(nodes(tree,'Input').find(node => node.props.id === 'portal-share-link').props.value, 'https://local.test/portal/atico-centro-abc12345');
  assert.equal(nodes(tree,'Input').find(node => node.props.id === 'portal-share-pin').props.value, '123456');
  await button(tree, 'Copiar enlace').props.onClick(); await button(tree, 'Copiar PIN').props.onClick();
  assert.deepEqual(copied, ['https://local.test/portal/atico-centro-abc12345','123456']);
  navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await button(tree, 'Copiar PIN').props.onClick();
  assert.equal(state.toasts.at(-1).variant, 'destructive', 'clipboard failure must not claim success');
  nodes(tree,'Dialog')[0].props.onOpenChange(false);

  button(render(), 'Editar cliente').props.onClick(); tree = render();
  assert.equal(nodes(tree,'Switch').length, 3);
  for (const option of nodes(tree,'Switch')) option.props.onCheckedChange(!option.props.checked);
  assert.deepEqual(state.calls, [['photos',{clientId:'one',enabled:false}],['reservations',{clientId:'one',enabled:false}],['incidents',{clientId:'one',enabled:true}]]);
  state.rows[0] = { ...state.rows[0], photosVisibleToClient: false };
  assert.equal(nodes(render(),'Switch')[0].props.checked, false, 'open edit dialog follows refreshed data');
  nodes(render(),'Dialog')[0].props.onOpenChange(false);
  state.calls = [];
  button(render(),'Historial').props.onClick(); tree = render();
  assert.equal(nodes(tree,'HistoryModal')[0].props.clientId, 'one');
  nodes(tree,'HistoryModal')[0].props.onOpenChange(false);
  button(render(),'Acceder').props.onClick();
  assert.deepEqual(state.calls, [['bypass',{clientId:'one',clientName:'Ático Centro'}]]);
  state.pending = true;
  assert.equal(button(render(),'Abriendo...').props.disabled, true);
  state.pending = false;

  button(nodes(render(),'li')[2], 'Editar cliente').props.onClick();
  button(render(),'Crear acceso').props.onClick();
  assert.deepEqual(state.calls.at(-1), ['create','three']);
  nodes(render(),'Dialog')[0].props.onOpenChange(false);
  nodes(render(),'Input')[0].props.onChange({target:{value:'Hotel'}});
  assert.equal(nodes(render(),'li').length, 1);
  nodes(render(),'Input')[0].props.onChange({target:{value:'missing name'}});
  assert.match(text(render()), /No hay clientes/);
  nodes(render(),'Input')[0].props.onChange({target:{value:''}});
  nodes(render(),'Select')[0].props.onValueChange('inactive');
  assert.equal(text(nodes(render(),'li')[0]).includes('Hotel Norte'), true);
  nodes(render(),'Select')[0].props.onValueChange('missing');
  assert.equal(text(nodes(render(),'li')[0]).includes('Sin acceso'), true);
  nodes(render(),'Select')[0].props.onValueChange('active');
  assert.equal(nodes(render(),'li').length, 1);
  nodes(render(),'Select')[0].props.onValueChange('all');
  nodes(render(),'Select')[1].props.onValueChange('disabled');
  assert.equal(nodes(render(),'li').length, 3);
  state.loading = true; assert.match(text(render()), /Cargando clientes/);
  state.loading = false; state.error = true;
  assert.match(text(render()), /No se pudieron cargar/);
  button(render(),'Reintentar').props.onClick(); assert.deepEqual(state.calls.at(-1), ['refetch']);

  state.calls = [];
  state.response = { data: { bypassToken: 'local token &', shortCode: 'abc12345' }, error: null };
  const bypass = Bypass();
  await bypass.mutationFn({ clientId: 'one', clientName: 'Ático Centro' });
  assert.deepEqual(state.calls, [['invoke','admin-portal-bypass',{body:{clientId:'one'}}]]);
  assert.deepEqual(navigation, ['https://local.test/portal/atico-centro-abc12345?admin_bypass=local%20token%20%26']);
  state.response = { data: null, error: new Error('local failure') };
  await assert.rejects(bypass.mutationFn({clientId:'one',clientName:'Ático Centro'}), /local failure/);
  state.response = { data: {}, error: null };
  await assert.rejects(bypass.mutationFn({clientId:'one',clientName:'Ático Centro'}), /No se pudo generar/);
  assert.equal(navigation.length, 1, 'failed access never navigates');
  console.log('client-portals-admin: local actions, filters, errors and existing admin navigation OK');
} finally {
  for (const [name, descriptor] of Object.entries(globals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
  const resolved = join(tmpdir(), outdir.split(/[\\/]/).at(-1));
  assert.equal(resolved, outdir);
  rmSync(outdir, { recursive: true, force: true });
}
