import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from '../supabase/functions/_shared/edgeAuthorization.ts';

function clientFor(options: {
  user?: { id: string } | null;
  userError?: unknown;
  roles?: Array<{ role: string }>;
  roleError?: unknown;
  onGetUser?: () => void;
}) {
  return {
    auth: {
      getUser: async () => {
        options.onGetUser?.();
        return {
          data: { user: options.user ?? null },
          error: options.userError ?? null,
        };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: async () => ({
              data: options.roles ?? [],
              error: options.roleError ?? null,
            }),
          }),
        }),
      }),
    }),
  } as any;
}

async function expectResponseStatus(promise: Promise<unknown>, expectedStatus: number) {
  try {
    await promise;
    throw new Error(`Expected authorization failure ${expectedStatus}`);
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    if (error.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, got ${error.status}`);
    }
  }
}

export async function run(assert: typeof import('node:assert/strict')) {
  const noAuth = new Request('https://example.test');
  await expectResponseStatus(
    assertAdminManagerOrServiceRole(noAuth, clientFor({}), 'service-secret'),
    401,
  );

  const invalid = new Request('https://example.test', {
    headers: { Authorization: 'Bearer invalid-user-token' },
  });
  await expectResponseStatus(
    assertAdminManagerOrServiceRole(
      invalid,
      clientFor({ userError: new Error('invalid') }),
      'service-secret',
    ),
    401,
  );

  const cleaner = new Request('https://example.test', {
    headers: { Authorization: 'Bearer cleaner-token' },
  });
  await expectResponseStatus(
    assertAdminManagerOrServiceRole(
      cleaner,
      clientFor({ user: { id: 'cleaner-id' }, roles: [] }),
      'service-secret',
    ),
    403,
  );

  const admin = await assertAdminManagerOrServiceRole(
    new Request('https://example.test', {
      headers: { Authorization: 'Bearer admin-token' },
    }),
    clientFor({ user: { id: 'admin-id' }, roles: [{ role: 'admin' }] }),
    'service-secret',
  );
  assert.deepEqual(admin, { kind: 'user', userId: 'admin-id', role: 'admin' });

  let serviceLookedUpAsUser = false;
  const service = await assertAdminManagerOrServiceRole(
    new Request('https://example.test', {
      headers: { Authorization: 'Bearer service-secret' },
    }),
    clientFor({ onGetUser: () => { serviceLookedUpAsUser = true; } }),
    'service-secret',
  );
  assert.deepEqual(service, { kind: 'service-role' });
  assert.equal(serviceLookedUpAsUser, false);

  let cronLookedUpAsUser = false;
  const cron = await assertAdminManagerOrServiceRole(
    new Request('https://example.test', {
      headers: {
        Authorization: 'Bearer public-anon-token',
        'X-Cron-Secret': 'dedicated-cron-secret',
      },
    }),
    clientFor({ onGetUser: () => { cronLookedUpAsUser = true; } }),
    'service-secret',
    {
      dedicatedSecret: {
        headerName: 'X-Cron-Secret',
        value: 'dedicated-cron-secret',
        actorKind: 'cron',
      },
    },
  );
  assert.deepEqual(cron, { kind: 'cron' });
  assert.equal(cronLookedUpAsUser, false);

  await expectResponseStatus(
    assertAdminManagerOrServiceRole(
      new Request('https://example.test', {
        headers: {
          Authorization: 'Bearer public-anon-token',
          'X-Cron-Secret': 'wrong-secret',
        },
      }),
      clientFor({ userError: new Error('anon is not a user session') }),
      'service-secret',
      {
        dedicatedSecret: {
          headerName: 'X-Cron-Secret',
          value: 'dedicated-cron-secret',
          actorKind: 'cron',
        },
      },
    ),
    401,
  );

  const authError = authorizationErrorResponse(
    new Response('Forbidden', { status: 403 }),
    { 'Access-Control-Allow-Origin': '*' },
  );
  assert.equal(authError?.status, 403);

  const repoRoot = process.cwd();
  const config = readFileSync(join(repoRoot, 'supabase/config.toml'), 'utf8');
  for (const functionName of [
    'hostaway-sync',
    'process-recurring-tasks',
    'hostaway-sync-with-retry',
    'manage-hostaway-cron',
    'setup-automation',
  ]) {
    assert.match(
      config,
      new RegExp(`\\[functions\\.${functionName}\\]\\s+verify_jwt = true`),
    );
  }
  assert.match(config, /\[functions\.little-hotelier-sync\]\s+verify_jwt = false/);

  for (const relativePath of [
    'supabase/functions/hostaway-sync/index.ts',
    'supabase/functions/process-recurring-tasks/index.ts',
    'supabase/functions/hostaway-sync-with-retry/index.ts',
    'supabase/functions/manage-hostaway-cron/index.ts',
    'supabase/functions/setup-automation/index.ts',
  ]) {
    const source = readFileSync(join(repoRoot, relativePath), 'utf8');
    assert.match(source, /assertAdminManagerOrServiceRole\(req,/);
    assert.match(source, /authorizationErrorResponse\(error, corsHeaders\)/);
  }

  const recurringSource = readFileSync(
    join(repoRoot, 'supabase/functions/process-recurring-tasks/index.ts'),
    'utf8',
  );
  assert.match(recurringSource, /RECURRING_TASKS_CRON_SECRET/);
  assert.match(recurringSource, /headerName:\s*'X-Cron-Secret'/);

  const setupAutomationSource = readFileSync(
    join(repoRoot, 'supabase/functions/setup-automation/index.ts'),
    'utf8',
  );
  assert.doesNotMatch(setupAutomationSource, /SELECT cron\.schedule/);
  assert.doesNotMatch(setupAutomationSource, /cronMessage/);
  assert.doesNotMatch(setupAutomationSource, /instructions\s*:/);

  const cronMigration = readFileSync(
    join(repoRoot, 'supabase/migrations/20260718131304_secure_recurring_tasks_cron.sql'),
    'utf8',
  );
  assert.match(cronMigration, /vault\.decrypted_secrets/);
  assert.match(cronMigration, /recurring_tasks_cron_bearer/);
  assert.match(cronMigration, /recurring_tasks_cron_secret/);
  assert.match(cronMigration, /X-Cron-Secret/);
  assert.doesNotMatch(cronMigration, /eyJ[A-Za-z0-9_-]+\./);

}
