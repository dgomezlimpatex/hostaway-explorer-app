import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {chromium} from '@playwright/test';

const source = readFileSync('src/components/cleaning-planning/PlanningProposalCalendar.tsx','utf8');
const classFor = marker => source.match(new RegExp(`${marker} className="([^"]+)"`))[1];
const board = classFor('data-planning-board');
const tray = classFor('data-planning-unassigned');
const list = classFor('data-planning-unassigned-list');
const hoursClass = classFor('data-planning-hours-sticky');
assert.match(source, /hoursScrollRef.current.scrollLeft = event.currentTarget.scrollLeft/);
assert.match(source, /timelineScrollRef.current.scrollLeft = event.currentTarget.scrollLeft/);
assert.match(readFileSync('src/components/layout/AppLayout.tsx','utf8'), /location.pathname === '\/planning' && !isMobile \? 'overflow-visible'/);
const css = readdirSync('dist/assets').filter(f=>f.endsWith('.css')).map(f=>readFileSync(`dist/assets/${f}`,'utf8')).join('\n');
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1024,1440]) {
    const page = await browser.newPage({viewport:{width,height:800}});
    await page.setContent(`<style>${css}</style><div style="display:flex;min-height:100vh"><main style="flex:1;min-width:0;overflow:visible;padding:24px"><div style="height:300px">Propuesta</div><div class="${board}"><aside data-tray class="${tray}"><header style="padding:16px;flex-shrink:0">Sin cubrir</header><div data-list class="${list}">${Array.from({length:30},(_,i)=>`<button style="height:70px;border:1px solid #fecaca">Tarea ${i+1}</button>`).join('')}</div></aside><section data-team style="min-width:0;height:3000px;background:#f5f3ff">Equipo y horario<div data-timeline style="overflow-x:auto"><div style="width:2000px;height:100px">Horario</div></div></section></div><div style="height:300px"></div></main></div>`);
    await page.evaluate(hoursClass => {
      const team = document.querySelector('[data-team]');
      const hours = document.createElement('div');
      hours.className = hoursClass;
      hours.dataset.hours = '';
      hours.innerHTML = '<div data-hours-scroll style="overflow-x:hidden"><div style="display:flex;width:2000px;height:44px;background:#faf9fd"><div style="position:sticky;left:0;width:170px;flex-shrink:0;background:#faf9fd">Trabajadora</div><div data-marker style="margin-left:400px">14:00</div></div></div>';
      team.prepend(hours);
      const header = hours.firstElementChild;
      const body = document.querySelector('[data-timeline]');
      body.addEventListener('scroll', () => {header.scrollLeft=body.scrollLeft;});
      header.addEventListener('scroll', () => {body.scrollLeft=header.scrollLeft;});
    },hoursClass);
    const trayBox=await page.locator('[data-tray]').boundingBox();
    const teamBox=await page.locator('[data-team]').boundingBox();
    assert.ok(trayBox.x+trayBox.width <= teamBox.x,'Tray is left of workers');
    assert.equal(trayBox.y,teamBox.y,'Both columns start on the same row');
    for(const scroll of [600,1800,2400]) {
      await page.evaluate(y=>window.scrollTo(0,y),scroll);
      await page.waitForTimeout(50);
      const box=await page.locator('[data-tray]').boundingBox();
      assert.ok(Math.abs(box.y-16)<2,'Tray stays at viewport top while scrolling workers');
      assert.ok(box.y+box.height<=800-100,'Tray clears fixed save controls');
      assert.ok(Math.abs((await page.locator('[data-hours]').boundingBox()).y)<2,'Hours remain at viewport top');
    }
    await page.locator('[data-list]').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    assert.ok(await page.locator('[data-list]').evaluate(el=>el.scrollTop>0),'All pending tasks remain reachable');
    await page.locator('[data-timeline]').evaluate(el=>{el.scrollLeft=800;});
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-hours-scroll]').evaluate(el=>el.scrollLeft),await page.locator('[data-timeline]').evaluate(el=>el.scrollLeft),'Hours follow horizontal timeline scroll');
    assert.equal((await page.locator('[data-tray]').boundingBox()).x,trayBox.x,'Horizontal timeline scroll does not move tray');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
    await page.screenshot({path:`${process.env.TEMP}/planning-sticky-${width}.png`});
    await page.close();
  }
  console.log('PASS: left column, vertical sticky positioning, internal task scroll, independent timeline scroll at 1024 and 1440px');
} finally {await browser.close();}
