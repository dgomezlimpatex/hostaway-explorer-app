// Exercise the real service and mapper with a read-only synthetic backend.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const baseline=process.argv.includes('--baseline');
const source=readFileSync('src/services/storage/mappers/propertyMappers.ts','utf8').split('export const mapPropertyToDB')[0];
const mapped=[...new Set([...source.matchAll(/row\.([a-z_]+)/g)].map(m=>m[1]))].filter(f=>f!=='clients');
const unused=['jabon_liquido','gel_ducha','champu','acondicionador','papel_higienico','ambientador_bano','desinfectante_bano','aceite','sal','azucar','vinagre','detergente_lavavajillas','limpiacristales','estropajos','papel_cocina','sede_id','avantio_accommodation_id','avantio_accommodation_name','default_stock_warehouse_id'];
const state={rows:[],reads:[],sede:'site-a',error:null};globalThis.directoryProjectionFixture=state;
const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>state.sede?JSON.stringify({id:state.sede}):null}});
try {
  const built=await build({stdin:{contents:"export {propertyStorage} from './src/services/storage/propertyStorage';export {mapPropertyFromDB} from './src/services/storage/mappers/propertyMappers';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',metafile:true,plugins:[{name:'directory-fixtures',setup(b){
    b.onResolve({filter:/integrations\/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`const s=globalThis.directoryProjectionFixture;export const supabase={from(table){const read={table,filters:{}};const q={select(selection){read.selection=selection;return q},eq(k,v){read.filters[k]=v;return q},order(field,options){read.order={field,...options};return q},then(resolve,reject){s.reads.push(read);const prefix=read.selection.split('clients:')[0];const fields=prefix.split(',').map(x=>x.trim()).filter(Boolean);return Promise.resolve({error:s.error,data:s.rows.filter(r=>!read.filters.sede_id||r.sede_id===read.filters.sede_id).map(row=>prefix.includes('*')?row:Object.fromEntries([...fields.map(f=>[f,row[f]]),['clients',row.clients]]))}).then(resolve,reject)}};return q}};`,loader:'js'}));
    b.onResolve({filter:/services\/aiObservedEvents$/},()=>({path:'events',namespace:'events'}));
    b.onLoad({filter:/.*/,namespace:'events'},()=>({contents:"export const recordAiObservedEvent=()=>{throw Error('Unexpected write')}",loader:'js'}));
    if(baseline)b.onLoad({filter:/storage[\\/]propertyStorage\.ts$/},()=>({contents:execFileSync('git',['show','5c6940189d0d9dfae06caa4b295e2c0d53d1a93d:src/services/storage/propertyStorage.ts'],{encoding:'utf8'}),loader:'ts'}));
  }}]});
  assert(!Object.keys(built.metafile.inputs).some(p=>p.endsWith('integrations/supabase/client.ts')));
  const {propertyStorage,mapPropertyFromDB}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  for(const value of [null,0,false,'sample']) for(const clients of [null,{nombre:'Client',is_active:false,linen_control_enabled:false},[{nombre:'Client',is_active:true,linen_control_enabled:null}]]) {
    const row={...Object.fromEntries([...mapped,...unused].map(f=>[f,value])),id:'p1',sede_id:'site-a',clients};
    state.rows=[row,{...row,id:'other-site',sede_id:'site-b'}];
    const result=await propertyStorage.getAll();assert.deepEqual(result,[mapPropertyFromDB(row)],'Every mapped field and client inheritance must remain identical');
  }
  const read=state.reads.at(-1),selected=read.selection.split('clients:')[0].split(',').map(s=>s.trim()).filter(Boolean);
  assert.deepEqual(read.filters,{sede_id:'site-a'});assert.deepEqual(read.order,{field:'created_at',ascending:false});
  assert.match(read.selection,/clients:cliente_id\s*\(\s*nombre,\s*is_active,\s*linen_control_enabled\s*\)/);
  if(!baseline) {
    assert.deepEqual([...selected].sort(),[...mapped].sort(),'New mapper fields must be added to the projection');
    const accesses=new Set();mapPropertyFromDB(new Proxy({clients:null},{get:(row,key)=>{if(typeof key==='string')accesses.add(key);return row[key]}}));
    assert([...accesses].every(f=>f==='clients'||selected.includes(f)),'Runtime mapper reads are covered');
  }
  console.log(JSON.stringify({propertiesColumns:baseline?mapped.length+unused.length:selected.length,clientRelationColumns:3,mappedPropertyFields:Object.keys(mapPropertyFromDB(state.rows[0])).length,queriesPerLoad:1}));
  state.sede='site-b';assert.equal((await propertyStorage.getAll())[0].id,'other-site','New site is read fresh');
  state.rows=[];assert.deepEqual(await propertyStorage.getAll(),[]);
  state.error=new Error('Simulated read error');await assert.rejects(propertyStorage.getAll(),/Simulated read error/);
  console.log('PASS real list service: all mapped values identical, null/zero/false and client inheritance, site filter, order, fresh calls, empty/error; no writes or production client');
}finally{
  if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;
  delete globalThis.directoryProjectionFixture;
}
