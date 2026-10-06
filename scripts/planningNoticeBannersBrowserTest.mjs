import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture();
const browser=await chromium.launch({headless:true});
const requests=[], errors=[];
try {
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      if(route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url()); return route.abort();
    });
    await page.goto('http://planner.example.test/');
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    const primary=page.locator('[data-planner-task-id="proposed-1"] [data-planner-primary-action]:visible').first();
    await primary.click();
    await page.locator('#placement-start-time').fill('09:15');
    await page.getByRole('button',{name:'Aplicar al borrador'}).click();
    await expect(page.locator('[data-dnd-notice]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByText(/\d+ avisos operativos/)).toHaveCount(0);
    await page.getByRole('button',{name:'Ver detalles del plan'}).click();
    await expect(page.getByText('Avisos operativos',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Ver detalles del plan'}).click();
    await page.getByRole('button',{name:'Deshacer',exact:true}).filter({visible:true}).click();
    await expect(page.locator('[data-planner-task-id="proposed-1"]:visible').first()).toContainText('11:00');
    await expect(page.locator('[data-dnd-notice]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.close();
  }
  expect(errors).toEqual([]);expect(requests).toEqual([]);
  console.log('planning-notice-banners: OK (green/amber banners removed, details preserved, undo on desktop/mobile; no network)');
} finally {await browser.close();}
