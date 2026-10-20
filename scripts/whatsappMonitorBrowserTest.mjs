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
const tableCalls = page => page.evaluate(() => window.tableCalls || []);
const open = async (page, fx = {}, path = '/whatsapp-notifications') => {
  await page.evaluate(([p, s]) => {
    Object.assign(window, { fx: s, rpcCalls: [], writes: [], tableCalls: [] });
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
const EXHAUSTED_TEXT = 'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual';
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
    await expect(region.getByText('Respuestas de Meta sin asociar:')).toBeVisible();
    await expect(region.getByText(/suelen ser de un aviso ya contado arriba/)).toBeVisible();
    await expect(page.getByText(/2 entregados, de los cuales 1 leídos/)).toBeVisible();
    // WA-03: en cola, incierto y desconocido se distinguen.
    const table = page.getByRole('table', { name: /Historial de avisos de WhatsApp/ });
    await expect(table.getByText('Resultado incierto · 1/2')).toBeVisible();
    await expect(table.getByText('En cola', { exact: true })).toBeVisible();
    await expect(table.getByText('Desconocido: processing_unknown')).toBeVisible();
    // WA-06/15: causa por fila, fechas Madrid y verbo con hora.
    await expect(table.getByText('Modo preparación')).toBeVisible();
    await expect(table.getByText('Sin teléfono o sin consentimiento')).toBeVisible();
    await expect(table.getByText('Ese número no puede recibir el mensaje')).toBeVisible();
    await expect(table.getByText('Orzán 1º A · mié 21 oct').first()).toBeVisible();
    await expect(table.getByText('Leído 10:20')).toBeVisible();
    await expect(table.getByText('Falló 11:30')).toBeVisible();
    await expect(table.getByText('Por comprobar', { exact: true })).toBeVisible();
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
    await expect(page.getByRole('alert').filter({ hasText: 'respuestas de Meta' })).toBeVisible();
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
    await expect(page.getByText(/Los envíos por comprobar y las respuestas de Meta sin asociar son solo de administración/)).toBeVisible();
    await expect(page.getByText('Respuestas de Meta sin asociar:')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Envíos por comprobar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Revisar/ })).toHaveCount(0);
    await expect(page.getByText(/Respuestas de Meta sin asociar \(/)).toHaveCount(0);
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
    // Datos técnicos plegados por defecto.
    await expect(sheet.getByText('…c9d0e1f2')).toBeHidden();
    await sheet.getByText('Datos técnicos').click();
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
    await expect(sheet.getByText('Entrega sin confirmar', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Registrar como enviado…' })).toBeEnabled();
    await shot(page, 'escritorio-detalle-intentos');
    await page.keyboard.press('Escape');
  });

  await step('WA-08/09: Revisar → detalle → registrar, con validación, bloqueo y errores traducidos', async () => {
    await open(page);
    await expect(page.getByRole('heading', { name: 'Envíos por comprobar (3)' })).toBeVisible();
    // La lista no ofrece confirmar: solo «Revisar».
    await expect(page.getByRole('button', { name: /Confirmar enviado|Registrar como enviado/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Revisar Recordatorio de aprobación · Ana Pérez/ }).click();
    assert.equal(await where(page), '/whatsapp-notifications?envio=d6');
    const sheet = page.getByRole('dialog', { name: 'Recordatorio de aprobación' });
    await expect(sheet.getByText('Qué puedes hacer')).toBeVisible();
    await expect(sheet.getByText(/No envía otro WhatsApp ni demuestra que la persona lo recibió/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Registrar como enviado…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Registrar como enviado en Meta' });
    await expect(dialog).toBeVisible();
    const input = dialog.getByLabel('ID del mensaje en Meta');
    await input.fill('12345');
    await dialog.getByRole('button', { name: 'Registrar como enviado' }).click();
    await expect(dialog.getByText(/empieza por «wamid.»/)).toBeVisible();
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    await shot(page, 'escritorio-dialogo-validacion');
    await input.fill('wamid.SINTETICO1234567890');
    await dialog.getByRole('button', { name: 'Registrar como enviado' }).click();
    await expect(dialog).toHaveCount(0);
    const writes = await page.evaluate(() => window.writes);
    assert.deepEqual(writes, [{ fn: 'request_notification_send_reconciliation', args: { _delivery_id: 'd6', _resolution: 'confirmed_sent', _provider_message_id: 'wamid.SINTETICO1234567890' } }]);
    await page.keyboard.press('Escape');

    // Error del servidor traducido.
    await open(page, { resolutionError: 'delivery_not_reconcilable' }, '/whatsapp-notifications?envio=d6');
    await sheet.getByRole('button', { name: 'Registrar como enviado…' }).click();
    await dialog.getByLabel('ID del mensaje en Meta').fill('wamid.SINTETICO1234567890');
    await dialog.getByRole('button', { name: 'Registrar como enviado' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(/ya no está pendiente de comprobación/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Meta todavía contactando: estado en la lista y registro deshabilitado con explicación.
    await open(page, { contacting: true });
    await expect(page.getByText('Contactando con Meta', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Revisar Recordatorio de aprobación/ }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Registrar como enviado…' })).toBeDisabled();
    await expect(page.getByRole('dialog').getByText(/contactando con Meta ahora mismo/).first()).toBeVisible();
    await page.keyboard.press('Escape');

    // Email: dentro de la ventana se ofrece reintento; vencida, se explica y no se ofrece.
    await open(page, {}, '/whatsapp-notifications?envio=e1');
    const emailSheet = page.getByRole('dialog');
    await expect(emailSheet.getByRole('button', { name: 'Registrar como no enviado y reintentar…' })).toHaveCount(1);
    await expect(emailSheet.getByText(/quedan unas 2[12] h/)).toBeVisible();
    await emailSheet.getByRole('button', { name: 'Registrar como no enviado y reintentar…' }).click();
    await expect(page.getByRole('dialog', { name: 'Registrar como no enviado y reintentar' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await open(page, {}, '/whatsapp-notifications?envio=e2');
    await expect(page.getByRole('dialog').getByText(/ya no es seguro reintentarlo/)).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: /no enviado/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.writes), []);
  });

  await step('Escenario de producción: 6 envíos 2/2 antiguos, enmascarado corrupto y datos ausentes', async () => {
    await open(page, { queue: 'prod' });
    const section = page.getByRole('region', { name: /Envíos por comprobar/ });
    await expect(section.getByRole('heading', { name: 'Envíos por comprobar (6)' })).toBeVisible();
    assert.equal(await page.evaluate(() => /â€|€¢/.test(document.body.innerText)), false, 'sin caracteres corruptos');
    // Sin recientes: «Anteriores» abierto, con cantidad y fechas visibles.
    await expect(section.getByRole('button', { name: /Anteriores \(6\)/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(section.getByText('del vie 4 sept al jue 8 oct')).toBeVisible();
    await expect(section.getByRole('button', { name: /Últimos 7 días/ })).toHaveCount(0);
    const items = section.getByRole('listitem');
    await expect(items).toHaveCount(6);
    await expect(section.getByText('Entrega sin confirmar', { exact: true })).toHaveCount(6);
    await expect(section.getByRole('button', { name: /^Revisar/ })).toHaveCount(6);
    // Una sola explicación; ningún aviso rojo repetido por fila.
    await expect(page.getByText(/intento 1\/2 incierto puede recibir/)).toHaveCount(0);
    await expect(section.getByText(/no se reenvían solos/)).toHaveCount(1);
    await expect(section.getByText(/Reintento automático posible/)).toHaveCount(0);
    // Nombre por vínculo exacto: guardado (p1), ficha por ID con la misma terminación (p2),
    // ficha borrada (p3), dos fichas sin nombre guardado (p4), evento de otra sede (p5).
    await expect(section.getByText(/Teléfono acabado en/)).toHaveCount(0);
    await expect(items.nth(5)).toContainText('Carmen Vidal');
    await expect(items.nth(5)).toContainText('•••• 7093');
    await expect(items.nth(4)).toContainText('Rosa Díaz');
    await expect(items.nth(4)).toContainText('•••• 7093');
    await expect(items.nth(3)).toContainText('Nombre no disponible');
    await expect(items.nth(3)).toContainText('•••• 4439');
    await expect(items.nth(2)).toContainText('Nombre no disponible');
    await expect(items.nth(1)).toContainText('Nombre no disponible');
    await expect(items.nth(1)).toContainText('•••• 6755');
    await expect(items.nth(0)).toContainText('Inés Mora');
    await expect(items.nth(0)).not.toContainText('••••');
    await expect(section.getByText('Carmen Vidal Ortega')).toHaveCount(0);
    // Una sola lectura de eventos y otra de fichas, con columnas mínimas.
    // (una lectura de fichas del render anterior puede terminar después de reiniciar el registro)
    const all = await tableCalls(page);
    const reads = all.slice(all.findIndex(r => r.table === 'notification_events'));
    assert.deepEqual(reads.map(r => [r.table, r.columns]), [['notification_events', 'id,cleaner_id,recipient_worker_id,recipient_name_snapshot'], ['cleaners', 'id,name']]);
    assert.deepEqual(reads[0].ids.sort(), ['ev-p1', 'ev-p2', 'ev-p3', 'ev-p4', 'ev-p5', 'ev-p6']);
    assert.deepEqual(reads[1].ids.sort(), ['c-borrada', 'c-ines', 'c-rosa']);
    await expect(section.getByText('Asunto no disponible')).toHaveCount(2);
    await expect(section.getByText('vie 4 sept 20:12 · hace 45 días')).toBeVisible();
    // Orden: más reciente primero.
    await expect(items.first()).toContainText('jue 8 oct');
    assert.equal(await section.locator('.text-red-700').count(), 0);

    // Teclado: foco en «Revisar», Intro abre el detalle; Escape lo cierra y limpia la URL.
    const review = section.getByRole('button', { name: /^Revisar Tarea asignada · Carmen Vidal · vie 4 sept/ });
    await review.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: 'Tarea asignada' })).toBeVisible();
    assert.equal(await where(page), '/whatsapp-notifications?envio=p1');
    await expect(sheet.getByText(/Se intentó enviar dos veces y Meta no confirmó/)).toBeVisible();
    await expect(sheet.getByText('Carmen Vidal · •••• 7093')).toBeVisible();
    await expect(sheet.getByText(/Tarea no disponible: este envío no aparece en el historial/)).toBeVisible();
    await expect(sheet.getByText(/Nombre actual de la ficha/)).toHaveCount(0);
    await expect(sheet.getByText(EXHAUSTED_TEXT)).toBeHidden();
    assert.equal(await sheet.locator('details').evaluate(el => el.open), false, 'datos técnicos plegados');
    await shot(page, 'escritorio-revisar-prod');
    // Sin RPC de detalle: no hay error visible ni escritura.
    await expect(sheet.getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Escape');
    assert.equal(await where(page), '/whatsapp-notifications');
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Enlace directo a cada envío (la hoja no depende de la página del historial).
    // Ficha enlazada sin nombre guardado: se avisa de que es el nombre actual.
    await open(page, { queue: 'prod' }, '/whatsapp-notifications?envio=p2');
    await expect(sheet.getByText('Rosa Díaz · •••• 7093')).toBeVisible();
    await expect(sheet.getByText(/Nombre actual de la ficha enlazada/)).toBeVisible();
    // Dos fichas distintas sin nombre guardado: no se atribuye a ninguna.
    await open(page, { queue: 'prod' }, '/whatsapp-notifications?envio=p4');
    await expect(sheet.getByText(/enlaza a dos fichas distintas/)).toBeVisible();
    await expect(sheet.getByText(/Rosa Díaz|Carmen Vidal/)).toHaveCount(0);
    // Evento de otra sede que las políticas no devuelven.
    await open(page, { queue: 'prod' }, '/whatsapp-notifications?envio=p5');
    await expect(sheet.getByText('Nombre no disponible · •••• 6755')).toBeVisible();
    await expect(sheet.getByText(/su ficha ya no existe o no es visible/)).toBeVisible();
    await shot(page, 'escritorio-revisar-sin-nombre');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.writes), []);
  });

  await step('Nombres independientes del historial: otro filtro, otra página y carga', async () => {
    await open(page, { queue: 'prod', many: 120 }, '/whatsapp-notifications?estado=failed&pagina=2');
    const section = page.getByRole('region', { name: /Envíos por comprobar/ });
    await expect(section.getByText('Carmen Vidal').first()).toBeVisible();
    await expect(section.getByText('Rosa Díaz').first()).toBeVisible();
    await open(page, { queue: 'prod', namesDelay: 4000 });
    await expect(section.getByText('Buscando nombre…')).toHaveCount(6);
    await expect(section.getByText(/Teléfono acabado en/)).toHaveCount(0);
    await page.clock.runFor(4500);
    await expect(section.getByText('Carmen Vidal').first()).toBeVisible();
  });

  await step('Fallo al leer nombres: aviso con reintento y ningún nombre inventado', async () => {
    await open(page, { queue: 'prod', failTables: ['notification_events'] });
    const section = page.getByRole('region', { name: /Envíos por comprobar/ });
    await expect(section.getByRole('alert')).toHaveText(/No se pudieron consultar los nombres de las destinatarias/, { timeout: 8000 });
    await expect(section.getByText('Nombre no disponible')).toHaveCount(6);
    await expect(section.getByText(/Carmen|Rosa|Inés/)).toHaveCount(0);
    await section.getByRole('button', { name: /^Revisar Tarea asignada · Nombre no disponible · vie 4 sept/ }).click();
    await expect(page.getByRole('dialog').getByText('No se pudo consultar el nombre.')).toBeVisible();
    await page.keyboard.press('Escape');
    await shot(page, 'escritorio-nombres-fallo');
    // Falla la lectura de fichas: tampoco se dan por buenos los nombres guardados a medias.
    await open(page, { queue: 'prod', failTables: ['cleaners'] });
    await expect(section.getByRole('alert')).toHaveText(/No se pudieron consultar los nombres/, { timeout: 8000 });
    await page.evaluate(() => { window.fx.failTables = []; });
    await section.getByRole('button', { name: 'Reintentar' }).click();
    await expect(section.getByText('Carmen Vidal').first()).toBeVisible();
    await expect(section.getByRole('alert')).toHaveCount(0);
    assert.deepEqual(await page.evaluate(() => window.writes), []);
  });

  await step('Gestor (sin acceso a la cola): no se consultan nombres', async () => {
    await open(page, { role: 'manager', queue: 'prod' });
    await expect(page.getByText('6 avisos en total')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Envíos por comprobar/ })).toHaveCount(0);
    assert.deepEqual(await tableCalls(page), []);
  });

  await step('Mezcla de antigüedades: recientes abiertos, anteriores plegados con cantidad y suma exacta', async () => {
    await open(page, { queue: 'mixed' });
    const section = page.getByRole('region', { name: /Envíos por comprobar/ });
    await expect(section.getByRole('heading', { name: 'Envíos por comprobar (7)' })).toBeVisible();
    const recent = section.getByRole('button', { name: /Últimos 7 días \(5\)/ });
    const older = section.getByRole('button', { name: /Anteriores \(2\)/ });
    await expect(recent).toHaveAttribute('aria-expanded', 'true');
    await expect(older).toHaveAttribute('aria-expanded', 'false');
    await expect(section.getByText('del vie 4 sept al mar 15 sept')).toBeVisible();
    await expect(section.getByRole('button', { name: /^Revisar/ })).toHaveCount(5);
    await older.click();
    await expect(section.getByRole('button', { name: /^Revisar/ })).toHaveCount(7);
    // El historial nombra a otra persona (ficha actual); el envío conserva su nombre guardado.
    const changed = section.getByRole('listitem').filter({ hasText: 'Marina Habitación 2' });
    await expect(changed).toContainText('Marta Sanz');
    await expect(changed).not.toContainText('Begoña Ruiz');
    await expect(section.getByRole('listitem').filter({ hasText: 'Email alternativo' })).toContainText('Nombre no disponible');
    await expect(section.getByText('Reintento automático posible', { exact: true })).toHaveCount(1);
    await expect(section.getByText('Registro en curso', { exact: true })).toHaveCount(1);
    await expect(section.getByText('Contactando con Meta', { exact: true })).toHaveCount(1);
    await expect(section.getByText('Email sin confirmar', { exact: true })).toHaveCount(1);
    await expect(section.getByText(/aún pueden tener un último intento/)).toBeVisible();
    // Fila con resolución en curso: el detalle no permite registrar otra.
    await section.getByRole('button', { name: /^Revisar Tarea modificada · Luis Gómez/ }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Registrar como enviado…' })).toBeDisabled();
    await expect(page.getByRole('dialog').getByText('Ya hay una resolución en curso para este envío.')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  await step('Límite de la cola: aviso explícito si el servidor devuelve 50', async () => {
    await open(page, { queue: 'fifty' });
    await expect(page.getByRole('heading', { name: 'Envíos por comprobar (50)' })).toBeVisible();
    await expect(page.getByText(/Se muestran los 50 más antiguos que devuelve el servidor; puede haber más pendientes/)).toBeVisible();
    assert.equal((await calls(page, 'get_notification_send_reconciliation_queue')).at(-1).args._limit, 50);
  });

  await step('WA-14: nombres accesibles, tablas descritas y región viva', async () => {
    await open(page);
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Estado' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Periodo' })).toBeVisible();
    await expect(page.getByRole('table', { name: /Respuestas de Meta pendientes/ })).toBeHidden();
    await page.getByText(/Respuestas de Meta sin asociar \(1\)/).click();
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
    await expect(mobile.getByRole('heading', { name: 'Envíos por comprobar (3)' })).toBeHidden();
    const box = await firstCard.boundingBox();
    assert.ok(box.y < 844 * 2, `primer aviso a ${Math.round(box.y)} px (máximo una pantalla de desplazamiento)`);
    const scroll = await mobile.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scroll <= 390, `sin scroll horizontal (${scroll})`);
    await shot(mobile, 'movil-completo', { fullPage: true });
    await queues.click();
    await expect(mobile.getByRole('heading', { name: 'Envíos por comprobar (3)' })).toBeVisible();
    const mobileScroll = await mobile.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(mobileScroll <= 390, `colas abiertas sin scroll horizontal (${mobileScroll})`);
    await expect(mobile.getByRole('region', { name: /Envíos por comprobar/ }).getByText('Ana Pérez').first()).toBeVisible();
    await expect(mobile.getByRole('region', { name: /Envíos por comprobar/ }).getByText('Luis Gómez').first()).toBeVisible();
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
