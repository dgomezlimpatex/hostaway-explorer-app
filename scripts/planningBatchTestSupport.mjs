import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const root = process.cwd();

export function walk(relativeDirectory, predicate = () => true) {
  const absoluteDirectory = join(root, relativeDirectory);
  const result = [];
  const visit = (absolutePath) => {
    for (const name of readdirSync(absolutePath)) {
      const child = join(absolutePath, name);
      if (statSync(child).isDirectory()) visit(child);
      else if (predicate(child)) result.push(relative(root, child).replaceAll('\\', '/'));
    }
  };
  visit(absoluteDirectory);
  return result.sort();
}

export function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

export function sqlWithPlanningBatchRpc() {
  const files = walk('supabase/migrations', (path) => path.endsWith('.sql'));
  const matches = files
    .map((path) => ({ path, source: read(path) }))
    .filter(({ source }) => /(?:CREATE|REPLACE)[\s\S]{0,80}FUNCTION\s+public\.apply_planning_batch\s*\(/i.test(source));

  assert.ok(
    matches.length > 0,
    'RED esperado: falta una migración incremental que defina public.apply_planning_batch',
  );
  return matches;
}

export function combinedPlanningSql() {
  return sqlWithPlanningBatchRpc().map(({ source }) => source).join('\n');
}

export function sourceWithPlanningBatchClient() {
  const files = walk('src', (path) => /\.(?:ts|tsx)$/.test(path));
  const matches = files
    .map((path) => ({ path, source: read(path) }))
    .filter(({ source }) => /\.rpc\(\s*['"]apply_planning_batch['"]/.test(source));

  assert.ok(
    matches.length > 0,
    'RED esperado: ningún cliente TypeScript invoca apply_planning_batch',
  );
  return matches;
}

export function deterministicUuid(index, namespace = 1) {
  const tail = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-${namespace.toString(16).padStart(4, '0')}-${tail}`;
}

export function buildPlanningItems(count, { recurringEvery = 0, workersPerTask = 1 } = {}) {
  assert.ok(Number.isInteger(count) && count >= 0, 'count must be a non-negative integer');
  return Array.from({ length: count }, (_, index) => {
    const ordinal = index + 1;
    return {
      task_id: deterministicUuid(ordinal),
      occurrence_key: recurringEvery > 0 && ordinal % recurringEvery === 0
        ? `recurring:${deterministicUuid(ordinal, 2)}:2026-08-${String((ordinal % 28) + 1).padStart(2, '0')}`
        : null,
      expected_planning_version: ordinal,
      expected_status: 'pending',
      expected_start_time: '11:00',
      expected_end_time: '12:00',
      expected_cleaner_ids: [deterministicUuid(ordinal, 3)],
      proposed_start_time: '12:00',
      proposed_end_time: '13:00',
      proposed_cleaner_ids: Array.from(
        { length: workersPerTask },
        (_, workerIndex) => deterministicUuid(((ordinal - 1) * workersPerTask) + workerIndex + 1, 4),
      ),
    };
  });
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalRequestHash(request) {
  return createHash('sha256').update(JSON.stringify(canonicalize(request))).digest('hex');
}

export function assertAppearsBefore(source, earlier, later, message) {
  const earlierIndex = source.search(earlier);
  const laterIndex = source.search(later);
  assert.ok(earlierIndex >= 0, `${message}: no se encontró el paso previo`);
  assert.ok(laterIndex >= 0, `${message}: no se encontró la escritura posterior`);
  assert.ok(earlierIndex < laterIndex, message);
}
