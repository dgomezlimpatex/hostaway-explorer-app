import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/components/modals/AssignMultipleCleanersModal.tsx'),
  'utf8',
);

assert.match(source, /const clearAll = \(\) => setSelected\(\[\]\)/);
assert.match(source, /aria-label="Desasignar todos los trabajadores"/);
assert.match(source, />\s*Desasignar todos\s*</);
assert.match(source, /onClick=\{clearAll\}/);
assert.match(source, /selected\.length > 0[\s\S]*Desasignar todos/);

console.log('Multi-assignment modal UI contract test passed');