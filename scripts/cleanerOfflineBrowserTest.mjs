// Synthetic accounts and a fully intercepted backend: this never writes production.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = process.cwd();
const temporary = await mkdtemp(join(tmpdir(), 'limpatex-cleaner-test-'));
const entry = join(temporary, 'entry.ts');
await writeFile(entry, `import * as store from ${JSON.stringify(join(root,'src/features/cleaner/offlineStore.ts'))};
import * as merge from ${JSON.stringify(join(root,'src/features/cleaner/reportMerge.ts'))};
import { syncCleanerWork } from ${JSON.stringify(join(root,'src/features/cleaner/syncCleanerWork.ts'))};
window.cleanerTest = { ...store, ...merge, syncCleanerWork };`);
await build({ entryPoints: [entry], outfile: join(temporary,'helper.js'), bundle:true, platform:'browser', format:'iife',
  alias: { '@': join(root,'src') }, logLevel:'silent' });
const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.png':'image/png', '.woff2':'font/woff2' };
const server = createServer(async (request,response) => {
  try {
    const pathname = new URL(request.url,'http://localhost').pathname;
    const name = pathname === '/helper.js' ? join(temporary,'helper.js') : resolve(root,'dist', '.' + (extname(pathname) ? pathname : '/index.html'));
    if (!name.startsWith(join(root,'dist')) && name !== join(temporary,'helper.js')) throw new Error('invalid path');
    const body = await readFile(name);
    response.writeHead(200,{'Content-Type':mime[extname(name)] || 'application/octet-stream'}); response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:390,height:844 }, timezoneId:'Europe/Madrid' });
context.setDefaultTimeout(15000);
const page = await context.newPage();
const userId = '10000000-0000-4000-8000-000000000001';
const cleanerId = '20000000-0000-4000-8000-000000000001';
const taskId = '30000000-0000-4000-8000-000000000001';
const sedeId = '40000000-0000-4000-8000-000000000001';
const templateId = '50000000-0000-4000-8000-000000000001';
const propertyId = '60000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const today = new Intl.DateTimeFormat('en-CA',{ timeZone:'Europe/Madrid', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const task = { id:taskId, sede_id:sedeId, cleaner_id:cleanerId, cleaner:'Prueba', property:'Piso de prueba', address:'Dirección de prueba', date:today,
  propiedad_id:propertyId,notes:'Nota específica de la tarea de prueba',
  start_time:'09:00',end_time:'10:00',check_in:'15:00',check_out:'11:00',type:'limpieza',status:'pending',
  additional_tasks:[{id:'extra',text:'Extra de prueba',photoRequired:false,completed:false,addedBy:'coordinacion',addedAt:now}],
  created_at:now,updated_at:now,task_assignments:[],task_reports:[] };
const template = { id:templateId,template_name:'Checklist de prueba',property_type:'limpieza',is_active:true,created_at:now,updated_at:now,
  checklist_items:[{ id:'general',category:'Limpieza',items:[{id:'foto',task:'Foto obligatoria de prueba',required:true,photo_required:true}]}] };
let remoteReport = null;
let media = [];
let writes = 0;
let failWrites = false;
let loseUploadReply = false;
let storedUploads = new Set();
let concurrentEdit = false;
let failCompare = false;
let reassigned = false;
let authFail = false;
let reportDelayMs = 0;
const unexpected = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const mockBackend = async route => {
  const req = route.request(); const url = new URL(req.url());
  if (url.origin === origin) return route.continue();
  if (url.hostname !== 'qyipyygojlfhdghnraus.supabase.co') { unexpected.push(req.url()); return route.abort(); }
  const method = req.method();
  const json = body => route.fulfill({ status:200,contentType:'application/json',body:JSON.stringify(body) });
  if (url.pathname.startsWith('/storage/v1/object/')) {
    if (method === 'POST') {
      writes++;
      if (failWrites) return route.fulfill({ status:503,body:'{"message":"network unavailable"}' });
      if (storedUploads.has(url.pathname)) return route.fulfill({ status:409,contentType:'application/json',body:'{"statusCode":"409","message":"already exists"}' });
      storedUploads.add(url.pathname);
      if (loseUploadReply) { loseUploadReply=false; return route.abort('failed'); }
      return json({Key:url.pathname});
    }
    return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=','base64')});
  }
  if (url.pathname.startsWith('/auth/')) {
    if (authFail) return route.fulfill({status:503,contentType:'application/json',body:'{"message":"temporary unavailable"}'});
    const user={id:userId,email:'prueba@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:now};
    return json(url.pathname.endsWith('/token') ? {access_token:'local-test-token',refresh_token:'local-test-refresh',token_type:'bearer',expires_in:3600,user} : user);
  }
  const endpoint = url.pathname.split('/').pop();
  if (endpoint === 'get_user_role') return json('cleaner');
  if (endpoint === 'get_user_accessible_sedes') return json([sedeId]);
  if (endpoint === 'get_task_assignment_counts') return json(reassigned ? [{task_id:taskId,assignment_count:1}] : []);
  const single = (req.headers().accept || '').includes('vnd.pgrst.object');
  let data = [];
  if (endpoint === 'profiles') data=[{id:userId,email:'prueba@example.invalid',full_name:'Prueba Local'}];
  if (endpoint === 'user_roles') data=[{role:'cleaner'}];
  if (endpoint === 'sedes') data=[{id:sedeId,nombre:'A Coruña',is_active:true}];
  if (endpoint === 'cleaners') data=[{id:cleanerId,name:'Prueba',user_id:userId,is_active:true,email:'prueba@example.invalid'}];
  if (endpoint === 'task_checklists_templates') data=[template];
  if (endpoint === 'properties') data=[{notas:'Indicaciones del piso de prueba',numero_camas:2,numero_camas_pequenas:1,numero_camas_suite:0,numero_sofas_cama:1,numero_banos:2,duracion_servicio:60,numero_sabanas:2,numero_sabanas_pequenas:1,numero_sabanas_suite:0,numero_toallas_grandes:4,numero_toallas_pequenas:4,numero_alfombrines:2,numero_fundas_almohada:4,kit_alimentario:1,cantidad_rollos_papel_higienico:3,cantidad_rollos_papel_cocina:1}];
  if (endpoint === 'tasks') data=[{...task, task_assignments:reassigned ? [{cleaner_id:'another-cleaner'}] : [], task_reports:remoteReport ? [remoteReport] : []}];
  if (endpoint === 'task_reports') data=remoteReport ? [remoteReport] : [];
  if (endpoint === 'task_media') data=media.filter(item => !url.searchParams.has('id') || `eq.${item.id}` === url.searchParams.get('id'));
  if (['POST','PATCH','DELETE'].includes(method)) {
    writes++;
    if (failWrites) return route.fulfill({ status:503,contentType:'application/json',body:'{"message":"network unavailable"}' });
    const body = req.postDataJSON();
    if (endpoint === 'task_reports') {
      if (reportDelayMs) await new Promise(resolve => setTimeout(resolve,reportDelayMs));
      if (method === 'PATCH' && failCompare) return json(single ? null : []);
      if (method === 'PATCH' && url.searchParams.get('updated_at') !== `eq.${remoteReport.updated_at}`) return json(single ? null : []);
      remoteReport={...remoteReport,...body,created_at:remoteReport?.created_at || now,updated_at:new Date().toISOString()}; data=[remoteReport];
      if (method === 'PATCH' && concurrentEdit) {
        concurrentEdit=false;
        await page.evaluate(({userId,taskId}) => window.cleanerTest.changeDraft(`${userId}:${taskId}`,current=>({
          ...current,revision:current.revision+1,report:{...current.report,notes:'Editada durante el envío'},
        })),{userId,taskId});
      }
    } else if (endpoint === 'task_media') { media.push(body); data=[body]; }
    else if (endpoint === 'tasks') { Object.assign(task,body,{updated_at:new Date().toISOString()});data=[task]; }
    else { unexpected.push(`${method} ${endpoint}`); return route.abort(); }
  }
  return json(single ? (data[0] || null) : data);
};
await context.route('**/*',mockBackend);
await context.addInitScript(({userId}) => {
  if (!localStorage.getItem('sb-qyipyygojlfhdghnraus-auth-token')) {
    localStorage.setItem('sb-qyipyygojlfhdghnraus-auth-token',JSON.stringify({ access_token:'local-test-token',refresh_token:'local-test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,user:{id:userId,email:'prueba@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()} }));
  }
}, {userId});
try {
  await page.goto(origin);
  await page.getByText('Tus tareas y checklists de esta semana están descargados en este móvil.',{exact:true}).waitFor({timeout:30000});
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller),null,{timeout:30000});
  assert.equal(writes,0,'Reading dashboard must not start a task');
  await page.goto(origin+'/tasks');
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  await page.getByText('Indicaciones del piso de prueba',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'NOTAS',exact:true}).count(),0,'Notes button is only for started tasks');
  const confirmedIcon = page.getByRole('button',{name:'Sincronización: Sincronizado',exact:true});
  await confirmedIcon.waitFor();
  assert.match(await confirmedIcon.getAttribute('class'),/text-green-/);
  await confirmedIcon.click();
  await page.getByText('Todo tu trabajo está enviado. No hay cambios pendientes.',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'Estado de sincronización',exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByRole('button',{name:'Iniciar limpieza',exact:true}).isVisible(),true,'Closing status keeps the task open');
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-task-header.png'),fullPage:true,animations:'disabled'});
  await page.getByText('Indicaciones del piso de prueba',{exact:true}).waitFor();
  await page.getByText('Nota específica de la tarea de prueba',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Características del piso'}).isVisible(),true);
  assert.equal(await page.getByRole('region',{name:'Textiles y amenities'}).count(),0);
  assert.equal(await page.getByText('Pulsa iniciar cuando empieces la limpieza.',{exact:false}).count(),0);
  assert.equal(writes,0,'Opening property details must not start a task');
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-property-details.png'),fullPage:true,animations:'disabled'});
  await page.goto(origin+'/calendar?date='+today);
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  await page.getByRole('button',{name:'Iniciar limpieza',exact:true}).waitFor();
  await page.getByText('Indicaciones del piso de prueba',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Características del piso'}).isVisible(),true,'Calendar entry shows property information before start');
  assert.equal(await page.getByRole('button',{name:'NOTAS',exact:true}).count(),0);
  assert.equal(writes,0,'Calendar property preview must not start a task');
  await context.setOffline(true);
  await page.reload();
  // A suspended Android storage read must not leave the task spinning forever.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    window.restoreDraftReads = () => { IDBObjectStore.prototype.get = original; };
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'drafts') return {}; // request never emits success/error
      return original.apply(this, args);
    };
  });
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  await page.getByRole('button',{name:'Reintentar preparación',exact:true}).waitFor();
  assert.equal(await page.getByText('Preparando la tarea…',{exact:true}).count(),0,'A stuck local read ends in a recoverable error');
  assert.equal(await page.getByRole('button',{name:'Iniciar limpieza',exact:true}).isDisabled(),true,'Do not start without reading the saved draft');
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-preparation-retry.png'),fullPage:true,animations:'disabled'});
  await page.evaluate(() => window.restoreDraftReads());
  await page.getByRole('button',{name:'Reintentar preparación',exact:true}).click();
  const offlineIcon = page.getByRole('button',{name:'Sincronización: Sin sincronizar',exact:true});
  await offlineIcon.waitFor();
  assert.match(await offlineIcon.getAttribute('class'),/text-red-/);
  await offlineIcon.click();
  await page.getByText('Sin cobertura. Puedes usar la información descargada en este móvil.',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'Estado de sincronización',exact:true}).waitFor({state:'hidden'});
  await page.getByText('Indicaciones del piso de prueba',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Características del piso'}).isVisible(),true,'Property details are downloaded for offline use');
  assert.equal(await page.getByRole('region',{name:'Textiles y amenities'}).count(),0,'Supplies stay hidden offline');
  assert.equal(await page.getByRole('button',{name:'NOTAS',exact:true}).count(),0,'Offline preview also shows notes inline');
  await page.getByRole('button',{name:'Iniciar limpieza',exact:true}).waitFor();
  await context.setOffline(false);
  await page.getByRole('button',{name:'Iniciar limpieza'}).click();
  await page.getByRole('button',{name:'Revisar y finalizar'}).waitFor();
  assert.equal(await page.getByText('Indicaciones del piso de prueba',{exact:true}).count(),0,'Started task moves property details out of checklist');
  await page.getByRole('button',{name:'NOTAS',exact:true}).click();
  await page.getByText('Indicaciones del piso de prueba',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Volver a la tarea',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Revisar y finalizar'}).isDisabled(),true,'Mandatory photo blocks completion');
  await context.setOffline(true);
  assert.equal(await page.getByLabel('Notas de la limpieza').count(),0,'Report notes input is removed');
  assert.equal(await page.getByText('Avance guardado en este móvil',{exact:true}).count(),0,'Redundant footer status is removed');
  // Seed a previously saved note locally: removing the input must preserve old reports.
  await page.addScriptTag({content:await readFile(join(temporary,'helper.js'),'utf8')});
  await page.evaluate(({userId,taskId}) => window.cleanerTest.changeDraft(`${userId}:${taskId}`,current=>({
    ...current,revision:current.revision+1,report:{...current.report,notes:'Nota conservada sin cobertura'},
  })),{userId,taskId});
  await page.reload();
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  await page.getByRole('button',{name:'Revisar y finalizar'}).waitFor();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=','base64');
  await page.addScriptTag({content:await readFile(join(temporary,'helper.js'),'utf8')});
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    window.failPhotoWrite = true;
    window.restorePhotoWrites = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function (value, ...args) {
      // Model Android rejecting picker-backed Files, plus a complete write failure.
      if (this.name === 'photos' && (window.failPhotoWrite || value.file instanceof File)) {
        throw new DOMException('Failed to write blobs (InvalidBlob)', 'DataError');
      }
      return original.call(this, value, ...args);
    };
  });
  await page.locator('input[type=file]').first().setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:png});
  const photoFailure = page.getByText('La foto no está guardada. Vuelve a adjuntarla en el apartado correspondiente; guardar el checklist no recupera esa foto.',{exact:true});
  await photoFailure.waitFor();
  assert.equal(await page.getByRole('button',{name:'Reintentar guardar',exact:true}).count(),0,'A checklist retry cannot recover a failed photo');
  assert.equal(await page.evaluate(owner => window.cleanerTest.listLocal('photos',owner).then(items=>items.length),userId),0,'Failed photo transaction leaves no photo');
  const failedDraft = await page.evaluate(({userId,taskId}) => window.cleanerTest.readLocal('drafts',`${userId}:${taskId}`),{userId,taskId});
  assert.equal(failedDraft.report.checklist_completed['general.foto']?.media_urls?.length || 0,0,'Failed photo must not mark its checklist item');
  await page.getByRole('button',{name:/Extra de prueba/}).click();
  await page.getByText('Guardando en el móvil…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await photoFailure.isVisible(),true,'Saving another checklist item must not hide the missing photo');
  await page.getByRole('button',{name:/Extra de prueba/}).click();
  await page.getByText('Guardando en el móvil…',{exact:true}).waitFor({state:'hidden'});
  await page.evaluate(() => { window.failPhotoWrite = false; });
  // Inject a render failure at the local-photo preview, after the photo is saved.
  // This models a React/DOM failure without inventing Carlos's unknown exception.
  await page.evaluate(() => {
    const original = String.prototype.startsWith;
    window.restorePhotoRendering = () => { String.prototype.startsWith = original; };
    String.prototype.startsWith = function (search, ...args) {
      if (search === 'cleaner-photo:' && original.call(this, search)) throw new Error('Synthetic photo render failure');
      return original.call(this, search, ...args);
    };
  });
  await page.locator('input[type=file]').first().setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Reabrir este reporte',exact:true}).waitFor();
  assert.equal(await page.getByText('Error al cargar la página',{exact:true}).count(),0,'Photo render errors must stay inside the selected task');
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-report-recovery.png'),fullPage:true,animations:'disabled'});
  await page.evaluate(() => window.restorePhotoRendering());
  await page.getByRole('button',{name:'Reabrir este reporte',exact:true}).click();
  await page.getByText('1 foto(s)',{exact:true}).waitFor();
  await page.evaluate(() => window.restorePhotoWrites());
  assert.equal(await photoFailure.count(),0,'Reselecting a readable photo clears its failure');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).some(img => img.src.startsWith('blob:') && img.complete && img.naturalWidth > 0));
  await page.getByRole('button',{name:/Extra de prueba/}).click();
  await page.getByText('Guardando en el móvil…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByLabel('Notas de la limpieza').count(),0);
  assert.equal(await page.getByText('Avance guardado en este móvil',{exact:true}).count(),0);
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-report-no-notes.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Revisar y finalizar'}).click();
  await page.getByText('Tiempo Real del Servicio',{exact:true}).waitFor();
  await page.getByText('Hora de Finalización',{exact:true}).waitFor();
  assert.equal(await page.getByText('Resumen de la limpieza',{exact:true}).count(),0);
  assert.equal(await page.getByText('Revisa antes de finalizar',{exact:true}).count(),0);
  assert.equal(await page.getByText('Limpieza finalizada',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Finalizar limpieza',exact:true}).count(),0);
  await page.addScriptTag({content:await readFile(join(temporary,'helper.js'),'utf8')});
  const finished = await page.evaluate(owner => window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.equal(finished.report.overall_status,'completed','One click completes the report offline');
  assert.equal(finished.finishRequested,true);
  assert.ok(finished.report.end_time,'One click records the end time');
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-final-time-only.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Volver a mis tareas'}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.reload();
  await page.getByText('Piso de prueba',{exact:true}).first().waitFor({timeout:20000});
  assert.match(await page.locator('body').innerText(), /Sin cobertura/);
  await page.addScriptTag({content:await readFile(join(temporary,'helper.js'),'utf8')});
  let saved = await page.evaluate(async ownerId => {
    const drafts=await window.cleanerTest.listLocal('drafts',ownerId);
    const photos=await window.cleanerTest.listLocal('photos',ownerId);
    return {draft:drafts[0],photoCount:photos.length,size:photos[0]?.file.size};
  },userId);
  assert.equal(saved.draft.finishRequested,true);
  assert.equal(saved.draft.report.notes,'Nota conservada sin cobertura');
  assert.equal(saved.photoCount,1); assert.ok(saved.size > 0);
  assert.ok(saved.draft.revision > saved.draft.syncedRevision);
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  await page.getByRole('button',{name:'Volver a mis tareas'}).waitFor();
  await page.getByText('Tiempo Real del Servicio',{exact:true}).waitFor();
  assert.equal(await page.getByText('Resumen de la limpieza',{exact:true}).count(),0);
  const reopened = await page.evaluate(owner => window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.equal(reopened.report.end_time,finished.report.end_time,'Reopening retains the original end time');
  await page.screenshot({path:join(temporary,'mobile-offline.png'),fullPage:true,animations:"disabled"});
  if (process.env.CLEANER_SCREENSHOT_DIR) await page.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'mobile-offline.png'),fullPage:true,animations:"disabled"});
  await page.getByRole('button',{name:'Volver a mis tareas'}).click();
  await page.evaluate(() => Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}));
  failWrites=true; await context.setOffline(false);
  await page.evaluate(owner => window.cleanerTest.syncCleanerWork(owner),userId);
  saved=await page.evaluate(owner => window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.ok(saved.revision > saved.syncedRevision); assert.ok(saved.error);
  failWrites=false; loseUploadReply=true;
  await page.evaluate(owner => window.cleanerTest.syncCleanerWork(owner),userId);
  await page.getByText('Piso de prueba',{exact:true}).first().click();
  const retryIcon = page.getByRole('button',{name:'Sincronización: Sin sincronizar',exact:true});
  await retryIcon.waitFor();
  reportDelayMs=800;
  await retryIcon.click();
  await page.getByRole('dialog',{name:'Estado de sincronización',exact:true}).getByRole('button',{name:'Reintentar envío',exact:true}).click();
  const sendingIcon = page.locator('[data-work-state="sending"]');
  await sendingIcon.waitFor();
  assert.match(await sendingIcon.getAttribute('class'),/text-blue-/);
  await page.getByText('Estamos enviando tus cambios. Mantén la app abierta un momento.',{exact:true}).waitFor();
  await page.getByText('Todo tu trabajo está enviado. No hay cambios pendientes.',{exact:true}).waitFor();
  reportDelayMs=0;
  assert.equal(await page.locator('[data-work-state="confirmed"]').isVisible(),true);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog',{name:'Estado de sincronización',exact:true}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Volver a mis tareas',exact:true}).click();
  saved=await page.evaluate(owner => window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.equal(saved.revision,saved.syncedRevision,'Only confirmed work may be acknowledged');
  assert.equal(remoteReport.overall_status,'completed'); assert.equal(task.status,'completed');
  assert.equal(remoteReport.notes,'Nota conservada sin cobertura','Existing report notes remain intact');
  assert.equal(task.additional_tasks[0].completed,true,'Offline extra tasks are confirmed with the report');
  assert.equal(media.length,1); assert.equal(storedUploads.size,1,'Uncertain retry must not duplicate photos');
  const writesBefore=writes;
  await page.evaluate(owner => window.cleanerTest.syncCleanerWork(owner),userId);
  assert.equal(writes,writesBefore,'Confirmed work must not be sent again');
  await page.evaluate(({userId,taskId}) => window.cleanerTest.changeDraft(`${userId}:${taskId}`,current=>({
    ...current,revision:current.revision+1,report:{...current.report,notes:'Primera edición'},
  })),{userId,taskId});
  concurrentEdit=true;
  await page.evaluate(owner=>window.cleanerTest.syncCleanerWork(owner),userId);
  saved=await page.evaluate(owner=>window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.equal(saved.report.notes,'Editada durante el envío');
  assert.ok(saved.revision > saved.syncedRevision,'Acknowledgment must retain concurrent edits');
  failCompare=true;
  await page.evaluate(owner=>window.cleanerTest.syncCleanerWork(owner),userId);
  saved=await page.evaluate(owner=>window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.ok(saved.revision > saved.syncedRevision);assert.ok(saved.error);
  failCompare=false;reassigned=true;
  const beforeReassigned=writes;
  await page.evaluate(owner=>window.cleanerTest.syncCleanerWork(owner),userId);
  saved=await page.evaluate(owner=>window.cleanerTest.listLocal('drafts',owner).then(items=>items[0]),userId);
  assert.match(saved.error,/reasignado/);assert.equal(writes,beforeReassigned,'Canonical reassignment forbids sending, even with old cleaner_id');
  reassigned=false;
  await page.evaluate(owner=>window.cleanerTest.syncCleanerWork(owner),userId);
  assert.equal(remoteReport.notes,'Editada durante el envío');
  assert.deepEqual(await page.evaluate(()=>window.cleanerTest.listLocal('drafts','another-account')),[]);
  const storageChecks=await page.evaluate(async ({userId,taskId}) => {
    const t=window.cleanerTest;const draft=await t.readLocal('drafts',`${userId}:${taskId}`);
    let rejected=false;
    try { await t.savePhotoWithDraft(draft.key,{key:'other:id',ownerId:'other',taskId,id:'id',file:new Blob(['photo']),mimeType:'image/jpeg',capturedAt:new Date().toISOString()}); } catch { rejected=true; }
    const lease=await t.acquireSyncLease(userId,'one');const second=await t.acquireSyncLease(userId,'two');await t.releaseSyncLease(userId,'one');
    const old=({...draft,key:`${userId}:old-unsent`,task:{...draft.task,id:'old-unsent'},report:{...draft.report,task_id:'old-unsent',end_time:'2020-01-01T00:00:00Z'},revision:2,syncedRevision:1});
    await t.writeLocal('drafts',old);
    await t.writeLocal('drafts',{...old,key:`${userId}:old-confirmed`,report:{...old.report,task_id:'old-confirmed'},revision:1,syncedRevision:1});
    await t.pruneConfirmedCleanerWork(userId);
    return {rejected,lease,second,unsent:Boolean(await t.readLocal('drafts',old.key)),confirmed:Boolean(await t.readLocal('drafts',`${userId}:old-confirmed`))};
  },{userId,taskId});
  assert.deepEqual(storageChecks,{rejected:true,lease:true,second:false,unsent:true,confirmed:false});
  await page.evaluate(async owner=>{
    const t=window.cleanerTest;
    await t.changeDraft(`${owner}:old-unsent`,current=>({...current,syncedRevision:current.revision}));
    await t.pruneConfirmedCleanerWork(owner);
  },userId);
  const mergeChecks=await page.evaluate(() => {
    const t=window.cleanerTest;
    const base={checklist_completed:{a:{completed:false}},notes:'',overall_status:'in_progress'};
    const local={...base,checklist_completed:{a:{completed:true}},notes:'local'};
    const remote={...base,checklist_completed:{...base.checklist_completed,b:{completed:true}},overall_status:'completed'};
    const merged=t.mergeCleanerReport(base,local,remote);
    let conflicts=false;try{t.mergeCleanerReport(base,local,{...remote,notes:'other'});}catch{conflicts=true;}
    let unresolved=false;try{t.resolveChecklistPhotos({a:{media_urls:['cleaner-photo:missing']}},[],true);}catch{unresolved=true;}
    return {merged,conflicts,unresolved};
  });
  assert.equal(mergeChecks.merged.overall_status,'completed');assert.equal(mergeChecks.merged.checklist_completed.b.completed,true);
  assert.equal(mergeChecks.conflicts,true);assert.equal(mergeChecks.unresolved,true);
  const loginContext=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Europe/Madrid'});
  await loginContext.route('**/*',mockBackend);
  const loginPage=await loginContext.newPage();
  loginPage.on('pageerror',error=>errors.push(error.message));
  await loginPage.goto(origin+'/auth');
  await loginPage.getByLabel('Email',{exact:true}).fill('prueba@example.invalid');
  await loginPage.getByLabel('Contraseña',{exact:true}).fill('PruebaLocal123!');
  await loginPage.getByRole('button',{name:/Iniciar sesión/i}).click();
  await loginPage.getByText('Tus tareas y checklists de esta semana están descargados en este móvil.',{exact:true}).waitFor({timeout:20000});
  await loginPage.goto(origin+`/calendar?date=${today}&taskId=${taskId}`);
  await loginPage.getByRole('button',{name:'Volver a mis tareas'}).waitFor({timeout:20000});
  if (process.env.CLEANER_SCREENSHOT_DIR) await loginPage.screenshot({path:join(process.env.CLEANER_SCREENSHOT_DIR,'desktop-report.png'),fullPage:true,animations:"disabled"});
  await loginContext.close();
  await context.setOffline(true);
  await page.evaluate(()=>{
    const key='sb-qyipyygojlfhdghnraus-auth-token';const session=JSON.parse(localStorage.getItem(key));
    session.expires_at=Math.floor(Date.now()/1000)-3600;localStorage.setItem(key,JSON.stringify(session));
  });
  await page.reload();
  await page.getByText('Piso de prueba',{exact:true}).first().waitFor({timeout:20000});
  assert.match(await page.locator('body').innerText(),/Sin cobertura/,'An expired persisted session can still open its own cached work offline');
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors.filter(message => !message.includes('Synthetic photo render failure')),[]);
  console.log('PASS: cleaner mobile flow, required photos, offline reload/photos, failed sync, uncertain upload retry, idempotency, concurrent edits, failed CAS, canonical reassignment, account isolation, lease, safe pruning, merge conflicts, real service worker. No production access.');
} catch (error) {
  console.error('Browser text:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,3500));
  console.error('Page errors:',errors); throw error;
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + '/') || resolve(temporary).startsWith(resolve(tmpdir()) + '\\'));
  assert.ok(temporary.includes('limpatex-cleaner-test-'));
  await rm(temporary,{recursive:true,force:true});
}
