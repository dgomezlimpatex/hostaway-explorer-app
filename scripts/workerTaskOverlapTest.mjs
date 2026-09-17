import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260917140000_allow_task_overlaps_with_maintenance_blocks.sql'),
  'utf8',
);
const planningMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260721150000_planning_batch_transactional_apply.sql'),
  'utf8',
);

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const headerStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.planning_assert_worker_task_valid');
const bodyStart = migration.indexOf('BEGIN', headerStart);
const bodyEnd = migration.indexOf('END $$;', bodyStart);
assert.ok(headerStart >= 0 && bodyStart > headerStart && bodyEnd > bodyStart, 'debe existir la función redefinida');

const header = normalize(migration.slice(headerStart, bodyStart));
assert.match(
  header,
  /^CREATE OR REPLACE FUNCTION public\.planning_assert_worker_task_valid\( _cleaner_id uuid,_task_id uuid,_date date,_start time,_end time,_status text \) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS \$\$$/,
  'cabecera exacta con firma y atributos',
);

const body = normalize(migration.slice(bodyStart, bodyEnd));
assert.match(
  body,
  /^BEGIN IF COALESCE\(_status,'pending'\) IN \('completed','cancelled'\) THEN RETURN; END IF;/,
  'debe conservar el early return de tareas completadas/canceladas',
);
for (const expected of [
  'PLANNING_WORKER_INACTIVE',
  'PLANNING_OUTSIDE_AVAILABILITY',
  'PLANNING_WORKER_ABSENT',
  'PLANNING_WORKER_FIXED_DAY_OFF',
  'PLANNING_EXTERNAL_OVERLAP',
]) {
  assert.match(body, new RegExp(`RAISE EXCEPTION '${expected}' USING ERRCODE='23514';`), `debe conservarse ${expected}`);
}
assert.equal((body.match(/IF (?:NOT )?EXISTS\(SELECT/g) || []).length, 5, 'debe haber exactamente cinco validaciones');
assert.doesNotMatch(body, /worker_maintenance_cleanings/i, 'la validación no debe consultar mantenimiento');
assert.doesNotMatch(body, /PLANNING_MAINTENANCE_OVERLAP/i, 'no debe rechazarse por solape con mantenimiento');
assert.match(body, /END IF;$/, 'el cuerpo debe cerrar sin ramas extra');
assert.match(migration.slice(bodyEnd, bodyEnd + 8), /^END \$\$;/, 'la función debe cerrar con END $$;');

const revoke = migration.slice(bodyEnd + 'END $$;'.length);
assert.match(
  normalize(revoke),
  /^REVOKE ALL ON FUNCTION public\.planning_assert_worker_task_valid\(uuid,uuid,date,time,time,text\) FROM PUBLIC,anon,authenticated;$/,
  'debe conservarse el REVOKE exacto',
);
assert.equal((migration.match(/planning_assert_worker_task_valid/g) || []).length, 2, 'la firma no debe duplicarse (sin overload)');
assert.doesNotMatch(migration, /DROP TRIGGER/i, 'la migración no debe tocar triggers');
assert.doesNotMatch(migration, /DELETE FROM public\.worker_maintenance_cleanings/i, 'la migración no debe borrar mantenimientos');
assert.doesNotMatch(migration, /INSERT INTO public\.worker_maintenance_cleanings/i, 'la migración no debe crear mantenimientos');

// Los triggers que llaman a la validación siguen registrados en el planificador.
assert.match(
  planningMigration,
  /CREATE TRIGGER trg_task_assignments_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public\.task_assignments/,
  'se conserva el trigger de asignaciones',
);
assert.match(
  planningMigration,
  /CREATE TRIGGER trg_tasks_planning_schedule_guard AFTER UPDATE OF date,start_time,end_time,status ON public\.tasks/,
  'se conserva el trigger de horario de tareas',
);
assert.match(
  planningMigration,
  /PERFORM public\.planning_assert_worker_task_valid/,
  'los triggers deben seguir llamando a la validación',
);
assert.match(
  planningMigration,
  /CREATE TRIGGER trg_worker_maintenance_planning_guard AFTER INSERT OR UPDATE OR DELETE ON public\.worker_maintenance_cleanings/,
  'se conserva el trigger del guard de mantenimiento',
);

// La propuesta de planificación conserva su aviso de solape con mantenimiento
// (es validación de propuesta, no bloqueo de movimiento manual de tareas).
assert.match(
  planningMigration,
  /'MAINTENANCE_OVERLAP'/,
  'el batch de planificación conserva su aviso de solape con mantenimiento',
);

console.log('worker-task-overlap-tests: OK');
