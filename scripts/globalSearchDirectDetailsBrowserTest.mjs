// Browser check of the global search opening exact records, with synthetic data
// and an in-memory Supabase double (no backend, session or network).
// Run locally: node scripts/globalSearchDirectDetailsBrowserTest.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from '@playwright/test';
import { buildGlobalSearchFixture } from './globalSearchDirectDetailsFixture.mjs';

const html = await buildGlobalSearchFixture();
const server = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
const results = [];
const step = async (name, fn) => { await fn(); results.push(name); console.log('ok -', name); };

const open = async (page, path) => { await page.goto(base + path); await page.getByTestId('where').waitFor(); };
const where = (page) => page.getByTestId('where').textContent();
const expectWhere = async (page, value) => { await page.waitForFunction((v) => document.querySelector('[data-testid="where"]')?.textContent === v, value, { timeout: 5000 }).catch(() => {}); assert.equal(await where(page), value); };
const detailTitles = (page) => page.locator('[data-entity-detail-title]');
const focusedTitle = (page) => page.evaluate(() => document.activeElement?.hasAttribute('data-entity-detail-title') ? document.activeElement.textContent.trim() : `not a title: ${document.activeElement?.tagName}`);
const waitFocusedTitle = async (page, text) => { await page.waitForFunction((t) => document.activeElement?.hasAttribute('data-entity-detail-title') && document.activeElement.textContent.includes(t), text, { timeout: 5000 }).catch(() => {}); assert.match(await focusedTitle(page), new RegExp(text)); };

/** Open the search with Ctrl+K, type, then move with the keyboard to the item whose value starts with prefix and press Enter. */
const searchAndPick = async (page, term, prefix) => {
  await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {});
  await page.keyboard.press('Control+k');
  const input = page.getByPlaceholder('Buscar tareas, propiedades, trabajadores, clientes...');
  await input.waitFor();
  await input.fill(term);
  await page.locator(`[cmdk-item][data-value^="${prefix}"]`).first().waitFor({ timeout: 5000 });
  for (let i = 0; i < 40; i += 1) {
    const value = await page.locator('[cmdk-item][aria-selected="true"]').getAttribute('data-value');
    if (value?.startsWith(prefix)) break;
    await page.keyboard.press('ArrowDown');
  }
  assert.ok((await page.locator('[cmdk-item][aria-selected="true"]').getAttribute('data-value')).startsWith(prefix), `keyboard reaches ${prefix}`);
  await page.keyboard.press('Enter');
  await input.waitFor({ state: 'detached' });
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));

  await step('search shows duplicated names separately, scoped to the active sede', async () => {
    await open(page, '/');
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Buscar tareas, propiedades, trabajadores, clientes...').fill('Duplicado');
    await page.locator('[cmdk-item][data-value^="prop-p-dup-2"]').waitFor();
    const values = await page.locator('[cmdk-item]').evaluateAll((items) => items.map((i) => i.getAttribute('data-value')));
    assert.ok(values.some((v) => v.startsWith('prop-p-dup-1')) && values.some((v) => v.startsWith('prop-p-dup-2')));
    assert.ok(!values.some((v) => v.includes('sede-b')), 'other sede is not listed');
    await page.keyboard.press('Escape');
    await page.getByPlaceholder('Buscar tareas, propiedades, trabajadores, clientes...').waitFor({ state: 'detached' });
    assert.equal(await where(page), '/', 'Escape closes without navigating');
  });

  await step('reopening the search at once still highlights a result, so Enter works', async () => {
    const input = page.getByPlaceholder('Buscar tareas, propiedades, trabajadores, clientes...');
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Control+k');
      await input.fill('Hostal');
      await page.locator('[cmdk-item]').first().waitFor();
      await page.keyboard.press('Escape');
      await input.waitFor({ state: 'detached' });
      await page.keyboard.press('Control+k');
      await input.fill('Ana');
      await page.locator('[cmdk-item][data-value^="worker-"]').first().waitFor();
      await page.locator('[cmdk-item][aria-selected="true"]').waitFor({ timeout: 2000 });
      await page.keyboard.press('Escape');
      await input.waitFor({ state: 'detached' });
    }
  });

  await step('property from another screen opens its own detail even when the status filter hides it', async () => {
    await searchAndPick(page, 'Duplicado', 'prop-p-dup-2');
    await expectWhere(page, '/properties?propertyId=p-dup-2');
    await page.getByText('DUP-DOS').first().waitFor();
    assert.equal(await page.getByText('DUP-UNO').count(), 0, 'the homonym is not shown');
    await waitFocusedTitle(page, 'Zeta Duplicado');
  });

  await step('a second property from the same screen keeps its filters and switches by id', async () => {
    await page.getByRole('button', { name: /Inactivas/ }).click();
    await expectWhere(page, '/properties');
    await searchAndPick(page, 'Duplicado', 'prop-p-dup-1');
    await expectWhere(page, '/properties?propertyId=p-dup-1');
    await page.getByText('DUP-UNO').first().waitFor();
    assert.equal(await page.getByRole('button', { name: /Inactivas/ }).getAttribute('aria-pressed'), 'true', 'status filter kept');
    await page.getByText('No hay coincidencias').waitFor();
    assert.equal(await page.getByText('DUP-UNO').count() > 0, true, 'opened although the list filter hides it');
  });

  await step('Back and Forward move between linked properties; reload keeps the detail', async () => {
    await page.goBack();
    await expectWhere(page, '/properties');
    await page.goForward();
    await expectWhere(page, '/properties?propertyId=p-dup-1');
    await page.getByText('DUP-UNO').first().waitFor();
    await page.reload();
    await page.getByText('DUP-UNO').first().waitFor();
    await expectWhere(page, '/properties?propertyId=p-dup-1');
  });

  await step('choosing another property removes the stale param so reload does not reopen it', async () => {
    await page.getByRole('button', { name: /Todas/ }).click();
    await expectWhere(page, '/properties');
    await page.reload();
    await page.getByText(/de 42 propiedades|de 42/).first().waitFor();
    assert.equal(await page.getByText('DUP-UNO').count(), 0);
  });

  await step('unavailable or other-sede property shows a notice, no approximate record and no sede change', async () => {
    for (const id of ['p-sede-b', 'p-borrada']) {
      await open(page, `/properties?propertyId=${id}`);
      await page.getByRole('heading', { name: 'Propiedad no disponible' }).waitFor();
      assert.equal(await page.locator('[data-entity-detail-title]').count(), 1, 'only the notice title, no detail opened');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('activeSede')).id), 'sede-a');
      assert.equal(await page.evaluate(() => window.sedeChanges || 0), 0);
    }
    await page.getByRole('button', { name: 'Volver al directorio' }).click();
    await expectWhere(page, '/properties');
    await page.locator('[data-entity-detail-title]').first().waitFor();
  });

  await step('client hidden by the current filter opens by id; filter is preserved; duplicated name resolved', async () => {
    await open(page, '/clients');
    await page.getByRole('button', { name: /^Activos/ }).click();
    await searchAndPick(page, 'Hostal', 'client-c-dup-2');
    await expectWhere(page, '/clients?clientId=c-dup-2');
    await page.getByText('B-SEGUNDO').first().waitFor();
    assert.equal(await page.getByRole('button', { name: /^Activos/ }).getAttribute('aria-pressed'), 'true', 'status filter kept');
    await waitFocusedTitle(page, 'Hostal Duplicado');
    await page.reload();
    await page.getByText('B-SEGUNDO').first().waitFor();
    await page.goto(base + '/clients?clientId=c-sede-b');
    await page.getByRole('heading', { name: 'Cliente no disponible' }).waitFor();
    assert.equal(await page.getByText('B-SEGUNDO').count(), 0);
  });

  await step('clicking another client clears the link; Back reopens the linked one', async () => {
    await open(page, '/clients');
    await searchAndPick(page, 'Hostal', 'client-c-dup-1');
    await expectWhere(page, '/clients?clientId=c-dup-1');
    await page.getByText('Cliente Corriente').first().click();
    await expectWhere(page, '/clients');
    await page.goBack();
    await expectWhere(page, '/clients');
  });

  await step('worker opens their profile by id (not the task list), including an inactive homonym', async () => {
    await searchAndPick(page, 'Ana', 'worker-w-ana-2');
    await expectWhere(page, '/workers/w-ana-2');
    await page.getByRole('heading', { name: 'Ana Repetida' }).waitFor();
    await page.getByText('Inactivo').first().waitFor();
    await waitFocusedTitle(page, 'Ana Repetida');
    await page.goto(base + '/workers/w-sede-b');
    await page.getByText('No se encuentra este trabajador en la sede seleccionada.').waitFor();
  });

  await step('task outside the loaded week opens its detail; Escape closes and does not reopen', async () => {
    await open(page, '/tasks');
    await page.getByText('Tareas Hoy').first().waitFor();
    await searchAndPick(page, 'Duplicado', 'task-t-old');
    await expectWhere(page, '/tasks?taskId=t-old');
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Tarea antigua fuera de la semana').first().waitFor({ timeout: 8000 }).catch(async () => {
      await dialog.locator('input[value="2025-01-10"], text=2025-01-10, text=10/01/2025').first().waitFor();
    });
    await page.keyboard.press('Escape');
    await expectWhere(page, '/tasks');
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('dialog').count(), 0, 'no reopening from a stale param');
    await page.goForward();
    await expectWhere(page, '/tasks');
    await page.reload();
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('dialog').count(), 0);
  });

  await step('task reload, Back/Forward and unavailable task', async () => {
    await open(page, '/tasks?taskId=t-now');
    await page.getByRole('dialog').getByText('Tarea de hoy').first().waitFor({ timeout: 8000 });
    await open(page, '/tasks?taskId=t-sede-b');
    await page.getByRole('heading', { name: 'Tarea no disponible' }).waitFor();
    await page.goBack();
    await expectWhere(page, '/tasks?taskId=t-now');
    await page.getByRole('dialog').getByText('Tarea de hoy').first().waitFor({ timeout: 8000 });
    await page.goForward();
    await page.getByRole('heading', { name: 'Tarea no disponible' }).waitFor();
    await page.getByRole('button', { name: 'Volver a tareas' }).click();
    await expectWhere(page, '/tasks');
  });

  await step('rapid consecutive selections end on the last one without showing stale data', async () => {
    await open(page, '/tasks');
    await page.evaluate(() => { window.fixtureDelays = (filters) => (filters.some((f) => f.key === 'id' && f.value === 't-old') ? 1200 : 0); });
    await searchAndPick(page, 'Duplicado', 'task-t-old');
    await searchAndPick(page, 'Duplicado', 'task-t-now');
    await expectWhere(page, '/tasks?taskId=t-now');
    await page.getByRole('dialog').getByText('Tarea de hoy').first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(1600);
    assert.equal(await page.getByRole('dialog').getByText('Tarea antigua fuera de la semana').count(), 0, 'late answer for the first task is ignored');
    await page.getByRole('dialog').getByText('Tarea de hoy').first().waitFor();
    await page.evaluate(() => { window.fixtureDelays = null; });
  });

  await step('slow sede start: linked client waits instead of reporting not found', async () => {
    const slow = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await slow.addInitScript(() => { window.fixtureSlowSede = true; });
    await slow.goto(base + '/workers/w-ana-1');
    await slow.waitForTimeout(150);
    assert.equal(await slow.getByText('No se encuentra este trabajador').count(), 0, 'no false "not found" while the sede loads');
    await slow.getByRole('heading', { name: 'Ana Repetida' }).waitFor();
    await slow.goto(base + '/clients?clientId=c-dup-1');
    await slow.waitForTimeout(150);
    assert.equal(await slow.getByText('Cliente no disponible').count(), 0);
    await slow.getByText('BC-DUP-1').first().waitFor();
    await slow.close();
  });

  await step('opening details made no writes', async () => {
    const state = await page.evaluate(() => ({ writes: window.writes, rpcs: [...new Set(window.rpcs)] }));
    assert.deepEqual(state.writes, []);
    console.log('   read-only RPCs observed:', state.rpcs.join(', ') || 'none');
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mobile.on('pageerror', (e) => errors.push(e.message));
  await step('mobile: search from the menu closes it and opens the client sheet; closing returns focus and clears the link', async () => {
    await open(mobile, '/clients');
    await mobile.getByRole('button', { name: 'Menú' }).tap();
    await mobile.getByRole('button', { name: 'Buscar en la aplicación' }).tap();
    await mobile.getByPlaceholder('Buscar tareas, propiedades, trabajadores, clientes...').fill('Hostal');
    await mobile.locator('[cmdk-item][data-value^="client-c-dup-2"]').tap();
    await expectWhere(mobile, '/clients?clientId=c-dup-2');
    const sheet = mobile.getByRole('dialog');
    await sheet.getByText('B-SEGUNDO').first().waitFor();
    assert.equal(await mobile.getByRole('dialog').count(), 1, 'menu drawer closed, only the client sheet is open');
    const box = await sheet.boundingBox();
    assert.ok(box.width <= 390 && box.x >= 0, 'sheet fits the screen');
    await mobile.keyboard.press('Escape');
    await expectWhere(mobile, '/clients');
    await mobile.getByRole('dialog').waitFor({ state: 'detached' });
    await mobile.waitForFunction(() => document.activeElement && document.activeElement !== document.body, null, { timeout: 3000 }).catch(() => {});
    // The menu that hosted the search returns focus to its own button; otherwise the page title takes it.
    assert.ok(['Menú', 'Clientes'].includes(await mobile.evaluate(() => document.activeElement?.textContent?.trim())), 'focus is not lost on the body');
    await mobile.waitForTimeout(300);
    assert.equal(await mobile.getByRole('dialog').count(), 0, 'the sheet does not reopen');
  });

  await step('mobile: property and unavailable links open as sheets', async () => {
    await open(mobile, '/properties?propertyId=p-dup-2');
    await mobile.getByRole('dialog').getByText('DUP-DOS').first().waitFor();
    await open(mobile, '/properties?propertyId=p-borrada');
    await mobile.getByRole('dialog').getByRole('heading', { name: 'Propiedad no disponible' }).waitFor();
    await mobile.keyboard.press('Escape');
    await expectWhere(mobile, '/properties');
  });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`globalSearchDirectDetailsBrowserTest: ${results.length} checks ok`);
} finally {
  await browser.close();
  server.close();
}
