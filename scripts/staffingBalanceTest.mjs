import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'staffing-balance-'));
try {
  const outfile = join(dir, 'balance.cjs');
  await build({
    stdin: { contents: `import { staffingBalance, suggestedWeeklyMinutes } from './src/features/staffing/balance';
      const worker = id => ({ id, name: id, weeklyMinutes: 2160, weeklyMinutesMax: 2808, homeCenterIds: ['c'], availability: Array.from({length: 7}, (_, day) => ({day, startMinute: 480, endMinute: 1200})), restDay: null, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [] });
      const day = date => ({ date, assignments: [], knownMinutes: 0, estimatedMinutes: 0, capacityMinutes: 0, uncoveredMinutes: 0, criticalDays: 0, rests: [], reasons: [] });
      const days = Array.from({length: 28}, (_, offset) => day(new Date(Date.parse('2026-11-02T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)));
      const team = [worker('a'), worker('b'), worker('c'), worker('d')];
      export const fits = staffingBalance(team, days, 480 * 60, 20);
      export const recut = staffingBalance(team, days, 400 * 60, 20);
      export const shortfall = staffingBalance(team, days, 700 * 60, 20);
      export const noCushion = staffingBalance(team, days, 480 * 60, 0);
      export const zeroHours = staffingBalance([...team, {...worker('z'), weeklyMinutes: 0}], days, 480 * 60, 20);
      export const planRecut = suggestedWeeklyMinutes(recut);
      export const planShortfall = suggestedWeeklyMinutes(shortfall);
      export const planFits = suggestedWeeklyMinutes(fits);`, resolveDir: process.cwd() },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(outfile).href);
  const minutes = value => Math.round(value);
  // 4 personas × 36 h/semana × 4 semanas = 576 h comprometidas.
  assert.equal(mod.fits.actualMinutes, 576 * 60, 'la plantilla actual es la suma de jornadas del periodo');
  assert.equal(minutes(mod.fits.targetMinutes), 576 * 60, 'carga 480 h + 20 % = 576 h de objetivo');
  assert.equal(minutes(mod.fits.differenceMinutes), 0, 'con la carga cuadrada no sobra ni falta');
  assert.deepEqual(mod.planFits, {}, 'sin diferencia no se propone ningún ajuste');
  // Sobran 96 h: el reparto proporcional deja 30 h/semana por persona.
  assert.equal(minutes(mod.recut.targetMinutes), 480 * 60, 'el objetivo sigue la carga cuando baja');
  assert.equal(minutes(mod.recut.differenceMinutes), 96 * 60, 'sobran 96 h con la carga de 400 h');
  for (const value of Object.values(mod.planRecut)) assert.equal(value, 1800, 'reparto sugerido: 30 h/semana por persona');
  const recutTotal = Object.values(mod.planRecut).reduce((sum, value) => sum + value * 4, 0);
  assert.equal(recutTotal, 480 * 60, 'el reparto sugerido cuadra con el objetivo');
  // Faltan 264 h pero el margen del +30 % solo cubre 172,8 h: se agota el margen, sin superar el tope.
  assert.equal(minutes(mod.shortfall.differenceMinutes), -264 * 60, 'faltan 264 h con la carga de 700 h');
  for (const value of Object.values(mod.planShortfall)) {
    assert.ok(value <= 2808, 'el reparto nunca supera la jornada + 30 %');
    assert.ok(value >= 2160, 'el reparto no recorta cuando faltan horas');
  }
  // Colchón a 0: el objetivo es la propia carga.
  assert.equal(minutes(mod.noCushion.targetMinutes), 480 * 60, 'sin colchón el objetivo es la carga');
  // Una persona con 0 h no aporta plantilla (al paro).
  assert.equal(minutes(mod.zeroHours.actualMinutes), 576 * 60, 'quien está a 0 h no aporta horas comprometidas');
  console.log('staffing-balance-tests: OK (objetivo con colchón, reparto sugerido y tope del +30 %)');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
