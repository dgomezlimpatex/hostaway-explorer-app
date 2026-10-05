import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {verifyPresentation, fingerprint} from './guard.mjs';

const repo = path.resolve(process.argv[2]);
const base = execFileSync('git',['-C',repo,'rev-parse',process.argv[3]],{encoding:'utf8'}).trim();
const head = execFileSync('git',['-C',repo,'rev-parse',process.argv[4]],{encoding:'utf8'}).trim();
const resultFile = path.resolve(process.argv[5]);
const git = args => execFileSync('git', ['-C', repo, ...args], {encoding: 'utf8'}).trim();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function command(binary, args) {
  const result = spawnSync(binary, args, {cwd: repo, encoding: 'utf8', shell: process.platform === 'win32' && binary.endsWith('.cmd'), maxBuffer: 30e6});
  if (result.error) throw result.error;
  return result;
}
function checkTypes(project) {
  const result = command(process.execPath, ['node_modules/typescript/bin/tsc', '-p', project, '--noEmit', '--pretty', 'false']);
  const output = (result.stdout + result.stderr).replace(/\r\n/g, '\n');
  if (result.status !== 0 && !/error TS\d+/.test(output)) throw new Error(`Error del compilador: ${project}`);
  const diagnostics = output.trim().split('\n').filter(Boolean).map(line => line.replace(/\(\d+,\d+\)/g, '(location)')).sort();
  return diagnostics;
}
function noNewDiagnostics(before, after, project) {
  const remaining = [...before];
  for (const diagnostic of after) {
    const index = remaining.indexOf(diagnostic);
    if (index < 0) throw new Error(`Nuevo error de tipos en ${project}: ${diagnostic}`);
    remaining.splice(index, 1);
  }
}
function lintDiagnostics(paths) {
  const targets=paths.filter(p=>p.endsWith('.tsx'));
  if (!targets.length) return [];
  const result=command(process.execPath,['node_modules/eslint/bin/eslint.js','--format','json',...targets]);
  let data;
  try { data=JSON.parse(result.stdout); } catch { throw new Error('No se pudo ejecutar lint focalizado'); }
  return data.flatMap(file=>file.messages.filter(m=>m.severity===2).map(m=>`${path.relative(repo,file.filePath).replaceAll('\\','/')}: ${m.ruleId}: ${m.message}`)).sort();
}
const paths = verifyPresentation(repo, base, head);
git(['checkout', '--detach', base]);
const baseline = {app: checkTypes('tsconfig.app.json'), node: checkTypes('tsconfig.node.json'), lint:lintDiagnostics(paths)};
git(['checkout', '--detach', head]);
const current = {app: checkTypes('tsconfig.app.json'), node: checkTypes('tsconfig.node.json'), lint:lintDiagnostics(paths)};
noNewDiagnostics(baseline.app, current.app, 'app');
noNewDiagnostics(baseline.node, current.node, 'node');
noNewDiagnostics(baseline.lint,current.lint,'lint focalizado');
const build = command(npm, ['run', 'build']);
if (build.status !== 0) throw new Error('Build falló:\n' + build.stdout + build.stderr);
const result = {base, head, tree: git(['rev-parse', 'HEAD^{tree}']), paths, baselineErrors: baseline.app.length, currentErrors: current.app.length, fingerprint: fingerprint(repo)};
fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
