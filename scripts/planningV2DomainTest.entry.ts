import { buildCleanerCapacity, requiredCleanerCountForProperty } from '../src/services/planning/cleanerCapacity';
import { rankCleanerCandidates, rankTeamCandidates } from '../src/services/planning/assignmentScoring';
import { deriveBuildingCode, groupPropertyByCode, groupPropertiesByBuilding } from '../src/services/planning/propertyCodeGrouping';
import { buildCleaningWindow } from '../src/services/planning/planningWindows';
import type { AssignmentScoringInput, PlanningV2CleanerRef, PlanningV2PropertyRef, PlanningV2TaskRef } from '../src/types/planningV2';

export async function run(assert: typeof import('node:assert/strict')) {
  const md18 = deriveBuildingCode('MD18.1B');
  assert.equal(md18.buildingCode, 'MD18');
  assert.equal(md18.kind, 'building');

  const single = deriveBuildingCode('PISOAZUL');
  assert.equal(single.buildingCode, 'PISOAZUL');
  assert.equal(single.kind, 'single_property');

  const property: PlanningV2PropertyRef = { id: 'prop-1', code: 'MD18.1', sedeId: 'a-coruna' };
  const grouping = groupPropertyByCode(property);
  assert.equal(grouping.workCenterId, 'prop-1');
  assert.equal(grouping.buildingGroupId, 'a-coruna:MD18');

  const grouped = groupPropertiesByBuilding([
    property,
    { id: 'prop-2', code: 'MD18.1B', sedeId: 'a-coruna' },
    { id: 'prop-3', code: 'MD18.1', sedeId: 'ourense' },
  ]);
  assert.equal(grouped['a-coruna:MD18'].length, 2);
  assert.equal(grouped['ourense:MD18'].length, 1);

  const cleaningWindow = buildCleaningWindow({
    taskId: 'task-1',
    propertyId: 'prop-1',
    checkoutAt: '2026-07-01T10:00:00+02:00',
    checkinAt: '2026-07-01T15:00:00+02:00',
    durationMinutes: 180,
  });
  assert.equal(cleaningWindow.status, 'ready');
  assert.equal(cleaningWindow.availableMinutes, 240);
  assert.equal(cleaningWindow.startsAt?.toISOString(), '2026-07-01T08:30:00.000Z');
  assert.equal(cleaningWindow.endsAt?.toISOString(), '2026-07-01T12:30:00.000Z');

  const tightWindow = buildCleaningWindow({
    taskId: 'task-tight',
    propertyId: 'prop-1',
    checkoutAt: '2026-07-01T10:00:00+02:00',
    checkinAt: '2026-07-01T12:00:00+02:00',
    durationMinutes: 90,
  });
  assert.equal(tightWindow.status, 'insufficient_time');

  const cleaners: PlanningV2CleanerRef[] = [
    { id: 'ana', name: 'Ana', sedeId: 'a-coruna', maxMinutesPerDay: 420, homeBuildingGroupIds: ['a-coruna:MD18'] },
    { id: 'bea', name: 'Bea', sedeId: 'a-coruna', maxMinutesPerDay: 420, preferredPropertyIds: ['prop-1'] },
    { id: 'cris', name: 'Cris', sedeId: 'ourense', maxMinutesPerDay: 420 },
  ];

  const existingTasks: PlanningV2TaskRef[] = [
    {
      id: 'existing-multi',
      propertyId: 'prop-x',
      sedeId: 'a-coruna',
      startsAt: '2026-07-01T06:00:00.000Z',
      endsAt: '2026-07-01T07:30:00.000Z',
      durationMinutes: 90,
      cleanerIds: ['ana', 'bea'],
      requiredCleaners: 2,
    },
  ];

  const loads = buildCleanerCapacity(cleaners, existingTasks);
  assert.equal(loads.ana.assignedMinutes, 90);
  assert.equal(loads.ana.multiPersonTaskCount, 1);
  assert.equal(loads.bea.assignedTaskCount, 1);

  const scoringInput: AssignmentScoringInput = {
    taskId: 'task-1',
    property: { ...property, estimatedCleaningMinutes: 180 },
    window: cleaningWindow,
    cleaners,
    loads,
    availabilityWindows: [
      { cleanerId: 'ana', startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-01T13:00:00.000Z' },
      { cleanerId: 'bea', startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-01T13:00:00.000Z' },
      { cleanerId: 'cris', startsAt: '2026-07-01T08:00:00.000Z', endsAt: '2026-07-01T13:00:00.000Z' },
    ],
    existingAssignments: existingTasks,
  };

  const ranked = rankCleanerCandidates(scoringInput);
  assert.equal(ranked[0].canAssign, true);
  assert.notEqual(ranked[0].cleanerId, 'cris');
  const cris = ranked.find((candidate) => candidate.cleanerId === 'cris');
  assert.ok(cris?.rejectionCodes.includes('different_sede'));

  const teamCandidates = rankTeamCandidates({
    ...scoringInput,
    property: { ...scoringInput.property, isLargeHome: true },
    requiredCleaners: requiredCleanerCountForProperty({ isLargeHome: true }),
  });
  assert.equal(teamCandidates[0].canAssign, true);
  assert.deepEqual(teamCandidates[0].cleanerIds.sort(), ['ana', 'bea']);

  const overCapacity = rankCleanerCandidates({
    ...scoringInput,
    taskId: 'task-huge',
    window: { ...cleaningWindow, durationMinutes: 400 },
  });
  assert.ok(overCapacity.find((candidate) => candidate.cleanerId === 'ana')?.rejectionCodes.includes('over_capacity'));
}
