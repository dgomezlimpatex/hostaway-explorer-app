import type { strict as StrictAssert } from 'node:assert';
import {
  canViewNextClientEntry,
  formatNextClientEntryLabel,
  loadNextClientEntry,
} from '../src/services/clientPortal/nextClientEntryDomain';

interface AssertLike {
  equal: typeof StrictAssert.equal;
  deepEqual: typeof StrictAssert.deepEqual;
  rejects: typeof StrictAssert.rejects;
}

export async function run(assert: AssertLike) {
  assert.equal(canViewNextClientEntry('admin'), true, 'admins can view the next client entry');
  assert.equal(canViewNextClientEntry('manager'), false, 'managers cannot view an admin-only field');
  assert.equal(canViewNextClientEntry('cleaner'), false, 'cleaners cannot view the next client entry');

  assert.equal(
    formatNextClientEntryLabel('2026-07-13', '2026-07-13'),
    'Hoy',
    'an entry on the task date is labelled Hoy',
  );
  assert.equal(
    formatNextClientEntryLabel('2026-07-18', '2026-07-13'),
    '18/07/2026',
    'a later entry shows its Spanish calendar date',
  );

  const calls: Array<{ propertyId: string; fromDate: string }> = [];
  const entry = await loadNextClientEntry(
    { propertyId: 'property-1', taskDate: '2026-07-13' },
    async (input) => {
      calls.push(input);
      return { checkInDate: '2026-07-18', updatedAt: '2026-07-12T08:00:00Z' };
    },
  );

  assert.deepEqual(calls, [{ propertyId: 'property-1', fromDate: '2026-07-13' }]);
  assert.deepEqual(entry, { checkInDate: '2026-07-18', updatedAt: '2026-07-12T08:00:00Z' });

  await assert.rejects(
    () => loadNextClientEntry({ propertyId: '', taskDate: '2026-07-13' }, async () => null),
    /propertyId/,
    'the loader rejects missing property context',
  );
}
