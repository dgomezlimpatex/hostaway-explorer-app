import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import XLSX from "xlsx";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";
import { loadReceiptEdge } from "./laundryReceiptEdgeTestSupport.mjs";

const t = await receiptTestDatabase();
const { request } = await loadReceiptEdge(t);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.equal(url, "https://api.resend.com/emails");
  return new Response(JSON.stringify({ id: "browser-fixture-provider-id" }), {
    status: 200,
  });
};
const port = Number(process.env.RECEIPT_TEST_PORT || 8093),
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let serverOutput = "";
server.stdout.on("data", (b) => {
  serverOutput += b;
});
server.stderr.on("data", (b) => {
  serverOutput += b;
});
let browser;
const artifacts = await mkdtemp(join(tmpdir(), "laundry-receipt-browser-"));
const errors = [];
let dropNextAdd = false;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Preview no disponible: ${serverOutput}`)),
      15000,
    );
    server.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error(serverOutput));
    });
    const poll = setInterval(() => {
      if (serverOutput.includes(base)) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    if (url.pathname === "/functions/v1/laundry-receipts") {
      const body = route.request().postDataJSON();
      const result = await request(body);
      if (
        dropNextAdd &&
        body.action === "mutate" &&
        body.payload.action === "add"
      ) {
        dropNextAdd = false;
        return route.abort("connectionfailed");
      }
      return route.fulfill({
        status: result.status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(result.data),
      });
    }
    // Block every other external request, including production DB/auth.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "[]",
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${base}/recepcion-lavanderia/${t.config.token}`);
  await page.getByLabel("Tu PIN de empleado").fill("9999");
  await page.getByRole("button", { name: "Entrar al recuento" }).click();
  await page.getByRole("alert").filter({ hasText: "PIN incorrecto" }).waitFor();
  await page.getByLabel("Tu PIN de empleado").fill("1234");
  await page.getByRole("button", { name: "Entrar al recuento" }).click();
  await page.getByRole("button", { name: "Iniciar recuento de hoy" }).click();
  await page.getByLabel("Cantidad Toallas de baño", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Añadir", exact: true }).count(),
    9,
  );
  const towel = page
    .locator("section")
    .filter({ has: page.locator('label[for="count-bath_towels"]') });
  for (const [quantity, total] of [
    [80, 80],
    [65, 145],
    [90, 235],
  ]) {
    await page
      .getByLabel("Cantidad Toallas de baño", { exact: true })
      .fill(String(quantity));
    await towel.getByRole("button", { name: "Añadir", exact: true }).click();
    await page
      .getByLabel("Total Toallas de baño", { exact: true })
      .filter({ hasText: String(total) })
      .waitFor();
    await assert.doesNotReject(() =>
      page.getByLabel("Cantidad Toallas de baño", { exact: true }).fill(""),
    );
  }
  await page
    .getByRole("button", { name: "Revisar recuento", exact: true })
    .click();
  await page.getByRole("heading", { name: "Revisa las cantidades" }).waitFor();
  assert.equal(
    (
      await t.db.query(
        "SELECT count(*)::int as n FROM laundry_receipt_versions",
      )
    ).rows[0]?.n ?? 0,
    0,
  );
  assert.equal(
    (
      await t.db.query(
        "SELECT current_quantity::float as n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0]?.n ?? 0,
    0,
  );
  await page.screenshot({
    path: join(artifacts, "review-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirmar y enviar Excel", exact: true })
    .click();
  await page
    .getByText("Correo aceptado por el proveedor", { exact: true })
    .waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar Excel", exact: true }).click(),
  ]);
  const excelPath = join(artifacts, download.suggestedFilename());
  await download.saveAs(excelPath);
  const wb = XLSX.readFile(excelPath);
  assert.equal(
    XLSX.utils
      .sheet_to_json(wb.Sheets.Recuento, { header: 1 })
      .find((r) => r[0] === "Toallas de baño")[1],
    235,
  );
  await page.getByRole("button", { name: "Volver al recuento" }).click();
  dropNextAdd = true;
  await page.getByLabel("Cantidad Toallas de baño", { exact: true }).fill("15");
  await towel.getByRole("button", { name: "Añadir", exact: true }).click();
  await page
    .getByText("Operación pendiente de guardar", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Recuperar operación" })
    .waitFor({ state: "visible" });
  await page.reload();
  await page.getByRole("button", { name: "Recuperar operación" }).click();
  await page
    .getByText("Operación pendiente de guardar", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByLabel("Total Toallas de baño", { exact: true })
      .textContent(),
    "250",
  );
  await page
    .getByRole("button", { name: "Revisar recuento", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Confirmar cambios y reenviar Excel",
      exact: true,
    })
    .click();
  await page.getByText("Versión 2 · Empleado A", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Editar Toallas de baño" }).click();
  await page.getByLabel("Total corregido Toallas de baño").fill("240");
  await page
    .getByRole("button", { name: "Guardar corrección", exact: true })
    .click();
  await page
    .getByLabel("Revisado Toallas de baño", { exact: true })
    .filter({ hasText: "240" })
    .waitFor();
  assert.equal(
    (
      await t.db.query(
        "SELECT current_quantity::float as n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0].n,
    250,
  );
  await page
    .getByRole("button", {
      name: "Confirmar cambios y reenviar Excel",
      exact: true,
    })
    .click();
  await page.getByText("Versión 3 · Empleado A", { exact: true }).waitFor();
  const other = await context.newPage();
  await other.goto(`${base}/recepcion-lavanderia/${t.config.token}`);
  await other.getByLabel("Total Toallas de baño", { exact: true }).waitFor();
  assert.equal(
    await other
      .getByLabel("Total Toallas de baño", { exact: true })
      .textContent(),
    "240",
  );
  assert.equal(
    (
      await t.db.query(
        "SELECT current_quantity::float AS n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0].n,
    240,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "sin desbordamiento móvil",
  );
  await page.screenshot({
    path: join(artifacts, "mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: join(artifacts, "desktop.png"),
    fullPage: true,
  });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await adminContext.addInitScript(() => {
    localStorage.setItem(
      "sb-qyipyygojlfhdghnraus-auth-token",
      JSON.stringify({
        access_token: "fixture-admin-jwt",
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: {
          id: "fixture-admin",
          email: "fixture-admin@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      }),
    );
  });
  await adminContext.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === base) return route.continue();
    let data = [];
    let status = 200;
    if (url.pathname === "/functions/v1/laundry-receipts") {
      const result = await request(
        route.request().postDataJSON(),
        "Bearer fixture-admin-jwt",
      );
      data = result.data;
      status = result.status;
    } else if (url.pathname.endsWith("/rpc/get_user_role")) data = "admin";
    else if (url.pathname.endsWith("/rpc/get_user_accessible_sedes"))
      data = [t.sede];
    else if (url.pathname.endsWith("/profiles"))
      data = {
        id: "fixture-admin",
        full_name: "Administración de prueba",
        email: null,
      };
    else if (url.pathname.endsWith("/user_roles")) data = [{ role: "admin" }];
    else if (url.pathname.endsWith("/sedes"))
      data = [
        {
          id: t.sede,
          nombre: "Sede de prueba",
          codigo: "PRUEBA",
          ciudad: "A Coruña",
          is_active: true,
        },
      ];
    else if (url.pathname.endsWith("/stock_warehouses"))
      data = (await t.db.query("SELECT * FROM stock_warehouses")).rows;
    else if (url.pathname.endsWith("/stock_products"))
      data = Object.entries(t.productMap).map(([key, id]) => ({
        id,
        sede_id: t.sede,
        name: key,
        category: { kind: "laundry" },
        is_active: true,
      }));
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(data),
    });
  });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (err) => errors.push(err.message));
  await admin.goto(`${base}/inventory/laundry/receipts`);
  await admin
    .getByLabel("Almacén que recibe la ropa limpia")
    .selectOption(t.warehouse2);
  await admin.getByLabel("Sábanas de matrimonio", { exact: true }).waitFor();
  for (const key of Object.keys(t.productMap))
    await admin.locator(`#map-${key}`).selectOption(t.productMap[key]);
  await admin.getByLabel("Empleado A", { exact: true }).check();
  await admin.getByRole("button", { name: "Guardar configuración" }).click();
  await admin.getByRole("button", { name: "Copiar enlace" }).waitFor();
  const secondConfig = (
    await t.db.query(
      "SELECT * FROM laundry_receipt_links WHERE warehouse_id=$1",
      [t.warehouse2],
    )
  ).rows[0];
  assert.deepEqual(secondConfig.product_map, t.productMap);
  assert.deepEqual(secondConfig.worker_ids, [t.worker]);
  await admin
    .getByLabel("Almacén que recibe la ropa limpia")
    .selectOption(t.warehouse);
  const historyRow = admin.locator("summary").filter({ hasText: t.date });
  try {
    await historyRow.waitFor({ timeout: 5000 });
  } catch (err) {
    await admin.screenshot({
      path: join(artifacts, "admin-failure.png"),
      fullPage: true,
    });
    console.log((await admin.locator("body").innerText()).slice(-2500));
    throw err;
  }
  assert.ok((await historyRow.innerText()).includes("Última versión 3"));
  await historyRow.click();
  await admin.getByRole("button", { name: "Descargar Excel v3" }).waitFor();
  await admin.screenshot({
    path: join(artifacts, "admin.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    `laundry-receipt-browser: móvil/escritorio, PIN, 9 materiales, tandas, Excel descargado, pérdida de respuesta, recarga/reintento, corrección, continuidad y configuración/historial administrativos correctos. Artefactos: ${artifacts}`,
  );
} finally {
  await browser?.close();
  server.kill();
  globalThis.fetch = originalFetch;
  await t.db.close();
}
