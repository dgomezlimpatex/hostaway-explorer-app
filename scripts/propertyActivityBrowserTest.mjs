// Comprobación local en navegador de la pestaña Actividad: página real de propiedades, datos sintéticos, sin red ni sesión.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { buildPropertyActivityFixture } from './propertyActivityFixture.mjs';

const html = await buildPropertyActivityFixture();
const shots = process.env.ACTIVITY_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
const where = page => page.getByLabel('Ubicación actual', { exact: true }).textContent();
const open = async (page, path, setup = {}) => {
  await page.evaluate(([p, s]) => { Object.assign(window, { fixtureDelay: {}, fixtureFail: [], fixtureDeny: [], fixtureSede: undefined, queries: [], writes: [], aborted: [] }, s); window.fixturePath = p; window.renderFixture(); }, [path, setup]);
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // This fixture and its expected 30-day windows are anchored to 17 October.
  await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'https://activity.local.test/' ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.goto('https://activity.local.test/');

  // Entrada desde la ficha: la pestaña Actividad existe junto a las anteriores.
  await open(page, '/properties?propertyId=prop-a');
  for (const tab of ['Ficha', 'Consumos', 'Limpiezas', 'Actividad', 'Checklist']) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  await page.getByRole('tab', { name: 'Actividad' }).click();
  assert.equal(await where(page), '/properties?propertyId=prop-a&seccion=actividad');
  const timeline = page.getByRole('list', { name: 'Actividad por días' });
  await expect(timeline).toBeVisible();

  // Varios módulos, agrupados por día y del más reciente al más antiguo.
  const headings = await timeline.locator('h4').allTextContents();
  assert.deepEqual(headings.map(text => text.toLowerCase()), ['viernes, 16 de octubre de 2026', 'jueves, 15 de octubre de 2026', 'miércoles, 14 de octubre de 2026', 'lunes, 12 de octubre de 2026']);
  await expect(timeline.getByText('Limpieza · Salida')).toBeVisible();
  await expect(timeline.getByText('Prevista 11:00')).toBeVisible();
  await expect(timeline.getByText('Finalización registrada otro día:')).toBeVisible();
  await expect(timeline.getByText('16/10/2026 · 09:40')).toBeVisible();
  await expect(timeline.getByText('Asignación actual:').first()).toBeVisible();
  await expect(timeline.getByText('Resuelta → Abierta')).toBeVisible();
  await expect(timeline.getByText('Devuelta para repaso')).toBeVisible();
  await expect(timeline.getByText('Preparación deshecha')).toBeVisible();
  await expect(timeline.getByText('También consta en el reparto clásico')).toBeVisible();
  await expect(timeline.getByText('Lavandería preparada (reparto)')).toHaveCount(0);
  await expect(timeline.getByText('Consumo automático · Sábanas 150')).toBeVisible();
  await expect(timeline.getByText('Recuento global')).toHaveCount(0);
  await expect(timeline.getByText('Sin hora')).toHaveCount(1);
  await expect(timeline.getByText('Limpieza · Entrada')).toHaveCount(0); // Tarea de la otra propiedad con el mismo nombre.
  assert.equal((await page.evaluate(() => window.writes)).length, 0, 'La cronología no escribe');
  if (shots) await page.screenshot({ path: `${shots}/escritorio.png`, fullPage: false });

  // Filtros: tipo y periodo se guardan en la URL.
  await page.getByRole('button', { name: 'Incidencias', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Incidencias', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(timeline.getByText('Limpieza · Salida')).toHaveCount(0);
  await expect(timeline.getByText(/^Incidencia registrada/)).toBeVisible();
  assert.match(await where(page), /actividad_tipo=incidents/);
  await page.getByRole('button', { name: 'Todo', exact: true }).click();

  // Carga progresiva: 90 días en tramos de 30.
  await page.getByRole('combobox', { name: 'Periodo de actividad' }).click();
  await page.getByRole('option', { name: 'Últimos 90 días' }).click();
  await expect(page.getByText('Mostrando desde el 18/09/2026.')).toBeVisible();
  await expect(timeline.getByText('Limpieza · Repaso')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cargar 30 días anteriores' }).click();
  await expect(timeline.getByText('Limpieza · Repaso')).toBeVisible();
  assert.match(await where(page), /actividad_periodo=90&actividad_tramos=2|actividad_tramos=2/);
  const before = await timeline.locator('li li').count();

  // Abrir el registro original y volver conserva propiedad, pestaña, filtros y tramos.
  await timeline.getByRole('link', { name: /Abrir incidencia/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Incidencias' })).toBeVisible();
  assert.equal(await where(page), '/cleaning-reports?incidencia=i1');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Mostrando desde el 19/08/2026.')).toBeVisible();
  assert.equal(await timeline.locator('li li').count(), before, 'Mismo contenido al volver, sin repeticiones');
  await timeline.getByRole('link', { name: 'Abrir limpieza' }).first().click();
  assert.equal(await where(page), '/calendar?date=2026-10-15&task=t1');
  await page.getByRole('button', { name: 'Volver' }).click();
  await timeline.getByRole('link', { name: /historial de inventario/ }).click();
  assert.equal(await where(page), '/inventory/movements?product=sab&warehouse=w1');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true');

  // Propiedad sin actividad (otra con el mismo nombre): vacío confirmado.
  await open(page, '/properties?propertyId=prop-b&seccion=actividad&actividad_tipo=inventory');
  await expect(page.getByText(/No hay actividad registrada de «Inventario» entre el/)).toBeVisible();

  // Error parcial: el resto se muestra y se avisa; reintentar.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureFail: ['supervision_reviews'] });
  await expect(page.getByRole('alert').filter({ hasText: 'No se ha podido consultar Supervisión' })).toBeVisible();
  await expect(timeline.getByText('Limpieza · Salida')).toBeVisible();
  await page.evaluate(() => { window.fixtureFail = []; });
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(timeline.getByText('Devuelta para repaso')).toBeVisible();
  await expect(page.getByText(/No se ha podido consultar/)).toHaveCount(0);

  // Fuente lenta: se indica qué falta y no se muestra el tramo a medias.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureDelay: { stock_movements: 1500 } });
  await expect(page.getByRole('status').filter({ hasText: 'Cargando actividad: Inventario' })).toBeVisible();
  await expect(timeline).toHaveCount(0);
  await expect(timeline.getByText('Consumo automático · Sábanas 150')).toBeVisible();

  // Cambio de propiedad durante la carga: la consulta anterior se cancela y no se mezclan datos.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureDelay: { tasks: 1500 } });
  await expect(page.getByText(/Cargando actividad/)).toBeVisible();
  await page.getByRole('button', { name: /ATC-2/ }).click();
  await expect(page.getByText('Limpieza · Entrada')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Limpieza · Salida')).toHaveCount(0);
  assert.ok((await page.evaluate(() => window.aborted)).includes('tasks'), 'La consulta de la propiedad anterior se cancela');
  assert.match(await where(page), /propertyId=prop-b/);

  // Sede distinta: las consultas llevan la sede activa y no devuelven datos de otra sede.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureSede: 'sede-2' });
  await expect(page.getByText(/No hay actividad registrada entre el/)).toBeVisible();
  const sedes = await page.evaluate(() => window.queries.flatMap(q => q.filters.filter(f => f[0] === 'eq' && /sede_id$/.test(f[1])).map(f => f[2])));
  assert.ok(sedes.length >= 5 && sedes.every(id => id === 'sede-2'));

  // Acceso restringido: sin inventario ni reportes no se consultan esas fuentes ni se enlazan sus detalles.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureDeny: ['inventory', 'reports'] });
  await expect(page.getByText('Sin permiso para consultar: Incidencias, Lavandería, Inventario. No se muestran esos registros.')).toBeVisible();
  await expect(timeline.getByText('Sin permiso para consultar reportes').first()).toBeVisible();
  const tables = await page.evaluate(() => [...new Set(window.queries.map(q => q.table))]);
  for (const table of ['stock_movements', 'cleaning_incidents', 'laundry_bag_preparations']) assert.ok(!tables.includes(table), `${table} no se consulta sin permiso`);
  await open(page, '/properties?propertyId=prop-a&seccion=actividad', { fixtureDeny: ['calendar'] });
  await expect(timeline.getByText('Sin acceso al registro original con tu perfil.').first()).toBeVisible();
  await expect(timeline.getByRole('link', { name: 'Abrir limpieza' })).toHaveCount(0);

  // Teclado: filtros y enlaces alcanzables y activables con teclado.
  await open(page, '/properties?propertyId=prop-a&seccion=actividad');
  await expect(timeline).toBeVisible();
  await page.getByRole('button', { name: 'Supervisión', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Supervisión', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.textContent || '');
  assert.ok(/Qué se muestra|Abrir limpieza supervisada/.test(focused), `Foco en un elemento útil: ${focused}`);
  await timeline.getByRole('link', { name: /Abrir limpieza supervisada/ }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await where(page), '/calendar?date=2026-10-15&task=t1');

  // Móvil: la ficha se abre en diálogo y conserva la pestaña Actividad.
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/properties?propertyId=prop-a&seccion=actividad');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: 'Actividad' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByText('Limpieza · Salida')).toBeVisible();
  const overflow = await dialog.evaluate(node => node.scrollWidth - node.clientWidth);
  assert.ok(overflow <= 1, `Sin desbordamiento horizontal en móvil (${overflow}px)`);
  if (shots) await page.screenshot({ path: `${shots}/movil.png`, fullPage: false });

  assert.deepEqual(errors, []);
  console.log('propertyActivityBrowserTest: OK');
} finally {
  await browser.close();
}
