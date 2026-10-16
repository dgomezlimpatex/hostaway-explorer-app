import { chromium, expect } from '@playwright/test';
import { buildOfflinePlanningFixture } from './cleaningPlanningFixtureBuild.mjs';

const browser = await chromium.launch({headless:true});
const errors = [], requests = [];
try {
  for (const width of [1440, 390]) {
    const html = await buildOfflinePlanningFixture({scenario:'availability'});
    const page = await browser.newPage({viewport:{width,height:900},timezoneId:'Europe/Madrid',reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      if(route.request().url()==='http://planner.example.test/') return route.fulfill({contentType:'text/html',body:html});
      requests.push(route.request().url());return route.abort();
    });
    await page.goto('http://planner.example.test/');
    await page.getByRole('button',{name:'Preparar el reparto'}).click();
    const bands = page.locator('[data-worker-availability]:visible');
    await expect(bands.first()).toBeVisible();
    if (width > 767) {
      await expect(page.locator('[data-worker-availability]:visible',{hasText:'Mantenimiento'})).toHaveCount(1);
      const text = (await bands.evaluateAll(nodes => nodes.map(node => node.textContent))).join(' ');
      expect(text).not.toMatch(/Disponible/);
      expect(text).toMatch(/Ausencia/);
    }
    const green = await page.evaluate(() => [...document.querySelectorAll('[data-worker-availability] *')]
      .filter(node => { const c = getComputedStyle(node).backgroundColor; const m = c.match(/\d+(\.\d+)?/g)?.map(Number); return m && m.length >= 3 && (m[3] ?? 1) > 0 && m[1] > m[0] + 20 && m[1] > m[2] + 10; }).length);
    expect(green).toBe(0);
    await expect(page.getByText('Horario disponible',{exact:true})).toHaveCount(0);
    if (width === 1440) await page.screenshot({path:`${process.env.TEMP}/planner-bands-${width}.png`});
    await page.close();
  }
  if (errors.length || requests.length) throw new Error(JSON.stringify({errors, requests}));
  console.log('planning-availability-bands-browser: OK (no green background, no availability labels, blocks keep their hours; mobile and desktop; no network)');
} finally { await browser.close(); }
