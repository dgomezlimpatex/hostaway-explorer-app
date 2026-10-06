import assert from "node:assert/strict";
import XLSX from "xlsx";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";
import { loadReceiptEdge } from "./laundryReceiptEdgeTestSupport.mjs";

const t = await receiptTestDatabase();
const { request } = await loadReceiptEdge(t);
const originalFetch = globalThis.fetch,
  sent = [];
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.resend.com/emails");
  sent.push(JSON.parse(options.body));
  return new Response(
    JSON.stringify(
      sent.length === 1 ? { error: "fixture" } : { id: "legacy-fixture" },
    ),
    { status: sent.length === 1 ? 503 : 200 },
  );
};
try {
  await t.mutate({ action: "start" });
  await t.mutate({ action: "add", material: "bath_towels", quantity: 20 });
  const s = await t.state();
  const version = await t.mutate({
    action: "confirm",
    expectedRevision: s.receipt.revision,
  });
  // Mimic an immutable pre-extension snapshot before its pending job runs.
  await t.db.query(
    "UPDATE laundry_receipt_versions SET snapshot=snapshot-'discarded_counts'",
  );
  const login = await request({
    action: "login",
    token: t.config.token,
    pin: "1234",
  });
  const access = {
    token: t.config.token,
    sessionToken: login.data.sessionToken,
  };
  assert.equal(
    (
      await request({
        action: "retry",
        ...access,
        versionId: version.versionId,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request({
        action: "retry",
        ...access,
        versionId: version.versionId,
      })
    ).status,
    200,
  );
  assert.deepEqual(
    sent[0],
    sent[1],
    "Legacy retries keep the exact provider payload",
  );
  const wb = XLSX.read(sent[0].attachments[0].content, { type: "base64" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Recuento, { header: 1 });
  assert.deepEqual(
    rows.find((r) => r[0] === "Material"),
    ["Material", "Unidades recibidas"],
  );
  assert.deepEqual(
    rows.find((r) => r[0] === "Toallas de baño"),
    ["Toallas de baño", 20],
  );
  assert.ok(
    sent[0].text.endsWith(
      "El Excel contiene el recuento recibido, no las existencias totales del almacén.",
    ),
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
    "Legacy pending mail: original two-column workbook/text, exact retries and no stock effects preserved.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await t.db.close();
}
