// Run before and after: node scripts/performanceBundleMeasure.mjs <output.json>
import { build } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
await build({ build: { manifest: true }, logLevel: 'error' });
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
function closure(entry) {
  const seen = new Set();
  function visit(key) { if (seen.has(key)) return;seen.add(key);for(const dep of manifest[key]?.imports || [])visit(dep); }
  visit(entry);
  const files = [...seen].map(key => manifest[key]?.file).filter(Boolean);
  return { bytes: files.reduce((sum, file) => sum + readFileSync(join('dist', file)).length, 0), gzipBytes: files.reduce((sum,file) => sum + gzipSync(readFileSync(join('dist',file))).length,0), files };
}
const result = Object.fromEntries(['src/components/dashboard/MainDashboard.tsx','src/pages/LogisticsReports.tsx','src/pages/LogisticsPicklistDetails.tsx'].filter(key => manifest[key]).map(key => [key, closure(key)]));
writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([key,value])=>[key,{bytes:value.bytes,gzipBytes:value.gzipBytes}]))));
