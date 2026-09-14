import assert from 'node:assert/strict';
import { build } from 'esbuild';

let handler;
let workers = [{id:'worker', cleanerId:'cleaner', name:'Test', sedeId:'sede'}];
const writes = [];
let now = Date.parse('2026-09-09T12:00:00Z');
Date.now = () => now;
globalThis.Deno = {serve(fn) {handler = fn;}, env:{get:() => 'test'}};
globalThis.pinTest = {
  workers:() => workers,
  db:{
    from(table) {
      const filters = [];
      const query = {
        insert(value) {writes.push({table,value});return query;},
        update() {return query;},
        eq(key,value) {filters.push(row => row[key] === value);return query;},
        gte(key,value) {filters.push(row => row[key] >= value);return query;},
        select() {return query;}, order() {return query;},
        then(resolve) {return Promise.resolve({error:null,data:writes.filter(row => row.table === table && filters.every(filter => filter(row.value))).map(row => row.value)}).then(resolve);},
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
         export const sha256 = async value => value;
         export const validateRouteSession = async () => null;`}));
  }}],
});
await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const login = (pin,ip='192.0.2.1') => handler(new Request('https://test.invalid', {method:'POST',headers:{'x-forwarded-for':ip},body:JSON.stringify({action:'login',token:'test',pin})}));
for (let attempt = 0; attempt < 9; attempt++) { assert.equal((await login('9999')).status,401); now += 30000; }
const tenth = await login('9999');
assert.equal(tenth.status,429);
assert.equal(tenth.headers.get('Retry-After'),'600');
assert.equal((await login('0119')).status,429,'Correct PIN cannot bypass cooldown');
assert.equal((await login('0119','192.0.2.2')).status,200,'Another IP is unaffected');
now += 599000;
assert.equal((await login('0119')).status,429,'Cooldown lasts ten minutes from tenth failure');
now += 1000;
assert.equal((await login('0119')).status,200,'Access resumes exactly at expiry');
for (let attempt = 0; attempt < 9; attempt++) assert.equal((await login('9999')).status,401);
assert.equal((await login('0119')).status,200,'Successful tenth attempt is allowed and resets failures');
assert.equal((await login('9999')).status,401,'Fresh counter after success');
assert.equal((await login('x')).status,400,'PIN format remains validated');
workers = [];
assert.equal((await login('0119')).status,401,'No access for workers outside the active list');
workers = [{id:'one'},{id:'two'}];
assert.equal((await login('0119')).status,409,'Duplicate PINs remain rejected');
console.log('PASS: ten failures, full ten-minute cooldown, IP isolation, exact expiry, successful login resets counter, PIN validation and active-worker restriction');
