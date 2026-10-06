import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture({shortTasks:true});
const browser=await chromium.launch({headless:true});
const errors=[],requests=[];
try {
 for(const width of [1920,1366,1024]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(route.request().url()==='http://planner.example.test/')return route.fulfill({contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
  await page.goto('http://planner.example.test/');
  await page.addStyleTag({content:'@media(min-width:1024px){#root > div{margin-left:288px;padding:12px;}}'});
  await page.getByRole('button',{name:'Preparar el reparto'}).click();
  await page.waitForTimeout(100);
  const grid=page.locator('[data-quarter-hour-grid]').first();
  const card=page.locator('[data-planning-board] [data-planner-task-id="existing-1"]');
  const stats=()=>card.evaluate(e=>({height:e.offsetHeight,font:getComputedStyle(e.querySelector('p')).fontSize}));
  const original=await stats();
  const initialWidth=(await grid.boundingBox()).width;
  const plus=page.getByRole('button',{name:'Ampliar horario',exact:true});
  const minus=page.getByRole('button',{name:'Reducir horario',exact:true});
  const fit=page.getByRole('button',{name:'Encajar día',exact:true});
  await expect(page.locator('[data-planning-zoom-level]')).toHaveText('100%');
  await plus.click();
  await expect.poll(async()=>(await grid.boundingBox()).width).toBeGreaterThan(initialWidth);
  await plus.click();await plus.click();
  const enlarged=(await grid.boundingBox()).width;
  expect(enlarged/initialWidth).toBeCloseTo(1.25**3,2);
  expect(await stats()).toEqual(original);
  await minus.click();
  expect((await grid.boundingBox()).width).toBeCloseTo(enlarged/1.25,0);
  const manualWidth=(await grid.boundingBox()).width;
  const scroll=page.locator('[data-planning-timeline-scroll]');
  await scroll.evaluate(e=>{e.scrollLeft=200;});
  await plus.click();
  await expect.poll(()=>scroll.evaluate(e=>e.scrollLeft)).toBeCloseTo(250,0);
  await expect.poll(()=>page.locator('[data-planning-hours-scroll]').evaluate(e=>e.scrollLeft)).toBeCloseTo(250,0);
  await minus.click();
  await page.setViewportSize({width:width===1024?1366:1024,height:900});
  await page.waitForTimeout(100);
  expect((await grid.boundingBox()).width).toBeCloseTo(manualWidth,0);
  for(let i=0;i<20 && await plus.isEnabled();i++)await plus.click();
  await expect(plus).toBeDisabled();
  expect((await grid.boundingBox()).width/960).toBeCloseTo(6,1);
  for(let i=0;i<20 && await minus.isEnabled();i++)await minus.click();
  await expect(minus).toBeDisabled();
  expect((await grid.boundingBox()).width/960).toBeCloseTo(1,1);
  await fit.click();
  await expect(fit).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-planning-zoom-level]')).toHaveText('100%');
  expect(await stats()).toEqual(original);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.close();
 }
 expect(errors).toEqual([]);expect(requests).toEqual([]);
 console.log('planning-hour-zoom-browser: OK (three desktops, gradual +/- width only, limits, resize, hour anchor, reset; offline)');
} finally {await browser.close();}

