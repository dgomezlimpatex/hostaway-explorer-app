import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceKind = "checkout" | "stay";
type SyncMode = "test" | "preview" | "sync";

interface AviratoReservationPayload {
  reservationId: number | string;
  operatorBookingId?: string | null;
  masterBookingId?: number | string | null;
  price?: number | string | null;
  status?: string | null;
  adults?: number | null;
  children?: number | null;
  startDate: string;
  endDate: string;
  agency?: string | null;
  segment?: string | null;
  client?: { name?: string | null; surname?: string | null } | null;
  space?: {
    spaceName?: string | null;
    spaceSubtypeName?: string | null;
    spaceSubtypeId?: number | string | null;
  } | null;
}

interface NormalizedReservation {
  external_id: string;
  operator_booking_id: string | null;
  master_booking_id: string | null;
  check_in: string;
  check_out: string;
  space_subtype_id: number | null;
  space_name: string;
  space_subtype_name: string | null;
  guest_name: string | null;
  adults: number;
  children: number;
  status: string;
  normalized_status: string;
  agency: string | null;
  segment: string | null;
  total_amount: number | null;
  source_system: "avirato";
}

interface Mapping {
  id: string;
  sede_id: string;
  space_subtype_id: number;
  space_name: string;
  service_kind: ServiceKind;
  cliente_id: string;
  propiedad_id: string;
  task_type: string;
  default_start_time: string;
  default_duration_min: number;
  default_cost: number;
  is_active: boolean;
}

interface SyncStats {
  reservations_processed: number;
  reservations_new: number;
  reservations_updated: number;
  reservations_cancelled: number;
  blocks_detected: number;
  stay_tasks_created: number;
  checkout_tasks_created: number;
  tasks_cancelled: number;
  missing_mappings: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function madridToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00Z`).getTime();
  const d2 = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((d2 - d1) / 86400000);
}

function minutesToEnd(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeStatus(status: string | null | undefined): string {
  const s = normalizeText(status);
  if (!s) return "unknown";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("elimin")) return "deleted";
  if (s.includes("no show") || s.includes("noshow")) return "no_show";
  if (s.includes("bloque")) return "block";
  if (s.includes("check in") || s.includes("check-in")) return "check_in";
  if (s.includes("confirm")) return "confirmed";
  return s.replace(/\s+/g, "_");
}

function isCancelled(status: string): boolean {
  return ["cancelled", "deleted", "no_show"].includes(status);
}

function isBlock(status: string): boolean {
  return status === "block";
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeReservation(input: AviratoReservationPayload): NormalizedReservation {
  const guestName = [input.client?.name, input.client?.surname].filter(Boolean).join(" ").trim();
  const status = input.status ?? "Sin estado";
  const normalizedStatus = normalizeStatus(status);
  const spaceSubtypeId = toNumber(input.space?.spaceSubtypeId);
  const spaceName =
    input.space?.spaceName?.trim() ||
    input.space?.spaceSubtypeName?.trim() ||
    `Alojamiento ${spaceSubtypeId ?? "sin id"}`;

  return {
    external_id: String(input.reservationId),
    operator_booking_id: input.operatorBookingId ? String(input.operatorBookingId) : null,
    master_booking_id: input.masterBookingId ? String(input.masterBookingId) : null,
    check_in: toDateOnly(input.startDate),
    check_out: toDateOnly(input.endDate),
    space_subtype_id: spaceSubtypeId,
    space_name: spaceName,
    space_subtype_name: input.space?.spaceSubtypeName ?? null,
    guest_name: guestName || null,
    adults: Number(input.adults ?? 0),
    children: Number(input.children ?? 0),
    status,
    normalized_status: normalizedStatus,
    agency: input.agency ?? null,
    segment: input.segment ?? null,
    total_amount: toNumber(input.price),
    source_system: "avirato",
  };
}

async function aviratoLogin(baseUrl: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error(`Login Avirato fallido (${response.status})`);
  return body.token;
}

async function fetchReservations(
  baseUrl: string,
  token: string,
  webCode: string,
  startDate: string,
  endDate: string,
): Promise<AviratoReservationPayload[]> {
  const params = new URLSearchParams({
    startDate: `${startDate} 00:00:00`,
    endDate: `${endDate} 23:59:59`,
    webCode,
  });
  const response = await fetch(`${baseUrl}/reservation/betweenDates?${params}`, {
    headers: { accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`betweenDates Avirato fallido (${response.status})`);
  if (Array.isArray(body?.bookings?.reservations)) return body.bookings.reservations;
  if (Array.isArray(body?.reservations)) return body.reservations;
  if (Array.isArray(body)) return body;
  return [];
}

async function insertSyncError(
  supabase: any,
  logId: string | null,
  type: string,
  message: string,
  details: Record<string, unknown>,
) {
  await supabase.from("avirato_sync_errors").insert({
    sync_log_id: logId,
    error_type: type,
    message,
    details,
    resolved: false,
  });
}

async function assertAdminOrInternal(req: Request, supabase: any, serviceKey: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("No autorizado");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw new Error("No autorizado");

  const { data: role, error: roleError } = await supabase.rpc("get_user_role", {
    _user_id: userData.user.id,
  });
  if (roleError || !["admin", "manager"].includes(role)) throw new Error("No autorizado");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
  const body = await req.json().catch(() => ({}));
  const mode: SyncMode = body.mode === "test" || body.mode === "preview" ? body.mode : "sync";
  const baseUrl = (Deno.env.get("AVIRATO_API_BASE_URL") ?? "https://apiv2.avirato.com").replace(/\/$/, "");
  const email = Deno.env.get("AVIRATO_API_EMAIL") ?? "";
  const password = Deno.env.get("AVIRATO_API_PASSWORD") ?? "";
  const webCode = Deno.env.get("AVIRATO_WEB_CODE") ?? "1741386";
  const missingSecrets = [
    !email ? "AVIRATO_API_EMAIL" : null,
    !password ? "AVIRATO_API_PASSWORD" : null,
    !webCode ? "AVIRATO_WEB_CODE" : null,
  ].filter(Boolean);

  if (missingSecrets.length > 0) {
    return json({ success: false, error: "Faltan secretos de Avirato en Supabase", requiredSecrets: missingSecrets }, 400);
  }

  const today = madridToday();
  const startDate = body.startDate || addDays(today, -7);
  const endDate = body.endDate || addDays(today, 180);
  const stats: SyncStats = {
    reservations_processed: 0,
    reservations_new: 0,
    reservations_updated: 0,
    reservations_cancelled: 0,
    blocks_detected: 0,
    stay_tasks_created: 0,
    checkout_tasks_created: 0,
    tasks_cancelled: 0,
    missing_mappings: 0,
  };
  let syncLogId: string | null = null;
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    await assertAdminOrInternal(req, supabase, serviceKey);

    const token = await aviratoLogin(baseUrl, email, password);
    if (mode === "test") return json({ success: true, message: "Conexion con Avirato correcta", webCode, baseUrl });

    const reservations = (await fetchReservations(baseUrl, token, webCode, startDate, endDate))
      .map(normalizeReservation)
      .filter((r) => r.external_id && r.check_in && r.check_out);

    stats.reservations_processed = reservations.length;

    if (mode === "preview") {
      const spaces = Array.from(
        new Map(
          reservations
            .filter((r) => r.space_subtype_id !== null)
            .map((r) => [
              r.space_subtype_id,
              {
                space_subtype_id: r.space_subtype_id,
                space_name: r.space_name,
                space_subtype_name: r.space_subtype_name,
                reservations: reservations.filter((x) => x.space_subtype_id === r.space_subtype_id).length,
              },
            ]),
        ).values(),
      );
      return json({
        success: true,
        preview: true,
        range: { startDate, endDate },
        summary: {
          reservations: reservations.length,
          active: reservations.filter((r) => !isCancelled(r.normalized_status) && !isBlock(r.normalized_status)).length,
          cancelled: reservations.filter((r) => isCancelled(r.normalized_status)).length,
          blocks: reservations.filter((r) => isBlock(r.normalized_status)).length,
          detectedSpaces: spaces.length,
        },
        reservations: reservations.slice(0, 200),
        spaces,
      });
    }

    const { data: syncLog } = await supabase
      .from("avirato_sync_logs")
      .insert({
        triggered_by: body.triggered_by ?? "manual",
        preview: false,
        start_date: startDate,
        end_date: endDate,
        status: "running",
        reservations_processed: reservations.length,
        result: { started_at: new Date().toISOString() },
      })
      .select("id")
      .single();
    syncLogId = syncLog?.id ?? null;

    for (const reservationPayload of reservations) {
      try {
        const { data: existing } = await supabase
          .from("avirato_reservations")
          .select("*")
          .eq("external_id", reservationPayload.external_id)
          .maybeSingle();

        const { data: reservation, error: upsertError } = await supabase
          .from("avirato_reservations")
          .upsert({ ...reservationPayload, synced_at: new Date().toISOString() }, { onConflict: "external_id" })
          .select("*")
          .single();

        if (upsertError || !reservation) {
          throw new Error(`No se pudo guardar reserva ${reservationPayload.external_id}: ${upsertError?.message}`);
        }

        if (!existing) stats.reservations_new += 1;
        else if (
          existing.check_in !== reservation.check_in ||
          existing.check_out !== reservation.check_out ||
          existing.space_subtype_id !== reservation.space_subtype_id ||
          existing.normalized_status !== reservation.normalized_status
        ) {
          stats.reservations_updated += 1;
        }

        const cancelled = isCancelled(reservation.normalized_status);
        const block = isBlock(reservation.normalized_status);
        if (cancelled) stats.reservations_cancelled += 1;
        if (block) {
          stats.blocks_detected += 1;
          warnings.push(`Bloqueo detectado: ${reservation.space_name} ${reservation.check_in} - ${reservation.check_out}`);
          await insertSyncError(supabase, syncLogId, "block_review", "Bloqueo importado que requiere revision", {
            reservation_external_id: reservation.external_id,
            space_subtype_id: reservation.space_subtype_id,
            space_name: reservation.space_name,
            check_in: reservation.check_in,
            check_out: reservation.check_out,
          });
        }

        const { data: existingLinks } = await supabase
          .from("avirato_reservation_tasks")
          .select("*")
          .eq("reservation_id", reservation.id);

        const linkMap = new Map<string, any>();
        (existingLinks ?? []).forEach((link: any) => {
          linkMap.set(`${link.space_subtype_id}|${link.service_kind}|${link.task_date}`, link);
        });

        const desired = new Map<string, { kind: ServiceKind; date: string; mapping: Mapping }>();

        if (!cancelled && !block && reservation.space_subtype_id !== null) {
          const { data: mappings } = await supabase
            .from("avirato_room_mapping")
            .select("*")
            .eq("space_subtype_id", reservation.space_subtype_id)
            .eq("is_active", true);

          const mappingByKind = new Map<ServiceKind, Mapping>();
          (mappings ?? []).forEach((m: any) => mappingByKind.set(m.service_kind, m));

          if (!reservation.sede_id && mappings?.[0]?.sede_id) {
            await supabase.from("avirato_reservations").update({ sede_id: mappings[0].sede_id }).eq("id", reservation.id);
          }

          const checkoutMap = mappingByKind.get("checkout");
          const stayMap = mappingByKind.get("stay");

          if (!checkoutMap) {
            stats.missing_mappings += 1;
            const msg = `Sin mapeo checkout para ${reservation.space_name} (${reservation.space_subtype_id})`;
            warnings.push(msg);
            await insertSyncError(supabase, syncLogId, "missing_mapping", msg, {
              reservation_external_id: reservation.external_id,
              space_subtype_id: reservation.space_subtype_id,
              space_name: reservation.space_name,
              service_kind: "checkout",
            });
          } else {
            desired.set(`${reservation.space_subtype_id}|checkout|${reservation.check_out}`, {
              kind: "checkout",
              date: reservation.check_out,
              mapping: checkoutMap,
            });
          }

          if (!stayMap) {
            stats.missing_mappings += 1;
            const msg = `Sin mapeo stay para ${reservation.space_name} (${reservation.space_subtype_id})`;
            warnings.push(msg);
            await insertSyncError(supabase, syncLogId, "missing_mapping", msg, {
              reservation_external_id: reservation.external_id,
              space_subtype_id: reservation.space_subtype_id,
              space_name: reservation.space_name,
              service_kind: "stay",
            });
          } else {
            const nights = diffDays(reservation.check_in, reservation.check_out);
            for (let i = 1; i <= nights - 1; i += 1) {
              const taskDate = addDays(reservation.check_in, i);
              desired.set(`${reservation.space_subtype_id}|stay|${taskDate}`, {
                kind: "stay",
                date: taskDate,
                mapping: stayMap,
              });
            }
          }
        }

        for (const [key, desiredTask] of desired.entries()) {
          const existingLink = linkMap.get(key);
          if (existingLink?.status === "active" && existingLink.task_id) continue;
          if (!existingLink && desiredTask.date < today) continue;

          const mapping = desiredTask.mapping;
          const startTime = mapping.default_start_time.slice(0, 5);
          const endTime = minutesToEnd(startTime, mapping.default_duration_min);
          const { data: property } = await supabase
            .from("properties")
            .select("nombre, direccion, check_in_predeterminado, check_out_predeterminado")
            .eq("id", mapping.propiedad_id)
            .single();

          const notes = [
            `[AVIRATO ${reservation.operator_booking_id ?? reservation.external_id}]`,
            `Alojamiento: ${reservation.space_name}`,
            desiredTask.kind === "checkout" ? "Limpieza de salida" : "Limpieza diaria",
            reservation.guest_name ? `Huesped: ${reservation.guest_name}` : null,
            reservation.agency ? `Canal: ${reservation.agency}` : null,
          ]
            .filter(Boolean)
            .join(" - ");

          const { data: task, error: taskError } = await supabase
            .from("tasks")
            .insert({
              property: property?.nombre ?? reservation.space_name,
              address: property?.direccion ?? "",
              date: desiredTask.date,
              start_time: startTime,
              end_time: endTime,
              check_in: property?.check_in_predeterminado ?? "15:00",
              check_out: property?.check_out_predeterminado ?? "11:00",
              type: mapping.task_type,
              status: "pending",
              duracion: mapping.default_duration_min,
              coste: mapping.default_cost,
              propiedad_id: mapping.propiedad_id,
              cliente_id: mapping.cliente_id,
              sede_id: mapping.sede_id,
              cleaner: null,
              cleaner_id: null,
              background_color: desiredTask.kind === "checkout" ? "#3B82F6" : "#10B981",
              notes,
            })
            .select("id")
            .single();

          if (taskError || !task) {
            const msg = `No se pudo crear tarea ${desiredTask.kind} ${desiredTask.date} para ${reservation.space_name}: ${taskError?.message ?? "error desconocido"}`;
            warnings.push(msg);
            await insertSyncError(supabase, syncLogId, "task_create_failed", msg, {
              reservation_external_id: reservation.external_id,
              task_date: desiredTask.date,
              service_kind: desiredTask.kind,
            });
            continue;
          }

          await supabase.from("avirato_reservation_tasks").upsert(
            {
              reservation_id: reservation.id,
              task_id: task.id,
              space_subtype_id: reservation.space_subtype_id,
              space_name: reservation.space_name,
              service_kind: desiredTask.kind,
              task_date: desiredTask.date,
              status: "active",
            },
            { onConflict: "reservation_id,space_subtype_id,service_kind,task_date" },
          );

          if (desiredTask.kind === "checkout") stats.checkout_tasks_created += 1;
          else stats.stay_tasks_created += 1;
        }

        for (const link of existingLinks ?? []) {
          const key = `${link.space_subtype_id}|${link.service_kind}|${link.task_date}`;
          if (desired.has(key)) continue;
          if (link.status !== "active" || !link.task_id) continue;
          if (link.task_date < today) continue;
          const { data: task } = await supabase.from("tasks").select("status").eq("id", link.task_id).maybeSingle();
          if (task?.status === "completed") continue;
          await supabase.from("tasks").delete().eq("id", link.task_id);
          await supabase.from("avirato_reservation_tasks").update({ status: "cancelled" }).eq("id", link.id);
          stats.tasks_cancelled += 1;
        }
      } catch (reservationError) {
        const msg = reservationError instanceof Error ? reservationError.message : String(reservationError);
        errors.push(msg);
        await insertSyncError(supabase, syncLogId, "reservation_failed", msg, {
          reservation_external_id: reservationPayload.external_id,
        });
      }
    }

    await supabase
      .from("avirato_sync_logs")
      .update({
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        completed_at: new Date().toISOString(),
        reservations_new: stats.reservations_new,
        reservations_updated: stats.reservations_updated,
        reservations_cancelled: stats.reservations_cancelled,
        blocks_detected: stats.blocks_detected,
        stay_tasks_created: stats.stay_tasks_created,
        checkout_tasks_created: stats.checkout_tasks_created,
        tasks_cancelled: stats.tasks_cancelled,
        warnings,
        errors,
        result: { stats, warnings, errors },
      })
      .eq("id", syncLogId);

    return json({ success: errors.length === 0, sync_log_id: syncLogId, range: { startDate, endDate }, stats, warnings, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (syncLogId) {
      await supabase
        .from("avirato_sync_logs")
        .update({ status: "failed", completed_at: new Date().toISOString(), errors: [message], result: { error: message } })
        .eq("id", syncLogId);
    }
    return json({ success: false, error: message }, 500);
  }
});
