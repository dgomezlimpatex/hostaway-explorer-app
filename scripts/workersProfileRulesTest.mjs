// Reglas de Trabajadores sobre el código real (sin red ni Supabase):
// permisos/capacidades, formulario de ficha y alta, estado «Hoy», ventana del planificador.
import { build } from 'esbuild';
import assert from 'node:assert/strict';

const load = async (entry, contents) => {
  const options = contents ? { stdin: { contents, resolveDir: process.cwd(), loader: 'ts' } } : { entryPoints: [entry] };
  const result = await build({ ...options, bundle: true, format: 'esm', write: false, platform: 'node', logLevel: 'silent' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
};

// Un solo paquete para que las capacidades lean la misma matriz que se modifica en la prueba.
const { perms, caps } = await load(null, "export * as perms from './src/lib/rolePermissions'; export * as caps from './src/lib/roleCapabilities';");
const form = await load('src/features/personnel/workerForm.ts');
const status = await load('src/components/workers/absences/availabilityStatus.ts');
const windowModule = await load('src/features/personnel/planningWindow.ts');
const summary = await load('src/features/personnel/profileSummary.ts');

// --- Permisos: matriz vigente sin cambios; contrato final de supervisión preparado ---------------
const full = { canView: true, canCreate: true, canEdit: true, canDelete: true };
for (const role of ['admin', 'manager']) {
  for (const module of ['calendar', 'tasks', 'workers', 'clients']) {
    assert.deepEqual(perms.getRolePermissions(role)[module], full, `${role}.${module} conserva todo`);
  }
}
const sup = perms.getRolePermissions('supervisor');
assert.deepEqual(sup.workers, { canView: true, canCreate: false, canEdit: false, canDelete: false }, 'supervisor.workers sigue en consulta');
assert.deepEqual(sup.calendar, { canView: true, canCreate: false, canEdit: false, canDelete: false }, 'supervisor.calendar sin activar edición');
assert.deepEqual(sup.tasks, { canView: true, canCreate: false, canEdit: false, canDelete: false }, 'supervisor.tasks sin cambios');
assert.equal(sup.clients.canView, false, 'supervisor.clients sin acceso hasta la activación');
assert.equal(sup.admin.canView, false);
assert.equal(sup.users.canView, false);
const contract = caps.SUPERVISOR_OPERATIONAL_CONTRACT;
for (const module of ['calendar', 'clients', 'workers']) {
  assert.deepEqual(contract[module], { canView: true, canCreate: false, canEdit: true, canDelete: false }, `contrato ${module}`);
}
assert.ok(!('tasks' in contract) && !('admin' in contract) && !('users' in contract), 'el contrato no toca tasks/admin/users');

// --- Capacidades ----------------------------------------------------------------------------
for (const role of ['admin', 'manager']) {
  assert.equal(caps.canViewSensitiveWorkerData(role), true);
  assert.equal(caps.canManageWorkerAccounts(role), true);
  assert.equal(caps.canEditOperational(role, 'workers'), true);
  assert.equal(caps.canEditAbsenceType(role, 'sick'), true);
}
for (const role of ['supervisor', 'cleaner', 'logistics', null, undefined, 'desconocido']) {
  assert.equal(caps.canViewSensitiveWorkerData(role), false, `${role} no ve PIN/DNI/tipo médico`);
  assert.equal(caps.canManageWorkerAccounts(role), false, `${role} no administra cuentas`);
  assert.equal(caps.canEditOperational(role, 'workers'), false, `${role} sin edición hoy`);
  assert.deepEqual(caps.filterWorkerUpdateForRole(role, { name: 'X', isActive: true }), {}, `${role} no envía cambios`);
}
assert.deepEqual(
  caps.filterWorkerUpdateForRole('manager', { name: 'X', isActive: true, pin: '1', dni: '2' }),
  { name: 'X', isActive: true },
  'gerencia: nunca PIN ni DNI desde la ficha',
);
assert.equal(caps.absenceLabelForViewer('sick', { sick: 'Baja médica' }, false), 'Ausencia');
assert.equal(caps.absenceLabelForViewer('personal', { personal: 'Personal' }, false), 'Ausencia');
assert.equal(caps.absenceLabelForViewer('vacation', { vacation: 'Vacaciones' }, false), 'Vacaciones');
assert.equal(caps.absenceLabelForViewer('sick', { sick: 'Baja médica' }, true), 'Baja médica');

// Contrato final aplicado (simulación de la activación): supervisión edita operativa, nunca cuentas ni tipos sensibles.
const activated = { ...perms.ROLE_PERMISSIONS, supervisor: { ...perms.ROLE_PERMISSIONS.supervisor, ...contract } };
const original = perms.ROLE_PERMISSIONS.supervisor;
perms.ROLE_PERMISSIONS.supervisor = activated.supervisor;
try {
  assert.equal(caps.canEditOperational('supervisor', 'workers'), true);
  assert.equal(caps.canEditOperational('supervisor', 'calendar'), true);
  assert.equal(caps.canEditOperational('supervisor', 'clients'), true);
  assert.equal(caps.canManageWorkerAccounts('supervisor'), false);
  assert.equal(caps.canViewSensitiveWorkerData('supervisor'), false);
  assert.deepEqual(
    caps.filterWorkerUpdateForRole('supervisor', { telefono: '600', contractHoursPerWeek: 20, isActive: false, category: 'X' }),
    { telefono: '600', contractHoursPerWeek: 20, category: 'X' },
    'supervisión no cambia el estado de la cuenta',
  );
  assert.equal(caps.canEditAbsenceType('supervisor', 'vacation'), true);
  assert.equal(caps.canEditAbsenceType('supervisor', 'sick'), false);
  assert.equal(caps.canEditAbsenceType('supervisor', 'personal'), false);
  assert.equal(perms.getRolePermissions('supervisor').clients.canDelete, false);
  assert.equal(perms.getRolePermissions('supervisor').tasks.canEdit, false, 'activar no abre planificación');
} finally {
  perms.ROLE_PERMISSIONS.supervisor = original;
}

// --- TRAB-01: el puesto no estándar se conserva -------------------------------------------------
const cristalera = { name: 'Persona Cuatro', email: 'p4@example.test', telefono: '600000004', category: 'Cristalera', startDate: '2025-03-01', contractHoursPerWeek: 40 };
let values = form.workerFormFromSource(cristalera);
assert.deepEqual(form.buildWorkerUpdate(cristalera, { ...values, telefono: '600000044' }), { telefono: '600000044' }, 'solo el teléfono');
assert.deepEqual(form.categoryOptions('Cristalera'), ['Cristalera', 'Operario de limpieza', 'Supervisor', 'Administrador']);
assert.deepEqual(form.categoryOptions('Supervisor'), ['Operario de limpieza', 'Supervisor', 'Administrador']);
assert.equal(form.isNonStandardCategory('supervisora'), true, 'no se normaliza a otro valor');
assert.equal(form.categoryLabel(null), 'Sin puesto');
assert.equal(form.categoryLabel('  '), 'Sin puesto');
const noCategory = { ...cristalera, category: null };
assert.deepEqual(form.buildWorkerUpdate(noCategory, { ...form.workerFormFromSource(noCategory), name: 'Persona Cuatro B' }), { name: 'Persona Cuatro B' }, 'sin puesto: no se inventa uno');
assert.equal(form.hasWorkerChanges(cristalera, values), false);

// --- TRAB-03: validación compartida -----------------------------------------------------------
const bad = (patch) => form.validateWorkerForm({ ...values, ...patch });
for (const hours of ['-5', '80,25', '200', '37,3', '37.3', 'abc']) {
  assert.ok(bad({ contractHours: hours }).contractHours, `horas «${hours}» rechazadas`);
}
for (const hours of ['37,25', '37.25', '0', '80', '', '20,5', '7,75']) {
  assert.equal(bad({ contractHours: hours }).contractHours, undefined, `horas «${hours}» admitidas`);
}
assert.ok(bad({ email: 'no-es-correo' }).email);
assert.equal(bad({ email: '' }).email, undefined, 'correo vacío admitido');
assert.ok(bad({ name: '   ' }).name);
assert.equal(form.parseHours(''), null);
assert.deepEqual(form.buildWorkerUpdate(cristalera, { ...values, contractHours: '37,25' }), { contractHoursPerWeek: 37.25 });
assert.deepEqual(form.buildWorkerUpdate(cristalera, { ...values, contractHours: '' }), { contractHoursPerWeek: 0 }, 'vacío = 0 como antes');

// --- TRAB-04: borrar la fecha de alta se envía explícitamente -------------------------------------
assert.deepEqual(form.buildWorkerUpdate(cristalera, { ...values, startDate: '' }), { startDate: '' });
const mappers = await load('src/services/storage/mappers/cleanerMappers.ts');
assert.deepEqual(mappers.mapCleanerToDB({ startDate: '' }), { start_date: null }, 'el mapper guarda null');

// --- TRAB-15: posibles duplicados -------------------------------------------------------------
const team = [
  { id: 'w1', name: 'Persona Uno Ejemplo', email: 'w1@example.test', telefono: '+34 600 000 001', isActive: true },
  { id: 'w5', name: 'Persona Cinco', email: null, telefono: '', isActive: false },
];
assert.deepEqual(form.findPossibleDuplicates(team, { name: 'persona  uno ejémplo' }).map((d) => d.reasons), [['nombre']]);
assert.deepEqual(form.findPossibleDuplicates(team, { name: 'Otra', email: 'W1@example.test' }).map((d) => d.reasons), [['correo']]);
assert.deepEqual(form.findPossibleDuplicates(team, { name: 'Otra', telefono: '600000001' }).map((d) => d.reasons), [['teléfono']]);
assert.equal(form.findPossibleDuplicates(team, { name: 'Persona Cinco' })[0].isActive, false, 'avisa también de inactivos');
assert.deepEqual(form.findPossibleDuplicates(team, { name: 'Nadie', telefono: '123' }), [], 'teléfonos cortos no cuentan');

// --- TRAB-21: «hoy» en Madrid -----------------------------------------------------------------
// 00:30 en Madrid del 21/10/2026 (CEST) = 22:30 UTC del 20/10.
const nearMidnight = new Date('2026-10-20T22:30:00Z');
assert.equal(status.madridTodayKey(nearMidnight), '2026-10-21');
assert.equal(status.countUpcomingAbsences([{ endDate: '2026-10-20' }, { endDate: '2026-10-21' }], status.madridTodayKey(nearMidnight)), 1, 'la que terminó ayer no cuenta');
// Invierno (CET): 00:30 del 15/01/2027 = 23:30 UTC del 14/01.
assert.equal(status.madridTodayKey(new Date('2027-01-14T23:30:00Z')), '2027-01-15');

// --- TRAB-12: estado genérico «Hoy» ----------------------------------------------------------
const sources = {
  absences: [
    { cleanerId: 'w1', startDate: '2026-10-19', endDate: '2026-10-23', startTime: null, endTime: null, absenceType: 'sick', notes: 'privado' },
    { cleanerId: 'w2', startDate: '2026-10-21', endDate: '2026-10-21', startTime: '09:00:00', endTime: '12:00:00' },
  ],
  fixedDaysOff: [{ cleanerId: 'w6', dayOfWeek: 3, isActive: true }, { cleanerId: 'w7', dayOfWeek: 3, isActive: false }],
  schedules: [{ cleanerId: 'w3', daysOfWeek: [3], isActive: true, scheduleType: 'unavailability', startTime: '14:45:00', endTime: '23:00:00' },
    { cleanerId: 'w4', daysOfWeek: [3], isActive: true, scheduleType: 'maintenance', startTime: '08:00:00', endTime: '09:00:00' }],
  weekly: [{ cleaner_id: 'w8', day_of_week: 3, is_available: false }],
};
const day = (id) => status.dayStatusText(status.dayStatusFor(id, '2026-10-21', sources)); // miércoles
assert.equal(day('w1'), 'Ausente');
assert.equal(day('w2'), 'Ausente 09:00–12:00');
assert.equal(day('w6'), 'Día libre fijo');
assert.equal(day('w7'), 'Disponible', 'día libre inactivo no cuenta');
assert.equal(day('w3'), 'No disponible 14:45–23:00');
assert.equal(day('w4'), 'Disponible', 'un mantenimiento no es no disponibilidad');
assert.equal(day('w8'), 'No disponible (horario semanal)');
for (const id of ['w1', 'w2', 'w3', 'w6', 'w8']) {
  const text = day(id);
  assert.ok(!/baja|médic|privado/i.test(text), `«${text}» no revela el motivo`);
}

// --- TRAB-10: ventana del planificador = misma función que el planificador ------------------------
const availability = await load('src/utils/cleaning-planning/availability.ts');
const rows = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ cleaner_id: 'w1', day_of_week: d, is_available: d !== 0, start_time: '06:00:00', end_time: d === 6 ? '14:00:00' : '23:00:00' }));
const described = windowModule.describePlanningWindow({ id: 'w1', planningMaxDailyMinutes: 360 }, rows);
assert.deepEqual(described.map((d) => d.day), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
assert.equal(windowModule.planningWindowText(described[0]), '06:00–23:00');
assert.equal(windowModule.planningWindowText(described[5]), '06:00–14:00');
assert.equal(windowModule.planningWindowText(described[6]), 'No disponible');
// Comparación directa con el planificador para una fecha real (miércoles 21/10/2026).
const planner = availability.buildEffectiveAvailabilityForDate({ cleaner: { id: 'w1' }, date: '2026-10-21', weeklyAvailability: rows, fallbackCapacityMinutes: 360 });
assert.deepEqual(described[2].windows, planner.availableWindows);
assert.equal(described[2].available, planner.isAvailable);
const fallback = windowModule.describePlanningWindow({ id: 'w9', planningMaxDailyMinutes: null }, rows);
assert.ok(fallback.every((d) => d.source === 'contract_fallback'));
assert.match(windowModule.planningWindowText(fallback[0]), /^Sin horario propio \(estimado 09:00–17:00\)$/);
assert.equal(windowModule.minutesAsHours(360), '6 h');
assert.equal(windowModule.minutesAsHours(450), '7,5 h');

// --- TRAB-14: tareas pasadas sin completar --------------------------------------------------------
const lines = [
  { source: 'task', phase: 'elapsed', status: 'pending', sourceId: 't1' },
  { source: 'task', phase: 'elapsed', status: 'completed', sourceId: 't2' },
  { source: 'task', phase: 'future', status: 'pending', sourceId: 't3' },
  { source: 'maintenance', phase: 'elapsed', status: 'pending', sourceId: 'm1' },
  { source: 'task', phase: 'elapsed', status: 'in-progress', sourceId: 't4' },
  { source: 'task', phase: 'elapsed', status: 'pending', sourceId: 't4' },
];
assert.equal(summary.pastUncompletedTaskCount({ lines }), 2);

console.log('workers-profile-rules-tests: OK');
