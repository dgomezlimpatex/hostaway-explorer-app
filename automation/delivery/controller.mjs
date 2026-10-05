import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {fingerprint} from './guard.mjs';
import {waitForProduction,waitForMergeability,assertManualPr,assertReadyRelease,reservationSignal} from './coordination.mjs';

const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
const command = process.argv[2];
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const github = `https://api.github.com/repos/${config.repository}`;
export function eligible(pr, cfg = config) {
  return pr.state === 'open' && !pr.draft && pr.user.login === cfg.owner && pr.base.ref === cfg.baseBranch
    && pr.head.repo?.full_name === cfg.repository && pr.head.ref.startsWith('codex/')
    && pr.labels.some(label => [cfg.label, 'limpatex:auto-presentation'].includes(label.name))
    && /(?:^|\n)Delivery-Scope: (?:presentation|application)(?:\r?\n|$)/.test(pr.body || '');
}
export function assertProduction(deployments, baseFingerprint, cfg = config) {
  for (const d of deployments) {
    assert.equal(d.projectId, cfg.projectId, 'Proyecto de producción inesperado');
    assert.equal(d.readyState, 'READY', 'Producción no está READY');
    const live = d.meta?.limpatexSourceFingerprint || (d.id === cfg.initialDeployment ? cfg.initialFingerprint : null);
    assert.equal(live, baseFingerprint, 'Producción cambió fuera de la cola; reconciliar su fuente antes de publicar');
  }
  assert.equal(deployments[0].id, deployments[1].id, 'Los dominios sirven versiones distintas');
}
export function assertTransition(deployments, expected, baseFingerprint, commit, sourceFingerprint, cfg = config) {
  assert.equal(expected.projectId,cfg.projectId); assert.equal(expected.readyState,'READY');
  assert.equal(expected.meta?.limpatexCommit,commit); assert.equal(expected.meta?.limpatexSourceFingerprint,sourceFingerprint);
  if(deployments.every(d=>d.id!==expected.id)) return assertProduction(deployments,baseFingerprint,cfg);
  for(const d of deployments){
    if(d.id===expected.id){ assert.equal(d.projectId,cfg.projectId); assert.equal(d.readyState,'READY'); }
    else assertProduction([d,d],baseFingerprint,cfg);
  }
}
export function entryAssets(html) {
  return [...html.matchAll(/(?:src|href)="([^" ]*\/assets\/[^" ]+\.(?:js|css))"/g)].map(m=>m[1]);
}
export async function verifyPage(domain, http=fetch) {
  const response=await http('https://'+domain,{cache:'no-store',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200);
  const assets=entryAssets(await response.text());
  assert(assets.length>=2,'Faltan assets de la aplicación');
  for(const asset of assets) {
    const loaded=await http(new URL(asset,'https://'+domain),{signal:AbortSignal.timeout(30000)});
    assert.equal(loaded.status,200);
    // Drain each body: leaving large bundles unread can keep the process alive.
    await loaded.arrayBuffer();
  }
  return assets.sort().join('\n');
}
export function cachedFileHashes(nodes) {
  const hashes=new Set();
  for(const node of nodes){
    if(node.type==='file' && /^[a-f0-9]{40}$/.test(node.uid || '')) hashes.add(node.uid);
    for(const hash of cachedFileHashes(node.children || [])) hashes.add(hash);
  }
  return hashes;
}
async function request(url, method = 'GET', body, token = process.env.GH_TOKEN) {
  const response = await fetch(url, {method, headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined,signal:AbortSignal.timeout(30000)});
  const text = await response.text();
  if (!response.ok) throw new Error(`API ${method} ${new URL(url).pathname}: ${response.status} ${text.slice(0,300)}`);
  return text ? JSON.parse(text) : null;
}
const gh = (endpoint, method, body) => request(github + endpoint, method, body);
const vc = (endpoint, method = 'GET', body) => request('https://api.vercel.com' + endpoint + `?teamId=${config.teamId}`, method, body, process.env.VERCEL_TOKEN);
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], {encoding:'utf8', maxBuffer:30e6}).trim();
function output(key, value) { fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); }
async function live() { return Promise.all(config.domains.map(d => vc(`/v13/deployments/${d}`))); }
async function currentMain() { return (await gh(`/git/ref/heads/${config.baseBranch}`)).object.sha; }
async function assertManualReleasesClosed() {
  for(let page=1;page<=10;page++) {
    const markers=await gh(`/deployments?environment=limpatex-release-reservation&per_page=100&page=${page}`);
    for(const marker of markers.filter(m=>m.payload?.kind==='limpatex-manual-v1')) {
      const latest=(await gh(`/deployments/${marker.id}/statuses`))[0];
      assert(['success','inactive'].includes(latest?.state),`Reserva manual ${marker.id} sin cerrar correctamente; revisar backend, GitHub y Vercel antes de nuevas entregas`);
    }
    if(markers.length<100) return;
  }
  throw new Error('Demasiadas reservas para comprobar: revisar el historial antes de publicar');
}
async function awaitProduction(repo,main) {
  const desired=fingerprint(repo),sources=new Map([[main,desired]]);
  async function known(d) {
    if(d.projectId!==config.projectId || d.readyState!=='READY') return false;
    if(d.id===config.initialDeployment && !d.meta?.limpatexSourceFingerprint) return true;
    const commit=d.meta?.limpatexCommit;
    if(!/^[a-f0-9]{40}$/.test(commit || '')) return false;
    try {
      git(repo,['fetch','origin',commit]);git(repo,['merge-base','--is-ancestor',commit,main]);
      if(!sources.has(commit)) {
        try {git(repo,['checkout','--detach',commit]);sources.set(commit,fingerprint(repo));}
        finally {git(repo,['checkout','--detach',main]);}
      }
      return sources.get(commit)===d.meta?.limpatexSourceFingerprint;
    } catch {return false;}
  }
  await waitForProduction({commit:main,source:desired,project:config.projectId,snapshot:async()=>{
    const deployments=await live();
    const items=deployments.map(d=>({...d,source:d.meta?.limpatexSourceFingerprint || (d.id===config.initialDeployment?config.initialFingerprint:null)}));
    if(items.every(d=>d.source===desired) && items[0].id===items[1].id) return {main:await currentMain(),live:items};
    let knownLive=true;
    for(const d of deployments) if(!await known(d)) knownLive=false;
    if(!knownLive) return {main:await currentMain(),live:items,knownLive:false};
    const list=await request(`https://api.vercel.com/v6/deployments?projectId=${config.projectId}&teamId=${config.teamId}&limit=20`,'GET',undefined,process.env.VERCEL_TOKEN);
    const latest=list.deployments.find(d=>d.meta?.limpatexCommit===main && d.meta?.limpatexSourceFingerprint===desired);
    const target=latest?await vc(`/v13/deployments/${latest.uid}`):null;
    return {main:await currentMain(),live:items,knownLive,target};
  }});
}
async function select() {
  await assertManualReleasesClosed();
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
  const number = Number(event.inputs?.pr_number || event.pull_request?.number || 0);
  // A recovery/manual dispatch without a PR checks configuration and does not publish.
  if (!number) {
    const repo=path.join(workspace,'control');
    const main=await currentMain();git(repo,['fetch','origin',main]);git(repo,['checkout','--detach',main]);
    await awaitProduction(repo,main);
    output('eligible', 'false');
    console.log('Conexiones y base de producción verificadas. Sin PR: no hay publicación.');
    return;
  }
  const pr = await gh(`/pulls/${number}`);
  if (!eligible(pr)) { output('eligible', 'false'); console.log('Propuesta sin autorización automática de presentación.'); return; }
  const main = await currentMain();
  const repo = path.join(workspace, 'control');
  git(repo, ['fetch', 'origin', main]);
  git(repo, ['checkout', '--detach', main]);
  await awaitProduction(repo,main);
  const latest=await gh(`/pulls/${number}`);
  if(!eligible(latest)) {output('eligible','false');return;}
  assert.equal(latest.head.sha,pr.head.sha,'La propuesta cambió durante la espera; reintentar su versión nueva');
  output('eligible', 'true'); output('number', number); output('head', pr.head.sha); output('base', main);
}
async function manualHold() {
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
  const input=event.inputs;
  assert.equal(process.env.GITHUB_ACTOR,config.owner,'Solo Dani puede reservar una entrega revisada');
  assert.match(input.claim,/^[a-f0-9-]{36}$/);
  assert.match(input.head_sha,/^[a-f0-9]{40}$/);
  assert(typeof input.authorization==='string' && input.authorization.trim().length>=20 && input.authorization.length<=500,'Registrar autorización específica sin secretos');
  const number=Number(input.pr_number),pr=await gh(`/pulls/${number}`);
  assertManualPr(pr,config.owner,config.repository,input.head_sha);
  assert(!pr.merged,'Reservar antes de incorporar o tocar producción');
  await assertManualReleasesClosed();
  const repo=path.join(workspace,'control'),main=await currentMain();
  git(repo,['fetch','origin',main]);git(repo,['checkout','--detach',main]);await awaitProduction(repo,main);
  git(repo,['fetch','origin',input.head_sha]);
  git(repo,['merge-base','--is-ancestor',main,input.head_sha]);
  const reviewedStatuses=(await gh(`/commits/${input.head_sha}/status`)).statuses;
  assert.equal(reviewedStatuses.find(s=>s.context===config.statusContext)?.state,'success','Revisar y validar el commit exacto antes de reservar');
  const reviewedChecks=(await gh(`/commits/${input.head_sha}/check-runs`)).check_runs;
  assert.equal(reviewedChecks.find(c=>c.name==='delivery-checks')?.conclusion,'success','Faltan comprobaciones vigentes de la propuesta revisada');
  const source=fingerprint(repo),expiresAt=Date.now()+30*60*1000;
  const reservation=await gh('/deployments','POST',{ref:main,auto_merge:false,required_contexts:[],environment:'limpatex-release-reservation',transient_environment:true,production_environment:false,payload:{kind:'limpatex-manual-v1',claim:input.claim,number,head:input.head_sha,base:main,source,expiresAt,runId:process.env.GITHUB_RUN_ID,authorization:input.authorization}});
  output('reservation',reservation.id);
  const url=`https://github.com/${config.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  await gh(`/deployments/${reservation.id}/statuses`,'POST',{state:'in_progress',description:'Limpatex reservation active',log_url:url,auto_inactive:false});
  console.log(`Turno manual ${reservation.id} disponible durante treinta minutos. No concede permisos adicionales.`);
  while(Date.now()<expiresAt) {
    const statuses=await gh(`/deployments/${reservation.id}/statuses`);
    const signal=reservationSignal(statuses[0],config.owner);
    if(signal?.cancel) throw new Error('La conversación canceló la reserva manual');
    if(signal?.commit) {
      const current=await gh(`/pulls/${number}`),head=current.head.sha;
      assertManualPr(current,config.owner,config.repository,input.head_sha);
      const currentMainSha=await currentMain();
      const checks=(await gh(`/commits/${head}/status`)).statuses;
      assertReadyRelease(current,input.head_sha,currentMainSha,checks,config.statusContext);
      assert.equal(currentMainSha,signal.commit);
      git(repo,['fetch','origin',currentMainSha]);
      // Inspect source without replacing the trusted control scripts for later steps.
      let targetSource;
      try {git(repo,['checkout','--detach',currentMainSha]);targetSource=fingerprint(repo);}
      finally {git(repo,['checkout','--detach',main]);}
      assertProduction(await live(),source);
      output('commit',currentMainSha);output('fingerprint',targetSource);output('productionFingerprint',source);
      return;
    }
    const current=await gh(`/pulls/${number}`);assertManualPr(current,config.owner,config.repository,input.head_sha);
    const actualMain=await currentMain();
    assert(actualMain===main || current.merged && actualMain===current.merge_commit_sha,'Otra entrega cambió main durante la reserva');
    assertProduction(await live(),source);
    await new Promise(r=>setTimeout(r,10000));
  }
  throw new Error('La reserva manual expiró; detener operaciones, revisar el estado real y reservar de nuevo');
}
async function manualClose() {
  const id=Number(process.env.RESERVATION_ID);if(!id) return;
  await gh(`/deployments/${id}/statuses`,'POST',{state:process.env.RELEASE_RESULT==='success'?'success':'failure',description:process.env.RELEASE_RESULT==='success'?'Publicación revisada y dominios comprobados':'Reserva interrumpida: revisar GitHub, Vercel y backend antes de continuar',auto_inactive:false});
}
async function merge() {
  const result = JSON.parse(fs.readFileSync(path.join(workspace, 'artifacts', 'verification.json')));
  const number = Number(process.env.PR_NUMBER);
  const pr = await gh(`/pulls/${number}`);
  if (pr.merged && pr.merge_commit_sha) {
    assert(eligible({...pr, state:'open'}), 'La propuesta no conserva su autorización');
    assert.equal(await currentMain(), pr.merge_commit_sha, 'Main avanzó después de la incorporación');
    const mergedCommit = await gh(`/git/commits/${pr.merge_commit_sha}`);
    assert.equal(mergedCommit.tree.sha, result.tree, 'El código incorporado difiere del candidato validado');
    assertProduction(await live(), fingerprint(path.join(workspace, 'control')));
    output('commit', pr.merge_commit_sha); output('fingerprint', result.fingerprint);
    return;
  }
  assert(eligible(pr), 'La propuesta dejó de estar autorizada');
  assert.equal(pr.head.sha, process.env.PR_HEAD, 'La propuesta recibió cambios después de validar');
  assert.equal(await currentMain(), result.base, 'Main avanzó: volver a ejecutar sobre la base nueva');
  assertProduction(await live(), fingerprint(path.join(workspace, 'control')));
  const repo = path.join(workspace, 'control');
  git(repo, ['fetch', path.join(workspace, 'artifacts', 'candidate.bundle'), 'validated-candidate']);
  const sha = git(repo, ['rev-parse', 'FETCH_HEAD']);
  assert.equal(sha, result.head);
  assert.equal(git(repo, ['rev-parse', `${sha}^{tree}`]), result.tree);
  git(repo, ['merge-base', '--is-ancestor', pr.head.sha, sha]);
  git(repo, ['merge-base', '--is-ancestor', result.base, sha]);
  // Push only the tested merge into this PR branch. Strict protection rejects a base race.
  git(repo, ['push', 'origin', `${sha}:refs/heads/${pr.head.ref}`, `--force-with-lease=refs/heads/${pr.head.ref}:${pr.head.sha}`]);
  await gh(`/statuses/${sha}`, 'POST', {state:'success', context:config.statusContext, description:`Presentación verificada sobre ${result.base.slice(0,7)}`, target_url:`https://github.com/${config.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`});
  await waitForMergeability({head:sha,base:result.base,authorized:eligible,snapshot:async()=>{
    const current=await gh(`/pulls/${number}`);
    const statuses=await gh(`/commits/${sha}/statuses`);
    return {pr:current,main:await currentMain(),status:statuses.find(s=>s.context===config.statusContext)?.state};
  }});
  assertProduction(await live(), fingerprint(repo));
  const merged = await gh(`/pulls/${number}/merge`, 'PUT', {sha, merge_method:'squash'});
  assert.equal(merged.merged, true, 'GitHub no confirmó la incorporación');
  output('commit', merged.sha); output('fingerprint', result.fingerprint);
  fs.writeFileSync(path.join(workspace, 'merged.json'), JSON.stringify({number, commit:merged.sha, fingerprint:result.fingerprint}));
}
async function preDeploy() {
  const repo = process.argv[3];
  const sha = process.env.RELEASE_COMMIT;
  assert.equal(await currentMain(), sha, 'Main cambió antes de publicar');
  assert.equal(git(repo, ['rev-parse', 'HEAD']), sha);
  assert.equal(fingerprint(repo), process.env.RELEASE_FINGERPRINT);
  const control = path.join(workspace, 'control');
  const deployments=await live();
  const baseFingerprint=process.env.PRODUCTION_FINGERPRINT || fingerprint(control);
  if(process.env.RELEASE_URL){
    const expected=await vc(`/v13/deployments/${process.env.RELEASE_URL.replace(/^https?:\/\//,'').replace(/\/$/,'')}`);
    assertTransition(deployments,expected,baseFingerprint,sha,process.env.RELEASE_FINGERPRINT);
  } else assertProduction(deployments,baseFingerprint);
}
export function deploymentBody(commit, sourceFingerprint, cfg = config) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  return {name:'gestion_limpatex', project:cfg.projectId, target:'production', source:'cli', autoAssignCustomDomains:false,
    gitMetadata:{remoteUrl:`https://github.com/${cfg.repository}.git`, commitSha:commit, commitRef:cfg.baseBranch},
    meta:{limpatexCommit:commit, limpatexSourceFingerprint:sourceFingerprint}};
}
async function createDeployment() {
  const repo=path.resolve(process.argv[3] || 'control');
  assert.equal(git(repo,['rev-parse','HEAD']),process.env.RELEASE_COMMIT);
  assert.equal(git(repo,['status','--porcelain']), '', 'El código de publicación debe estar limpio');
  assert.equal(fingerprint(repo),process.env.RELEASE_FINGERPRINT);
  const names=execFileSync('git',['-C',repo,'ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const files=names.map(file=>{const data=fs.readFileSync(path.join(repo,file));return {file, data, size:data.length, sha:crypto.createHash('sha1').update(data).digest('hex')};});
  const previousDeployment=(await live())[0];
  const cached=cachedFileHashes(await vc(`/v6/deployments/${previousDeployment.id}/files`));
  const pending=files.filter(file=>!cached.has(file.sha));
  console.log(`Fuente: ${files.length-pending.length} archivos reutilizados; ${pending.length} pendientes de subir.`);
  let next=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(next<pending.length){
      const file=pending[next++];
      for(let attempt=0;attempt<8;attempt++){
        const response=await fetch(`https://api.vercel.com/v2/files?teamId=${config.teamId}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`,'Content-Type':'application/octet-stream','Content-Length':String(file.size),'x-vercel-digest':file.sha},body:file.data});
        await response.arrayBuffer();
        if(response.ok) break;
        if(attempt===7 || (response.status!==429 && response.status<500)) throw new Error(`No se pudo subir el archivo de fuente: ${response.status}`);
        const retrySeconds=Number(response.headers.get('retry-after')) || 10*(2**attempt);
        const seconds=Math.min(60,Math.max(5,retrySeconds));
        console.log(`Vercel ${response.status}: reintento de subida en ${seconds}s.`);
        await new Promise(resolve=>setTimeout(resolve,seconds*1000));
      }
    }
  }));
  console.log(`Fuente del commit subida: ${files.length} archivos.`);
  const settings=JSON.parse(fs.readFileSync(path.join(repo,'vercel.json'),'utf8'));
  const body={...settings,...deploymentBody(process.env.RELEASE_COMMIT,process.env.RELEASE_FINGERPRINT),files:files.map(({file,sha,size})=>({file,sha,size}))};
  const d = await vc('/v13/deployments', 'POST', body);
  output('url', 'https://' + d.url);
  console.log(`Deployment creado: ${d.id}. Los dominios siguen en la versión anterior.`);
  let previous;
  for (let attempt = 0; attempt < 120; attempt++) {
    const current = await vc(`/v13/deployments/${d.id}`);
    assert.equal(current.projectId, config.projectId);
    assert.equal(current.meta?.limpatexCommit, process.env.RELEASE_COMMIT);
    if (previous !== current.readyState) { console.log(current.readyState); previous=current.readyState; }
    if (current.readyState === 'READY') return;
    assert(!['ERROR','CANCELED'].includes(current.readyState), current.errorMessage || 'El deployment falló');
    await new Promise(resolve => setTimeout(resolve,10000));
  }
  throw new Error('La construcción excedió veinte minutos; comprobar antes de reintentar');
}
async function promoteDeployment() {
  const d = await vc(`/v13/deployments/${process.env.RELEASE_URL.replace(/^https?:\/\//,'').replace(/\/$/,'')}`);
  assert.equal(d.projectId, config.projectId); assert.equal(d.readyState,'READY');
  assert.equal(d.meta?.limpatexCommit, process.env.RELEASE_COMMIT);
  assert.equal(d.meta?.limpatexSourceFingerprint, process.env.RELEASE_FINGERPRINT);
  await vc(`/v10/projects/${config.projectId}/promote/${d.id}`, 'POST', {});
  for (const domain of config.domains) await vc(`/v2/deployments/${d.id}/aliases`, 'POST', {alias:domain});
  for (let attempt=0; attempt<30; attempt++) {
    if ((await live()).every(current=>current.id===d.id)) return;
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw new Error('No se confirmó el cambio de los dos dominios');
}
async function recover() {
  await assertManualReleasesClosed();
  const pr=await gh(`/pulls/${Number(process.env.PR_NUMBER)}`);
  assert(pr.merged && eligible({...pr,state:'open'}), 'Solo recuperar una entrega autorizada ya incorporada');
  const statuses=(await gh(`/commits/${pr.head.sha}/status`)).statuses;
  assert(statuses.some(s=>s.context===config.statusContext && s.state==='success'), 'Falta validación previa de la propuesta');
  const repo=path.join(workspace,'control');
  const main=await currentMain();
  assert.equal(git(repo,['rev-parse','HEAD']),main);
  const currentFingerprint=fingerprint(repo);
  git(repo,['fetch','origin',pr.merge_commit_sha]);
  git(repo,['checkout','--detach',pr.merge_commit_sha]);
  assert.equal(fingerprint(repo),currentFingerprint,'La aplicación cambió después de validar; no se puede recuperar automáticamente');
  git(repo,['checkout','--detach',`${pr.merge_commit_sha}^`]);
  const productionFingerprint=fingerprint(repo);
  git(repo,['checkout','--detach',main]);
  const deployments=await live();
  if(deployments.every(d=>d.meta?.limpatexSourceFingerprint===currentFingerprint)){
    assertProduction(deployments,currentFingerprint);
    const deployedCommit=deployments[0].meta.limpatexCommit;
    assert.match(deployedCommit,/^[a-f0-9]{40}$/);
    git(repo,['merge-base','--is-ancestor',deployedCommit,main]);
    git(repo,['checkout','--detach',deployedCommit]);
    assert.equal(fingerprint(repo),currentFingerprint);
    git(repo,['checkout','--detach',main]);
    output('verifyOnly','true'); output('url','https://'+deployments[0].url);
    output('commit',deployedCommit); output('fingerprint',currentFingerprint);
    return;
  }
  assertProduction(deployments,productionFingerprint);
  output('commit',main); output('fingerprint',currentFingerprint); output('productionFingerprint',productionFingerprint);
}
async function verifyDeployment() {
  const deployments = await live();
  const deploymentUrl = process.env.RELEASE_URL.replace(/^https?:\/\//,'').replace(/\/$/,'');
  const expected = await vc(`/v13/deployments/${deploymentUrl}`);
  for (const d of deployments) {
    assert.equal(d.id, expected.id, 'Alias canónico desactualizado');
    assert.equal(d.meta?.limpatexSourceFingerprint, process.env.RELEASE_FINGERPRINT);
    assert.equal(d.meta?.limpatexCommit, process.env.RELEASE_COMMIT);
  }
  const pages = [];
  for (const domain of config.domains) {
    pages.push(await verifyPage(domain));
  }
  assert.equal(pages[0],pages[1]);
  console.log(JSON.stringify({deployment:expected.id, commit:process.env.RELEASE_COMMIT, domains:config.domains, assetsVerified:true}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === 'select') await select();
  else if (command === 'merge') await merge();
  else if (command === 'pre-deploy') await preDeploy();
  else if (command === 'verify-deployment') await verifyDeployment();
  else if (command === 'create-deployment') await createDeployment();
  else if (command === 'promote-deployment') await promoteDeployment();
  else if (command === 'recover') await recover();
  else if (command === 'manual-hold') await manualHold();
  else if (command === 'manual-close') await manualClose();
  else throw new Error('Comando desconocido');
}
