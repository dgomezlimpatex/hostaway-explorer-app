import type { SupervisionIncident, SupervisionReview, SupervisionStop } from '@/features/supervision/types';
import type { Task } from '@/types/calendar';
import { buildChecklistSnapshot, calculateCapacity, calculateExpectedTableware, calculateSupervisionMetrics, getEntryMessage, getLatestOpenIncidentsByStop, getLatestReviewsByStop, scoreCandidate, sortCandidates } from '@/features/supervision/domain';

export function run(assert: typeof import('node:assert/strict')) {
  assert.equal(calculateCapacity({ double: 1, sofa: 1, single: 1 }), 5);
  assert.equal(calculateExpectedTableware(5), 7);
  assert.equal(calculateExpectedTableware(5, 10), 10);
  const quick = buildChecklistSnapshot('apartment');
  const storage = buildChecklistSnapshot('storage');
  assert.equal(quick.version, 1);
  assert.ok(quick.items.some((item) => item.id === 'bathroom'));
  assert.ok(storage.items.some((item) => item.id === 'organization'));
  assert.equal(getEntryMessage(undefined, '2026-08-14'), 'Sin próxima entrada conocida');
  const task: Task = { id: 'task-1', created_at: '2026-08-14T00:00:00Z', updated_at: '2026-08-14T00:00:00Z', checkIn: '2026-08-14T16:00:00', checkOut: '', date: '2026-08-14', startTime: '10:00', endTime: '11:00', property: 'Apartamento A', address: '', type: 'limpieza-turistica', status: 'completed' };
  assert.equal(getEntryMessage(task, '2026-08-14'), 'Entrada el mismo día a las 16:00');
  const high = scoreCandidate(task, { incidentCount: 2, negativeReviews: 1, cleanerKnowledge: 1, reviewedRecently: false });
  const low = scoreCandidate(task, { reviewedRecently: true });
  assert.ok(high.score > low.score);
  assert.equal(sortCandidates([low, high])[0], high);
  const newerReview = { id: 'review-new', route_stop_id: 'stop-1', created_at: '2026-08-14T11:00:00Z' } as SupervisionReview;
  const olderReview = { id: 'review-old', route_stop_id: 'stop-1', created_at: '2026-08-14T10:00:00Z' } as SupervisionReview;
  assert.equal(getLatestReviewsByStop([newerReview, olderReview]).get('stop-1')?.id, 'review-new');
  const openIncident = { id: 'incident-new', route_stop_id: 'stop-1', status: 'open', created_at: '2026-08-14T11:00:00Z' } as SupervisionIncident;
  const oldIncident = { id: 'incident-old', route_stop_id: 'stop-1', status: 'open', created_at: '2026-08-14T10:00:00Z' } as SupervisionIncident;
  assert.equal(getLatestOpenIncidentsByStop([openIncident, oldIncident]).get('stop-1')?.id, 'incident-new');
  assert.equal(getLatestOpenIncidentsByStop([{ ...openIncident, status: 'resolved' }]).size, 0);
  const metrics = calculateSupervisionMetrics(
    [{ id: 'stop-1' }, { id: 'stop-2' }] as SupervisionStop[],
    [{ route_stop_id: 'stop-1', created_at: '2026-08-14T10:00:00Z', review_type: 'full', state: 'reviewed' }] as SupervisionReview[],
    [{ status: 'open', priority: 'critical' }] as SupervisionIncident[],
  );
  assert.deepEqual(metrics, { totalStops: 2, reviewedStops: 1, fullReviews: 1, returnedForRework: 0, openIncidents: 1, highPriorityIncidents: 1, reviewCoverage: 50, fullReviewCoverage: 50 });
}