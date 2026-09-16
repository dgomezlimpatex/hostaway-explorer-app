import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'staffing-access-'));
try {
  for (const mode of ['denied', 'missing-sede', 'allowed']) {
    const outfile = join(dir, `${mode}.cjs`);
    const modules = {
      '@/contexts/SedeContext': `export const useSede=()=>({activeSede:${mode === 'missing-sede' ? 'null' : "{id:'s',nombre:'Sede de prueba'}"},isInitialized:true});`,
      '@/hooks/useRolePermissions': `export const useRolePermissions=()=>({isAdminOrManager:()=>${mode !== 'denied'}});`,
      '@/hooks/useAuth': "export const useAuth=()=>({user:{id:'u'}});",
      '@/features/staffing/readClient': "export const createStaffingPageReader=()=>()=>{throw new Error('Unexpected data read before explicit request')};",
      '@tanstack/react-query': "export const useQuery=(options)=>{if(options.enabled)throw new Error('Automatic data read');return {isFetching:false,isError:false,data:null}};export const useQueryClient=()=>({cancelQueries:async()=>{}});",
    };
    await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Page from './src/pages/StaffingForecastPage';export const html=renderToStaticMarkup(React.createElement(Page));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile, logLevel: 'silent', plugins: [{ name: 'isolated-auth-hooks', setup(plugin) { plugin.onResolve({filter: /.*/}, args => Object.hasOwn(modules,args.path) ? {path:args.path,namespace:'test-only'} : null); plugin.onLoad({filter: /.*/,namespace:'test-only'},args=>({contents:modules[args.path],loader:'js'})); } }] });
    const {html} = (await import(pathToFileURL(outfile).href)).default;
    if (mode === 'denied') { assert.ok(html.includes('reservada a administración')); assert.ok(!html.includes('Consultar datos')); }
    if (mode === 'missing-sede') { assert.ok(html.includes('Selecciona una sede')); assert.ok(!html.includes('Consultar datos')); }
    if (mode === 'allowed') assert.ok(html.includes('Consultar datos de la sede'));
    console.log(`PASS UI access boundary ${mode}: no reads before explicit request`);
  }
  console.log('staffing-access-tests: OK (UI gate with injected auth, not RLS proof)');
} finally { rmSync(dir,{recursive:true,force:true}); }
