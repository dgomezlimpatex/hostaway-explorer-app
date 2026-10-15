// Local browser check of the inventory workflows. Real pages and dialogs, mocked reads and writes, no network or session.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { buildInventoryFixture } from './inventoryWorkspaceFixture.mjs';

const html = await buildInventoryFixture();
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
const where = page => page.getByLabel('Ubicación actual', { exact: true }).textContent();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url() === 'https://inventory.local.test/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
  await page.goto('https://inventory.local.test/');
  const render = (path, setup = {}) => page.evaluate(([p, s]) => { Object.assign(window, { fixtureError: undefined, fixtureRole: undefined, failWrites: false, writes: [] }, s); window.fixturePath = p; window.renderFixture(); }, [path, setup]);

  // Summary: the shortage, its cause and the next action come first.
  const shortage = page.getByRole('link', { name: /Faltan 7 Sábanas 150 para las mudas/ });
  await expect(shortage).toContainText('Disponible en Simón Bolívar: 12 · Para mudas por preparar: 19');
  await expect(page.getByRole('link', { name: /2 productos sin reserva definida/ })).toContainText('No es una falta');
  await expect(page.getByRole('link', { name: /4 mudas preparadas sin entrega confirmada/ })).toBeVisible();
  await shortage.click();
  assert.equal(await where(page), '/inventory/stock?product=sab150');
  const sheets = page.getByRole('button', { name: /Sábanas 150/ });
  await expect(sheets).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('6 reservadas en bolsas, incluidas en el stock')).toBeVisible();

  // Search and filter keep the location; accents do not matter.
  await page.getByRole('button', { name: /^Necesitan atención/ }).click();
  await expect(page.getByRole('button', { name: /Toallas grandes/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fundas de almohada/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Todos/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('sabanas');
  await expect(page.getByRole('button', { name: /Sábanas 90/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Edredones/ })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('');
  await page.getByRole('button', { name: /^Comprobar saldo/ }).click();
  await expect(page.getByRole('button', { name: /Bayetas cocina/ })).toBeVisible();
  await expect(page.getByText('Revisar saldo negativo')).toBeVisible();
  await page.getByRole('button', { name: /^Todos/ }).click();

  // Another location never mixes its balances with the central one.
  await page.getByLabel('Consultar ubicación').selectOption('b0');
  await expect(page.getByRole('heading', { name: 'Orzán 12', level: 1 })).toBeVisible();
  await expect(page.getByText('Para mudas', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Protector de colchón/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sábanas 150/ })).toHaveCount(0);
  await page.getByLabel('Consultar ubicación').selectOption('central');

  // Register a movement: the preview warns before saving; a failed save keeps the form.
  await page.getByRole('button', { name: /Toallas grandes/ }).click();
  const detail = page.locator('li').filter({ has: page.getByRole('button', { name: /Toallas grandes/ }) });
  await detail.getByRole('button', { name: 'Registrar movimiento' }).last().click();
  const adjust = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await adjust.getByText('Salida', { exact: true }).click();
  await adjust.getByRole('spinbutton', { name: 'Cantidad' }).fill('50');
  await expect(adjust.getByRole('status')).toContainText('Quedará en -15: la salida supera el saldo registrado');
  await adjust.getByRole('spinbutton', { name: 'Cantidad' }).fill('5');
  await expect(adjust.getByRole('status')).toHaveText('Quedará en 30');
  await adjust.getByLabel('Motivo').fill('Rotura en lavandería');
  await page.evaluate(() => { window.failWrites = true; });
  await adjust.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page.getByText('No se pudo guardar: conexión perdida')).toBeVisible();
  await expect(adjust).toBeVisible();
  await expect(adjust.getByLabel('Motivo')).toHaveValue('Rotura en lavandería');
  await page.evaluate(() => { window.failWrites = false; });
  await adjust.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(adjust).toHaveCount(0);
  const saved = await page.evaluate(() => window.writes.filter(w => w.name === 'adjust').map(w => [w.v.movement_type, w.v.quantity, w.v.reason]));
  assert.deepEqual(saved, [['salida', 5, 'Rotura en lavandería'], ['salida', 5, 'Rotura en lavandería']]);

  // Move: the destination must be chosen explicitly.
  await detail.getByRole('button', { name: 'Mover a otra ubicación' }).click();
  const move = page.getByRole('dialog', { name: 'Mover a otra ubicación' });
  await move.getByRole('spinbutton', { name: 'Cantidad' }).fill('4');
  await expect(move.getByRole('status')).toHaveText('Quedarán 31 disponibles en origen.');
  await expect(move.getByRole('button', { name: 'Mover', exact: true })).toBeDisabled();
  await move.getByRole('combobox', { name: 'Ubicación de destino' }).click();
  await page.getByRole('option', { name: 'Orzán 12' }).click();
  await move.getByLabel('Motivo').fill('Reposición del trastero');
  await move.getByRole('button', { name: 'Mover', exact: true }).click();
  await expect(move).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.writes.find(w => w.name === 'transfer')?.v.to_warehouse_id), 'b0');

  // Count: the draft survives closing; discard is explicit; failed lines stay pending.
  await page.getByRole('button', { name: 'Contar existencias' }).click();
  let count = page.getByRole('dialog', { name: /Contar existencias/ });
  await count.getByLabel('Contado: Sábanas 90 en Simón Bolívar').fill('38');
  await expect(count.getByText('Borrador sin guardar')).toBeVisible();
  await count.getByRole('button', { name: 'Cerrar' }).first().click();
  await page.getByRole('button', { name: 'Contar existencias' }).click();
  count = page.getByRole('dialog', { name: /Contar existencias/ });
  await expect(count.getByLabel('Contado: Sábanas 90 en Simón Bolívar')).toHaveValue('38');
  await page.evaluate(() => { window.failWrites = true; });
  await count.getByRole('button', { name: 'Guardar recuento (1 línea)' }).click();
  await expect(count).toBeVisible();
  await expect(count.getByLabel('Contado: Sábanas 90 en Simón Bolívar')).toHaveValue('38');
  await count.getByRole('button', { name: 'Descartar recuento' }).click();
  await expect(count.getByLabel('Contado: Sábanas 90 en Simón Bolívar')).toHaveValue('');
  await page.evaluate(() => { window.failWrites = false; });
  await count.getByLabel('Contado: Fundas de almohada en Simón Bolívar').fill('118');
  await count.getByRole('button', { name: 'Guardar recuento (1 línea)' }).click();
  await expect(count).toHaveCount(0);
  assert.equal(await page.evaluate(() => localStorage.getItem('inventory-count-draft:u1')), null);

  // History of a product from its row, with the location preserved.
  await page.getByRole('button', { name: /Toallas grandes/ }).click();
  await page.getByRole('button', { name: /Sábanas 90/ }).click();
  await page.locator('li').filter({ has: page.getByRole('button', { name: /Sábanas 90/ }) }).getByRole('link', { name: 'Ver historial' }).click();
  assert.equal(await where(page), '/inventory/movements?product=sab90&warehouse=central');
  await expect(page.getByText('Producto: Sábanas 90')).toBeVisible();
  await expect(page.getByText(/Sábanas 150/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await page.getByLabel('Tipo de movimiento').selectOption('transferencia');
  await expect(page.getByText('Simón Bolívar → Orzán 12').first()).toBeVisible();
  await expect(page.locator('li').filter({ hasText: /Entrada \+/ })).toHaveCount(0);

  // Bags: a summary link opens the right filter; search covers buildings; the period is kept between pages.
  await render('/inventory');
  await page.getByRole('link', { name: /2 mudas tienen incidencia/ }).click();
  await expect(page.getByRole('button', { name: /^Incidencias/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Falta una toalla grande')).toBeVisible();
  await expect(page.getByText('ORZ-1A', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Todas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar propiedad o edificio' }).fill('riazor');
  await expect(page.getByText('RIA-3', { exact: true })).toBeVisible();
  await expect(page.getByText('ORZ-1A', { exact: true })).toHaveCount(0);
  const material = page.getByRole('table', { name: /Material necesario/ });
  await expect(material.getByRole('row', { name: /Sábanas 150/ })).toContainText('19');
  await page.getByLabel('Período de preparación').selectOption('7');
  await page.getByRole('link', { name: 'Edificios', exact: true }).click();
  await expect(page.getByLabel('Período de preparación')).toHaveValue('7');

  // Buildings: list and detail side by side, selection in the URL.
  await expect(page.getByRole('region', { name: 'Ficha del edificio seleccionado' })).toContainText('Matogrande 7');
  await page.getByRole('button', { name: /^Orzán 12/ }).click();
  assert.match(await where(page), /edificio=b0/);
  const panel = page.getByRole('region', { name: 'Ficha del edificio seleccionado' });
  await expect(panel.getByText('ORZ-1A', { exact: true })).toBeVisible();
  await expect(panel.getByText('Edredones')).toBeVisible();

  // Failed reads are never shown as zero.
  await render('/inventory/stock', { fixtureError: 'stock' });
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar el inventario');
  await expect(page.getByRole('button', { name: /Sábanas 150/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  assert.ok(await page.evaluate(() => window.retries >= 1));
  await render('/inventory/stock', { fixtureError: 'demand' });
  await expect(page.getByRole('alert')).toContainText('No se pudieron consultar las mudas');
  await expect(page.locator('li').filter({ has: page.getByRole('button', { name: /Sábanas 150/ }) })).toContainText('Mudas sin consultar');
  await render('/inventory/preparation', { fixtureError: 'demand' });
  await expect(page.getByText('No se pudieron cargar las mudas')).toBeVisible();
  await expect(page.getByText('ORZ-1A', { exact: true })).toHaveCount(0);
  await render('/inventory/movements', { fixtureError: 'stock' });
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar el historial');

  // Read-only users see the figures, not the operations.
  await render('/inventory/stock', { fixtureRole: 'reader' });
  await expect(page.getByRole('button', { name: /Sábanas 150/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Contar existencias' })).toHaveCount(0);

  // Phone: no horizontal overflow; a tap or the keyboard opens a product with its operations.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/inventory', '/inventory/stock', '/inventory/preparation', '/inventory/warehouses', '/inventory/movements', '/inventory/reports']) {
    await render(path);
    await expect(page.getByRole('navigation', { name: 'Secciones de inventario' })).toBeVisible();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `No horizontal overflow ${path}`);
  }
  await render('/inventory/stock');
  await page.getByRole('button', { name: /Toallas grandes/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toBeVisible();
  await render('/inventory/warehouses');
  await page.getByRole('button', { name: /^Riazor 4/ }).click();
  await expect(page.getByRole('region', { name: 'Lista de edificios' }).getByText('RIA-3', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ficha del edificio seleccionado' })).toBeHidden();

  assert.deepEqual(errors, []);
  console.log('PASS inventory redesign browser: summary actions, stock filters and locations, movement preview and failed save, explicit move destination, count draft, history, bags, buildings, truthful errors, read-only role and phone layout. Mocked data, no network.');
} finally { await browser.close(); }
