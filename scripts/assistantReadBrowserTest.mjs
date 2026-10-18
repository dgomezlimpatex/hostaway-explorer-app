import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
const {permissions}=JSON.parse(await readFile(new URL('./assistantReadFixtures.json',import.meta.url),'utf8'));
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const url=server.resolvedUrls.local[0];
const browser=await chromium.launch({headless:true});let checks=0;
try {
 for(const [profile,resources] of Object.entries(permissions)) {
  const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();const calls=[];let outside=0;
  await context.route('https://**/*',async route=>{
   const request=route.request();
   if(!request.url().endsWith('/rest/v1/rpc/limpatex_assistant_read')) {outside++;return route.abort();}
   const p=request.postDataJSON();calls.push(p);assert.equal(request.method(),'POST');
   if(p.p_token!=='fixture-'+profile || p.p_resource!=='permisos' && !resources.includes(p.p_resource))return route.fulfill({status:403,body:'{}'});
   const base={profile,read_only:true,as_of:'2026-10-18T10:00:00+02:00',notice:'Prueba de lectura.'};
   const data=p.p_resource==='permisos'?{...base,resources}:{...base,resource:p.p_resource,total:51,offset:p.p_offset,has_more:p.p_offset===0,rows:[{id:String(p.p_offset),nombre:'Prueba '+p.p_resource,activo:true}]};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(url+'asistentes');await page.getByLabel('Credencial de consulta').fill('fixture-'+profile);await page.getByRole('button',{name:'Entrar en consulta'}).click();
  await page.locator(`[data-profile="${profile}"]`).waitFor();await page.getByText('Prueba '+resources[0],{exact:true}).waitFor();checks++;
  assert.equal(await page.locator('nav button').count(),resources.length);checks++;
  for(const resource of resources) {await page.locator('nav button').nth(resources.indexOf(resource)).click();await page.getByText('Prueba '+resource,{exact:true}).waitFor();checks++;}
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.getByText('Desde el registro 51',{exact:false}).waitFor();assert.equal(calls.at(-1).p_offset,50);checks++;
  await page.getByLabel('Buscar por nombre, código o propiedad').fill('inexistente');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.reader-pages span')?.textContent?.includes('registro 1'));assert.equal(calls.at(-1).p_search,'inexistente');checks++;
  assert.equal(await page.getByRole('button',{name:/guardar|eliminar|asignar|crear|publicar/i}).count(),0);assert.equal(outside,0);checks++;
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  await page.getByRole('button',{name:'Cerrar acceso'}).click();await page.getByLabel('Credencial de consulta').waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('limpatex-assistant-readonly-v1')),null);checks++;
  await context.close();
 }
 const management=await browser.newContext();await management.route('https://**/*',route=>route.abort());
 const login=await management.newPage();await login.goto(url+'auth');await login.getByLabel('Email',{exact:true}).waitFor();
 assert.equal(await login.locator('.assistant-reader').count(),0);checks++;
 await management.close();
 console.log(JSON.stringify({ok:true,checks,profiles:4,externalBusinessWrites:0,source:'isolated mocked browser; all outbound requests intercepted'}));
} finally {await browser.close();await server.close();}
