import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  calculateInitialExecution,
  calculateNextExecution,
  calculateOccurrences,
  calculateDueExecutions,
  getMadridDateKey,
  type RecurringSchedule,
} from '../supabase/functions/_shared/recurringSchedule.ts';

const schedule = (overrides: Partial<RecurringSchedule> = {}): RecurringSchedule => ({
  frequency: 'weekly',
  interval_days: 1,
  days_of_week: [1],
  day_of_month: null,
  start_date: '2026-07-13',
  end_date: null,
  ...overrides,
});

export async function run(assert: typeof import('node:assert/strict')) {
  assert.equal(
    getMadridDateKey(new Date('2026-03-28T23:30:00Z')),
    '2026-03-29',
    'El día operativo debe calcularse en Europe/Madrid, no con toISOString UTC',
  );

  const alternatingMondayWednesday = schedule({ interval_days: 2, days_of_week: [1, 3] });
  assert.equal(calculateNextExecution(alternatingMondayWednesday, '2026-07-13'), '2026-07-15');
  assert.equal(calculateNextExecution(alternatingMondayWednesday, '2026-07-15'), '2026-07-27');
  assert.deepEqual(
    calculateOccurrences(alternatingMondayWednesday, '2026-07-13', '2026-08-02'),
    ['2026-07-13', '2026-07-15', '2026-07-27', '2026-07-29'],
    'La vista previa y el backend deben respetar semanas alternas y todos los días de la semana activa',
  );

  assert.equal(
    calculateInitialExecution(alternatingMondayWednesday, '2026-07-14'),
    '2026-07-15',
    'La primera ejecución debe ser la primera ocurrencia válida no anterior a hoy Madrid',
  );

  const sundayTuesday = schedule({ interval_days: 2, days_of_week: [0, 2], start_date: '2026-07-13' });
  assert.equal(calculateNextExecution(sundayTuesday, '2026-07-19'), '2026-07-28');

  const daily = schedule({ frequency: 'daily', interval_days: 3, days_of_week: null, start_date: '2026-07-17' });
  assert.equal(calculateNextExecution(daily, '2026-07-17'), '2026-07-20');
  assert.deepEqual(calculateOccurrences(daily, '2026-07-18', '2026-07-27'), ['2026-07-20', '2026-07-23', '2026-07-26']);

  const monthly = schedule({
    frequency: 'monthly',
    interval_days: 1,
    days_of_week: null,
    day_of_month: 31,
    start_date: '2026-01-31',
  });
  assert.equal(calculateNextExecution(monthly, '2026-01-31'), '2026-02-28');
  assert.deepEqual(
    calculateOccurrences(monthly, '2026-01-01', '2026-04-30'),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
  );

  assert.equal(
    calculateNextExecution({ ...monthly, end_date: '2026-02-28' }, '2026-02-28'),
    null,
    'No debe programarse una ejecución posterior a end_date',
  );

  assert.deepEqual(
    calculateDueExecutions(
      schedule({ frequency: 'daily', interval_days: 1, days_of_week: null, start_date: '2026-07-01' }),
      '2026-07-14',
      '2026-07-18',
      10,
    ),
    {
      dates: ['2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18'],
      hasMore: false,
    },
    'El cron debe recuperar todas las ocurrencias vencidas, no solo una por ejecución',
  );
  assert.deepEqual(
    calculateDueExecutions(
      schedule({ frequency: 'daily', interval_days: 1, days_of_week: null, start_date: '2026-07-01' }),
      '2026-07-14',
      '2026-07-18',
      3,
    ),
    {
      dates: ['2026-07-14', '2026-07-15', '2026-07-16'],
      hasMore: true,
    },
    'El límite defensivo debe informar de backlog pendiente',
  );

  const repoRoot = process.cwd();
  const processor = readFileSync(
    join(repoRoot, 'supabase/functions/process-recurring-tasks/index.ts'),
    'utf8',
  );
  assert.match(processor, /\.rpc\('materialize_recurring_task'/);
  assert.match(
    processor,
    /calculateDueExecutions\(\s*rt,\s*rt\.next_execution,\s*today,\s*MAX_OCCURRENCES_PER_TASK,?\s*\)/,
  );
  assert.match(processor, /for \(const executionDate of dueExecutions\.dates\)/);
  assert.match(processor, /hasBacklog/);
  assert.doesNotMatch(
    processor,
    /\.from\('tasks'\)[\s\S]{0,100}?\.insert\(/,
    'La Edge Function no debe crear la tarea fuera de la transacción idempotente',
  );
  assert.match(processor, /materialization\.was_created && rt\.cleaner_id/);

  const manualProcessor = readFileSync(
    join(repoRoot, 'src/hooks/useRecurringTasks.ts'),
    'utf8',
  );
  assert.match(manualProcessor, /functions\.invoke\('process-recurring-tasks'/);
  assert.match(manualProcessor, /data\?\.failed\s*>\s*0/);
  assert.doesNotMatch(
    manualProcessor,
    /functions\.invoke\('send-recurring-task-email'/,
    'Crear la plantilla no debe enviar el mismo aviso que su materialización',
  );
  assert.doesNotMatch(manualProcessor, /recurringTaskStorage\.processRecurringTasks/);

  assert.match(processor, /p_schedule_snapshot:\s*scheduleSnapshot/);

  const storageSource = readFileSync(
    join(repoRoot, 'src/services/recurringTaskStorage.ts'),
    'utf8',
  );
  assert.match(storageSource, /\.eq\('state_revision', currentData\.state_revision\)/);
  assert.match(
    storageSource,
    /shouldRecalculateSchedule = \(scheduleChanged \|\| updates\.isActive === true\)/,
    'Reactivar una recurrencia debe recalcular next_execution en lugar de conservar 2099-12-31',
  );

  const migration = readFileSync(
    join(repoRoot, 'supabase/migrations/20260718101420_atomic_recurring_task_materialization.sql'),
    'utf8',
  );
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*?WHERE success = true/);
  assert.match(migration, /FROM public\.recurring_tasks[\s\S]*?FOR UPDATE/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS execution_day date/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS state_revision bigint/);
  assert.match(migration, /CREATE TRIGGER bump_recurring_task_state_revision/);
  assert.match(migration, /p_schedule_snapshot jsonb/);
  assert.match(migration, /Recurring schedule changed while materializing/);
  assert.match(migration, /AT TIME ZONE 'Europe\/Madrid'/);
  assert.match(
    migration,
    /IF FOUND THEN[\s\S]*?UPDATE public\.recurring_tasks[\s\S]*?RETURN QUERY SELECT v_existing_task_id, false/,
    'Una ejecución ya existente debe reparar y avanzar la recurrencia antes de retornar',
  );
  assert.match(migration, /INSERT INTO public\.tasks/);
  assert.match(migration, /INSERT INTO public\.recurring_task_executions/);
  assert.match(migration, /UPDATE public\.recurring_tasks/);
  assert.match(migration, /GRANT EXECUTE[\s\S]*?TO service_role/);
  assert.match(migration, /REVOKE ALL[\s\S]*?FROM authenticated/);
}
