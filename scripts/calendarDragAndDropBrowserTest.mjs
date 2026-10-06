import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const mocks = {
  '@/hooks/useClientData': 'export const useClientData=()=>({getClientName:()=>null});',
  '@/hooks/useTaskQuickActions': 'export const useTaskQuickActions=()=>({});',
  '@/hooks/use-mobile': 'export const useDeviceType=()=>({isMobile:false,isTablet:false});',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useRef,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {useDragAndDrop} from './src/hooks/useDragAndDrop';
    import {UnassignedTasks} from './src/components/calendar/UnassignedTasks';
    import {CalendarLayout} from './src/components/calendar/CalendarLayout';
    const task={id:'task-local',property:'Apartamento de prueba',date:'2026-10-06',status:'pending',startTime:'09:00',endTime:'10:00'};
    const cleaners=[{id:'cleaner-local',name:'Trabajadora de prueba'}];
    window.assignments=[];
    function App(){
      const [assigned,setAssigned]=useState(false);
      const drag=useDragAndDrop((...args)=>{window.assignments.push(args);setAssigned(true)});
      window.drag=drag;window.task=task;
      const header=useRef(null),body=useRef(null);
      return <div style={{display:'flex',height:500}}>
        <div style={{width:250}}><UnassignedTasks tasks={assigned?[]:[task]} onTaskClick={()=>{}} onDragStart={drag.handleDragStart} onDragEnd={drag.handleDragEnd}/></div>
        <CalendarLayout cleaners={cleaners} timeSlots={['09:00','09:15','09:30','09:45','10:00','10:15']} assignedTasks={[]} availability={[{cleaner_id:'cleaner-local',day_of_week:2,is_available:true,start_time:'08:00',end_time:'18:00'}]} currentDate={new Date(2026,9,6)} dragState={drag.dragState} headerScrollRef={header} bodyScrollRef={body} onHeaderScroll={()=>{}} onBodyScroll={()=>{}} onDragOver={drag.handleDragOver} onDrop={drag.handleDrop} onDragStart={drag.handleDragStart} onDragEnd={drag.handleDragEnd} onTaskClick={()=>{}} getTaskPosition={()=>({left:'0%',width:'10%'})} isTimeSlotOccupied={()=>false}/>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'local-calendar', setup(plugin) {
    plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks,args.path) ? { path: args.path, namespace: 'fixture' } : null);
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path] }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path=>path.includes('integrations/supabase')),false);
const css = await postcss([tailwindcss({config:'tailwind.config.ts',content:['src/components/calendar/*.tsx','src/components/ui/*.tsx']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined});
const browser = await chromium.launch({headless:true});
const errors=[],requests=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:800}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  const open=async()=>{
    await page.setContent('<style>'+css.css+'</style><div id="root"></div><script>'+built.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>');
    await expect(page.locator('[draggable="true"]')).toHaveCount(1);
  };
  await open();
  await page.locator('[draggable="true"]').dragTo(page.locator('[data-time="10:15"]'));
  await expect(page.locator('[draggable="true"]')).toHaveCount(0);
  assert.deepEqual(await page.evaluate(()=>window.assignments.map(a=>[a[0],a[1],a[3]])),[['task-local','cleaner-local','10:15']]);
  await open();
  // Reproduce browser payload loss through the actual card and timeline slot.
  const data=await page.evaluateHandle(()=>new DataTransfer());
  await page.locator('[draggable="true"]').dispatchEvent('dragstart',{dataTransfer:data});
  await page.evaluate(d=>d.clearData(),data);
  await page.locator('[data-time="09:15"]').dispatchEvent('drop',{dataTransfer:data});
  assert.equal(await page.evaluate(()=>window.assignments[0][3]),'09:15');
  await open();
  const workerData=await page.evaluateHandle(()=>new DataTransfer());
  await page.locator('[draggable="true"]').dispatchEvent('dragstart',{dataTransfer:workerData});
  await page.evaluate(d=>d.clearData(),workerData);
  await page.getByText('Trabajadora de prueba',{exact:true}).dispatchEvent('drop',{dataTransfer:workerData});
  assert.deepEqual(await page.evaluate(()=>window.assignments.map(a=>[a[0],a[1],a[3]??null])),[['task-local','cleaner-local',null]]);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('calendar-drag-browser: OK (native drag, empty payload timeline and worker name; no network)');
} finally { await browser.close(); }
