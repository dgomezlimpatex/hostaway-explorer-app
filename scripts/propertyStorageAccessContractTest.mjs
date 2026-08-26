import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260825120000_property_storage_access.sql', 'utf8');
const storage = readFileSync('src/services/storage/propertyStorageAccessStorage.ts', 'utf8');
const editor = readFileSync('src/components/planning/building-crm/PropertyStorageAccessEditor.tsx', 'utf8');

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.property_storage_access/);
assert.match(migration, /UNIQUE \(property_id\)/);
assert.match(migration, /access_type TEXT NOT NULL DEFAULT 'shared'/);
assert.match(migration, /access_type IN \('shared', 'none'\)/);
assert.match(migration, /set_property_storage_access/);
assert.match(migration, /property_group_assignments/);
assert.match(migration, /stock_warehouses/);
assert.match(migration, /supervision_user_has_building_assignment/);
assert.match(storage, /property_storage_access/);
assert.match(storage, /set_property_storage_access/);
assert.match(editor, /usePropertyStorageAccess/);
assert.match(editor, /useSetPropertyStorageAccess/);
assert.match(editor, /Comparte el trastero del edificio/);
assert.match(editor, /Sin acceso a trastero/);

console.log('property-storage-access-contract-tests: OK');
