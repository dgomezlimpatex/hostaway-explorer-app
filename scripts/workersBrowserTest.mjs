// Comprobación local en navegador de Trabajadores: páginas reales dentro del layout real,
// datos ficticios, cliente Supabase simulado, toda petición externa abortada.
// Uso: node scripts/workersBrowserTest.mjs  (WORKERS_SHOTS=carpeta para guardar capturas)
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { buildWorkersFixture } from './workersFixture.mjs';

const html = await buildWorkersFixture();
const shots = process.env.WORKERS_SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page, name, options = {}) => {
  if (!shots) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, `${name}.png`), ...options });
};
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : existsSync('/usr/bin/google-chrome') ? { executablePath: '/usr/bin/google-chrome' } : {}) });
const URL = 'https://workers.local.test/';
let external = 0;
const newPage = async (viewport = { width: 1366, height: 900 }) => {
  const page = await browser.newPage({ viewport });
  // Miércoles 21 de octubre de 2026, 10:00 en Madrid.
  await page.clock.setFixedTime(new Date('2026-10-21T08:00:00Z'));
  page.errors = [];
  page.on('pageerror', (error) => page.errors.push(error.message));
  await page.route('**/*', (route) => {
    if (route.request().url() === URL) return route.fulfill({ contentType: 'text/html', body: html });
    external += 1;
    return route.abort();
  });
  await page.goto(URL);
  return page;
};
const open = async (page, path, setup = {}) => {
  await page.evaluate(([p, s]) => {
    Object.assign(window, { fixtureRole: 'admin', fixtureFail: [], fixtureDelay: {}, fixtureOverride: undefined, fixtureMany: 0, fixtureSedePending: false, fixtureInvokeFail: false, fixtureRejectWrites: false, queries: [], writes: [], invokes: [] }, s);
    window.fixturePath = p;
    window.renderFixture();
  }, [path, setup]);
};
const where = (page) => page.getByTestId('where').textContent();
const writes = (page) => page.evaluate(() => window.writes);
const invokes = (page) => page.evaluate(() => window.invokes);
const bodyText = (page) => page.locator('body').innerText();
const noHorizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

const contrast = (a, b) => {
  const lum = ([r, g, bl]) => {
    const c = [r, g, bl].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);

try {
  // ---------------------------------------------------------------------------------------------
  // Listado (admin, escritorio) dentro del layout real con barra lateral
  // ---------------------------------------------------------------------------------------------
  const page = await newPage();
  await open(page, '/workers');
  await expect(page.getByRole('heading', { name: 'Trabajadores', level: 1 })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(6); // cabecera + 5 activos
  // TRAB-19: una sola marca; la página solo aporta la subnavegación.
  await expect(page.getByText('Gestión de personal')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Personal' }).getByRole('link', { name: 'Control de horas' })).toBeVisible();
  // TRAB-12: columna «Hoy» genérica en Madrid (miércoles 21/10).
  const rowOf = (name) => page.getByRole('row').filter({ hasText: name });
  await expect(rowOf('Persona Uno Ejemplo').getByText('Ausente', { exact: true })).toBeVisible();
  await expect(rowOf('Persona Dos Ejemplo').getByText('Ausente 09:00–12:00')).toBeVisible();
  await expect(rowOf('Persona Seis').getByText('Día libre fijo')).toBeVisible();
  await expect(rowOf('Persona Tres').getByText('Disponible')).toBeVisible();
  assert.ok(!/Baja|médic|Nota médica/.test(await bodyText(page)), 'el listado no muestra el motivo de la ausencia');
  await expect(page.getByRole('button', { name: /No disponibles hoy/ })).toContainText('3');
  // TRAB-08: «Sin puesto» explícito y filtrable.
  await expect(rowOf('Persona Tres').getByText('Sin puesto')).toBeVisible();
  await page.getByLabel('Puesto').selectOption({ label: 'Sin puesto' });
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(rowOf('Persona Tres')).toBeVisible();
  await page.getByLabel('Puesto').selectOption({ label: 'Cristalera' });
  await expect(rowOf('Persona Cuatro Cristalera')).toBeVisible();
  await page.getByLabel('Puesto').selectOption({ label: 'Todos los puestos' });
  await page.getByRole('button', { name: /No disponibles hoy/ }).click();
  await expect(page.getByRole('row')).toHaveCount(4);
  await page.getByRole('button', { name: /No disponibles hoy/ }).click();
  assert.deepEqual(await writes(page), [], 'abrir y filtrar no escribe');
  await shot(page, 'listado-admin-escritorio');

  // TRAB-16: contraste de los textos secundarios.
  const ratios = await page.evaluate(() => {
    const bg = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && !c.includes('rgba(0, 0, 0, 0)') && c !== 'transparent') return c; n = n.parentElement; } return 'rgb(255, 255, 255)'; };
    return ['.p-footnote', '.p-overview span', '.p-person small', '.p-toolbar .p-muted', '.p-table th'].map((sel) => {
      const el = document.querySelector(sel);
      return { sel, fg: getComputedStyle(el).color, bg: bg(el) };
    });
  });
  for (const r of ratios) {
    const value = contrast(rgb(r.fg), rgb(r.bg));
    assert.ok(value >= 4.5, `contraste ${r.sel}: ${value.toFixed(2)}`);
  }
  console.log('Contraste:', ratios.map((r) => `${r.sel} ${contrast(rgb(r.fg), rgb(r.bg)).toFixed(2)}`).join(' · '));

  // TRAB-07: carga, error y sede pendiente no muestran cifras.
  await open(page, '/workers', { fixtureDelay: { cleaners: 60000 } });
  await expect(page.getByRole('status').filter({ hasText: 'Cargando equipo…' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Equipo activo/ })).toContainText('—');
  await shot(page, 'listado-cargando');
  await open(page, '/workers', { fixtureFail: ['cleaners'] });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar el equipo.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Inactivos/ })).toContainText('—');
  assert.ok(!/\b0 \/ 0\b/.test(await bodyText(page)));
  await shot(page, 'listado-error');
  await open(page, '/workers', { fixtureSedePending: true });
  await expect(page.getByText('Cargando equipo…')).toBeVisible();
  await expect(page.getByText('No hay trabajadores con estos filtros.')).toHaveCount(0);
  await open(page, '/workers', { fixtureFail: ['worker_absences'] });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar la disponibilidad de hoy' })).toBeVisible();
  await expect(rowOf('Persona Uno Ejemplo').getByText('Ausente', { exact: true })).toHaveCount(0);

  // TRAB-09: ordenar solo ordena (escritorio).
  await open(page, '/workers');
  await page.getByRole('button', { name: 'Ordenar equipo' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Arrastra una fila o usa Subir y Bajar/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Desactivar|Reactivar/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Subir a Persona Dos Ejemplo' }).click();
  const order = (await writes(page)).find((w) => w.rpc === 'update_cleaners_order');
  assert.deepEqual(order.args.cleaner_updates.slice(0, 2), [{ id: 'w2', sortOrder: 0 }, { id: 'w1', sortOrder: 1 }]);
  assert.equal(order.args.cleaner_updates.length, 6, 'envía el orden completo');
  await shot(page, 'ordenar-escritorio');
  // Escape cerraría antes el aviso (también es una capa descartable): se usa el botón de cerrar.
  await dialog.getByRole('button', { name: /Close|Cerrar/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // TRAB-15 + TRAB-03: alta con aviso de duplicado y validación.
  await page.getByRole('button', { name: 'Nuevo trabajador' }).click();
  const create = page.getByRole('dialog');
  await expect(create.getByText(/no tendrán DNI ni PIN de REGISTRO/)).toBeVisible();
  await create.getByLabel('Nombre completo *').fill('persona uno ejemplo');
  await expect(create.getByText(/Posible duplicado en esta sede/)).toBeVisible();
  await expect(create.getByRole('button', { name: 'Crear trabajador' })).toBeDisabled();
  await create.getByLabel('Horas semanales por contrato').fill('-5');
  await create.getByLabel('Es otra persona: crear de todos modos').check();
  await create.getByRole('button', { name: 'Crear trabajador' }).click();
  await expect(create.getByText('Debe estar entre 0 y 80 horas.')).toBeVisible();
  assert.equal((await writes(page)).filter((w) => w.table === 'cleaners').length, 0, 'alta inválida no escribe');
  await create.getByLabel('Horas semanales por contrato').fill('37,3');
  await expect(create.getByText(/cuartos de hora/).first()).toBeVisible();
  await shot(page, 'alta-duplicado');
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------------------------------------
  // Ficha (admin)
  // ---------------------------------------------------------------------------------------------
  await open(page, '/workers/w4?tab=profile');
  await expect(page.getByRole('heading', { name: 'Persona Cuatro Cristalera', level: 1 })).toBeVisible();
  const ficha = page.getByRole('form', { name: 'Datos de la ficha' });
  await expect(ficha.getByLabel('Puesto')).toHaveValue('Cristalera');
  await ficha.getByLabel('Teléfono').fill('600 000 044');
  await ficha.getByRole('button', { name: 'Guardar ficha' }).click();
  await expect.poll(async () => (await writes(page)).filter((w) => w.table === 'cleaners' && w.mutation === 'update').length).toBe(1);
  const update = (await writes(page)).find((w) => w.table === 'cleaners' && w.mutation === 'update');
  assert.deepEqual(Object.keys(update.payload), ['telefono'], 'TRAB-01: solo se envía el teléfono; la categoría se conserva');
  // TRAB-03: valores inválidos no se guardan.
  await open(page, '/workers/w1?tab=profile');
  const ficha1 = page.getByRole('form', { name: 'Datos de la ficha' });
  for (const value of ['-5', '200', '37,3']) {
    await ficha1.getByLabel('Horas semanales de la ficha').fill(value);
    await ficha1.getByRole('button', { name: 'Guardar ficha' }).click();
    await expect(ficha1.getByRole('alert').first()).toBeVisible();
  }
  await ficha1.getByLabel('Horas semanales de la ficha').fill('20');
  await ficha1.getByLabel('Correo').fill('no-es-correo');
  await ficha1.getByRole('button', { name: 'Guardar ficha' }).click();
  await expect(ficha1.getByText('Revisa el formato del correo.')).toBeVisible();
  assert.equal((await writes(page)).filter((w) => w.table === 'cleaners').length, 0, 'TRAB-03: ninguna escritura inválida');
  await shot(page, 'ficha-validacion');
  // TRAB-04: quitar la fecha de alta envía null.
  await ficha1.getByLabel('Correo').fill('w1@example.test');
  await ficha1.getByRole('button', { name: 'Quitar fecha' }).click();
  await ficha1.getByRole('button', { name: 'Guardar ficha' }).click();
  await expect.poll(async () => (await writes(page)).filter((w) => w.table === 'cleaners').length).toBe(1);
  const dateWrite = (await writes(page)).find((w) => w.table === 'cleaners');
  assert.deepEqual(dateWrite.payload, { start_date: null });
  // Admin ve el DNI pero nunca el PIN; repartidor con confirmación.
  await expect(page.getByText('00000000T')).toBeVisible();
  assert.ok(!(await bodyText(page)).includes('4321'), 'el PIN no se muestra ni a gerencia');
  await expect(page.getByText('Disponible (no se muestra)')).toBeVisible();
  await page.getByRole('button', { name: 'Asignar rol de repartidor…' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('¿Asignar el rol de repartidor a Persona Uno Ejemplo?');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  assert.ok((await invokes(page)).every((i) => i.body.action === 'status'), 'cancelar no cambia el acceso');
  await shot(page, 'ficha-admin', { fullPage: true });
  // TRAB-25: error real de la función.
  await open(page, '/workers/w1?tab=profile', { fixtureInvokeFail: true });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar el acceso de ruta.' })).toBeVisible();
  await expect(page.getByText(/no tiene PIN en REGISTRO/)).toHaveCount(0);
  // Escritura rechazada: mensaje honesto, no «Trabajador no encontrado».
  await open(page, '/workers/w4?tab=profile', { fixtureRejectWrites: true });
  await page.getByRole('form', { name: 'Datos de la ficha' }).getByLabel('Teléfono').fill('600 000 045');
  await page.getByRole('button', { name: 'Guardar ficha' }).click();
  await expect(page.getByText(/No se guardó: no tienes permiso/).first()).toBeVisible();

  // TRAB-05: error de consulta frente a no encontrado.
  await open(page, '/workers/w1', { fixtureFail: ['cleaners'] });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo consultar la ficha.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByText('No se encuentra este trabajador')).toHaveCount(0);
  await shot(page, 'ficha-error');
  await open(page, '/workers/no-existe');
  await expect(page.getByText('No se encuentra este trabajador en la sede seleccionada.')).toBeVisible();

  // Resumen: TRAB-10, TRAB-11, TRAB-14.
  await open(page, '/workers/w1');
  await expect(page.getByRole('heading', { name: 'Ventana del planificador' })).toBeVisible();
  const windowPanel = page.getByRole('region', { name: 'Ventana del planificador' });
  await expect(windowPanel.getByText('Domingo')).toBeVisible();
  await expect(windowPanel.locator('dd').nth(0)).toHaveText('06:00–23:00');
  await expect(windowPanel.locator('dd').nth(6)).toHaveText('No disponible');
  await expect(windowPanel.getByText('6 h')).toBeVisible();
  await expect(windowPanel.getByText('Centro')).toBeVisible();
  await expect(page.getByText('Domingo libre')).toBeVisible();
  await expect(page.getByText('Trabajo externo').first()).toBeVisible();
  await expect(page.getByText('Asignadas ya pasadas*')).toBeVisible();
  await expect(page.getByText(/tareas con horario ya pasado no constan como completadas/)).toBeVisible();
  const summaryText = await bodyText(page);
  assert.ok(!/Transcurridas|(?<!no |no son )horas trabajadas/.test(summaryText), 'no se presenta como trabajo realizado: ' + JSON.stringify(summaryText.match(/.{0,30}(Transcurridas|horas trabajadas(?! ni)).{0,30}/g)));
  await shot(page, 'ficha-resumen-admin', { fullPage: true });
  // TRAB-06 + TRAB-11: Disponibilidad con error y vocabulario.
  await open(page, '/workers/w1?tab=availability', { fixtureFail: ['worker_absences'] });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron consultar: ausencias.' })).toBeVisible();
  await expect(page.getByText('Sin ausencias próximas')).toHaveCount(0);
  await expect(page.getByText('Sin avisos')).toHaveCount(0);
  await open(page, '/workers/w1?tab=availability');
  await expect(page.getByRole('button', { name: 'Franja no disponible' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disponibilidad', exact: true })).toHaveCount(0);
  await expect(page.getByText('⛔ Franja no disponible')).toBeVisible();
  await expect(page.getByText('Octubre de 2026')).toBeVisible();
  await shot(page, 'ficha-disponibilidad-admin', { fullPage: true });

  // TRAB-18: volver al listado conserva búsqueda y filtros.
  await open(page, '/workers?q=Uno');
  await page.getByRole('link', { name: /^Persona Uno Ejemplo/ }).click();
  await page.getByRole('link', { name: 'Ver disponibilidad' }).click();
  await page.getByRole('link', { name: 'Ficha', exact: true }).click();
  await page.getByRole('link', { name: 'Volver al equipo' }).click();
  assert.equal(await where(page), '/workers?q=Uno');

  // ---------------------------------------------------------------------------------------------
  // Supervisión: consulta sin datos sensibles ni controles de escritura
  // ---------------------------------------------------------------------------------------------
  await open(page, '/workers', { fixtureRole: 'supervisor' });
  await expect(page.getByRole('button', { name: 'Ordenar equipo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo trabajador' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Personal' })).toHaveCount(0);
  await expect(page.getByPlaceholder('Nombre, teléfono o correo')).toBeVisible();
  await page.getByLabel('Buscar trabajador').fill('00000000T');
  await expect(page.getByText('No hay trabajadores con estos filtros.')).toBeVisible();
  await shot(page, 'listado-supervisor');
  for (const tab of ['summary', 'profile', 'availability']) {
    await open(page, `/workers/w1?tab=${tab}`, { fixtureRole: 'supervisor' });
    await expect(page.getByRole('heading', { name: 'Persona Uno Ejemplo', level: 1 })).toBeVisible();
    await page.waitForTimeout(300);
    const text = await page.locator('body').innerText();
    // DOM visible y atributos, sin el script del arnés (que contiene los datos simulados).
    const domHtml = await page.evaluate(() => { const copy = document.body.cloneNode(true); copy.querySelectorAll("script").forEach((n) => n.remove()); return copy.innerHTML; });
    for (const secret of ['4321', '00000000T', 'Nota médica ficticia', 'Baja médica']) {
      assert.ok(!text.includes(secret) && !domHtml.includes(secret), `supervisión (${tab}) sin «${secret}» en el DOM`);
    }
    assert.ok(!/\bBaja\b/.test(text), `supervisión (${tab}) sin «Baja»`);
    assert.equal(await page.locator('main input:not([disabled]), main textarea, main select:not([aria-label])').count(), 0, `supervisión (${tab}) sin campos editables`);
    await expect(page.getByRole('button', { name: /Guardar|Nueva ausencia|Franja no disponible|Mantenimiento|repartidor|Desactivar|Reactivar|Eliminar|Editar|Añadir/ })).toHaveCount(0);
    await shot(page, `ficha-supervisor-${tab}`, { fullPage: true });
  }
  await expect(page.getByRole('checkbox').first()).toBeDisabled().catch(async () => {
    await page.getByRole('tab', { name: 'Días y franjas' }).click();
    await expect(page.getByRole('checkbox').first()).toBeDisabled();
  });
  await expect(page.getByRole('tab', { name: 'Historial' })).toHaveCount(0);
  assert.deepEqual(await invokes(page), [], 'TRAB-25: supervisión no invoca la función de ruta');
  assert.deepEqual(await writes(page), [], 'supervisión: ninguna escritura');
  // El calendario no abre «Nueva ausencia» para supervisión.
  await page.getByRole('tab', { name: 'Calendario' }).click();
  await page.locator('[data-calendar-date="2026-10-14"]').click();
  await expect(page.getByRole('dialog', { name: 'Nueva ausencia' })).toHaveCount(0);

  // ---------------------------------------------------------------------------------------------
  // Móvil 390 px
  // ---------------------------------------------------------------------------------------------
  const mobile = await newPage({ width: 390, height: 844 });
  await open(mobile, '/workers');
  await expect(mobile.getByRole('heading', { name: 'Trabajadores', level: 1 })).toBeVisible();
  await expect(mobile.locator('tbody tr')).toHaveCount(5);
  assert.ok(await noHorizontalOverflow(mobile), 'listado móvil sin desbordamiento');
  const rowHeights = await mobile.locator('tbody tr').evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect().height));
  const average = rowHeights.reduce((a, b) => a + b, 0) / rowHeights.length;
  assert.ok(average <= 844 / 6, `TRAB-20: tarjeta media ${average.toFixed(0)} px permite ≥6 por pantalla`);
  console.log(`Tarjeta móvil media: ${average.toFixed(0)} px`);
  await shot(mobile, 'listado-movil');
  await open(mobile, '/workers', { fixtureMany: 150 });
  await expect(mobile.locator('tbody tr')).toHaveCount(128); // 150 personas, 22 inactivas
  await open(mobile, '/workers');
  await mobile.getByRole('button', { name: 'Ordenar equipo' }).click();
  const mobileDialog = mobile.getByRole('dialog');
  await expect(mobileDialog.getByText(/Usa Subir y Bajar/)).toBeVisible();
  assert.ok(!/Arrastra/.test(await mobileDialog.innerText()), 'móvil: el texto no habla de arrastrar');
  await expect(mobileDialog.getByRole('button', { name: /Desactivar|Reactivar/ })).toHaveCount(0);
  const dialogFits = await mobileDialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth + 1);
  assert.ok(dialogFits, 'TRAB-09: diálogo de ordenar sin desbordamiento a 390 px');
  await shot(mobile, 'ordenar-movil');
  await mobile.keyboard.press('Escape');
  await open(mobile, '/workers/w1?tab=availability');
  const tabs = mobile.getByRole('navigation', { name: 'Secciones de la ficha' }).getByRole('link');
  await expect(tabs).toHaveCount(5);
  const tabBoxes = await tabs.evaluateAll((links) => links.map((l) => l.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right })));
  assert.ok(tabBoxes.every((b) => b.left >= 0 && b.right <= 390), 'TRAB-18: todas las pestañas visibles a 390 px');
  assert.ok(await noHorizontalOverflow(mobile), 'ficha móvil sin desbordamiento');
  await shot(mobile, 'ficha-disponibilidad-movil', { fullPage: true });
  await open(mobile, '/workers/w1?tab=profile');
  assert.ok(await noHorizontalOverflow(mobile), 'pestaña Ficha móvil sin desbordamiento');
  await shot(mobile, 'ficha-movil', { fullPage: true });
  await open(mobile, '/workers/w1');
  await shot(mobile, 'ficha-resumen-movil', { fullPage: true });

  for (const p of [page, mobile]) assert.deepEqual(p.errors, [], `sin errores de página: ${p.errors.join(' | ')}`);
  assert.equal(external, 0, 'ninguna petición fuera del arnés');
  console.log('workers-browser-tests: OK');
} finally {
  await browser.close();
}
