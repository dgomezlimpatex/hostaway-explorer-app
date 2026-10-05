import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";

const t = await receiptTestDatabase();
const { db, rpc, mutate, state } = t;
let checks = 0;
const check = (label) => {
  checks++;
  console.log(`OK ${label}`);
};
try {
  await assert.rejects(
    () => state({ session: "c".repeat(64) }),
    /Sesión caducada/,
  );
  check("enlace sin sesión no permite leer");
  const invalid = await rpc("login_laundry_receipt", {
    _token: t.config.token,
    _pin: "9999",
    _ip_hash: "3".repeat(64),
    _session_hash: "d".repeat(64),
  });
  assert.equal(invalid.status, 401);
  for (let i = 0; i < 9; i++)
    await rpc("login_laundry_receipt", {
      _token: t.config.token,
      _pin: "9999",
      _ip_hash: "3".repeat(64),
      _session_hash: "d".repeat(64),
    });
  assert.equal(
    (
      await rpc("login_laundry_receipt", {
        _token: t.config.token,
        _pin: "1234",
        _ip_hash: "3".repeat(64),
        _session_hash: "d".repeat(64),
      })
    ).status,
    429,
  );
  check("PIN incorrecto y bloqueo de intentos");
  await mutate({ action: "start" });
  await mutate({ action: "start" }, { session: t.sessionHash2 });
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM laundry_receipts")).rows[0]
      .n,
    1,
  );
  check("un recuento por día compartido");
  const id = randomUUID();
  await mutate(
    { action: "add", material: "bath_towels", quantity: 80 },
    { id },
  );
  await mutate(
    { action: "add", material: "bath_towels", quantity: 80 },
    { id },
  );
  await mutate(
    { action: "add", material: "bath_towels", quantity: 65 },
    { session: t.sessionHash2 },
  );
  await mutate({ action: "add", material: "bath_towels", quantity: 90 });
  let s = await state();
  assert.equal(s.receipt.counts.bath_towels, 235);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM stock_movements")).rows[0]
      .n,
    0,
  );
  check("tandas, otro empleado, reintento y borrador sin stock");
  await assert.rejects(
    () =>
      mutate({
        action: "set",
        material: "bath_towels",
        quantity: 10,
        expectedRevision: 0,
      }),
    /ha cambiado/,
  );
  await assert.rejects(
    () => mutate({ action: "add", material: "pillows", quantity: -1 }),
    /inválido/,
  );
  await assert.rejects(
    () => mutate({ action: "add", material: "pillows", quantity: 1.5 }),
    /inválido/,
  );
  check("conflicto de corrección, negativos y decimales");
  const confirmationId = randomUUID();
  const payload = { action: "confirm", expectedRevision: s.receipt.revision };
  const v1 = await mutate(payload, { id: confirmationId });
  assert.deepEqual(await mutate(payload, { id: confirmationId }), v1);
  assert.equal((await mutate(payload)).unchanged, true);
  assert.equal(
    (
      await db.query(
        "SELECT current_quantity::float AS n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0].n,
    235,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM laundry_receipt_emails"))
      .rows[0].n,
    1,
  );
  check("confirmación atómica, doble clic y correo único");
  await mutate({ action: "add", material: "bath_towels", quantity: 15 });
  s = await state();
  await mutate({ action: "confirm", expectedRevision: s.receipt.revision });
  s = await state();
  await mutate({
    action: "set",
    material: "bath_towels",
    quantity: 240,
    expectedRevision: s.receipt.revision,
  });
  s = await state();
  await mutate({ action: "confirm", expectedRevision: s.receipt.revision });
  const moves = (
    await db.query(
      "SELECT movement_type,quantity::float AS quantity FROM stock_movements ORDER BY created_at,id",
    )
  ).rows;
  assert.equal(moves.length, 3);
  assert.equal(
    moves.filter((m) => m.movement_type === "salida")[0].quantity,
    10,
  );
  assert.equal(
    (
      await db.query(
        "SELECT current_quantity::float AS n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0].n,
    240,
  );
  check("versiones y correcciones por diferencia");
  await db.query(
    "UPDATE stock_levels SET current_quantity=2 WHERE product_id=$1",
    [t.productMap.bath_towels],
  );
  s = await state();
  await mutate({
    action: "set",
    material: "bath_towels",
    quantity: 0,
    expectedRevision: s.receipt.revision,
  });
  s = await state();
  await mutate({ action: "add", material: "double_sheets", quantity: 100 });
  s = await state();
  const versionCount = (
    await db.query("SELECT count(*)::int AS n FROM laundry_receipt_versions")
  ).rows[0].n;
  await assert.rejects(
    () => mutate({ action: "confirm", expectedRevision: s.receipt.revision }),
    /stock negativo/,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM laundry_receipt_versions"))
      .rows[0].n,
    versionCount,
  );
  assert.equal(
    (
      await db.query(
        "SELECT coalesce(sum(current_quantity),0)::float AS n FROM stock_levels WHERE product_id=$1",
        [t.productMap.double_sheets],
      )
    ).rows[0].n,
    0,
  );
  check("stock negativo revierte toda la confirmación");
  const last = s.operations.find(
    (o) => o.payload.action === "add" && o.revision === s.receipt.revision,
  );
  await mutate({
    action: "undo",
    targetId: last.id,
    expectedRevision: s.receipt.revision,
  });
  assert.equal((await state()).receipt.counts.double_sheets, 0);
  check("deshacer operación");
  const yesterday = (
    await db.query(
      "SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-1)::text AS date",
    )
  ).rows[0].date;
  await db.query("UPDATE laundry_receipts SET receipt_date=$1", [yesterday]);
  assert.equal((await state()).receipt, null);
  assert.deepEqual((await state()).pendingDates, [yesterday]);
  assert.equal(
    (await state({ date: yesterday })).receipt.receipt_date,
    yesterday,
  );
  await mutate({ action: "start" });
  assert.equal((await state()).receipt.receipt_date, t.date);
  check("nuevo día y recuperación de borrador anterior");
  const claim1 = await rpc("claim_laundry_receipt_email", {
    _version: v1.versionId,
  });
  assert.ok(claim1.email.claim_token);
  assert.equal(
    await rpc("claim_laundry_receipt_email", { _version: v1.versionId }),
    null,
  );
  await rpc("finish_laundry_receipt_email", {
    _id: claim1.email.id,
    _claim: claim1.email.claim_token,
    _provider: null,
    _error: "Fallo ficticio",
  });
  assert.equal(
    (
      await db.query("SELECT status FROM laundry_receipt_emails WHERE id=$1", [
        claim1.email.id,
      ])
    ).rows[0].status,
    "error",
  );
  await db.query(
    "UPDATE laundry_receipt_emails SET next_attempt_at=now() WHERE id=$1",
    [claim1.email.id],
  );
  const claim2 = await rpc("claim_laundry_receipt_email", {
    _version: v1.versionId,
  });
  await rpc("finish_laundry_receipt_email", {
    _id: claim2.email.id,
    _claim: claim2.email.claim_token,
    _provider: "fake-message-id",
    _error: null,
  });
  assert.equal(
    await rpc("claim_laundry_receipt_email", { _version: v1.versionId }),
    null,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM stock_movements")).rows[0]
      .n,
    3,
  );
  check("cola, lease, fallo y recuperación de correo sin stock");
  await db.exec("SET ROLE anon");
  await assert.rejects(
    () => db.query("SELECT * FROM laundry_receipts"),
    /permission denied/,
  );
  await assert.rejects(() => rpc("laundry_receipt_keys"), /permission denied/);
  await db.exec("RESET ROLE");
  await db.exec("SET ROLE authenticated");
  await assert.rejects(
    () => db.query("SELECT * FROM laundry_receipt_sessions"),
    /permission denied/,
  );
  await assert.rejects(
    () => rpc("claim_laundry_receipt_email"),
    /permission denied/,
  );
  await db.exec("RESET ROLE");
  check("RLS y grants: datos y RPC privados");
  await db.exec("SET ROLE service_role");
  assert.ok((await state()).receipt);
  await db.exec("RESET ROLE");
  check("RPC accesible para la service role con RLS activo");
  await rpc("configure_laundry_receipt", {
    _warehouse: t.warehouse,
    _map: t.productMap,
    _workers: [t.worker],
    _active: true,
    _rotate: true,
  });
  await assert.rejects(() => state(), /Sesión caducada/);
  check("revocación de enlace y sesiones");
  const other = await receiptTestDatabase();
  try {
    await other.mutate({ action: "start" });
    await Promise.all([
      other.mutate({ action: "add", material: "bath_towels", quantity: 200 }),
      other.mutate(
        { action: "add", material: "bath_towels", quantity: 300 },
        { session: other.sessionHash2 },
      ),
    ]);
    assert.equal((await other.state()).receipt.counts.bath_towels, 500);
    for (const key of Object.keys(other.productMap).filter(
      (k) => k !== "bath_towels",
    ))
      await other.mutate({ action: "add", material: key, quantity: 350 });
    const full = await other.state();
    const confirmed = await other.mutate({
      action: "confirm",
      expectedRevision: full.receipt.revision,
    });
    assert.equal(
      (await other.db.query("SELECT count(*)::int AS n FROM stock_movements"))
        .rows[0].n,
      9,
    );
    check("nueve materiales con cientos de unidades y sumas de dos empleados");
    await other.db.query(
      "UPDATE laundry_route_workers SET pin_synced_at=pin_synced_at+interval '1 second' WHERE id=$1",
      [other.worker],
    );
    await assert.rejects(() => other.state(), /Sesión caducada/);
    await other.db.query(
      "UPDATE laundry_route_workers SET is_active=false WHERE id=$1",
      [other.worker2],
    );
    await assert.rejects(
      () => other.state({ session: other.sessionHash2 }),
      /Sesión caducada/,
    );
    check("cambio de PIN y baja de empleado invalidan sesiones");
    const job = await other.rpc("claim_laundry_receipt_email", {
      _version: confirmed.versionId,
    });
    await other.db.query(
      "UPDATE laundry_receipt_emails SET claimed_at=now()-interval '4 minutes',next_attempt_at=now()-interval '1 minute' WHERE id=$1",
      [job.email.id],
    );
    const recovered = await other.rpc("claim_laundry_receipt_email", {
      _version: confirmed.versionId,
    });
    assert.notEqual(recovered.email.claim_token, job.email.claim_token);
    await other.rpc("finish_laundry_receipt_email", {
      _id: job.email.id,
      _claim: job.email.claim_token,
      _provider: "stale-provider",
      _error: null,
    });
    assert.equal(
      (
        await other.db.query(
          "SELECT status FROM laundry_receipt_emails WHERE id=$1",
          [job.email.id],
        )
      ).rows[0].status,
      "sending",
    );
    await other.rpc("finish_laundry_receipt_email", {
      _id: recovered.email.id,
      _claim: recovered.email.claim_token,
      _provider: null,
      _error: "Error ficticio",
    });
    await other.db.query(
      "UPDATE laundry_receipt_emails SET first_attempt_at=now()-interval '24 hours' WHERE id=$1",
      [job.email.id],
    );
    await other.db.query(
      "UPDATE laundry_receipt_emails SET next_attempt_at=now() WHERE id=$1",
      [job.email.id],
    );
    assert.equal(
      await other.rpc("claim_laundry_receipt_email", {
        _version: confirmed.versionId,
      }),
      null,
    );
    assert.equal(
      (
        await other.db.query(
          "SELECT status FROM laundry_receipt_emails WHERE id=$1",
          [job.email.id],
        )
      ).rows[0].status,
      "uncertain",
    );
    check("lease caducado y protección de reenvíos fuera de ventana segura");
  } finally {
    await other.db.close();
  }
  console.log(
    `laundry-receipt-db: ${checks} grupos correctos; base aislada, cero acceso a producción`,
  );
} finally {
  await db.close();
}
