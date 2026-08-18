import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const form = read('src/components/modals/task-details/TaskDetailsForm.tsx');
const section = read('src/components/modals/task-details/components/NextClientEntrySection.tsx');
const service = read('src/services/clientPortal/nextClientEntry.ts');
const migration = read('supabase/migrations/20260713120000_admin_next_client_entry.sql');
const avantioMigration = read('supabase/migrations/20260713130000_include_avantio_in_admin_next_entry.sql');
const requestedAvantioMigration = read('supabase/migrations/20260818130000_allow_requested_avantio_next_entry.sql');
const refinedAvantioMigration = read('supabase/migrations/20260818150000_refine_admin_next_avantio_entry.sql');

assert.match(form, /userRole === ['"]admin['"][\s\S]*<NextClientEntrySection/, 'the section must render only for admin');
assert.doesNotMatch(form, /userRole !== ['"]cleaner['"][\s\S]*<NextClientEntrySection/, 'a broad non-cleaner check is not sufficient');
assert.match(form, /taskDate=\{formData\.date \?\? task\.date\}/, 'the query must follow edits to the task date');
assert.match(section, /Siguiente entrada:/, 'the task detail must show the requested label');
assert.match(section, /useQuery/, 'the entry must load automatically when the admin opens the task');
assert.match(section, /refetchOnMount:\s*['"]always['"]/, 'reopening the task must refresh potentially changed reservations');
assert.match(service, /rpc(?:Untyped)?\(['"]get_admin_next_client_entry['"]/, 'frontend must use the protected RPC');
assert.doesNotMatch(service, /\.from\(['"]client_reservations['"]/, 'frontend must not bypass the protected RPC');
assert.match(migration, /has_role\(auth\.uid\(\),\s*'admin'::public\.app_role\)/, 'the database must enforce the admin role');
assert.match(migration, /check_in_date\s*>=\s*_from_date/, 'the search must start on the task date');
assert.match(migration, /reservation\.status\s*<>\s*'cancelled'/, 'cancelled reservations must be ignored');
assert.match(migration, /ORDER BY reservation\.check_in_date ASC/, 'the nearest future entry must be returned');
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/i, 'anonymous callers must not execute the RPC');
assert.match(migration, /DROP POLICY IF EXISTS "Users can view all reservations"/, 'legacy authenticated-wide read access must be removed');
assert.match(migration, /CREATE POLICY "Operational roles can view client reservations"/, 'reservation reads must be restricted by operational role');
assert.doesNotMatch(migration, /has_role\(auth\.uid\(\), 'cleaner'/, 'cleaners must not be granted reservation reads');
assert.match(avantioMigration, /public\.client_reservations/, 'portal reservations must remain a source');
assert.match(avantioMigration, /public\.avantio_reservations/, 'Avantio reservations must also be a source');
assert.match(avantioMigration, /arrival_date\s*>=\s*_from_date/, 'Avantio entries must start on the task date');
assert.match(avantioMigration, /lower\([^)]*status[^)]*\)\s*(?:<>|NOT IN)/i, 'cancelled Avantio reservations must be ignored');
assert.match(avantioMigration, /cancellation_date\s+IS\s+NULL/i, 'cancelled Avantio rows must be ignored even if their status is stale');
for (const excludedStatus of ['cancelled', 'canceled', 'unavailable', 'unavaliable', 'requested', 'pending', 'tentative']) {
  assert.match(avantioMigration, new RegExp(`['"]${excludedStatus}['"]`), `Avantio status ${excludedStatus} must be ignored`);
}
assert.match(avantioMigration, /ORDER BY[\s\S]*check_in_date\s+ASC/i, 'the nearest entry across all sources must be returned');
assert.match(avantioMigration, /has_role\(auth\.uid\(\),\s*'admin'::public\.app_role\)/, 'the updated RPC must remain admin-only');
assert.match(requestedAvantioMigration, /public\.avantio_reservations/, 'Avantio reservations must remain a source');
assert.match(requestedAvantioMigration, /arrival_date\s+AS\s+check_in_date/i, 'Avantio entries must expose their arrival date');
assert.match(requestedAvantioMigration, /arrival_date\s+>=\s+_from_date/i, 'Avantio entries must start on the task date');
assert.match(requestedAvantioMigration, /cancellation_date\s+IS\s+NULL/i, 'cancelled Avantio rows must be ignored even if their status is stale');
assert.doesNotMatch(requestedAvantioMigration, /['"]requested['"]/i, 'REQUESTED Avantio entries must remain eligible for the informational card');
assert.match(requestedAvantioMigration, /['"]pending['"]/, 'pending Avantio entries must remain excluded');
assert.match(requestedAvantioMigration, /['"]tentative['"]/, 'tentative Avantio entries must remain excluded');
assert.match(requestedAvantioMigration, /ORDER BY[\s\S]*check_in_date\s+ASC/i, 'the nearest entry across all active sources must be returned');
assert.match(requestedAvantioMigration, /has_role\(auth\.uid\(\),\s*'admin'::public\.app_role\)/, 'the extended RPC must remain admin-only');

assert.match(refinedAvantioMigration, /public\.avantio_reservations/, 'the refined RPC must keep Avantio as a source');
assert.match(refinedAvantioMigration, /arrival_date\s*>\s*_from_date/i, 'the next entry must be strictly after the current task date');
assert.match(refinedAvantioMigration, /REQUESTED\/provisional/i, 'provisional REQUESTED Avantio entries must be documented as excluded');
assert.match(refinedAvantioMigration, /['"]confirmed['"]/i, 'confirmed Avantio entries must remain eligible');
assert.match(refinedAvantioMigration, /cancellation_date\s+IS\s+NULL/i, 'cancelled Avantio rows must remain excluded');
assert.match(refinedAvantioMigration, /ORDER BY[\s\S]*check_in_date\s+ASC/i, 'the nearest confirmed future entry must be returned');

console.log('task-next-client-entry-ui-contract-tests: OK');
