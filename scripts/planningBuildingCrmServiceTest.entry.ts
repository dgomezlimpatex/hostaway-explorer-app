import type { Cleaner } from '../src/types/calendar';
import type { Property } from '../src/types/property';
import type { CleanerGroupAssignment, PropertyGroup } from '../src/types/propertyGroups';
import { buildPlanningBuildingCrmProfile } from '../src/services/planning/buildingCrmAggregator';

type Assert = typeof import('node:assert/strict');

type BuildingCrmTaskFixture = {
  id: string;
  property: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  propiedad_id: string | null;
  cleaner_id?: string | null;
  cleaner?: string | null;
  task_assignments?: Array<{ cleaner_id: string; cleaner_name: string }> | null;
};

const stamp = '2026-07-01T00:00:00.000Z';

const group: PropertyGroup = {
  id: 'group-md18',
  name: 'MD18',
  displayName: 'Marina 18',
  internalCode: 'MD18',
  zone: 'A Coruña',
  clientName: 'Turquoise',
  supervisorName: 'Dani',
  recommendedCapacity: 2,
  planningNotes: 'Edificio de prueba',
  checkOutTime: '11:00',
  checkInTime: '15:00',
  isActive: true,
  autoAssignEnabled: true,
  createdAt: stamp,
  updatedAt: stamp,
};

const property = (overrides: Partial<Property>): Property => ({
  id: overrides.id || 'property-md18-1',
  created_at: stamp,
  updated_at: stamp,
  codigo: overrides.codigo || 'MD18.1',
  nombre: overrides.nombre || 'Marina 18 · 1A',
  direccion: overrides.direccion || 'Marina 18',
  numeroCamas: 1,
  numeroCamasPequenas: 0,
  numeroCamasSuite: 0,
  numeroSofasCama: 0,
  numeroBanos: 1,
  numeroCocinas: 1,
  duracionServicio: overrides.duracionServicio ?? 120,
  costeServicio: 50,
  planningRequiredCleaners: overrides.planningRequiredCleaners ?? 1,
  checkInPredeterminado: '15:00',
  checkOutPredeterminado: '11:00',
  numeroSabanas: 0,
  numeroSabanasRequenas: 0,
  numeroSabanasSuite: 0,
  numeroToallasGrandes: 0,
  numeroTotallasPequenas: 0,
  numeroAlfombrines: 0,
  numeroFundasAlmohada: 0,
  kitAlimentario: 0,
  amenitiesBano: 0,
  amenitiesCocina: 0,
  cantidadRollosPapelHigienico: 0,
  cantidadRollosPapelCocina: 0,
  bayetasCocina: 0,
  bolsasBasura: 0,
  notas: '',
  clienteId: 'client-1',
  hostaway_listing_id: null,
  hostaway_internal_name: null,
  linenControlEnabled: null,
  isActive: true,
  clientIsActive: true,
  clientName: 'Turquoise',
  excludeFromExport: false,
  fechaCreacion: stamp,
  fechaActualizacion: stamp,
  ...overrides,
});

const cleaner = (id: string, name: string, planningMaxDailyMinutes = 360): Cleaner => ({
  id,
  name,
  isActive: true,
  planningMaxDailyMinutes,
  planningZone: 'A Coruña',
  created_at: stamp,
  updated_at: stamp,
});

const assignment = (
  cleanerId: string,
  roleType: CleanerGroupAssignment['roleType'],
  isActive = true,
  priority = 1,
): CleanerGroupAssignment => ({
  id: `assignment-${cleanerId}-${roleType}`,
  propertyGroupId: 'group-md18',
  cleanerId,
  priority,
  roleType,
  knowledgeLevel: roleType === 'backup' ? 2 : 4,
  maxTasksPerDay: 6,
  maxDailyMinutesOverride: null,
  estimatedTravelTimeMinutes: 10,
  notes: roleType === 'excluded' ? 'No apta por incidencia operativa' : null,
  isActive,
  createdAt: stamp,
  updatedAt: stamp,
});

const task = (overrides: Partial<BuildingCrmTaskFixture>): BuildingCrmTaskFixture => ({
  id: overrides.id || 'task-md18-1',
  property: overrides.property || 'MD18.1',
  date: overrides.date || '2026-07-09',
  start_time: overrides.start_time || '11:00',
  end_time: overrides.end_time || '13:00',
  status: overrides.status || 'pending',
  type: overrides.type || 'limpieza-turistica',
  propiedad_id: overrides.propiedad_id || 'property-md18-1',
  cleaner_id: overrides.cleaner_id ?? null,
  cleaner: overrides.cleaner ?? null,
  task_assignments: overrides.task_assignments ?? null,
});

const buildBaseProfile = (overrides: Parameters<typeof buildPlanningBuildingCrmProfile>[0] extends infer Input ? Partial<Input> : never = {}) => buildPlanningBuildingCrmProfile({
  propertyGroupId: 'group-md18',
  dateFrom: '2026-07-09',
  dateTo: '2026-07-11',
  fallbackDailyCapacityMinutes: 360,
  propertyGroups: [group],
  propertyGroupAssignments: [
    { property_group_id: 'group-md18', property_id: 'property-md18-1' },
    { property_group_id: 'group-md18', property_id: 'property-md18-large' },
    { property_group_id: 'group-md18', property_id: 'property-md18-missing-duration' },
  ],
  properties: [
    property({ id: 'property-md18-1', codigo: 'MD18.1', duracionServicio: 120, planningRequiredCleaners: 1 }),
    property({ id: 'property-md18-large', codigo: 'MD18.3', nombre: 'Casa grande MD18', duracionServicio: 390, planningRequiredCleaners: 3 }),
    property({ id: 'property-md18-missing-duration', codigo: 'MD18.0', nombre: 'MD18 sin duración', duracionServicio: 0, planningRequiredCleaners: 1 }),
  ],
  cleaners: [cleaner('ana', 'Ana'), cleaner('bea', 'Bea'), cleaner('carla', 'Carla'), cleaner('marta', 'Marta')],
  cleanerGroupAssignments: [
    assignment('ana', 'primary', true, 1),
    assignment('bea', 'secondary', true, 2),
    assignment('carla', 'backup', true, 3),
    assignment('marta', 'excluded', false, 99),
  ],
  tasks: [
    task({ id: 'task-normal', propiedad_id: 'property-md18-1', property: 'MD18.1', date: '2026-07-09', task_assignments: [{ cleaner_id: 'ana', cleaner_name: 'Ana' }] }),
    task({ id: 'task-large', propiedad_id: 'property-md18-large', property: 'MD18.3', date: '2026-07-09' }),
    task({ id: 'task-missing-duration', propiedad_id: 'property-md18-missing-duration', property: 'MD18.0', date: '2026-07-10' }),
    task({ id: 'task-excluded-worker', propiedad_id: 'property-md18-1', property: 'MD18.1', date: '2026-07-11', task_assignments: [{ cleaner_id: 'marta', cleaner_name: 'Marta' }] }),
  ],
  forecastItems: [
    { id: 'forecast-md18-1', source: 'hostaway', propertyId: 'property-md18-1', date: '2026-07-10', durationMinutes: 120, requiredCleaners: 1, serviceKind: 'checkout' },
  ],
  teamAvailability: [
    { cleanerId: 'ana', date: '2026-07-09', availableMinutes: 360, isAvailable: true },
    { cleanerId: 'bea', date: '2026-07-09', availableMinutes: 360, isAvailable: true },
    { cleanerId: 'carla', date: '2026-07-09', availableMinutes: 180, isAvailable: true },
    { cleanerId: 'ana', date: '2026-07-10', availableMinutes: 0, isAvailable: false },
    { cleanerId: 'bea', date: '2026-07-10', availableMinutes: 360, isAvailable: true },
    { cleanerId: 'carla', date: '2026-07-10', availableMinutes: 180, isAvailable: true },
    { cleanerId: 'ana', date: '2026-07-11', availableMinutes: 360, isAvailable: true },
    { cleanerId: 'bea', date: '2026-07-11', availableMinutes: 360, isAvailable: true },
  ],
  ...overrides,
});

export const run = async (assert: Assert) => {
  const profile = buildBaseProfile();

  assert.equal(profile.building.id, 'group-md18');
  assert.equal(profile.building.displayName, 'Marina 18');
  assert.equal(profile.properties.length, 3);
  assert.equal(profile.team.length, 4, 'CRM must show active team and No apta/excluded rows');
  assert.equal(profile.summary.assignedPrimaryCount, 1);
  assert.equal(profile.summary.assignedSecondaryCount, 1);
  assert.equal(profile.summary.assignedBackupCount, 1);
  assert.equal(profile.summary.excludedCount, 1);

  const firstDay = profile.days.find((day) => day.date === '2026-07-09');
  assert.ok(firstDay, '2026-07-09 day must exist');
  assert.equal(firstDay.confirmedCleanings, 2);
  assert.equal(firstDay.forecastCleanings, 0);
  assert.equal(firstDay.serviceMinutes, 510, 'Daily service minutes must sum property durations only');
  assert.equal(firstDay.personMinutes, 1290, 'Large homes must multiply duration by planningRequiredCleaners');
  assert.equal(firstDay.requiredCleanerSlots, 4);
  assert.equal(firstDay.status, 'critical', 'Peak demand above assigned team availability must be critical');

  const forecastDay = profile.days.find((day) => day.date === '2026-07-10');
  assert.ok(forecastDay, '2026-07-10 day must exist without UTC date drift');
  assert.equal(forecastDay.confirmedCleanings, 1);
  assert.equal(forecastDay.forecastCleanings, 1);
  assert.ok(forecastDay.warnings.some((warning) => warning.includes('Previsto')));

  assert.equal(profile.summary.confirmedCleanings, 4);
  assert.equal(profile.summary.forecastCleanings, 1);
  assert.equal(profile.summary.serviceMinutes, 750);
  assert.equal(profile.summary.personMinutes, 1530);
  assert.equal(profile.summary.recommendedStableStaff, 4);
  assert.equal(profile.summary.missingDurationProperties, 1);
  assert.equal(profile.summary.status, 'critical');

  assert.ok(profile.decisions.some((decision) => decision.category === 'missing-duration' && decision.propertyCode === 'MD18.0'));
  assert.ok(profile.decisions.some((decision) => decision.category === 'capacity' && decision.date === '2026-07-09'));
  assert.ok(profile.decisions.some((decision) => decision.category === 'forecast-not-created' && decision.date === '2026-07-10'));
  assert.ok(profile.decisions.some((decision) => decision.category === 'excluded-worker' && decision.cleanerId === 'marta'));

  const empty = buildBaseProfile({ tasks: [], forecastItems: [] });
  assert.equal(empty.summary.status, 'empty');
  assert.equal(empty.days.length, 3);
  assert.deepEqual(empty.days.map((day) => day.date), ['2026-07-09', '2026-07-10', '2026-07-11']);
};
