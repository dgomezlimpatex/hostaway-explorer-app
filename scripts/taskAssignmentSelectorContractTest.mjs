import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const selectorSource = read('src/components/modals/task-details/TaskDetailsActions.tsx');
const calendarSource = read('src/hooks/useCalendarData.ts');
const storageSource = read('src/services/storage/cleanerStorage.ts');

assert.match(
  calendarSource,
  /allCleaners\.filter\(c => c\.isActive !== false\)/,
  'The calendar must define active workers with the established isActive !== false rule',
);

assert.match(
  storageSource,
  /\.order\('sort_order', \{ nullsFirst: false \}\)\s*\.order\('name'\)/,
  'Workers must be loaded in calendar sort_order with name as the stable fallback',
);

assert.doesNotMatch(
  selectorSource,
  /\{cleaners\.map\(\(cleaner\) => \(/,
  'The task selector must not render every worker, including inactive workers',
);

assert.match(
  selectorSource,
  /\{cleaners\.filter\(c => c\.isActive !== false\)\.map\(\(cleaner\) => \(/,
  'The task selector must filter active workers while preserving the calendar order',
);

console.log('Task assignment selector contract test passed');
