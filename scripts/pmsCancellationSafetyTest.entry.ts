import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canDeleteTaskAfterPmsCancellation,
  normalizeTaskStatus,
} from '../supabase/functions/_shared/taskCancellationPolicy.ts';

export async function run(assert: typeof import('node:assert/strict')) {
  assert.equal(normalizeTaskStatus(' IN_PROGRESS '), 'in-progress');
  assert.equal(normalizeTaskStatus('in-progress'), 'in-progress');

  assert.equal(
    canDeleteTaskAfterPmsCancellation('pending'),
    true,
    'Una tarea todavía pendiente puede retirarse cuando el PMS cancela la reserva',
  );

  for (const protectedStatus of ['in-progress', 'in_progress', 'completed']) {
    assert.equal(
      canDeleteTaskAfterPmsCancellation(protectedStatus),
      false,
      `La tarea ${protectedStatus} debe conservarse aunque la reserva se cancele`,
    );
  }

  for (const unknownStatus of [null, undefined, '', 'cancelled', 'otro']) {
    assert.equal(
      canDeleteTaskAfterPmsCancellation(unknownStatus),
      false,
      'Ante estados ausentes o desconocidos el PMS debe fallar de forma conservadora',
    );
  }

  const repoRoot = process.cwd();
  const connectorSources = [
    'supabase/functions/hostaway-sync/database-operations.ts',
    'supabase/functions/avantio-sync/database-operations.ts',
    'supabase/functions/avirato-sync/index.ts',
    'supabase/functions/little-hotelier-sync/index.ts',
  ];

  for (const relativePath of connectorSources) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    assert.match(
      source,
      /canDeleteTaskAfterPmsCancellation|deleteTaskIfPending/,
      `${relativePath} debe aplicar la política compartida de cancelación`,
    );
    assert.match(
      source,
      /\.eq\(["']status["'],\s*(?:task|t)\.status\)/,
      `${relativePath} debe hacer el borrado condicional para cerrar la carrera con el inicio de tarea`,
    );
  }

  const hostawayService = readFileSync(
    join(repoRoot, 'supabase/functions/hostaway-sync/task-service.ts'),
    'utf8',
  );
  assert.match(hostawayService, /if \(deleted\) \{\s*stats\.tasks_cancelled\+\+/);

  const avantioProcessor = readFileSync(
    join(repoRoot, 'supabase/functions/avantio-sync/reservation-processor.ts'),
    'utf8',
  );
  assert.match(avantioProcessor, /const deleted = await deleteTaskIfPending\(existingReservation\.task_id\)/);
  assert.match(avantioProcessor, /if \(!deleted\)[\s\S]*?conservada tras cancelación Avantio/);
  assert.match(avantioProcessor, /if \(unlinkError\) throw unlinkError/);
  assert.match(avantioProcessor, /if \(emailError\) throw emailError/);

  const hostawayOrchestrator = readFileSync(
    join(repoRoot, 'supabase/functions/hostaway-sync/sync-orchestrator.ts'),
    'utf8',
  );
  const activeHostawayProcessor = readFileSync(
    join(repoRoot, 'supabase/functions/hostaway-sync/improved-reservation-processor.ts'),
    'utf8',
  );
  assert.match(
    hostawayOrchestrator,
    /new ImprovedReservationProcessor/,
    'El test debe seguir el procesador que usa realmente el orquestador Hostaway',
  );
  assert.match(activeHostawayProcessor, /deleteTaskIfPending/);
  assert.doesNotMatch(
    activeHostawayProcessor,
    /\.from\(["']tasks["']\)[\s\S]{0,100}?\.delete\(\)/,
    'El procesador Hostaway activo no puede conservar borrados directos que eviten la política',
  );
  assert.doesNotMatch(
    activeHostawayProcessor,
    /\.update\(\{[\s\S]{0,160}?task_id:\s*null/,
    'Hostaway no debe desvincular antes de saber si la tarea pending fue eliminada',
  );
  assert.match(activeHostawayProcessor, /if \(reservationUpdateError\) throw reservationUpdateError/);

  for (const [relativePath, errorName] of [
    ['supabase/functions/avantio-sync/sync-orchestrator.ts', 'unlinkError'],
    ['supabase/functions/avirato-sync/index.ts', 'linkUpdateError'],
    ['supabase/functions/little-hotelier-sync/index.ts', 'linkUpdateError'],
  ] as const) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    assert.match(source, new RegExp(`if \\(${errorName}\\) throw ${errorName}`));
  }

  const fkMigration = readFileSync(
    join(repoRoot, 'supabase/migrations/20260212090959_93e56d55-6c52-4f92-875e-2be57f15eaf6.sql'),
    'utf8',
  );
  assert.match(fkMigration, /hostaway_reservations_task_id_fkey[\s\S]*?ON DELETE SET NULL/);
  assert.match(fkMigration, /avantio_reservations_task_id_fkey[\s\S]*?ON DELETE SET NULL/);
}
