import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const folder=mkdtempSync(join(tmpdir(),'amenities-settings-'));
try{
  const file=join(folder,'settings.cjs');
  await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
    export {mapPropertyFromDB,mapPropertyToDB} from './src/services/storage/mappers/propertyMappers';
    export {mapClientFromDB,mapClientToDB} from './src/services/storage/mappers/clientMappers';
    export {isManagedAmenityProduct,getLegacyFieldForStockProduct} from './src/components/properties/forms/propertyStockConsumption';
    export {duplicatePropertyData} from './src/components/properties/duplicatePropertyData';
    export {propertySchema} from './src/components/properties/forms/PropertyFormSchema';
    export {clientSchema} from './src/components/clients/forms/ClientFormSchema';
  `},bundle:true,platform:'node',format:'cjs',outfile:file,logLevel:'silent'});
  const api=createRequire(import.meta.url)(file);
  for(const flag of [true,false,null]){
    assert.equal(api.mapPropertyFromDB({amenities_control_enabled:flag}).amenitiesControlEnabled,flag);
    assert.deepEqual(api.mapPropertyToDB({amenitiesControlEnabled:flag}),{amenities_control_enabled:flag});
    assert.equal(api.duplicatePropertyData({amenitiesControlEnabled:flag}).amenitiesControlEnabled,flag);
  }
  for(const flag of [true,false]){
    assert.equal(api.mapClientFromDB({amenities_control_enabled:flag}).amenitiesControlEnabled,flag);
    assert.deepEqual(api.mapClientToDB({amenitiesControlEnabled:flag}),{amenities_control_enabled:flag});
  }
  assert.equal(api.mapClientFromDB({}).amenitiesControlEnabled,true,'Existing behavior preserved');
  assert.deepEqual(api.mapPropertyToDB({}),{});assert.deepEqual(api.mapClientToDB({}),{});
  for(const name of ['Kit de amenities de baño','Kit de amenities de cocina','Kit de alimentación','Paño de cocina','Paños de cocina','Bayeta de cocina'])assert.equal(api.isManagedAmenityProduct({name}),true,name);
  for(const name of ['Papel higiénico','Papel de cocina','Bolsas de basura','Sábanas matrimonio','Toallas grandes'])assert.equal(api.isManagedAmenityProduct({name}),false,name);
  assert.equal(api.getLegacyFieldForStockProduct({name:'Paño de cocina'}),'bayetasCocina');
  for(const flag of [true,false,null])assert.equal(api.propertySchema.shape.amenitiesControlEnabled.parse(flag),flag);
  for(const flag of [true,false])assert.equal(api.clientSchema.shape.amenitiesControlEnabled.parse(flag),flag);
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE clients(id text PRIMARY KEY,linen_control_enabled boolean NOT NULL DEFAULT false);CREATE TABLE properties(id text PRIMARY KEY,cliente_id text REFERENCES clients(id),amenities_bano integer NOT NULL DEFAULT 0,bayetas_cocina integer NOT NULL DEFAULT 0);ALTER TABLE clients ENABLE ROW LEVEL SECURITY;ALTER TABLE properties ENABLE ROW LEVEL SECURITY;CREATE POLICY fixture_clients ON clients USING(true);CREATE POLICY fixture_properties ON properties USING(true);INSERT INTO clients(id) VALUES('c');INSERT INTO properties VALUES('p','c',3,2);`);
    const sql=readFileSync('scripts/propertyAmenitiesSettings.sql','utf8');await db.exec(sql);
    assert.deepEqual((await db.query('SELECT amenities_control_enabled FROM clients')).rows,[{amenities_control_enabled:true}]);
    assert.deepEqual((await db.query('SELECT amenities_control_enabled,amenities_bano,bayetas_cocina FROM properties')).rows,[{amenities_control_enabled:null,amenities_bano:3,bayetas_cocina:2}]);
    await db.exec(`UPDATE clients SET amenities_control_enabled=false;UPDATE properties SET amenities_control_enabled=true;`);
    assert.equal((await db.query('SELECT amenities_control_enabled FROM clients')).rows[0].amenities_control_enabled,false);
    assert.equal((await db.query('SELECT amenities_control_enabled FROM properties')).rows[0].amenities_control_enabled,true);
    assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname IN ('clients','properties')")).rows.every(r=>r.relrowsecurity),true);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE policyname LIKE 'fixture_%'")).rows[0].n,2);
  }finally{await db.close()}
  console.log('PASS amenities settings: mappings, tri-state persistence, duplicate, schemas, precise product classification; proposed SQL in isolated Postgres preserves quantities/RLS/policies');
}finally{rmSync(folder,{recursive:true,force:true})}
