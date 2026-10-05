import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'staffing-reader-'));
try {
  const outfile = join(dir,'test.mjs');
  await build({ stdin: { contents: `import assert from 'node:assert/strict';import {readStaffingPage,createStaffingPageReader} from './src/features/staffing/readClient';import {calls} from '@/integrations/supabase/client';
  const base={table:'tasks',columns:'id',from:0,to:499};
  await assert.rejects(()=>readStaffingPage({...base,equals:{is_active:true}}),/ámbito/);
  await assert.rejects(()=>readStaffingPage({...base,table:'arbitrary_private_table',equals:{sede_id:'s'}}),/Fuente/);
  await assert.rejects(()=>readStaffingPage({...base,columns:'*',equals:{sede_id:'s'}}),/columnas/);
  assert.equal(calls.length,0);
  await readStaffingPage({...base,equals:{sede_id:'s'}});
  assert.deepEqual(calls,[['from','tasks'],['select','id'],['eq','sede_id','s'],['order','id',{ascending:true}],['range',0,499]]);
  calls.length=0;
  const controller=new AbortController(); controller.abort();
  await assert.rejects(()=>createStaffingPageReader(controller.signal)({...base,equals:{sede_id:'s'}}),/cancelada/);
  assert.equal(calls.length,0,'already-aborted read never starts a query');
  console.log('staffing-read-client-tests: OK (injected SELECT-only client)');`, resolveDir: process.cwd(), loader: 'ts' }, outfile, platform:'node',format:'esm',bundle:true,logLevel:'silent',plugins:[{name:'no-real-client',setup(plugin){plugin.onResolve({filter:/^@\/integrations\/supabase\/client$/},()=>({path:'client',namespace:'fake'}));plugin.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`export const calls=[];const query={then(resolve){resolve({data:[],error:null})}};for(const method of ['select','eq','in','gte','lte','order','range'])query[method]=(...args)=>{calls.push([method,...args]);return query};export const supabase={from(table){calls.push(['from',table]);return query}};`,loader:'js'}));}}] });
  await import(pathToFileURL(outfile).href);
} finally {rmSync(dir,{recursive:true,force:true});}
