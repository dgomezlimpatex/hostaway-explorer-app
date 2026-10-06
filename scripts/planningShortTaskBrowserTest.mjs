import {chromium,expect} from '@playwright/test';
import {buildOfflinePlanningFixture} from './cleaningPlanningFixtureBuild.mjs';
const html=await buildOfflinePlanningFixture({shortTasks:true});
const browser=await chromium.launch({headless:true});
const errors=[],requests=[];
try {
  for(const width of [1920,1366]) {
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      if(route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url()); return route.abort();
    });
    await page.goto('http://planner.example.test/');
    await page.addStyleTag({content:'@media(min-width:1024px){#root > div{margin-left:288px;padding:12px;}}'});
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    const card=page.locator('[data-planning-board] [data-planner-task-id="existing-1"]');
    await expect.poll(()=>card.evaluate(e=>e.clientWidth)).toBeGreaterThan(0);
    expect((await card.boundingBox()).width).toBeLessThan(60);
    for(let i=0;i<8 && (await card.boundingBox()).width<=110;i++) await page.getByRole('button',{name:'Ampliar horario',exact:true}).click();
    await expect(page.getByRole('button',{name:'Encajar día',exact:true})).toHaveAttribute('aria-pressed','false');
    await expect.poll(async()=>(await card.boundingBox()).width).toBeGreaterThan(110);
    const labels=await card.evaluate(e=>[...e.querySelectorAll('button p:first-child > span:last-child,button > span')].map(s=>({text:s.textContent,visible:s.scrollWidth<=s.clientWidth})));
    expect(labels.find(s=>s.text==='ADP18.4A')?.visible).toBe(true);
    expect(labels.find(s=>s.text.includes('09:00–09:33'))?.visible).toBe(true);
    const scroll=page.locator('[data-planning-timeline-scroll]');
    await scroll.evaluate(e=>{e.scrollLeft=360;});
    await expect.poll(()=>page.locator('[data-planning-hours-scroll]').evaluate(e=>e.scrollLeft)).toBe(360);
    // Moving a short task at expanded scale must preserve its actual 33-minute duration.
    await scroll.evaluate(e=>{e.scrollLeft=0;});
    const source=await card.boundingBox();
    const grid=await page.locator('[data-quarter-hour-grid]').first().boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
    await page.mouse.down();
    await page.mouse.move(grid.x+135*(grid.width/960),grid.y+35,{steps:15});
    await page.mouse.up();
    await expect(card).toContainText('10:15–10:48');
    await page.getByRole('button',{name:'Encajar día',exact:true}).click();
    await expect(page.getByRole('button',{name:'Encajar día',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect.poll(async()=>(await card.boundingBox()).width).toBeLessThan(60);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.close();
  }
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  console.log('planning-short-task: OK (33-minute code/time readable, expanded scale, scroll sync, drag preserves duration, fit restored; offline)');
} finally {await browser.close();}
