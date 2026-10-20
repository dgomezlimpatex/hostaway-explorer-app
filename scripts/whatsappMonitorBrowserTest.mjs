// Comprobación local en navegador del monitor de WhatsApp: página real, datos sintéticos, sin red ni sesión.
// Uso: node scripts/whatsappMonitorBrowserTest.mjs  (WHATSAPP_MONITOR_SHOTS=carpeta para guardar capturas)
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { buildWhatsAppMonitorFixture } from './whatsappMonitorFixture.mjs';

const html = await buildWhatsAppMonitorFixture();
const shots = process.env.WHATSAPP_MONITOR_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page, name, options = {}) => {
  if (!shots) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, `${name}.png`), ...options });
};
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
const URL = 'https://whatsapp.local.test/';
const where = page => page.getByTestId('where').textContent();
const calls = (page, fn) => page.evaluate(name => (window.rpcCalls || []).filter(call => !name || call.fn === name), fn);
const open = async (page, fx = {}, path = '/whatsapp-notifications') => {
  await page.evaluate(([p, s]) => {
    Object.assign(window, { fx: s, rpcCalls: [], writes: [] });
    window.fixturePath = p;
    window.renderFixture();
  }, [path, fx]);
};
const newPage = async (viewport) => {
  const page = await browser.newPage({ viewport });
  await page.clock.install({ time: new Date('2026-10-20T10:00:00Z') });
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  const external = [];
  page.external = external;
  await page.route('**/*', route => {
    if (route.request().url() === URL) return route.fulfill({ contentType: 'text/html', body: html });
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(URL);
  return page;
};
const attention = page => page.getByRole('region', { name: /Necesitan acción/ });

let passed = 0;
const step = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); } catch (error) { console.error(`✗ ${name}`); throw error; }
};

try {
  const page = await newPage({ width: 1440, height: 960 });

  await step('Escritorio: resumen accionable, estados distintos y causas legibles', async () => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Notificaciones WhatsApp', level: 1 })).toBeVisible();
    await expect(page.getByText('6 avisos en total')).toBeVisible();
    const region = attention(page);
    await expect(region.getByRole('button', { name: /^2 Fallidos/ })).toBeVisible();
    await expect(region.getByRole('button', { name: /^1 Inciertos/ })).toBeVisible();
    await expect(region.getByRole('button', { name: /^1 Sin confirmar \+30 min/ })).toBeVisible();
    await expect(region.getByRole('button', { name: /^2 No enviados/ })).toBeVisible();
    await expect(region.getByText(/1 callbacks sin correlacionar · pueden corresponder/)).toBeVisible();
    await expect(page.getByText(/2 entregados, de los cuales 1 leídos/)).toBeVisible();
    // WA-03: en cola, incierto y desconocido se distinguen.
    const table = page.getByRole('table', { name: /Historial de avisos de WhatsApp/ });
    await expect(table.getByText('Incierto · intento 1/2')).toBeVisible();
    await expect(table.getByText('En cola', { exact: true })).toBeVisible();
    await expect(table.getByText('Desconocido: processing_unknown')).toBeVisible();
    // WA-06/15: causa por fila, fechas Madrid y verbo con hora.
    await expect(table.getByText('Modo preparación')).toBeVisible();
    await expect(table.getByText('Sin teléfono o sin consentimiento')).toBeVisible();
    await expect(table.getByText('Ese número no puede recibir el mensaje')).toBeVisible();
    await expect(table.getByText('Orzán 1º A · mié 21 oct').first()).toBeVisible();
    await expect(table.getByText('Leído 10:20')).toBeVisible();
    await expect(table.getByText('Falló 11:30')).toBeVisible();
    await expect(table.getByText('En la cola de comprobación manual')).toBeVisible();
    await expect(page.getByText('Estados reales recibidos desde Meta')).toHaveCount(0);
    await expect(page.getByText('2026-10-21')).toHaveCount(0);
    await expect(page.getByText('Actualizado 12:00:00 · cada 30 s')).toBeVisible();
    // Al abrir: 5 lecturas, ninguna escritura, sin red.
    const fns = (await calls(page)).map(call => call.fn).sort();
    assert.deepEqual(fns, ['get_notification_send_reconciliation_queue', 'get_whatsapp_delivery_monitor', 'get_whatsapp_delivery_monitor_stats', 'get_whatsapp_webhook_pending_count', 'get_whatsapp_webhook_reconciliation_queue']);
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    await shot(page, 'escritorio-normal');
    await shot(page, 'escritorio-completo', { fullPage: true });
  });

  await step('WA-01: cada consulta fallando por separado nunca muestra 0', async () => {
    await open(page, { fail: ['get_whatsapp_delivery_monitor_stats'] });
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar algunos datos' })).toContainText('resumen');
    const region = attention(page);
    await expect(region.getByText('No disponible').first()).toBeVisible();
    assert.equal(await region.getByText('No disponible', { exact: true }).count(), 5, 'cuatro cifras y el progreso sin dato');
    await expect(region.getByText('Total no disponible')).toBeVisible();
    for (const label of ['Fallidos', 'Inciertos', 'No enviados']) {
      await expect(region.getByRole('button', { name: new RegExp(`^0 ${label}`) })).toHaveCount(0);
    }
    await shot(page, 'escritorio-error-resumen');
    await region.getByRole('button', { name: 'Reintentar' }).first().click();
    await page.evaluate(() => { window.fx = {}; });

    await open(page, { fail: ['get_whatsapp_webhook_pending_count'] });
    await expect(page.getByRole('alert').filter({ hasText: 'callbacks de Meta' })).toBeVisible();
    await expect(attention(page).getByText('No disponible', { exact: true })).toHaveCount(1);
    await expect(page.getByText('6 avisos en total')).toBeVisible();

    await open(page, { fail: ['get_notification_send_reconciliation_queue'] });
    await expect(page.getByText(/No se pudo comprobar la cola\./)).toBeVisible();
    await open(page, { fail: ['get_whatsapp_webhook_reconciliation_queue'] });
    await expect(page.getByText(/No se pudo comprobar la cola de Meta/)).toBeVisible();
    await open(page, { fail: ['get_whatsapp_delivery_monitor'] });
    await expect(page.getByText('No se pudo cargar el historial de WhatsApp.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' }).last()).toBeVisible();
    await shot(page, 'escritorio-error-historial');

    // Cargando: marcador, no 0.
    await open(page, { delay: { get_whatsapp_delivery_monitor_stats: 60_000 } });
    await expect(attention(page).getByLabel('Cargando').first()).toBeVisible();
    await expect(attention(page).getByRole('button', { name: /^0 / })).toHaveCount(0);
    await shot(page, 'escritorio-cargando');
  });

  await step('WA-10: gestión ve su alcance sin ceros de datos que no puede ver', async () => {
    await open(page, { role: 'manager' });
    await expect(page.getByText(/Las colas de comprobación manual y de conciliación con Meta son solo de administración/)).toBeVisible();
    await expect(page.getByText(/callbacks sin correlacionar/)).toHaveCount(0);
    await expect(page.getByText('Envíos pendientes de comprobación manual')).toHaveCount(0);
    await expect(page.getByText('Cola de conciliación de Meta')).toHaveCount(0);
    const fns = (await calls(page)).map(call => call.fn);
    assert.ok(!fns.includes('get_notification_send_reconciliation_queue'), 'no pide la cola de administración');
    assert.ok(!fns.includes('get_whatsapp_webhook_reconciliation_queue'));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await shot(page, 'escritorio-gestion');
  });

  await step('WA-11: filtros en la URL, chips y vuelta atrás', async () => {
    await open(page, {}, '/whatsapp-notifications?periodo=31d&estado=failed');
    await expect(page.getByRole('combobox', { name: 'Periodo' })).toHaveText('Últimos 31 días');
    await expect(page.getByRole('combobox', { name: 'Estado' })).toHaveText('Fallidos');
    const monitor = (await calls(page, 'get_whatsapp_delivery_monitor')).at(-1);
    assert.equal(monitor.args._days, 31);
    assert.equal(monitor.args._status, 'failed');
    assert.equal((await calls(page, 'get_whatsapp_delivery_monitor_stats')).at(-1).args._days, 31);
    await expect(page.getByText('2 avisos · página 1 de 1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitar filtro Últimos 31 días' })).toBeVisible();
    await page.getByRole('button', { name: 'Quitar filtro Fallidos' }).click();
    assert.equal(await where(page), '/whatsapp-notifications?periodo=31d');
    await page.getByRole('combobox', { name: 'Periodo' }).click();
    await page.getByRole('option', { name: 'Últimas 24 h' }).click();
    assert.equal(await where(page), '/whatsapp-notifications?periodo=24h');
    // Pulsar una cifra aplica su filtro.
    await attention(page).getByRole('button', { name: /^1 Inciertos/ }).click();
    assert.equal(await where(page), '/whatsapp-notifications?periodo=24h&estado=queued');
    await page.getByRole('button', { name: 'Quitar todo' }).click();
    assert.equal(await where(page), '/whatsapp-notifications');
  });

  await step('WA-12: debounce de búsqueda y comodines literales', async () => {
    await open(page);
    await expect(page.getByText('10 avisos · página 1 de 1')).toBeVisible();
    const before = (await calls(page, 'get_whatsapp_delivery_monitor')).length;
    const search = page.getByRole('searchbox', { name: 'Buscar' });
    await search.pressSequentially('Begoña', { delay: 40 });
    await page.clock.runFor(400);
    await expect(page.getByText('1 avisos · página 1 de 1')).toBeVisible();
    const after = await calls(page, 'get_whatsapp_delivery_monitor');
    assert.equal(after.length - before, 1, 'una consulta para seis letras');
    assert.equal(after.at(-1).args._search, 'Begoña');
    assert.equal(await where(page), '/whatsapp-notifications?q=Bego%C3%B1a');
    await search.fill('%'); // sin escapar, «%» devolvería todo
    await page.clock.runFor(400);
    await expect(page.getByText('No hay avisos con estos filtros en últimos 7 días.')).toBeVisible();
    assert.equal((await calls(page, 'get_whatsapp_delivery_monitor')).at(-1).args._search, '\\%');
  });

  await step('WA-04: detalle por aviso con línea de tiempo, en la URL y con Escape', async () => {
    await open(page);
    await page.getByRole('button', { name: 'Ver detalle de Tarea asignada a Begoña Ruiz' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Tarea asignada' })).toBeVisible();
    assert.equal(await where(page), '/whatsapp-notifications?envio=d3');
    await expect(sheet.getByText('Aceptado por Meta', { exact: true })).toHaveCount(2);
    await expect(sheet.getByText('Entrega no comunicada por Meta tras más de 30 min')).toBeVisible();
    await expect(sheet.getByText(/Entregado \(comunicado/)).toHaveCount(0);
    await expect(sheet.getByText(/todavía no ofrece el historial de intentos/)).toBeVisible();
    await expect(sheet.getByText('…c9d0e1f2')).toBeVisible();
    await shot(page, 'escritorio-detalle');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    assert.equal(await where(page), '/whatsapp-notifications');

    // Con la RPC de detalle disponible: dos intentos, un solo aviso lógico y aviso de posible duplicado.
    await open(page, { detailRpc: true }, '/whatsapp-notifications?envio=d6');
    await expect(sheet.getByText(/Intento 1\/2 iniciado → sin respuesta clara/)).toBeVisible();
    await expect(sheet.getByText(/Intento 2\/2 iniciado → aceptado por Meta \(…a1b2c3d4\)/)).toBeVisible();
    await expect(sheet.getByText('Posible duplicado', { exact: false })).toBeVisible();
    await expect(sheet.getByText('Resultado incierto en Meta.')).toBeVisible();
    await shot(page, 'escritorio-detalle-intentos');
    await page.keyboard.press('Escape');
  });

  await step('WA-08/09: diálogo de resolución con validación, bloqueo y errores traducidos', async () => {
    await open(page);
    await expect(page.getByText('Envíos pendientes de comprobación manual (3)')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar enviado…' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Confirmar enviado en Meta')).toBeVisible();
    const input = dialog.getByLabel('ID del mensaje en Meta');
    await input.fill('12345');
    await dialog.getByRole('button', { name: 'Confirmar enviado' }).click();
    await expect(dialog.getByText(/empieza por «wamid.»/)).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    await shot(page, 'escritorio-dialogo-validacion');
    await input.fill('wamid.SINTETICO1234567890');
    await dialog.getByRole('button', { name: 'Confirmar enviado' }).click();
    await expect(dialog).toHaveCount(0);
    const writes = await page.evaluate(() => window.writes);
    assert.deepEqual(writes, [{ fn: 'request_notification_send_reconciliation', args: { _delivery_id: 'd6', _resolution: 'confirmed_sent', _provider_message_id: 'wamid.SINTETICO1234567890' } }]);

    // Error del servidor traducido.
    await open(page, { resolutionError: 'delivery_not_reconcilable' });
    await page.getByRole('button', { name: 'Confirmar enviado…' }).first().click();
    await dialog.getByLabel('ID del mensaje en Meta').fill('wamid.SINTETICO1234567890');
    await dialog.getByRole('button', { name: 'Confirmar enviado' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(/ya no está pendiente de comprobación/);
    await page.keyboard.press('Escape');

    // Meta todavía contactando: confirmar deshabilitado con explicación.
    await open(page, { contacting: true });
    await expect(page.getByRole('button', { name: 'Confirmar enviado…' }).first()).toBeDisabled();
    await expect(page.getByText(/está contactando con Meta en este momento/)).toBeVisible();

    // Email: dentro de la ventana se ofrece reintento; vencida, se explica y no se ofrece.
    await open(page);
    await expect(page.getByRole('button', { name: 'Confirmar no enviado…' })).toHaveCount(1);
    await expect(page.getByText(/Ventana de reintento: quedan unas 2[12] h/)).toBeVisible();
    await expect(page.getByText(/Ventana de reintento probablemente vencida/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar no enviado…' }).click();
    await expect(dialog.getByText('Confirmar no enviado y reintentar')).toBeVisible();
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.writes), []);
  });

  await step('WA-14: nombres accesibles, tablas descritas y región viva', async () => {
    await open(page);
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Estado' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Periodo' })).toBeVisible();
    await expect(page.getByRole('table', { name: /Respuestas de Meta pendientes/ })).toBeVisible();
    assert.ok(await page.locator('[aria-live="polite"]').count() >= 2);
    await page.getByRole('searchbox', { name: 'Buscar' }).focus();
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow + getComputedStyle(document.activeElement).outlineStyle);
    assert.ok(/rgb|solid|auto/.test(outline), 'foco visible');
  });

  await step('Volumen: 1.234 avisos paginados en el servidor', async () => {
    await open(page, { many: 1234 });
    await expect(page.getByText('1234 avisos · página 1 de 25')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    assert.equal(await where(page), '/whatsapp-notifications?pagina=2');
    assert.equal((await calls(page, 'get_whatsapp_delivery_monitor')).at(-1).args._offset, 50);
    await shot(page, 'escritorio-volumen');
  });

  await step('Vacío', async () => {
    await open(page, { empty: true });
    await expect(page.getByText('0 avisos en total')).toBeVisible();
    await expect(page.getByText('No hay avisos con estos filtros en últimos 7 días.')).toBeVisible();
    await shot(page, 'escritorio-vacio');
  });

  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.external, []);

  await step('WA-13: móvil 390 px con tarjetas y sin scroll horizontal', async () => {
    const mobile = await newPage({ width: 390, height: 844 });
    await open(mobile);
    const list = mobile.getByRole('list', { name: 'Avisos de WhatsApp' });
    await expect(list).toBeVisible();
    await expect(mobile.getByRole('table', { name: /Historial de avisos/ })).toBeHidden();
    const firstCard = list.getByRole('button').first();
    await shot(mobile, 'movil-primera-pantalla');
    // Colas de administración plegadas en una sola fila que se puede abrir.
    const queues = mobile.getByRole('button', { name: /3 envíos por comprobar · 1 respuestas de Meta/ });
    await expect(queues).toHaveAttribute('aria-expanded', 'false');
    await expect(mobile.getByText('Envíos pendientes de comprobación manual (3)')).toBeHidden();
    const box = await firstCard.boundingBox();
    assert.ok(box.y < 844 * 2, `primer aviso a ${Math.round(box.y)} px (máximo una pantalla de desplazamiento)`);
    const scroll = await mobile.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scroll <= 390, `sin scroll horizontal (${scroll})`);
    await shot(mobile, 'movil-completo', { fullPage: true });
    await queues.click();
    await expect(mobile.getByText('Envíos pendientes de comprobación manual (3)')).toBeVisible();
    await shot(mobile, 'movil-colas-abiertas');
    await queues.click();
    await firstCard.click();
    const sheet = mobile.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Tarea asignada' })).toBeVisible();
    const sheetBox = await sheet.boundingBox();
    assert.ok(sheetBox.width >= 380, 'detalle a pantalla completa');
    await shot(mobile, 'movil-detalle');
    assert.deepEqual(mobile.errors, []);
    assert.deepEqual(mobile.external, []);
  });

  console.log(`whatsappMonitorBrowserTest: ${passed} pasos correctos`);
} finally {
  await browser.close();
}
