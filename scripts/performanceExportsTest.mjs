import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

// Serve split modules from memory. This exercises the real dynamic imports and downloads.
const fixtures = {
  '@/hooks/use-toast': 'export const useToast=()=>({toast:message=>window.toasts.push(message)});',
  '@/contexts/SedeContext': "export const useSede=()=>({activeSede:{id:'test'}});",
  '@/integrations/supabase/client': `export const supabase={from(table){const q={select(){return q},eq(){return q},single:async()=>({data:{code:'P-TEST',status:'draft',created_at:'2026-10-19',scheduled_date:null,notes:null},error:null}),then(resolve){return Promise.resolve({data:[{id:'item',product_id:'p',quantity:2,is_property_package:false,inventory_products:{name:'Sábanas'},properties:null}],error:null}).then(resolve)}};return q}};`,
};
const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {useLogisticsReporting} from './src/hooks/useLogisticsReporting';import {usePicklistExport} from './src/hooks/usePicklistExport';
function App(){const r=useLogisticsReporting(),p=usePicklistExport();const rows=[{code:'P-TEST',status:'draft',scheduled_date:null,created_at:'2026-10-19',items_count:1,total_products:2,properties_count:1}],kpis={fillRate:80,onTimeDelivery:90,averagePackingTime:20,productivityScore:80,totalPicklists:1,completedPicklists:0};return <><button onClick={()=>r.exportToExcel(rows,'report-test')}>Report Excel</button><button onClick={()=>r.exportToPDF(rows,kpis,'report-test')}>Report PDF</button><button onClick={()=>p.exportToExcel('test')}>Picklist Excel</button><button onClick={()=>p.exportToPDF('test')}>Picklist PDF</button></>};createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, splitting: true, outdir: '/performance-exports', write: false, platform: 'browser', format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'offline-exports', setup(p) {
  p.onResolve({filter:/.*/},args=>Object.hasOwn(fixtures,args.path)?{path:args.path,namespace:'fixture'}:null);
  p.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path],loader:'js'}));
} }] });
const files = new Map(built.outputFiles.map(file => [basename(file.path), file.text]));
const requested = [], unexpected = [], errors = [];
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext({acceptDownloads:true}), page=await context.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='https://exports.local'){unexpected.push(url.href);return route.abort();}
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script>window.toasts=[]</script><script type="module" src="/stdin.js"></script>'});
    requested.push(url.pathname);
    return files.has(basename(url.pathname))?route.fulfill({contentType:'text/javascript',body:files.get(basename(url.pathname))}):route.abort();
  });
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('https://exports.local/');await page.getByText('Report Excel',{exact:true}).waitFor();
  assert.ok(!requested.some(file=>/xlsx|jspdf/.test(file)),'Export libraries must not be requested at mount');
  for(const [button,suffix] of [['Report Excel','.xlsx'],['Report PDF','.pdf'],['Picklist Excel','.xlsx'],['Picklist PDF','.pdf']]){
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();const download=await pending;
    assert.ok(download.suggestedFilename().endsWith(suffix));assert.equal(await download.failure(),null);
    const bytes=readFileSync(await download.path());
    if(suffix==='.xlsx'){
      const book=XLSX.read(bytes,{type:'buffer'});
      const expected=button.startsWith('Report')?'Picklists':'Información';
      assert.ok(book.SheetNames.includes(expected));
      assert.ok(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets[expected])).includes('P-TEST'));
    }else{assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);}
  }
  assert.ok(requested.some(file=>/xlsx/.test(file)));assert.ok(requested.some(file=>/jspdf/.test(file)));
  assert.equal(requested.filter(file=>/xlsx/.test(file)).length,1,'Reuse the loaded module across both exporters');
  assert.equal(requested.filter(file=>/jspdf/.test(file)).length,1);
  assert.equal(await page.evaluate(()=>window.toasts.some(message=>message.variant==='destructive')),false);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('exports: no eager Excel/PDF requests; four real downloads passed without production traffic');
}finally{await browser.close();}
