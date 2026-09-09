import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const bundle = await build({
  stdin:{contents:`import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import Page from './src/pages/LaundryRouteV2Management';
    createRoot(document.getElementById('root')).render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><Page /></QueryClientProvider></MemoryRouter>);`,resolveDir:process.cwd(),loader:'tsx'},
  bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
  plugins:[{name:'local-data-only',setup(builder){
    builder.onResolve({filter:/contexts\/SedeContext$|hooks\/useAuth$|LaundryPreparationTimings$|integrations\/supabase\/client$/},args=>({path:args.path,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:
      args.path.endsWith('SedeContext') ? 'export const useSede=()=>({activeSede:{id:"test"}});' :
      args.path.endsWith('useAuth') ? 'export const useAuth=()=>({user:null});' :
      args.path.endsWith('LaundryPreparationTimings') ? 'export const LaundryPreparationTimings=()=>null;' :
      'export const supabase={functions:{invoke:async()=>({data:{success:true,links:[window.fixture]},error:null})}};'
    }));
  }}],
});
const css=readdirSync('dist/assets').filter(name=>name.endsWith('.css')).map(name=>readFileSync(`dist/assets/${name}`,'utf8')).join('\n');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try {
  for(const width of [390,1100]) {
    for(const [previous,next] of [[3,15],[0,0],[undefined,undefined]]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setContent('<div id="root"></div>');
      await page.addStyleTag({content:css});
      await page.evaluate(({previous,next})=>{window.fixture={id:'test',token:'test',deliveryDate:'2026-09-09',nextDeliveryDate:'2026-09-11',routeName:'Miércoles',sync_status:'ok',last_synced_at:'2026-09-09T11:00:00Z',totalBags:47,pendingPreparationCount:previous,nextPendingPreparationCount:next};},{previous,next});
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      const summary=page.locator('[data-laundry-bag-summary]');await summary.waitFor();
      const cards=summary.locator(':scope > div');assert.equal(await cards.count(),3);
      const cardText=async(index)=>(await cards.nth(index).innerText()).replace(/\n+/g,'\n');
      assert.equal(await cardText(0),`BOLSAS TOTALES\n${(previous??0)+(next??0)} por preparar`);
      assert.equal(await cardText(1),`BOLSAS DEL DÍA ANTERIOR\n${previous??0} pendientes`);
      assert.equal(await cardText(2),`BOLSAS PARA LA SIGUIENTE RUTA\n${next??0} por preparar`);
      assert.equal(await page.getByText('47 bolsas',{exact:true}).count(),0,'Do not mix all included tasks with pending counts');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      assert.deepEqual(errors,[]);
      if(previous===3) await page.screenshot({path:`${process.env.TEMP}/laundry-summary-${width}.png`,fullPage:true});
      await page.close();
    }
    console.log(`PASS ${width}px: three blocks, correct total, zero/missing counts, no overflow`);
  }
} finally {await browser.close();}
