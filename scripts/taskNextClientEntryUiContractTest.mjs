import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

const form = read('src/components/modals/task-details/TaskDetailsForm.tsx');
const section = read('src/components/modals/task-details/components/NextClientEntrySection.tsx');
const service = read('src/services/clientPortal/nextClientEntry.ts');
const migration = read('supabase/migrations/20260713120000_admin_next_client_entry.sql');

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

console.log('task-next-client-entry-ui-contract-tests: OK');
