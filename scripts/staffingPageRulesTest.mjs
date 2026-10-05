import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'staffing-page-rules-'));
const configuredSede = '1e0759ec-5e63-4edd-9dad-e493c715bbba';
const property = 'e0c82e3d-f702-4842-8c34-c987a6fd9c2e';
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Network forbidden in page rules tests'); };
try {
  for (const sede of [configuredSede, 'other-sede']) {
    const outfile = join(dir, `${sede}.cjs`);
    const modules = {
      '@/contexts/SedeContext': `export const useSede=()=>({activeSede:{id:${JSON.stringify(sede)},nombre:'Sede sintética'},isInitialized:true});`,
      '@/hooks/useRolePermissions': 'export const useRolePermissions=()=>({isAdminOrManager:()=>true});',
      '@/hooks/useAuth': "export const useAuth=()=>({user:{id:'u'}});",
      '@/components/sede/SedeSelector': 'export const SedeSelector=()=>null;',
      '@tanstack/react-query': 'export const useQuery=o=>{if(o.enabled)throw Error("unexpected automatic read");globalThis.__staffingQuery=o;return {isFetching:false,isError:false,data:null}};export const useQueryClient=()=>({cancelQueries:async()=>{}});export const useMutation=()=>({mutate:()=>{},mutateAsync:async()=>{}});',
      '@/features/staffing/readClient': `export const createStaffingPageReader=()=>async spec=>{
        globalThis.__staffingReadCount++;
        const day=globalThis.__staffingDay;
        const tables={properties:[{id:'${property}',sede_id:'${sede}',is_active:true,nombre:'Synthetic, not used as identity',duracion_servicio:270,check_out_predeterminado:'11:00',check_in_predeterminado:'17:00'}],
          cleaners:[{id:'w',name:'Synthetic collaborator',sede_id:'${sede}',is_active:true,contract_hours_per_week:0}],
          cleaner_availability:[{id:'slot',cleaner_id:'w',day_of_week:1,is_available:true,start_time:'07:00',end_time:'12:00'}],
          tasks:[{id:'t',sede_id:'${sede}',propiedad_id:'${property}',date:day,status:'pending',type:'limpieza-turistica',duracion:270,start_time:'09:30',end_time:'14:00'}]};
        return (tables[spec.table]||[]).filter(r=>Object.entries(spec.equals||{}).every(([k,v])=>r[k]===v)&&(!spec.within||spec.within.ids.includes(r[spec.within.column]))).slice(spec.from,spec.to+1).map(r=>Object.fromEntries(spec.columns.split(',').map(k=>[k,r[k]])));
      };`,
    };
    const result = await build({ stdin: { contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Page from './src/pages/StaffingForecastPage';globalThis.__staffingReadCount=0;renderToStaticMarkup(React.createElement(Page));export const automaticReads=globalThis.__staffingReadCount;export const request=()=>{globalThis.__staffingDay=globalThis.__staffingQuery.queryKey[3];return globalThis.__staffingQuery.queryFn({signal:new AbortController().signal});};`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile, logLevel: 'silent', metafile: true,
      plugins: [{ name: 'offline-page-query', setup(plugin) { plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(modules,args.path) ? { path: args.path, namespace: 'test-only' } : null); plugin.onLoad({ filter: /.*/, namespace: 'test-only' }, args => ({ contents: modules[args.path], loader: 'js' })); } }],
    });
    assert.ok(!Object.keys(result.metafile.inputs).some(p=>p.endsWith('integrations/supabase/client.ts')));
    const page = (await import(pathToFileURL(outfile).href)).default;
    assert.equal(page.automaticReads, 0);
    const dataset = await page.request();
    assert.equal(dataset.services[0].personMinutes, sede===configuredSede ? 270 : 300, 'actual page query must pass scoped rules into real reader');
    assert.equal(dataset.services[0].kind, sede===configuredSede ? 'fixed' : 'checkout');
    assert.equal(dataset.workers.length, 0, '0-hour worker is excluded in both sedes: availability never creates capacity');
    assert.ok(dataset.issues.some(i => i.code === 'zero-hour-rule-excluded'), 'exclusion is visible in criteria');
  }
  console.log('PASS real page query → site rules → real reader; synthetic data, no automatic reads or cross-sede rules');
} finally { globalThis.fetch = originalFetch; rmSync(dir,{recursive:true,force:true}); }
