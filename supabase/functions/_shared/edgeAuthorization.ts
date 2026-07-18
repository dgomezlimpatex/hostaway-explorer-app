import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export type PrivilegedEdgeActor = {
  kind: 'service-role' | 'user' | 'cron';
  userId?: string;
  role?: string;
};

function extractBearer(req: Request): string | null {
  const header = req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export async function assertAdminManagerOrServiceRole(
  req: Request,
  supabaseAdmin: SupabaseClient,
  serviceRoleKey: string,
  options?: {
    dedicatedSecret?: {
      headerName: string;
      value: string;
      actorKind: 'cron';
    };
  },
): Promise<PrivilegedEdgeActor> {
  const token = extractBearer(req);
  if (!token) {
    throw new Response('Missing authorization', { status: 401 });
  }

  if (serviceRoleKey && token === serviceRoleKey) {
    return { kind: 'service-role' };
  }

  const dedicatedSecret = options?.dedicatedSecret;
  if (
    dedicatedSecret
    && await secretsMatch(req.headers.get(dedicatedSecret.headerName), dedicatedSecret.value)
  ) {
    return { kind: dedicatedSecret.actorKind };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Response('Invalid session', { status: 401 });
  }

  const { data: roles, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .in('role', ['admin', 'manager'])
    .limit(1);

  if (roleError) {
    console.error('Unable to verify privileged Edge Function role:', roleError);
    throw new Response('Unable to verify authorization', { status: 500 });
  }

  const role = roles?.[0]?.role;
  if (!role) {
    throw new Response('Forbidden', { status: 403 });
  }

  return {
    kind: 'user',
    userId: userData.user.id,
    role,
  };
}

export function authorizationErrorResponse(error: unknown, corsHeaders: HeadersInit): Response | null {
  if (!(error instanceof Response)) return null;
  return new Response(error.body, {
    status: error.status,
    statusText: error.statusText,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
