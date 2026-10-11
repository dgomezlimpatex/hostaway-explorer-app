import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const remote = 'https://github.com/dgomezlimpatex/hostaway-explorer-app.git';
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], {encoding: 'utf8'}).trim();

export function inspectWorkspace(cwd) {
  const root = fs.realpathSync(git(cwd, ['rev-parse', '--show-toplevel']));
  const gitDir = fs.realpathSync(git(root, ['rev-parse', '--absolute-git-dir']));
  const commonDir = fs.realpathSync(path.resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
  if (gitDir === commonDir) throw new Error('Usar un worktree aislado, nunca el checkout principal.');
  if (git(root, ['remote', 'get-url', 'origin']) !== remote) throw new Error('Repositorio inesperado.');
  const branch = git(root, ['branch', '--show-current']);
  if (!branch || ['main', 'master'].includes(branch)) throw new Error('La tarea necesita una rama propia.');
  if (!branch.startsWith('codex/')) {
    if (git(root, ['status', '--porcelain']) || git(root, ['rev-parse', 'HEAD']) !== git(root, ['rev-parse', 'origin/main'])) {
      throw new Error('No renombrar una rama con trabajo existente; preparar otra tarea aislada.');
    }
    const destination = `codex/${branch}`;
    const probe = spawnSync('git', ['-C', root, 'show-ref', '--verify', '--quiet', `refs/heads/${destination}`]);
    if (probe.status !== 1) throw new Error('La rama de destino ya existe o no se pudo comprobar.');
    return {root, branch, destination};
  }
  return {root, branch, destination: branch};
}

export function dependencyFingerprint(root) {
  const hash = crypto.createHash('sha256');
  for (const file of ['package.json', 'package-lock.json']) hash.update(fs.readFileSync(path.join(root, file)));
  hash.update(`${process.version}:${process.platform}:${process.arch}`);
  return hash.digest('hex');
}

function install(root) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    {cwd: root, stdio: 'inherit', shell: process.platform === 'win32'});
  if (result.error || result.status !== 0) throw new Error('Falló la instalación; resolver antes de iniciar el trabajo.');
}

export function prepareWorkspace(cwd, installDependencies = install) {
  const workspace = inspectWorkspace(cwd);
  // Read the lockfile before making any change to the branch.
  const fingerprint = dependencyFingerprint(workspace.root);
  const modules = path.join(workspace.root, 'node_modules');
  if (fs.existsSync(modules) && fs.lstatSync(modules).isSymbolicLink()) {
    throw new Error('node_modules está compartido mediante enlace; no modificar dependencias ajenas.');
  }
  const marker = path.join(modules, '.limpatex-orca-setup');
  const ready = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === fingerprint
    && fs.existsSync(path.join(modules, 'vite', 'package.json'))
    && fs.existsSync(path.join(modules, 'typescript', 'package.json'));
  if (workspace.destination !== workspace.branch) git(workspace.root, ['branch', '-m', workspace.destination]);
  if (!ready) {
    installDependencies(workspace.root);
    if (!fs.existsSync(path.join(modules, 'vite', 'package.json')) || !fs.existsSync(path.join(modules, 'typescript', 'package.json'))) {
      throw new Error('Instalación incompleta; no se marca el entorno como preparado.');
    }
    fs.writeFileSync(marker, fingerprint);
  }
  return {branch: workspace.destination, dependencies: ready ? 'already-ready' : 'installed'};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(prepareWorkspace(process.cwd()))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
