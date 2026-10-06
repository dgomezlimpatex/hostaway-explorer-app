import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
try {
 for(const width of [390,1440]) {
  const html=await buildOfflinePlanningFixture({scenario:'load'});
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url()==='http://planner.example.test/')return route.fulfill({contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
  await page.goto('http://planner.example.test/');await page.getByRole('button',{name:'Preparar el reparto'}).click();
  for(const id of ['load-0','load-1']) {
   await page.locator(`[data-planner-task-id="${id}"] [data-planner-primary-action]:visible`).click();
   await page.getByRole('button',{name:'Sin asignar Dejar sin asignar'}).click();
   await page.getByRole('button',{name:'Dejar sin asignar',exact:true}).click();
   await page.getByRole('button',{name:'Desasignar la tarea',exact:true}).click();
  }
  expect(await page.evaluate(()=>window.planningQuickWrites || 0)).toBe(0);
  expect(await page.evaluate(()=>window.planningExampleSaved?.count || 0)).toBe(0);
  const save=page.getByRole('button',{name:'Guardar cambios',exact:true});await expect(save).toBeEnabled();
  await page.reload();await page.getByRole('button',{name:'Preparar el reparto'}).click();await expect(save).toBeEnabled();
  await save.click();await expect.poll(()=>page.evaluate(()=>window.planningExampleSaved?.count)).toBe(1);
  const saved=await page.evaluate(()=>window.planningExampleSaved.proposals);
  expect(saved.filter(p=>p.operation==='unassign').map(p=>p.taskId).sort()).toEqual(['load-0','load-1']);
  await page.close();
 }
 for(const action of ['discard','save']) {
  const html=await buildOfflinePlanningFixture();const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='http://planner.example.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://planner.example.test/');await page.getByRole('button',{name:'Preparar el reparto'}).click();
  await page.locator('[data-planner-task-id="proposed-1"] [data-planner-primary-action]:visible').click();await page.getByRole('button',{name:'Sin asignar Dejar sin asignar'}).click();await page.getByRole('button',{name:'Dejar sin asignar',exact:true}).click();
  await page.locator('[data-planning-board] [data-planner-task-id="existing-1"]').click({button:'right'});await page.getByRole('button',{name:'Desasignar la tarea',exact:true}).click();
  expect(await page.evaluate(()=>window.planningQuickWrites || 0)).toBe(0);await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toBeEnabled();
  if(action==='discard'){await page.getByRole('button',{name:'Descartar propuesta'}).click();await page.getByRole('button',{name:'Preparar el reparto'}).click();await expect(page.locator('[data-planning-board] [data-planner-task-id="existing-1"]')).toBeVisible();await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toHaveCount(0);}
  else {await page.evaluate(()=>{window.planningFailNextSave=true});await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(page.getByText('Fallo local simulado',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toBeEnabled();expect(await page.evaluate(()=>window.planningExampleSaved?.count || 0)).toBe(0);await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.planningExampleSaved?.count)).toBe(1);const saved=await page.evaluate(()=>window.planningExampleSaved.proposals);expect(saved).toHaveLength(1);expect(saved[0].operation).toBe('unassign');}
  await page.close();
 }
 expect(errors).toEqual([]);expect(requests).toEqual([]);console.log('planning-pending-unassign-browser: OK (mobile/desktop, no quick writes, two pending withdrawals, reload restore, discard restores original, unassignment-only final save; offline)');
} finally {await browser.close();}
