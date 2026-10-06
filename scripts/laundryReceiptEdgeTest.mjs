import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import XLSX from "xlsx";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";
import { loadReceiptEdge } from "./laundryReceiptEdgeTestSupport.mjs";

const t = await receiptTestDatabase();
const { request } = await loadReceiptEdge(t);
const originalFetch = globalThis.fetch;
const sent = [];
let failEmail = true;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.resend.com/emails");
  const payload = JSON.parse(options.body);
  sent.push({ payload, key: options.headers["Idempotency-Key"] });
  return new Response(
    JSON.stringify(
      failEmail ? { message: "fixture failure" } : { id: "fixture-accepted" },
    ),
    { status: failEmail ? 503 : 200 },
  );
};
try {
  assert.equal(
    (await request({ action: "read", token: t.config.token })).status,
    401,
  );
  assert.equal(
    (await request({ action: "admin_read", warehouseId: t.warehouse })).status,
    401,
  );
  assert.equal((await request({ action: "drain" })).status, 403);
  const logged = await request({
    action: "login",
    token: t.config.token,
    pin: "1234",
  });
  assert.equal(logged.status, 200);
  assert.equal(logged.data.workerId, t.worker);
  const access = {
    token: t.config.token,
    sessionToken: logged.data.sessionToken,
  };
  const mutate = async (payload) => {
    const response = await request({
      action: "mutate",
      ...access,
      date: t.date,
      operationId: randomUUID(),
      payload,
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.result;
  };
  await mutate({ action: "start" });
  await mutate({ action: "add", material: "bath_towels", quantity: 235 });
  await mutate({
    action: "notes",
    notes: '=HYPERLINK("https://fixture.invalid")',
    expectedRevision: 1,
  });
  await mutate({ action: "add_discard", material: "bath_towels", quantity: 7 });
  const result = await mutate({ action: "confirm", expectedRevision: 3 });
  let read = await request({ action: "read", ...access });
  assert.equal(read.data.versions[0].email.status, "error");
  const stockBefore = (
    await t.db.query(
      "SELECT sum(current_quantity)::float AS n FROM stock_levels",
    )
  ).rows[0].n;
  failEmail = false;
  const retry = await request({
    action: "retry",
    ...access,
    date: t.date,
    versionId: result.versionId,
  });
  assert.equal(retry.status, 200);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].key, sent[1].key);
  assert.deepEqual(
    sent[0].payload,
    sent[1].payload,
    "el reintento reutiliza exactamente el mismo Excel y mensaje",
  );
  assert.equal(
    (
      await t.db.query(
        "SELECT sum(current_quantity)::float AS n FROM stock_levels",
      )
    ).rows[0].n,
    stockBefore,
  );
  read = await request({ action: "read", ...access });
  assert.equal(read.data.versions[0].email.status, "accepted");
  assert.deepEqual(sent[1].payload.to, [
    "dgomez@limpatex.com",
    "geisha@limpatex.com",
  ]);
  const wb = XLSX.read(sent[1].payload.attachments[0].content, {
    type: "base64",
  });
  assert.deepEqual(wb.SheetNames, ["Recuento"]);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Recuento, { header: 1 });
  assert.equal(rows.find((row) => row[0] === "Toallas de baño")[1], 235);
  assert.equal(rows.find((row) => row[0] === "Toallas de baño")[2], 7);
  assert.ok(sent[1].payload.text.includes("descartes"));
  assert.equal(
    rows.filter((row) => typeof row[1] === "number" && row[0] !== "Versión")
      .length,
    9,
  );
  assert.ok(!JSON.stringify(rows).includes("stock"));
  assert.equal(wb.Sheets.Recuento.B19.t, "s");
  assert.equal(
    wb.Sheets.Recuento.B19.f,
    undefined,
    "la observación no se convierte en fórmula de Excel",
  );
  assert.equal(
    (
      await request({
        action: "retry",
        ...access,
        date: t.date,
        versionId: randomUUID(),
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        { action: "admin_read", warehouseId: t.warehouse },
        "Bearer fixture-admin-jwt",
      )
    ).status,
    200,
  );
  await mutate({
    action: "set_discard",
    material: "bath_towels",
    quantity: 3,
    expectedRevision: 3,
  });
  await mutate({ action: "confirm", expectedRevision: 4 });
  assert.equal(
    (
      await t.db.query(
        "SELECT sum(current_quantity)::float AS n FROM stock_levels",
      )
    ).rows[0].n,
    stockBefore,
  );
  const revised = XLSX.utils.sheet_to_json(
    XLSX.read(sent[2].payload.attachments[0].content, { type: "base64" }).Sheets
      .Recuento,
    { header: 1 },
  );
  assert.deepEqual(
    revised.find((r) => r[0] === "Toallas de baño"),
    ["Toallas de baño", 235, 3],
  );
  assert.ok(sent[2].payload.subject.includes("ACTUALIZADO"));
  const adminRead = await request(
    { action: "admin_read", warehouseId: t.warehouse },
    "Bearer fixture-admin-jwt",
  );
  assert.equal(adminRead.data.receipts[0].discarded_counts.bath_towels, 3);
  const foreignSede = randomUUID(),
    foreignWarehouse = randomUUID();
  await t.db.query("INSERT INTO sedes VALUES($1)", [foreignSede]);
  await t.db.query(
    "INSERT INTO stock_warehouses(id,sede_id,name) VALUES($1,$2,'Almacén no autorizado')",
    [foreignWarehouse, foreignSede],
  );
  assert.equal(
    (
      await request(
        { action: "admin_read", warehouseId: foreignWarehouse },
        "Bearer fixture-admin-jwt",
      )
    ).status,
    403,
  );
  assert.equal((await request({ action: "logout", ...access })).status, 200);
  assert.equal((await request({ action: "read", ...access })).status, 401);
  console.log(
    "laundry-receipt-edge: acceso, permisos, confirmación, error/reintento de correo, XLSX real y logout correctos; proveedor simulado",
  );
} finally {
  globalThis.fetch = originalFetch;
  await t.db.close();
}
