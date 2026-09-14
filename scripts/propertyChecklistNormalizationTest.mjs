import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/utils/normalizeChecklistCategories.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { normalizeChecklistCategories: normalize } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
const count = categories => categories.reduce((sum, category) => sum + category.items.length, 0);
const flat = [
  { id: 'cleanliness', task: 'Limpieza general y superficies', category: 'Limpieza', required: true },
  { id: 'windows', task: 'Ventanas', category: 'Limpieza', photo_required: true },
  { id: 'organization', task: 'Trastero organizado', category: 'Organización', required: true },
];
assert.throws(() => count(flat), TypeError, 'Reproduces the property selector crash');
const before = JSON.stringify(flat);
const grouped = normalize(flat);
assert.equal(count(grouped), 3);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].items[0].id, 'cleanliness');
assert.equal(grouped[0].items[0].required, true);
assert.equal(grouped[0].items[1].photo_required, true);
assert.equal(JSON.stringify(flat), before, 'Reading must not mutate source data');

const nested = [{ id: 'room', category: 'Habitación', items: [{
  id: 'bed', task: 'Cama', required: false, photo_required: true,
  completed: true, notes: 'Conservar', media_urls: ['photo.jpg'],
}] }];
assert.deepEqual(normalize(nested), nested, 'Preserve the existing category format and metadata');
assert.equal(count(normalize([...nested, ...flat])), 4, 'Mixed formats must retain all tasks');
assert.equal(count(normalize([{ id: 'empty', category: 'Vacía' }, { items: null }, null])), 0);
for (const value of [null, undefined, {}, 'invalid', []]) assert.deepEqual(normalize(value), []);
assert.equal(count(normalize([{ items: [null, nested[0].items[0]] }])), 1);
assert.deepEqual(normalize(grouped), grouped, 'Normalization is stable across repeated reads');

// Verify the real storage boundary, used by the selector, editor and property summary.
const template = { id: 'template', template_name: 'Supervisión', checklist_items: flat };
globalThis.__checklistTestResponse = [template];
const storageBuild = await build({
  entryPoints: ['src/services/storage/checklistTemplatesStorage.ts'],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'mock-checklist-db', setup(builder) {
    builder.onResolve({ filter: /^@\/integrations\/supabase\/client$/ }, () => ({ path: 'db', namespace: 'mock' }));
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      const query = new Proxy({}, { get: (_, key) => key === 'then'
        ? resolve => resolve({ data: globalThis.__checklistTestResponse, error: null })
        : () => query });
      export const supabase = { from: () => query };
    ` }));
  } }],
});
const { checklistTemplatesStorageService: storage } = await import(
  `data:text/javascript;base64,${Buffer.from(storageBuild.outputFiles[0].text).toString('base64')}`
);
assert.equal(count((await storage.getChecklistTemplates())[0].checklist_items), 3);
globalThis.__checklistTestResponse = template;
assert.equal(count((await storage.getChecklistTemplateByPropertyType('test')).checklist_items), 3);
assert.equal(count((await storage.createChecklistTemplate(template)).checklist_items), 3);
assert.equal(count((await storage.updateChecklistTemplate('template', {})).checklist_items), 3);
delete globalThis.__checklistTestResponse;
console.log('property-checklist-normalization: OK');
