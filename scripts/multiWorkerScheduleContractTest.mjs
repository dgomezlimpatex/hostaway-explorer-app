import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repo, relativePath), 'utf8');

const previewModal = read('src/components/modals/TaskPreviewModal.tsx');
const taskPositioning = read('src/utils/taskPositioning.ts');
const multipleAssignmentService = read('src/services/storage/multipleTaskAssignmentService.ts');
const whatsappSender = read('supabase/functions/send-whatsapp-notification/index.ts');
const assignmentEmail = read('supabase/functions/send-task-assignment-email/index.ts');
const scheduleEmail = read('supabase/functions/send-task-schedule-change-email/index.ts');
const sharedSchedule = read('supabase/functions/_shared/taskWorkerSchedule.ts');
const assignmentSnapshotMigration = read('supabase/migrations/20260819120000_snapshot_multiworker_schedule.sql');

assert.match(previewModal, /getEffectiveTaskEndTime/, 'la vista de detalle del trabajador debe usar el fin individual');
assert.match(previewModal, /getEffectiveTaskDurationMinutes/, 'la vista de detalle del trabajador debe mostrar la duración individual');
assert.match(taskPositioning, /getScheduledWindowDurationMinutes/, 'el calendario debe calcular la duración por trabajador desde la ventana horaria explícita');
assert.match(multipleAssignmentService, /workerCount/, 'el correo de asignación múltiple debe transportar el número real de trabajadores al cálculo común');
assert.match(whatsappSender, /taskWorkerSchedule/, 'WhatsApp debe usar el helper común de horario');
assert.match(assignmentEmail, /taskWorkerSchedule/, 'Gmail de asignación debe recalcular el horario individual');
assert.match(scheduleEmail, /taskWorkerSchedule/, 'Gmail de cambio debe recalcular el horario individual');
assert.match(sharedSchedule, /workerCount/, 'el helper backend debe aceptar el número real de trabajadores');
assert.match(sharedSchedule, /durationMinutes/, 'el helper backend debe distinguir duración total y ventana horaria');
assert.match(assignmentSnapshotMigration, /worker_count/, 'el snapshot de asignación debe conservar el número de trabajadores');
assert.match(assignmentSnapshotMigration, /duracion/, 'el snapshot de asignación debe conservar la duración total');
assert.match(assignmentSnapshotMigration, /TG_OP = 'DELETE'/, 'la cancelación debe conservar el conteo anterior al borrado');

assert.match(sharedSchedule, /windowDuration > 0/, 'el helper backend debe priorizar la ventana horaria explicita sobre la estimacion obsoleta');

console.log('multi-worker-schedule-contract: OK');
