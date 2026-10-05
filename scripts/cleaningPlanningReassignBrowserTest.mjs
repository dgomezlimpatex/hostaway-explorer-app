import { chromium, expect } from '@playwright/test';
import { buildOfflinePlanningFixture } from './cleaningPlanningFixtureBuild.mjs';

const browser = await chromium.launch({headless:true});
const errors = [], requests = [];
try {
  for (const width of [390,1440]) {
    const html = await buildOfflinePlanningFixture();
    const page = await browser.newPage({viewport:{width,height:900},timezoneId:'Europe/Madrid',reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      if(route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url());return route.abort();
    });
    await page.goto('http://planner.example.test/');
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    // Keep another manual change while a saved task is unassigned and placed again.
    await page.locator('[data-planner-task-id="proposed-1"] [data-planner-primary-action]:visible').click();
    await page.locator('#placement-start-time').fill('12:30');
    await page.getByRole('button',{name:'Aplicar al borrador'}).click();
    await page.locator('[data-planner-task-id="existing-1"] [data-planner-primary-action]:visible').click();
    await page.getByRole('button',{name:'Sin asignar Dejar sin asignar'}).click();
    await page.getByRole('button',{name:'Dejar sin asignar',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Apartamento Luna'})).toBeVisible();
    await page.getByRole('button',{name:'Desasignar la tarea',exact:true}).click();
    await page.getByRole('button',{name:'Sí, quitar asignación',exact:true}).click();
    await expect(page.getByText('Los datos cambiaron.',{exact:true})).toHaveCount(0);
    await page.locator('[data-planner-task-id="existing-1"] [data-planner-primary-action]:visible').click();
    await expect(page.getByRole('dialog',{name:'Colocar tarea'})).toBeVisible();
    await page.locator('#placement-start-time').fill('14:15');
    await page.getByRole('button',{name:/Ana Martínez/}).click();
    await page.getByRole('button',{name:'Aplicar al borrador'}).click();
    await page.getByRole('button',{name:'Guardar 2 y avisar'}).click();
    await expect.poll(()=>page.evaluate(()=>window.planningExampleSaved?.count)).toBe(1);
    const saved=await page.evaluate(()=>window.planningExampleSaved.proposals);
    expect(saved.find(p=>p.taskId==='existing-1').proposedStartTime).toBe('14:15');
    expect(saved.find(p=>p.taskId==='proposed-1').proposedStartTime).toBe('12:30');
    await page.close();
  }
  const html=await buildOfflinePlanningFixture({scenario:'shared'});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    if(route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
    requests.push(route.request().url());return route.abort();
  });
  await page.goto('http://planner.example.test/');
  await page.getByRole('button',{name:'Preparar el reparto'}).click();
  await page.locator('[data-planning-board] [data-planner-task-id="existing-1"] [data-planner-primary-action]').first().click();
  await page.locator('#placement-start-time').fill('12:15');
  await page.getByRole('button',{name:/Carla García/}).click();
  await page.getByRole('button',{name:'Aplicar al borrador'}).click();
  await page.getByRole('button',{name:'Guardar 2 y avisar'}).click();
  await expect.poll(()=>page.evaluate(()=>window.planningExampleSaved?.count)).toBe(1);
  const saved=await page.evaluate(()=>window.planningExampleSaved.proposals.filter(p=>p.taskId==='existing-1'));
  expect(saved.map(p=>p.cleanerId).sort()).toEqual(['worker-2','worker-3']);
  expect(saved.every(p=>p.proposedStartTime==='12:15'&&p.proposedEndTime==='13:15'&&p.durationMinutes===60)).toBe(true);
  expect(errors).toEqual([]);expect(requests).toEqual([]);
  console.log('planning-reassign-browser: OK (mobile, desktop, saved unassignment/reassignment, retained draft, coworkers, shared schedule; no network)');
} finally {await browser.close();}
