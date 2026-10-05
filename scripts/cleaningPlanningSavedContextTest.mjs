import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `export {buildProposalContextKey,canAcceptSavedTaskContext} from './src/utils/cleaning-planning/proposalContext'; export {buildPlanningExample} from './scripts/cleaningPlanningExampleData';`, resolveDir: process.cwd(), loader: 'ts' }, bundle:true, write:false, platform:'node', format:'esm' });
const {buildProposalContextKey:key,canAcceptSavedTaskContext:accept,buildPlanningExample} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const example = buildPlanningExample('normal');
const input = {activeSedeId:'demo',cleanerIds:example.cleaners.map(c=>c.id),availability:example.effectiveAvailability,filters:{},range:{startDate:'2026-09-26',endDate:'2026-09-26'},tasks:example.tasks};
const before = key(input);
const updated = {...input,tasks:input.tasks.map(task=>task.id==='existing-1'?{...task,cleanerId:undefined,assignments:[]}:task),availability:input.availability.map(item=>({...item,remainingMinutes:item.remainingMinutes+60,assignedMinutes:0,blockedWindows:item.blockedWindows.filter(w=>w.kind!=='assigned_task')}))};
assert.equal(accept(before,key(updated),'existing-1'),true,'own unassignment and derived load are accepted');
assert.equal(accept(before,before,'existing-1'),false,'wait for refreshed data');
assert.equal(accept(before,key(updated),'pending-1'),false,'another task is never accepted');
assert.equal(accept(before,key({...updated,tasks:[...updated.tasks,{...updated.tasks[0],id:'new-task'}]}),'existing-1'),false,'new external task stays stale');
assert.equal(accept(before,key({...updated,tasks:updated.tasks.map(t=>t.id==='proposed-1'?{...t,startTime:'15:00'}:t)}),'existing-1'),false,'concurrent edit stays stale');
assert.equal(accept(before,key({...updated,availability:updated.availability.map(a=>({...a,availableWindows:[{startTime:'10:00',endTime:'17:00'}]}))}),'existing-1'),false,'availability change stays stale');
assert.equal(accept(before,key({...updated,activeSedeId:'another-sede'}),'existing-1'),false,'sede change stays stale');
assert.equal(accept(before,key({...updated,tasks:updated.tasks.filter(t=>t.id!=='existing-1')}),'existing-1'),false,'deleted task stays stale');
console.log('planning-saved-context: OK (own edit, load, concurrent task, new task, availability, sede, deletion)');
