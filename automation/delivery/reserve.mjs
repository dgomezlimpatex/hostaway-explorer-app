import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertManualPr,assertReadyRelease} from './coordination.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url)));
const creds=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const token=creds.split('\n').find(x=>x.startsWith('password='))?.slice(9);
if(!token) throw new Error('Falta autenticación GitHub');
async function gh(endpoint,method='GET',body) {
  const response=await fetch(`https://api.github.com/repos/${cfg.repository}${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const text=await response.text();if(!response.ok) throw new Error(`GitHub ${response.status} ${endpoint}`);
  return text?JSON.parse(text):null;
}
const [action,file,arg,authorizationFile]=process.argv.slice(2);
if(!['start','check','ready','cancel','reconcile'].includes(action) || !file) throw new Error('Uso: reserve.mjs start fichero-reserva.json PR autorización.txt | check/ready/cancel fichero-reserva.json | reconcile fichero-reserva.json informe.md');
if(action==='start') {
  if(fs.existsSync(file)) throw new Error('No sobrescribir una reserva existente');
  const number=Number(arg),pr=await gh(`/pulls/${number}`),authorization=fs.readFileSync(authorizationFile,'utf8').trim();
  assertManualPr(pr,cfg.owner,cfg.repository,pr.head.sha);
  if(pr.merged || authorization.length<20 || authorization.length>500) throw new Error('Reservar PR abierta con autorización específica de Dani');
  const claim=crypto.randomUUID();
  // Save before dispatch so an uncertain response can be reconciled without duplicate runs.
  const record={claim,number,head:pr.head.sha};fs.writeFileSync(file,JSON.stringify(record,null,2));
  await gh('/actions/workflows/limpatex-reviewed-release.yml/dispatches','POST',{ref:'main',inputs:{pr_number:String(number),head_sha:pr.head.sha,claim,authorization}});
  console.log('Reserva solicitada. Usar check hasta que indique active; no tocar producción antes.');
} else {
  const record=JSON.parse(fs.readFileSync(file,'utf8'));
  let reservation;
  // Pagination finds this claim even when many parallel conversations requested turns.
  for(let page=1;page<=10;page++) {
    const list=await gh(`/deployments?environment=limpatex-release-reservation&per_page=100&page=${page}`);
    reservation=list.find(d=>d.payload?.claim===record.claim && d.payload?.kind==='limpatex-manual-v1');
    if(reservation || list.length<100) break;
  }
  if(!reservation) {
    if(action==='check') {
      const runs=await gh('/actions/workflows/limpatex-reviewed-release.yml/runs?event=workflow_dispatch&per_page=100');
      const run=runs.workflow_runs.find(r=>r.display_title?.includes(record.claim));
      if(run?.status==='completed') throw new Error(`La reserva terminó sin conceder turno: ${run.conclusion}. Revisar ${run.html_url}`);
      console.log(JSON.stringify({state:'waiting',run:run?.html_url,instruction:'No tocar producción. La cola aún no ha concedido el turno.'}));process.exit(0);
    }
    throw new Error('Turno no concedido');
  }
  const p=reservation.payload,statuses=await gh(`/deployments/${reservation.id}/statuses`),latest=statuses[0];
  if(action==='reconcile') {
    const run=await gh(`/actions/runs/${p.runId}`);
    if(run.status!=='completed' || !['failure','error','in_progress','inactive'].includes(latest?.state)) throw new Error('Solo reconciliar una reserva interrumpida cuyo workflow haya terminado');
    const report=fs.readFileSync(arg,'utf8').trim();
    if(report.length<80) throw new Error('Registrar revisión de backend, GitHub y Vercel y resolución de efectos parciales');
    // Keep the report in the local audit and record its hash without operational data.
    const digest=crypto.createHash('sha256').update(report).digest('hex');
    fs.writeFileSync(file,JSON.stringify({...record,reconciliation:{report:arg,digest}},null,2));
    await gh(`/deployments/${reservation.id}/statuses`,'POST',{state:'inactive',description:'Reconciliado: '+digest,auto_inactive:false});
    console.log('Reconciliación registrada. Las verificaciones de producción siguen activas.');process.exit(0);
  }
  if(action==='cancel') {
    if(latest?.description!=='Limpatex reservation active') throw new Error('No cancelar una publicación que ya está en marcha o cerrada');
    await gh(`/deployments/${reservation.id}/statuses`,'POST',{state:'inactive',description:'Conversación canceló la reserva sin publicar',auto_inactive:false});console.log('Reserva cancelada');process.exit(0);
  }
  const run=await gh(`/actions/runs/${p.runId}`);
  if(p.head!==record.head || p.number!==record.number || p.expiresAt<=Date.now() || run.status!=='in_progress' || latest?.state!=='in_progress' || latest.description!=='Limpatex reservation active') throw new Error('Reserva no activa o vencida; detener operaciones y revisar estado');
  const pr=await gh(`/pulls/${record.number}`);assertManualPr(pr,cfg.owner,cfg.repository,record.head);
  const main=(await gh('/git/ref/heads/main')).object.sha;
  if(main!==p.base && !(pr.merged && main===pr.merge_commit_sha)) throw new Error('Main cambió por otra entrega');
  if(action==='ready') {
    const checked=(await gh(`/commits/${record.head}/status`)).statuses;
    assertReadyRelease(pr,record.head,main,checked,cfg.statusContext);
    await gh(`/deployments/${reservation.id}/statuses`,'POST',{state:'in_progress',description:`Limpatex ready:${main}`,auto_inactive:false});
    console.log('Publicación revisada entregada a la cola. No desplegar Vercel desde este chat.');
  } else console.log(JSON.stringify({state:'active',reservation:reservation.id,base:p.base,head:p.head,expiresAt:p.expiresAt,run:run.html_url,instruction:'Turno concedido. Comprobar otra vez antes de cada operación productiva; conservar autorización específica.'}));
}
