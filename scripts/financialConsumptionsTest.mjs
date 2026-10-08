import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=mkdtempSync(join(tmpdir(),'financial-consumptions-'));
try {
  await build({stdin:{contents:"export * from './src/features/financial/financialModel';export * from './src/features/financial/financialSource';",resolveDir:process.cwd()},outfile:join(dir,'model.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const {analyze,buildServices,newSettings,QUANTITY_ITEMS,readSettings}=await import(pathToFileURL(join(dir,'model.mjs')));
  const client='669948a6-e5c3-4a73-a151-6ccca5c82adf';
  const settings={...newSettings(),rates:[{item:'tourismSalary',date:'2000-01-01',mills:0}],incomes:[{id:'virtual',label:'Virtual',mode:'perCleaning',start:'2026-09-01',end:'',income:275,cost:0,weeklyHours:0,costCategory:'other',clientId:client,propertyId:'',workerId:'',notes:'',overrides:{}}]};
  const filters={start:'2026-09-01',end:'2026-09-30',clients:[],properties:[],workers:[]};
  const service={id:'t',date:'2026-09-10',type:'limpieza',clientId:client,clientName:'Turquoise',propertyId:'p',propertyName:'Apartamento',revenue:10000,revenueEstimated:true,workers:[{id:'w',name:'Trabajador',minutes:60,actual:false}],quantities:Object.fromEntries(QUANTITY_ITEMS.map(i=>[i.id,i.id==='kitchenCloth'?1:0]))};
  const run=(s=service,c=settings)=>analyze([s],c,filters).services[0];
  let r=run();assert.equal(r.revenue,10300);assert.equal(r.kitchenClothRevenue,25);assert.equal(r.additionalRevenue,300);assert.equal(r.costs.products,300);assert.equal(r.costs.laundry,15);assert.equal(r.result,8535);
  // One charge per cleaning, while expense follows the number of cloths.
  r=run({...service,quantities:{...service.quantities,kitchenCloth:3}});assert.equal(r.kitchenClothRevenue,25);assert.equal(r.costs.laundry,45);
  for(const qty of [0,undefined])assert.equal(run({...service,quantities:{...service.quantities,kitchenCloth:qty}}).kitchenClothRevenue,0);
  assert.equal(run({...service,clientId:'other'}).kitchenClothRevenue,0);
  assert.equal(run({...service,clientId:'other'},{...settings,policies:[{clientId:'other',propertyId:'p',kitchenClothIncome:true}]}).kitchenClothRevenue,25);
  assert.equal(run(service,{...settings,policies:[{clientId:client,propertyId:'',kitchenClothIncome:true},{clientId:client,propertyId:'p',kitchenClothIncome:false}]}).kitchenClothRevenue,0);
  assert.equal(run(service,{...settings,adjustments:{t:{quantities:{kitchenCloth:0}}}}).kitchenClothRevenue,0);
  assert.equal(run(service,{...settings,rates:[...settings.rates,{item:'kitchenClothIncome',date:'2026-09-10',mills:400}]}).kitchenClothRevenue,40);
  assert.equal(run({...service,propertyName:'Check in apartamento'}).additionalRevenue,undefined);
  assert.equal(run(service,{...settings,policies:[{clientId:client,propertyId:'',laundry:false}]}).kitchenClothRevenue,0);
  for(const revenue of [0,null])assert.equal(analyze([{...service,revenue}],settings,filters).services.length,0);
  assert.equal(analyze([service],settings,{...filters,properties:['other']}).total.revenue,0);
  assert.equal(analyze([service],settings,{...filters,workers:['w']}).total.revenue,10300);
  assert.throws(()=>readSettings({...settings,policies:[{clientId:client,propertyId:'p',kitchenClothIncome:'yes'}]}));
  const task={id:'t',type:'limpieza',date:'2026-09-10',status:'pending',coste:0,cliente_id:client,propiedad_id:'p',property:'Apartamento',cleaner_id:'w',cleaner:'Trabajador',start_time:'10:00',end_time:'11:00',task_assignments:[]};
  const prop={id:'p',nombre:'Apartamento',cliente_id:client,coste_servicio:100,duracion_servicio:60};
  const rules=['BOLSAS DE BASURA 10L','BOLSAS DE BASURA 30L','Bolsas basura','Bayetas cocina','PAÑOS DE COCINA','PAPEL DE COCINA'].map(name=>({property_id:'p',quantity_per_cleaning:1,product:{name}}));
  const source=buildServices([task],[prop],[{id:client,name:'Turquoise'}],[],'2026-10-08',rules)[0];
  assert.deepEqual(source.unpricedConsumptions,['PAPEL DE COCINA']);assert.equal(source.quantities.kitchenCloth,1);
  assert.equal(run(source).kitchenClothRevenue,25);assert.equal(run(source).costs.products,300);
  assert.ok(run(source).pending.includes('Cantidad pendiente: Nórdico')); // Occasional washes remain unresolved.
  console.log('financial-consumptions: cloth income/cost, once per cleaning, property eligibility, editable rate, inheritance, exclusions, filters and bags/bayetas passed');
}finally{rmSync(dir,{recursive:true,force:true});}
