// Local-only preview: synthetic fixtures, no Supabase client, no auth bypass in the app.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const tmp = mkdtempSync(join(tmpdir(), 'forecast-preview-css-'));
const styleFile = join(tmp, 'style.css');
execFileSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', 'src/index.css', '-o', styleFile], { stdio: 'pipe' });
const output = await build({ entryPoints: ['scripts/forecastPreview.entry.tsx'], bundle: true, write: false, outdir: 'preview', platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } });
const js = output.outputFiles.find(f => f.path.endsWith('.js')).text;
const workerOutput = await build({ entryPoints: ['src/features/staffing/forecastWorker.ts'], bundle: true, write: false, platform: 'browser', format: 'esm' });
const css = readFileSync(styleFile, 'utf8').replace(/@import[^;]+;/g, '') + output.outputFiles.find(f => f.path.endsWith('.css')).text;
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Previsor · revisión local</title><style>body{margin:0}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js.replaceAll('</script', '<\\/script')}</script></html>`;
createServer((req, res) => { if (req.url === '/forecast-worker.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(workerOutput.outputFiles[0].text); return; } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }).listen(8091, '127.0.0.1', () => console.log('Preview sintética: http://127.0.0.1:8091/staffing-forecast/screens/forecast?month=2026-10&horizon=1&week=2026-10-05'));
