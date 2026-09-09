import assert from 'node:assert/strict';
import { build } from 'esbuild';

let handler;
let workers = [{id:'worker', cleanerId:'cleaner', name:'Test', sedeId:'sede'}];
const writes = [];
globalThis.Deno = {serve(fn) {handler = fn;}, env:{get:() => 'test'}};
globalThis.pinTest = {
  workers:() => workers,
  db:{
    from(table) {
      const query = {
        insert(value) {writes.push({table,value});return query;},
        update() {return query;}, eq() {return query;},
        select() {throw new Error('Login must not consult prior attempt counts');},
        then(resolve) {return Promise.resolve({error:null}).then(resolve);},
      };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, 'verify_laundry_route_worker_pin');
      return {data:args._pin === '0119',error:null};
    },
  },
};
const compiled = await build({
  entryPoints:['supabase/functions/laundry-route-access/index.ts'], bundle:true, write:false, format:'esm', platform:'node',
  plugins:[{name:'isolated-access',setup(builder) {
    builder.onResolve({filter:/^npm:/}, () => ({path:'client',namespace:'mock'}));
    builder.onResolve({filter:/laundryRouteAccess\.ts$/}, () => ({path:'access',namespace:'mock'}));
    builder.onLoad({filter:/.*/,namespace:'mock'}, ({path}) => ({contents:path === 'client'
      ? 'export const createClient = () => globalThis.pinTest.db;'
      : `export const getRouteLink = async () => ({link:{id:'link',sede_id:'sede'}});
         export const listActiveRouteWorkers = async () => globalThis.pinTest.workers();
         export const sha256 = async () => 'test-fingerprint';
         export const validateRouteSession = async () => null;`}));
  }}],
});
await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const login = pin => handler(new Request('https://test.invalid', {method:'POST',body:JSON.stringify({action:'login',token:'test',pin})}));
for (let attempt = 0; attempt < 20; attempt++) assert.equal((await login('9999')).status,401);
assert.equal((await login('0119')).status,200,'Correct PIN works immediately after repeated failures');
assert.equal(writes.filter(row => row.table === 'laundry_route_sessions').length,1,'Failed PINs never create sessions');
assert.equal(writes.filter(row => row.table === 'laundry_route_access_attempts').length,21,'Attempt audit remains enabled');
assert.equal((await login('x')).status,400,'PIN format remains validated');
workers = [];
assert.equal((await login('0119')).status,401,'No access for workers outside the active list');
workers = [{id:'one'},{id:'two'}];
assert.equal((await login('0119')).status,409,'Duplicate PINs remain rejected');
console.log('PASS: unlimited retries, immediate successful login, PIN validation, active-worker restriction, duplicate protection, audit retained');
