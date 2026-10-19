// Real loader, synthetic data only; the production client is replaced at build time.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';

const baseline=process.argv.includes('--baseline');
const batchMode=process.argv.includes('--batch');
const baselineCurrent=process.argv.includes('--baseline-current');
const state={reads:[],cache:new Map(),revision:1,failure:null,throws:false,nullProperty:false};
globalThis.propertyPreparationFixture=state;
const fixtures={
  '@/hooks/useAuth':'export const useAuth=()=>({});',
  '@/contexts/SedeContext':'export const useSede=()=>({});',
  '@/services/taskStorage':'export const taskStorageService={};',
  './CleanerOfflineProvider':'export const useCleanerOfflineStatus=()=>null;',
  './offlineStore':`const s=globalThis.propertyPreparationFixture;export const readCleanerCache=async key=>s.cache.get(key);export const readWithCleanerCache=async(key,loader)=>{const data=await loader();s.cache.set(key,{data,savedAt:Date.now()});return data};export const withTimeout=promise=>promise;`,
  '@/services/storage/taskReportsStorage':`export const taskReportsStorageService={async getChecklistTemplates(){globalThis.propertyPreparationFixture.reads.push({table:'templates'});return []}};`,
  '@/integrations/supabase/client':`const s=globalThis.propertyPreparationFixture;export const supabase={from(table){let selection;const filters={};
    const execute=async batch=>{s.reads.push({table,selection,filters});await new Promise(resolve=>setTimeout(resolve,2));
      if(s.failure===table){s.failure=null;if(s.throws)throw new Error('network failed');return {data:null,error:new Error('read failed')}};
      const property=id=>({notas:filters.sede_id+':'+id+':v'+s.revision,numero_camas:0,numero_banos:null,duracion_servicio:60,kit_alimentario:0});
      const data=table==='properties'?(batch?(s.nullProperty?[]:filters.id.map(id=>({id,...property(id)})).reverse()):(s.nullProperty?null:property(filters.id))):table==='task_reports'?{id:'report:'+filters.task_id,task_id:filters.task_id,cleaner_id:filters.cleaner_id,overall_status:'pending'}:{checklist_template_id:'template:'+filters.property_id};return {data,error:null};};
    const q={select(value){selection=value;return q},eq(k,v){filters[k]=v;return q},in(k,v){filters[k]=v;return q},maybeSingle(){return execute(false)},then(resolve,reject){return execute(true).then(resolve,reject)}};return q}};`,
};
const built=await build({stdin:{contents:"export {loadCleanerBundle,createCleanerPreparationLoader} from './src/features/cleaner/useCleanerData';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'local-fixtures',setup(p){
  p.onResolve({filter:/.*/},a=>Object.hasOwn(fixtures,a.path)?{path:a.path,namespace:'fixture'}:null);
  p.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],loader:'js'}));
  if(baseline)p.onLoad({filter:/useCleanerData\.ts$/},()=>({contents:execFileSync('git',['show','2b278f6850f75dc0ea5160c96966852116483714:src/features/cleaner/useCleanerData.ts'],{encoding:'utf8'})+'\nexport const createCleanerPreparationLoader=(owner,sede,cleaner)=>task=>loadCleanerBundle(owner,sede,task,cleaner);',loader:'tsx'}));
  if(baselineCurrent)p.onLoad({filter:/useCleanerData\.ts$/},()=>({contents:execFileSync('git',['show','871bdeef13c7d3da7c0b56e0b3904fb821d2cb35:src/features/cleaner/useCleanerData.ts'],{encoding:'utf8'}),loader:'tsx'}));
}}]});
const {loadCleanerBundle,createCleanerPreparationLoader}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const tasks=Array.from({length:20},(_,i)=>({id:'task'+i,propertyId:'p'+Math.floor(i/4)}));
async function prepare(owner='owner',sede='sede',inputTasks=tasks){
  const load=createCleanerPreparationLoader(owner,sede,'cleaner',batchMode?inputTasks:[]);let next=0;const bundles=[];
  async function worker(){while(next<inputTasks.length){const task=inputTasks[next++];const bundle=await load(task);assert.equal(bundle.report.task_id,task.id);assert.equal(bundle.assignedTemplateId,'template:'+task.propertyId);assert.equal(bundle.property.notas,`${sede}:${task.propertyId}:v${state.revision}`);assert.equal(bundle.property.numero_camas,0);assert.equal(bundle.property.numero_banos,null);assert.equal(Object.hasOwn(bundle.property,'id'),false);bundles.push(bundle);}}
  await Promise.all([worker(),worker()]);load.finish?.();return bundles;
}
const prepared=await prepare();
const count=table=>state.reads.filter(r=>r.table===table).length;
const metrics={tasks:prepared.length,uniqueProperties:5,propertyReads:count('properties'),reportReads:count('task_reports'),checklistAssignmentReads:count('property_checklist_assignments'),templateReads:count('templates'),totalReads:state.reads.length};
assert.equal(metrics.propertyReads,baseline?20:batchMode&&!baselineCurrent?1:5);assert.equal(metrics.reportReads,20);assert.equal(metrics.checklistAssignmentReads,20);assert.equal(metrics.templateReads,1);
console.log(JSON.stringify(metrics));if(process.env.PROPERTY_PREPARATION_RESULT)writeFileSync(process.env.PROPERTY_PREPARATION_RESULT,JSON.stringify(metrics,null,2));
if(!baseline&&!batchMode){
  state.reads=[];state.revision=2;await prepare();assert.equal(count('properties'),5,'A new cycle must fetch updated properties');
  state.reads=[];await Promise.all([prepare('owner-a','sede-a'),prepare('owner-b','sede-b')]);assert.equal(count('properties'),10,'Separate cycles must not share property reads across accounts or sites');
  assert.deepEqual([...new Set(state.reads.filter(r=>r.table==='properties').map(r=>r.filters.sede_id))].sort(),['sede-a','sede-b']);
  state.reads=[];await loadCleanerBundle('owner','sede',tasks[0],'cleaner');state.revision=3;
  assert.equal((await loadCleanerBundle('owner','sede',tasks[0],'cleaner')).property.notas,'sede:p0:v3');assert.equal(count('properties'),2,'Opening directly keeps its existing fresh property read');
  state.reads=[];const empty=await createCleanerPreparationLoader('owner','sede','cleaner')({id:'no-property'});assert.equal(empty.property,null);assert.equal(count('properties'),0);
  state.nullProperty=true;assert.equal((await createCleanerPreparationLoader('owner','sede','cleaner')(tasks[0])).property,null);state.nullProperty=false;
  for(const throws of [false,true]){
    state.reads=[];state.throws=throws;state.failure='properties';const load=createCleanerPreparationLoader('owner','sede','cleaner');
    const failed=await Promise.allSettled([load(tasks[0]),load(tasks[1])]);assert.ok(failed.every(r=>r.status==='rejected'));assert.equal(count('properties'),1,'Concurrent readers share a single failed request');
    assert.ok((await load(tasks[2])).property);assert.equal(count('properties'),2,'Failures must be evicted so a later read can retry');
  }
  state.throws=false;
  for(const table of ['task_reports','property_checklist_assignments']){state.failure=table;await assert.rejects(createCleanerPreparationLoader('owner','sede','cleaner')(tasks[0]),/read failed/);}
  const load=createCleanerPreparationLoader('owner','sede','cleaner');await load({...tasks[0],id:'alias_assignment_1',originalTaskId:'canonical'});
  const reportRead=state.reads.filter(r=>r.table==='task_reports').at(-1);assert.equal(reportRead.filters.task_id,'canonical');assert.equal(reportRead.filters.cleaner_id,'cleaner');
  load.finish();state.revision=4;
  assert.equal((await load(tasks[0])).property.notas,'sede:p0:v4','A query function retained after the cycle must read fresh property data');
  load.finish();
  assert.ok(state.reads.filter(r=>r.table==='properties').every(r=>r.filters.sede_id&&r.selection.includes('cantidad_rollos_papel_cocina')),'Site filter and complete existing property fields are preserved');
  console.log('PASS: per-cycle cache, independent reports/checklists, account/site isolation, fresh direct and post-cycle reads, refresh, zero/null/missing property, error eviction, retry, canonical task identity');
}

if(batchMode&&!baselineCurrent){
  for(const size of [1,25,26,73]){
    state.reads=[];const many=Array.from({length:size},(_,i)=>({id:'task'+i,propertyId:'property'+i}));
    await prepare('owner','sede',many);assert.equal(count('properties'),Math.ceil(size/25));
    assert(state.reads.filter(r=>r.table==='properties').every(r=>r.filters.id.length<=25&&r.filters.sede_id==='sede'));
  }
  state.reads=[];await Promise.all([prepare('owner-a','sede-a'),prepare('owner-b','sede-b')]);assert.equal(count('properties'),2);
  state.revision=2;state.reads=[];await prepare();assert.equal(count('properties'),1,'Next preparation reads fresh properties');
  const load=createCleanerPreparationLoader('owner','sede','cleaner',tasks);state.reads=[];
  assert.equal(count('properties'),0,'Creating a cycle must not fetch anything');
  const absent=await load({id:'no-property'});assert.equal(absent.property,null);assert.equal(count('properties'),0);
  await load(tasks[0]);load.finish();state.revision=3;
  assert.equal((await load(tasks[0])).property.notas,'sede:p0:v3','A retained query function after finish stays fresh');
  assert.equal(typeof state.reads.filter(r=>r.table==='properties').at(-1).filters.id,'string');
  state.nullProperty=true;assert.equal((await createCleanerPreparationLoader('owner','sede','cleaner',tasks)(tasks[0])).property,null);state.nullProperty=false;
  for(const throws of [false,true]){
    state.reads=[];state.throws=throws;state.failure='properties';const retry=createCleanerPreparationLoader('owner','sede','cleaner',tasks);
    const failed=await Promise.allSettled([retry(tasks[0]),retry(tasks[4])]);assert(failed.every(r=>r.status==='rejected'));assert.equal(count('properties'),1);
    assert((await retry(tasks[8])).property);assert.equal(count('properties'),2,'A failed batch is retried on later task demand');retry.finish();
  }
  state.throws=false;
  const unknown=createCleanerPreparationLoader('owner','sede','cleaner',tasks);state.reads=[];
  assert.equal((await unknown({id:'new-task',propertyId:'new-property'})).property.notas,'sede:new-property:v3');assert.equal(count('properties'),1);unknown.finish();
  const cancelled=createCleanerPreparationLoader('owner','sede','cleaner',tasks);cancelled.finish();state.reads=[];
  await cancelled(tasks[0]);assert.equal(typeof state.reads.filter(r=>r.table==='properties')[0].filters.id,'string','Cancelled preparation cannot start a batch');
  const running=createCleanerPreparationLoader('owner','sede','cleaner',tasks),pending=running(tasks[0]);running.finish();await pending;state.revision=4;state.reads=[];
  assert.equal((await running(tasks[0])).property.notas,'sede:p0:v4','A late batch cannot revive a finished cycle');
  assert.equal(typeof state.reads.filter(r=>r.table==='properties')[0].filters.id,'string');
  console.log('PASS: batches bounded at 25, reversed rows mapped by ID, fields/null/zero preserved, independent reports/checklists, fresh cycles/accounts/sites, lazy demand, missing/unlisted property, errors/retry and retained query freshness');
}
delete globalThis.propertyPreparationFixture;
