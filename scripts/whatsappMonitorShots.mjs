// Capturas comparables del monitor de WhatsApp con datos sintéticos, sin red ni sesión.
// Uso: node scripts/whatsappMonitorShots.mjs carpeta [prefijo]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { buildWhatsAppMonitorFixture } from './whatsappMonitorFixture.mjs';

const [dir = 'shots', prefix = ''] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const html = await buildWhatsAppMonitorFixture();
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
const URL = 'https://whatsapp.local.test/';

const capture = async (name, viewport, fx, after) => {
  const page = await browser.newPage({ viewport });
  await page.clock.install({ time: new Date('2026-10-20T10:00:00Z') });
  await page.route('**/*', route => (route.request().url() === URL ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort()));
  await page.goto(URL);
  await page.evaluate(s => { Object.assign(window, { fx: s, rpcCalls: [], writes: [] }); window.fixturePath = '/whatsapp-notifications'; window.renderFixture(); }, fx);
  await page.waitForTimeout(500);
  if (after) await after(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, `${prefix}${name}.png`), fullPage: true });
  await page.close();
};

const openQueuesOnMobile = async page => {
  const toggle = page.getByRole('button', { name: /envíos por comprobar/ });
  if (await toggle.count()) await toggle.first().click();
};

try {
  await capture('escritorio-prod', { width: 1440, height: 960 }, { queue: 'prod' });
  await capture('escritorio-mixto', { width: 1440, height: 960 }, { queue: 'mixed' });
  await capture('movil-prod', { width: 390, height: 844 }, { queue: 'prod' }, openQueuesOnMobile);
  await capture('movil-mixto', { width: 390, height: 844 }, { queue: 'mixed' }, openQueuesOnMobile);
  // Detalle tras «Revisar» (solo existe en el rediseño; en la versión anterior se omite).
  const review = async page => {
    const button = page.getByRole('button', { name: /^Revisar/ }).last();
    if (await button.count()) await button.click();
  };
  await capture('escritorio-revisar', { width: 1440, height: 960 }, { queue: 'prod' }, review);
  await capture('movil-revisar', { width: 390, height: 844 }, { queue: 'prod' }, async page => { await openQueuesOnMobile(page); await review(page); });
} finally {
  await browser.close();
}
