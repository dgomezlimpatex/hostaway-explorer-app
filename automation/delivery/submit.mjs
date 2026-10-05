import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {verifyDelivery} from './scope.mjs';
const config=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url)));
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:30e6}).trim();
const title=process.argv[2];
const bodyFile=process.argv[3];
if(!title || !bodyFile) throw new Error('Uso: node automation/delivery/submit.mjs "Título" ruta-del-resumen.md');
if(git(['status','--porcelain'])) throw new Error('Confirmar solo los archivos propios y conservar el resto antes de entregar. El worktree debe quedar limpio.');
const branch=git(['branch','--show-current']);
if(!branch.startsWith('codex/')) throw new Error('Entregar desde una rama codex/ propia de este chat');
if(git(['remote','get-url','origin'])!==`https://github.com/${config.repository}.git`) throw new Error('Remoto inesperado');
git(['fetch','origin','main']);
const ancestor=git(['merge-base','origin/main','HEAD']);
const delivery=verifyDelivery(process.cwd(),ancestor,'HEAD');
const creds=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const password=creds.split('\n').find(x=>x.startsWith('password='))?.slice(9);
if(!password) throw new Error('Falta autenticación GitHub');
const headers={Authorization:`Bearer ${password}`,Accept:'application/vnd.github+json','Content-Type':'application/json'};
async function api(endpoint,method='GET',body){
  const r=await fetch(`https://api.github.com/repos/${config.repository}${endpoint}`,{method,headers,body:body?JSON.stringify(body):undefined});
  if(!r.ok) throw new Error(`GitHub ${r.status}: ${endpoint}`);
  return r.status===204?null:r.json();
}
git(['push','--set-upstream','origin',branch]);
const existing=await api(`/pulls?state=open&head=${config.owner}:${encodeURIComponent(branch)}&base=main`);
const body=fs.readFileSync(bodyFile,'utf8').trim()+`\n\nDelivery-Scope: ${delivery.scope}\n`;
const pr=existing[0] || await api('/pulls','POST',{title,body,base:'main',head:branch,draft:false});
if(existing[0]) await api(`/pulls/${pr.number}`,'PATCH',{title,body});
await api(`/issues/${pr.number}/labels`,'POST',{labels:[config.label]});
// workflow_dispatch explicitly starts a run even when an API token suppressed an event.
await api('/actions/workflows/limpatex-delivery.yml/dispatches','POST',{ref:'main',inputs:{pr_number:String(pr.number),dry_run:'false'}});
console.log(JSON.stringify({pr:pr.html_url,number:pr.number,state:'queued',instruction:'Adjuntar esta PR al chat con attach_artifact. La publicación continúa en GitHub Actions.'}));
