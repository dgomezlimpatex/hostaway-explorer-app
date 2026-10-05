import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Render the actual sidebars with local session fixtures; no backend is loaded.
const passthrough = name => `export const ${name}=({children})=>children;`;
const modules = {
  '@/hooks/useRolePermissions': 'export const useRolePermissions=()=>({canAccessModule:()=>true,hasPermission:()=>true,isAdminOrManager:()=>true});',
  '@/hooks/useAuth': 'export const useAuth=()=>({signOut:()=>{},profile:null,user:null});',
  '@/hooks/useIncidents': 'export const useIncidentStats=()=>({data:{pending_limpatex:0}});',
  '@/hooks/useWhatsAppDeliveryHealth': 'export const useWhatsAppDeliveryHealth=()=>({data:{unresolved:0}});',
  '@/components/navigation/GlobalSearch': 'export const GlobalSearch=()=>null;',
  '@/utils/routeV2Access': 'export const isRouteV2Owner=()=>true;',
  '@/components/ui/button': passthrough('Button'),
  '@/components/ui/collapsible': ['Collapsible','CollapsibleContent','CollapsibleTrigger'].map(passthrough).join('\n'),
  '@/components/ui/sidebar': ['Sidebar','SidebarContent','SidebarFooter','SidebarGroup','SidebarGroupContent','SidebarGroupLabel','SidebarMenu','SidebarMenuButton','SidebarMenuItem','SidebarMenuSub','SidebarMenuSubButton','SidebarMenuSubItem'].map(passthrough).join('\n'),
  'react-router-dom': `import React from 'react'; export const useLocation=()=>({pathname:'/inventory'}); export const NavLink=({to,children,className,onClick})=>React.createElement('a',{href:to,className,onClick},children);`,
};
const built = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {DashboardSidebar} from './src/components/dashboard/DashboardSidebar'; import {MobileDashboardSidebar} from './src/components/dashboard/MobileDashboardSidebar'; export const desktop=renderToStaticMarkup(<DashboardSidebar/>); export const mobile=renderToStaticMarkup(<MobileDashboardSidebar onNavigate={()=>{}}/>);`, resolveDir: process.cwd(), loader:'tsx' },
  bundle:true, write:false, platform:'node', format:'esm', packages:'external', jsx:'automatic', metafile:true,
  plugins:[{name:'local-sidebar-fixtures',setup(plugin){
    plugin.onResolve({filter:/.*/}, args=>Object.hasOwn(modules,args.path)?{path:args.path,namespace:'fixture'}:null);
    plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path],loader:'js',resolveDir:process.cwd()}));
  }}],
});
assert(!Object.keys(built.metafile.inputs).some(file=>file.includes('integrations/supabase')));
// Resolve external packages from this repository while keeping the bundle in memory.
const source = built.outputFiles[0].text.replace(/from "([^"]+)"/g, (match, name) => {
  if (name.startsWith('.') || name.startsWith('node:')) return match;
  return `from ${JSON.stringify(import.meta.resolve(name))}`;
});
const rendered = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
for (const variant of ['desktop','mobile']) {
  const html=rendered[variant];
  assert(!html.includes('href="/control-mudas"'), `${variant}: Control de Mudas hidden`);
  assert(!html.includes('href="/lavanderia/gestion"'), `${variant}: Lavandería hidden`);
  assert(!html.includes('Control de Mudas') && !html.includes('Lavandería'));
  for (const href of ['/inventory','/planning','/planning/buildings','/lavanderia/nuevo-sistema','/workers']) {
    assert(html.includes(`href="${href}"`), `${variant}: preserve ${href}`);
  }
}
if (process.argv.includes('--browser')) {
  const {chromium}=await import('@playwright/test');
  const browser=await chromium.launch({headless:true});
  try {
    for (const [variant,width] of [['desktop',1440],['mobile',390]]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const requests=[];
      await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
      await page.setContent(rendered[variant]);
      assert.equal(await page.locator('a[href="/control-mudas"], a[href="/lavanderia/gestion"]').count(),0);
      assert.equal(await page.locator('a[href="/inventory"]').count(),1);
      assert.equal(requests.length,0);
      await page.close();
    }
  } finally {await browser.close();}
}
console.log('Sidebars desktop/mobile: hidden modules and remaining navigation verified with local fixtures.');
