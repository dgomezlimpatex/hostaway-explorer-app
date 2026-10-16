import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync('src/components/cleaning-planning/PlanningProposalCalendar.tsx', 'utf8');
assert.match(source, /available: 'bg-white',/, 'Available windows are painted without the green tint');
assert.doesNotMatch(source, /emerald-200\/(65|70)/, 'No green availability color remains');
assert.match(source, /!compact && band\.kind !== 'available' && widthPercent >= 6/, 'Available windows carry no hours label');
assert.doesNotMatch(source, />Horario disponible</, 'Legend no longer explains the removed green');
for (const kept of ['Mantenimiento', 'Ausencia o bloqueo', 'Fuera de horario', 'Horario estimado'])
  assert.ok(source.includes(`/>${kept}</span>`), `Legend keeps ${kept}`);
assert.match(source, /band\.label \+ ' ' \+ fromMinutes\(band\.startMinute\)/, 'Blocked windows keep their hours label');
console.log('PASS: available windows have no green or hours label; blocked windows keep their hours');
