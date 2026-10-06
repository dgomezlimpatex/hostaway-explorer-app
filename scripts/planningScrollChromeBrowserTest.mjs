import { chromium, expect } from '@playwright/test';
import { buildOfflinePlanningFixture } from './cleaningPlanningFixtureBuild.mjs';
import {mkdirSync} from 'node:fs';

const html = await buildOfflinePlanningFixture({scenario:'load'});
const browser = await chromium.launch({headless:true});
const errors = [], requests = [];
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({viewport:{width:1366,height:900},reducedMotion});
    page.on('pageerror', error=>errors.push(error.message));
    await page.route('**/*', route=>{
      if (route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url()); return route.abort();
    });
    await page.goto('http://planner.example.test/');
    await page.addStyleTag({content:'@media(min-width:1024px){#root > div{margin-left:288px;padding:12px;}}'});
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    const chrome = page.locator('[data-planning-chrome]');
    const legend = page.locator('[data-planning-legend]');
    const scroll = page.locator('[data-planning-timeline-scroll]');
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    expect((await chrome.boundingBox()).height).toBeLessThan(150);
    await expect.poll(()=>scroll.evaluate(e=>e.clientHeight)).toBeGreaterThan(250);
    const initialHeight = await scroll.evaluate(e=>e.clientHeight);
    if (process.env.PLANNING_SCREENSHOTS) {
      mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:`${process.env.PLANNING_SCREENSHOTS}/visible-${reducedMotion}.png`});
    }
    await scroll.evaluate(e=>{e.scrollLeft=160;});
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    await scroll.evaluate(e=>{e.scrollTop=12;});
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    await scroll.evaluate(e=>{e.scrollTop=180;});
    await expect(chrome).toHaveAttribute('data-collapsed','true');
    await expect(legend).toHaveAttribute('aria-hidden','true');
    await expect.poll(async()=>(await chrome.boundingBox()).height).toBeLessThan(1);
    await expect.poll(()=>scroll.evaluate(e=>e.clientHeight)).toBeGreaterThan(initialHeight+80);
    // Wait through the animation guard, then reverse direction without returning to the top.
    await page.waitForTimeout(450);
    if (process.env.PLANNING_SCREENSHOTS) await page.screenshot({path:`${process.env.PLANNING_SCREENSHOTS}/collapsed-${reducedMotion}.png`});
    await scroll.evaluate(e=>{e.scrollTop-=60;});
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    await expect(legend).toHaveAttribute('aria-hidden','false');
    await page.waitForTimeout(450);
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    // Returning to the start also restores it; changing to mobile must show the chrome.
    await scroll.evaluate(e=>{e.scrollTop=320;});
    await expect(chrome).toHaveAttribute('data-collapsed','true');
    await page.setViewportSize({width:390,height:900});
    await expect(chrome).toHaveAttribute('data-collapsed','false');
    await page.close();
  }
  expect(errors).toEqual([]); expect(requests).toEqual([]);
  console.log('planning-scroll-chrome: OK (compact, down/up, no horizontal trigger, jitter threshold, expanded calendar, motion preference, mobile; offline)');
} finally {await browser.close();}
