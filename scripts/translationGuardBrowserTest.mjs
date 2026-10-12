// Local Chromium only (no network): reproduces Google Translate wrapping React text nodes.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const app = guarded => build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { guardDomAgainstTranslation, protectFromTranslation } from './src/utils/browserCompat';
    ${guarded ? 'guardDomAgainstTranslation(); protectFromTranslation();' : ''}
    function Report() {
      const [done, setDone] = useState(false);
      return <div><button id="toggle" onClick={() => setDone(value => !value)}>Cambiar</button>
        {!done && 'Faltan puntos'}<b>fijo</b>{done && 'Limpieza finalizada'}{done && <span id="sent">Enviado</span>}</div>;
    }
    const root = createRoot(document.getElementById('root'));
    flushSync(() => root.render(<Report />));
    window.translate = () => {
      const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT);
      const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
      for (const text of texts) {
        const font = document.createElement('font');
        text.parentNode.replaceChild(font, text);
        font.appendChild(document.createTextNode(text.textContent + ' (translated)'));
      }
    };
  ` },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
  alias: { '@': join(process.cwd(), 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent',
}).then(result => result.outputFiles[0].text);

const browser = await chromium.launch();
try {
  const run = async guarded => {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<html lang="en"><head></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: await app(guarded) });
    await page.evaluate(() => window.translate());
    // A crash unmounts the whole tree, so do not wait for the button to exist.
    for (let i = 0; i < 3; i++) await page.evaluate(() => document.querySelector('#toggle')?.click());
    const state = await page.evaluate(() => ({
      alive: Boolean(document.querySelector('#toggle')), sent: Boolean(document.querySelector('#sent')),
      lang: document.documentElement.lang, translate: document.documentElement.getAttribute('translate'),
      meta: document.querySelector('meta[name="google"]')?.getAttribute('content'),
    }));
    await page.close();
    return { errors, state };
  };
  const unprotected = await run(false);
  assert.ok(unprotected.errors.some(message => /removeChild|insertBefore|not a child/i.test(message)) || !unprotected.state.alive,
    `The fixture reproduces the translation crash: ${JSON.stringify(unprotected)}`);
  const protectedRun = await run(true);
  assert.deepEqual(protectedRun.errors, [], 'No React DOM errors once translated');
  assert.equal(protectedRun.state.alive, true, 'The screen remains usable');
  assert.equal(protectedRun.state.sent, true, 'State changes still render after translation');
  assert.equal(protectedRun.state.lang, 'es');
  assert.equal(protectedRun.state.translate, 'no');
  assert.equal(protectedRun.state.meta, 'notranslate');
  console.log('PASS: Chromium reproduces the translation crash without the guard and stays usable with it.');
} finally { await browser.close(); }
