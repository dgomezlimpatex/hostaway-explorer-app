import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {fingerprint} from './guard.mjs';

const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
const command = process.argv[2];
const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
const github = `https://api.github.com/repos/${config.repository}`;
export function eligible(pr, cfg = config) {
  return pr.state === 'open' && !pr.draft && pr.user.login === cfg.owner && pr.base.ref === cfg.baseBranch
    && pr.head.repo?.full_name === cfg.repository && pr.head.ref.startsWith('codex/')
    && pr.labels.some(label => label.name === cfg.label)
    && /(?:^|\n)Delivery-Scope: presentation(?:\r?\n|$)/.test(pr.body || '');
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
async function request(url, method = 'GET', body, token = process.env.GH_TOKEN) {
  const response = await fetch(url, {method, headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json'}, body: body ? JSON.stringify(body) : undefined});
  const text = await response.text();
  if (!response.ok) throw new Error(`API ${method} ${new URL(url).pathname}: ${response.status} ${text.slice(0,300)}`);
  return text ? JSON.parse(text) : null;
}
const gh = (endpoint, method, body) => request(github + endpoint, method, body);
const vc = endpoint => request('https://api.vercel.com' + endpoint + `?teamId=${config.teamId}`, 'GET', undefined, process.env.VERCEL_TOKEN);
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], {encoding:'utf8', maxBuffer:30e6}).trim();
function output(key, value) { fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`); }
async function live() { return Promise.all(config.domains.map(d => vc(`/v13/deployments/${d}`))); }
async function currentMain() { return (await gh(`/git/ref/heads/${config.baseBranch}`)).object.sha; }
async function select() {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH));
  const number = Number(event.inputs?.pr_number || event.pull_request?.number || 0);
  // A recovery/manual dispatch without a PR checks configuration and does not publish.
  if (!number) {
    assertProduction(await live(), fingerprint(path.join(workspace, 'control')));
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
  assertProduction(await live(), fingerprint(repo));
  output('eligible', 'true'); output('number', number); output('head', pr.head.sha); output('base', main);
}
async function merge() {
  const result = JSON.parse(fs.readFileSync(path.join(workspace, 'artifacts', 'verification.json')));
  const number = Number(process.env.PR_NUMBER);
  const pr = await gh(`/pulls/${number}`);
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
  assertProduction(await live(), fingerprint(control));
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
    const response = await fetch('https://' + domain, {cache:'no-store'});
    assert.equal(response.status,200);
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^" ]+\/assets\/[^" ]+\.(?:js|css))"/g)].map(m=>m[1]);
    assert(assets.length >= 2, 'Faltan assets de la aplicación');
    for (const asset of assets) assert.equal((await fetch(new URL(asset,'https://'+domain))).status,200);
    pages.push(assets.sort().join('\n'));
  }
  assert.equal(pages[0],pages[1]);
  console.log(JSON.stringify({deployment:expected.id, commit:process.env.RELEASE_COMMIT, domains:config.domains, assetsVerified:true}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === 'select') await select();
  else if (command === 'merge') await merge();
  else if (command === 'pre-deploy') await preDeploy();
  else if (command === 'verify-deployment') await verifyDeployment();
  else throw new Error('Comando desconocido');
}
