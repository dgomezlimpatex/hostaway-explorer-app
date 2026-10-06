import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

process.env.NODE_ENV='production';

async function render(mode, notice=null) {
  const result=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';
    import {renderToStaticMarkup} from 'react-dom/server';
    import {PlanningProposalCalendar} from './src/components/cleaning-planning/PlanningProposalCalendar';
    import {buildPlanningExample} from './scripts/cleaningPlanningExampleData';
    export function render(mode) {
      const data=buildPlanningExample('normal');
      const proposals=data.proposal.proposals.map(p=>({...p,manualOverrideWarnings:mode==='soft'?['Aviso local de margen operativo']:[]}));
      return renderToStaticMarkup(<PlanningProposalCalendar
        originalProposals={data.proposal.proposals} draftProposals={proposals} tasks={data.tasks} calendarTasks={data.tasks}
        cleaners={data.cleaners} effectiveAvailability={data.effectiveAvailability} activeCleanerAssignments={data.activeCleanerAssignments}
        excludedCleanerAssignments={mode==='blocking'?[{...data.activeCleanerAssignments[0],roleType:'excluded'}]:[]}
        isStale={false} onDraftProposalsChange={()=>{}} onDraftWarningsChange={()=>{}} />);
    }
  `},bundle:true,write:false,jsx:'automatic',format:'cjs',platform:'node',packages:'external',plugins:[{
    name:'offline-planner',setup(plugin) {
      plugin.onResolve({filter:/^@\/hooks\/usePlanningCalendarWeek$/},()=>({path:'week',namespace:'fixture'}));
      plugin.onResolve({filter:/^@\/hooks\/useCleaningPlanningActions$/},()=>({path:'actions',namespace:'fixture'}));
      plugin.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='week'
        ? "export const usePlanningCalendarWeek=()=>({data:[],startDate:'2026-09-21',endDate:'2026-09-27',isPending:false,isError:false});"
        : 'export const useCleaningPlanningActions=()=>({});'}));
      plugin.onLoad({filter:/PlanningProposalCalendar\.tsx$/},({path})=>({loader:'tsx',contents:readFileSync(path,'utf8')
        .replace(/(const \[moveNotice, setMoveNotice\] = useState<\{[\s\S]*?\} \| null>)\(null\)/,`$1(${JSON.stringify(notice)})`)}));
    }
  }]});
  const context=vm.createContext({module:{exports:{}},require:createRequire(import.meta.url),console:{...console,error:()=>{}}});
  vm.runInContext(result.outputFiles[0].text,context);
  return context.module.exports.render(mode);
}
assert.doesNotMatch(await render('soft'),/Aviso local de margen operativo|avisos operativos/,'Soft warnings no longer create a top banner');
assert.match(await render('blocking'),/problemas que impiden guardar/,'Blocking problems remain visible');
const success=await render('normal',{message:'Tarea colocada correctamente',previous:[]});
assert.doesNotMatch(success,/Tarea colocada correctamente/,'Successful placement no longer creates a green banner');
assert.match(success,/Deshacer/,'Undo is retained without the banner');
assert.match(await render('normal',{message:'No apta: cambio rechazado',error:true}),/No apta: cambio rechazado/,'Rejected placement still displays its error');
console.log('planning-notice-render: OK (soft/success hidden, undo retained, blocking/errors visible; actual component, no backend)');
