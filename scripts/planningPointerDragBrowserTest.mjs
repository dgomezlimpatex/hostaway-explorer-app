import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture({scenario:'load'});
const browser=await chromium.launch({headless:true});
const errors=[],requests=[];
try {
 for(const expanded of [false,true]) {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url()==='http://planner.example.test/')return route.fulfill({contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
  await page.goto('http://planner.example.test/');
  await page.getByRole('button',{name:'Preparar el reparto'}).click();
  if(expanded) await page.getByRole('button',{name:'Ampliar horario',exact:true}).click();
  const scroll=page.locator('[data-planning-timeline-scroll]');
  const card=page.locator('[data-planning-board] [data-planner-task-id="load-0"]');
  await page.waitForTimeout(150);
  const source=await card.boundingBox();
  // Grab at the far end: the dragged rectangle would overlap the wrong row.
  await page.mouse.move(source.x+source.width-3,source.y+source.height/2);
  await page.mouse.down();
  await page.mouse.move(source.x+source.width+20,source.y+source.height,{steps:5});
  const preview=page.locator('[data-planning-drag-preview]');
  await expect(preview).toBeVisible();
  // Scroll both axes DURING the drag (also collapses the planning header).
  await scroll.evaluate((e,expanded)=>{e.scrollLeft=expanded?300:80;e.scrollTop=160;},expanded);
  await page.waitForTimeout(450);
  const target=page.locator('[data-planning-board] [data-dnd-drop-worker="worker-4"]');
  const grid=await target.locator('[data-quarter-hour-grid]').boundingBox();
  const scale=grid.width/960;
  const x=grid.x+225*scale; // 11:45 on the 08:00—24:00 fixture.
  const y=grid.y+4;
  await page.mouse.move(x,y,{steps:10});
  await expect.poll(async()=>Math.abs((await preview.boundingBox()).x-x)).toBeLessThan(1.1);
  await expect.poll(async()=>Math.abs((await preview.boundingBox()).y-y)).toBeLessThan(1.1);
  await expect(preview).toContainText('11:45');
  await page.mouse.up();
  await expect(preview).toHaveCount(0);
  await expect(target.locator('[data-planner-task-id="load-0"]')).toContainText('11:45–12:15');
  // Dropping on the worker-name column must cancel, even if the card overlaps the grid.
  const moved=await card.boundingBox();
  await page.mouse.move(moved.x+3,moved.y+3);await page.mouse.down();
  const view=await scroll.boundingBox();
  await page.mouse.move(view.x+200,y,{steps:10});await page.mouse.up();
  await expect(target.locator('[data-planner-task-id="load-0"]')).toContainText('11:45–12:15');
  await page.close();
 }
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('planning-pointer-drag-browser: OK (preview follows pointer, exact row/time, scroll during drag, fit/expanded, outside cancellation; offline)');
} finally {await browser.close();}





