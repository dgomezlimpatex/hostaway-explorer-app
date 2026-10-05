import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const {chromium}=createRequire(path.resolve(process.argv[3] || '.', 'package.json'))('@playwright/test');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // This smoke test never logs in and never writes business data.
  const response=await page.goto(process.argv[2],{waitUntil:'networkidle',timeout:45000});
  assert.equal(response.status(),200);
  await page.getByRole('button',{name:/iniciar sesi[oó]n/i}).waitFor({timeout:15000});
  assert.deepEqual(errors,[]);
  console.log('Entrada de la aplicación renderizada; sin errores JS; sin sesión autenticada.');
}finally{await browser.close();}
