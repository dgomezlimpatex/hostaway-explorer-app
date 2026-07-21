import { spawnSync } from 'node:child_process';

const suites = [
  'planningBatchContractTest.mjs',
  'planningBatchAtomicityTest.mjs',
  'planningBatchLoadScenariosTest.mjs',
  'planningBatchIdempotencyTest.mjs',
  'planningBatchConcurrencyTest.mjs',
  'whatsappDeletedTaskCancellationTest.mjs',
  'legacyAssignmentWriterGuardTest.mjs',
  'planningProviderSafetyTest.mjs',
];

const failures = [];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [`scripts/${suite}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status === 0) console.log(`PASS ${suite}`);
  else {
    failures.push(suite);
    const summary = output.split('\n').find((line) => /RED esperado|AssertionError|writers directos/.test(line)) || output.split('\n')[0];
    console.error(`RED  ${suite}: ${summary}`);
  }
}

if (failures.length > 0) {
  console.error(`\nplanning-hermes-150: RED (${failures.length}/${suites.length} suites pendientes)`);
  process.exitCode = 1;
} else {
  console.log('\nplanning-hermes-150: GREEN');
}
