import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Real multi-day grid + real drag hook in Chromium with local fixtures only.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {useDragAndDrop} from './src/hooks/useDragAndDrop';
    import {MultiDayCalendarGrid} from './src/components/calendar/MultiDayCalendarGrid';
    import {buildCleanerDayCells, getVisibleDays} from './src/components/calendar/utils/multiDayCalendar';
    const cleaners=[{id:'c1',name:'Ana Prueba'},{id:'c2',name:'Berta Prueba'},{id:'c3',name:'Carmen Prueba'}];
    const base={address:'',status:'pending',type:'limpieza',checkIn:'',checkOut:'',clienteId:'cliente-a'};
    const tasks=[
      {...base,id:'t1',property:'Apartamento Centro',date:'2026-10-05',startTime:'09:00',endTime:'11:00',cleanerId:'c1',cleaner:'Ana Prueba'},
      {...base,id:'t2',property:'Ático Puerto',date:'2026-10-05',startTime:'10:30',endTime:'12:00',cleanerId:'c1',cleaner:'Ana Prueba',clienteId:'cliente-b'},
      {...base,id:'t3',property:'Estudio Playa',date:'2026-10-06',startTime:'09:00',endTime:'11:00',cleanerId:'c1',cleaner:'Ana Prueba',status:'completed'},
      {...base,id:'t4',property:'Casa Jardín',date:'2026-10-07',startTime:'12:00',endTime:'14:00',cleanerId:'c2',cleaner:'Berta Prueba',clienteId:'cliente-c'},
    ];
    const days=getVisibleDays(new Date('2026-10-07T12:00:00Z'),'week');
    window.assignments=[];window.clicks=[];window.selectedDays=[];
    function App(){
      const drag=useDragAndDrop((...args)=>window.assignments.push([args[0],args[1],args[3]??null]));
      const cells=buildCleanerDayCells(tasks,cleaners,days);
      return <div style={{display:'flex',height:560,padding:8}}>
        <MultiDayCalendarGrid cleaners={cleaners} days={days} cells={cells} todayStr="2026-10-06" dragState={drag.dragState}
          onDragOver={drag.handleDragOver} onDrop={drag.handleDrop} onDragStart={drag.handleDragStart} onDragEnd={drag.handleDragEnd}
          onTaskClick={task=>window.clicks.push(task.id)} onSelectDay={day=>window.selectedDays.push(day)}
          workloadMap={{c1:{totalWorked:12.5,contractHoursPerWeek:30}}}/>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const css = await postcss([tailwindcss({ config: 'tailwind.config.ts', content: ['src/components/calendar/*.tsx'] })])
  .process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined });
const browser = await chromium.launch({ headless: true });
const errors = [], requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 640 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  const open = async () => {
    await page.setContent('<style>' + css.css + '</style><div id="root"></div><script>' + built.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script>');
    await expect(page.locator('[data-task-id]')).toHaveCount(4);
  };
  const cell = (cleanerId, day) => page.locator(`[data-cleaner-row="${cleanerId}"] [data-day="${day}"]`);
  await open();
  await expect(page.locator('[data-day]')).toHaveCount(21);
  await expect(cell('c1', '2026-10-05').locator('[data-task-id]')).toHaveCount(2);
  await expect(cell('c1', '2026-10-05').getByLabel('Conflicto de horario')).toHaveCount(2);
  await expect(cell('c1', '2026-10-06').getByLabel('Conflicto de horario')).toHaveCount(0);
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT, fullPage: true });

  // Same day, other cleaner: assigns without changing the time.
  await page.locator('[data-task-id="t3"]').dragTo(cell('c3', '2026-10-06'));
  assert.deepEqual(await page.evaluate(() => window.assignments), [['t3', 'c3', null]]);

  // Another day: the drop is rejected, the date never changes by dragging.
  await open();
  await page.locator('[data-task-id="t3"]').dragTo(cell('c2', '2026-10-08'));
  assert.deepEqual(await page.evaluate(() => window.assignments), []);

  await page.locator('[data-task-id="t4"]').click();
  await page.locator('[data-task-id="t1"]').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.clicks), ['t4', 't1']);
  await page.getByRole('button', { name: /mié 7/ }).click();
  assert.deepEqual(await page.evaluate(() => window.selectedDays), ['2026-10-07']);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('calendar-multi-day-browser: OK (week grid, per-day conflicts, same-day drag, cross-day drop blocked, click/keyboard/day header; no network)');
} finally { await browser.close(); }
