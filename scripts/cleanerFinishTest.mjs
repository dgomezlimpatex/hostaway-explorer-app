import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile('src/features/cleaner/CleanerTaskReportModal.tsx','utf8');
const ast = ts.createSourceFile('modal.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let finishNode;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'finish') finishNode = node.initializer;
  ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(finishNode,'Test the actual completion handler');
const code = ts.transpileModule(`return (${finishNode.getText(ast)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const keys = ['draft','started','completed','task','formatMadridDate','validation','saving','preparingPhotos','bundle','missingTemplate','recovery','save','checklist','notes'];
const createFinish = new Function(...keys,code);
const initial = {revision:3,finishRequested:false,report:{overall_status:'in_progress',start_time:'2026-10-06T08:00:00Z',notes:'Conservada'}};
let saved, calls = 0;
const input = {draft:initial,started:true,completed:false,task:{date:'today'},formatMadridDate:()=> 'today',validation:{missing:[]},saving:0,preparingPhotos:0,bundle:{data:{}},missingTemplate:false,recovery:false,checklist:{required:{completed:true,media_urls:['local-photo']}},notes:'Conservada',save:async change=> {calls++;saved=change(saved || structuredClone(initial));return saved;}};
const finish = changes => createFinish(...keys.map(key=>({...input,...changes})[key]))();
await finish();
assert.equal(calls,1);
assert.equal(saved.report.overall_status,'completed');
assert.equal(saved.finishRequested,true);
assert.equal(saved.revision,4);
assert.ok(Number.isFinite(Date.parse(saved.report.end_time)));
assert.equal(saved.report.end_time,saved.report.updated_at);
assert.deepEqual(saved.report.checklist_completed,input.checklist);
assert.equal(saved.report.notes,'Conservada');
const end = saved.report.end_time;
await finish(); // A queued second click must not replace the first end time.
assert.equal(saved.report.end_time,end);
assert.equal(saved.revision,4);
for (const guard of [{draft:null},{started:false},{completed:true},{task:{date:'other'}},{validation:{missing:['Foto obligatoria']}},{saving:1},{preparingPhotos:1},{bundle:{}},{missingTemplate:true},{recovery:true}]) {
  const before=calls;
  await finish(guard);
  assert.equal(calls,before,`Guard ${JSON.stringify(guard)} prevents completion`);
}
await finish({save:async()=> {throw new Error('Local storage failed');}});
assert.match(source,/onClick=\{\(\) => void finish\(\)\}/);
assert.doesNotMatch(source,/setStep|then\(onClose\)/);
assert.match(source,/currentReport=\{draft.report\} timeOnly/);

const compiled = await build({stdin:{contents:`export { ReportSummary } from './src/components/modals/task-report/ReportSummary';`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',alias:{'@':join(process.cwd(),'src')},packages:'external',logLevel:'silent'});
const compiledSource = compiled.outputFiles[0].text.replace(/from "([^"]+)"/g,(_,name)=>`from ${JSON.stringify(import.meta.resolve(name))}`);
const {ReportSummary} = await import('data:text/javascript;base64,'+Buffer.from(compiledSource).toString('base64'));
const props = {task:{additionalTasks:[]},checklist:{},notes:'Hidden report note',completionPercentage:100,currentReport:{overall_status:'completed',start_time:'2026-10-06T08:00:00Z',end_time:'2026-10-06T09:45:00Z'},timeOnly:true};
const html = renderToStaticMarkup(createElement(ReportSummary,props));
assert.match(html,/Tiempo Real del Servicio/);
assert.match(html,/Hora de Finalización/);
assert.match(html,/10:00/);
assert.match(html,/11:45/);
assert.match(html,/1h 45m/);
assert.doesNotMatch(html,/Resumen de la limpieza|Revisa antes de finalizar|Limpieza finalizada|puntos completados|Hidden report note|En curso/);
const legacy = renderToStaticMarkup(createElement(ReportSummary,{...props,timeOnly:false}));
assert.match(legacy,/Resumen de la limpieza/);
assert.match(legacy,/Limpieza finalizada/);
console.log('PASS: actual single-click finish, validation guards, duplicate end-time protection, saved notes/photos, save failure, Madrid times and cleaner-only final card.');
