import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const modules = {
  '@/hooks/useAuth': `export const useAuth=()=>({user:{id:'fixture',email:'fixture@example.invalid'},profile:{full_name:'Usuario de prueba',email:'fixture@example.invalid'},signOut:()=>{throw Error('Unexpected sign out')}});`,
  '@/hooks/useRolePermissions': `export const useRolePermissions=()=>({canAccessModule:()=>true,hasPermission:()=>true,isAdminOrManager:()=>true});`,
  '@/hooks/useIncidents': `export const useIncidentStats=()=>({data:{pending_limpatex:0}});`,
  '@/hooks/useWhatsAppDeliveryHealth': `export const useWhatsAppDeliveryHealth=()=>({data:{unresolved:0}});`,
  '@/hooks/useGlobalSearch': `export const useGlobalSearch=()=>({results:{tasks:[],properties:[],workers:[],clients:[]},isSearching:false,hasResults:false});`,
};
const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {DashboardSidebar} from './src/components/dashboard/DashboardSidebar';import {MobileDashboardSidebar} from './src/components/dashboard/MobileDashboardSidebar';import {SidebarProvider,SidebarInset} from './src/components/ui/sidebar';function Fixture(){const location=useLocation();return <SidebarProvider><DashboardSidebar/><SidebarInset><output aria-label="Ruta actual">{location.pathname}</output><div style={{height:400,width:320}}><MobileDashboardSidebar onNavigate={()=>{}}/></div></SidebarInset></SidebarProvider>;}createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/financial-analysis']}><Fixture/></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, metafile: true, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'sidebar-fixtures', setup(plugin) {
  plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules, args.path) ? { path: args.path, namespace: 'fixture' } : null);
  plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: modules[args.path], loader: 'js' }));
} }], outdir: join(tmpdir(), 'financial-sidebar-fixture') });
assert.ok(!Object.keys(bundle.metafile.inputs).some(file => /src\/(integrations\/supabase|hooks\/use(GlobalSearch|Auth|Incidents|WhatsAppDeliveryHealth|RolePermissions))/.test(file)), 'Operational hooks and production client must not be bundled');
const source = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '');
const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(source, { from: 'src/index.css' });
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.outputFiles.find(file => file.path.endsWith('.js')).text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const executablePath = process.platform === 'linux' && existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'https://sidebar.local.test/' ? route.fulfill({ contentType: 'text/html', body: html }) : (requests.push(route.request().url()), route.abort()));
  await page.goto('https://sidebar.local.test/');
  const sidebar = page.locator('#app-sidebar');
  const search = sidebar.getByRole('button', { name: /Buscar/ });
  for (const height of [1050, 650, 480]) {
    await page.setViewportSize({ width: 1440, height });
    const general = sidebar.locator('[data-sidebar="group-label"]').filter({ hasText: 'General' });
    await general.scrollIntoViewIfNeeded();
    const [searchBox, generalBox] = await Promise.all([search.boundingBox(), general.boundingBox()]);
    assert.ok(searchBox && generalBox && searchBox.y + searchBox.height <= generalBox.y, `Search must not overlap General at height ${height}: ${JSON.stringify({searchBox,generalBox})}`);
    await expect(search).toBeVisible();
    await sidebar.getByRole('link', { name: 'Calendario', exact: true }).click();
    await expect(page.getByLabel('Ruta actual')).toHaveText('/calendar');
    await sidebar.getByRole('link', { name: 'Integraciones · REGISTRO', exact: true }).click();
    await expect(page.getByLabel('Ruta actual')).toHaveText('/integraciones');
  }
  await search.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.screenshot({ path: join(tmpdir(), 'limpatex-sidebar-short.png'), fullPage: true });
  await page.setViewportSize({width:390,height:844});
  const mobile=page.getByLabel('Navegación móvil');
  const mobileSearch=page.getByRole('button',{name:'Buscar en la aplicación',exact:true});
  await mobile.getByText('General',{exact:true}).scrollIntoViewIfNeeded();
  const [mobileSearchBox,mobileGeneralBox]=await Promise.all([mobileSearch.boundingBox(),mobile.getByText('General',{exact:true}).boundingBox()]);
  assert.ok(mobileSearchBox.y+mobileSearchBox.height<=mobileGeneralBox.y,'Mobile search and navigation must not overlap');
  await mobile.getByRole('link',{name:'Calendario',exact:true}).click();
  await expect(page.getByLabel('Ruta actual')).toHaveText('/calendar');
  await mobile.getByRole('link',{name:'Integraciones · REGISTRO',exact:true}).click();
  await expect(page.getByLabel('Ruta actual')).toHaveText('/integraciones');
  await mobileSearch.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  console.log('financial-sidebar: real desktop/mobile navigation and search, short/tall viewports, clickable first/last sections, no overlap and no operational hooks passed');
} finally { await browser.close(); }
