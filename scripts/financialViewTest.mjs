import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=mkdtempSync(join(tmpdir(),'financial-view-'));
try {
  await build({entryPoints:['src/features/financial/financialView.ts'],outfile:join(temp,'view.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const {loadFinancialView,saveFinancialView}=await import(pathToFileURL(join(temp,'view.mjs')));
  const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const defaults=loadFinancialView('user:site','2026-10-08');assert.equal(defaults.filters.start,'2026-10-01');assert.equal(defaults.tab,'general');
  const view={filters:{start:'2026-09-01',end:'2026-09-30',clients:['c'],properties:['p'],workers:['w']},tab:'services',profitFilter:'low'};
  saveFinancialView('user:site',view);assert.deepEqual(loadFinancialView('user:site','2026-10-08'),view);
  for(const owner of ['another-user:site','user:another-site'])assert.deepEqual(loadFinancialView(owner,'2026-10-08'),defaults);
  for(const bad of [null,{...view,tab:'unknown'},{...view,profitFilter:'unknown'},{...view,filters:{...view.filters,start:'2026-02-30'}},{...view,filters:{...view.filters,start:'2026-10-01'}},{...view,filters:{...view.filters,clients:null}},{...view,filters:{...view.filters,workers:[1]}}]){values.set('user:site:view',JSON.stringify(bad));assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);}
  values.set('user:site:view','broken json');assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);
  globalThis.sessionStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.doesNotThrow(()=>saveFinancialView('user:site',view));assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);
  delete globalThis.sessionStorage;
  console.log('financial-view: filters/section preservation, account/site isolation, malformed and unavailable session storage passed');
}finally{rmSync(temp,{recursive:true,force:true});}
