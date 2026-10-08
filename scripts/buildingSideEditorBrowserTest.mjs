import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fixture = `
  import {useState} from 'react';
  const groups=[{id:'g',name:'Marina 30',internalCode:'M30',zone:'Centro',supervisorName:'Elena Ruiz',checkOutTime:'11:00',checkInTime:'17:00',isActive:true},{id:'g2',name:'Alameda 8',zone:'Norte',isActive:true}];
  const team=[{id:'a',propertyGroupId:'g',cleanerId:'ana',roleType:'primary',priority:10,isActive:true},{id:'b',propertyGroupId:'g',cleanerId:'marta',roleType:'secondary',priority:20,isActive:true},{id:'inactive',propertyGroupId:'g',cleanerId:'inactiva',roleType:'backup',priority:30,isActive:false}];
  const properties=[{id:'p1',codigo:'M30-1A',nombre:'Apartamento A'},{id:'p2',codigo:'LIBRE-2B',nombre:'Apartamento libre'},{id:'p3',codigo:'AJENA-3',nombre:'Otro edificio'}];
  const assignments=[{id:'p-a',propertyGroupId:'g',propertyId:'p1'},{id:'p-b',propertyGroupId:'g2',propertyId:'p3'}];
  const cleaners=[{id:'ana',name:'Ana López',isActive:true},{id:'marta',name:'Marta Díaz',isActive:true},{id:'sara',name:'Sara Vidal',isActive:true},{id:'inactiva',name:'Vínculo inactivo',isActive:true}];
  const clone=x=>JSON.parse(JSON.stringify(x)); window.writes=[];window.data={groups,team,assignments};
  const write=async(name,fn)=>{window.writes.push(name);await new Promise(r=>setTimeout(r,window.saveDelay||0));if(window.failWrite===name)throw new Error('Fallo simulado');return clone(fn()||{});};
  export const propertyGroupStorage={
    getPropertyGroups:async()=>clone(groups),getCleanerAssignments:async id=>clone(team.filter(x=>x.propertyGroupId===id)),getAllPropertyAssignments:async()=>clone(assignments),
    updateCleanerAssignment:async(id,updates)=>write('team',()=>Object.assign(team.find(x=>x.id===id),updates)),
    assignCleanerToGroup:async value=>write('add-team',()=>{const x={...value,id:'new-'+value.cleanerId};team.push(x);return x;}),
    removeCleanerFromGroup:async id=>write('remove-team',()=>{team.splice(team.findIndex(x=>x.id===id),1);}),
    assignPropertyToGroup:async(groupId,propertyId)=>write('property',()=>{const x={id:'new-'+propertyId,propertyGroupId:groupId,propertyId};assignments.push(x);return x;}),
    removePropertyFromGroup:async id=>write('remove-property',()=>{assignments.splice(assignments.findIndex(x=>x.id===id),1);}),
    updatePropertyGroup:async(id,value)=>write('group',()=>Object.assign(groups.find(x=>x.id===id),value)),
    createPropertyGroup:async value=>write('create',()=>{const x={...value,id:'created'};groups.push(x);return x;}),
    deleteEmptyPropertyGroup:async id=>write('delete',()=>{groups.splice(groups.findIndex(x=>x.id===id),1);})
  };
  function useRefresh(){const [,setTick]=useState(0);return async()=>{setTick(x=>x+1);return {error:null};};}
  export const useCleaningPlanningBuildingData=()=>({data:{propertyGroups:clone(groups),cleanerAssignments:clone(team.filter(x=>x.isActive)),propertyAssignments:clone(assignments)},isLoading:false,isError:false,isFetching:false,refetch:useRefresh()});
  export const useCleaners=()=>({cleaners:clone(cleaners),isLoading:false,error:null,refetch:useRefresh()});
  export const useProperties=()=>({data:clone(properties),isLoading:false,isError:!!window.failCatalog,refetch:useRefresh()});
`;
const mocks = {
  '@/contexts/SedeContext': "export const useSede=()=>({activeSede:{id:'s'}});",
  '@/hooks/use-toast': "export const useToast=()=>({toast:()=>{}});",
};
const shared = ['@/hooks/useCleaners','@/hooks/useProperties','@/hooks/useCleaningPlanningBuildingData','@/services/storage/propertyGroupStorage'];
const built = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import Page from './src/pages/PlanningBuildingsIndex';createRoot(document.getElementById('root')).render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Page/></QueryClientProvider></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'building-fixture', setup(plugin) {
  plugin.onResolve({filter: /.*/}, args => shared.includes(args.path) ? {path:'shared',namespace:'fixture'} : Object.hasOwn(mocks,args.path) ? {path:args.path,namespace:'fixture'} : null);
  plugin.onLoad({filter: /.*/,namespace:'fixture'}, args=>({contents:args.path==='shared'?fixture:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
} }] });
assert.ok(!Object.keys(built.metafile.inputs).some(path=>path.startsWith('src/integrations/supabase')), 'No real client in test');
const cssSource=readFileSync('src/index.css','utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm,'');
const {css}=await postcss([tailwindcss('tailwind.config.ts'),autoprefixer]).process(cssSource,{from:'src/index.css'});
const html=`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
const executablePath=process.platform==='linux'&&existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined;
const browser=await chromium.launch({headless:true,executablePath});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://buildings.local.test/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
  await page.goto('https://buildings.local.test/');
  await expect(page.getByText('Ana López')).toBeVisible();
  const search=page.getByRole('textbox',{name:'Buscar edificio, persona o propiedad…'});
  await search.fill('marta');await expect(page.getByRole('button',{name:'Editar Marina 30',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Editar Alameda 8',exact:true})).toHaveCount(0);
  await search.fill('AJENA-3');await expect(page.getByRole('button',{name:'Editar Alameda 8',exact:true})).toBeVisible();await search.fill('');
  await page.getByRole('button',{name:'Editar Marina 30',exact:true}).click();
  const editor=page.getByRole('region',{name:'Editar Marina 30'});
  await expect(editor.getByLabel('Rol de Ana López')).toBeVisible();
  assert.equal(await page.evaluate(()=>window.writes.length),0);
  await editor.getByLabel('Rol de Ana López').selectOption('secondary');
  await expect(editor.getByText('1 cambio pendiente',{exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>window.data.team[0].roleType),'primary');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Editar Alameda 8',exact:true}).click();await expect(editor).toBeVisible();
  await editor.getByRole('button',{name:'Descartar',exact:true}).click();await expect(editor.getByLabel('Rol de Ana López')).toHaveValue('primary');
  await editor.getByRole('button',{name:'Añadir persona',exact:true}).click();await expect(editor.getByRole('button',{name:'+ Vínculo inactivo',exact:true})).toHaveCount(0);
  await editor.getByRole('button',{name:'+ Sara Vidal',exact:true}).click();
  await editor.getByRole('button',{name:'Vincular propiedades',exact:true}).click();await expect(editor.getByRole('button',{name:/AJENA/})).toHaveCount(0);await editor.getByRole('button',{name:/LIBRE-2B/}).click();
  await editor.getByLabel('Supervisión de referencia').fill('Referencia nueva');
  assert.equal(await page.evaluate(()=>window.writes.length),0);
  await page.evaluate(()=>window.saveDelay=100);
  await editor.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(editor.getByRole('button',{name:'Guardando…'})).toBeDisabled();await expect(page.getByRole('button',{name:'Editar Alameda 8',exact:true})).toBeDisabled();
  await expect(editor.getByText('Cambios guardados.',{exact:true})).toBeVisible();
  assert.deepEqual(await page.evaluate(()=>window.writes),['add-team','property','group']);
  await page.screenshot({path:join(tmpdir(),'buildings-2c-desktop.png'),fullPage:true});
  // Failure after a role write must block blind retries and reconcile confirmed state.
  await editor.getByLabel('Rol de Ana López').selectOption('secondary');
  await editor.getByLabel('Supervisión de referencia').fill('Fallo referencia');
  await page.evaluate(()=>window.failWrite='group');await editor.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(editor.getByRole('alert')).toContainText('Puede haber cambios ya guardados');
  await expect(editor.getByRole('button',{name:'Guardar cambios',exact:true})).toHaveCount(0);
  await page.evaluate(()=>window.failWrite=null);await editor.getByRole('button',{name:'Recargar estado guardado'}).click();
  await expect(editor.getByLabel('Rol de Ana López')).toHaveValue('secondary');await expect(editor.getByLabel('Supervisión de referencia')).toHaveValue('Referencia nueva');
  // Stale data never overwrites another edit.
  await editor.getByLabel('Rol de Ana López').selectOption('backup');await page.evaluate(()=>window.data.team[0].priority=77);
  const writesBefore=await page.evaluate(()=>window.writes.length);await editor.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(editor.getByRole('alert')).toContainText('ha cambiado');assert.equal(await page.evaluate(()=>window.writes.length),writesBefore);
  await editor.getByRole('button',{name:'Recargar estado guardado'}).click();
  await editor.getByLabel('Supervisión de referencia').fill('Borrador al girar');
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Rol de Ana López')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Supervisión de referencia')).toHaveValue('Borrador al girar');
  await page.getByRole('dialog').getByRole('button',{name:'Descartar',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile horizontal overflow');
  await page.screenshot({path:join(tmpdir(),'buildings-2c-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar editor',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1050});
  await page.getByRole('button',{name:'Añadir edificio',exact:true}).click();
  await page.getByLabel('Nombre del edificio').fill('Nuevo edificio');
  await page.getByLabel('Código interno').fill('NEW');
  await page.getByRole('button',{name:'Crear edificio',exact:true}).click();
  const newEditor=page.getByRole('region',{name:'Editar Nuevo edificio'});
  await expect(newEditor).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await newEditor.getByRole('button',{name:'Eliminar edificio vacío'}).click();
  await expect(newEditor).toHaveCount(0);
  await page.evaluate(()=>window.failCatalog=true);
  await page.getByRole('button',{name:'Actualizar edificios'}).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar toda la información');
  await expect(page.getByRole('button',{name:'Editar Marina 30',exact:true})).toHaveCount(0);
  assert.deepEqual(errors,[]);
  console.log('Building directory: search, edit/discard, switching guard, add/save, inactive links, occupied properties, partial failure, stale conflict and mobile passed.');
} finally {await browser.close();}
