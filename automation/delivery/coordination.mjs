import assert from 'node:assert/strict';

export async function waitForMergeability({snapshot,head,base,authorized,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=31}) {
  for(let i=0;i<attempts;i++) {
    const {pr,main,status}=await snapshot();
    assert(authorized(pr),'La propuesta dejó de estar autorizada');
    assert.equal(pr.head.sha,head,'La propuesta cambió durante la espera de GitHub');
    assert.equal(main,base,'Main avanzó durante la espera de GitHub; validar otra vez');
    assert.equal(status,'success','La validación vigente dejó de ser correcta');
    assert.notEqual(pr.mergeable,false,'GitHub detectó un conflicto; volver a validar la propuesta');
    if(pr.mergeable===true && pr.mergeable_state==='clean') return;
    if(i===attempts-1) throw new Error('GitHub no terminó de preparar la fusión en dos minutos; conservar la propuesta y reintentar');
    await sleep(4000);
  }
}

export function productionDecision(snapshot, commit, source, project) {
  assert.equal(snapshot.main,commit,'Main avanzó durante la espera; validar otra vez sobre la base nueva');
  const aligned=snapshot.live.length===2 && snapshot.live.every(d=>d.projectId===project && d.readyState==='READY' && d.source===source) && snapshot.live[0].id===snapshot.live[1].id;
  if(aligned) return 'ready';
  assert(snapshot.knownLive,'Producción inesperada; no se puede esperar ni sobrescribirla automáticamente');
  const target=snapshot.target;
  assert(target && target.projectId===project && target.meta?.limpatexCommit===commit && target.meta?.limpatexSourceFingerprint===source,'No hay publicación conocida en curso para esta base; reconciliar antes de publicar');
  assert(['QUEUED','INITIALIZING','BUILDING','READY'].includes(target.readyState),'La publicación anterior falló o fue cancelada; recuperar antes de nuevas entregas');
  return 'wait';
}
export async function waitForProduction({snapshot,commit,source,project,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=61,log=console.log}) {
  for(let i=0;i<attempts;i++) {
    const decision=productionDecision(await snapshot(),commit,source,project);
    if(decision==='ready') return;
    if(i===0) log('Esperando una publicación conocida de la base actual; se reintentará automáticamente durante diez minutos.');
    if(i===attempts-1) throw new Error('La publicación conocida no terminó en diez minutos; conservar la entrega y revisar la publicación anterior');
    await sleep(10000);
  }
}

export function assertManualPr(pr,owner,repository,head) {
  assert.equal(pr.user.login,owner);
  assert.equal(pr.head.repo?.full_name,repository);
  assert.equal(pr.base.ref,'main');
  assert(pr.head.ref.startsWith('codex/'));
  assert.equal(pr.head.sha,head,'La propuesta cambió después de reservar; renovar revisión y turno');
  assert(!pr.draft && (pr.state==='open' || pr.merged),'Propuesta manual cerrada o en borrador');
}
export function assertReadyRelease(pr,head,main,statuses,context) {
  assert.equal(pr.head.sha,head);
  assert(pr.merged && pr.merge_commit_sha===main,'Solo publicar el commit revisado incorporado a main');
  // Status API is newest first. An old success cannot override a newer failure.
  assert.equal(statuses.find(s=>s.context===context)?.state,'success','Falta validación vigente del código revisado');
  return main;
}
export function reservationSignal(status,owner) {
  if(!status || status.creator?.login!==owner) return null;
  if(status.state==='inactive') return {cancel:true};
  const match=/^Limpatex ready:([a-f0-9]{40})$/.exec(status.description || '');
  return status.state==='in_progress' && match ? {commit:match[1]} : null;
}
