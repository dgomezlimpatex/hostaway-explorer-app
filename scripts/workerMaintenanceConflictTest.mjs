import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260917120000_allow_worker_maintenance_updates_with_planning_conflicts.sql'),
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

const cleanerMatch = migration.indexOf('AND NEW.cleaner_id = OLD.cleaner_id');
const bypassStart = migration.lastIndexOf("IF TG_OP = 'UPDATE'", cleanerMatch);
const conflictGuard = migration.indexOf("IF TG_OP IN ('INSERT', 'UPDATE')", bypassStart);
assert.ok(cleanerMatch >= 0, 'debe existir la condición de mismo trabajador');
assert.ok(bypassStart >= 0, 'debe existir el bypass de actualización');
assert.ok(conflictGuard > bypassStart, 'el bypass debe preceder al guard de conflicto');
assert.match(migration.slice(bypassStart, conflictGuard), /NEW\.cleaner_id\s*=\s*OLD\.cleaner_id/i);
assert.match(migration.slice(bypassStart, conflictGuard), /OLD\.schedule_type\s*=\s*'maintenance'/i);
assert.match(migration.slice(bypassStart, conflictGuard), /NEW\.schedule_type\s*=\s*'maintenance'/i);
assert.match(migration.slice(bypassStart, conflictGuard), /AND OLD\.is_active/i, 'reactivar un bloque inactivo debe seguir protegido');
assert.match(migration.slice(bypassStart, conflictGuard), /RETURN NEW/i);
assert.match(
  migration.slice(conflictGuard),
  /IF TG_OP IN \('INSERT', 'UPDATE'\)[\s\S]*?PLANNING_MAINTENANCE_CONFLICT/i,
  'las altas nuevas deben conservar la protección de conflictos',
);
assert.match(migration, /planning_lock_worker_dates/i, 'se conserva el lock de planificación');
assert.match(triggerMigration, /CREATE TRIGGER trg_worker_maintenance_planning_guard AFTER INSERT OR UPDATE OR DELETE/i, 'se conserva el trigger AFTER original');
assert.match(scheduleSchemaMigration, /ADD COLUMN schedule_type text NOT NULL DEFAULT 'maintenance'/i, 'schedule_type debe ser NOT NULL');
assert.match(migration, /'schedule_type'\s*-\s*'updated_at'\)\s+IS NOT DISTINCT FROM/i, 'se conserva la excepción previa de reclasificación');
assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?public\.(?:tasks|task_assignments)\b/i, 'la migración no debe escribir tareas ni asignaciones');

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

console.log('worker-maintenance-conflict-tests: OK');
