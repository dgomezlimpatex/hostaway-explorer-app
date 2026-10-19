// Comprobación local en navegador del calendario global: página real, datos sintéticos, sin red ni sesión.
// Uso: node scripts/globalCalendarBrowserTest.mjs  (GLOBAL_CALENDAR_SHOTS=carpeta para guardar capturas)
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { buildGlobalCalendarFixture } from './globalCalendarFixture.mjs';

const html = await buildGlobalCalendarFixture();
const shots = process.env.GLOBAL_CALENDAR_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page, name, options = {}) => {
  if (!shots) return;
  await page.waitForTimeout(650); // deja terminar las transiciones antes de capturar
  await page.screenshot({ path: join(shots, `${name}.png`), ...options });
};
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
const URL = 'https://calendar.local.test/';
const where = page => page.getByTestId('where').textContent();
const open = async (page, setup = {}, path = '/calendario-global') => {
  await page.evaluate(([p, s]) => {
    Object.assign(window, { fixtureDelay: {}, fixtureFail: [], fixtureMany: 0, fixtureNoProperties: false, fixturePropertiesError: false, fixtureOverride: undefined, queries: [], writes: [] }, s);
    window.fixturePath = p;
    window.renderFixture();
  }, [path, setup]);
};
const newPage = async (viewport, extra = {}) => {
  const page = await browser.newPage({ viewport, ...extra });
  // Miércoles 21 de octubre de 2026, 10:00 en Madrid.
  await page.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('**/*', route => (route.request().url() === URL ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort()));
  await page.goto(URL);
  return page;
};
const rowHeader = (page, name) => page.getByRole('rowheader').filter({ has: page.getByRole('button', { name: new RegExp(`^${name}`) }) });
const rowButton = (page, name) => page.getByRole('button', { name: new RegExp(`^${name}`) });

const contrast = (a, b) => {
  const lum = ([r, g, bl]) => {
    const c = [r, g, bl].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const rgb = value => value.match(/[\d.]+/g).slice(0, 4).map(Number);
const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };

try {
  // -------------------------------------------------------------------------
  // Escritorio
  // -------------------------------------------------------------------------
  const page = await newPage({ width: 1440, height: 960 });
  await open(page);
  await expect(page.getByRole('heading', { name: 'Calendario global', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '19 – 25 oct 2026', level: 2 })).toBeVisible();
  const table = page.getByRole('table', { name: /Calendario de la semana/ });
  await expect(table).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /^miércoles 21, hoy:/ })).toBeVisible();

  // Estancias: duplicado portal + Avantio dibujado una vez; cambio de huésped el mismo día; cancelada ausente.
  const duplicated = page.getByRole('button', { name: /^Estancia del sáb 17 oct al mié 21 oct, 4 noches, Portal de cliente \+ Avantio$/ });
  await expect(duplicated).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Estancia del mié 21 oct al mié 28 oct, 7 noches, Smoobu/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Estancia del lun 19 oct al mié 21 oct/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Requiere revisión$/ })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Bloqueo del jue 22 oct al sáb 24 oct, 2 noches, Avirato/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Estancia del dom 18 oct al mar 20 oct, 2 noches, Little Hotelier/ })).toHaveCount(1);

  // Noches: sin reserva registrada nunca se presenta como disponible.
  await expect(rowButton(page, 'Orzán 3º A')).toHaveAccessibleName(/lunes: Sin reserva registrada/);
  await expect(rowButton(page, 'Orzán 1º A')).toHaveAccessibleName(/martes: Ocupado.*miércoles: Ocupado/);
  await expect(rowButton(page, 'Hotel Atlántico · Doble')).toHaveAccessibleName(/jueves: Bloqueo/);
  const pageText = await page.locator('body').innerText();
  assert.ok(!/(?<!no )disponible/i.test(pageText.replace(/Dato no disponible/g, '')), 'no aparece «disponible» como estado');

  // Limpiezas: varias en el mismo día, equipo de dos, en curso, revisión, salida sin limpieza.
  await expect(page.getByRole('button', { name: 'Limpieza hecha a las 11:00, Ana Pérez, Luis Gómez' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpieza prevista a las 16:00, Begoña Ruiz' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpieza en curso a las 09:30, Ana Pérez' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Marta Sanz, parte pendiente de revisión$/ })).toBeVisible();
  assert.ok((await page.getByRole('button', { name: 'Salida registrada sin limpieza ese día' }).count()) >= 3);
  await expect(page.getByText('Sin propiedad en el listado')).toBeVisible();
  await expect(rowButton(page, 'Antiguo Bajo')).toBeVisible();
  await expect(rowButton(page, 'Antiguo Ático')).toHaveCount(0);
  await expect(page.getByText(/Reservas activas sin propiedad vinculada en su fuente/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Smoobu: 1' })).toHaveAttribute('href', '/smoobu');
  await expect(page.getByText(/1 cambio de huésped el mismo día/)).toBeVisible();
  await expect(page.getByText('Leyenda').first()).toBeVisible();
  await expect(page.getByText('(no significa libre)')).toBeVisible();
  await shot(page, 'escritorio-semana');
  await shot(page, 'escritorio-completo', { fullPage: true });

  // Contraste de texto sobre los fondos de estancia y limpiezas.
  const colors = await page.evaluate(() => {
    const read = el => ({ color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor });
    const bar = [...document.querySelectorAll('button[aria-label^="Estancia del sáb 17"]')][0];
    const chip = state => [...document.querySelectorAll('button[aria-label^="Limpieza ' + state + '"]')][0];
    return {
      stayText: getComputedStyle(bar.querySelector('span:last-child')).color, stayBg: getComputedStyle(bar.querySelector('span')).backgroundColor,
      done: read(chip('hecha')), live: read(chip('en curso')), pending: read(chip('prevista')),
    };
  });
  const white = [255, 255, 255];
  const ratios = {
    estancia: contrast(rgb(colors.stayText), rgb(colors.stayBg)),
    hecha: contrast(rgb(colors.done.color), over(rgb(colors.done.bg), white)),
    enCurso: contrast(rgb(colors.live.color), over(rgb(colors.live.bg), white)),
    prevista: contrast(rgb(colors.pending.color), over(rgb(colors.pending.bg), white)),
  };
  for (const [name, ratio] of Object.entries(ratios)) assert.ok(ratio >= 4.5, `contraste ${name}: ${ratio.toFixed(2)}`);
  console.log('Contraste:', Object.fromEntries(Object.entries(ratios).map(([k, v]) => [k, Number(v.toFixed(2))])));

  // Detalle de estancia: dos fuentes, limpieza de salida y enlace a la ficha. Escape devuelve el foco.
  await duplicated.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Estancia' })).toBeVisible();
  await expect(sheet.getByText('Registrada en 2 fuentes (se muestra una vez)')).toBeVisible();
  await expect(sheet.getByText('Ref. AV-551')).toBeVisible();
  await expect(sheet.getByText('Hasta las 11:00 según la ficha')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /11:00 Ana Pérez, Luis Gómez Hecha/ })).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Abrir ficha de la propiedad' })).toHaveAttribute('href', '/properties?propertyId=orz-1');
  await shot(page, 'escritorio-detalle-estancia');
  await sheet.getByRole('button', { name: /11:00 Ana Pérez/ }).click();
  await expect(sheet.getByRole('heading', { name: 'Limpieza' })).toBeVisible();
  await expect(sheet.getByText('Fin registrado: 12:40')).toBeVisible();
  await expect(sheet.getByText('Inicio registrado: 11:02')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Abrir tarea' })).toHaveAttribute('href', '/tasks?taskId=t-done');
  await shot(page, 'escritorio-detalle-limpieza');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(duplicated).toBeFocused();

  // Estancias solapadas y bloqueo explican la incertidumbre.
  await page.getByRole('button', { name: /^Estancia del lun 19 oct al jue 22 oct.*Requiere revisión$/ }).click();
  await expect(sheet.getByText(/Se solapa con otra estancia o bloqueo/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Bloqueo del jue 22 oct/ }).click();
  await expect(sheet.getByText(/Bloqueo registrado por la fuente/)).toBeVisible();
  await page.keyboard.press('Escape');

  // En curso: inicio registrado y estado guardado distinto.
  await page.getByRole('button', { name: 'Limpieza en curso a las 09:30, Ana Pérez' }).click();
  await expect(sheet.getByText('Inicio registrado: 09:41')).toBeVisible();
  await expect(sheet.getByText(/El estado guardado en la tarea es «Pendiente»/)).toBeVisible();
  await page.keyboard.press('Escape');

  // Navegación por semanas: siguiente, anterior y hoy, con la URL y consultas correctas.
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.getByRole('heading', { name: '26 oct – 1 nov 2026', level: 2 })).toBeVisible();
  assert.equal(await where(page), '/calendario-global?semana=2026-10-26');
  await expect(page.getByRole('button', { name: /^Estancia del mié 21 oct al mié 28 oct, 7 noches, Smoobu/ })).toBeVisible();
  assert.ok(await page.evaluate(() => window.queries.some(q => q.table === 'tasks' && q.ops.some(o => o[0] === 'gte' && o[2] === '2026-10-26'))));
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.getByRole('heading', { name: '12 – 18 oct 2026', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.getByRole('heading', { name: '19 – 25 oct 2026', level: 2 })).toBeVisible();
  assert.equal(await where(page), '/calendario-global');
  await expect(page.getByRole('button', { name: 'Hoy' })).toBeDisabled();

  // Búsqueda (sin acentos, por persona) y agrupación por cliente.
  const search = page.getByRole('searchbox', { name: 'Buscar en el calendario' });
  await search.fill('begona');
  await expect(rowButton(page, 'Orzán 1º A')).toBeVisible();
  await expect(rowButton(page, 'Orzán 2º A')).toHaveCount(0);
  await search.fill('marina');
  await expect(page.getByRole('rowheader').filter({ hasText: 'Marina' }).first()).toBeVisible();
  await expect(rowButton(page, 'Orzán 1º A')).toHaveCount(0);
  await search.fill('zzzz');
  await expect(page.getByText('Ninguna propiedad coincide con «zzzz»')).toBeVisible();
  await page.getByRole('button', { name: 'Borrar búsqueda' }).first().click();
  await expect(rowButton(page, 'Orzán 1º A')).toBeVisible();
  await page.getByRole('radio', { name: 'Cliente' }).click();
  assert.equal(await where(page), '/calendario-global?agrupar=cliente');
  await expect(page.getByRole('button', { name: /^Houmi Orzán/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sin cliente asignado/ })).toBeVisible();
  const group = page.getByRole('button', { name: /^Coto Rivas/ });
  await group.click();
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(rowButton(page, 'Marina Habitación 1')).toHaveCount(0);
  await group.press('Enter');
  await expect(rowButton(page, 'Marina Habitación 1')).toBeVisible();
  await page.getByRole('radio', { name: 'Edificio' }).click();
  await expect(page.getByRole('button', { name: /^Edificio Orzán/ })).toBeVisible();

  // Teclado: tabular hasta una estancia, abrir con Enter, foco visible y cerrar con Escape.
  await search.focus();
  let focusedLabel = '';
  for (let i = 0; i < 80 && !focusedLabel.startsWith('Estancia'); i += 1) {
    await page.keyboard.press('Tab');
    focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || '');
  }
  assert.ok(focusedLabel.startsWith('Estancia'), 'se llega a una estancia con el teclado');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  assert.notEqual(ring, 'none', 'foco visible');
  await shot(page, 'escritorio-foco-teclado');
  await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();
  // Radix registra Escape tras montar el panel; una persona no pulsa en el mismo milisegundo.
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), focusedLabel);

  // Animación al cambiar de semana con movimiento normal.
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  assert.notEqual(await table.evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.getByRole('button', { name: 'Hoy' }).click();

  // Fuente de reservas caída: solo sus propiedades muestran «Dato no disponible».
  await open(page, { fixtureFail: ['smoobu_reservations'] });
  await expect(page.getByText(/No se pudieron leer todas las reservas \(Smoobu\)/)).toBeVisible();
  await expect(rowButton(page, 'Marina Habitación 3')).toHaveAccessibleName(/lunes: Dato no disponible/);
  await expect(rowButton(page, 'Orzán 3º A')).toHaveAccessibleName(/lunes: Sin reserva registrada/);
  await shot(page, 'escritorio-fuente-no-disponible');
  // Sin mapeo de Little Hotelier no se sabe a quién afecta: todas las propiedades.
  await open(page, { fixtureFail: ['lh_room_mapping'] });
  await expect(rowButton(page, 'Orzán 3º A')).toHaveAccessibleName(/lunes: Dato no disponible/);

  // Limpiezas no leídas: no se confunden con «sin limpiezas».
  await open(page, { fixtureFail: ['tasks'] });
  await expect(page.getByText(/No se pudieron leer las limpiezas de esta semana/)).toBeVisible();
  assert.ok((await page.getByText('No disponible', { exact: true }).count()) > 10);
  await expect(page.getByRole('button', { name: 'Salida registrada sin limpieza ese día' })).toHaveCount(0);

  // Error de propiedades, carga y vacío.
  await open(page, { fixturePropertiesError: true });
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar el calendario');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  assert.equal(await page.evaluate(() => window.propertiesRefetched), 1);
  await open(page, { fixtureDelay: { tasks: 1500 } });
  await expect(page.getByLabel('Cargando calendario')).toBeVisible();
  await shot(page, 'escritorio-cargando');
  await expect(table).toBeVisible({ timeout: 5000 });
  // Sin propiedades pero con limpiezas en la sede: las limpiezas siguen a la vista.
  await open(page, { fixtureNoProperties: true });
  await expect(page.getByText('Sin propiedad en el listado')).toBeVisible();
  await expect(page.getByText('No hay propiedades activas en esta sede')).toHaveCount(0);
  await open(page, { fixtureNoProperties: true, fixtureOverride: { tasks: [] } });
  await expect(page.getByText('No hay propiedades activas en esta sede')).toBeVisible();
  await shot(page, 'escritorio-vacio');

  // Rendimiento con muchas propiedades.
  const started = Date.now();
  await open(page, { fixtureMany: 400 });
  await expect(rowButton(page, 'Apartamento 400')).toHaveCount(1, { timeout: 15000 });
  const renderMs = Date.now() - started;
  console.log(`413 propiedades renderizadas en ${renderMs} ms`);
  assert.ok(renderMs < 6000, `render con 400 propiedades: ${renderMs} ms`);
  const searchStarted = Date.now();
  await search.fill('APT-399');
  await expect(rowButton(page, 'Apartamento 399')).toBeVisible();
  console.log(`búsqueda sobre 413 propiedades en ${Date.now() - searchStarted} ms`);

  assert.deepEqual(await page.evaluate(() => window.writes), [], 'sin escrituras ni llamadas a funciones');
  assert.deepEqual(page.errors, []);
  await page.close();

  // -------------------------------------------------------------------------
  // Movimiento reducido
  // -------------------------------------------------------------------------
  const calm = await newPage({ width: 1280, height: 900 }, { reducedMotion: 'reduce' });
  await open(calm);
  const calmTable = calm.getByRole('table', { name: /Calendario de la semana/ });
  await expect(calmTable).toBeVisible();
  await calm.getByRole('button', { name: 'Semana siguiente' }).click();
  assert.equal(await calmTable.evaluate(el => getComputedStyle(el).animationName), 'none', 'sin animación de semana');
  await calm.getByRole('button', { name: 'Hoy' }).click();
  await calm.getByRole('button', { name: /^Estancia del sáb 17 oct/ }).click();
  const calmSheet = calm.getByRole('dialog');
  await expect(calmSheet).toBeVisible();
  assert.equal(await calmSheet.evaluate(el => getComputedStyle(el).animationName), 'none', 'panel sin animación');
  assert.deepEqual(calm.errors, []);
  await calm.close();

  // -------------------------------------------------------------------------
  // Móvil
  // -------------------------------------------------------------------------
  const mobile = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await open(mobile);
  await expect(mobile.getByRole('heading', { name: 'Calendario global', level: 1 })).toBeVisible();
  await expect(mobile.getByText('(no significa libre)')).toHaveCount(0);
  await mobile.getByRole('button', { name: 'Leyenda' }).click();
  await expect(mobile.getByText('(no significa libre)')).toBeVisible();
  await shot(mobile, 'movil-leyenda', { fullPage: true });
  await mobile.getByRole('button', { name: 'Leyenda' }).click();
  const scroller = mobile.locator('[aria-busy]').filter({ has: mobile.getByRole('table') });
  const metrics = await scroller.evaluate(el => ({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  assert.ok(metrics.scrollWidth > metrics.clientWidth, 'la semana se desplaza en horizontal');
  assert.ok(metrics.scrollLeft > 0, 'se centra en el día de hoy');
  const labelBox = await rowHeader(mobile, 'Orzán 1º A').boundingBox();
  assert.ok(labelBox && labelBox.x < 40, 'la columna de propiedades queda fija a la izquierda');
  await shot(mobile, 'movil-semana');
  await mobile.getByRole('button', { name: 'Limpieza en curso a las 09:30, Ana Pérez' }).click();
  const mobileSheet = mobile.getByRole('dialog');
  await expect(mobileSheet.getByRole('heading', { name: 'Limpieza' })).toBeVisible();
  const sheetBox = await mobileSheet.boundingBox();
  assert.ok(sheetBox && Math.round(sheetBox.y + sheetBox.height) >= 843 && sheetBox.y > 80, 'panel inferior en móvil');
  await shot(mobile, 'movil-detalle');
  assert.deepEqual(await mobile.evaluate(() => window.writes), []);
  assert.deepEqual(mobile.errors, []);
  await mobile.close();

  console.log('globalCalendarBrowserTest: escritorio, teclado, movimiento reducido, errores, rendimiento y móvil verificados sin red ni escrituras.');
} finally {
  await browser.close();
}
