import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const folder=mkdtempSync(join(tmpdir(),'financial-detail-'));
try {
  await build({stdin:{contents:"export * from './src/features/financial/financialModel';export * from './src/features/financial/financialCharts';export * from './src/features/financial/financialDrilldown';",resolveDir:process.cwd(),loader:'ts'},outfile:join(folder,'detail.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const {analyze,QUANTITY_ITEMS,financialDetail,dashboardSeries,periodColumns,monthlyTrend}=await import(pathToFileURL(join(folder,'detail.mjs')));
  const quantities=Object.fromEntries(QUANTITY_ITEMS.map(item=>[item.id,0]));
  const service={id:'cleaning',type:'cleaning',date:'2026-09-08',clientId:'c',clientName:'Cliente',propertyId:'p',propertyName:'Piso',revenue:10000,revenueEstimated:true,workers:[{id:'w',name:'Ana',minutes:120,actual:false}],quantities:{...quantities,doubleSheet:2,kitchenKit:1,kitchenCloth:1}};
  const general={id:'general',label:'Alquiler',date:'2026-09-02',category:'other',cents:750,clientId:'',propertyId:'',workerId:''};
  const income={id:'reception',label:'Recepción',mode:'monthly',start:'2026-08-01',end:'',income:31000,cost:10000,weeklyHours:16,costCategory:'other',clientId:'external',propertyId:'',workerId:'',notes:'',overrides:{}};
  const settings={version:1,rates:[],adjustments:{},expenses:[general,{...general,id:'structure',category:'personal',label:'Estructura',cents:10000},{...general,id:'direction',category:'salary',label:'Dirección adicional',cents:5000}],policies:[{clientId:'c',propertyId:'',kitchenClothIncome:true}],incomes:[income,{...income,id:'duplicate-label',income:1000,cost:0,weeklyHours:0},{...income,id:'laundry',label:'Lavandería externa',mode:'manual',start:'2026-09-30',income:50000,cost:null,weeklyHours:0,costCategory:'laundry'},{...income,id:'supplement',label:'Virtual',mode:'perCleaning',clientId:'c',income:275,cost:0,weeklyHours:0}]};
  const services=[service,{...service,id:'zero',revenue:0},{...service,id:'missing',revenue:null},{...service,id:'check',type:'check-in',revenue:2000}];
  const filters={start:'2026-09-01',end:'2026-09-30',clients:[],properties:[],workers:[]};
  const snapshot=JSON.stringify({settings,services});
  const selections=[filters,{...filters,end:'2026-09-15'},{...filters,clients:['c']},{...filters,clients:['external']},{...filters,properties:['p']},{...filters,workers:['w']},{...filters,clients:['none']},...monthlyTrend(services,settings,filters,true).map(period=>({...filters,start:period.start,end:period.end}))];
  for(const selection of selections) {
    const result=analyze(services,settings,selection),before=JSON.stringify(result);
    const concepts=[...periodColumns(result.total).series.map(column=>column.id),...dashboardSeries(result).incomes.map(column=>column.id),'laundry','supplies','products','other'];
    for(const concept of new Set(concepts)) {
      const detail=financialDetail(result,concept,settings);
      assert.equal(detail.rows.reduce((sum,row)=>sum+row.amount,0),detail.total,`Every ${concept} row reconciles to its clicked column`);
      assert.equal(detail.sources.reduce((sum,source)=>sum+source.amount,0),detail.total);
      assert.equal(new Set(detail.rows.map(row=>row.id)).size,detail.rows.length);
      assert.ok(!detail.rows.some(row=>['service:zero','service:missing'].includes(row.id)));
    }
    assert.equal(JSON.stringify(result),before,'Opening any detail never mutates analyzed records');
  }
  const result=analyze(services,settings,filters);
  const staff=financialDetail(result,'personal',settings);
  assert.equal(staff.total,result.total.costs.personal+result.total.costs.salary);
  assert.equal(staff.rows.filter(row=>row.direction).reduce((sum,row)=>sum+row.amount,0),236700);
  assert.equal(staff.rows.filter(row=>row.label==='Estructura').length,1);
  assert.equal(financialDetail(result,'external:Recepción',settings).rows.length,2,'Same-label external contracts show all constituent records');
  assert.equal(financialDetail(result,'revenue',settings).total,result.total.revenue);
  assert.equal(financialDetail(result,'cleaning',settings).total,10000);
  assert.equal(financialDetail(result,'supplements',settings).total,275);
  assert.equal(financialDetail(result,'cloth',settings).total,25);
  assert.equal(financialDetail(result,'laundry',settings).rows.find(row=>row.id==='service:cleaning').amount,125);
  assert.ok(financialDetail(result,'laundry',settings).rows.find(row=>row.id==='service:cleaning').description.includes('Sábana matrimonio: 2'));
  assert.equal(financialDetail(analyze(services,settings,{...filters,clients:['c']}),'personal',settings).rows.some(row=>row.direction),false);
  const adjustedSettings={...settings,adjustments:{cleaning:{minutes:{w:90},quantities:{doubleSheet:1,kitchenCloth:3,kitchenKit:0},reviewed:true}}};
  const adjusted=analyze([service],adjustedSettings,filters);
  const adjustedLabor=financialDetail(adjusted,'personal',adjustedSettings).rows.find(row=>row.id==='service:cleaning');
  assert.equal(adjustedLabor.amount,2175);assert.equal(adjustedLabor.description,'Ana: 1,5 h','Shown hours match the adjustment used in the engine');
  const adjustedLaundry=financialDetail(adjusted,'laundry',adjustedSettings).rows.find(row=>row.id==='service:cleaning');
  assert.equal(adjustedLaundry.amount,100);assert.ok(adjustedLaundry.description.includes('Sábana matrimonio: 1'));assert.ok(adjustedLaundry.description.includes('Paño de cocina: 3'),'Shown quantities match manual overrides');
  assert.equal(financialDetail(adjusted,'supplies',adjustedSettings).rows.length,0,'A cleared quantity is not shown as consumed');
  assert.equal(JSON.stringify({settings,services}),snapshot);
  console.log('financial-detail: reconciled revenue/cost/source records, direction and structure once, filters, excluded tasks, supplemental/cloth income, duplicate-label external contracts, monthly and partial periods passed');
} finally {rmSync(folder,{recursive:true,force:true});}
