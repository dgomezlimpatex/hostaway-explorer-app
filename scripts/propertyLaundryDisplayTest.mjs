import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mocks = {
  '@/hooks/useClients': `export const useClients=()=>window.clientQuery;`,
  '@/hooks/useStock': `
    export const useStockProducts=()=>({data:window.products,isLoading:false});
    export const usePropertyStockConsumptionRules=()=>({data:window.rules,isLoading:false});
  `,
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React,{useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {useForm} from 'react-hook-form';
    import {Form} from './src/components/ui/form';
    import {StockConsumptionSection} from './src/components/properties/forms/StockConsumptionSection';
    import {ServiceSection} from './src/components/properties/forms/ServiceSection';
    import {PropertyConsumptionsPanel} from './src/components/properties/PropertyConsumptionsPanel';
    import {applyDefaultPropertyConsumptionsToForm} from './src/components/properties/forms/propertyStockConsumption';
    window.products=[
      {id:'sheet',name:'Sábanas matrimonio',is_consumable:true,unit_of_measure:'ud.',category:{kind:'laundry'}},
      {id:'towel',name:'Toallas grandes',is_consumable:true,unit_of_measure:'ud.',category:{kind:'laundry'}},
      {id:'extra',name:'Albornoces',is_consumable:true,unit_of_measure:'ud.',category:{kind:'laundry'}},
      {id:'amenity',name:'Amenities baño',is_consumable:true,unit_of_measure:'ud.',category:{kind:'amenity'}},
      {id:'paper',name:'Papel higiénico',is_consumable:true,unit_of_measure:'ud.',category:{kind:'other',name:'Consumibles'}}
    ];
    window.rules=window.products.map((p,i)=>({product_id:p.id,quantity_per_cleaning:[3,4,5,2,6][i]}));
    const property={id:'local-property',clienteId:'off',linenControlEnabled:null,numeroSabanas:3,numeroSabanasRequenas:2,numeroSabanasSuite:6,numeroToallasGrandes:4,numeroTotallasPequenas:4,numeroAlfombrines:1,numeroFundasAlmohada:4};
    window.clientQuery={data:[{id:'off',linenControlEnabled:false},{id:'on',linenControlEnabled:true}],isLoading:false,isError:false};
    function App(){
      const [version,refresh]=useState(0);
      const form=useForm({defaultValues:{...property,duracionServicio:120,costeServicio:50,checkInPredeterminado:'15:00',checkOutPredeterminado:'11:00',stockConsumptions:{},isActive:null}});
      window.form=form;
      window.changeQuery=q=>{window.clientQuery=q;refresh(v=>v+1)};
      return <main style={{maxWidth:900,margin:'auto',padding:20}}>
        <Form {...form}><form onSubmit={e=>e.preventDefault()}>
          <ServiceSection control={form.control}/>
          <button type="button" onClick={()=>applyDefaultPropertyConsumptionsToForm(form.setValue,window.products,{numeroCamas:3,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:2,numeroCocinas:1})}>Recalcular consumos</button>
          <div id="editor"><StockConsumptionSection control={form.control} setValue={form.setValue} property={property}/></div>
        </form></Form>
        <div id="detail"><PropertyConsumptionsPanel property={{...property,linenControlEnabled:form.watch('linenControlEnabled'),clienteId:form.watch('clienteId')}} onEdit={()=>{}}/></div>
      </main>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'local-property-fixtures', setup(plugin) {
    plugin.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks,args.path) ? {path:args.path,namespace:'fixture'} : null);
    plugin.onLoad({ filter: /.*/, namespace:'fixture' }, args => ({contents:mocks[args.path],loader:'js'}));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path=>path.includes('integrations/supabase')),false,'No production client');
const css = await postcss([tailwindcss({config:'tailwind.config.ts',content:['src/components/properties/**/*.tsx','src/components/ui/*.tsx']})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined});
const browser = await chromium.launch({headless:true});
const errors=[],requests=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
  await page.setContent('<style>'+css.css+'</style><div id="root"></div><script>'+built.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>');
  const editor=page.locator('#editor');
  const laundry=editor.locator('div.space-y-3').filter({has:page.getByRole('heading',{name:'Lavandería',exact:true})});
  const inputs=laundry.getByRole('spinbutton');
  const details=page.locator('#detail section').filter({has:page.getByRole('heading',{name:'Lencería y lavandería'})});
  const checkZero=async()=>{
    await expect(inputs).toHaveCount(3);
    for(const input of await inputs.all()){await expect(input).toHaveValue('0');await expect(input).toBeDisabled();}
    for(const dd of await details.locator('dd').all()) await expect(dd).toHaveText('0 ud.');
  };
  await checkZero();
  assert.deepEqual(await page.evaluate(()=>window.form.getValues('stockConsumptions')), {sheet:3,towel:4,extra:5,amenity:2,paper:6},'Opening does not clear saved configuration');
  await expect(editor.getByRole('spinbutton',{name:'Amenities baño(ud.)'})).toHaveValue('2');
  await expect(editor.getByRole('spinbutton',{name:'Papel higiénico(ud.)'})).toHaveValue('6');
  const toggle=page.getByRole('switch').first();
  await toggle.click();
  await expect(inputs.first()).toHaveValue('3');
  await expect(inputs.first()).toBeEnabled();
  await inputs.first().fill('7');
  await toggle.click(); await checkZero();
  await toggle.click(); await expect(inputs.first()).toHaveValue('7');
  await page.evaluate(()=>{window.form.setValue('linenControlEnabled',null);window.form.setValue('clienteId','on')});
  await expect(inputs.first()).toHaveValue('7');
  await page.evaluate(()=>window.form.setValue('linenControlEnabled',false));
  await checkZero(); // Explicit false overrides active client.
  await page.getByRole('button',{name:'Recalcular consumos'}).click();
  await checkZero();
  await page.evaluate(()=>window.form.setValue('linenControlEnabled',true));
  await expect(inputs.first()).toHaveValue('9');
  await page.evaluate(()=>{window.form.setValue('clienteId','off');window.form.setValue('linenControlEnabled',true)});
  await expect(inputs.first()).toHaveValue('9'); // Explicit true overrides disabled client.
  await page.evaluate(()=>window.form.setValue('linenControlEnabled',null));
  await checkZero();
  await page.evaluate(()=>window.changeQuery({isLoading:true,isError:false}));
  await expect(inputs.first()).toHaveValue('9'); // Unknown is not falsely zero.
  await expect(inputs.first()).toBeDisabled();
  await page.evaluate(()=>window.changeQuery({isLoading:false,isError:true}));
  await expect(inputs.first()).toHaveValue('9');
  await page.evaluate(()=>window.changeQuery({data:[{id:'off',linenControlEnabled:false}],isLoading:false,isError:false}));
  await checkZero();
  await page.setViewportSize({width:390,height:844});
  await checkZero();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile has no horizontal overflow');
  await page.screenshot({path:join(tmpdir(),'property-laundry-disabled-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS property laundry: inherited/explicit settings, all linen including legacy and extra types, toggle restore, recalculation, unchanged form values, loading/error, desktop/mobile, no network');
} finally {await browser.close();}
