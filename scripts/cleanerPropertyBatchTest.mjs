// Run the actual preparation loader in batch mode and retain its direct-call regressions.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const test=fileURLToPath(new URL('./cleanerPropertyPreparationTest.mjs',import.meta.url));
for(const args of [['--batch'],[]]) execFileSync(process.execPath,[test,...args],{stdio:'inherit'});
