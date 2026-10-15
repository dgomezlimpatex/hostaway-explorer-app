// Offline harness for the inventory pages: real components, mocked reads and writes, no backend or session.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const data = String.raw`
const central={id:'central',name:'Simón Bolívar',is_active:true,is_default:true,location_type:'central',sort_order:0};
const buildingNames=['Orzán 12','Riazor 4','Matogrande 7','Juan Flórez 30','Ensanche 2','Monte Alto 9'];
const buildings=buildingNames.map((name,i)=>({id:'b'+i,name:'TRASTERO - '+name,is_active:true,location_type:'building_storage',property_group_id:'g'+i,sort_order:i+1}));
const warehouses=[central,...buildings];
const cat={laundry:{id:'c1',kind:'laundry',name:'Ropa'},amenity:{id:'c2',kind:'amenity',name:'Amenities'},other:{id:'c3',kind:'other',name:'Otros'}};
const p=(id,name,kind,consumable=true,unit='unidades')=>({id,name,sku:id.toUpperCase(),is_active:true,is_consumable:consumable,unit_of_measure:unit,category:cat[kind],category_id:cat[kind].id});
const products=[p('sab90','Sábanas 90','laundry'),p('sab150','Sábanas 150','laundry'),p('fundas','Fundas de almohada','laundry'),p('toag','Toallas grandes','laundry'),p('toap','Toallas pequeñas','laundry'),p('alfo','Alfombrines','laundry'),
  p('papel','Papel higiénico','amenity',true,'rollos'),p('amen','Amenities baño','amenity',true,'kits'),p('kit','Kit alimentario','amenity',true,'kits'),p('bayeta','Bayetas cocina','amenity'),
  p('edre','Edredones','laundry',false),p('prot','Protector de colchón','laundry',false),p('almo','Almohadas','other',false)];
const by=Object.fromEntries(products.map(x=>[x.id,x]));
let n=0;
const L=(w,pid,cur,min=0,target=0,extra={})=>({id:'l'+(n++),warehouse_id:w,product_id:pid,product:by[pid],warehouse:warehouses.find(x=>x.id===w),current_quantity:cur,minimum_quantity:min,target_quantity:target,cost_per_unit:pid==='sab150'?2.4:null,last_updated:'2026-10-14T16:20:00Z',quantity_basis:'registered',...extra});
const levels=[L('central','sab90',40,20,60),L('central','sab150',18,30,80,{reserved_quantity:6}),L('central','fundas',120,40,100),L('central','toag',35,40,90),L('central','toap',80,30,60),L('central','alfo',0,0,0),
  L('central','papel',240,100,300,{counted_at:'2026-10-12T09:00:00Z',quantity_basis:'counted'}),L('central','amen',22,30,60),L('central','kit',15,0,0),L('central','bayeta',-3,10,20),
  L('central','edre',6,4,8),L('central','prot',10,0,0),L('central','almo',12,6,10),
  L('b0','edre',0,1,2),L('b0','prot',2,1,2),L('b0','almo',3,0,0),L('b1','edre',1,1,2),L('b1','sab150',14,0,0),L('b2','almo',0,2,2),L('b3','prot',4,1,2),L('b5','edre',2,0,0)];
const line=(id,q)=>({productId:id,name:by[id].name,quantity:q});
const bag=(taskId,code,date,w,state,lines,issue=null)=>({taskId,propertyId:'p'+taskId,propertyCode:code,date,warehouseId:w,state,issue,lines});
const bags=[bag('t1','ORZ-1A','2026-10-15','b0','pending',[line('sab150',2),line('fundas',4),line('toag',4),line('papel',4)]),
  bag('t2','ORZ-2B','2026-10-15','b0','prepared',[line('sab150',2),line('fundas',4),line('toag',4)]),
  bag('t3','RIA-3','2026-10-15','b1','pending',[line('sab90',2),line('sab150',1),line('fundas',3),line('toag',3),line('amen',2)]),
  bag('t4','RIA-5','2026-10-16','b1','issue',[line('sab150',2),line('toag',4)],'Falta una toalla grande'),
  bag('t5','MAT-7C','2026-10-16','b2','review',[line('sab150',2)],'El contenido necesita revisión'),
  bag('t6','JFL-30','2026-10-16','b3','delivered',[line('sab150',2),line('fundas',2)]),
  bag('t7','ENS-2','2026-10-17',null,'pending',[line('sab90',4),line('toap',4),line('kit',1)]),
  ...Array.from({length:9},(_,i)=>bag('x'+i,'ORZ-'+(3+i)+'A',i<4?'2026-10-15':'2026-10-17','b0',i%3===0?'prepared':'pending',[line('sab150',2),line('fundas',2),line('toag',2),line('papel',2)]))];
const movementTypes=['entrada','salida','ajuste','consumo_automatico','transferencia'];
const movements=Array.from({length:36},(_,i)=>{const lv=levels[i%levels.length];const type=movementTypes[i%5];return {id:'m'+i,product_id:lv.product_id,warehouse_id:lv.warehouse_id,to_warehouse_id:type==='transferencia'?'b0':null,movement_type:type,quantity:(i%7)+1,previous_quantity:20+i,new_quantity:type==='entrada'?21+i+(i%7):19+i-(i%7),reason:type==='consumo_automatico'?'Consumo estimado tras fin previsto de limpieza':type==='ajuste'?'Recuento físico 12/10/2026':type==='transferencia'?'Reposición del trastero':type==='entrada'?'Recepción 2026-10-14 v1':'Rotura',created_at:new Date(Date.parse('2026-10-14T18:00:00Z')-i*3600e3*5).toISOString(),product:lv.product,warehouse:lv.warehouse,to_warehouse:type==='transferencia'?buildings[0]:null};});
`;

const workspace = String.raw`
import {buildingInventory,pendingDemand} from '@/features/inventory/inventoryDomain';
` + data + String.raw`
export const fixture={warehouses,products,levels,bags,movements};
export const useInventoryWorkspace=(days=3)=>{
  const err=window.fixtureError;
  const demandReady=!err;
  const shown=bags.filter(b=>days===1?b.date==='2026-10-15':days===3?b.date<='2026-10-17':true);
  return {central:window.fixtureNoCentral?null:central,warehouses,products,levels,bags:shown,centralLevels:levels.filter(l=>l.warehouse_id==='central'),
    buildings:buildingInventory(warehouses,levels,demandReady?shown:[],'central'),demand:demandReady?pendingDemand(shown):new Map(),
    from:'2026-10-15',to:days===1?'2026-10-15':days===7?'2026-10-21':'2026-10-17',
    stockError:err==='stock',stockLoading:err==='loading',demandError:err==='demand',demandReady,
    settings:{preparation_mode:true,auto_consumption_enabled:false},settingsError:false,cycleActive:false,bagAccounting:window.fixtureBagAccounting?{active:true,config:{central_id:'central'}}:{active:false},
    updatedAt:Date.parse('2026-10-15T08:42:00Z'),isFetching:false,
    refresh:()=>{window.retries=(window.retries||0)+1;return Promise.resolve();}};
};
`;

const useStock = String.raw`
import {fixture} from '@/features/inventory/useInventoryWorkspace';
const q=data=>({data,isLoading:window.fixtureError==='loading',isError:window.fixtureError==='stock',refetch:()=>{window.retries=(window.retries||0)+1;return Promise.resolve();}});
const mutation=name=>()=>{const run=async v=>{(window.writes=window.writes||[]).push({name,v});if(window.failWrites){const {toast}=await import('sonner');toast.error('No se pudo guardar: conexión perdida');throw new Error('Fallo simulado');}const {toast}=await import('sonner');toast.success('Guardado');return {};};return {mutate:v=>{run(v).catch(()=>{});},mutateAsync:run,isPending:false};};
export const useStockWarehouses=()=>q(fixture.warehouses);
export const useStockLevels=()=>q(fixture.levels);
export const useStockProducts=()=>q(fixture.products);
export const useStockCategories=()=>q([{id:'c1',kind:'laundry',name:'Ropa',is_active:true},{id:'c2',kind:'amenity',name:'Amenities',is_active:true},{id:'c3',kind:'other',name:'Otros',is_active:true}]);
export const useStockMovements=()=>q(fixture.movements);
export const useStockMovementsRange=()=>q({movements:fixture.movements,truncated:false});
export const useStockSedeSettings=()=>q({preparation_mode:true,auto_consumption_enabled:false});
export const useSedeStockConsumptionRules=()=>q([]);
export const useSelectedStockWarehouse=()=>({warehouses:fixture.warehouses,selectedWarehouseId:'central',setSelectedWarehouseId:()=>{}});
export const useAdjustStock=mutation('adjust');
export const useTransferStock=mutation('transfer');
export const useUpdateStockLevelSettings=mutation('settings');
export const useCreateStockProduct=mutation('createProduct');
export const useUpdateStockProduct=mutation('updateProduct');
export const useDeleteStockProduct=mutation('deleteProduct');
export const useUpdateStockSedeSettings=mutation('sedeSettings');
`;

const mocks = {
  '@/features/inventory/useInventoryWorkspace': workspace,
  '@/hooks/useStock': useStock,
  './provisionalInventoryReads': `export async function readProvisionalInventory(){return {movements:[],preparations:[],mappings:[],estimates:[],levels:[]};}`,
  './inventoryReadiness': `export async function readInventoryBags(){return [];}export async function readAll(){return [];}`,
  '@/contexts/SedeContext': `export const useSede=()=>({activeSede:{id:'sede',nombre:'Coruña'}});`,
  '@/hooks/useAuth': `export const useAuth=()=>({user:{id:'u1'}});`,
  '@/hooks/useRolePermissions': `export const useRolePermissions=()=>({hasPermission:()=>window.fixtureRole!=='reader',isAdminOrManager:()=>!['supervisor','reader'].includes(window.fixtureRole)});`,
  '@/hooks/useProperties': `export const useProperties=()=>({data:[]});`,
  '@/components/sede/SedeSelector': `export const SedeSelector=()=><span className="text-sm text-muted-foreground">Coruña</span>;`,
  '@/components/stock/WarehouseSettings': `export default ()=><p>Gestión de ubicaciones</p>;`,
  '@/components/stock/LaundryCycleSetup': `export default ()=>null;`,
  '@/components/stock/BagAccountingSetup': `export default ()=>null;`,
  '@/services/stockBagAccounting': `export const readPendingBagOperation=()=>null;export const readBagAccounting=async()=>({active:false});`,
  '@/services/storage/stockStorage': `export const stockStorage={adjustStock:async v=>{(window.writes=window.writes||[]).push({name:'count',v});if(window.failWrites) throw new Error('Fallo simulado');}};`,
};

export async function buildInventoryFixture() {
  const entry = String.raw`
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {Toaster} from 'sonner';
import Dashboard from './src/pages/InventoryDashboard';import Stock from './src/pages/InventoryStock';import Buildings from './src/pages/InventoryWarehouses';
import Preparation from './src/pages/InventoryPreparation';import Movements from './src/pages/InventoryMovements';import Reports from './src/pages/InventoryReports';import Config from './src/pages/InventoryConfig';
function Where(){const l=useLocation();return <output aria-label="Ubicación actual" hidden>{l.pathname+l.search}</output>;}
const root=createRoot(document.getElementById('root'));
window.renderFixture=()=>root.render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter key={Math.random()} initialEntries={[window.fixturePath||'/inventory']}><Where/><Routes>
<Route path='/inventory' element={<Dashboard/>}/><Route path='/inventory/stock' element={<Stock/>}/><Route path='/inventory/laundry' element={<Stock kind='laundry'/>}/>
<Route path='/inventory/warehouses' element={<Buildings/>}/><Route path='/inventory/preparation' element={<Preparation/>}/><Route path='/inventory/movements' element={<Movements/>}/>
<Route path='/inventory/reports' element={<Reports/>}/><Route path='/inventory/config' element={<Config/>}/><Route path='*' element={<p>Otra pantalla</p>}/>
</Routes></MemoryRouter><Toaster position="top-center"/></QueryClientProvider>);
window.renderFixture();`;
  const built = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', metafile: true, loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'offline', setup(b) { b.onResolve({ filter: /.*/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: 'fixture' } : null); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() })); } }] });
  const backend = Object.entries(built.metafile.inputs).filter(([, v]) => v.imports.some(i => i.path.includes("integrations/supabase"))).map(([k]) => k);
  assert.deepEqual(backend, [], "No backend or session in fixture");
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^\s*@import\s+"@fontsource\/[^"\n]+";\s*$/gm, '') + readFileSync('src/components/stock/inventory.css', 'utf8');
  const { css } = await postcss([tailwindcss('tailwind.config.ts'), autoprefixer]).process(cssSource, { from: 'src/index.css' });
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
