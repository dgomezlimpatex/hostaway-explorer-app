// Isolated preview of the real login form. Auth is mocked; no Supabase client is imported.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const result = await build({
  stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { MemoryRouter } from 'react-router-dom'; import { AuthPage } from './src/components/auth/AuthPage'; createRoot(document.getElementById('root')).render(<MemoryRouter><AuthPage /></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'esm', jsx: 'automatic',
  plugins: [{ name: 'isolated-auth', setup(builder) {
    builder.onResolve({ filter: /^@\/hooks\/useAuth$/ }, () => ({ path: 'mock-auth', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'tsx', resolveDir: process.cwd(), contents: `
      import { useState } from 'react';
      import { passwordSignIn } from './src/auth/passwordSignIn';
      const values = new Map();
      const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
      export function useAuth() {
        const [isLoading, setLoading] = useState(false);
        return { user: null, isLoading, signIn: (email, password) => passwordSignIn({ email, storage, setLoading,
          authenticate: async () => {
            await new Promise(resolve => setTimeout(resolve, 250));
            if (password === 'wrong') return { error: { status: 400, code: 'invalid_credentials' } };
            throw { status: 503, message: '{}' };
          }
        }) };
      }
    ` }));
  } }],
});
const script = result.outputFiles[0].text;
if (/qyipyygojlfhdghnraus|supabase\.co/.test(script)) throw new Error('Production dependency leaked into isolated preview');
const cssFile = readdirSync('dist/assets').find(name => /^index-.*\.css$/.test(name));
const css = readFileSync(resolve('dist/assets', cssFile));
const server = createServer((request, response) => {
  if (request.url === '/test.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); }
  else if (request.url === '/test.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba local de acceso</title><link rel="stylesheet" href="/test.css"><div id="root"></div><script type="module" src="/test.js"></script></html>'); }
});
server.listen(8086, '127.0.0.1', () => console.log('Isolated login preview: http://127.0.0.1:8086 (password wrong = invalid credentials; any other = simulated outage)'));
