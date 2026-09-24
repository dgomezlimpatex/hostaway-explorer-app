import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260917130000_allow_worker_maintenance_inserts_with_planning_conflicts.sql'),
  'utf8',
);
const triggerMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260721150000_planning_batch_transactional_apply.sql'),
  'utf8',
);
const scheduleSchemaMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260911122231_worker_schedule_availability.sql'),
  'utf8',
);

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

// Anchors en orden de aparición dentro de la función.
const classificationStart = migration.indexOf("IF TG_OP = 'UPDATE'");
const classificationThen = migration.indexOf('THEN', classificationStart);
const lockStart = migration.indexOf('PERFORM public.planning_lock_worker_dates');
const insertBypass = migration.indexOf("IF TG_OP = 'INSERT'");
const insertBypassThen = migration.indexOf('THEN', insertBypass);
const insertBypassEnd = migration.indexOf('END IF;', insertBypass);
const cleanerMatch = migration.indexOf('AND NEW.cleaner_id = OLD.cleaner_id');
const bypassStart = migration.lastIndexOf("IF TG_OP = 'UPDATE'", cleanerMatch);
const bypassThen = migration.indexOf('THEN', bypassStart);
const conflictGuard = migration.indexOf("IF TG_OP IN ('INSERT', 'UPDATE')", bypassStart);

// Estructura y orden de las ramas.
assert.ok(classificationStart >= 0, 'debe existir la excepción de reclasificación');
assert.ok(classificationStart < lockStart, 'la excepción de reclasificación debe preceder al lock');
assert.ok(insertBypass > lockStart, 'el bypass de creación debe conservar el lock de planificación');
assert.ok(insertBypass < conflictGuard, 'el bypass de creación debe preceder al guard de conflicto');
assert.ok(insertBypassThen < insertBypassEnd, 'el bypass de creación debe terminar antes del guard');
assert.ok(bypassStart > insertBypassEnd, 'el bypass de edición debe seguir al de creación');
assert.ok(bypassStart >= 0, 'debe existir el bypass de actualización');
assert.ok(conflictGuard > bypassStart, 'el guard de conflicto debe ser la última rama');

// Condiciones exactas (no pueden debilitarse sin romper el test).
assert.equal(
  normalize(migration.slice(classificationStart, classificationThen)),
  "IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'schedule_type' - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'schedule_type' - 'updated_at')",
  'la excepción de reclasificación debe conservarse exacta',
);
assert.equal(
  normalize(migration.slice(insertBypass, insertBypassThen)),
  "IF TG_OP = 'INSERT' AND NEW.schedule_type = 'maintenance'",
  'el bypass de creación debe limitarse exactamente a schedule_type=maintenance',
);
assert.doesNotMatch(
  migration.slice(insertBypass, insertBypassEnd),
  /NEW\.schedule_type\s*(?:<>|IN\b|LIKE|ILIKE)/i,
  'el bypass de creación no puede ampliarse a otros schedule_type',
);
assert.doesNotMatch(
  migration.slice(insertBypass, insertBypassThen),
  /is_active/i,
  'el bypass de creación no puede depender de is_active',
);
assert.equal(
  normalize(migration.slice(bypassStart, bypassThen)),
  "IF TG_OP = 'UPDATE' AND NEW.cleaner_id = OLD.cleaner_id AND OLD.schedule_type = 'maintenance' AND NEW.schedule_type = 'maintenance' AND OLD.is_active",
  'el bypass de edición debe conservarse exacto (mismo trabajador, maintenance activo)',
);
assert.doesNotMatch(
  migration.slice(bypassStart, bypassThen),
  /NEW\.schedule_type\s*(?:<>|IN\b|LIKE|ILIKE)/i,
  'el bypass de edición no puede ampliarse a otros schedule_type',
);

// Guard de conflictos conservado para indisponibilidad y casos no cubiertos,
// con cabecera y RAISE literales (un comentario no puede satisfacer estos checks).
const guardExistsStart = migration.indexOf('EXISTS(', conflictGuard);
assert.equal(
  normalize(migration.slice(conflictGuard, guardExistsStart)),
  "IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.is_active AND",
  'la cabecera del guard debe conservarse exacta',
);
assert.match(
  normalize(migration.slice(guardExistsStart, migration.indexOf('RAISE EXCEPTION', guardExistsStart))),
  /EXISTS\( SELECT 1 FROM public\.task_assignments ta JOIN public\.tasks t ON t\.id = ta\.task_id/,
  'el guard debe leer task_assignments/tasks por su clave exacta',
);
assert.match(
  migration.slice(conflictGuard),
  /RAISE EXCEPTION 'PLANNING_MAINTENANCE_CONFLICT' USING ERRCODE = '23514';/,
  'el guard debe lanzar PLANNING_MAINTENANCE_CONFLICT con ERRCODE 23514',
);

// Invariantes de control de flujo: un único bypass de creación y salidas exactas;
// cualquier retorno temprano adicional o incondicional debe romper el test.
const returnsBeforeGuard = migration.slice(0, conflictGuard).match(/RETURN\s/g) || [];
const returnsNewBeforeGuard = migration.slice(0, conflictGuard).match(/RETURN NEW;/g) || [];
const returnsAll = migration.match(/RETURN\s/g) || [];
const returnsNewAll = migration.match(/RETURN NEW;/g) || [];
assert.equal((migration.match(/IF TG_OP = 'INSERT'/g) || []).length, 1, 'debe existir un único bypass de creación');
assert.equal(returnsNewBeforeGuard.length, 3, 'deben existir exactamente tres salidas tempranas antes del guard');
assert.equal(returnsBeforeGuard.length, 3, 'no debe haber salidas incondicionales antes del guard');
assert.equal(returnsNewAll.length, 3, 'toda la función debe tener tres RETURN NEW;');
assert.equal(returnsAll.length, 4, 'toda la función debe tener cuatro salidas (incluido RETURN COALESCE)');

// Conservación de piezas estructurales.
assert.match(migration, /planning_lock_worker_dates/i, 'se conserva el lock de planificación');
assert.match(triggerMigration, /CREATE TRIGGER trg_worker_maintenance_planning_guard AFTER INSERT OR UPDATE OR DELETE/i, 'se conserva el trigger AFTER original');
assert.match(scheduleSchemaMigration, /ADD COLUMN schedule_type text NOT NULL DEFAULT 'maintenance'/i, 'schedule_type debe ser NOT NULL');
assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?public\.(?:tasks|task_assignments)\b/i, 'la migración no debe escribir tareas ni asignaciones');

// Tabla de verdad equivalente al contrato.
const canBypassMaintenanceUpdate = ({ oldCleaner, newCleaner, oldType, newType, oldActive, newActive }) => (
  oldCleaner === newCleaner
  && oldType === 'maintenance'
  && newType === 'maintenance'
  && oldActive
);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'a', oldType: 'maintenance', newType: 'maintenance', oldActive: true, newActive: true }), true);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'a', oldType: 'maintenance', newType: 'maintenance', oldActive: true, newActive: false }), true);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'a', oldType: 'maintenance', newType: 'maintenance', oldActive: false, newActive: true }), false);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'a', oldType: 'maintenance', newType: 'maintenance', oldActive: false, newActive: false }), false);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'b', oldType: 'maintenance', newType: 'maintenance', oldActive: true, newActive: true }), false);
assert.equal(canBypassMaintenanceUpdate({ oldCleaner: 'a', newCleaner: 'a', oldType: 'unavailability', newType: 'unavailability', oldActive: true, newActive: true }), false);

const canCreateMaintenance = ({ scheduleType }) => scheduleType === 'maintenance';
assert.equal(canCreateMaintenance({ scheduleType: 'maintenance' }), true, 'crear mantenimiento debe permitirse');
assert.equal(canCreateMaintenance({ scheduleType: 'unavailability' }), false, 'crear indisponibilidad debe seguir protegida');

console.log('worker-maintenance-conflict-tests: OK');
