import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks={
  '@/hooks/useClients': 'export const useClients=()=>window.clientQuery;',
  '@/hooks/useStock': 'export const useStockProducts=()=>({data:window.products,isLoading:false});export const usePropertyStockConsumptionRules=()=>({data:window.rules,isLoading:false});',
};
const built=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useForm} from 'react-hook-form';
  import {Form} from './src/components/ui/form';
  import {ServiceSection} from './src/components/properties/forms/ServiceSection';
  import {StockConsumptionSection} from './src/components/properties/forms/StockConsumptionSection';
  import {PropertyConsumptionsPanel} from './src/components/properties/PropertyConsumptionsPanel';
  import {AmenitiesManagementField} from './src/components/clients/forms/AmenitiesManagementField';
  import {mapPropertyToDB} from './src/services/storage/mappers/propertyMappers';
  import {applyDefaultPropertyConsumptionsToForm} from './src/components/properties/forms/propertyStockConsumption';
  window.products=[
    {id:'sheet',name:'Sábanas matrimonio',category:{kind:'laundry'}},
    {id:'bath',name:'Kit de amenities de baño',category:{kind:'amenity'}},
    {id:'kitchen',name:'Kit de amenities de cocina',category:{kind:'amenity'}},
    {id:'food',name:'Kit de alimentación',category:{kind:'amenity'}},
    {id:'cloth',name:'Paño de cocina',category:{kind:'other',name:'Consumibles'}},
    {id:'paper',name:'Papel higiénico',category:{kind:'other',name:'Consumibles'}}
  ].map(p=>({...p,is_consumable:true,unit_of_measure:'ud.'}));
  window.rules=window.products.map((p,i)=>({product_id:p.id,quantity_per_cleaning:i+1}));
  window.clientQuery={data:[{id:'off',linenControlEnabled:true,amenitiesControlEnabled:false},{id:'on',linenControlEnabled:false,amenitiesControlEnabled:true}],isLoading:false,isError:false};
  const property={id:'fixture',clienteId:'off',linenControlEnabled:null,amenitiesControlEnabled:null};
  window.saved=[];
  function App(){
    const [,refresh]=useState(0);
    const form=useForm({defaultValues:{...property,duracionServicio:120,costeServicio:10,checkInPredeterminado:'15:00',checkOutPredeterminado:'11:00',isActive:null,stockConsumptions:{}}});
    const clientForm=useForm({defaultValues:{amenitiesControlEnabled:false}});
    window.form=form;
    window.changeQuery=q=>{window.clientQuery=q;refresh(v=>v+1)};
    window.save=form.handleSubmit(data=>window.saved.push(mapPropertyToDB(data)));
    return <main className="mx-auto max-w-4xl space-y-6 p-5">
      <Form {...form}><ServiceSection control={form.control}/>
        <button onClick={()=>applyDefaultPropertyConsumptionsToForm(form.setValue,window.products,{numeroCamas:1,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:2,numeroCocinas:1})}>Recalcular consumos</button>
        <button onClick={()=>form.reset()}>Cancelar</button>
        <div id="editor"><StockConsumptionSection control={form.control} setValue={form.setValue} property={property}/></div>
      </Form>
      <div id="detail"><PropertyConsumptionsPanel property={{...property,amenitiesControlEnabled:form.watch('amenitiesControlEnabled'),clienteId:form.watch('clienteId'),linenControlEnabled:form.watch('linenControlEnabled')}} onEdit={()=>{}}/></div>
      <div id="client"><Form {...clientForm}><AmenitiesManagementField control={clientForm.control}/></Form></div>
    </main>;
  }createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'amenities-fixtures',setup(plugin){
  plugin.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'fixture'}:null);
  plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
}}]});
assert.equal(Object.keys(built.metafile.inputs).some(path=>path.includes('integrations/supabase')),false);
const sourceCss=readFileSync('src/index.css','utf8');
const variables=sourceCss.match(/:root\s*\{[^}]*\}/)?.[0]||'';
const css=await postcss([tailwindcss({config:'tailwind.config.ts',content:['src/components/properties/**/*.tsx','src/components/clients/forms/AmenitiesManagementField.tsx','src/components/ui/*.tsx']})]).process('@tailwind base;@tailwind components;@tailwind utilities;'+variables,{from:undefined});
const browser=await chromium.launch({headless:true});const errors=[],requests=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{requests.push(r.request().url());return r.abort()});
  await page.setContent('<style>'+css.css+'</style><div id="root"></div><script>'+built.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>');
  const editor=page.locator('#editor');
  const group=editor.locator('div.space-y-3').filter({has:page.getByRole('heading',{name:'Amenities',exact:true})});
  const inputs=group.getByRole('spinbutton');
  const sheet=editor.getByRole('spinbutton',{name:'Sábanas matrimonio(ud.)'});
  const paper=editor.getByRole('spinbutton',{name:'Papel higiénico(ud.)'});
  const toggle=page.getByRole('switch',{name:'🧴 Gestión de amenities'});
  const checkZero=async()=>{
    await expect(inputs).toHaveCount(4);for(const input of await inputs.all()){await expect(input).toHaveValue('0');await expect(input).toBeDisabled()}
    const details=page.locator('#detail section').filter({has:page.getByRole('heading',{name:'Amenities',exact:true})});
    await expect(details.locator('dd')).toHaveCount(4);for(const dd of await details.locator('dd').all())await expect(dd).toHaveText('0 ud.');
  };
  await checkZero();await expect(sheet).toHaveValue('1');await expect(paper).toHaveValue('6');await expect(paper).toBeEnabled();
  await toggle.click();await expect(inputs.first()).toHaveValue('2');
  await group.getByRole('spinbutton',{name:'Paño de cocina(ud.)'}).fill('8');
  assert.equal(await page.evaluate(()=>window.saved.length),0,'Toggle/edit are drafts');
  await toggle.click();await checkZero();await page.evaluate(()=>window.save());
  assert.equal(await page.evaluate(()=>window.saved[0].amenities_control_enabled),false,'Save persists flag');
  await toggle.click();await expect(group.getByRole('spinbutton',{name:'Paño de cocina(ud.)'})).toHaveValue('8');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();await checkZero();
  assert.equal(await page.evaluate(()=>window.form.getValues('amenitiesControlEnabled')),null,'Cancel restores inheritance');
  await page.evaluate(()=>window.form.setValue('clienteId','on'));await expect(inputs.first()).toBeEnabled();await expect(sheet).toHaveValue('0');
  await page.evaluate(()=>window.form.setValue('amenitiesControlEnabled',false));await checkZero();
  await page.getByRole('button',{name:'Recalcular consumos'}).click();await checkZero();
  await toggle.click();await expect(inputs.first()).toHaveValue('2');
  await page.evaluate(()=>{window.form.setValue('clienteId','off');window.form.setValue('amenitiesControlEnabled',true)});await expect(inputs.first()).toBeEnabled();
  await page.evaluate(()=>{window.form.setValue('amenitiesControlEnabled',null);window.changeQuery({isLoading:true,isError:false})});
  await expect(inputs.first()).toBeDisabled();await expect(inputs.first()).toHaveValue('2');
  await page.evaluate(()=>window.changeQuery({isLoading:false,isError:true}));await expect(inputs.first()).toHaveValue('2');
  await page.evaluate(()=>window.changeQuery({data:[{id:'off',amenitiesControlEnabled:false,linenControlEnabled:true}],isLoading:false,isError:false}));await checkZero();
  await page.locator('#client').getByRole('checkbox',{name:'🧴 Gestión de amenities'}).check();await expect(page.locator('#client').getByRole('checkbox')).toBeChecked();
  await page.setViewportSize({width:390,height:844});await checkZero();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:join(tmpdir(),'property-amenities-disabled-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS amenities: four product types including cloth grouped correctly, inheritance, overrides, independent laundry/paper, drafts/save/cancel, recalc, query errors/loading, client control, desktop/mobile and no network');
}finally{await browser.close()}
