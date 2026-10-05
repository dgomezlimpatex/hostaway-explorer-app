import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const repo=path.resolve(import.meta.dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'limpatex-delivery-functional-'));
try {
  await build({entryPoints:[path.join(repo,'src/utils/weeklyScheduleDays.ts')],bundle:true,platform:'node',format:'esm',outfile:path.join(temp,'schedule.mjs')});
  const {buildDaySchedules,validDaySchedules}=await import(pathToFileURL(path.join(temp,'schedule.mjs')));
  const rows=buildDaySchedules([0,3,1],{3:{startTime:'10:15',endTime:'12:45'}},'09:00','17:00');
  assert.deepEqual(rows.map(x=>x.daysOfWeek[0]),[1,3,0]);
  assert.deepEqual(rows[1],{daysOfWeek:[3],startTime:'10:15',endTime:'12:45'});
  assert.equal(validDaySchedules(rows),true);
  assert.equal(validDaySchedules([]),false);
  assert.equal(validDaySchedules([{daysOfWeek:[1],startTime:'17:00',endTime:'09:00'}]),false);
  assert.equal(validDaySchedules([{daysOfWeek:[1],startTime:'09:00',endTime:'09:00'}]),false);
  assert.equal(validDaySchedules([{daysOfWeek:[1],startTime:'9:00',endTime:'17:00'}]),false);
  console.log('PASS: funcionalidad real, orden semanal, horario individual y limites; sin red ni datos reales.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
