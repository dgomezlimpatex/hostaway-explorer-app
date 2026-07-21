import { spawnSync } from 'node:child_process';

const suites = [
  'planningBatchClientTest.mjs',
  'planningBatchApprovalClientTest.mjs',
  'planningEmailDeliverySemanticsTest.mjs',
  'planningRunSnapshotTest.mjs',
  'planningBatchContractTest.mjs',
  'planningBatchAtomicityTest.mjs',
  'planningBatchLoadScenariosTest.mjs',
  'planningBatchIdempotencyTest.mjs',
  'planningBatchConcurrencyTest.mjs',
  'whatsappDeletedTaskCancellationTest.mjs',
  'legacyAssignmentWriterGuardTest.mjs',
  'cleanerDeletionCanonicalTest.mjs',
  'planningNotificationProviderTest.mjs',
  'planningProviderSafetyTest.mjs',
];

const failures = [];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [`scripts/${suite}`], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status === 0) {
    console.log(`PASS ${suite}`);
  } else {
    failures.push(suite);
    console.error(`FAIL ${suite}`);
    if (output) console.error(output);
  }
}

if (failures.length > 0) {
  console.error(`\nplanning-hermes-150: FAIL (${failures.length}/${suites.length})`);
  process.exitCode = 1;
} else {
  console.log(`\nplanning-hermes-150: GREEN (${suites.length}/${suites.length})`);
}
