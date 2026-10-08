import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temp = mkdtempSync(join(tmpdir(), 'financial-format-'));
try {
  await build({ entryPoints: ['src/features/financial/financialFormat.ts'], outfile: join(temp, 'format.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { money, percent, decimal, financialName } = await import(pathToFileURL(join(temp, 'format.mjs')));
  const plain = text => text.replace(/\s/g, ' ');
  for (const [cents, expected] of [[0,'0,00 €'],[55,'0,55 €'],[100000,'1.000,00 €'],[916098,'9.160,98 €'],[-405845,'-4.058,45 €'],[123456789,'1.234.567,89 €']]) assert.equal(plain(money(cents)), expected);
  assert.equal(percent(26.1), '26,1%'); assert.equal(percent(-10.456), '-10,5%'); assert.equal(percent(0), '0,0%'); assert.equal(percent(null), '—');
  assert.equal(decimal(0.247,2,3), '0,247'); assert.equal(decimal(1.5,2), '1,50');
  assert.equal(financialName('Weguest Sl.'), 'Weguest SL');
  assert.equal(financialName('Hotel SC - Limp. de habitaciones'), 'Hotel Santa Catalina - Limpieza de habitaciones');
  for (const name of ['Alesón 1','Casa Montellos pequeña','Turquoise Apartments','El piso de Montse']) assert.equal(financialName(name), name);
  console.log('financial-format: Spanish four-digit/thousand grouping, cents and negatives, comma percentages, precision and display-only labels passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
