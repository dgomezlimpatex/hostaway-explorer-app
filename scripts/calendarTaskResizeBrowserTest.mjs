import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// Real EnhancedTaskCard in Chromium with local mocks; network blocked.
const mocks = {
  '@/hooks/useClientData': 'export const useClientData=()=>({getClientName:()=>null});',
  '@/hooks/useTaskQuickActions': 'export const useTaskQuickActions=()=>({resizeTask:(...a)=>window.resizes.push(a),moveTaskToDate(){},addTaskDuration(){}});',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {EnhancedTaskCard} from './src/components/calendar/EnhancedTaskCard';
    window.resizes=[];
    const task={id:'t1',property:'Apartamento de prueba',date:'2026-10-06',status:'pending',startTime:'09:00',endTime:'10:00',cleanerId:'c1'};
    createRoot(document.getElementById('root')).render(
      <div style={{position:'relative',height:64,width:800}}>
        <div id="slot" style={{position:'absolute',left:100,top:4,width:100,height:56}}>
          <EnhancedTaskCard task={task} style={{height:'100%'}}/>
        </div>
      </div>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'local', setup(plugin) {
    plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : null);
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path] }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const css = await postcss([tailwindcss({ config: 'tailwind.config.ts', content: ['src/components/calendar/*.tsx', 'src/components/ui/*.tsx'] })])
  .process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined });
const browser = await chromium.launch({ headless: true });
const errors = [], requests = [];
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 200 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<style>' + css.css + '</style><div id="root"></div><script>' + built.outputFiles[0].text.replaceAll('</script', '<\/script') + '</script>');
  const handle = page.getByLabel('Redimensionar tarea');
  const card = page.locator('[draggable]').first();
  const before = await card.boundingBox();
  const box = await handle.boundingBox();
  assert.ok(box.x + box.width >= before.x + before.width - 1 && box.height >= before.height - 2, 'handle sits on the right edge');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 40, { steps: 5 });
  await page.waitForFunction(() => document.body.innerText.includes('10:30'));
  await page.waitForTimeout(250); // width transition
  const during = await card.boundingBox();
  assert.ok(Math.abs(during.width - 150) <= 2, `preview width ${during.width}`);
  assert.ok(Math.abs(during.height - before.height) <= 1, 'vertical movement does not stretch the card');
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => window.resizes), [['t1', '10:30']]);
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('calendar-task-resize-browser: OK (right-edge handle, horizontal preview, saved end time; no network)');
} finally { await browser.close(); }
