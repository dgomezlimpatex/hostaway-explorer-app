// Gesto completo de la recuperación de borradores sobre la PÁGINA REAL del planificador, con backend simulado:
// editar → salir/recargar → recuperar → revisar → guardar, y el flujo de descarte. Sin red ni datos reales.
import { chromium, expect } from '@playwright/test';
import { buildDraftPageFixture } from './planningDraftPageBuild.mjs';

const ORIGIN = 'http://planner.example.test/';
const PREFIX = 'limpatex:planning-draft:';
const browser = await chromium.launch({ headless: true });
const errors = [];
const requests = [];
const html = await buildDraftPageFixture();

const newContext = async (viewport = { width: 1440, height: 1000 }, init) => {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  if (init) await context.addInitScript(init);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin + url.pathname === ORIGIN) return route.fulfill({ contentType: 'text/html', body: html });
    requests.push(route.request().url());
    return route.abort();
  });
  return context;
};
const newPage = async (context, query = '') => {
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${ORIGIN}${query}`);
  return page;
};
const drafts = (page) => page.evaluate((prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix))
  .map((key) => ({ key, record: JSON.parse(localStorage.getItem(key)) })), PREFIX);
const counters = (page) => page.evaluate(() => ({ apply: window.planningApplyCalls || 0, quick: window.planningQuickWrites || 0 }));
const saved = (page) => page.locator('[data-planning-draft-status="saved"]');
const notice = (page) => page.locator('[data-planning-draft-notice]');
const prepare = (page) => page.getByRole('button', { name: 'Preparar el reparto' }).click();
const saveButton = (page) => page.getByRole('button', { name: /^Guardar (cambios|reparto|\d+ y avisar)/ });
const unassignExisting = async (page) => {
  await page.locator('[data-planner-task-id="existing-1"] [data-planner-primary-action]:visible').first().click();
  await page.getByRole('button', { name: 'Sin asignar Dejar sin asignar' }).click();
  await page.getByRole('button', { name: 'Dejar sin asignar', exact: true }).click();
  await page.getByRole('button', { name: 'Desasignar la tarea', exact: true }).click();
};
const leaveUnassigned = async (page, taskId) => {
  await page.locator(`[data-planner-task-id="${taskId}"] [data-planner-primary-action]:visible`).first().click();
  await page.getByRole('button', { name: 'Sin asignar Dejar sin asignar' }).click();
  await page.getByRole('button', { name: 'Dejar sin asignar', exact: true }).click();
};
// Texto del tablero sin avisos efímeros («Deshacer» solo existe justo tras mover una tarjeta).
const board = async (page) => (await page.locator('[data-planning-board]').first().innerText())
  .split('\n').filter((line) => line !== 'Deshacer').join('\n');
const bannerPattern = /Tienes un reparto sin guardar del \d{2}\/\d{2}, modificado a las \d{2}:\d{2}\. Afecta a \d+ tareas?\./;
const checks = [];
const check = (name) => checks.push(name);

try {
  // 1-3 y 11. Editar, recargar, recuperar, revisar y guardar; escritorio y móvil.
  for (const width of [1440, 390]) {
    const context = await newContext({ width, height: 1000 });
    const page = await newPage(context);
    await expect(notice(page)).toHaveCount(0);
    await prepare(page);
    await expect(page.locator('[data-planner-proposal-title]')).toBeVisible();
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    await expect(saved(page)).toContainText('Borrador conservado en este navegador');
    expect(await counters(page)).toEqual({ apply: 0, quick: 0 });
    const boardBefore = await board(page);
    const [stored] = await drafts(page);
    expect(stored.record.proposals.some((item) => item.operation === 'unassign' && item.taskId === 'existing-1')).toBe(true);
    expect(JSON.stringify(stored.record)).not.toMatch(/Ana Mart|Bea L|Carla G/);

    await page.reload();
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(bannerPattern);
    await expect(page.getByRole('button', { name: 'Recuperar borrador' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Descartar borrador' })).toBeVisible();
    expect(await counters(page)).toEqual({ apply: 0, quick: 0 });
    expect((await drafts(page)).length, 'Ver el aviso no modifica ni crea borradores').toBe(1);

    await page.getByRole('button', { name: 'Recuperar borrador' }).click();
    await expect(page.locator('[data-planner-proposal-title]')).toBeVisible();
    await expect(page.locator('[data-planning-draft-report]')).toContainText('Borrador recuperado');
    await expect(saveButton(page)).toBeEnabled();
    expect(await counters(page), 'Recuperar no escribe nada real').toEqual({ apply: 0, quick: 0 });
    // El tablero recuperado es idéntico al que se dejó al recargar.
    expect(await board(page)).toBe(boardBefore);
    const afterRecover = await drafts(page);
    expect(afterRecover[0].record.revision, 'Recuperar sin editar no reescribe el borrador').toBe(stored.record.revision);
    expect(afterRecover[0].record.updatedAt).toBe(stored.record.updatedAt);

    await saveButton(page).click();
    await expect.poll(async () => (await counters(page)).apply).toBe(1);
    await expect(page.getByText('¡Reparto guardado!')).toBeVisible();
    expect(await page.evaluate(() => window.planningSavedProposals.filter((item) => item.operation === 'unassign').map((item) => item.taskId))).toContain('existing-1');
    await page.getByRole('button', { name: 'Volver al día' }).click();
    await expect.poll(async () => (await drafts(page)).length, { message: 'Guardado confirmado: se elimina el borrador' }).toBe(0);
    await page.reload();
    await expect(notice(page)).toHaveCount(0);
    await context.close();
  }
  check('editar→recargar→recuperar→guardar (móvil y escritorio, recuperar no escribe, guardar elimina el borrador)');

  // 6. Descartar: elimina solo ese borrador, y una escritura retrasada no lo resucita.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    await page.reload();
    await expect(notice(page)).toBeVisible();
    await page.getByRole('button', { name: 'Descartar borrador' }).click();
    await expect(page.getByText('¿Descartar este borrador?')).toBeVisible();
    await page.getByRole('button', { name: 'No, conservar' }).click();
    await expect(notice(page)).toBeVisible();
    expect((await drafts(page)).length).toBe(1);
    await page.getByRole('button', { name: 'Descartar borrador' }).click();
    await page.getByRole('button', { name: 'Sí, descartar' }).click();
    await expect(notice(page)).toHaveCount(0);
    expect(await drafts(page)).toHaveLength(0);
    await prepare(page);
    await expect(page.locator('[data-planning-board] [data-planner-task-id="existing-1"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sin cambios pendientes' })).toBeVisible().catch(() => undefined);
    // «Descartar propuesta» con una edición aún pendiente de escritura.
    await unassignExisting(page);
    await page.getByRole('button', { name: 'Descartar propuesta' }).click();
    await page.waitForTimeout(1200);
    expect(await drafts(page), 'Una escritura retrasada no resucita el borrador descartado').toHaveLength(0);
    await expect(notice(page)).toHaveCount(0);
    expect(await counters(page)).toEqual({ apply: 0, quick: 0 });
    await context.close();
  }
  check('descartar (confirmación, cancelar, solo ese borrador, escritura retrasada, sin escrituras reales)');

  // 5. Cambios externos: tarea cancelada → recuperación parcial; todo cambiado → bloqueado sin perder el borrador.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    const [before] = await drafts(page);
    const taskIds = [...new Set(before.record.proposals.map((item) => item.taskId))];
    expect(taskIds.length).toBeGreaterThanOrEqual(2);
    const other = taskIds.find((id) => id !== 'existing-1');
    await page.evaluate((id) => window.fixtureBackend.patchTask(id, { status: 'cancelled' }), other);
    await page.reload();
    await expect(notice(page)).toContainText(/Se pueden recuperar \d+ de \d+ tareas/);
    await expect(notice(page)).toContainText(/cancelad/);
    await page.getByRole('button', { name: /Recuperar borrador \(\d+ de \d+\)/ }).click();
    await expect(page.locator('[data-planning-draft-report]')).toContainText('Borrador recuperado en parte');
    await expect(page.locator('[data-planning-draft-report]')).toContainText(/cancelad/);
    expect(await counters(page)).toEqual({ apply: 0, quick: 0 });
    await context.close();

    // Bloqueado: todas las tareas del borrador cambiaron.
    const blockedContext = await newContext();
    const blocked = await newPage(blockedContext);
    await prepare(blocked);
    await unassignExisting(blocked);
    await expect(saved(blocked)).toBeVisible();
    const [draft] = await drafts(blocked);
    for (const id of new Set(draft.record.proposals.map((item) => item.taskId))) {
      await blocked.evaluate((taskId) => window.fixtureBackend.patchTask(taskId, { status: 'completed' }), id);
    }
    await blocked.reload();
    await expect(notice(blocked)).toContainText('No se puede recuperar ninguna tarea de este borrador');
    await expect(blocked.getByRole('button', { name: 'Recuperar borrador' })).toBeDisabled();
    await expect(blocked.getByRole('button', { name: 'Descartar borrador' })).toBeEnabled();
    expect(await drafts(blocked), 'El borrador bloqueado se conserva').toHaveLength(1);
    await blockedContext.close();
  }
  check('cambios externos: parcial (cancelada), bloqueado (completadas) y borrador conservado');

  // 4. Usuarios, sedes y días independientes.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    await page.close();
    const otherUser = await newPage(context, '?user=user-2');
    await expect(otherUser.getByRole('button', { name: 'Preparar el reparto' })).toBeVisible();
    await expect(notice(otherUser)).toHaveCount(0);
    await expect(otherUser.getByText('También tienes repartos sin guardar')).toHaveCount(0);
    await otherUser.close();
    const otherSede = await newPage(context, '?sede=sede-2');
    await expect(otherSede.getByRole('button', { name: 'Preparar el reparto' })).toBeVisible();
    await expect(notice(otherSede)).toHaveCount(0);
    await otherSede.close();
    const back = await newPage(context);
    await expect(notice(back)).toBeVisible();
    // Otro día: no aparece el borrador de este, pero se ofrece ir a él; cambiar de día lo conserva.
    const dateInput = back.getByLabel('Día que quieres planificar');
    const original = await dateInput.inputValue();
    const shifted = new Date(`${original}T12:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + 3);
    await dateInput.fill(shifted.toISOString().slice(0, 10));
    await expect(notice(back)).toHaveCount(0);
    await expect(back.getByText('También tienes repartos sin guardar de otros días')).toBeVisible();
    await back.getByRole('button', { name: /^Ir a / }).click();
    await expect(notice(back)).toBeVisible();
    expect(await drafts(back)).toHaveLength(1);
    await context.close();
  }
  check('usuarios, sedes y días independientes (con acceso explícito a otros días)');

  // 8 y 9. Cambiar de día dentro del reparto conserva el borrador; sin recuperar de nuevo en la misma sesión.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    const boardEdited = await board(page);
    await page.getByRole('button', { name: 'Día siguiente' }).click();
    await expect(page.getByText(/Cargando calendario…/)).toHaveCount(0);
    await expect(page.locator('[data-planner-proposal-title]')).toBeVisible();
    await page.getByRole('button', { name: 'Día anterior' }).click();
    await expect(page.locator('[data-planner-proposal-title]')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    expect(await board(page), 'Al volver al día, el tablero conserva la edición').toBe(boardEdited);
    const keys = await drafts(page);
    expect(keys.length, 'Cada día conserva su propio borrador').toBeGreaterThanOrEqual(1);
    expect(keys.some((item) => item.record.proposals.some((proposal) => proposal.operation === 'unassign'))).toBe(true);
    await context.close();
  }
  check('cambiar de día conserva el borrador anterior y no mezcla contextos');

  // 10. Dos pestañas con distintas revisiones: ni se sobrescribe en silencio ni se sustituye sin elección.
  for (const choice of ['replace', 'keep']) {
    const context = await newContext();
    const first = await newPage(context);
    await prepare(first);
    await unassignExisting(first);
    await expect(saved(first)).toBeVisible();
    const second = await newPage(context);
    await expect(notice(second)).toBeVisible();
    await second.getByRole('button', { name: 'Recuperar borrador' }).click();
    await expect(saved(second)).toBeVisible();
    await leaveUnassigned(second, 'proposed-1');
    await expect.poll(async () => (await drafts(second))[0].record.revision).toBeGreaterThan(1);
    const secondRecord = (await drafts(second))[0].record;
    const secondBoard = await board(second);
    expect(secondRecord.proposals.some((item) => item.taskId === 'proposed-1')).toBe(false);

    // La primera pestaña se entera por el evento de almacenamiento y pide una elección.
    await expect(notice(first)).toBeVisible();
    await expect(notice(first)).toContainText('Recuperar el borrador sustituye lo que ves ahora');
    await expect(first.locator('[data-planning-draft-status="paused"]')).toBeVisible();
    await leaveUnassigned(first, 'pending-1');
    await first.waitForTimeout(1200);
    expect((await drafts(first))[0].record, 'La primera pestaña no sobrescribe en silencio la versión más reciente').toEqual(secondRecord);

    if (choice === 'replace') {
      await first.getByRole('button', { name: 'Recuperar borrador' }).click();
      await expect(first.getByText('Se sustituirán los cambios que ves ahora')).toBeVisible();
      await first.getByRole('button', { name: 'No, seguir con lo actual' }).click();
      await expect(notice(first)).toBeVisible();
      expect((await drafts(first))[0].record).toEqual(secondRecord);
      await first.getByRole('button', { name: 'Recuperar borrador' }).click();
      await first.getByRole('button', { name: 'Sí, recuperar' }).click();
      await expect(notice(first)).toHaveCount(0);
      await expect(first.locator('[data-planning-draft-report]')).toContainText('Borrador recuperado');
      expect(await board(first), 'La primera pestaña muestra ahora el borrador de la segunda').toBe(secondBoard);
      expect(await counters(first)).toEqual({ apply: 0, quick: 0 });
    } else {
      await first.getByRole('button', { name: 'Descartar borrador' }).click();
      await first.getByRole('button', { name: 'Sí, descartar' }).click();
      await expect(notice(first)).toHaveCount(0);
      await expect(saved(first)).toBeVisible();
      const kept = (await drafts(first))[0].record;
      expect(kept.proposals.some((item) => item.taskId === 'pending-1')).toBe(false);
      expect(kept.proposals.some((item) => item.taskId === 'proposed-1')).toBe(true);
      expect(kept.proposals.some((item) => item.operation === 'unassign' && item.taskId === 'existing-1')).toBe(true);
      expect(kept.revision, 'Tras descartar la versión ajena, la pantalla empieza su propio borrador').toBe(1);
    }
    await context.close();
  }
  check('dos pestañas: sin sobrescritura silenciosa; elección explícita de sustituir o conservar la propia');

  // 9. Almacenamiento corrupto, bloqueado o lleno: el planificador sigue funcionando y avisa.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    await page.evaluate((prefix) => { for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.setItem(key, '{corrupto'); }, PREFIX);
    await page.reload();
    await expect(page.getByText('Había un borrador dañado en este navegador')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    expect(await drafts(page)).toHaveLength(0);
    await prepare(page);
    await expect(page.locator('[data-planner-proposal-title]')).toBeVisible();
    await context.close();

    const blockedContext = await newContext({ width: 1440, height: 1000 }, () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    const blocked = await newPage(blockedContext);
    await expect(blocked.getByText('Este navegador no permite guardar borradores')).toBeVisible();
    await prepare(blocked);
    await expect(blocked.locator('[data-planner-proposal-title]')).toBeVisible();
    await expect(blocked.locator('[data-planning-draft-status="failed"]')).toContainText('No se ha podido conservar el borrador');
    await unassignExisting(blocked);
    await expect(saveButton(blocked)).toBeEnabled();
    await expect(saved(blocked)).toHaveCount(0);
    await blockedContext.close();

    const quotaContext = await newContext({ width: 1440, height: 1000 }, () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith('limpatex:planning-draft:')) throw new DOMException('full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    const quota = await newPage(quotaContext);
    await prepare(quota);
    await expect(quota.locator('[data-planning-draft-status="failed"]')).toContainText('no queda espacio');
    await expect(saved(quota)).toHaveCount(0);
    await unassignExisting(quota);
    await expect(saveButton(quota)).toBeEnabled();
    await quotaContext.close();
  }
  check('almacenamiento corrupto, bloqueado y lleno: aviso claro y planificador operativo');

  // 7. Guardado fallido: el borrador se conserva.
  {
    const context = await newContext();
    const page = await newPage(context);
    await prepare(page);
    await unassignExisting(page);
    await expect(saved(page)).toBeVisible();
    await page.evaluate(() => { window.planningFailNextSave = true; });
    await saveButton(page).click();
    await expect(page.getByText('Fallo local simulado', { exact: true })).toBeVisible();
    expect(await drafts(page), 'Guardado fallido: el borrador sigue recuperable').toHaveLength(1);
    await page.reload();
    await expect(notice(page)).toBeVisible();
    await context.close();
  }
  check('guardado fallido conserva el borrador');

  expect(errors).toEqual([]);
  expect(requests, 'Sin peticiones de red').toEqual([]);
  console.log(`planning-draft-recovery-browser: OK\n - ${checks.join('\n - ')}`);
} finally {
  await browser.close();
}
