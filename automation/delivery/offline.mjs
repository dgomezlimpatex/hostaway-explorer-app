import {spawnSync} from 'node:child_process';
export function runOffline(repo,file) {
  if(process.platform!=='linux' || process.getuid()===0) throw new Error('Las pruebas funcionales requieren runner Linux sin privilegios');
  return spawnSync('sudo',['unshare','--net','--','setpriv',`--reuid=${process.getuid()}`,`--regid=${process.getgid()}`,'--init-groups','--no-new-privs','--bounding-set=-all',process.execPath,file],{cwd:repo,encoding:'utf8',timeout:180000,maxBuffer:30e6});
}
