import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {inspectWorkspace, prepareWorkspace} from './orcaSetup.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
function fixture(t, branch = 'new-task') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'limpatex-orca-test-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  const primary = path.join(temp, 'primary');
  const worktree = path.join(temp, 'task with spaces');
  fs.mkdirSync(primary);
  git(primary, 'init', '-b', 'main');
  git(primary, 'config', 'user.name', 'Local Test');
  git(primary, 'config', 'user.email', 'local@example.invalid');
  git(primary, 'remote', 'add', 'origin', 'https://github.com/dgomezlimpatex/hostaway-explorer-app.git');
  fs.writeFileSync(path.join(primary, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(primary, 'package.json'), '{"private":true}');
  fs.writeFileSync(path.join(primary, 'package-lock.json'), '{"lockfileVersion":3}');
  git(primary, 'add', '.');
  git(primary, 'commit', '-m', 'fixture');
  git(primary, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(primary, 'worktree', 'add', '-b', branch, worktree);
  let installs = 0;
  const install = root => {
    installs++;
    for (const module of ['vite', 'typescript']) {
      fs.mkdirSync(path.join(root, 'node_modules', module), {recursive: true});
      fs.writeFileSync(path.join(root, 'node_modules', module, 'package.json'), '{}');
    }
  };
  return {primary, worktree, install, installs: () => installs};
}

test('refuses primary checkout before touching its files or branch', t => {
  const f = fixture(t);
  assert.throws(() => prepareWorkspace(f.primary, f.install), /checkout principal/);
  assert.equal(git(f.primary, 'branch', '--show-current'), 'main');
  assert.equal(f.installs(), 0);
});
test('prepares a new worktree, preserves primary and reuses valid dependencies', t => {
  const f = fixture(t);
  assert.deepEqual(prepareWorkspace(f.worktree, f.install), {branch: 'codex/new-task', dependencies: 'installed'});
  assert.equal(prepareWorkspace(f.worktree, f.install).dependencies, 'already-ready');
  assert.equal(f.installs(), 1);
  assert.equal(git(f.primary, 'status', '--porcelain'), '');
  assert.equal(git(f.worktree, 'status', '--porcelain'), '');
  fs.appendFileSync(path.join(f.worktree, 'package-lock.json'), '\n');
  assert.equal(prepareWorkspace(f.worktree, f.install).dependencies, 'installed');
  assert.equal(f.installs(), 2);
});
test('never renames dirty branches, committed work or an occupied destination', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.worktree, 'pending.txt'), 'preserve me');
  assert.throws(() => prepareWorkspace(f.worktree, f.install), /trabajo existente/);
  git(f.worktree, 'add', 'pending.txt');
  git(f.worktree, 'commit', '-m', 'own work');
  assert.throws(() => prepareWorkspace(f.worktree, f.install), /trabajo existente/);
  assert.equal(fs.readFileSync(path.join(f.worktree, 'pending.txt'), 'utf8'), 'preserve me');
  const g = fixture(t, 'second-task');
  git(g.primary, 'branch', 'codex/second-task');
  assert.throws(() => prepareWorkspace(g.worktree, g.install), /destino ya existe/);
});
test('refuses a different repository and detached checkout', t => {
  const f = fixture(t, 'codex/task');
  git(f.primary, 'remote', 'set-url', 'origin', 'https://example.invalid/other.git');
  assert.throws(() => inspectWorkspace(f.worktree), /Repositorio inesperado/);
  git(f.primary, 'remote', 'set-url', 'origin', 'https://github.com/dgomezlimpatex/hostaway-explorer-app.git');
  git(f.worktree, 'checkout', '--detach');
  assert.throws(() => inspectWorkspace(f.worktree), /rama propia/);
});
test('failed or partial install never writes a readiness marker', t => {
  const f = fixture(t, 'codex/task');
  assert.throws(() => prepareWorkspace(f.worktree, () => { throw new Error('install failed'); }), /install failed/);
  assert.throws(() => prepareWorkspace(f.worktree, () => {}), /Instalación incompleta/);
  assert.equal(fs.existsSync(path.join(f.worktree, 'node_modules', '.limpatex-orca-setup')), false);
});
test('refuses linked dependencies rather than modifying another checkout', t => {
  const f = fixture(t, 'codex/task');
  const shared = path.join(f.primary, 'node_modules');
  fs.mkdirSync(shared);
  fs.writeFileSync(path.join(shared, 'untouched.txt'), 'keep');
  fs.symlinkSync(shared, path.join(f.worktree, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => prepareWorkspace(f.worktree, f.install), /dependencias ajenas/);
  assert.equal(fs.readFileSync(path.join(shared, 'untouched.txt'), 'utf8'), 'keep');
  assert.equal(f.installs(), 0);
});
