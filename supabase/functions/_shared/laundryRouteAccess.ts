export type RouteWorkerIdentity = {
  routeWorkerId: string;
  cleanerId: string;
  workerName: string;
  sedeId: string;
};

export type RouteWorkerOption = {
  id: string;
  cleanerId: string;
  name: string;
  sedeId: string;
};

type SupabaseLike = any;

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getRouteLink(supabase: SupabaseLike, token: string) {
  const { data: link, error } = await supabase
    .from('laundry_share_links')
    .select('id, token, sede_id, workflow_version, is_active, expires_at')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!link) return { error: 'Enlace no valido', status: 404 } as const;
  if (link.workflow_version !== 'route_v2') {
    return { error: 'El acceso por PIN solo esta disponible en el nuevo sistema de ruta', status: 400 } as const;
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { error: 'Enlace expirado', status: 410 } as const;
  }
  if (!link.sede_id) return { error: 'La ruta no tiene una sede configurada', status: 409 } as const;
  return { link } as const;
}

export async function listActiveRouteWorkers(
  supabase: SupabaseLike,
  sedeId: string,
): Promise<RouteWorkerOption[]> {
  const { data, error } = await supabase
    .from('laundry_route_workers')
    .select('id, cleaner_id, sede_id, cleaners!inner(id, name, is_active)')
    .eq('sede_id', sedeId)
    .eq('is_active', true)
    .eq('cleaners.is_active', true);

  if (error) throw error;
  return (data ?? [])
    .map((row: any) => {
      const cleaner = singleRelation(row.cleaners as { name?: string } | Array<{ name?: string }> | null);
      return {
        id: String(row.id),
        cleanerId: String(row.cleaner_id),
        name: String(cleaner?.name ?? 'Repartidor'),
        sedeId: String(row.sede_id),
      };
    })
    .sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
}

export async function validateRouteSession(
  supabase: SupabaseLike,
  shareLinkId: string,
  rawSessionToken: string,
): Promise<RouteWorkerIdentity | null> {
  if (!rawSessionToken) return null;
  const tokenHash = await sha256(rawSessionToken);
  const { data: session, error } = await supabase
    .from('laundry_route_sessions')
    .select(`
      id,
      expires_at,
      revoked_at,
      laundry_route_workers!inner(
        id,
        cleaner_id,
        sede_id,
        is_active,
        cleaners!inner(id, name, is_active)
      )
    `)
    .eq('share_link_id', shareLinkId)
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  const routeWorker = singleRelation(session?.laundry_route_workers as any);
  const cleaner = singleRelation(routeWorker?.cleaners as any);
  if (!session || !routeWorker?.is_active || !cleaner?.is_active) return null;

  await supabase
    .from('laundry_route_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    routeWorkerId: String(routeWorker.id),
    cleanerId: String(routeWorker.cleaner_id),
    workerName: String(cleaner.name),
    sedeId: String(routeWorker.sede_id),
  };
}
