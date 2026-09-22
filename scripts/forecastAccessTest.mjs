import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'forecast-access-'));
try {
  for (const mode of ['denied', 'missing-sede', 'allowed', 'other-user']) {
    const filename = join(dir, `${mode}.cjs`);
    const mocks = {
      '@/contexts/SedeContext': `export const useSede=()=>({activeSede:${mode === 'missing-sede' ? 'null' : "{id:'s',nombre:'Sede de prueba'}"},isInitialized:true});`,
      '@/hooks/useRolePermissions': `export const useRolePermissions=()=>({isAdminOrManager:()=>${mode !== 'denied'}});`,
      '@/hooks/useAuth': `export const useAuth=()=>({user:{id:'${mode === 'other-user' ? 'u2' : 'u1'}'}});`,
      '@/components/sede/SedeSelector': 'export const SedeSelector=()=>null;',
      './forecastCompute': 'export const computeForecastAsync=()=>Promise.resolve({});',
      './readClient': 'export const createStaffingPageReader=()=>async()=>{throw Error("Unexpected network")};',
      '@tanstack/react-query': 'export const useQuery=options=>{if(options.queryKey[0] === "staffing-snapshot") globalThis.queryOptions=options;return {isFetching:false,isError:false}};export const useQueryClient=()=>({});',
    };
    const result = await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {MemoryRouter} from 'react-router-dom';import Page from './src/pages/StaffingForecastPage';export const html=renderToStaticMarkup(<MemoryRouter initialEntries={['/staffing-forecast?month=2026-10&horizon=1']}><Page/></MemoryRouter>);export const query=globalThis.queryOptions;export { RULES_VERSION } from './src/features/staffing/forecastContract';`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: filename, loader: { '.css': 'empty' }, metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', plugins: [{ name: 'offline-auth', setup(plugin) { plugin.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'mock' } : null); plugin.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'js' })); } }] });
    assert.ok(!Object.keys(result.metafile.inputs).some(p => p.includes('integrations/supabase')));
    const { html, query, RULES_VERSION } = (await import(pathToFileURL(filename).href)).default;
    if (mode === 'denied') { assert.match(html, /reservada a administración/); assert.equal(query, undefined); }
    else if (mode === 'missing-sede') { assert.match(html, /Selecciona una sede/); assert.equal(query, undefined); }
    else { assert.equal(query.queryKey[1], mode === 'other-user' ? 'u2' : 'u1'); assert.equal(query.queryKey[2], 's'); assert.equal(query.queryKey[3], '2026-09-28'); assert.equal(query.queryKey[4], '2026-11-01'); assert.equal(query.queryKey[5], RULES_VERSION); assert.match(html, /Navegación del previsor/); assert.ok(!/href="\/(workers|calendar|planning-settings)/.test(html)); }
    console.log(`PASS current page access and cache scope: ${mode}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
