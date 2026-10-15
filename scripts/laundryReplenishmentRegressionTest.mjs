import {readFile,writeFile,unlink}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import{execFileSync}from'node:child_process';
const root=new URL('./',import.meta.url),migration=new URL('../supabase/migrations/20261015173000_laundry_replenishment_start.sql',import.meta.url);
for(const [file,factory,isFull]of [['laundryCompleteCycleTest.mjs','completeCycleDatabase',true],['laundryCompleteCycleBoundariesTest.mjs','completeCycleDatabase',true],['stockBagAccountingTest.mjs','stockBagDatabase',false],['stockBagAccountingBoundariesTest.mjs','stockBagDatabase',false]]){
 let code=await readFile(new URL(file,root),'utf8');
 const old="import {"+factory+"} from './"+(isFull?'laundryCompleteCycleTestSupport.mjs':'stockBagAccountingTestSupport.mjs')+"';";
 const replacement="import {stockBagDatabase as originalFactory} from '"+new URL('stockBagAccountingTestSupport.mjs',root).href+"';\nimport{readFile as loadPatch}from'node:fs/promises';\nasync function "+factory+"(){const t=await originalFactory();await t.db.exec(await loadPatch(new URL('"+migration.href+"'),'utf8'));"+(isFull?"return {...t,activate:()=>t.rpc('activate_laundry_cycle_checked',{_sede:t.sede})};":"return t;")+"}\n";
 if(!code.includes(old))throw Error('Import not found in '+file);
 code=code.replace(old,replacement);
 const temp=join(tmpdir(),'limpatex-replenishment-'+file);
 await writeFile(temp,code);
 try{const out=execFileSync(process.execPath,[temp],{encoding:'utf8',timeout:120000,stdio:'pipe'});process.stdout.write(out);}catch(e){console.error(e.stdout??'',String(e.stderr??'').slice(-2500));process.exitCode=1;break;}finally{await unlink(temp);}
}

