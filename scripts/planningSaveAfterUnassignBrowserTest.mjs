import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture({scenario:'load',delayedQuickRefresh:true});
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url()==='http://planner.example.test/')return route.fulfill({contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
  await page.goto('http://planner.example.test/');await page.getByRole('button',{name:'Preparar el reparto'}).click();
  for(const id of ['load-0','load-1']) {
   await page.locator(`[data-planner-task-id="${id}"] [data-planner-primary-action]:visible`).click();
   await page.getByRole('button',{name:'Sin asignar Dejar sin asignar'}).click();
   await page.getByRole('button',{name:'Dejar sin asignar',exact:true}).click();
   await page.getByRole('button',{name:'Desasignar la tarea',exact:true}).click();
   await page.getByRole('button',{name:'Sí, quitar asignación',exact:true}).click();
  }
  // Both successful saves return before their shared refresh, as can happen on a slow connection.
  await page.evaluate(()=>window.planningExampleRefresh());
  await expect(page.getByText('Los datos cambiaron.',{exact:true})).toHaveCount(0);
  const save=page.getByRole('button',{name:/Guardar \d+ y avisar/});
  await expect(save).toBeEnabled();await save.click();
  await expect.poll(()=>page.evaluate(()=>window.planningExampleSaved?.count)).toBe(1);
  const saved=await page.evaluate(()=>window.planningExampleSaved.proposals);
  expect(saved.some(p=>['load-0','load-1'].includes(p.taskId))).toBe(false);
  await page.close();
 }
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('planning-save-after-unassign-browser: OK (two workers, delayed combined refresh, draft retained, save enabled; desktop/mobile offline)');
} finally {await browser.close();}
