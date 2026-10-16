import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

const load = async (entry, mocks = {}) => {
  const result = await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
    name:'outbox-mocks',
    setup(plugin) {
      plugin.onResolve({filter:/.*/}, ({path}) => mocks[path] ? {path, namespace:'mock'} : undefined);
      plugin.onLoad({filter:/.*/, namespace:'mock'}, ({path}) => ({loader:'js', contents:mocks[path]}));
    },
  }]});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};

// --- Lógica pura: qué función se llama, con qué cuerpo y cómo se interpreta la respuesta.
const {buildOutboxEmailRequest, classifyOutboxSend} = await load('supabase/functions/_shared/assignmentEmailOutbox.ts');
const task = {property:'Casa', address:'Calle 1', date:'2026-10-20', startTime:'09:00:00', endTime:'11:00:00', durationMinutes:120, workerCount:2, type:'Limpieza general', notes:null};
const row = {id:'e1', kind:'assigned', task_id:'t1', recipient_email:'ana@example.test', recipient_name:'Ana', lease_token:'l1', skip_reason:null, task};
const assigned = buildOutboxEmailRequest(row);
assert.equal(assigned.functionName, 'send-task-assignment-email');
assert.deepEqual(assigned.body, {taskId:'t1', cleanerEmail:'ana@example.test', cleanerName:'Ana', taskData:{...task, notes:undefined}});
const unassigned = buildOutboxEmailRequest({...row, kind:'unassigned'});
assert.equal(unassigned.functionName, 'send-task-unassignment-email');
assert.equal(unassigned.body.reason, 'unassigned');
assert.throws(() => buildOutboxEmailRequest({...row, task:null}), /sin tarea|sin tarea asociada|tarea asociada/i);
assert.deepEqual(classifyOutboxSend({status:200, body:{success:true, messageId:'m'}}), {outcome:'sent', detail:null});
assert.equal(classifyOutboxSend({status:500, body:{error:'Resend rejected'}}).outcome, 'retry');
assert.equal(classifyOutboxSend({status:200, body:{success:false}}).outcome, 'retry', 'Un 200 con success:false no cuenta como enviado');
assert.equal(classifyOutboxSend({status:200, body:null}).outcome, 'sent');
assert.match(classifyOutboxSend({error:new Error('timeout')}).detail, /timeout/);

// --- Proceso de envío completo con claim/finish y envío simulados.
const calls = {rpc:[], fetch:[]};
let queue = [];
const rpcResults = {finish: (args) => (args._outcome === 'retry' ? 'pending' : args._outcome)};
globalThis.Deno = {env:{get:name => ({SUPABASE_URL:'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'service-key'}[name])}};
globalThis.fetch = async (url, init) => {
  calls.fetch.push({url, body:JSON.parse(init.body), auth:init.headers.Authorization});
  const target = calls.fetch.at(-1).body.cleanerEmail;
  if (target === 'caida@example.test') throw new Error('network down');
  if (target === 'rechazo@example.test') return new Response(JSON.stringify({error:'Resend rejected'}), {status:500});
  return new Response(JSON.stringify({success:true, messageId:'m'}), {status:200});
};
let handler;
const processor = await load('supabase/functions/process-assignment-email-outbox/index.ts', {
  'https://deno.land/std@0.190.0/http/server.ts': 'export const serve = handler => { globalThis.__outboxHandler = handler; };',
  'npm:@supabase/supabase-js@2.50.0': `export const createClient = () => ({ rpc: async (name, args) => globalThis.__outboxRpc(name, args) });`,
});
handler = globalThis.__outboxHandler;
globalThis.__outboxRpc = async (name, args) => {
  calls.rpc.push({name, args});
  if (name === 'claim_assignment_emails') { const batch = queue.splice(0, args._limit); return {data:batch, error:null}; }
  if (name === 'finish_assignment_email') return {data:rpcResults.finish(args), error:null};
  throw new Error(`rpc inesperado ${name}`);
};
const call = (headers = {Authorization:'Bearer service-key'}, method = 'POST') => handler(new Request('https://x/', {method, headers}));
assert.equal((await call({})).status, 403, 'Sin la clave del servicio no se procesa nada');
assert.equal((await call({Authorization:'Bearer otra-clave'})).status, 403);
assert.equal((await call(undefined, 'GET')).status, 405);
assert.equal(calls.rpc.length, 0, 'Una petición no autorizada no toca la cola');

const mk = (id, email, extra = {}) => ({...row, id, recipient_email:email, lease_token:`lease-${id}`, ...extra});
queue = [
  mk('ok', 'ana@example.test'),
  mk('baja', 'bea@example.test', {kind:'unassigned'}),
  mk('omitido', 'carla@example.test', {skip_reason:'assignment_changed', task:null}),
  mk('rechazo', 'rechazo@example.test'),
  mk('caida', 'caida@example.test'),
];
const response = await call();
const summary = await response.json();
assert.equal(response.status, 200);
assert.deepEqual({sent:summary.sent, skipped:summary.skipped, retried:summary.retried, failed:summary.failed, claimed:summary.claimed}, {sent:2, skipped:1, retried:2, failed:0, claimed:5});
assert.deepEqual(calls.fetch.map(c => new URL(c.url).pathname), [
  '/functions/v1/send-task-assignment-email', '/functions/v1/send-task-unassignment-email',
  '/functions/v1/send-task-assignment-email', '/functions/v1/send-task-assignment-email',
], 'Lo omitido no se envía; el resto usa las funciones de correo existentes');
assert.ok(calls.fetch.every(c => c.auth === 'Bearer service-key'));
const finished = Object.fromEntries(calls.rpc.filter(c => c.name === 'finish_assignment_email').map(c => [c.args._id, c.args]));
assert.equal(finished.ok._outcome, 'sent');
assert.equal(finished.omitido._outcome, 'skipped');
assert.equal(finished.omitido._detail, 'assignment_changed');
assert.equal(finished.rechazo._outcome, 'retry');
assert.match(finished.rechazo._detail, /Resend rejected/);
assert.equal(finished.caida._outcome, 'retry');
assert.ok(Object.values(finished).every(args => args._lease_token === `lease-${args._id}`), 'Cada cierre usa su propia reserva');
const claimSizes = calls.rpc.filter(c => c.name === 'claim_assignment_emails').map(c => c.args._limit);
assert.ok(claimSizes.every(size => size <= 5), 'Lotes pequeños para no retener envíos');

// Un fallo definitivo se informa como fallido y no se oculta.
calls.rpc.length = 0; calls.fetch.length = 0;
rpcResults.finish = () => 'failed';
queue = [mk('final', 'rechazo@example.test')];
assert.equal((await (await call()).json()).failed, 1);
// Si la cola no responde, el error se devuelve (el cron lo registra) en vez de aparentar éxito.
globalThis.__outboxRpc = async () => ({data:null, error:{message:'db down'}});
const broken = await call();
assert.equal(broken.status, 500);
assert.match((await broken.json()).error, /db down/);

// --- Servicio de la app: usa la función de cola y no envía correos por su cuenta.
const rpcLog = [], invokeLog = [];
const service = await load('src/services/storage/multipleTaskAssignmentService.ts', {
  '@/integrations/supabase/client': `export const supabase = {
    rpc: async function (name, args) { globalThis.__rpcLog.push({name, args}); return {data:{added:[{id:'c1',name:'Ana',email:'a@x'}], removed:[], final:[{id:'c1',name:'Ana'}]}, error:null}; },
    functions: { invoke: async (...a) => { globalThis.__invokeLog.push(a); return {}; } },
    from: () => { throw new Error('sin lecturas'); },
  };`,
});
globalThis.__rpcLog = rpcLog; globalThis.__invokeLog = invokeLog;
const queued = await service.multipleTaskAssignmentService.setTaskAssignmentsQueueingEmails('t1_assignment_2', ['c1']);
assert.deepEqual(rpcLog, [{name:'set_task_assignments_queue_email', args:{_task_id:'t1', _cleaner_ids:['c1']}}], 'Una sola llamada, con el id real de la tarea');
assert.equal(invokeLog.length, 0, 'La app no envía correos al guardar');
assert.equal(queued.added.length, 1);

// --- Deshacer un lote fallido no apunta correos; aplicar sí.
const {executeProposalBatch} = await load('src/utils/cleaning-planning/proposalBatchExecution.ts');
const plan = (id, previous = []) => ({taskId:id, cleanerIds:[`${id}-nuevo`], previousCleanerIds:previous, proposedStartTime:'09:00', proposedEndTime:'10:00', previousStartTime:'08:00', previousEndTime:'09:00'});
const log = [];
await assert.rejects(() => executeProposalBatch([plan('a', ['a-antes']), plan('b')], {
  updateSchedule: async () => {},
  setAssignments: async (id, ids) => { log.push(['queue', id, ids]); if (id === 'b') throw new Error('falla b'); },
  revertAssignments: async (id, ids) => { log.push(['revert', id, ids]); },
}), /falla b/);
assert.deepEqual(log.filter(([kind]) => kind === 'revert'), [['revert', 'b', []], ['revert', 'a', ['a-antes']]], 'El deshacer usa la vía sin correos');
const legacy = [];
await assert.rejects(() => executeProposalBatch([plan('a', ['a-antes']), plan('b')], {
  updateSchedule: async () => {},
  setAssignments: async (id, ids) => { legacy.push([id, ids]); if (id === 'b') throw new Error('falla b'); },
}), /falla b/);
assert.equal(legacy.length, 4, 'Sin revertAssignments se conserva el comportamiento anterior');

// --- El guardado del reparto ya no espera a los correos.
const actions = readFileSync('src/hooks/useCleaningPlanningActions.ts', 'utf8');
assert.match(actions, /setTaskAssignmentsQueueingEmails\(/);
assert.match(actions, /revertAssignments: \(taskId, cleanerIds\) => multipleTaskAssignmentService\.setTaskAssignments\(/);
assert.doesNotMatch(actions, /notifyAssignmentDiff/, 'El reparto no envía correos uno a uno');

// --- Contrato de la migración: aislada, envolviendo (no sustituyendo) la función de producción.
const sql = readFileSync('supabase/migrations/20261016180000_assignment_email_outbox.sql', 'utf8');
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /REVOKE ALL ON public\.assignment_email_outbox FROM PUBLIC, anon, authenticated/);
assert.match(sql, /result := public\.set_task_assignments\(_task_id, _cleaner_ids\);/, 'Envuelve la función existente');
assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.set_task_assignments\(/, 'No sustituye la función de producción');
assert.doesNotMatch(sql, /CREATE TRIGGER|DROP TRIGGER/, 'No añade avisos a otras vías que escriben asignaciones');
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.claim_assignment_emails\(integer\) TO service_role;/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.claim_assignment_emails\(integer\) FROM PUBLIC, anon, authenticated;/);
assert.match(sql, /ON DELETE SET NULL/);
assert.match(sql, /FOR UPDATE SKIP LOCKED/);
const cron = readFileSync('supabase/migrations/20261016180100_schedule_assignment_email_outbox.sql', 'utf8');
assert.match(cron, /'assignment-email-outbox-process',\s*'\* \* \* \* \*'/);
assert.match(cron, /whatsapp_notification_cron_service_role/);
assert.doesNotMatch(cron, /eyJ[A-Za-z0-9_-]{20,}/, 'Sin claves en el SQL');

console.log('PASS: cola de correos (envío, reintentos, omisión por cambio, deshacer sin avisos, guardado sin espera, contrato SQL)');
