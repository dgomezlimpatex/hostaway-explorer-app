// Edge function: sync-employees-from-registro
// Modos:
//   - preview: trae empleados de REGISTRO y propone matches por nombre normalizado. NO escribe.
//   - link:    aplica decisiones manuales (set external_id en cleaners existentes o crea nuevos). Sí escribe.
//   - sync:    actualiza cleaners ya vinculados (con external_id) desde REGISTRO. NUNCA toca tasks, email, telefono, sede_id.
//
// Garantías:
//   - Nunca borra cleaners. Nunca actualiza tabla tasks. Nunca sobreescribe email/telefono.
//   - Solo admin/manager puede invocarla.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REGISTRO_URL = "https://rnipyxdozvrqevrfyaif.supabase.co/functions/v1/employees-api";

type RegistroEmployee = {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  pin?: string | null;
  category?: string | null;
  delegation_name?: string | null;
  office_name?: string | null;
  is_active?: boolean | null;
  hire_date?: string | null;
  updated_at?: string | null;
};

function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function publicRegistroEmployee(e: RegistroEmployee, fallbackName?: string) {
  return {
    id: e.id,
    name: fallbackName || e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
    first_name: e.first_name ?? null,
    last_name: e.last_name ?? null,
    email: e.email ?? null,
    phone: e.phone ?? null,
    dni: e.dni ?? null,
    pin: e.pin ?? null,
    category: e.category ?? null,
    delegation_name: e.delegation_name ?? null,
    office_name: e.office_name ?? null,
    is_active: e.is_active ?? null,
    hire_date: e.hire_date ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const registroToken = Deno.env.get('EMPLOYEES_API_TOKEN');

  try {
    // --- Auth: solo admin/manager ---
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    if (!roleRow || !['admin', 'manager'].includes(roleRow.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin/manager only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!registroToken) {
      return new Response(JSON.stringify({ error: 'EMPLOYEES_API_TOKEN no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode: 'preview' | 'link' | 'sync' | 'invite_pending' = body.mode || 'preview';
    const includeInactive: boolean = !!body.include_inactive;
    const since: string | undefined = body.since;

    // --- Helper: fetch from REGISTRO ---
    async function fetchRegistro(): Promise<RegistroEmployee[]> {
      const url = new URL(REGISTRO_URL);
      if (since) url.searchParams.set('since', since);
      if (includeInactive) url.searchParams.set('include_inactive', 'true');
      const r = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${registroToken}` }
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`REGISTRO ${r.status}: ${t.slice(0, 300)}`);
      }
      const json = await r.json();
      // El endpoint puede devolver array directo o { employees: [...] }
      return Array.isArray(json) ? json : (json.employees || json.data || []);
    }

    // ============== PREVIEW ==============
    if (mode === 'preview') {
      const employees = await fetchRegistro();

      const { data: cleaners, error: cErr } = await admin
        .from('cleaners')
        .select('id, name, email, external_id, is_active, sede_id');
      if (cErr) throw cErr;

      const linkedExternalIds = new Set(
        cleaners.filter(c => c.external_id).map(c => c.external_id as string)
      );

      const proposals = employees.map((e) => {
        const eName = e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
        const nNorm = normalizeName(eName);

        // Si ya está vinculado, marcar como linked
        if (e.id && linkedExternalIds.has(e.id)) {
          const linked = cleaners.find(c => c.external_id === e.id)!;
          return {
            registro: publicRegistroEmployee(e, eName),
            match_type: 'already_linked',
            cleaner: { id: linked.id, name: linked.name, email: linked.email },
            confidence: 1,
          };
        }

        // Match exacto por nombre normalizado (solo cleaners SIN external_id)
        const candidates = cleaners.filter(c => !c.external_id);
        const exact = candidates.find(c => normalizeName(c.name) === nNorm);
        if (exact) {
          return {
            registro: publicRegistroEmployee(e, eName),
            match_type: 'exact_name',
            cleaner: { id: exact.id, name: exact.name, email: exact.email },
            confidence: 1,
          };
        }

        // Match aproximado (Levenshtein <= 2)
        let best: { c: any; d: number } | null = null;
        for (const c of candidates) {
          const d = levenshtein(normalizeName(c.name), nNorm);
          if (d <= 2 && (!best || d < best.d)) best = { c, d };
        }
        if (best) {
          return {
            registro: publicRegistroEmployee(e, eName),
            match_type: 'fuzzy_name',
            cleaner: { id: best.c.id, name: best.c.name, email: best.c.email },
            confidence: 1 - best.d * 0.2,
            distance: best.d,
          };
        }

        return {
          registro: publicRegistroEmployee(e, eName),
          match_type: 'no_match',
          cleaner: null,
          confidence: 0,
        };
      });

      const cleanersWithoutMatch = cleaners.filter(c =>
        !c.external_id &&
        !proposals.some(p => p.cleaner?.id === c.id)
      ).map(c => ({ id: c.id, name: c.name, email: c.email, is_active: c.is_active }));

      const summary = {
        registro_total: employees.length,
        already_linked: proposals.filter(p => p.match_type === 'already_linked').length,
        exact: proposals.filter(p => p.match_type === 'exact_name').length,
        fuzzy: proposals.filter(p => p.match_type === 'fuzzy_name').length,
        no_match: proposals.filter(p => p.match_type === 'no_match').length,
        gestion_unmatched: cleanersWithoutMatch.length,
      };

      // Log en modo dry_run
      await admin.from('employee_sync_log').insert({
        triggered_by: 'manual',
        triggered_by_user: userId,
        dry_run: true,
        since_param: since || null,
        include_inactive: includeInactive,
        fetched: employees.length,
        success: true,
        duration_ms: Date.now() - startedAt,
        errors: [],
      });

      return new Response(JSON.stringify({
        ok: true,
        mode,
        summary,
        proposals,
        gestion_unmatched: cleanersWithoutMatch,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============== LINK ==============
    if (mode === 'link') {
      // body.links: [{ external_id: string, cleaner_id?: string, create_new?: bool, snapshot?: object }]
      const links: Array<{
        external_id: string;
        cleaner_id?: string;
        create_new?: boolean;
        snapshot?: Partial<RegistroEmployee>;
        sede_id?: string;
        access_email?: string | null;
        create_without_access?: boolean;
      }> = body.links || [];

      let linked = 0, created = 0;
      let invitations_sent = 0;
      const errors: any[] = [];
      const invitation_details: Array<{
        external_id: string;
        cleaner_id?: string | null;
        email: string | null;
        outcome: string;
        invitation_url?: string;
        error?: string;
      }> = [];
      const appUrl = req.headers.get('origin') || 'https://gestionlimpatex.vercel.app';
      const normalizeEmail = (value: string | null | undefined) => {
        const trimmed = (value || '').trim().toLowerCase();
        return trimmed || null;
      };
      const buildInvitationUrl = (token: string, email: string) =>
        `${appUrl}/accept-invitation?token=${token}&email=${encodeURIComponent(email)}`;

      // Helper: tras crear/vincular cleaner, intentar invitar al email
      async function maybeInviteEmail(params: {
        externalId: string;
        cleanerId?: string | null;
        email: string | null | undefined;
        sedeId: string | null;
        skipInvitation?: boolean;
      }) {
        const emailLower = normalizeEmail(params.email);
        const externalId = params.externalId;
        const sedeId = params.sedeId;
        if (params.skipInvitation || !emailLower) {
          invitation_details.push({ external_id: externalId, cleaner_id: params.cleanerId ?? null, email: emailLower, outcome: 'no_email' });
          return;
        }
        try {
          // ¿Ya existe usuario en auth.users con ese email?
          // Usamos admin.listUsers con filter (paginar puede ser caro; mejor consulta directa a profiles)
          const { data: existingProfile } = await admin
            .from('profiles')
            .select('id, email')
            .eq('email', emailLower)
            .maybeSingle();
          if (existingProfile) {
            const { data: existingRole } = await admin
              .from('user_roles')
              .select('role')
              .eq('user_id', existingProfile.id)
              .maybeSingle();

            if (existingRole) {
              if (params.cleanerId) {
                await admin
                  .from('cleaners')
                  .update({ user_id: existingProfile.id, email: emailLower, is_active: true })
                  .eq('id', params.cleanerId)
                  .is('user_id', null);
              }

              if (sedeId) {
                await admin.from('user_sede_access').upsert({
                  user_id: existingProfile.id,
                  sede_id: sedeId,
                  can_access: true,
                }, { onConflict: 'user_id,sede_id' });
              }

              invitation_details.push({
                external_id: externalId,
                cleaner_id: params.cleanerId ?? null,
                email: emailLower,
                outcome: 'already_has_access',
              });
              return;
            }
          }

          // ¿Ya hay invitación pendiente?
          const { data: pending } = await admin
            .from('user_invitations')
            .select('id, invitation_token')
            .eq('email', emailLower)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          if (pending) {
            const invitationUrl = buildInvitationUrl(String(pending.invitation_token), emailLower);
            const { error: emailErr } = await admin.functions.invoke('send-invitation-email', {
              body: {
                email: emailLower,
                inviterName: 'LIMPATEX',
                role: 'cleaner',
                token: pending.invitation_token,
                appUrl,
              },
            });
            if (emailErr) {
              invitation_details.push({
                external_id: externalId,
                cleaner_id: params.cleanerId ?? null,
                email: emailLower,
                outcome: 'email_failed',
                invitation_url: invitationUrl,
                error: emailErr.message,
              });
            } else {
              invitations_sent++;
              invitation_details.push({
                external_id: externalId,
                cleaner_id: params.cleanerId ?? null,
                email: emailLower,
                outcome: 'resent_pending',
                invitation_url: invitationUrl,
              });
            }
            return;
          }

          if (!sedeId) {
            invitation_details.push({ external_id: externalId, cleaner_id: params.cleanerId ?? null, email: emailLower, outcome: 'no_sede' });
            return;
          }

          // Crear invitación (insert directo con service role; el cleaner ya está en su sede)
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
          const { error: invErr } = await admin
            .from('user_invitations')
            .insert({
              invitation_token: token,
              email: emailLower,
              role: 'cleaner',
              invited_by: userId,
              expires_at: expiresAt,
              status: 'pending',
              sede_id: sedeId,
            });
          if (invErr) throw invErr;

          // Disparar email
          const invitationUrl = buildInvitationUrl(token, emailLower);
          const { error: emailErr } = await admin.functions.invoke('send-invitation-email', {
            body: {
              email: emailLower,
              inviterName: 'LIMPATEX',
              role: 'cleaner',
              token,
              appUrl,
            },
          });
          if (emailErr) {
            invitation_details.push({
              external_id: externalId,
              cleaner_id: params.cleanerId ?? null,
              email: emailLower,
              outcome: 'email_failed',
              invitation_url: invitationUrl,
              error: emailErr.message,
            });
          } else {
            invitations_sent++;
            invitation_details.push({
              external_id: externalId,
              cleaner_id: params.cleanerId ?? null,
              email: emailLower,
              outcome: 'invited',
              invitation_url: invitationUrl,
            });
          }
        } catch (e: any) {
          invitation_details.push({
            external_id: externalId,
            cleaner_id: params.cleanerId ?? null,
            email: emailLower,
            outcome: 'invite_error',
            error: e.message,
          });
        }
      }

      for (const l of links) {
        try {
          if (!l.external_id) throw new Error('external_id requerido');

          if (l.create_new) {
            if (!l.sede_id) throw new Error('sede_id requerido para crear nuevo cleaner');
            const s = l.snapshot || {};
            const fullName = s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin nombre';
            const accessEmail = normalizeEmail(l.access_email ?? s.email ?? null);
            const { data: insertedCleaner, error } = await admin.from('cleaners').insert({
              name: fullName,
              first_name: s.first_name || null,
              last_name: s.last_name || null,
              email: accessEmail,
              telefono: s.phone || null,
              dni: s.dni || null,
              pin: s.pin || null,
              category: s.category || null,
              delegation_name: s.delegation_name || null,
              office_name: s.office_name || null,
              external_id: l.external_id,
              is_active: s.is_active ?? true,
              start_date: s.hire_date || null,
              sede_id: l.sede_id,
            }).select('id').single();
            if (error) throw error;
            created++;
            await maybeInviteEmail({
              externalId: l.external_id,
              cleanerId: insertedCleaner?.id ?? null,
              email: accessEmail,
              sedeId: l.sede_id,
              skipInvitation: l.create_without_access,
            });
          } else {
            if (!l.cleaner_id) throw new Error('cleaner_id requerido para vincular');
            const accessEmail = normalizeEmail(l.access_email ?? null);
            const patch: Record<string, unknown> = { external_id: l.external_id };
            if (accessEmail) patch.email = accessEmail;
            const { error } = await admin
              .from('cleaners')
              .update(patch)
              .eq('id', l.cleaner_id);
            if (error) throw error;
            linked++;

            // Tras vincular, consultar email/sede del cleaner para intentar invitar
            const { data: c } = await admin
              .from('cleaners')
              .select('email, sede_id, user_id')
              .eq('id', l.cleaner_id)
              .maybeSingle();
            if (c && !c.user_id) {
              await maybeInviteEmail({
                externalId: l.external_id,
                cleanerId: l.cleaner_id,
                email: accessEmail ?? c.email,
                sedeId: c.sede_id,
                skipInvitation: l.create_without_access,
              });
            }
          }
        } catch (e: any) {
          errors.push({ external_id: l.external_id, error: e.message });
        }
      }

      await admin.from('employee_sync_log').insert({
        triggered_by: 'link_decision',
        triggered_by_user: userId,
        dry_run: false,
        fetched: links.length,
        created,
        linked,
        success: errors.length === 0,
        duration_ms: Date.now() - startedAt,
        errors,
      });

      return new Response(JSON.stringify({ ok: true, linked, created, invitations_sent, invitation_details, errors }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============== SYNC ==============
    if (mode === 'sync') {
      const employees = await fetchRegistro();
      const byId = new Map(employees.map(e => [e.id, e]));

      const { data: linkedCleaners, error: lcErr } = await admin
        .from('cleaners')
        .select('id, name, first_name, last_name, dni, pin, category, delegation_name, office_name, is_active, start_date, external_id')
        .not('external_id', 'is', null);
      if (lcErr) throw lcErr;

      let updated = 0, deactivated = 0;
      const errors: any[] = [];

      for (const c of linkedCleaners) {
        const e = byId.get(c.external_id as string);
        if (!e) continue; // No aparece → no hacemos nada

        const fullName = e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim();
        const patch: Record<string, any> = {};
        // Campos SÍ sincronizados
        if (fullName && fullName !== c.name) patch.name = fullName;
        if ((e.first_name ?? null) !== c.first_name) patch.first_name = e.first_name ?? null;
        if ((e.last_name ?? null) !== c.last_name) patch.last_name = e.last_name ?? null;
        if ((e.dni ?? null) !== c.dni) patch.dni = e.dni ?? null;
        if ((e.pin ?? null) !== c.pin) patch.pin = e.pin ?? null;
        if ((e.category ?? null) !== c.category) patch.category = e.category ?? null;
        if ((e.delegation_name ?? null) !== c.delegation_name) patch.delegation_name = e.delegation_name ?? null;
        if ((e.office_name ?? null) !== c.office_name) patch.office_name = e.office_name ?? null;
        if (e.hire_date && e.hire_date !== c.start_date) patch.start_date = e.hire_date;

        const wasActive = c.is_active;
        const newActive = e.is_active ?? true;
        if (wasActive !== newActive) {
          patch.is_active = newActive;
          if (!newActive && wasActive) deactivated++;
        }

        if (Object.keys(patch).length === 0) continue;

        try {
          const { error } = await admin.from('cleaners').update(patch).eq('id', c.id);
          if (error) throw error;
          updated++;
        } catch (e: any) {
          errors.push({ cleaner_id: c.id, external_id: c.external_id, error: e.message });
        }
      }

      await admin.from('employee_sync_log').insert({
        triggered_by: body.triggered_by || 'manual',
        triggered_by_user: userId,
        dry_run: false,
        since_param: since || null,
        include_inactive: includeInactive,
        fetched: employees.length,
        updated,
        deactivated,
        success: errors.length === 0,
        duration_ms: Date.now() - startedAt,
        errors,
      });

      return new Response(JSON.stringify({
        ok: true, fetched: employees.length, updated, deactivated, errors,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============== INVITE_PENDING ==============
    // Reenvía invitaciones a cleaners con email pero sin user_id ni invitación pendiente
    if (mode === 'invite_pending') {
      const { data: pendingCleaners, error: pErr } = await admin
        .from('cleaners')
        .select('id, name, email, sede_id, external_id')
        .is('user_id', null)
        .not('email', 'is', null)
        .eq('is_active', true);
      if (pErr) throw pErr;

      let invitations_sent = 0;
      const details: Array<{ cleaner_id: string; email: string | null; outcome: string; invitation_url?: string; error?: string }> = [];
      const appUrl = req.headers.get('origin') || 'https://gestionlimpatex.vercel.app';
      const buildInvitationUrl = (token: string, email: string) =>
        `${appUrl}/accept-invitation?token=${token}&email=${encodeURIComponent(email)}`;

      for (const c of pendingCleaners || []) {
        const emailLower = (c.email || '').trim().toLowerCase();
        if (!emailLower) { details.push({ cleaner_id: c.id, email: null, outcome: 'no_email' }); continue; }
        if (!c.sede_id) { details.push({ cleaner_id: c.id, email: emailLower, outcome: 'no_sede' }); continue; }
        try {
          const { data: existingProfile } = await admin
            .from('profiles').select('id').eq('email', emailLower).maybeSingle();
          if (existingProfile) {
            const { data: existingRole } = await admin
              .from('user_roles').select('role').eq('user_id', existingProfile.id).maybeSingle();
            if (existingRole) {
              await admin
                .from('cleaners')
                .update({ user_id: existingProfile.id, email: emailLower, is_active: true })
                .eq('id', c.id)
                .is('user_id', null);
              if (c.sede_id) {
                await admin.from('user_sede_access').upsert({
                  user_id: existingProfile.id,
                  sede_id: c.sede_id,
                  can_access: true,
                }, { onConflict: 'user_id,sede_id' });
              }
              details.push({ cleaner_id: c.id, email: emailLower, outcome: 'already_has_access' });
              continue;
            }
          }

          const { data: pending } = await admin
            .from('user_invitations').select('id, invitation_token')
            .eq('email', emailLower).eq('status', 'pending')
            .gt('expires_at', new Date().toISOString()).maybeSingle();
          if (pending) {
            const invitationUrl = buildInvitationUrl(String(pending.invitation_token), emailLower);
            const { error: emailErr } = await admin.functions.invoke('send-invitation-email', {
              body: { email: emailLower, inviterName: 'LIMPATEX', role: 'cleaner', token: pending.invitation_token, appUrl },
            });
            if (emailErr) {
              details.push({ cleaner_id: c.id, email: emailLower, outcome: 'email_failed', invitation_url: invitationUrl, error: emailErr.message });
            } else {
              invitations_sent++;
              details.push({ cleaner_id: c.id, email: emailLower, outcome: 'resent_pending', invitation_url: invitationUrl });
            }
            continue;
          }

          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
          const { error: invErr } = await admin.from('user_invitations').insert({
            invitation_token: token, email: emailLower, role: 'cleaner',
            invited_by: userId, expires_at: expiresAt, status: 'pending', sede_id: c.sede_id,
          });
          if (invErr) throw invErr;

          const { error: emailErr } = await admin.functions.invoke('send-invitation-email', {
            body: { email: emailLower, inviterName: 'LIMPATEX', role: 'cleaner', token, appUrl },
          });
          if (emailErr) {
            details.push({ cleaner_id: c.id, email: emailLower, outcome: 'email_failed', invitation_url: buildInvitationUrl(token, emailLower), error: emailErr.message });
          } else {
            invitations_sent++;
            details.push({ cleaner_id: c.id, email: emailLower, outcome: 'invited', invitation_url: buildInvitationUrl(token, emailLower) });
          }
        } catch (e: any) {
          details.push({ cleaner_id: c.id, email: emailLower, outcome: 'error', error: e.message });
        }
      }

      return new Response(JSON.stringify({ ok: true, invitations_sent, details }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'mode inválido. Usa preview|link|sync|invite_pending' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('sync-employees-from-registro error:', e);
    try {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from('employee_sync_log').insert({
        triggered_by: 'manual',
        dry_run: true,
        success: false,
        duration_ms: Date.now() - startedAt,
        errors: [{ error: e.message }],
      });
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
