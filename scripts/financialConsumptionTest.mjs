import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'financial-consumption-test-'));
try {
  await build({ entryPoints: ['src/features/financial/financialConsumption.ts'], outfile: join(dir, 'reader.mjs'),
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { readFinancialConsumption } = await import(pathToFileURL(join(dir, 'reader.mjs')));
  const propertyIds = Array.from({ length: 45 }, (_, i) => `property-${i}`);
  const products = Array.from({ length: 35 }, (_, i) => ({ id: `product-${i}`, name: `Product ${i}` }));
  const rules = propertyIds.flatMap(property_id => products.map((product, i) => ({
    id: `${property_id}-${product.id}`, property_id, product_id: product.id, quantity_per_cleaning: i,
    is_active: true, updated_at: `2026-10-${String(i % 28 + 1).padStart(2, '0')}`,
  })));
  rules.push({ ...rules[0], id: 'inactive', is_active: false, quantity_per_cleaning: 999 },
    { ...rules[0], id: 'other-sede', property_id: 'foreign-property', quantity_per_cleaning: 999 });
  // A product hidden by RLS must remain null, just like the original left join.
  const visibleProducts = products.slice(0, -1);
  const reads = [];
  let failure;
  const client = createClient('https://financial.local.test', 'fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://financial.local.test');
      assert.equal(init.method, 'GET', 'The reader must only read');
      const table = url.pathname.split('/').at(-1), params = url.searchParams;
      assert.ok(['stock_property_consumption_rules', 'stock_products'].includes(table));
      assert.ok(!/[():!]/.test(params.get('select')), 'No embedded joins that expand the RLS plan');
      assert.equal(params.get('limit'), '500');
      const column = table === 'stock_products' ? 'id' : 'property_id';
      const filter = params.get(column);
      assert.ok(filter?.startsWith('in.('), 'Every request is scoped to explicit IDs');
      const ids = filter.slice(4, -1).split(',');
      assert.ok(ids.length <= 20);
      if (table === 'stock_property_consumption_rules') {
        assert.ok(ids.every(id => propertyIds.includes(id)), 'Never include another sede');
        assert.equal(params.get('is_active'), 'eq.true');
        assert.equal(params.get('order'), 'updated_at.asc,id.asc');
      }
      const from = Number(params.get('offset'));
      reads.push({ table, ids, from });
      if (failure?.({ table, from, ids })) return new Response(JSON.stringify({ code: '57014', message: 'statement timeout' }), { status: 500 });
      let rows = (table === 'stock_products' ? visibleProducts : rules).filter(row => ids.includes(row[column]) && row.is_active !== false);
      rows = rows.sort((a, b) => String(a.updated_at ?? '').localeCompare(String(b.updated_at ?? '')) || a.id.localeCompare(b.id));
      return new Response(JSON.stringify(rows.slice(from, from + 500)), { headers: { 'Content-Type': 'application/json' } });
    } },
  });

  assert.deepEqual(await readFinancialConsumption(client, []), []);
  assert.equal(reads.length, 0, 'No unscoped request for an empty property directory');
  const actual = await readFinancialConsumption(client, [...propertyIds, propertyIds[0]]);
  const expected = rules.filter(row => row.is_active && propertyIds.includes(row.property_id)).map(row => ({
    property_id: row.property_id, quantity_per_cleaning: row.quantity_per_cleaning,
    product: visibleProducts.find(product => product.id === row.product_id) ? { name: products.find(product => product.id === row.product_id).name } : null,
  }));
  const canonical = rows => rows.map(row => JSON.stringify(row)).sort();
  assert.deepEqual(canonical(actual), canonical(expected), 'All 1,575 active rules survive batching and pagination exactly once');
  assert.ok(reads.some(read => read.from === 500), 'Second page is consumed');
  assert.equal(reads.filter(read => read.table === 'stock_products').length, 2, 'Product IDs are deduplicated');
  assert.equal(actual.filter(rule => rule.product === null).length, 45);
  assert.equal(actual.filter(rule => rule.quantity_per_cleaning === 0).length, 45, 'Zero overrides must be kept');

  failure = read => read.table === 'stock_property_consumption_rules' && read.from === 500;
  await assert.rejects(readFinancialConsumption(client, propertyIds), /statement timeout/, 'A later page failure cannot become a partial balance');
  failure = read => read.table === 'stock_products';
  await assert.rejects(readFinancialConsumption(client, propertyIds), /statement timeout/, 'Product failure cannot become zero costs');
  failure = read => read.table === 'stock_property_consumption_rules' && read.ids.includes('property-40');
  await assert.rejects(readFinancialConsumption(client, propertyIds), /statement timeout/, 'A later batch failure must be visible');
  failure = undefined;
  assert.equal((await readFinancialConsumption(client, propertyIds)).length, expected.length, 'Retry starts cleanly without duplicates');
  console.log('Financial consumption: scoped reads, pagination, joins parity, missing products, zero quantities, failures and retry OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
