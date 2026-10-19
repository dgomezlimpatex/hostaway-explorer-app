// Real nested Radix components and local IndexedDB, without a production client.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

const entry = `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './src/components/ui/dialog';
import {CleanerTaskHeaderActions} from './src/features/cleaner/CleanerTaskHeaderActions';
import * as store from './src/features/cleaner/offlineStore';
window.store=store;
function App(){
  const [open,setOpen]=useState(false),[online,setOnline]=useState(true),[pending,setPending]=useState(false),[panelOpen,setPanelOpen]=useState(false);
  window.setFixtureOnline=setOnline;window.setFixturePending=setPending;
  return <><button onClick={()=>setOpen(true)}>Abrir tarea</button><Dialog open={open} onOpenChange={setOpen}>
    <DialogContent onEscapeKeyDown={e=>{if(panelOpen)e.preventDefault()}} aria-describedby="description"><DialogTitle>Tarea de prueba</DialogTitle><DialogDescription id="description">Limpieza en curso</DialogDescription>
      <CleanerTaskHeaderActions onPanelOpenChange={setPanelOpen} property={{notas:'Indicaciones guardadas'}} propertyName="Piso de prueba" loading={false} showNotes
        status={{isOnline:online,isSyncing:false,pending:pending?1:0,pendingPhotos:pending?1:0,error:null,shellReady:true,shellError:false,sync:async()=>{window.syncCalls++}}}/>
      <button>Continuar limpieza</button>
    </DialogContent></Dialog></>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const built = await build({ stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'}, bundle:true,write:false,
  platform:'browser',format:'iife',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"production"'} });
assert.ok(!Object.keys(built.metafile.inputs).some(path=>path.includes('integrations/supabase/client')), 'No production client');
const html = `<html><body><div id="root"></div><script>window.syncCalls=0;</script><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const executablePath=process.platform==='linux'&&existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined;
const browser=await chromium.launch({headless:true,executablePath});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  const errors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url()==='https://sync-escape.local/'
    ?route.fulfill({contentType:'text/html',body:html}):(unexpected.push(route.request().url()),route.abort()));
  await page.goto('https://sync-escape.local/');
  await page.evaluate(async () => {
    await window.store.writeLocal('drafts',{key:'owner:task',ownerId:'owner',revision:3,syncedRevision:1,finishRequested:false,
      report:{notes:'Nota pendiente',checklist_completed:{extra:{completed:true,media_urls:['cleaner-photo:photo']}}}});
    await window.store.writeLocal('photos',{key:'owner:photo',ownerId:'owner',taskId:'task',id:'photo',file:new Blob(['foto pendiente'],{type:'image/jpeg'})});
  });
  const savedWork=()=>page.evaluate(async()=>({
    draft:await window.store.readLocal('drafts','owner:task'),
    photos:await Promise.all((await window.store.listLocal('photos','owner')).map(async p=>({...p,file:await p.file.text()}))),
  }));
  const before=await savedWork();
  const status=page.getByRole('dialog',{name:'Estado de sincronización',exact:true});
  const task=page.getByRole('dialog',{name:'Tarea de prueba',exact:true});
  for (const online of [true,false]) {
    await context.setOffline(!online);
    await page.evaluate(online=>window.setFixtureOnline(online),online);
    await page.getByRole('button',{name:'Abrir tarea',exact:true}).click();
    for (const pending of [false,true]) {
      await page.evaluate(pending=>window.setFixturePending(pending),pending);
      const trigger=page.getByRole('button',{name:online&&!pending?'Sincronización: Sincronizado':'Sincronización: Sin sincronizar',exact:true});
      await trigger.click();await status.waitFor();
      await page.keyboard.press('Escape');await status.waitFor({state:'hidden'});
      await task.waitFor({state:'visible'});
      await expect(trigger).toBeFocused();
      assert.deepEqual(await savedWork(),before,'Escape preserves pending draft, notes, checklist and photo bytes');
    }
    await page.getByRole('button',{name:'NOTAS',exact:true}).click();
    await page.getByRole('dialog',{name:'Notas del piso',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog',{name:'Notas del piso',exact:true}).waitFor({state:'hidden'});
    await task.waitFor({state:'visible'});
    await expect(page.getByRole('button',{name:'NOTAS',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');await task.waitFor({state:'hidden'});
  }
  assert.equal(await page.evaluate(()=>window.syncCalls),0,'Closing a panel must never request synchronization');
  await context.setOffline(true);await page.reload();
  assert.deepEqual(await savedWork(),before,'Pending work survives reload without coverage');
  assert.equal(await page.evaluate(()=>window.syncCalls),0,'Closing a panel must never request synchronization');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS: nested synchronization and notes Escape; task retained; focus restored; normal task Escape; online/offline; pending draft/photo bytes preserved after offline reload; no sends or external traffic');
} finally { await browser.close(); }

