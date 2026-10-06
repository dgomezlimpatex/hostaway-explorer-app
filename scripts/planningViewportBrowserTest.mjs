import { chromium, expect } from '@playwright/test';
import { buildOfflinePlanningFixture } from './cleaningPlanningFixtureBuild.mjs';
import { mkdirSync } from 'node:fs';

const html = await buildOfflinePlanningFixture({scenario:'availability'});
const browser = await chromium.launch({headless:true});
const requests = [], errors = [];
try {
  for (const width of [1920, 1366, 1024, 390]) {
    const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (route.request().url() === 'http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url()); return route.abort();
    });
    await page.goto('http://planner.example.test/');
    // Reserve the same 288px as the desktop app sidebar; use the actual page padding.
    await page.addStyleTag({content:'@media(min-width:1024px){#root > div{margin-left:288px;padding:12px;}}'});
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    if (width >= 1024) {
      const scroll = page.locator('[data-planning-timeline-scroll]');
      const grid = page.locator('[data-quarter-hour-grid]').first();
      await expect.poll(() => grid.evaluate(e => e.clientWidth)).toBeGreaterThan(0);
      expect(await grid.evaluate(e=>e.clientHeight)).toBe(84);
      await expect(scroll.locator('.sticky').getByText(/^Horario /)).toHaveCount(0);
      const geometry = await scroll.evaluate(e => ({height:e.clientHeight, width:e.clientWidth, full:e.scrollWidth}));
      expect(geometry.height).toBeLessThan(600);
      expect(geometry.height).toBeGreaterThan(250);
      if (width === 1920) {
        await expect.poll(() => scroll.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
        const before = await grid.evaluate(e => e.clientWidth);
        await page.setViewportSize({width:1600,height:900});
        await expect.poll(() => grid.evaluate(e => e.clientWidth)).toBeLessThan(before);
        await page.setViewportSize({width:1920,height:900});
      } else {
        const offset = await scroll.evaluate(e => {e.scrollLeft = 200; return e.scrollLeft;});
        await expect.poll(() => page.locator('[data-planning-hours-scroll]').evaluate(e=>e.scrollLeft)).toBe(offset);
      }
      await expect(page.getByRole('button',{name:/Guardar/}).last()).toBeInViewport();
      if (width === 1920) {
        const source = await page.locator('[data-planning-unassigned] [data-planner-task-id="pending-1"]').boundingBox();
        const target = await grid.boundingBox();
        // Fixture range is 08:00–24:00. Drop at the rendered 12:15 coordinate.
        await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
        await page.mouse.down();
        await page.mouse.move(target.x + 255 * target.width / 960, target.y + 40, {steps:15});
        await page.mouse.up();
        await expect(page.locator('[data-planning-board] [data-planner-task-id="pending-1"]')).toContainText('12:15');
      }
    } else {
      await expect(page.locator('[data-planning-board]')).toBeHidden();
      await expect(page.locator('[data-planner-primary-action]:visible').first()).toBeVisible();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.PLANNING_SCREENSHOTS) {
      mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:`${process.env.PLANNING_SCREENSHOTS}/planning-${width}.png`});
    }
    await page.close();
  }
  expect(requests).toEqual([]); expect(errors).toEqual([]);
  console.log('planning-viewport-browser: OK (1920, 1366, 1024, mobile, resize, scrolling, no network)');
} finally { await browser.close(); }
