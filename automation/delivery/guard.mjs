import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const visualAttributes = new Set(['className', 'title', 'placeholder', 'alt', 'aria-label', 'width', 'height']);
export function canonicalTsx(ts, source, filename = 'view.tsx') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length) throw new Error('No se pudo analizar TSX');
  function visit(node, visual = false) {
    if (ts.isJsxText(node)) return ['jsx-text'];
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(file);
      return [node.kind, name, node.initializer ? visit(node.initializer, visualAttributes.has(name)) : null];
    }
    if (visual && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      if (/url\s*\(|javascript:|https?:\/\//i.test(node.text)) throw new Error('Recurso externo en atributo visual');
      return [node.kind, 'visual-literal'];
    }
    if (visual && ts.isConditionalExpression(node)) return [node.kind, visit(node.condition), visit(node.whenTrue, true), visit(node.whenFalse, true)];
    if (visual && ts.isBinaryExpression(node)) {
      const logical = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind);
      return [node.kind, visit(node.left), visit(node.operatorToken), visit(node.right, logical)];
    }
    if (visual && ts.isCallExpression(node) && !['cn', 'clsx', 'classNames'].includes(node.expression.getText(file))) visual = false;
    // Numbers and identifiers always retain their meaning, including conditions.
    const children = [];
    ts.forEachChild(node, child => { children.push(visit(child, visual)); });
    return children.length ? [node.kind, ...children] : [node.kind, node.getText(file)];
  }
  return JSON.stringify(visit(file));
}

export function checkCss(before, after) {
  // Existing local URLs may remain; this route cannot introduce new imports/URLs.
  const resources = text => (text.match(/(?:@import\s+[^;]+;|url\s*\([^)]*\))/gi) || []).sort();
  if (JSON.stringify(resources(before)) !== JSON.stringify(resources(after))) throw new Error('Cambio de recursos CSS fuera de alcance');
}

export function verifyPresentation(repo, base, head) {
  const git = args => execFileSync('git', ['-C', repo, ...args], {maxBuffer: 30e6}).toString();
  const ts = createRequire(path.join(repo, 'package.json'))('typescript');
  const changes = git(['diff', '--name-status', '--no-renames', base, head]).trim().split('\n').filter(Boolean);
  if (!changes.length) throw new Error('La propuesta no contiene cambios');
  const paths = [];
  for (const line of changes) {
    const [status, filename] = line.split('\t');
    if (status !== 'M' || !/^src\/.+\.(tsx|css)$/.test(filename) && filename !== 'src/index.css') {
      throw new Error(`Requiere revisión de alcance: ${filename}`);
    }
    const before = git(['show', `${base}:${filename}`]);
    const after = git(['show', `${head}:${filename}`]);
    if (filename.endsWith('.css')) checkCss(before, after);
    else if (canonicalTsx(ts, before, filename) !== canonicalTsx(ts, after, filename)) {
      throw new Error(`Cambio funcional o estructural pendiente de aprobación: ${filename}`);
    }
    paths.push(filename);
  }
  return paths;
}

export function fingerprint(repo) {
  const names = execFileSync('git', ['-C', repo, 'ls-files', '-z']).toString().split('\0').filter(Boolean)
    .filter(p => /^(src\/|public\/)/.test(p) || /^(index\.html|package(-lock)?\.json|vite\.config\.ts|tailwind\.config\.ts|postcss\.config\.js|tsconfig.*\.json)$/.test(p))
    .sort();
  const hash = crypto.createHash('sha256');
  for (const name of names) {
    const data = fs.readFileSync(path.join(repo, name));
    // Vercel uploads on Windows may have CRLF; normalize text, preserve binary assets.
    const body = /\.(tsx?|jsx?|css|json|html|svg|txt|xml|md)$/.test(name) ? Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n')) : data;
    hash.update(name + '\0'); hash.update(crypto.createHash('sha256').update(body).digest());
  }
  return hash.digest('hex');
}
