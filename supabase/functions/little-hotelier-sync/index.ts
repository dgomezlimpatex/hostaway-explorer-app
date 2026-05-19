// Little Hotelier sync — receives one reservation per POST from the Python script,
// upserts it, creates/updates the linked cleaning tasks per room (checkout + daily stay),
// and logs warnings/errors.

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
  check_in: string;
  check_out: string;
  room?: string | null;          // legacy single room
  rooms?: string[] | null;        // new: array of rooms
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

/**
 * Normalizes the incoming room data into a clean array of real room names.
 * Returns { rooms: [], needsAssignment, displayRoom, warnings }.
 *
 * - Filters out "-", empty strings.
 * - Detects old concatenated format ("Habitación 5Habitación 2(+1 Más)") and
 *   marks it as needs_room_assignment (we cannot reliably split it).
 * - Trims & dedupes.
 */
function normalizeRooms(payload: ReservationPayload): {
  rooms: string[];
  needsAssignment: boolean;
  displayRoom: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let candidates: string[] = [];

  if (Array.isArray(payload.rooms) && payload.rooms.length > 0) {
    candidates = payload.rooms.map((r) => (r ?? "").toString().trim());
  } else if (payload.room) {
    const raw = payload.room.toString().trim();
    // Detect concatenated multi-room legacy format
    const concatenated =
      /Habitaci[oó]n.*Habitaci[oó]n/i.test(raw) || /\(\+.*M[aá]s\)/i.test(raw);
    if (concatenated) {
      warnings.push(
        `Reserva con varias habitaciones recibida en formato antiguo ("${raw}"). Actualiza el script Python para enviar 'rooms' como array.`,
      );
      return {
        rooms: [],
        needsAssignment: true,
        displayRoom: raw,
        warnings,
      };
    }
    candidates = [raw];
  }

  const clean = Array.from(
    new Set(
      candidates
        .map((r) => r.trim())
        .filter((r) => r.length > 0 && r !== "-"),
    ),
  );

  const needsAssignment = clean.length === 0;
  const displayRoom = clean.length > 0 ? clean.join(", ") : "-";
  return { rooms: clean, needsAssignment, displayRoom, warnings };
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

  if (!payload.external_id || !payload.check_in || !payload.check_out) {
    await supabase.from("lh_sync_logs").insert({
      external_id: payload?.external_id ?? null,
      status_code: 400,
      success: false,
      payload,
      error_message: "Missing required fields",
    });
    return json(
      { error: "Faltan campos obligatorios: external_id, check_in, check_out" },
      400,
    );
  }

  const { rooms, needsAssignment, displayRoom, warnings: roomWarnings } =
    normalizeRooms(payload);
  const warnings: string[] = [...roomWarnings];

  const changes = {
    reservation_created: false,
    reservation_updated: false,
    needs_room_assignment: needsAssignment,
    rooms_processed: rooms,
    tasks_created: [] as Array<{ room: string; kind: ServiceKind; date: string; task_id: string }>,
    tasks_cancelled: [] as Array<{ room: string; kind: ServiceKind; date: string; task_id: string }>,
  };

  try {
    const { data: existing } = await supabase
      .from("lh_reservations")
      .select("*")
      .eq("external_id", payload.external_id)
      .maybeSingle();

    const status = (payload.status ?? "confirmed").toLowerCase();

    const upsertData = {
      external_id: payload.external_id,
      uuid: payload.uuid ?? null,
      reference: payload.reference ?? null,
      channel: payload.channel ?? null,
      check_in: payload.check_in,
      check_out: payload.check_out,
      room: displayRoom,
      rooms,
      needs_room_assignment: needsAssignment,
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
      JSON.stringify(existing.rooms ?? []) !== JSON.stringify(rooms) ||
      existing.status !== reservation.status
    ) {
      changes.reservation_updated = true;
    }

    // Existing links — keyed by lh_room|service_kind|task_date
    const { data: existingLinks } = await supabase
      .from("lh_reservation_tasks")
      .select("*")
      .eq("reservation_id", reservation.id);

    const linkMap = new Map<string, any>();
    (existingLinks ?? []).forEach((l: any) =>
      linkMap.set(`${l.lh_room}|${l.service_kind}|${l.task_date}`, l),
    );

    type Mapping = {
      id: string;
      sede_id: string;
      lh_room: string;
      service_kind: ServiceKind;
      cliente_id: string;
      propiedad_id: string;
      task_type: string;
      default_start_time: string;
      default_duration_min: number;
      default_cost: number;
      is_active: boolean;
    };

    const cancelled = isCancelledStatus(reservation.status);
    const desired = new Map<
      string,
      { room: string; kind: ServiceKind; date: string; mapping: Mapping }
    >();

    if (!cancelled && rooms.length > 0) {
      // Fetch active mappings for all rooms in one go
      const { data: allMappings } = await supabase
        .from("lh_room_mapping")
        .select("*")
        .in("lh_room", rooms)
        .eq("is_active", true);

      const mappingByKey = new Map<string, Mapping>();
      (allMappings ?? []).forEach((m: any) =>
        mappingByKey.set(`${m.lh_room}|${m.service_kind}`, m),
      );

      // Ensure reservation.sede_id is set
      if (!reservation.sede_id && (allMappings?.length ?? 0) > 0) {
        const anySede = (allMappings as any[])[0].sede_id;
        if (anySede) {
          await supabase
            .from("lh_reservations")
            .update({ sede_id: anySede })
            .eq("id", reservation.id);
          reservation.sede_id = anySede;
        }
      }

      const nights = diffDays(reservation.check_in, reservation.check_out);

      for (const room of rooms) {
        const checkoutMap = mappingByKey.get(`${room}|checkout`);
        const stayMap = mappingByKey.get(`${room}|stay`);

        if (!checkoutMap) {
          warnings.push(`Sin mapeo 'checkout' para habitación "${room}"`);
        } else {
          desired.set(`${room}|checkout|${reservation.check_out}`, {
            room,
            kind: "checkout",
            date: reservation.check_out,
            mapping: checkoutMap as Mapping,
          });
        }

        if (!stayMap) {
          warnings.push(`Sin mapeo 'stay' para habitación "${room}"`);
        } else {
          for (let i = 1; i <= nights - 1; i++) {
            const d = addDays(reservation.check_in, i);
            desired.set(`${room}|stay|${d}`, {
              room,
              kind: "stay",
              date: d,
              mapping: stayMap as Mapping,
            });
          }
        }
      }
    }

    // Create missing tasks
    for (const [key, item] of desired.entries()) {
      const link = linkMap.get(key);
      if (link && link.status === "active" && link.task_id) continue;

      const m = item.mapping;
      const startTime = m.default_start_time.slice(0, 5);
      const endTime = minutesToEnd(startTime, m.default_duration_min);

      const { data: prop } = await supabase
        .from("properties")
        .select("nombre, direccion, sede_id")
        .eq("id", m.propiedad_id)
        .single();

      const notes = [
        `[LH ${reservation.reference ?? reservation.external_id}]`,
        `Hab. ${item.room}`,
        item.kind === "checkout" ? "Limpieza de salida" : "Limpieza de estancia",
        reservation.guest_name ? `Huésped: ${reservation.guest_name}` : null,
        reservation.channel ? `Canal: ${reservation.channel}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const taskData: any = {
        property: prop?.nombre ?? item.room,
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
          `No se pudo crear tarea ${item.kind} ${item.date} (${item.room}): ${taskErr?.message ?? "desconocido"}`,
        );
        continue;
      }

      await supabase.from("lh_reservation_tasks").upsert(
        {
          reservation_id: reservation.id,
          task_id: task.id,
          lh_room: item.room,
          service_kind: item.kind,
          task_date: item.date,
          status: "active",
        },
        { onConflict: "reservation_id,lh_room,service_kind,task_date" },
      );

      changes.tasks_created.push({
        room: item.room,
        kind: item.kind,
        date: item.date,
        task_id: task.id,
      });
    }

    // Cancel tasks that are no longer desired (or whole reservation cancelled / room removed)
    const today = new Date().toISOString().slice(0, 10);
    for (const link of existingLinks ?? []) {
      const key = `${link.lh_room}|${link.service_kind}|${link.task_date}`;
      if (desired.has(key)) continue;
      if (link.status !== "active" || !link.task_id) continue;
      if (link.task_date < today) continue;

      const { data: t } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", link.task_id)
        .maybeSingle();
      if (t && t.status === "completed") continue;

      await supabase.from("tasks").delete().eq("id", link.task_id);
      await supabase
        .from("lh_reservation_tasks")
        .update({ status: "cancelled" })
        .eq("id", link.id);

      changes.tasks_cancelled.push({
        room: link.lh_room,
        kind: link.service_kind,
        date: link.task_date,
        task_id: link.task_id,
      });
    }

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
