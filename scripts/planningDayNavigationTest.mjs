import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {readFileSync,readdirSync} from 'node:fs';

const hooks = `import React from 'react';
const cleaner={id:'worker',name:'Ana',isActive:true};
const sede={id:'sede',nombre:'Test'};
const buildings={propertyGroups:[],propertyAssignments:[],cleanerAssignments:[],excludedCleanerAssignments:[]};
export const useSede=()=>({activeSede:sede,availableSedes:[sede],setActiveSede(){}});
export const useCleaners=()=>({cleaners:[cleaner],refetch:async()=>({})});
export const useCleaningPlanningBuildingData=()=>({data:buildings,isLoading:false,isError:false,refetch:async()=>({})});
export const useCleaningPlanningActions=()=>({isApplyingProposal:false,applyProposal:async()=>{window.applied=(window.applied||0)+1;}});
export function useCleaningPlanning({date}) {
 const day=date.toISOString().slice(0,10);
 return React.useMemo(()=>{
 const tasks=day==='2026-09-18'?[]:[{id:day,property:'Apartamento',propertyCode:'AB1',date:day,startTime:'09:00',endTime:'10:00',durationMinutes:60,riskFlags:[],zone:'all',requiredCleaners:1}];
 return {planning:{unassignedTasks:tasks,cleaners:[],summary:{}},range:{startDate:day,endDate:day},effectiveAvailability:[],isLoading:false,isError:false,refetch:async()=>({data:tasks,isError:false})};
 },[day]);
}
export const useSidebar=()=>({state:'collapsed',isMobile:false});`;
const utilities = `export const isOperationalCleaner=()=>true;
export const minutesToHoursLabel=n=>String(n);
export const isTaskAssignedToCleaner=()=>false;
export const extractBuildingCode=()=> 'AB';
export const applyBuildingOperationalWindow=t=>t;
export const buildProposalSignature=ps=>ps.map(p=>p.taskId+':'+p.cleanerId).join('|');
export const buildAssignmentProposal=({tasks})=>({proposals:tasks.map(t=>({taskId:t.id,cleanerId:'worker',cleanerName:'Ana',durationMinutes:60})),conflicts:[],summary:{totalUnassignedTasks:tasks.length}});`;
const calendar = `import React from 'react';
export function PlanningProposalCalendar({draftProposals,onDraftProposalsChange,onDraftWarningsChange,selectedDay}) {
 React.useEffect(()=>onDraftWarningsChange([]),[draftProposals,onDraftWarningsChange]);
 return <div data-calendar><span data-selected>{selectedDay}</span><span data-draft>{draftProposals[0]?.cleanerName||'Vacío'}</span><button onClick={()=>onDraftProposalsChange(draftProposals.map(p=>({...p,cleanerId:'edited',cleanerName:'Editada'})))}>Editar borrador</button></div>;
}`;
const output=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {CleaningPlanningPage} from './src/components/cleaning-planning/CleaningPlanningPage';createRoot(document.getElementById('root')).render(<CleaningPlanningPage/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{name:'isolate-network',setup(b){
 b.onResolve({filter:/.*/},args=>{
   if(args.path.includes('/hooks/')||args.path.includes('/contexts/')||args.path.includes('/ui/sidebar'))return {path:'hooks',namespace:'mock'};
   if(/utils\/cleaningPlanning|proposalEngine|buildingOperationalWindow|proposalBatchApply|laundryScheduleService|taskAssignments/.test(args.path))return {path:'utils',namespace:'mock'};
   if(args.path==='./PlanningProposalCalendar')return {path:'calendar',namespace:'mock'};
   if(args.path==='./PlanningStartScreen')return {path:'start',namespace:'mock'};
   if(/\.\/(CleanerLoadTable|PlanningAdvancedDetails|PlanningAlertsPanel|PlanningFilters|PlanningAttentionSummary|WorkerAvailabilityPanel)$/.test(args.path))return {path:args.path.slice(2),namespace:'empty'};
 });
 b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path==='hooks'?hooks:path==='utils'?utilities:path==='calendar'?calendar:`import React from 'react';export const PlanningStartScreen=({onGenerateProposal})=><button onClick={onGenerateProposal}>Abrir planning</button>;`,loader:'tsx',resolveDir:process.cwd()}));
 b.onLoad({filter:/.*/,namespace:'empty'},({path})=>({contents:'export const '+path+'=()=>null;'}));
}}]});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();
 const css=readdirSync('dist/assets').filter(f=>f.endsWith('.css')).map(f=>readFileSync(`dist/assets/${f}`,'utf8')).join('\n');
 await page.route('http://planning.test/',r=>r.fulfill({contentType:'text/html',body:'<style>'+css+'</style><div id="root"></div><script>'+output.outputFiles[0].text+'</script>'}));
 await page.goto('http://planning.test/');
 await page.getByText('Abrir planning').click();
 await page.getByLabel('Día del planning',{exact:true}).fill('2026-09-16');
 await page.locator('[data-selected]').filter({hasText:'2026-09-16'}).waitFor();
 await page.getByText('Editar borrador').click();
 assert.equal(await page.locator('[data-draft]').textContent(),'Editada');
 await page.getByRole('button',{name:'Día siguiente',exact:true}).click();
 await page.locator('[data-selected]').filter({hasText:'2026-09-17'}).waitFor();
 assert.equal(await page.locator('[data-draft]').textContent(),'Ana');
 await page.getByRole('button',{name:'Día anterior',exact:true}).click();
 await page.locator('[data-selected]').filter({hasText:'2026-09-16'}).waitFor();
 assert.equal(await page.locator('[data-draft]').textContent(),'Editada','Draft restored after returning');
 await page.getByLabel('Día del planning',{exact:true}).fill('2026-09-18');
 await page.locator('[data-selected]').filter({hasText:'2026-09-18'}).waitFor();
 assert.equal(await page.locator('[data-draft]').textContent(),'Vacío','Empty days stay in calendar');
 assert.equal(await page.evaluate(()=>window.applied||0),0,'Navigation never saves assignments');
 await page.getByLabel('Día del planning',{exact:true}).fill('2026-12-31');
 await page.getByRole('button',{name:'Día siguiente',exact:true}).click();
 await page.locator('[data-selected]').filter({hasText:'2027-01-01'}).waitFor();
 await page.screenshot({path:`${process.env.TEMP}/planning-day-navigation.png`});
 console.log('PASS: real page and draft panel navigate dates, preserve edits, handle empty days/year boundary, and never apply');
} finally {await browser.close();}
