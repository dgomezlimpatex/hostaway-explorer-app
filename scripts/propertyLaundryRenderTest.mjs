import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const mocks = {
  '@/hooks/useClients': `export const useClients=()=>globalThis.clientQuery;`,
  '@/hooks/useStock': `export const useStockProducts=()=>({data:globalThis.products,isLoading:false});export const usePropertyStockConsumptionRules=()=>({data:globalThis.rules,isLoading:false});`,
};
const built = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';
  import {renderToStaticMarkup} from 'react-dom/server';
  import {useForm} from 'react-hook-form';
  import {Form} from './src/components/ui/form';
  import {StockConsumptionSection} from './src/components/properties/forms/StockConsumptionSection';
  import {PropertyConsumptionsPanel} from './src/components/properties/PropertyConsumptionsPanel';
  import {buildInitialStockConsumptions,applyDefaultPropertyConsumptionsToForm} from './src/components/properties/forms/propertyStockConsumption';
  import {usePropertyLaundryEnabled} from './src/components/properties/forms/usePropertyLaundryEnabled';
  export function render(setting,clientId,recalculate=false){
    const property={id:'fixture',clienteId:clientId,linenControlEnabled:setting,numeroSabanas:3,numeroSabanasSuite:6,numeroAlfombrines:1};
    let stockConsumptions=buildInitialStockConsumptions(globalThis.products,globalThis.rules,property);
    if(recalculate) applyDefaultPropertyConsumptionsToForm((name,value)=>{if(name==='stockConsumptions')stockConsumptions=value},globalThis.products,{numeroCamas:3,numeroCamasPequenas:0,numeroCamasSuite:0,numeroSofasCama:0,numeroBanos:2,numeroCocinas:1});
    function Fixture(){
      const form=useForm({defaultValues:{...property,stockConsumptions}});
      const enabled=usePropertyLaundryEnabled(setting,clientId);
      globalThis.result={values:form.getValues('stockConsumptions'),enabled};
      return <><Form {...form}><StockConsumptionSection control={form.control} setValue={form.setValue} property={property}/></Form><PropertyConsumptionsPanel property={property} onEdit={()=>{}}/></>;
    }
    return renderToStaticMarkup(<Fixture/>);
  }
`},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',metafile:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'local-fixtures',setup(plugin){
  plugin.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'fixture'}:null);
  plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));
}}]});
assert.equal(Object.keys(built.metafile.inputs).some(path=>path.includes('integrations/supabase')),false);
globalThis.products=[
  {id:'sheet',name:'Sábanas matrimonio',is_consumable:true,unit_of_measure:'ud.',category:{kind:'laundry'}},
  {id:'extra',name:'Albornoces',is_consumable:true,unit_of_measure:'ud.',category:{kind:'laundry'}},
  {id:'amenity',name:'Amenities baño',is_consumable:true,unit_of_measure:'ud.',category:{kind:'amenity'}},
];
globalThis.rules=[{product_id:'sheet',quantity_per_cleaning:3},{product_id:'extra',quantity_per_cleaning:5},{product_id:'amenity',quantity_per_cleaning:2}];
const loaded={data:[{id:'off',linenControlEnabled:false},{id:'on',linenControlEnabled:true}],isLoading:false,isError:false};
const folder=mkdtempSync(join(tmpdir(),'property-laundry-render-'));
try {
  const filename=join(folder,'fixture.cjs');writeFileSync(filename,built.outputFiles[0].text);
  const {render}=createRequire(import.meta.url)(filename);
  const input=(html,id)=>html.match(/<input\b[^>]*>/g)[globalThis.products.findIndex(product=>product.id===id)];
  for(const [setting,clientId,enabled] of [[null,'off',false],[null,'on',true],[false,'on',false],[true,'off',true],[null,'',false]]){
    globalThis.clientQuery=loaded;
    const html=render(setting,clientId);
    assert.equal(globalThis.result.enabled,enabled);
    assert.match(input(html,'sheet'),new RegExp('value="'+(enabled?3:0)+'"'));
    assert.match(input(html,'extra'),new RegExp('value="'+(enabled?5:0)+'"'));
    assert.equal(input(html,'sheet').includes('disabled=""'),!enabled);
    assert.match(input(html,'amenity'),/value="2"/);
    assert.equal(input(html,'amenity').includes('disabled=""'),false);
    if(!enabled){const section=html.split('Lencería y lavandería')[1].split('</section>')[0];assert.equal((section.match(/<dd[^>]*>0 <span/g)||[]).length,8,'Every legacy and catalog linen row is zero');}
    assert.deepEqual(globalThis.result.values,{sheet:3,extra:5,amenity:2},'Display does not overwrite stored/form quantities');
  }
  for(const query of [{isLoading:true,isError:false},{isLoading:false,isError:true},{data:[],isLoading:false,isError:false}]){
    globalThis.clientQuery=query;
    const html=render(null,'off');
    assert.equal(globalThis.result.enabled,undefined);
    assert.match(input(html,'sheet'),/value="3"/);
    assert.match(input(html,'sheet'),/disabled=""/);
    assert.equal(globalThis.result.values.sheet,3);
    render(false,'off');assert.equal(globalThis.result.enabled,false,'Explicit override works even without client query');
  }
  globalThis.clientQuery=loaded;
  const html=render(false,'on',true);
  assert.match(input(html,'sheet'),/value="0"/);
  assert.equal(globalThis.result.values.sheet,9,'Recalculation remains in memory while disabled display stays zero');
  console.log('PASS real components: inheritance, overrides, every linen type, unchanged amenities and quantities, loading/errors and recalculation; no browser or network required');
} finally {rmSync(folder,{recursive:true,force:true});delete globalThis.products;delete globalThis.rules;delete globalThis.clientQuery;delete globalThis.result;}
