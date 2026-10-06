import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Only the cleaner's routes and their static dependencies are prepared offline. */
export function cleanerOfflinePlugin(): Plugin {
  return {
    name: 'limpatex-cleaner-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = new Set<string>();
      const visit = (filename: string) => {
        if (files.has(filename)) return;
        const item = bundle[filename];
        if (!item) return;
        files.add(filename);
        if (item.type === 'chunk') {
          item.imports.forEach(visit);
          const metadata = (item as typeof item & { viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> } }).viteMetadata;
          metadata?.importedCss.forEach(visit);
          metadata?.importedAssets.forEach(visit);
        }
      };
      const routes = new Set(['Index', 'Tasks', 'Calendar', 'Auth', 'AppLayout', 'CleanerTasksScreen', 'CleanerCalendarScreen']);
      Object.values(bundle).forEach(item => {
        if (item.type === 'chunk' && (item.isEntry || routes.has(item.name))) visit(item.fileName);
        if (item.type === 'asset' && /latin-[\w-]*\.woff2$/.test(item.fileName)) visit(item.fileName);
      });
      const assets = [...files].sort().map(file => `/${file}`);
      assets.push('/limpatex-logo.png');
      const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry)?.fileName || '';
      const version = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'cleaner-offline-assets.json', source: JSON.stringify({ version, assets }) });
      this.emitFile({ type: 'asset', fileName: 'cleaner-sw.js', source: `
const CACHE = 'limpatex-cleaner-${version}';
const ASSETS = ${JSON.stringify(assets)};
const ENTRY = ${JSON.stringify(entry)};
const ROUTES = new Set(['/', '/tasks', '/calendar', '/auth']);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const shell = await fetch('/index.html', { cache: 'reload' });
  if (!shell.ok || !(await shell.clone().text()).includes(ENTRY)) throw new Error('Deployment changed during preparation');
  await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
  await cache.put('/index.html', shell);
  // No skipWaiting: keep an open cleaning session on its current app version.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('limpatex-cleaner-') && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && ROUTES.has(url.pathname)) {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(request, { signal: controller.signal });
        if (!response.ok) throw new Error('Navigation unavailable');
        return response;
      } catch (error) {
        const cached = await (await caches.open(CACHE)).match('/index.html');
        if (cached) return cached;
        throw error;
      } finally { clearTimeout(timer); }
    })());
  } else if (ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
  // No API responses, authenticated pages or public laundry tokens in Cache Storage.
});
` });
    },
  };
}
