import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";

const t = await receiptTestDatabase();
try {
  await t.mutate({ action: "start" });
  for (const [material] of Object.entries(t.productMap)) {
    const id = randomUUID(),
      payload = { action: "add_discard", material, quantity: 80 };
    await t.mutate(payload, { id });
    await t.mutate(payload, { id });
    await t.mutate(
      { action: "add_discard", material, quantity: 65 },
      { session: t.sessionHash2 },
    );
  }
  let s = await t.state();
  assert.ok(Object.values(s.receipt.counts).every((n) => n === 0));
  assert.ok(Object.values(s.receipt.discarded_counts).every((n) => n === 145));
  for (const quantity of [-1, 1.5, 1000000000])
    await assert.rejects(
      t.mutate({ action: "add_discard", material: "pillows", quantity }),
      /inválido/,
    );
  await assert.rejects(
    t.mutate({
      action: "set_discard",
      material: "pillows",
      quantity: 2,
      expectedRevision: 0,
    }),
    /ha cambiado/,
  );
  await assert.rejects(
    t.mutate({ action: "add_discard", material: "unknown", quantity: 1 }),
    /inválido/,
  );
  const confirm = { action: "confirm", expectedRevision: s.receipt.revision },
    id = randomUUID();
  const v = await t.mutate(confirm, { id });
  assert.deepEqual(await t.mutate(confirm, { id }), v);
  assert.equal((await t.mutate(confirm)).unchanged, true);
  assert.equal(
    (await t.db.query("SELECT count(*)::int AS n FROM stock_levels")).rows[0].n,
    0,
  );
  assert.equal(
    (await t.db.query("SELECT count(*)::int AS n FROM stock_movements")).rows[0]
      .n,
    0,
  );
  s = await t.state();
  assert.equal(s.versions.length, 1);
  assert.equal(s.versions[0].snapshot.discarded_counts.pillows, 145);
  assert.deepEqual(s.versions[0].movement_ids, []);
  await t.mutate({
    action: "set_discard",
    material: "pillows",
    quantity: 3,
    expectedRevision: s.receipt.revision,
  });
  s = await t.state();
  await t.mutate({ action: "confirm", expectedRevision: s.receipt.revision });
  await t.mutate({ action: "add", material: "bath_towels", quantity: 20 });
  s = await t.state();
  await t.mutate({ action: "confirm", expectedRevision: s.receipt.revision });
  assert.equal(
    (
      await t.db.query(
        "SELECT sum(current_quantity)::int AS n FROM stock_levels",
      )
    ).rows[0].n,
    20,
  );
  s = await t.state();
  await t.mutate({
    action: "add_discard",
    material: "bath_towels",
    quantity: 5,
  });
  s = await t.state();
  await t.mutate({
    action: "undo",
    targetId: s.operations.find((o) => o.revision === s.receipt.revision).id,
    expectedRevision: s.receipt.revision,
  });
  s = await t.state();
  assert.equal(s.receipt.discarded_counts.bath_towels, 145);
  assert.equal(s.receipt.counts.bath_towels, 20);
  assert.equal(
    (
      await t.mutate({
        action: "confirm",
        expectedRevision: s.receipt.revision,
      })
    ).unchanged,
    true,
  );
  await t.mutate({
    action: "add_discard",
    material: "bath_towels",
    quantity: 5,
  });
  const yesterday = (
    await t.db.query(
      "SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-1)::text AS d",
    )
  ).rows[0].d;
  await t.db.query("UPDATE laundry_receipts SET receipt_date=$1", [yesterday]);
  assert.deepEqual((await t.state()).pendingDates, [yesterday]);
  const resumed = await t.state({ date: yesterday });
  await t.mutate(
    { action: "confirm", expectedRevision: resumed.receipt.revision },
    { date: yesterday },
  );
  assert.equal(
    (
      await t.db.query(
        "SELECT sum(current_quantity)::int AS n FROM stock_levels",
      )
    ).rows[0].n,
    20,
  );
  console.log(
    "Discards: nine materials, two workers, idempotency, validation, stale correction, discard-only confirmation, versions, undo, prior day and zero stock effect verified.",
  );
} finally {
  await t.db.close();
}

const legacy = await receiptTestDatabase();
try {
  await legacy.mutate({ action: "start" });
  await legacy.mutate({ action: "add", material: "bath_towels", quantity: 20 });
  let s = await legacy.state();
  await legacy.mutate({
    action: "confirm",
    expectedRevision: s.receipt.revision,
  });
  // Synthetic pre-extension snapshot; existing historical versions are not rewritten by the migration.
  await legacy.db.query(
    "UPDATE laundry_receipt_versions SET snapshot=snapshot-'discarded_counts'",
  );
  s = await legacy.state();
  assert.equal(
    (
      await legacy.mutate({
        action: "confirm",
        expectedRevision: s.receipt.revision,
      })
    ).unchanged,
    true,
  );
  assert.equal((await legacy.state()).versions.length, 1);
  console.log("Legacy snapshot: no false change, no duplicate stock or email.");
} finally {
  await legacy.db.close();
}
