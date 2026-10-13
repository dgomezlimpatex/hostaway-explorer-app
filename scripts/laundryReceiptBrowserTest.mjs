import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import XLSX from "xlsx";
import { receiptTestDatabase } from "./laundryReceiptTestSupport.mjs";
import { loadReceiptEdge } from "./laundryReceiptEdgeTestSupport.mjs";

const t = await receiptTestDatabase();
const { request } = await loadReceiptEdge(t);
const pendingDate = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-20)::text AS d")).rows[0].d;
await t.mutate({ action: "start" }, { date: pendingDate });
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
let delayNextAdd = false;
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
      if (delayNextAdd && body.action === "mutate" && body.payload.action === "add") {
        delayNextAdd = false;
        await new Promise(resolve => setTimeout(resolve, 450));
      }
      const result = await request(body);
      if (
        dropNextAdd &&
        body.action === "mutate" &&
        ["add", "add_discard"].includes(body.payload.action)
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
  await page.getByRole("button", { name: "Iniciar recuento de hoy" }).waitFor();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Landing desborda a ${width}px`);
    await page.screenshot({ path: join(artifacts, `start-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Recuentos pendientes' }).getByRole('button', { name: /Retomar/ }).click();
  await expect(page.getByLabel('Fecha de la entrega', { exact: true })).toHaveValue(pendingDate);
  await page.getByLabel('Cantidad Toallas de baño', { exact: true }).waitFor();
  await page.getByLabel('Fecha de la entrega', { exact: true }).fill(t.date);
  await page.getByRole('button', { name: 'Iniciar recuento de hoy' }).waitFor();
  const historicalEntryDate = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-2)::text AS d")).rows[0].d;
  await page.getByLabel('Fecha de la entrega', { exact: true }).fill(historicalEntryDate);
  await page.getByRole('button', { name: /^Iniciar recuento del / }).waitFor();
  await expect(page.getByRole('note')).toContainText('se actualizará el stock actual');
  await page.screenshot({ path: join(artifacts, 'start-historical-pending.png'), fullPage: true });
  await page.getByRole('button', { name: 'Volver a hoy', exact: true }).click();
  await page.getByRole("button", { name: "Iniciar recuento de hoy" }).click();
  await page.getByLabel("Cantidad Toallas de baño", { exact: true }).waitFor();
  const expectedLabels = ["Sábanas de suite", "Sábanas de matrimonio", "Sábanas individuales", "Fundas de almohada", "Toallas de manos", "Toallas de baño", "Alfombrín de ducha", "Almohada", "Cubre colchón", "Edredón"];
  assert.deepEqual(await page.locator('input[aria-label^="Cantidad "]:not([aria-label^="Cantidad descartes "])').evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label').replace('Cantidad ', ''))), expectedLabels);
  await page.getByLabel("Cantidad Sábanas de suite", { exact: true }).fill("12");
  const suiteCard = page.locator('label[for="count-suite_sheets"]').locator('xpath=ancestor::section[1]');
  const cardTop = await suiteCard.evaluate(node => node.getBoundingClientRect().top);
  assert.equal(await page.locator('.receipt-action-dock').evaluate(node => getComputedStyle(node).position), 'static', 'Keyboard focus keeps footer out of the keyboard');
  delayNextAdd = true;
  await page.getByLabel("Cantidad Sábanas de suite", { exact: true }).press('Enter');
  await page.getByText('Guardando operación…', {exact: true}).waitFor();
  assert.equal(await page.getByText('Operación pendiente de guardar', {exact: true}).count(), 0, 'Saving must not insert the large recovery banner');
  const savingTop = await suiteCard.evaluate(node => node.getBoundingClientRect().top);
  assert.ok(Math.abs(savingTop - cardTop) < 2, 'Saving keeps the current card in place');
  await expect(page.getByLabel("Total Sábanas de suite", { exact: true })).toHaveText("12");
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await page.locator('.receipt-total').first().evaluate(node => getComputedStyle(node).animationName), 'none');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.getByLabel("Cantidad Sábanas de suite", {exact: true}).blur();
  assert.equal(await page.locator('.receipt-action-dock').evaluate(node => getComputedStyle(node).position), 'sticky');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({width, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Counting overflow at ${width}`);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({animations: 'disabled', path: join(artifacts, 'count-fluid-mobile.png'), fullPage: true});
  assert.equal(
    await page.getByRole("button", { name: "Añadir", exact: true }).count(),
    10,
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
  assert.equal(
    await page
      .getByLabel("Cantidad descartes Toallas de baño", { exact: true })
      .isVisible(),
    false,
    "Discard rows closed by default",
  );
  assert.equal(await page.getByLabel("Observaciones e incidencias").count(), 0);
  await page.locator("summary").filter({ hasText: "DESCARTES" }).click();
  assert.equal(
    await page.locator('input[aria-label^="Cantidad descartes "]').count(),
    10,
  );
  for (const [quantity, total] of [
    [5, 5],
    [7, 12],
  ]) {
    await page
      .getByLabel("Cantidad descartes Toallas de baño", { exact: true })
      .fill(String(quantity));
    await page.getByLabel("Cantidad descartes Toallas de baño", {exact: true}).press('Enter');
    await page
      .getByLabel("Total descartes Toallas de baño", { exact: true })
      .filter({ hasText: String(total) })
      .waitFor();
  }
  dropNextAdd = true;
  await page
    .getByLabel("Cantidad descartes Toallas de baño", { exact: true })
    .fill("3");
  await page
    .getByRole("button", {
      name: "Añadir descartes Toallas de baño",
      exact: true,
    })
    .click();
  await page
    .getByText("Operación pendiente de guardar", { exact: true })
    .waitFor();
  // Wait for the simulated lost response before reloading. The pending banner
  // appears as soon as saving starts, while the request can still be in flight.
  await expect(
    page.getByRole("button", { name: "Recuperar operación" }),
  ).toBeEnabled();
  assert.equal(
    dropNextAdd,
    false,
    "The dropped response must already have happened",
  );
  await page.reload();
  await page.getByRole("button", { name: "Recuperar operación" }).click();
  await page
    .getByText("Operación pendiente de guardar", { exact: true })
    .waitFor({ state: "hidden" });
  await page.locator("summary").filter({ hasText: "DESCARTES" }).click();
  assert.equal(
    await page
      .getByLabel("Total descartes Toallas de baño", { exact: true })
      .textContent(),
    "15",
    "Discard response recovery must not duplicate",
  );
  await page.screenshot({
    path: join(artifacts, "discards-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Revisar recuento", exact: true })
    .click();
  await page.getByRole("heading", { name: "Revisa las cantidades" }).waitFor();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({width, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Review overflow at ${width}`);
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({animations: 'disabled', path: join(artifacts, 'review-fluid-mobile.png'), fullPage: true});
  await expect(page.getByLabel("Revisado Sábanas de suite", { exact: true })).toHaveText("12");
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
  assert.equal(
    await page
      .getByRole("button", {
        name: "Editar descartes Toallas de baño",
        exact: true,
      })
      .isVisible(),
    false,
  );
  await page.locator("summary").filter({ hasText: "DESCARTES" }).click();
  await page
    .getByRole("button", {
      name: "Editar descartes Toallas de baño",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Total corregido descartes Toallas de baño", { exact: true })
    .fill("10");
  assert.equal(
    await page
      .getByRole("button", { name: "Confirmar y enviar Excel", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Guardar corrección", exact: true })
    .click();
  await page
    .getByLabel("Revisado descartes Toallas de baño", { exact: true })
    .filter({ hasText: "10" })
    .waitFor();
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
  assert.deepEqual(
    XLSX.utils
      .sheet_to_json(wb.Sheets.Recuento, { header: 1 })
      .find((r) => r[0] === "Toallas de baño"),
    ["Toallas de baño", 235, 10],
  );
  assert.equal(
    (
      await t.db.query(
        "SELECT current_quantity::float AS n FROM stock_levels WHERE product_id=$1",
        [t.productMap.bath_towels],
      )
    ).rows[0].n,
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
  // Wait for the simulated lost response before reloading. The pending banner
  // appears as soon as saving starts, while the request can still be in flight.
  await expect(
    page.getByRole("button", { name: "Recuperar operación" }),
  ).toBeEnabled();
  assert.equal(
    dropNextAdd,
    false,
    "The dropped response must already have happened",
  );
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
  // Use the real page with a historical date; recover a lost response on that date.
  const pastDate = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-5)::text AS d")).rows[0].d;
  const adminPastDate = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date-7)::text AS d")).rows[0].d;
  const futureDate = (await t.db.query("SELECT ((now() AT TIME ZONE 'Europe/Madrid')::date+1)::text AS d")).rows[0].d;
  const suiteBalance = () => t.db.query('SELECT current_quantity::int AS n FROM stock_levels WHERE product_id=$1',[t.productMap.suite_sheets]).then(r=>r.rows[0]?.n??0);
  const beforePast = await suiteBalance();
  if (await page.getByRole('button',{name:'Volver al recuento',exact:true}).count()) await page.getByRole('button',{name:'Volver al recuento',exact:true}).click();
  await page.getByLabel('Fecha de la entrega',{exact:true}).fill(pastDate);
  await page.getByRole('button',{name:/^Iniciar recuento del /,exact:true}).click();
  dropNextAdd = true;
  await page.getByLabel('Cantidad Sábanas de suite',{exact:true}).fill('17');
  await page.locator('section').filter({has:page.locator('label[for="count-suite_sheets"]')}).getByRole('button',{name:'Añadir',exact:true}).click();
  await expect(page.getByRole('button',{name:'Recuperar operación',exact:true})).toBeEnabled();
  await expect(page.getByLabel('Fecha de la entrega',{exact:true})).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Fecha de la entrega',{exact:true})).toHaveValue(pastDate);
  await page.getByRole('button',{name:'Recuperar operación',exact:true}).click();
  await expect(page.getByLabel('Total Sábanas de suite',{exact:true})).toHaveText('17');
  await page.getByRole('button',{name:'Revisar recuento',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar y enviar Excel',exact:true}).click();
  await page.getByRole('heading',{name:'Recuento confirmado',exact:true}).waitFor();
  assert.equal(await suiteBalance(),beforePast+17);
  assert.equal((await t.state({date:pastDate})).versions[0].snapshot.receipt_date,pastDate);
  await page.screenshot({path:join(artifacts,'historical-public.png'),fullPage:true});
  await page.getByRole('button',{name:'Volver al recuento',exact:true}).click();
  await page.getByLabel('Fecha de la entrega',{exact:true}).fill(t.date);
  await expect(page.getByLabel('Total Sábanas de suite',{exact:true})).toHaveText('12');
  await page.getByLabel('Cantidad Sábanas de suite',{exact:true}).fill('6');
  page.removeAllListeners('dialog');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByLabel('Fecha de la entrega',{exact:true}).fill(adminPastDate);
  await expect(page.getByLabel('Fecha de la entrega',{exact:true})).toHaveValue(t.date);
  await expect(page.getByLabel('Cantidad Sábanas de suite',{exact:true})).toHaveValue('6');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByLabel('Fecha de la entrega',{exact:true}).fill(adminPastDate);
  await page.getByRole('button',{name:/^Iniciar recuento del /,exact:true}).waitFor();
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM laundry_receipts WHERE receipt_date=$1',[adminPastDate])).rows[0].n,0,'Selecting a day alone cannot create a receipt');
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await adminContext.addInitScript(({admin}) => {
    localStorage.setItem(
      "sb-qyipyygojlfhdghnraus-auth-token",
      JSON.stringify({
        access_token: "fixture-admin-jwt",
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: {
          id: admin,
          email: "fixture-admin@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      }),
    );
  }, {admin:t.admin});
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
        id: t.admin,
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
  assert.equal(await admin.getByLabel('Tu PIN de empleado').count(),0,'Administrator uses the existing authenticated session');
  await admin.getByLabel('Fecha de la entrega',{exact:true}).fill(pastDate);
  await expect(admin.getByLabel('Total Sábanas de suite',{exact:true})).toHaveText('17');
  await admin.getByRole('button',{name:'Revisar recuento',exact:true}).click();
  await expect(admin.getByLabel('Almacén que recibe la ropa limpia')).toBeDisabled();
  await expect(admin.getByLabel('Fecha de la entrega',{exact:true})).toBeDisabled();
  await admin.getByRole('button',{name:'Editar Sábanas de suite',exact:true}).click();
  await admin.getByLabel('Total corregido Sábanas de suite',{exact:true}).fill('19');
  await admin.getByRole('button',{name:'Guardar corrección',exact:true}).click();
  await expect(admin.getByLabel('Revisado Sábanas de suite',{exact:true})).toHaveText('19');
  assert.equal(await suiteBalance(),beforePast+17,'Admin draft correction cannot change stock');
  await admin.getByRole('button',{name:'Confirmar cambios y reenviar Excel',exact:true}).click();
  await admin.getByRole('heading',{name:'Recuento confirmado',exact:true}).waitFor();
  assert.equal(await suiteBalance(),beforePast+19);
  const corrected=await t.state({date:pastDate});
  assert.equal(corrected.versions[0].admin_user_id,t.admin);
  assert.equal(corrected.versions[0].snapshot.counts.suite_sheets,19);
  assert.equal(corrected.versions[1].snapshot.counts.suite_sheets,17);
  await admin.screenshot({path:join(artifacts,'historical-admin-correction.png'),fullPage:true});
  await admin.getByRole('button',{name:'Volver al recuento',exact:true}).click();
  await admin.getByLabel('Fecha de la entrega',{exact:true}).fill(adminPastDate);
  await admin.getByRole('button',{name:/^Iniciar recuento del /,exact:true}).click();
  await admin.getByLabel('Cantidad Toallas de baño',{exact:true}).fill('4');
  await admin.locator('label[for="count-bath_towels"]').locator('xpath=ancestor::section[1]').getByRole('button',{name:'Añadir',exact:true}).click();
  await expect(admin.getByLabel('Total Toallas de baño',{exact:true})).toHaveText('4');
  await admin.getByRole('button',{name:'Revisar recuento',exact:true}).click();
  await admin.getByRole('button',{name:'Confirmar y enviar Excel',exact:true}).click();
  await admin.getByRole('heading',{name:'Recuento confirmado',exact:true}).waitFor();
  assert.equal((await t.state({date:adminPastDate})).versions[0].admin_user_id,t.admin);
  await admin.getByRole('button',{name:'Volver al recuento',exact:true}).click();
  await admin.getByLabel('Fecha de la entrega',{exact:true}).fill(futureDate);
  await admin.getByRole('alert').filter({hasText:'fecha válida'}).waitFor();
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM laundry_receipts WHERE receipt_date=$1',[futureDate])).rows[0].n,0);
  await admin.screenshot({
    path: join(artifacts, "admin.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    `laundry-receipt-browser: móvil/escritorio, PIN, 10 materiales, fechas pasadas, recarga/reintento histórico, alta/corrección administrativa sin PIN, stock por diferencia, bloqueo de fechas futuras, Excel y configuración/historial correctos. Artefactos: ${artifacts}`,
  );
} finally {
  await browser?.close();
  server.kill();
  globalThis.fetch = originalFetch;
  await t.db.close();
}
