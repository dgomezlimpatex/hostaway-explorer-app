import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture();
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{if(route.request().url()==='http://planner.example.test/')return route.fulfill({contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
 await page.goto('http://planner.example.test/');await page.getByRole('button',{name:'Preparar el reparto'}).click();
 await page.locator('[data-planning-board] [data-planner-task-id="existing-1"]').click({button:'right'});
 await expect(page.getByRole('dialog',{name:'Apartamento Luna'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sí, quitar asignación',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Desasignar la tarea',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Apartamento Luna'})).toHaveCount(0);
 await expect(page.locator('[data-planning-unassigned] [data-planner-task-id="existing-1"]')).toBeVisible();
 await expect(page.getByText('Los datos cambiaron.',{exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('planning-direct-unassign-browser: OK (right click, one action, dialog closed, task in tray, draft remains valid; offline)');
} finally {await browser.close();}
