// Little Hotelier sync — receives one reservation per POST from the Python script,
// upserts it, creates/updates the linked cleaning tasks (checkout + daily stay cleanings),
// and emails admins a summary when changes happen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceKind = "checkout" | "stay";

interface ReservationPayload {
  external_id: string;
  uuid?: string | null;
  reference?: string | null;
  channel?: string | null;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  room: string;
  guest_name?: string | null;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  status?: string | null;
  total?: string | null;
  synced_at?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function isCancelledStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "cancelled" || s === "canceled" || s === "no_show";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const expectedKey = Deno.env.get("LH_SYNC_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Auth via shared bearer token
  const authHeader = req.headers.get("Authorization") || "";
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: ReservationPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Minimal validation
  if (!payload.external_id || !payload.check_in || !payload.check_out || !payload.room) {
    await supabase.from("lh_sync_logs").insert({
      external_id: payload?.external_id ?? null,
      status_code: 400,
      success: false,
      payload,
      error_message: "Missing required fields",
    });
    return json(
      { error: "Faltan campos obligatorios: external_id, check_in, check_out, room" },
      400,
    );
  }

  const warnings: string[] = [];
  const changes = {
    reservation_created: false,
    reservation_updated: false,
    tasks_created: [] as Array<{ kind: ServiceKind; date: string; task_id: string }>,
    tasks_cancelled: [] as Array<{ kind: ServiceKind; date: string; task_id: string }>,
  };

  try {
    // 1) Fetch existing reservation (to detect diffs)
    const { data: existing } = await supabase
      .from("lh_reservations")
      .select("*")
      .eq("external_id", payload.external_id)
      .maybeSingle();

    const status = (payload.status ?? "confirmed").toLowerCase();

    // 2) Upsert reservation
    const upsertData = {
      external_id: payload.external_id,
      uuid: payload.uuid ?? null,
      reference: payload.reference ?? null,
      channel: payload.channel ?? null,
      check_in: payload.check_in,
      check_out: payload.check_out,
      room: payload.room,
      guest_name: payload.guest_name ?? null,
      adults: payload.adults ?? 0,
      children: payload.children ?? 0,
      infants: payload.infants ?? 0,
      status,
      total: payload.total ?? null,
      synced_at: payload.synced_at ?? new Date().toISOString(),
      source_system: "little_hotelier",
    };

    const { data: reservation, error: upErr } = await supabase
      .from("lh_reservations")
      .upsert(upsertData, { onConflict: "external_id" })
      .select()
      .single();

    if (upErr || !reservation) {
      throw new Error(`Upsert reserva fallido: ${upErr?.message}`);
    }

    if (!existing) changes.reservation_created = true;
    else if (
      existing.check_in !== reservation.check_in ||
      existing.check_out !== reservation.check_out ||
      existing.room !== reservation.room ||
      existing.status !== reservation.status
    ) {
      changes.reservation_updated = true;
    }

    // 3) Compute desired task plan from mappings
    type Mapping = {
      id: string;
      sede_id: string;
      service_kind: ServiceKind;
      cliente_id: string;
      propiedad_id: string;
      task_type: string;
      default_start_time: string;
      default_duration_min: number;
      default_cost: number;
      is_active: boolean;
    };

    const { data: mappings } = await supabase
      .from("lh_room_mapping")
      .select("*")
      .eq("lh_room", reservation.room)
      .eq("is_active", true);

    const mapByKind = new Map<ServiceKind, Mapping>();
    (mappings ?? []).forEach((m: any) => mapByKind.set(m.service_kind as ServiceKind, m));

    // Make sure reservation has sede_id (take it from any mapping)
    if (!reservation.sede_id) {
      const anyMapping = mappings?.[0];
      if (anyMapping?.sede_id) {
        await supabase
          .from("lh_reservations")
          .update({ sede_id: anyMapping.sede_id })
          .eq("id", reservation.id);
        reservation.sede_id = anyMapping.sede_id;
      }
    }

    if (!mapByKind.has("checkout")) {
      warnings.push(`Sin mapeo 'checkout' para habitación "${reservation.room}"`);
    }
    if (!mapByKind.has("stay")) {
      warnings.push(`Sin mapeo 'stay' para habitación "${reservation.room}"`);
    }

    // Build desired (kind, date) set
    const desired = new Map<string, { kind: ServiceKind; date: string }>();
    const cancelled = isCancelledStatus(reservation.status);

    if (!cancelled) {
      if (mapByKind.has("checkout")) {
        const key = `checkout|${reservation.check_out}`;
        desired.set(key, { kind: "checkout", date: reservation.check_out });
      }
      if (mapByKind.has("stay")) {
        const nights = diffDays(reservation.check_in, reservation.check_out);
        // stay cleanings: check_in+1 .. check_out-1 (inclusive)
        for (let i = 1; i <= nights - 1; i++) {
          const d = addDays(reservation.check_in, i);
          desired.set(`stay|${d}`, { kind: "stay", date: d });
        }
      }
    }

    // 4) Load existing links for this reservation
    const { data: existingLinks } = await supabase
      .from("lh_reservation_tasks")
      .select("*")
      .eq("reservation_id", reservation.id);

    const linkMap = new Map<string, any>();
    (existingLinks ?? []).forEach((l: any) =>
      linkMap.set(`${l.service_kind}|${l.task_date}`, l),
    );

    // 5) Create missing tasks
    const today = new Date().toISOString().slice(0, 10);
    for (const [key, item] of desired.entries()) {
      const link = linkMap.get(key);
      if (link && link.status === "active" && link.task_id) continue;

      const m = mapByKind.get(item.kind)!;
      const startTime = m.default_start_time.slice(0, 5);
      const endTime = minutesToEnd(startTime, m.default_duration_min);

      // Property details for nombre/direccion
      const { data: prop } = await supabase
        .from("properties")
        .select("nombre, direccion, sede_id")
        .eq("id", m.propiedad_id)
        .single();

      const notes = [
        `[LH ${reservation.reference ?? reservation.external_id}]`,
        item.kind === "checkout" ? "Limpieza de salida" : "Limpieza de estancia",
        reservation.guest_name ? `Huésped: ${reservation.guest_name}` : null,
        reservation.channel ? `Canal: ${reservation.channel}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const taskData: any = {
        property: prop?.nombre ?? reservation.room,
        address: prop?.direccion ?? "",
        date: item.date,
        start_time: startTime,
        end_time: endTime,
        type: m.task_type,
        status: "pending",
        duracion: m.default_duration_min,
        coste: m.default_cost,
        propiedad_id: m.propiedad_id,
        cliente_id: m.cliente_id,
        sede_id: m.sede_id,
        cleaner: null,
        cleaner_id: null,
        background_color: item.kind === "checkout" ? "#3B82F6" : "#10B981",
        notes,
      };

      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert(taskData)
        .select("id")
        .single();

      if (taskErr || !task) {
        warnings.push(
          `No se pudo crear tarea ${item.kind} ${item.date}: ${taskErr?.message ?? "desconocido"}`,
        );
        continue;
      }

      // Upsert link
      await supabase.from("lh_reservation_tasks").upsert(
        {
          reservation_id: reservation.id,
          task_id: task.id,
          service_kind: item.kind,
          task_date: item.date,
          status: "active",
        },
        { onConflict: "reservation_id,service_kind,task_date" },
      );

      changes.tasks_created.push({ kind: item.kind, date: item.date, task_id: task.id });
    }

    // 6) Cancel tasks that are no longer desired (or whole reservation cancelled).
    //    Skip past tasks that may already have been done / are out of our concern window.
    for (const link of existingLinks ?? []) {
      const key = `${link.service_kind}|${link.task_date}`;
      const stillWanted = desired.has(key);
      if (stillWanted || link.status !== "active" || !link.task_id) continue;

      // Only cancel future or today's pending tasks
      if (link.task_date < today) {
        continue;
      }

      // Check task status before cancelling
      const { data: t } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", link.task_id)
        .maybeSingle();

      if (t && t.status === "completed") {
        // leave completed tasks intact
        continue;
      }

      // Delete the task (consistent with hostaway flow)
      await supabase.from("tasks").delete().eq("id", link.task_id);
      await supabase
        .from("lh_reservation_tasks")
        .update({ status: "cancelled" })
        .eq("id", link.id);

      changes.tasks_cancelled.push({
        kind: link.service_kind,
        date: link.task_date,
        task_id: link.task_id,
      });
    }

    // 7) Log + respond
    const result = {
      reservation_id: reservation.id,
      external_id: reservation.external_id,
      cancelled,
      warnings,
      ...changes,
    };

    await supabase.from("lh_sync_logs").insert({
      external_id: reservation.external_id,
      status_code: 200,
      success: true,
      payload,
      result,
    });

    return json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("LH sync error:", message);
    await supabase.from("lh_sync_logs").insert({
      external_id: payload?.external_id ?? null,
      status_code: 500,
      success: false,
      payload,
      error_message: message,
    });
    return json({ error: message }, 500);
  }
});
