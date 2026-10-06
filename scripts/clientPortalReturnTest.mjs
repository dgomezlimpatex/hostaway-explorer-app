import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Render the real portal page with local session fixtures, without backend calls.
const runtime = `
export const fixture = { session: null, checking: false, error: null, calls: [] };
let cursor = 0;
export const reset = () => { cursor = 0; };
export const useState = () => { const value = [fixture.session, fixture.checking, fixture.error][cursor++]; return [value, () => fixture.calls.push('session changed')]; };
export const useEffect = () => {};
export const jsx = (type, props) => ({ type, props });
export const jsxs = jsx;
export const Fragment = 'Fragment';
export const Link = 'ReturnLink';
export const useParams = () => ({ identifier: 'cliente-abc12345' });
export const useSearchParams = () => [new URLSearchParams()];
export const useVerifyPortalShortCode = () => ({ data: { clientName: 'Cliente de ejemplo' }, isLoading: false });
export const useVerifyPortalToken = () => ({ data: null, isLoading: false });
export const useAuthenticatePortal = () => ({ isPending: false, mutateAsync: () => fixture.calls.push('authenticate') });
export const extractShortCodeFromIdentifier = () => 'abc12345';
export const supabase = {};
export const ClientPortalAuth = 'PinForm';
export const ClientPortalDashboard = 'Dashboard';
export const ArrowLeft = 'ArrowLeft';
export const Loader2 = 'Loader2';
export const AlertCircle = 'AlertCircle';
export const ShieldCheck = 'ShieldCheck';
`;
const outdir = mkdtempSync(join(tmpdir(), 'portal-return-'));
try {
  const outfile = join(outdir, 'page.mjs');
  await build({ stdin: { contents: `export {default as Page} from './src/pages/ClientPortal'; export {fixture, reset} from 'fixture';`, resolveDir: process.cwd(), loader: 'tsx' }, outfile,
    bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', plugins: [{ name: 'local-fixtures', setup(builder) {
      builder.onResolve({ filter: /^fixture$|^react(?:\/jsx-runtime)?$|^react-router-dom$|^lucide-react$|^@\/hooks\/useClientPortal$|^@\/integrations\/supabase\/client$|^@\/components\/client-portal\// }, () => ({ path: 'runtime', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: runtime, loader: 'js' }));
    } }] });
  const { Page, fixture, reset } = await import(pathToFileURL(outfile).href);
  const render = () => { reset(); return Page(); };
  const find = (node, type) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(item => find(item, type))
    : [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
    : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
  fixture.session = { clientId: 'one', clientName: 'Cliente de ejemplo', isAdminBypass: true };
  const admin = render();
  const links = find(admin, 'ReturnLink');
  assert.equal(links.length, 1);
  assert.equal(links[0].props.to, '/admin/client-portals');
  assert.equal(text(links[0]).trim(), 'Volver a portales de clientes');
  assert.equal(links[0].props.target, undefined, 'return stays in the current tab');
  assert.equal(links[0].props.onClick, undefined, 'return uses ordinary routing, without logout or session changes');
  assert.equal(find(admin, 'Dashboard')[0].props.clientId, 'one');
  assert.deepEqual(fixture.calls, []);
  fixture.session.isAdminBypass = false;
  assert.equal(find(render(), 'ReturnLink').length, 0, 'client PIN sessions have no admin return link');
  assert.equal(find(render(), 'Dashboard').length, 1);
  fixture.session = null;
  assert.equal(find(render(), 'ReturnLink').length, 0);
  assert.equal(find(render(), 'PinForm').length, 1);
  fixture.checking = true;
  assert.equal(find(render(), 'ReturnLink').length, 0);
  assert.equal(find(render(), 'PinForm').length, 0);
  fixture.checking = false; fixture.error = 'Acceso expirado';
  assert.match(text(render()), /Acceso de administrador no válido/);
  assert.equal(find(render(), 'ReturnLink').length, 0);
  assert.deepEqual(fixture.calls, [], 'rendering never changes credentials or data');
  console.log('portal-return: admin-only link, same-tab route, client/loading/error regressions OK');
} finally {
  assert.equal(join(tmpdir(), outdir.split(/[\\/]/).at(-1)), outdir);
  rmSync(outdir, { recursive: true, force: true });
}
