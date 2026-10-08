import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const temp=mkdtempSync(join(tmpdir(),'financial-view-'));
try {
  await build({entryPoints:['src/features/financial/financialView.ts'],outfile:join(temp,'view.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const {loadFinancialView,saveFinancialView,financialMonthRange,selectedFinancialMonth,financialYearRange,selectedFinancialYear}=await import(pathToFileURL(join(temp,'view.mjs')));
  for(const year of ['2024','2026','2027','9999']){const range={start:year+'-01-01',end:year+'-12-31'};assert.deepEqual(financialYearRange(year),range);assert.equal(selectedFinancialYear(range),year);assert.equal(selectedFinancialYear({...range,end:year+'-12-30'}),'');}
  for(const year of ['','0000','26','2026-01','10000','bad'])assert.equal(financialYearRange(year),null);
  for (const [month,end] of [['2026-09','2026-09-30'],['2026-12','2026-12-31'],['2027-01','2027-01-31'],['2026-02','2026-02-28'],['2024-02','2024-02-29']]) {
    const range=financialMonthRange(month);assert.deepEqual(range,{start:month+'-01',end});assert.equal(selectedFinancialMonth(range),month);
    assert.equal(selectedFinancialMonth({...range,start:month+'-02'}),'');
  }
  for (const invalid of ['', '2026-00', '2026-13', '2026-9', '2026-09-01', 'bad']) assert.equal(financialMonthRange(invalid),null);
  assert.equal(selectedFinancialMonth({start:'2026-09-01',end:'2026-10-31'}),'');
  const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const defaults=loadFinancialView('user:site','2026-10-08');assert.equal(defaults.filters.start,'2026-10-01');assert.equal(defaults.tab,'general');
  const view={filters:{start:'2026-09-01',end:'2026-09-30',clients:['c'],properties:['p'],workers:['w']},tab:'services',profitFilter:'low'};
  saveFinancialView('user:site',view);assert.deepEqual(loadFinancialView('user:site','2026-10-08'),view);
  const annualView={...view,tab:'general',filters:{...view.filters,...financialYearRange('2026')},monthlyPeriod:{start:view.filters.start,end:view.filters.end},annualComparison:'incomes'};
  saveFinancialView('annual:site',annualView);assert.deepEqual(loadFinancialView('annual:site','2026-10-08'),annualView,'Annual range, source selection and monthly return range persist');
  for(const bad of [{...annualView,monthlyPeriod:null},{...annualView,monthlyPeriod:{start:'invalid',end:'2026-09-30'}},{...annualView,monthlyPeriod:{start:'2026-10-01',end:'2026-09-30'}},{...annualView,annualComparison:'unknown'}]){values.set('annual:site:view',JSON.stringify(bad));assert.deepEqual(loadFinancialView('annual:site','2026-10-08'),defaults);}
  for(const owner of ['another-user:site','user:another-site'])assert.deepEqual(loadFinancialView(owner,'2026-10-08'),defaults);
  const detailView={...view,tab:'details',drilldown:{concept:'personal',returnFilters:{...view.filters,start:'2026-10-01',end:'2026-10-08'},monthly:true}};
  saveFinancialView('user:site',detailView);assert.deepEqual(loadFinancialView('user:site','2026-10-08'),detailView,'Detail category and return period persist across reload');
  for(const bad of [{...detailView,drilldown:undefined},{...detailView,drilldown:{...detailView.drilldown,concept:'salary'}},{...detailView,drilldown:{...detailView.drilldown,monthly:'yes'}},{...detailView,drilldown:{...detailView.drilldown,returnFilters:{...view.filters,start:'invalid'}}}]){values.set('user:site:view',JSON.stringify(bad));assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);}
  for(const bad of [null,{...view,tab:'unknown'},{...view,profitFilter:'unknown'},{...view,filters:{...view.filters,start:'2026-02-30'}},{...view,filters:{...view.filters,start:'2026-10-01'}},{...view,filters:{...view.filters,clients:null}},{...view,filters:{...view.filters,workers:[1]}}]){values.set('user:site:view',JSON.stringify(bad));assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);}
  values.set('user:site:view','broken json');assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);
  globalThis.sessionStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.doesNotThrow(()=>saveFinancialView('user:site',view));assert.deepEqual(loadFinancialView('user:site','2026-10-08'),defaults);
  delete globalThis.sessionStorage;
  console.log('financial-view: filters/section preservation, account/site isolation, malformed and unavailable session storage passed');
}finally{rmSync(temp,{recursive:true,force:true});}
