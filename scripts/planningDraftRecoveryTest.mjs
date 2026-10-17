// Recuperación de borradores del planificador: pruebas locales del código real, sin red ni datos reales.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'planning-draft-'));
const outfile = join(dir, 'bundle.mjs');
let code;
try {
  await build({
    stdin: {
      contents: [
        "export * from './src/utils/cleaning-planning/planningDraftStore';",
        "export * from './src/utils/cleaning-planning/planningDraftManager';",
        "export * from './src/utils/cleaning-planning/planningDraftRecovery';",
        "export * from './src/utils/cleaning-planning/planningDraftText';",
        "export { buildProposalSignature } from './src/utils/cleaning-planning/proposalBatchApply';",
      ].join('\n'),
      resolveDir: process.cwd(),
    },
    outfile, bundle: true, platform: 'node', format: 'esm', tsconfig: 'tsconfig.json', logLevel: 'error',
  });
  code = await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const {
  PlanningDraftManager, draftStorageKey, readDraft, writeDraft, removeDraft, listDrafts, parseDraftRecord, draftContentFingerprint,
  buildDraftBaseline, contentFromDraft, evaluateDraftRecovery, taskStatesAgree, describeStoredDraft, presetForDraftPeriod,
  buildProposalSignature, PLANNING_DRAFT_KEY_PREFIX, PLANNING_DRAFT_MAX_AGE_MS,
} = code;

// --- utilidades de prueba --------------------------------------------------------------------------

class FakeStorage {
  items = {};
  failWrites = null;
  blocked = false;
  get length() { if (this.blocked) throw new Error('blocked'); return Object.keys(this.items).length; }
  key(index) { return Object.keys(this.items)[index] ?? null; }
  getItem(key) { if (this.blocked) throw new Error('blocked'); return key in this.items ? this.items[key] : null; }
  setItem(key, value) {
    if (this.failWrites) throw Object.assign(new Error(this.failWrites), { name: this.failWrites });
    this.items[key] = String(value);
  }
  removeItem(key) { delete this.items[key]; }
}

const makeClock = () => {
  let now = Date.UTC(2026, 9, 17, 16, 42, 0); // 18:42 en Madrid (CEST)
  let timers = [];
  return {
    now: () => now,
    advance: (ms) => { now += ms; },
    setTimer: (callback, ms) => { const timer = { callback, ms, live: true }; timers.push(timer); return timer; },
    clearTimer: (timer) => { if (timer) timer.live = false; },
    run: () => { const due = timers; timers = []; due.filter((timer) => timer.live).forEach((timer) => { timer.live = false; timer.callback(); }); },
    pending: () => timers.filter((timer) => timer.live).length,
  };
};

const makeTarget = () => {
  const handlers = {};
  return {
    visibilityState: 'visible',
    addEventListener: (type, handler) => { handlers[type] = [...(handlers[type] || []), handler]; },
    removeEventListener: (type, handler) => { handlers[type] = (handlers[type] || []).filter((item) => item !== handler); },
    emit: (type, event = {}) => (handlers[type] || []).forEach((handler) => handler(event)),
    count: (type) => (handlers[type] || []).length,
  };
};

const tab = (storage, writerId, clock = makeClock()) => {
  const target = makeTarget();
  const manager = new PlanningDraftManager({
    storage, writerId, debounceMs: 500, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    eventTarget: target, visibilityTarget: target,
  });
  manager.attach();
  return { manager, clock, target };
};

const DATE = '2026-10-17';
const identity = { userId: 'user-a', sedeId: 'sede-1', startDate: DATE, endDate: DATE };
const names = { w1: 'Ana', w2: 'Bea', w3: 'Carla' };
const cleaners = Object.entries(names).map(([id, name]) => ({ id, name, isActive: true }));
const task = (id, over = {}) => ({
  id, property: `Piso ${id}`, propertyCode: `C-${id}`, date: DATE, startTime: '09:00', endTime: '10:00', status: 'pending',
  cleanerId: undefined, assignments: [], requiredCleaners: 1, detectedBuilding: { status: 'detected', propertyGroupId: 'b1' }, ...over,
});
const proposal = (taskId, cleanerId, over = {}) => ({
  taskId, cleanerId, cleanerName: names[cleanerId], propertyGroupId: 'b1', propertyGroupName: 'Edificio Norte', assignmentRole: 'primary',
  durationMinutes: 60, proposedStartTime: '09:00', proposedEndTime: '10:00', requiredCleaners: 1, assignmentIndex: 0, confidence: 0.9,
  reasons: ['Mejor encaje'], warnings: [], capacityAfterAssignment: { assignedMinutes: 60, remainingMinutes: 300 }, ...over,
});
const availabilityFor = (cleanerId, over = {}) => ({
  cleanerId, date: DATE, isAvailable: true, source: 'weekly', availableWindows: [{ startTime: '08:00', endTime: '17:00' }],
  blockedWindows: [], availableMinutes: 540, assignedMinutes: 0, remainingMinutes: 540, ...over,
});

// Escenario del borrador: asignación nueva, reasignación con cambio de horario, desasignación y equipo de dos.
const tasks = [
  task('t1'),
  task('t2', { cleanerId: 'w1', assignments: [{ cleaner_id: 'w1' }] }),
  task('t3', { cleanerId: 'w1', assignments: [{ cleaner_id: 'w1' }, { cleaner_id: 'w2' }], requiredCleaners: 2 }),
  task('t4', { requiredCleaners: 2 }),
  task('t5'),
];
const availability = ['w1', 'w2', 'w3'].map((id) => availabilityFor(id));
const draftProposals = [
  proposal('t1', 'w1'),
  proposal('t2', 'w2', { proposedStartTime: '10:00', proposedEndTime: '11:00', reasons: ['Asignación manual durante la revisión'], manualOverrideWarnings: ['Cambio manual'] }),
  { ...proposal('t3', ''), operation: 'unassign', cleanerName: 'Sin asignar', durationMinutes: 0 },
  proposal('t4', 'w1', { requiredCleaners: 2, assignmentIndex: 0 }),
  proposal('t4', 'w3', { requiredCleaners: 2, assignmentIndex: 1, assignmentRole: 'secondary' }),
];
const editedTaskIds = ['t2'];
const baseline = buildDraftBaseline({ proposals: draftProposals, tasks, availability });
const content = contentFromDraft(draftProposals, editedTaskIds, baseline);
const evaluate = (record, over = {}) => evaluateDraftRecovery({
  record, freshTasks: tasks, scopeTasks: tasks, cleaners, availability, excludedCleanerAssignments: [], ...over,
});
const writeAndFlush = (t, id = identity, c = content) => { t.manager.schedule(id, c); t.clock.run(); };

// --- 1. editar, recargar y recuperar exactamente el mismo borrador -------------------------------------
{
  const storage = new FakeStorage();
  const first = tab(storage, 'tab-1');
  first.manager.begin(identity);
  first.manager.schedule(identity, content);
  assert.equal(first.manager.getView(identity).saveState, 'pending', 'No se anuncia «guardado» antes de confirmar la escritura');
  assert.equal(readDraft(storage, identity).status, 'none');
  first.clock.run();
  const savedView = first.manager.getView(identity);
  assert.equal(savedView.saveState, 'saved');
  assert.equal(savedView.savedAt, new Date(first.clock.now()).toISOString());
  assert.equal(readDraft(storage, identity).record.revision, 1);

  // «Recarga»: otro gestor, mismo almacenamiento.
  const reloaded = tab(storage, 'tab-2');
  reloaded.manager.begin(identity);
  const view = reloaded.manager.getView(identity);
  assert.equal(view.decision, 'foreign', 'Un borrador anterior nunca se aplica en silencio');
  assert.equal(view.stored.taskCount, 4, 'Resumen: tareas afectadas (t1, t2, t3, t4)');
  const evaluation = evaluate(view.stored);
  assert.equal(evaluation.status, 'ready');
  assert.deepEqual(evaluation.recoverable, draftProposals, 'Recupera exactamente las mismas propuestas (con nombres reconstruidos)');
  assert.deepEqual(evaluation.editedTaskIds, ['t2']);
  assert.deepEqual(evaluation.recoverable.filter((item) => item.taskId === 't4').map((item) => item.cleanerId), ['w1', 'w3'], 'El equipo de dos no pierde compañera');
  assert.equal(evaluation.recoverable.find((item) => item.operation === 'unassign').taskId, 't3');
  assert.equal(evaluation.recoverable.find((item) => item.taskId === 't2').proposedStartTime, '10:00', 'Conserva el horario modificado');
  assert.equal(buildProposalSignature(evaluation.recoverable), buildProposalSignature(draftProposals), 'La firma de guardado coincide');
  // No guarda nombres de trabajadoras ni datos innecesarios.
  const raw = storage.getItem(draftStorageKey(identity));
  assert.ok(!/Ana|Bea|Carla/.test(raw), 'El borrador no contiene nombres de trabajadoras');
  assert.ok(!/token|password|email|telefono/i.test(raw));

  // Aceptar el borrador sin cambios no reescribe nada ni cambia la hora de modificación.
  reloaded.manager.acceptRecord(identity, view.stored);
  reloaded.manager.schedule(identity, contentFromDraft(evaluation.recoverable, evaluation.editedTaskIds, baseline));
  assert.equal(reloaded.clock.pending(), 0, 'Recuperar sin editar no escribe');
  assert.equal(readDraft(storage, identity).record.revision, 1);
  // Seguir editando escribe la revisión siguiente.
  reloaded.manager.schedule(identity, contentFromDraft(evaluation.recoverable.slice(0, 2), [], baseline));
  reloaded.clock.run();
  assert.equal(readDraft(storage, identity).record.revision, 2);
}

// --- 2. Conservarlo al salir y volver: el vaciado al salir escribe de forma síncrona -------------------------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  t.manager.begin(identity);
  t.manager.schedule(identity, content);
  assert.equal(readDraft(storage, identity).status, 'none');
  t.manager.flush(identity); // desmontar la pantalla
  assert.equal(readDraft(storage, identity).status, 'ok');
  // pagehide y visibilitychange también vacían lo pendiente.
  const other = { ...identity, startDate: '2026-10-18', endDate: '2026-10-18' };
  t.manager.begin(other);
  t.manager.schedule(other, content);
  t.target.emit('pagehide');
  assert.equal(readDraft(storage, other).status, 'ok');
  const third = { ...identity, startDate: '2026-10-19', endDate: '2026-10-19' };
  t.manager.begin(third);
  t.manager.schedule(third, content);
  t.target.visibilityState = 'hidden';
  t.target.emit('visibilitychange');
  assert.equal(readDraft(storage, third).status, 'ok');
  t.manager.detach();
  assert.equal(t.target.count('pagehide'), 0, 'detach deja de escuchar');
}

// --- 3. Usuarios, sedes y días independientes ---------------------------------------------------------------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  const variants = [
    identity,
    { ...identity, userId: 'user-b' },
    { ...identity, sedeId: 'sede-2' },
    { ...identity, startDate: '2026-10-18', endDate: '2026-10-18' },
    { ...identity, endDate: '2026-10-23' },
  ];
  variants.forEach((id) => { t.manager.begin(id); writeAndFlush(t, id, contentFromDraft([proposal(`x-${id.userId}-${id.sedeId}-${id.endDate}`, 'w1')], [], { tasks: {}, availability: {} })); });
  assert.equal(new Set(Object.keys(storage.items)).size, 5, 'Cinco borradores independientes');
  const userB = tab(storage, 'tab-b');
  userB.manager.begin(variants[1]);
  assert.equal(userB.manager.getView(variants[1]).stored.userId, 'user-b');
  assert.ok(userB.manager.getView(variants[1]).stored.proposals.every((item) => item.taskId.includes('user-b')));
  const listed = listDrafts(storage, 'user-a', 'sede-1', { now: t.clock.now() }).drafts;
  assert.deepEqual(listed.map((item) => `${item.identity.startDate}/${item.identity.endDate}`).sort(), [`${DATE}/${DATE}`, `${DATE}/2026-10-23`, '2026-10-18/2026-10-18'].sort());
  assert.ok(listed.every((item) => item.identity.userId === 'user-a' && item.identity.sedeId === 'sede-1'), 'Ni otro usuario ni otra sede aparecen en el listado');
  // Un registro de otro usuario copiado bajo la clave de este no se muestra.
  storage.items[draftStorageKey(identity)] = storage.items[draftStorageKey(variants[1])];
  assert.equal(readDraft(storage, identity).status, 'invalid');
}

// --- 3b. Cerrar sesión o cambiar de usuario/sede: una escritura pendiente nunca termina bajo otra identidad ------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  const sedeA = { ...identity, sedeId: 'sede-A' };
  t.manager.begin(sedeA);
  t.manager.schedule(sedeA, content);
  // Cambia el usuario/sede activos antes de que venza el retardo.
  const nextUser = { ...identity, userId: 'user-next', sedeId: 'sede-B' };
  t.manager.begin(nextUser);
  t.manager.schedule(nextUser, contentFromDraft([], [], { tasks: {}, availability: {} }));
  t.clock.run();
  const keys = Object.keys(storage.items);
  assert.deepEqual(keys, [draftStorageKey(sedeA)], 'La escritura pendiente se hace con la identidad con la que se programó');
  assert.equal(readDraft(storage, nextUser).status, 'none');
  assert.equal(JSON.parse(storage.items[keys[0]]).userId, 'user-a');
}

// --- 4. Cambios externos: tareas canceladas/completadas y validación parcial ---------------------------------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  t.manager.begin(identity);
  writeAndFlush(t);
  const record = readDraft(storage, identity).record;
  const replace = (id, over) => tasks.map((item) => (item.id === id ? { ...item, ...over } : item));
  const codes = (evaluation, id) => evaluation.conflicts.find((conflict) => conflict.taskId === id)?.codes;

  assert.equal(evaluate(record).status, 'ready');
  // Un cambio ajeno a las tareas del borrador no lo invalida.
  assert.equal(evaluate(record, { freshTasks: replace('t5', { startTime: '12:00', endTime: '13:00' }), scopeTasks: replace('t5', { startTime: '12:00' }) }).status, 'ready');
  assert.equal(evaluate(record, { availability: [...availability, availabilityFor('w3', { date: '2026-10-30' })] }).status, 'ready');
  assert.equal(evaluate(record, { availability: availability.map((item) => (item.cleanerId === 'w2' ? { ...item, blockedWindows: [{ reason: 'Carga', kind: 'assigned_task' }] } : item)) }).status, 'ready', 'La carga ya asignada no cuenta como cambio de disponibilidad');

  const cancelled = evaluate(record, { freshTasks: replace('t1', { status: 'cancelled' }) });
  assert.equal(cancelled.status, 'partial');
  assert.deepEqual(codes(cancelled, 't1'), ['task_not_plannable']);
  assert.match(cancelled.conflicts[0].reasons[0], /cancelada/);
  assert.equal(cancelled.recoveredTaskCount, 3);
  assert.ok(cancelled.recoverable.every((item) => item.taskId !== 't1'), 'Solo se retira la tarea afectada');
  assert.match(evaluate(record, { freshTasks: replace('t1', { status: 'completed' }) }).conflicts[0].reasons[0], /completada/);
  assert.deepEqual(codes(evaluate(record, { freshTasks: tasks.filter((item) => item.id !== 't2') }), 't2'), ['task_missing']);

  const moved = evaluate(record, { freshTasks: replace('t1', { startTime: '11:00', endTime: '12:00' }) });
  assert.deepEqual(codes(moved, 't1'), ['task_changed']);
  assert.match(moved.conflicts[0].reasons[0], /09:00–10:00 → 11:00–12:00/);
  const reassigned = evaluate(record, { freshTasks: replace('t2', { cleanerId: 'w3', assignments: [{ cleaner_id: 'w3' }] }) });
  assert.match(reassigned.conflicts[0].reasons.join(' '), /quién la tiene asignada/);
  assert.match(evaluate(record, { freshTasks: replace('t4', { requiredCleaners: 3 }) }).conflicts[0].reasons.join(' '), /personas necesarias/);
  assert.deepEqual(codes(evaluate(record, { scopeTasks: replace('t1', { detectedBuilding: { status: 'detected', propertyGroupId: 'b9' } }) }), 't1'), ['building_changed']);
  assert.deepEqual(codes(evaluate(record, { scopeTasks: tasks.filter((item) => item.id !== 't1') }), 't1'), ['outside_scope']);

  assert.deepEqual(codes(evaluate(record, { cleaners: cleaners.filter((item) => item.id !== 'w3') }), 't4'), ['cleaner_unavailable']);
  assert.deepEqual(codes(evaluate(record, { cleaners: cleaners.map((item) => (item.id === 'w1' ? { ...item, isActive: false } : item)) }), 't1'), ['cleaner_unavailable']);
  assert.deepEqual(codes(evaluate(record, { excludedCleanerAssignments: [{ propertyGroupId: 'b1', cleanerId: 'w2', roleType: 'excluded' }] }), 't2'), ['cleaner_excluded']);
  const absent = evaluate(record, { availability: availability.map((item) => (item.cleanerId === 'w2' ? { ...item, isAvailable: false, source: 'absence' } : item)) });
  assert.deepEqual(codes(absent, 't2'), ['availability_changed']);
  assert.match(absent.conflicts[0].reasons[0], /disponibilidad de Bea/);
  assert.equal(absent.status, 'partial');

  // Si nada se puede recuperar, se bloquea sin perder el borrador.
  const blocked = evaluate(record, { freshTasks: [], scopeTasks: [] });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.recoverable.length, 0);
  assert.equal(readDraft(storage, identity).status, 'ok', 'Evaluar nunca borra ni modifica el borrador');
  // Tarea sin línea base: no se puede comprobar, no se recupera.
  const noBaseline = evaluate({ ...record, baseline: { tasks: {}, availability: {} } });
  assert.equal(noBaseline.status, 'blocked');
  assert.deepEqual(codes(noBaseline, 't1'), ['no_baseline']);

  assert.equal(taskStatesAgree(tasks, tasks, ['t1', 't2']), true);
  assert.equal(taskStatesAgree(replace('t1', { startTime: '11:00' }), tasks, ['t1']), false);
  assert.equal(taskStatesAgree(tasks.filter((item) => item.id !== 't1'), tasks, ['t1']), false, 'La pantalla aún muestra una tarea que ya no existe');
  assert.equal(taskStatesAgree(tasks.filter((item) => item.id !== 't1'), tasks.filter((item) => item.id !== 't1'), ['t1']), true);
  assert.equal(taskStatesAgree(replace('t1', { status: 'cancelled' }), tasks.filter((item) => item.id !== 't1'), ['t1']), true, 'Una tarea cancelada ya no se muestra y eso coincide');
  assert.equal(taskStatesAgree(replace('t1', { status: 'cancelled' }), tasks, ['t1']), false, 'La pantalla todavía la muestra: aún no se ha actualizado');
}

// --- 5. Descartar y guardar: ninguna escritura retrasada resucita ni borra de más ------------------------------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  t.manager.begin(identity);
  writeAndFlush(t);
  assert.equal(readDraft(storage, identity).record.revision, 1);
  // Edición pendiente + «Descartar propuesta»: la escritura retrasada no vuelve a crear el borrador.
  t.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 2), [], baseline));
  assert.equal(t.clock.pending(), 1);
  assert.equal(t.manager.drop(identity).status, 'removed');
  t.clock.run();
  assert.equal(readDraft(storage, identity).status, 'none', 'Una escritura retrasada no resucita un borrador descartado');
  t.manager.schedule(identity, content);
  t.clock.run();
  assert.equal(readDraft(storage, identity).status, 'none', 'Tras cerrar, schedule se ignora');
  assert.equal(t.manager.getView(identity).saveState, 'idle');

  // Guardado real confirmado: se elimina la revisión guardada, y solo esa.
  const saver = tab(storage, 'tab-2');
  saver.manager.begin(identity);
  writeAndFlush(saver);
  const savedRevision = saver.manager.checkpoint(identity);
  assert.equal(savedRevision, 1);
  assert.equal(saver.manager.completeSave(identity, savedRevision).status, 'removed');
  assert.equal(readDraft(storage, identity).status, 'none');
  saver.manager.schedule(identity, content);
  saver.clock.run();
  assert.equal(readDraft(storage, identity).status, 'none', 'Tras guardar, la pantalla no vuelve a escribir');

  // Si otra pestaña dejó una revisión más reciente mientras se guardaba, esa se conserva.
  const a = tab(storage, 'tab-a');
  const b = tab(storage, 'tab-b');
  a.manager.begin(identity);
  writeAndFlush(a);
  const revisionA = a.manager.checkpoint(identity);
  b.manager.begin(identity);
  b.manager.acceptRecord(identity, b.manager.getView(identity).stored);
  b.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 1), [], baseline));
  b.clock.run();
  assert.equal(readDraft(storage, identity).record.revision, revisionA + 1);
  assert.equal(a.manager.completeSave(identity, revisionA).status, 'conflict');
  assert.equal(readDraft(storage, identity).record.revision, revisionA + 1, 'La revisión más reciente de otra pestaña sigue ahí');
  // «Descartar propuesta» de una pantalla tampoco borra el borrador ajeno.
  const c = tab(storage, 'tab-c');
  c.manager.begin(identity);
  assert.equal(c.manager.getView(identity).decision, 'foreign');
  assert.equal(c.manager.drop(identity).status, 'absent');
  assert.equal(readDraft(storage, identity).status, 'ok');
  // Un guardado fallido no llama a completeSave: el borrador sigue recuperable (basta con no eliminarlo).
  assert.equal(readDraft(storage, identity).record.revision, revisionA + 1);
}

// --- 6. No sobrescribir durante la carga inicial ni mientras el usuario decide ---------------------------------
{
  const storage = new FakeStorage();
  const old = tab(storage, 'tab-old');
  old.manager.begin(identity);
  writeAndFlush(old);
  const before = storage.getItem(draftStorageKey(identity));

  const fresh = tab(storage, 'tab-new');
  fresh.manager.begin(identity);
  fresh.manager.schedule(identity, contentFromDraft([], [], { tasks: {}, availability: {} }));
  fresh.clock.run();
  assert.equal(storage.getItem(draftStorageKey(identity)), before, 'El estado inicial vacío no borra el borrador');
  fresh.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 1), [], baseline));
  fresh.clock.run();
  assert.equal(storage.getItem(draftStorageKey(identity)), before, 'Los cambios nuevos no pisan el borrador mientras se decide');
  assert.equal(fresh.manager.getView(identity).decision, 'foreign');
  assert.equal(fresh.manager.getView(identity).saveState, 'idle');

  // Descartar el anterior (elección explícita) reanuda el guardado de lo que hay en pantalla.
  assert.equal(fresh.manager.discard(identity).status, 'removed');
  assert.equal(readDraft(storage, identity).status, 'none');
  fresh.clock.run();
  const written = readDraft(storage, identity).record;
  assert.equal(written.revision, 1);
  assert.equal(written.taskCount, 1, 'Se conserva lo que había en pantalla');
}

// --- 7. Almacenamiento corrupto, antiguo, futuro o no disponible --------------------------------------------------
{
  const storage = new FakeStorage();
  const key = draftStorageKey(identity);
  const t = tab(storage, 'tab-1');
  for (const junk of ['{no json', 'null', '[]', '{"version":0}', JSON.stringify({ version: 1, userId: 'user-a', sedeId: 'sede-1', startDate: DATE, endDate: DATE, revision: 1, writerId: 'x', updatedAt: 'nunca', proposals: [], editedTaskIds: [], baseline: { tasks: {}, availability: {} } }),
    JSON.stringify({ version: 1, userId: 'user-a', sedeId: 'sede-1', startDate: DATE, endDate: DATE, revision: 1, writerId: 'x', updatedAt: new Date().toISOString(), proposals: [{ taskId: 5 }], editedTaskIds: [], baseline: { tasks: {}, availability: {} } })]) {
    storage.items[key] = junk;
    assert.notEqual(readDraft(storage, identity).status, 'ok', junk);
    t.manager.dismissCorruptNotice(identity);
    t.manager.refresh(identity);
    const view = t.manager.getView(identity);
    assert.equal(view.corruptRemoved, true, 'Se avisa de que había un borrador dañado');
    assert.equal(view.stored, null);
    assert.equal(key in storage.items, false, 'El borrador ilegible se retira');
    assert.equal(view.decision, 'none');
  }
  // Formato futuro: no se lee ni se sobrescribe.
  storage.items[key] = JSON.stringify({ version: 99, whatever: true });
  t.manager.refresh(identity);
  assert.equal(t.manager.getView(identity).unsupported, true);
  t.manager.begin(identity);
  t.manager.schedule(identity, content);
  t.clock.run();
  assert.equal(JSON.parse(storage.items[key]).version, 99, 'Nunca pisa un borrador de otra versión');
  assert.equal(t.manager.getView(identity).failure, 'unsupported');
  delete storage.items[key];

  // Almacenamiento lleno: no lanza, avisa y no anuncia «guardado».
  const full = new FakeStorage();
  full.failWrites = 'QuotaExceededError';
  const q = tab(full, 'tab-q');
  q.manager.begin(identity);
  q.manager.schedule(identity, content);
  q.clock.run();
  assert.equal(q.manager.getView(identity).saveState, 'failed');
  assert.equal(q.manager.getView(identity).failure, 'quota');
  assert.equal(q.manager.getView(identity).savedAt, null);
  full.failWrites = null;
  q.manager.flush(identity);
  assert.equal(q.manager.getView(identity).saveState, 'saved', 'Reintentar tras liberar espacio funciona');
  // Demasiado grande.
  const big = contentFromDraft(Array.from({ length: 1500 }, (_, i) => proposal(`big-${i}`, 'w1', { reasons: ['x'.repeat(200)], warnings: ['y'.repeat(200)], manualOverrideWarnings: ['z'.repeat(200)] })), [], { tasks: {}, availability: {} });
  q.manager.schedule(identity, big);
  q.clock.run();
  assert.equal(q.manager.getView(identity).failure, 'too-large');
  // Navegador sin almacenamiento o bloqueado.
  const none = tab(null, 'tab-none');
  none.manager.begin(identity);
  none.manager.schedule(identity, content);
  assert.equal(none.manager.getView(identity).saveState, 'failed');
  assert.equal(none.manager.getView(identity).storageAvailable, false);
  const blocked = new FakeStorage();
  blocked.blocked = true;
  const bl = tab(blocked, 'tab-bl');
  bl.manager.begin(identity);
  bl.manager.schedule(identity, content);
  bl.clock.run();
  assert.equal(bl.manager.getView(identity).storageAvailable, false);
  assert.notEqual(bl.manager.getView(identity).saveState, 'saved');
  // El planificador sigue funcionando: ninguna llamada lanzó.
}

// --- 8. Dos pestañas con distintas revisiones --------------------------------------------------------------------
{
  const storage = new FakeStorage();
  const a = tab(storage, 'tab-a');
  const b = tab(storage, 'tab-b');
  a.manager.begin(identity);
  writeAndFlush(a);
  b.manager.begin(identity);
  assert.equal(b.manager.getView(identity).decision, 'foreign');
  b.manager.acceptRecord(identity, b.manager.getView(identity).stored);
  b.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 2), ['t2'], baseline));
  b.clock.run();
  assert.equal(readDraft(storage, identity).record.revision, 2);
  const afterB = storage.getItem(draftStorageKey(identity));
  // La pestaña A sigue en la revisión 1 y quiere escribir: se detiene y pide elección, sin sobrescribir.
  a.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 1), [], baseline));
  a.clock.run();
  assert.equal(storage.getItem(draftStorageKey(identity)), afterB, 'No sobrescribe en silencio la versión más reciente');
  assert.equal(a.manager.getView(identity).decision, 'foreign');
  assert.equal(a.manager.getView(identity).stored.revision, 2);
  // También se entera por el evento de almacenamiento de otra pestaña.
  const c = tab(storage, 'tab-c');
  c.manager.begin(identity);
  c.manager.acceptRecord(identity, c.manager.getView(identity).stored);
  c.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 3), [], baseline));
  c.clock.run();
  b.target.emit('storage', { key: draftStorageKey(identity) });
  assert.equal(b.manager.getView(identity).decision, 'foreign', 'B detecta que C escribió una versión más reciente');
  // A elige quedarse con su pantalla: descarta la ajena y su contenido se escribe con la revisión siguiente.
  assert.equal(a.manager.discard(identity).status, 'conflict', 'A veía la revisión 2 y ya es la 3: no elimina una versión que no ha visto');
  assert.equal(a.manager.getView(identity).stored.revision, 3, 'Se vuelve a mostrar la versión nueva');
  assert.equal(a.manager.discard(identity).status, 'removed');
  a.clock.run();
  assert.equal(readDraft(storage, identity).record.revision, 1, 'Tras descartar, el borrador nuevo empieza de cero');
  assert.equal(readDraft(storage, identity).record.taskCount, 1);
  // Descartar una revisión que otra pestaña acaba de cambiar no elimina la nueva.
  const d = tab(storage, 'tab-d');
  d.manager.begin(identity);
  const shown = d.manager.getView(identity).stored.revision;
  const e = tab(storage, 'tab-e');
  e.manager.begin(identity);
  e.manager.acceptRecord(identity, e.manager.getView(identity).stored);
  e.manager.schedule(identity, contentFromDraft(draftProposals.slice(0, 2), [], baseline));
  e.clock.run();
  assert.equal(d.manager.discard(identity).status, 'conflict');
  assert.equal(readDraft(storage, identity).record.revision, shown + 1);
  assert.equal(d.manager.getView(identity).stored.revision, shown + 1, 'Se muestra la versión nueva y se vuelve a pedir elección');
  // Otra pestaña eliminó el borrador (por ejemplo, tras guardar): no se resucita sin pedirlo.
  const f = tab(storage, 'tab-f');
  f.manager.begin(identity);
  f.manager.acceptRecord(identity, f.manager.getView(identity).stored);
  const g = tab(storage, 'tab-g');
  g.manager.begin(identity);
  g.manager.acceptRecord(identity, g.manager.getView(identity).stored);
  assert.equal(g.manager.completeSave(identity, g.manager.getView(identity).stored.revision).status, 'removed');
  f.manager.schedule(identity, content);
  f.clock.run();
  assert.equal(readDraft(storage, identity).status, 'none', 'No resucita un borrador que otra pestaña eliminó');
  assert.equal(f.manager.getView(identity).removedElsewhere, true);
  f.manager.resume(identity);
  f.clock.run();
  assert.equal(readDraft(storage, identity).status, 'ok', 'Con «volver a conservarlo» se escribe de nuevo');
}

// --- 9. Caducidad y limpieza ------------------------------------------------------------------------------------
{
  const storage = new FakeStorage();
  const t = tab(storage, 'tab-1');
  const old = { ...identity, startDate: '2026-08-01', endDate: '2026-08-01' };
  t.manager.begin(old);
  writeAndFlush(t, old);
  const mine = { ...identity, startDate: '2026-10-20', endDate: '2026-10-20' };
  t.manager.begin(mine);
  writeAndFlush(t, mine);
  const theirs = { ...old, userId: 'user-z' };
  t.manager.begin(theirs);
  writeAndFlush(t, theirs);
  t.clock.advance(PLANNING_DRAFT_MAX_AGE_MS + 1000);
  const result = listDrafts(storage, 'user-a', 'sede-1', { now: t.clock.now(), cleanup: true });
  assert.equal(result.cleaned, 2, 'Se limpian los borradores caducados de este usuario');
  assert.equal(result.drafts.length, 0);
  assert.equal(readDraft(storage, theirs).status, 'ok', 'Los de otros usuarios no se tocan');
  assert.ok(Object.keys(storage.items).every((key) => key.startsWith(PLANNING_DRAFT_KEY_PREFIX)));
}

// --- 10. Texto del aviso (Europe/Madrid) ------------------------------------------------------------------------------
{
  const now = new Date(Date.UTC(2026, 9, 17, 20, 0));
  const summary = { identity, updatedAt: '2026-10-17T16:42:00.000Z', taskCount: 8 };
  assert.equal(describeStoredDraft(summary, now), 'Tienes un reparto sin guardar del 17/10, modificado a las 18:42. Afecta a 8 tareas.');
  assert.equal(describeStoredDraft({ ...summary, taskCount: 1 }, now), 'Tienes un reparto sin guardar del 17/10, modificado a las 18:42. Afecta a 1 tarea.');
  assert.match(describeStoredDraft({ ...summary, updatedAt: '2026-10-15T22:30:00.000Z' }, now), /modificado el 16\/10 a las 00:30/, 'Usa el día de Madrid (en UTC aún sería el 15/10)');
  assert.match(describeStoredDraft({ ...summary, updatedAt: '2026-10-16T22:30:00.000Z' }, now), /modificado a las 00:30/, 'A las 00:30 de Madrid ya es el 17/10, hoy');
  assert.match(describeStoredDraft({ ...summary, identity: { ...identity, endDate: '2026-10-23' } }, now), /del 17\/10 al 23\/10/);
  assert.equal(presetForDraftPeriod(DATE, DATE), 'today');
  assert.equal(presetForDraftPeriod(DATE, '2026-10-23'), '7d');
  assert.equal(presetForDraftPeriod(DATE, '2026-11-15'), '30d');
  assert.equal(presetForDraftPeriod(DATE, '2026-10-20'), null);
}

// --- 11. Recuperar y descartar no tocan tareas reales ni comunican nada ---------------------------------------------------------
{
  const files = [
    'src/utils/cleaning-planning/planningDraftStore.ts', 'src/utils/cleaning-planning/planningDraftManager.ts',
    'src/utils/cleaning-planning/planningDraftRecovery.ts', 'src/utils/cleaning-planning/planningDraftText.ts',
    'src/hooks/usePlanningDraft.ts', 'src/hooks/usePlanningDraftRecovery.ts', 'src/components/cleaning-planning/PlanningDraftNotice.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(!/supabase|taskStorage|taskAssignment|multipleTask|useCleaningPlanningActions|notification|email|fetch/i.test(specifier), `${file} importa ${specifier}`);
    }
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|supabase/.test(source), `${file} no usa red`);
  }
  const panel = readFileSync('src/components/cleaning-planning/AssignmentProposalPanel.tsx', 'utf8');
  assert.ok(!/sessionStorage/.test(panel), 'El borrador ya no se restaura en silencio desde sessionStorage');
  // El recuperador solo lee tareas (refetch) y entrega propuestas a la pantalla: nunca llama a applyProposal.
  const recoveryHook = readFileSync('src/hooks/usePlanningDraftRecovery.ts', 'utf8');
  assert.ok(!/applyProposal|setTaskAssignments|updateTask/.test(recoveryHook));
}

// --- 12. Huella de contenido: la hora de modificación solo cambia si cambia el borrador -----------------------------------
{
  assert.equal(draftContentFingerprint(content), draftContentFingerprint({ ...content, baseline: { tasks: {}, availability: {} } }));
  assert.notEqual(draftContentFingerprint(content), draftContentFingerprint({ ...content, editedTaskIds: [] }));
  assert.equal(parseDraftRecord('{', identity).status, 'invalid');
}

console.log('planning-draft-recovery: OK (reconstrucción exacta, equipos, desasignaciones y horarios; aislamiento usuario/sede/día; validación parcial con cancelada/completada/cambios; descarte y guardado sin carreras; carga inicial; corrupto/lleno/bloqueado/versión futura; dos pestañas; caducidad; Madrid; sin red)');
