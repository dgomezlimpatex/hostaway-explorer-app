import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';

// Actual page + hooks + Supabase SDK. All HTTP responses are local fixtures.
const bundle = await build({
  stdin: { contents: `import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
    import {MemoryRouter, Routes, Route} from 'react-router-dom';
    import Page from './src/pages/PublicLaundryScheduledView';
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/reparto/test-link']}><Routes><Route path='/reparto/:token' element={<Page/>}/></Routes></MemoryRouter></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
});
const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? {channel:'msedge'} : {}) });
try {
  for (const scenario of ['worker', 'anonymous', 'missing', 'expired', 'duplicate', 'network']) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const calls = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const link = {id:'test-id',token:'test-link',workflow_version:'route_v2',link_type:'route_v2',is_active:true,expires_at:scenario==='expired'?'2000-01-01T00:00:00Z':null,delivery_date:'2026-10-18',date_start:'2026-10-17',date_end:'2026-10-19'};
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === 'http://laundry.test') return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
      calls.push({path:url.pathname,method:request.method(),authorization:request.headers().authorization});
      const reply = (data, status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if (url.pathname === '/rest/v1/laundry_share_links') {
        assert.equal(url.searchParams.get('token'), 'eq.test-link');
        assert.equal(url.searchParams.get('is_active'), 'eq.true');
        assert.equal(request.method(), 'GET');
        const bearer = request.headers().authorization?.slice(7);
        const role = bearer ? JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url')).role : null;
        // Reproduce the production RLS distinction. A saved worker JWT sees no rows.
        if (role === 'authenticated') {
          return request.headers().accept?.includes('vnd.pgrst.object')
            ? reply({code:'PGRST116',message:'JSON object requested, multiple (or no) rows returned'},406)
            : reply([]);
        }
        assert.equal(role, 'anon');
        if (scenario === 'network') return reply({message:'Local network failure'},503);
        if (scenario === 'duplicate') return reply([link,link]);
        return reply(scenario === 'missing' ? [] : [link]);
      }
      if (url.pathname === '/functions/v1/laundry-route-access') {
        assert.deepEqual(request.postDataJSON(), {action:'list',token:'test-link'});
        return reply({success:true,required:true});
      }
      throw new Error(`Unexpected network request: ${url.pathname}`);
    });
    await page.goto('http://laundry.test/');
    const session = {access_token:`${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({role:'authenticated',exp:4102444800,sub:'test-worker'})).toString('base64url')}.test`,refresh_token:'test-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id:'test-worker',aud:'authenticated',role:'authenticated'}};
    const key = 'sb-qyipyygojlfhdghnraus-auth-token';
    if (scenario !== 'anonymous') await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session});
    const storageBefore = await page.evaluate(()=>JSON.stringify(localStorage));
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    if (['worker','anonymous'].includes(scenario)) {
      await expect(page.getByRole('button',{name:'Acceder a la ruta'})).toBeVisible();
      await expect(page.getByLabel('PIN de REGISTRO')).toBeVisible();
      assert.equal(calls.filter(c=>c.path==='/functions/v1/laundry-route-access').length,1);
    } else {
      await expect(page.getByRole('heading',{name:'Enlace no válido'})).toBeVisible();
      if (scenario==='missing') await expect(page.getByText(/Solicita un enlace vigente/)).toBeVisible();
      if (scenario==='expired') await expect(page.getByText('Este enlace ha expirado')).toBeVisible();
      assert.equal(calls.filter(c=>c.path.startsWith('/functions/')).length,0);
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)), storageBefore);
    assert.deepEqual(errors,[]);
    assert(!calls.some(c=>c.path.startsWith('/auth/') || c.path.includes('workflow')));
    await page.close();
    console.log(`PASS ${scenario}: isolated lookup, existing session preserved, PIN gate preserved`);
  }
} finally { await browser.close(); }
