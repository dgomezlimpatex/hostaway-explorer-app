import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { receiptTestDatabase } from './laundryReceiptTestSupport.mjs';

// Real PostgreSQL functions in disposable, in-memory PGlite; no network/services.
const t = await receiptTestDatabase({ suiteSheets: false });
let session = t.sessionHash;
const mutate = (payload, opts = {}) => t.mutate(payload, { session, ...opts });
const state = () => t.state({ session });
try {
  await mutate({ action: 'start' });
  await mutate({ action: 'add', material: 'single_sheets', quantity: 7 });
  const oldVersion = await mutate({ action: 'confirm', expectedRevision: 1 });
  const before = (await state()).versions[0].snapshot;
  const token = t.config.token;
  const oldMap = { ...t.productMap };
  const suiteProduct = randomUUID();
  await t.db.query('INSERT INTO stock_products(id,sede_id,category_id) SELECT $1,sede_id,category_id FROM stock_products WHERE id=$2', [suiteProduct, oldMap.single_sheets]);
  await t.db.exec(await readFile(new URL('../supabase/migrations/20261013120000_laundry_receipt_suite_sheets.sql', import.meta.url), 'utf8'));
  assert.equal((await state()).versions[0].snapshot.counts.suite_sheets, undefined);
  assert.deepEqual((await state()).versions[0].snapshot, before);
  assert.equal((await mutate({ action: 'confirm', expectedRevision: 1 })).unchanged, true);
  await assert.rejects(() => mutate({ action: 'add', material: 'suite_sheets', quantity: 12 }), /pendientes de configurar/);
  const configured = await t.rpc('configure_laundry_receipt', { _warehouse: t.warehouse, _map: { ...oldMap, suite_sheets: suiteProduct }, _workers: [t.worker,t.worker2], _active: true });
  assert.equal(configured.token, token, 'The printed/public link stays the same');
  session = 'c'.repeat(64);
  await t.rpc('login_laundry_receipt', { _token: token, _pin: '1234', _ip_hash: '3'.repeat(64), _session_hash: session });
  await assert.rejects(() => t.rpc('configure_laundry_receipt', { _warehouse: t.warehouse, _map: { ...oldMap, suite_sheets: oldMap.single_sheets, single_sheets: suiteProduct }, _workers: [t.worker], _active: true }), /No se pueden cambiar productos/);
  const id = randomUUID();
  await mutate({ action: 'add', material: 'suite_sheets', quantity: 12 }, { id });
  await mutate({ action: 'add', material: 'suite_sheets', quantity: 12 }, { id });
  assert.equal((await state()).receipt.counts.suite_sheets, 12);
  await mutate({ action: 'undo', targetId: id, expectedRevision: 2 });
  assert.equal((await state()).receipt.counts.suite_sheets ?? 0, 0);
  await mutate({ action: 'add', material: 'suite_sheets', quantity: 12 });
  await mutate({ action: 'add_discard', material: 'suite_sheets', quantity: 3 });
  const confirm = () => state().then(s => mutate({ action: 'confirm', expectedRevision: s.receipt.revision }));
  const next = await confirm();
  assert.notEqual(next.versionId, oldVersion.versionId);
  const level = () => t.db.query('SELECT current_quantity::int AS n FROM stock_levels WHERE product_id=$1',[suiteProduct]).then(r => r.rows[0]?.n ?? 0);
  assert.equal(await level(),12,'Only accepted suite sheets become stock');
  assert.equal((await confirm()).unchanged,true);
  assert.equal(await level(),12);
  await mutate({ action: 'set', material: 'suite_sheets', quantity: 8, expectedRevision: 5 });
  await confirm();
  assert.equal(await level(),8,'Correction applies just the difference');
  const original = (await t.db.query('SELECT snapshot FROM laundry_receipt_versions WHERE id=$1',[oldVersion.versionId])).rows[0].snapshot;
  assert.deepEqual(original,before,'Immutable historical snapshot remains exact');
  assert.equal((await t.db.query('SELECT current_quantity::int AS n FROM stock_levels WHERE product_id=$1',[oldMap.single_sheets])).rows[0].n,7);
  await t.db.query("UPDATE laundry_receipts SET receipt_date=receipt_date-1");
  await t.db.query("UPDATE laundry_receipts SET counts=counts-'suite_sheets',discarded_counts=discarded_counts-'suite_sheets',latest_version=1,revision=1");
  assert.deepEqual((await state()).pendingDates,[], 'Missing legacy suite zero does not create a false pending day');
  await t.db.query("UPDATE laundry_receipts SET counts=counts || '{\"suite_sheets\":1}'::jsonb");
  assert.equal((await state()).pendingDates.length,1,'A real suite change is pending');

  const bundled = await build({ entryPoints:['supabase/functions/_shared/laundryReceiptDomain.ts'],bundle:true,write:false,platform:'node',format:'esm' });
  const domain = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const labels = ['Sábanas de suite','Sábanas de matrimonio','Sábanas individuales','Fundas de almohada','Toallas de manos','Toallas de baño','Alfombrín de ducha','Almohada','Cubre colchón','Edredón'];
  assert.deepEqual(domain.RECEIPT_MATERIALS.map(([,label])=>label),labels);
  const rows = domain.receiptWorkbookRows(original);
  assert.deepEqual(rows.slice(8,18).map(row=>row[0]),labels);
  assert.deepEqual(rows[8],['Sábanas de suite',0,0]);
  assert.equal(domain.receiptWorkbookRows(original,true)[8][0],'Sábanas de matrimonio','Legacy mail retries retain their original layout');
  const associationFixture = await receiptTestDatabase({ suiteSheets: false });
  try {
    const a = associationFixture;
    await a.mutate({ action: 'start' });
    const originalReceipt = (await a.state()).receipt;
    const originalSessions = (await a.db.query('SELECT * FROM laundry_receipt_sessions ORDER BY id')).rows;
    await a.db.exec(await readFile(new URL('../supabase/migrations/20261013120000_laundry_receipt_suite_sheets.sql', import.meta.url), 'utf8'));
    const p = randomUUID();
    await a.db.query('INSERT INTO stock_products(id,sede_id,category_id) SELECT $1,sede_id,category_id FROM stock_products WHERE id=$2',[p,a.productMap.single_sheets]);
    const association = (await readFile(new URL('./laundryReceiptSuiteSheetsAssociation.sql',import.meta.url),'utf8'))
      .replaceAll('410762cf-ec90-43a5-a53a-4c6217e31e50',a.config.id)
      .replaceAll('8a619a5e-25b6-47fb-b2f1-32ae1cbf1e9d',p);
    await a.db.exec(association);
    assert.deepEqual((await a.state()).receipt,originalReceipt);
    assert.deepEqual((await a.db.query('SELECT * FROM laundry_receipt_sessions ORDER BY id')).rows,originalSessions);
    assert.deepEqual((await a.db.query('SELECT product_map FROM laundry_receipt_links WHERE id=$1',[a.config.id])).rows[0].product_map,{...a.productMap,suite_sheets:p});
    assert.equal((await a.db.query('SELECT count(*)::int AS n FROM stock_movements')).rows[0].n,0);
    await a.mutate({action:'add',material:'suite_sheets',quantity:4});
    assert.equal((await a.state()).receipt.counts.suite_sheets,4);
  } finally { await associationFixture.db.close(); }
  console.log('Suite sheets: exact order, legacy upgrade, immutable history, unchanged link, mapping protection, retries/undo, accepted stock, discards, delta correction, historical pending dates and Excel verified locally.');
} finally { await t.db.close(); }
