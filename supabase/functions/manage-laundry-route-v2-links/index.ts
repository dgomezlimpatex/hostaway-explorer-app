import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
  type PrivilegedEdgeActor,
} from "../_shared/edgeAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;
type RouteNovelty = "normal" | "new" | "changed" | "carryover" | "cancelled_before" | "cancelled_after" | "undone";
type RouteSchedule = {
  id: string;
  sedeId: string | null;
  dayOfWeek: number;
  name: string;
  collectionDays: number[];
  sortOrder: number;
};

const ROUTE_V2_DAYS = new Set([0, 1, 3, 5]);

const routeTaskSelect = `
  id,
  property,
  address,
  date,
  start_time,
  end_time,
  check_out,
  check_in,
  cleaner,
  propiedad_id,
  sede_id,
  type,
  status,
  updated_at,
  properties:propiedad_id (
    id,
    codigo,
    nombre,
    sede_id,
    linen_control_enabled,
    is_active,
    numero_sabanas,
    numero_sabanas_pequenas,
    numero_sabanas_suite,
    numero_fundas_almohada,
    numero_toallas_grandes,
    numero_toallas_pequenas,
    numero_alfombrines,
    papel_higienico,
    papel_cocina,
    champu,
    acondicionador,
    gel_ducha,
    jabon_liquido,
    amenities_bano,
    amenities_cocina,
    ambientador_bano,
    bolsas_basura,
    detergente_lavavajillas,
    bayetas_cocina,
    estropajos,
    limpiacristales,
    desinfectante_bano,
    aceite,
    vinagre,
    sal,
    azucar,
    kit_alimentario,
    cliente_id,
    clients:cliente_id (
      id,
      linen_control_enabled,
      is_active
    )
  )
`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function getMadridDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDeliveryDate(currentDate: string, schedules: RouteSchedule[]): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(currentDate, offset);
    if (schedules.some((schedule) => schedule.dayOfWeek === getDayOfWeek(candidate))) return candidate;
  }
  throw new Error("No hay otro día de reparto configurado");
}

function calculateRouteDates(deliveryDate: string, collectionDays: number[]): string[] {
  const deliveryDow = getDayOfWeek(deliveryDate);
  return collectionDays
    .map((collectionDay) => addDays(deliveryDate, -((deliveryDow - collectionDay + 7) % 7)))
    .sort();
}

function mapSchedule(row: JsonRecord): RouteSchedule {
  return {
    id: String(row.id),
    sedeId: typeof row.sede_id === "string" ? row.sede_id : null,
    dayOfWeek: Number(row.day_of_week),
    name: String(row.name ?? ""),
    collectionDays: Array.isArray(row.collection_days) ? row.collection_days.map(Number) : [],
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function pickSchedules(rows: JsonRecord[], sedeId: string): RouteSchedule[] {
  const byDay = new Map<number, RouteSchedule>();
  for (const row of rows) {
    const schedule = mapSchedule(row);
    if (!byDay.has(schedule.dayOfWeek) || schedule.sedeId === sedeId) byDay.set(schedule.dayOfWeek, schedule);
  }
  return Array.from(byDay.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getProperty(task: JsonRecord): JsonRecord | null {
  return task.properties && typeof task.properties === "object" ? task.properties as JsonRecord : null;
}

function propertyIsLaundryEnabled(property: JsonRecord | null): boolean {
  if (!property) return false;
  const client = property.clients && typeof property.clients === "object" ? property.clients as JsonRecord : null;
  const propertyActive = property.is_active === null || property.is_active === undefined || property.is_active === true;
  const clientActive = client?.is_active !== false;
  if (!propertyActive || !clientActive) return false;
  const propertyEnabled = property.linen_control_enabled;
  const clientEnabled = client?.linen_control_enabled ?? false;
  return (propertyEnabled !== null && propertyEnabled !== undefined ? propertyEnabled : clientEnabled) === true;
}

function isEligibleTask(task: JsonRecord): boolean {
  return task.type === "limpieza-turistica"
    && String(task.cleaner ?? "").trim().toUpperCase() !== "NOT COUNT"
    && String(task.status ?? "").toLowerCase() !== "cancelled"
    && propertyIsLaundryEnabled(getProperty(task));
}

function numberValue(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function serviceTime(task: JsonRecord): string {
  return `${getString(task.start_time).slice(0, 5)} - ${getString(task.end_time).slice(0, 5)}`;
}

function bagContent(task: JsonRecord): JsonRecord {
  const property = getProperty(task);
  return {
    taskId: getString(task.id),
    propertyId: getString(property?.id ?? task.propiedad_id),
    propertyCode: getString(property?.codigo ?? task.property),
    propertyName: getString(property?.nombre ?? task.property),
    address: getString(task.address),
    date: getString(task.date),
    serviceTime: serviceTime(task),
    cleaner: task.cleaner ?? null,
    textiles: {
      sheets: numberValue(property?.numero_sabanas),
      sheetsSmall: numberValue(property?.numero_sabanas_pequenas),
      sheetsSuite: numberValue(property?.numero_sabanas_suite),
      pillowCases: numberValue(property?.numero_fundas_almohada),
      towelsLarge: numberValue(property?.numero_toallas_grandes),
      towelsSmall: numberValue(property?.numero_toallas_pequenas),
      bathMats: numberValue(property?.numero_alfombrines),
    },
    amenities: {
      toiletPaper: numberValue(property?.papel_higienico),
      kitchenPaper: numberValue(property?.papel_cocina),
      shampoo: numberValue(property?.champu),
      conditioner: numberValue(property?.acondicionador),
      showerGel: numberValue(property?.gel_ducha),
      liquidSoap: numberValue(property?.jabon_liquido),
      bathroomAmenities: numberValue(property?.amenities_bano),
      kitchenAmenities: numberValue(property?.amenities_cocina),
      bathroomAirFreshener: numberValue(property?.ambientador_bano),
      trashBags: numberValue(property?.bolsas_basura),
      dishwasherDetergent: numberValue(property?.detergente_lavavajillas),
      kitchenCloths: numberValue(property?.bayetas_cocina),
      sponges: numberValue(property?.estropajos),
      glassCleaner: numberValue(property?.limpiacristales),
      bathroomDisinfectant: numberValue(property?.desinfectante_bano),
      oil: numberValue(property?.aceite),
      vinegar: numberValue(property?.vinagre),
      salt: numberValue(property?.sal),
      sugar: numberValue(property?.azucar),
      foodKit: numberValue(property?.kit_alimentario),
    },
  };
}

function taskSignature(task: JsonRecord): string {
  const content = bagContent(task);
  return JSON.stringify({
    ...content,
    checkOut: task.check_out ?? null,
    checkIn: task.check_in ?? null,
    status: task.status ?? null,
  });
}

async function loadSchedules(supabase: ReturnType<typeof createClient>, sedeId: string): Promise<RouteSchedule[]> {
  const { data, error } = await supabase
    .from("laundry_delivery_schedule")
    .select("*")
    .or(`sede_id.is.null,sede_id.eq.${sedeId}`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const schedules = pickSchedules((data ?? []) as JsonRecord[], sedeId)
    .filter((schedule) => ROUTE_V2_DAYS.has(schedule.dayOfWeek));
  if (schedules.length === 0) throw new Error("No hay días de reparto activos para esta sede");
  return schedules;
}

async function fetchTasks(
  supabase: ReturnType<typeof createClient>,
  dates: string[],
  sedeId: string,
): Promise<JsonRecord[]> {
  if (dates.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select(routeTaskSelect)
    .in("date", dates)
    .eq("sede_id", sedeId);
  if (error) throw error;
  return ((data ?? []) as JsonRecord[])
    .filter(isEligibleTask)
    .sort((a, b) => getString(a.date).localeCompare(getString(b.date)) || getString(a.start_time).localeCompare(getString(b.start_time)));
}

async function fetchTasksByIds(
  supabase: ReturnType<typeof createClient>,
  taskIds: string[],
): Promise<JsonRecord[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase.from("tasks").select(routeTaskSelect).in("id", taskIds);
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
}

async function loadRouteOrder(
  supabase: ReturnType<typeof createClient>,
  sedeId: string,
  deliveryDay: number,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("laundry_classic_route_order")
    .select("property_id, position, delivery_day")
    .eq("sede_id", sedeId)
    .in("delivery_day", [-1, deliveryDay]);
  if (error) throw error;
  const rows = (data ?? []) as JsonRecord[];
  const globalRows = rows.filter((row) => Number(row.delivery_day) === -1);
  const specificRows = rows.filter((row) => Number(row.delivery_day) === deliveryDay);
  const applicable = globalRows.length > 0 ? globalRows : specificRows;
  return new Map(applicable.map((row) => [getString(row.property_id), numberValue(row.position)]));
}

function sortTasks(tasks: JsonRecord[], order: Map<string, number>): JsonRecord[] {
  return tasks.slice().sort((a, b) => {
    const propA = getProperty(a);
    const propB = getProperty(b);
    const codeA = getString(propA?.codigo ?? a.property);
    const codeB = getString(propB?.codigo ?? b.property);
    const posA = order.get(getString(propA?.id ?? a.propiedad_id)) ?? Number.MAX_SAFE_INTEGER;
    const posB = order.get(getString(propB?.id ?? b.propiedad_id)) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB || getString(a.date).localeCompare(getString(b.date)) || codeA.localeCompare(codeB, "es", { numeric: true });
  });
}

async function loadRows(
  supabase: ReturnType<typeof createClient>,
  table: "laundry_bag_preparations" | "laundry_route_v2_bag_snapshots",
  column: "task_id" | "share_link_id",
  values: string[],
) {
  if (values.length === 0) return [] as JsonRecord[];
  const { data, error } = await supabase.from(table).select("*").in(column, values);
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
}

async function recordEvent(
  supabase: ReturnType<typeof createClient>,
  payload: JsonRecord,
) {
  const { error } = await supabase.from("laundry_route_v2_events").upsert(payload, {
    onConflict: "event_key",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

async function getCreatedBy(supabase: ReturnType<typeof createClient>, actor: PrivilegedEdgeActor): Promise<string> {
  if (actor.userId) return actor.userId;
  const { data, error } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "manager"]).limit(1);
  if (error || !data?.[0]?.user_id) throw error ?? new Error("No hay usuario operador para crear el enlace");
  return String(data[0].user_id);
}

async function ensureLink(
  supabase: ReturnType<typeof createClient>,
  sedeId: string,
  deliveryDate: string,
  currentSchedule: RouteSchedule,
  nextSchedule: RouteSchedule,
  actor: PrivilegedEdgeActor,
) {
  const currentRouteDates = calculateRouteDates(deliveryDate, currentSchedule.collectionDays);
  const nextDate = nextDeliveryDate(deliveryDate, [currentSchedule, nextSchedule]);
  const nextRouteDates = calculateRouteDates(nextDate, nextSchedule.collectionDays);
  const filters = {
    protocol: "route_v2",
    deliveryDate,
    routeDates: currentRouteDates,
    nextDeliveryDate: nextDate,
    nextRouteDates,
  };

  const { data: existing, error: existingError } = await supabase
    .from("laundry_share_links")
    .select("*")
    .eq("sede_id", sedeId)
    .eq("delivery_date", deliveryDate)
    .eq("workflow_version", "route_v2")
    .eq("auto_managed", true)
    .eq("is_active", true)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { data: updated, error } = await supabase
      .from("laundry_share_links")
      .update({
        date_start: currentRouteDates[0] ?? deliveryDate,
        date_end: nextRouteDates.at(-1) ?? nextDate,
        delivery_day: getDayOfWeek(deliveryDate),
        collection_dates: currentRouteDates,
        filters,
        sync_status: "pending",
        sync_error: null,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return updated as JsonRecord;
  }

  const createdBy = await getCreatedBy(supabase, actor);
  const { data: inserted, error } = await supabase
    .from("laundry_share_links")
    .insert({
      token: crypto.randomUUID().replaceAll("-", ""),
      created_by: createdBy,
      sede_id: sedeId,
      date_start: currentRouteDates[0] ?? deliveryDate,
      date_end: nextRouteDates.at(-1) ?? nextDate,
      delivery_date: deliveryDate,
      delivery_day: getDayOfWeek(deliveryDate),
      collection_dates: currentRouteDates,
      filters,
      workflow_version: "route_v2",
      link_type: "route_v2",
      auto_managed: true,
      is_permanent: true,
      sync_status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  await recordEvent(supabase, {
    sede_id: sedeId,
    share_link_id: inserted.id,
    delivery_date: deliveryDate,
    event_type: "route_created",
    event_key: `route-created:${inserted.id}`,
    payload: { routeDates: currentRouteDates, nextRouteDates },
    actor_id: actor.userId ?? null,
    actor_name: actor.kind === "service-role" || actor.kind === "cron" ? "Automatización" : null,
  });
  return inserted as JsonRecord;
}

async function reconcileLink(
  supabase: ReturnType<typeof createClient>,
  link: JsonRecord,
  sedeId: string,
  currentSchedule: RouteSchedule,
  nextSchedule: RouteSchedule,
  actor: PrivilegedEdgeActor,
) {
  const filters = (link.filters && typeof link.filters === "object" ? link.filters : {}) as JsonRecord;
  const deliveryDate = getString(link.delivery_date || filters.deliveryDate);
  const currentDates = Array.isArray(filters.routeDates) ? filters.routeDates.map(String) : calculateRouteDates(deliveryDate, currentSchedule.collectionDays);
  const nextDate = getString(filters.nextDeliveryDate || nextDeliveryDate(deliveryDate, [currentSchedule, nextSchedule]));
  const nextDates = Array.isArray(filters.nextRouteDates) ? filters.nextRouteDates.map(String) : calculateRouteDates(nextDate, nextSchedule.collectionDays);
  const [currentOrder, nextOrder] = await Promise.all([
    loadRouteOrder(supabase, sedeId, getDayOfWeek(deliveryDate)),
    loadRouteOrder(supabase, sedeId, getDayOfWeek(nextDate)),
  ]);
  const [currentTasksRaw, nextTasksRaw] = await Promise.all([
    fetchTasks(supabase, currentDates, sedeId),
    fetchTasks(supabase, nextDates, sedeId),
  ]);
  const currentTasks = sortTasks(currentTasksRaw, currentOrder);
  const nextTasks = sortTasks(nextTasksRaw, nextOrder);
  const activeTasks = Array.from(new Map([...currentTasks, ...nextTasks].map((task) => [getString(task.id), task])).values());
  const activeTaskIds = activeTasks.map((task) => getString(task.id));
  const previousTaskIds = new Set(Array.isArray(link.snapshot_task_ids) ? link.snapshot_task_ids.map(String) : []);
  const isInitialSnapshot = previousTaskIds.size === 0 && !link.last_synced_at;
  const [preparationRows, snapshotRows] = await Promise.all([
    loadRows(supabase, "laundry_bag_preparations", "task_id", activeTaskIds),
    loadRows(supabase, "laundry_route_v2_bag_snapshots", "share_link_id", [getString(link.id)]),
  ]);
  const preparations = new Map(preparationRows.map((row) => [getString(row.task_id), row]));
  const snapshots = new Map(snapshotRows.map((row) => [getString(row.task_id), row]));
  const now = new Date().toISOString();
  let addedCount = 0;
  let changedCount = 0;
  let carryoverCount = 0;
  const changedEvents: Promise<void>[] = [];

  for (const task of activeTasks) {
    const taskId = getString(task.id);
    const content = bagContent(task);
    const signature = taskSignature(task);
    const preparation = preparations.get(taskId);
    const snapshot = snapshots.get(taskId);
    const knownBefore = previousTaskIds.has(taskId) || Boolean(snapshot);
    const isNew = !isInitialSnapshot && !knownBefore;
    const isChanged = Boolean(snapshot && getString(snapshot.task_signature) !== signature);
    const wasCancelled = preparation?.route_novelty_type === "cancelled_before"
      || preparation?.route_novelty_type === "cancelled_after";
    if (isNew) addedCount += 1;
    if (isChanged) changedCount += 1;
    if (preparation?.status === "issue" && currentTasks.some((currentTask) => getString(currentTask.id) === taskId)) carryoverCount += 1;

    if (!snapshot) {
      const { error } = await supabase.from("laundry_route_v2_bag_snapshots").insert({
        share_link_id: link.id,
        task_id: taskId,
        delivery_date: deliveryDate,
        task_signature: signature,
        content,
      });
      if (error) throw error;
    } else if (!preparation || preparation.status !== "prepared") {
      const { error } = await supabase
        .from("laundry_route_v2_bag_snapshots")
        .update({ task_signature: signature, content, updated_at: now })
        .eq("id", snapshot.id);
      if (error) throw error;
    }

    if (!preparation) {
      const { data: inserted, error } = await supabase.from("laundry_bag_preparations").insert({
        task_id: taskId,
        status: "pending",
        last_share_link_id: link.id,
        content_snapshot: content,
        snapshot_locked_at: now,
        route_novelty_type: isNew ? "new" : "normal",
        route_novelty_resolved: !isNew,
        route_last_seen_signature: signature,
      }).select("*").single();
      if (error) throw error;
      preparations.set(taskId, inserted as JsonRecord);
    } else {
      const patch: JsonRecord = {
        last_share_link_id: link.id,
        route_last_seen_signature: signature,
        updated_at: now,
      };
      if ((!preparation.content_snapshot || typeof preparation.content_snapshot !== "object" || Object.keys(preparation.content_snapshot as JsonRecord).length === 0)
        || preparation.status !== "prepared") {
        patch.content_snapshot = content;
        patch.snapshot_locked_at = preparation.snapshot_locked_at ?? now;
      }
      if (wasCancelled) {
        patch.route_novelty_type = "changed";
        patch.route_novelty_resolved = false;
        patch.cancelled_at = null;
        patch.cancelled_by_name = null;
        if (preparation.status === "prepared") patch.status = "pending";
      } else if (isNew) {
        patch.route_novelty_type = "new";
        patch.route_novelty_resolved = false;
      } else if (isChanged) {
        patch.route_novelty_type = "changed";
        patch.route_novelty_resolved = false;
        if (preparation.status === "prepared") patch.status = "pending";
      } else if (preparation.status === "issue" && currentTasks.some((currentTask) => getString(currentTask.id) === taskId)) {
        patch.route_novelty_type = "carryover";
        patch.route_novelty_resolved = false;
      }
      const { data: updated, error } = await supabase
        .from("laundry_bag_preparations")
        .update(patch)
        .eq("task_id", taskId)
        .select("*")
        .single();
      if (error) throw error;
      preparations.set(taskId, updated as JsonRecord);
    }

    const noveltyType: RouteNovelty = wasCancelled ? "changed" : isNew ? "new" : isChanged ? "changed" : preparation?.status === "issue" ? "carryover" : "normal";
    if (isNew || isChanged || wasCancelled) {
      changedEvents.push(recordEvent(supabase, {
        sede_id: sedeId,
        share_link_id: link.id,
        task_id: taskId,
        delivery_date: deliveryDate,
        event_type: isNew ? "task_added" : "task_changed",
        novelty_type: noveltyType,
        property_code: getString(content.propertyCode),
        event_key: `${isNew ? "task-added" : "task-changed"}:${link.id}:${taskId}:${signature}`,
        payload: { content, signature },
        actor_id: actor.userId ?? null,
        actor_name: actor.kind === "service-role" || actor.kind === "cron" ? "Automatización" : null,
      }));
    }
  }
  await Promise.all(changedEvents);

  const previousIds = Array.from(previousTaskIds);
  const removedIds = previousIds.filter((taskId) => !activeTaskIds.includes(taskId));
  if (removedIds.length > 0) {
    const [removedTasks, removedPrepRows, removedSnapshotRows] = await Promise.all([
      fetchTasksByIds(supabase, removedIds),
      loadRows(supabase, "laundry_bag_preparations", "task_id", removedIds),
      loadRows(supabase, "laundry_route_v2_bag_snapshots", "share_link_id", [getString(link.id)]),
    ]);
    const removedTaskMap = new Map(removedTasks.map((task) => [getString(task.id), task]));
    const removedPrepMap = new Map(removedPrepRows.map((row) => [getString(row.task_id), row]));
    const removedSnapshotMap = new Map(removedSnapshotRows.map((row) => [getString(row.task_id), row]));
    for (const taskId of removedIds) {
      const task = removedTaskMap.get(taskId);
      const prep = removedPrepMap.get(taskId);
      const snapshot = removedSnapshotMap.get(taskId);
      const content = (snapshot?.content && typeof snapshot.content === "object" ? snapshot.content : task ? bagContent(task) : { taskId }) as JsonRecord;
      const wasPrepared = prep?.status === "prepared";
      const noveltyType: RouteNovelty = wasPrepared ? "cancelled_after" : "cancelled_before";
      const patch: JsonRecord = {
        route_novelty_type: noveltyType,
        route_novelty_resolved: false,
        cancelled_at: now,
        cancelled_by_name: "Sincronización de ruta",
        last_share_link_id: link.id,
        updated_at: now,
      };
      const { error: prepError } = await supabase.from("laundry_bag_preparations").update(patch).eq("task_id", taskId);
      if (prepError) throw prepError;
      await recordEvent(supabase, {
        sede_id: sedeId,
        share_link_id: link.id,
        task_id: taskId,
        delivery_date: deliveryDate,
        event_type: "task_cancelled",
        novelty_type: noveltyType,
        property_code: getString(content.propertyCode),
        event_key: `task-cancelled:${link.id}:${taskId}:${noveltyType}`,
        payload: { content, cancellationStage: wasPrepared ? "after_preparation" : "before_preparation" },
        actor_id: actor.userId ?? null,
        actor_name: actor.kind === "service-role" || actor.kind === "cron" ? "Automatización" : null,
      });
    }
  }

  const nextSnapshot = activeTaskIds;
  const { data: updatedLink, error: linkError } = await supabase
    .from("laundry_share_links")
    .update({
      snapshot_task_ids: nextSnapshot,
      original_task_ids: isInitialSnapshot ? activeTaskIds : (Array.isArray(link.original_task_ids) ? link.original_task_ids : activeTaskIds),
      last_synced_at: now,
      sync_status: "ok",
      sync_error: null,
      updated_at: now,
    })
    .eq("id", link.id)
    .select("*")
    .single();
  if (linkError) throw linkError;

  await recordEvent(supabase, {
    sede_id: sedeId,
    share_link_id: link.id,
    delivery_date: deliveryDate,
    event_type: "route_refreshed",
    event_key: `route-refresh:${link.id}:${now.slice(0, 16)}`,
    payload: {
      currentTaskCount: currentTasks.length,
      nextTaskCount: nextTasks.length,
      addedCount,
      changedCount,
      removedCount: removedIds.length,
      carryoverCount,
    },
    actor_id: actor.userId ?? null,
    actor_name: actor.kind === "service-role" || actor.kind === "cron" ? "Automatización" : null,
  });

  return {
    link: updatedLink as JsonRecord,
    summary: {
      deliveryDate,
      routeName: currentSchedule.name,
      nextDeliveryDate: nextDate,
      nextRouteName: nextSchedule.name,
      currentTaskCount: currentTasks.length,
      nextTaskCount: nextTasks.length,
      pendingPreparationCount: Array.from(preparations.values()).filter((row) => row.status === "pending").length,
      issueCount: Array.from(preparations.values()).filter((row) => row.status === "issue").length,
      noveltyCount: Array.from(preparations.values()).filter((row) => row.route_novelty_resolved === false).length,
      addedCount,
      changedCount,
      removedCount: removedIds.length,
      carryoverCount,
    },
  };
}

async function canAccessSede(
  supabase: ReturnType<typeof createClient>,
  actor: PrivilegedEdgeActor,
  sedeId: string,
) {
  if (actor.kind !== "user" || !actor.userId || actor.role === "admin") return true;
  const { data, error } = await supabase
    .from("user_sede_access")
    .select("id")
    .eq("user_id", actor.userId)
    .eq("sede_id", sedeId)
    .eq("can_access", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function reconcileSede(
  supabase: ReturnType<typeof createClient>,
  sedeId: string,
  actor: PrivilegedEdgeActor,
) {
  const schedules = await loadSchedules(supabase, sedeId);
  const today = getMadridDate();
  const deliveryDates: string[] = [];
  let cursor = today;
  while (deliveryDates.length < 3) {
    if (schedules.some((schedule) => schedule.dayOfWeek === getDayOfWeek(cursor))) {
      deliveryDates.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }

  const results = [];
  for (const deliveryDate of deliveryDates) {
    const currentSchedule = schedules.find((schedule) => schedule.dayOfWeek === getDayOfWeek(deliveryDate));
    if (!currentSchedule) continue;
    const nextDate = nextDeliveryDate(deliveryDate, schedules);
    const nextSchedule = schedules.find((schedule) => schedule.dayOfWeek === getDayOfWeek(nextDate));
    if (!nextSchedule) continue;
    const link = await ensureLink(supabase, sedeId, deliveryDate, currentSchedule, nextSchedule, actor);
    results.push(await reconcileLink(supabase, link, sedeId, currentSchedule, nextSchedule, actor));
  }
  return results;
}

async function reconcileSpecificLink(
  supabase: ReturnType<typeof createClient>,
  linkId: string,
  actor: PrivilegedEdgeActor,
) {
  const { data: link, error } = await supabase
    .from("laundry_share_links")
    .select("*")
    .eq("id", linkId)
    .eq("workflow_version", "route_v2")
    .eq("auto_managed", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new Error("Ruta nueva no encontrada");

  const sedeId = String(link.sede_id ?? "");
  if (!sedeId) throw new Error("La ruta nueva no tiene sede");
  const schedules = await loadSchedules(supabase, sedeId);
  const deliveryDate = getString(link.delivery_date || (link.filters as JsonRecord | null)?.deliveryDate);
  const currentSchedule = schedules.find((schedule) => schedule.dayOfWeek === getDayOfWeek(deliveryDate));
  if (!currentSchedule) throw new Error("No hay dÃ­a de reparto configurado para esta ruta");
  const nextDate = nextDeliveryDate(deliveryDate, schedules);
  const nextSchedule = schedules.find((schedule) => schedule.dayOfWeek === getDayOfWeek(nextDate));
  if (!nextSchedule) throw new Error("No hay siguiente ruta configurada");
  const ensuredLink = await ensureLink(supabase, sedeId, deliveryDate, currentSchedule, nextSchedule, actor);
  return reconcileLink(supabase, ensuredLink, sedeId, currentSchedule, nextSchedule, actor);
}

async function listSedeLinks(supabase: ReturnType<typeof createClient>, sedeId: string) {
  const { data, error } = await supabase
    .from("laundry_share_links")
    .select("id, token, sede_id, delivery_date, delivery_day, sync_status, sync_error, last_synced_at, updated_at, filters, snapshot_task_ids")
    .eq("sede_id", sedeId)
    .eq("workflow_version", "route_v2")
    .eq("auto_managed", true)
    .eq("is_active", true)
    .order("delivery_date", { ascending: true });
  if (error) throw error;
  const linkIds = (data ?? []).map((row) => String(row.id));
  const taskIds = Array.from(new Set((data ?? []).flatMap((row) => Array.isArray(row.snapshot_task_ids) ? row.snapshot_task_ids.map(String) : [])));
  const [eventsResult, preparationsResult, snapshotsResult] = await Promise.all([
    linkIds.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase
      .from("laundry_route_v2_events")
      .select("id, share_link_id, task_id, event_type, novelty_type, property_code, payload, actor_name, created_at")
      .eq("sede_id", sedeId)
      .in("share_link_id", linkIds)
      .order("created_at", { ascending: false })
      .limit(80),
    taskIds.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase
      .from("laundry_bag_preparations")
      .select("task_id, status, route_novelty_resolved, route_novelty_type")
      .in("task_id", taskIds),
    linkIds.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase
      .from("laundry_route_v2_bag_snapshots")
      .select("share_link_id, task_id, content")
      .in("share_link_id", linkIds),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  if (preparationsResult.error) throw preparationsResult.error;
  if (snapshotsResult.error) throw snapshotsResult.error;
  const events = eventsResult.data ?? [];
  const preparations = preparationsResult.data ?? [];
  const snapshots = snapshotsResult.data ?? [];
  const preparationMap = new Map((preparations as JsonRecord[]).map((row) => [String(row.task_id), row]));
  const snapshotsByLink = new Map<string, JsonRecord[]>();
  for (const snapshot of snapshots as JsonRecord[]) {
    const linkId = getString(snapshot.share_link_id);
    if (!snapshotsByLink.has(linkId)) snapshotsByLink.set(linkId, []);
    snapshotsByLink.get(linkId)!.push(snapshot);
  }
  const schedules = await loadSchedules(supabase, sedeId);
  return (data ?? []).map((link) => {
    const date = getString(link.delivery_date || (link.filters as JsonRecord | null)?.deliveryDate);
    const schedule = schedules.find((item) => item.dayOfWeek === getDayOfWeek(date));
    const nextDate = nextDeliveryDate(date, schedules);
    const linkEvents = (events as JsonRecord[]).filter((event) => event.share_link_id === link.id);
    const snapshotTaskIds = Array.isArray(link.snapshot_task_ids) ? link.snapshot_task_ids.map(String) : [];
    const linkPreparations = snapshotTaskIds.map((taskId) => preparationMap.get(taskId)).filter(Boolean) as JsonRecord[];
    const filters = (link.filters && typeof link.filters === "object" ? link.filters : {}) as JsonRecord;
    const currentRouteDates = new Set(Array.isArray(filters.routeDates) ? filters.routeDates.map(String) : []);
    const currentTaskIds = new Set(
      (snapshotsByLink.get(String(link.id)) ?? [])
        .filter((snapshot) => {
          const content = snapshot.content && typeof snapshot.content === "object" ? snapshot.content as JsonRecord : null;
          return currentRouteDates.has(getString(content?.date));
        })
        .map((snapshot) => getString(snapshot.task_id))
        .filter(Boolean),
    );
    const currentPreparations = linkPreparations.filter((row) => currentTaskIds.has(getString(row.task_id)));
    const nextPreparations = linkPreparations.filter((row) => !currentTaskIds.has(getString(row.task_id)));
    const noveltyEvents = linkEvents.filter((event) => {
      if (!["task_added", "task_changed", "task_cancelled", "bag_issue", "bag_undo", "critical_block"].includes(getString(event.event_type))) return false;
      const taskId = getString(event.task_id);
      if (taskId && !currentTaskIds.has(taskId)) return false;
      const preparation = taskId ? preparationMap.get(taskId) : null;
      return !preparation || preparation.route_novelty_resolved === false;
    });
    return {
      ...link,
      deliveryDate: date,
      routeName: schedule?.name ?? "Ruta",
      nextDeliveryDate: nextDate,
      pendingNovelties: noveltyEvents.slice(0, 20),
      recentEvents: linkEvents.slice(0, 10),
      pendingPreparationCount: currentPreparations.filter((row) => getString(row.status) === "pending").length,
      nextPendingPreparationCount: nextPreparations.filter((row) => getString(row.status) === "pending").length,
      preparedCount: linkPreparations.filter((row) => getString(row.status) === "prepared").length,
      issueCount: linkPreparations.filter((row) => getString(row.status) === "issue").length,
      unresolvedNoveltyCount: currentPreparations.filter((row) => row.route_novelty_resolved === false).length,
      pendingTaskIds: currentPreparations
        .filter((row) => getString(row.status) === "pending" || row.route_novelty_resolved === false)
        .map((row) => getString(row.task_id))
        .filter(Boolean),
      totalBags: snapshotTaskIds.length,
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const actor = await assertAdminManagerOrServiceRole(req, supabase, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "list";
    const requestedSedeId = typeof body.sedeId === "string" ? body.sedeId : null;

    if (action === "authorize_continue") {
      if (actor.kind === "user" && actor.role !== "admin") {
        return json({ error: "Solo un administrador puede autorizar una ruta incompleta" }, 403);
      }
      const shareLinkId = typeof body.shareLinkId === "string" ? body.shareLinkId : "";
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      const affectedTaskIds = Array.isArray(body.affectedTaskIds) ? body.affectedTaskIds.filter((id: unknown) => typeof id === "string") : [];
      if (!shareLinkId || reason.length < 3) return json({ error: "El motivo de autorización es obligatorio" }, 400);
      const { data: link, error: linkError } = await supabase
        .from("laundry_share_links")
        .select("id, sede_id, delivery_date, workflow_version, auto_managed")
        .eq("id", shareLinkId)
        .eq("workflow_version", "route_v2")
        .eq("auto_managed", true)
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) return json({ error: "Ruta nueva no encontrada" }, 404);
      if (!(await canAccessSede(supabase, actor, String(link.sede_id)))) return json({ error: "Sin acceso a esta sede" }, 403);
      const { data: authUser } = actor.userId ? await supabase.auth.admin.getUserById(actor.userId) : { data: null };
      const actorName = authUser?.user?.user_metadata?.full_name || authUser?.user?.email || (actor.kind === "service-role" ? "Automatización" : "Administrador");
      const { data: authorization, error } = await supabase.from("laundry_route_v2_authorizations").insert({
        sede_id: link.sede_id,
        share_link_id: link.id,
        delivery_date: link.delivery_date,
        reason,
        affected_task_ids: affectedTaskIds,
        actor_id: actor.userId ?? null,
        actor_name: actorName,
      }).select("*").single();
      if (error) throw error;
      await recordEvent(supabase, {
        sede_id: link.sede_id,
        share_link_id: link.id,
        delivery_date: link.delivery_date,
        event_type: "admin_authorized",
        event_key: `authorization:${authorization.id}`,
        payload: { reason, affectedTaskIds },
        actor_id: actor.userId ?? null,
        actor_name: actorName,
      });
      return json({ success: true, authorization });
    }

    if (action === "list") {
      if (actor.kind === "user") {
        const { data: userData } = actor.userId
          ? await supabase.auth.admin.getUserById(actor.userId)
          : { data: null };
        if (userData?.user?.email?.trim().toLowerCase() !== "dgomezlimpatex@gmail.com") {
          return json({ error: "Este nuevo sistema de ruta está disponible solo para Daniel" }, 403);
        }
      }
      if (!requestedSedeId) return json({ links: [], events: [] });
      if (!(await canAccessSede(supabase, actor, requestedSedeId))) return json({ error: "Sin acceso a esta sede" }, 403);
      // Reading the panel also refreshes the three managed routes so that a new,
      // changed or cancelled task is visible without manual link generation.
      await reconcileSede(supabase, requestedSedeId, actor);
      return json({ success: true, links: await listSedeLinks(supabase, requestedSedeId) });
    }

    if (action === "reconcile_link") {
      if (actor.kind === "user") {
        const { data: userData } = actor.userId
          ? await supabase.auth.admin.getUserById(actor.userId)
          : { data: null };
        if (userData?.user?.email?.toLowerCase() !== "dgomezlimpatex@gmail.com") {
          return json({ error: "Solo Daniel puede reconciliar una ruta manualmente" }, 403);
        }
      }
      const linkId = typeof body.linkId === "string" ? body.linkId : "";
      if (!linkId) return json({ error: "linkId requerido" }, 400);
      const { data: link, error: linkError } = await supabase
        .from("laundry_share_links")
        .select("sede_id")
        .eq("id", linkId)
        .eq("workflow_version", "route_v2")
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) return json({ error: "Ruta nueva no encontrada" }, 404);
      if (!(await canAccessSede(supabase, actor, String(link.sede_id)))) return json({ error: "Sin acceso a esta sede" }, 403);
      const result = await reconcileSpecificLink(supabase, linkId, actor);
      return json({ success: true, result });
    }

    if (action === "reconcile" || action === "force_reconcile") {
      if (actor.kind === "user") {
        const { data: userData } = actor.userId ? await supabase.auth.admin.getUserById(actor.userId) : { data: null };
        if (userData?.user?.email?.toLowerCase() !== "dgomezlimpatex@gmail.com") return json({ error: "Solo Daniel puede forzar la sincronización" }, 403);
      }
      if (requestedSedeId) {
        if (!(await canAccessSede(supabase, actor, requestedSedeId))) return json({ error: "Sin acceso a esta sede" }, 403);
        const results = await reconcileSede(supabase, requestedSedeId, actor);
        return json({ success: true, results });
      }
      const { data: sedes, error: sedesError } = await supabase.from("sedes").select("id").eq("is_active", true);
      if (sedesError) throw sedesError;
      const results = [];
      for (const sede of sedes ?? []) results.push(...await reconcileSede(supabase, String(sede.id), actor));
      return json({ success: true, results });
    }

    return json({ error: "Acción no reconocida" }, 400);
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error, corsHeaders);
    if (authorizationResponse) return authorizationResponse;
    console.error("manage-laundry-route-v2-links error", error);
    return json({ error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
