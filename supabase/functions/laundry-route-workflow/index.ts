import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;
type RouteAction = "load" | "prepare" | "issue" | "critical_block" | "collect" | "deliver" | "confirm_no_carry" | "undo_bag";

const ROUTE_V2_DAYS = new Set([0, 1, 3, 5]);

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

function calculateRouteDates(deliveryDate: string, collectionDays: number[]): string[] {
  const deliveryDow = getDayOfWeek(deliveryDate);
  return collectionDays
    .map((collectionDay) => addDays(deliveryDate, -((deliveryDow - collectionDay + 7) % 7)))
    .sort();
}

function nextDeliveryDate(currentDeliveryDate: string, nextDayOfWeek: number): string {
  const currentDow = getDayOfWeek(currentDeliveryDate);
  const daysForward = (nextDayOfWeek - currentDow + 7) % 7 || 7;
  return addDays(currentDeliveryDate, daysForward);
}

function isNotCountCleaner(cleaner: unknown): boolean {
  return String(cleaner ?? "").trim().toUpperCase() === "NOT COUNT";
}

function numberValue(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function formatServiceTime(task: JsonRecord): string {
  return `${String(task.start_time ?? "").slice(0, 5)} - ${String(task.end_time ?? "").slice(0, 5)}`;
}

function mapSchedule(row: JsonRecord) {
  return {
    id: String(row.id),
    sedeId: typeof row.sede_id === "string" ? row.sede_id : null,
    dayOfWeek: Number(row.day_of_week),
    name: String(row.name ?? ""),
    collectionDays: Array.isArray(row.collection_days) ? row.collection_days.map(Number) : [],
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function pickSchedules(rows: JsonRecord[], sedeId: string | null) {
  const map = new Map<number, ReturnType<typeof mapSchedule>>();
  for (const row of rows) {
    const schedule = mapSchedule(row);
    if (!map.has(schedule.dayOfWeek) || schedule.sedeId === sedeId) {
      map.set(schedule.dayOfWeek, schedule);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getProperty(task: JsonRecord): JsonRecord | null {
  const property = task.properties;
  return property && typeof property === "object" ? property as JsonRecord : null;
}

function getObject(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function getSnapshotContent(preparation: JsonRecord | undefined): JsonRecord | null {
  const content = getObject(preparation?.content_snapshot);
  return content && Object.keys(content).length > 0 ? content : null;
}

function propertyIsLaundryEnabled(property: JsonRecord | null): boolean {
  if (!property) return false;
  const clients = property.clients && typeof property.clients === "object" ? property.clients as JsonRecord : null;
  const clientIsActive = clients?.is_active !== false;
  const isActive = property.is_active !== null && property.is_active !== undefined
    ? property.is_active === true
    : clientIsActive;
  if (!isActive) return false;

  const propertyLinen = property.linen_control_enabled;
  const clientLinen = clients?.linen_control_enabled ?? false;
  const effectiveLinen = propertyLinen !== null && propertyLinen !== undefined ? propertyLinen : clientLinen;
  return effectiveLinen === true;
}

async function fetchTasksForDates(
  supabase: ReturnType<typeof createClient>,
  dates: string[],
  sedeId: string | null,
) {
  if (dates.length === 0) return [];

  let query = supabase
    .from("tasks")
    .select(`
      id,
      property,
      address,
      date,
      start_time,
      end_time,
      cleaner,
      propiedad_id,
      sede_id,
      type,
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
    `)
    .in("date", dates)
    .eq("type", "limpieza-turistica");

  if (sedeId) query = query.eq("sede_id", sedeId);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as JsonRecord[])
    .filter((task) => !isNotCountCleaner(task.cleaner))
    .filter((task) => propertyIsLaundryEnabled(getProperty(task)))
    .sort((a, b) => {
      const propA = getProperty(a);
      const propB = getProperty(b);
      const codeA = String(propA?.codigo ?? a.property ?? "");
      const codeB = String(propB?.codigo ?? b.property ?? "");
      return codeA.localeCompare(codeB, "es", { numeric: true });
    });
}

async function fetchStockConsumablesByProperty(
  supabase: ReturnType<typeof createClient>,
  tasks: JsonRecord[],
) {
  const propertyIds = Array.from(new Set(tasks.map((task) => getProperty(task)?.id).filter(Boolean))) as string[];
  if (propertyIds.length === 0) return new Map<string, JsonRecord[]>();

  const propertySedes = new Map<string, string | null>();
  tasks.forEach((task) => {
    const property = getProperty(task);
    if (typeof property?.id === "string") {
      propertySedes.set(property.id, typeof property.sede_id === "string" ? property.sede_id : null);
    }
  });

  const { data, error } = await supabase
    .from("stock_property_consumption_rules")
    .select(`
      property_id,
      quantity_per_cleaning,
      stock_products:product_id (
        id,
        name,
        unit_of_measure,
        is_active,
        is_consumable,
        sede_id,
        sort_order,
        stock_categories:category_id (
          name,
          kind
        )
      )
    `)
    .in("property_id", propertyIds)
    .eq("is_active", true)
    .gt("quantity_per_cleaning", 0);

  if (error) {
    console.error("Error loading stock consumables", error);
    return new Map<string, JsonRecord[]>();
  }

  const map = new Map<string, JsonRecord[]>();
  for (const row of (data ?? []) as JsonRecord[]) {
    const product = row.stock_products && typeof row.stock_products === "object" ? row.stock_products as JsonRecord : null;
    const category = product?.stock_categories && typeof product.stock_categories === "object"
      ? product.stock_categories as JsonRecord
      : null;
    const propertyId = String(row.property_id ?? "");
    if (!propertyId || !product) continue;
    if (product.is_active !== true || product.is_consumable !== true) continue;
    if (category?.kind === "laundry") continue;
    if (typeof product.sede_id === "string" && propertySedes.get(propertyId) && product.sede_id !== propertySedes.get(propertyId)) continue;

    const item = {
      productId: product.id,
      name: product.name,
      quantity: numberValue(row.quantity_per_cleaning),
      unitOfMeasure: product.unit_of_measure,
      categoryName: category?.name ?? null,
      categoryKind: category?.kind ?? null,
      sortOrder: numberValue(product.sort_order),
    };
    if (!map.has(propertyId)) map.set(propertyId, []);
    map.get(propertyId)!.push(item);
  }

  for (const items of map.values()) {
    items.sort((a, b) => numberValue(a.sortOrder) - numberValue(b.sortOrder) || String(a.name).localeCompare(String(b.name), "es"));
  }

  return map;
}

async function loadPreparations(
  supabase: ReturnType<typeof createClient>,
  taskIds: string[],
) {
  if (taskIds.length === 0) return new Map<string, JsonRecord>();
  const { data, error } = await supabase
    .from("laundry_bag_preparations")
    .select("*")
    .in("task_id", taskIds);
  if (error) throw error;
  return new Map(((data ?? []) as JsonRecord[]).map((row) => [String(row.task_id), row]));
}

async function loadDeliveryTracking(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
) {
  const { data, error } = await supabase
    .from("laundry_delivery_tracking")
    .select("*")
    .eq("share_link_id", shareLinkId);
  if (error) throw error;
  return new Map(((data ?? []) as JsonRecord[]).map((row) => [String(row.task_id), row]));
}

async function loadRouteEvents(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
) {
  const { data, error } = await supabase
    .from("laundry_route_v2_events")
    .select("id, share_link_id, task_id, delivery_date, event_type, novelty_type, property_code, payload, actor_name, created_at")
    .eq("share_link_id", shareLinkId)
    .order("created_at", { ascending: false })
    .limit(200);
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

async function loadLatestRouteAuthorization(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
) {
  const { data, error } = await supabase
    .from("laundry_route_v2_authorizations")
    .select("id, reason, affected_task_ids, actor_name, created_at")
    .eq("share_link_id", shareLinkId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as JsonRecord | null;
}

async function refreshManagedRouteOnOpen(linkId: string, serviceKey: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/manage-laundry-route-v2-links`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: "reconcile_link", linkId, source: "public_open" }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) console.warn("No se pudo actualizar la ruta al abrir el enlace", response.status);
  } catch (error) {
    // A public link must remain usable if the administrative refresher is unavailable.
    console.warn("Actualización de ruta al abrir omitida", error);
  }
}

async function loadRouteOrder(
  supabase: ReturnType<typeof createClient>,
  sedeId: string | null,
  deliveryDay: number,
) {
  if (!sedeId) return new Map<string, number>();
  const { data, error } = await supabase
    .from("laundry_classic_route_order")
    .select("property_id, position, delivery_day")
    .eq("sede_id", sedeId)
    .in("delivery_day", [-1, deliveryDay]);
  if (error) throw error;
  const rows = (data ?? []) as JsonRecord[];
  const globalRows = rows.filter((row) => Number(row.delivery_day) === -1);
  const specificRows = rows.filter((row) => Number(row.delivery_day) === deliveryDay);
  const selectedRows = globalRows.length > 0 ? globalRows : specificRows;
  return new Map(selectedRows.map((row) => [String(row.property_id), numberValue(row.position)]));
}

function sortRouteTasks(tasks: JsonRecord[], order: Map<string, number>) {
  return tasks.slice().sort((a, b) => {
    const propertyA = getProperty(a);
    const propertyB = getProperty(b);
    const idA = String(propertyA?.id ?? a.propiedad_id ?? "");
    const idB = String(propertyB?.id ?? b.propiedad_id ?? "");
    const codeA = String(propertyA?.codigo ?? a.property ?? "");
    const codeB = String(propertyB?.codigo ?? b.property ?? "");
    return (order.get(idA) ?? Number.MAX_SAFE_INTEGER) - (order.get(idB) ?? Number.MAX_SAFE_INTEGER)
      || codeA.localeCompare(codeB, "es", { numeric: true })
      || String(a.date ?? "").localeCompare(String(b.date ?? ""));
  });
}

function mapTask(
  task: JsonRecord,
  preparations: Map<string, JsonRecord>,
  tracking: Map<string, JsonRecord>,
  stockConsumablesByProperty: Map<string, JsonRecord[]>,
  originalTaskIds: Set<string>,
) {
  const property = getProperty(task);
  const taskId = String(task.id);
  const propertyId = String(property?.id ?? task.propiedad_id ?? "");
  const preparation = preparations.get(taskId);
  const deliveryTracking = tracking.get(taskId);
  const frozenContent = getSnapshotContent(preparation);
  const bagStatus = String(preparation?.status ?? "pending");
  const frozenTextiles = getObject(frozenContent?.textiles);
  const frozenAmenities = getObject(frozenContent?.amenities);
  const routeNoveltyType = String(preparation?.route_novelty_type ?? (originalTaskIds.has(taskId) ? "normal" : "new"));

  return {
    taskId,
    propertyId,
    propertyCode: String(frozenContent?.propertyCode ?? property?.codigo ?? task.property ?? ""),
    propertyName: String(frozenContent?.propertyName ?? property?.nombre ?? task.property ?? ""),
    address: String(frozenContent?.address ?? task.address ?? ""),
    date: String(frozenContent?.date ?? task.date ?? ""),
    serviceTime: String(frozenContent?.serviceTime ?? formatServiceTime(task)),
    cleaner: frozenContent?.cleaner ?? task.cleaner ?? null,
    isNew: !originalTaskIds.has(taskId),
    noveltyType: routeNoveltyType,
    noveltyResolved: preparation?.route_novelty_resolved !== false,
    isCancelled: routeNoveltyType === "cancelled_before" || routeNoveltyType === "cancelled_after",
    cancellationStage: routeNoveltyType === "cancelled_after" ? "after_preparation" : routeNoveltyType === "cancelled_before" ? "before_preparation" : null,
    bagStatus: {
      status: bagStatus,
      preparedAt: preparation?.prepared_at ?? null,
      preparedByName: preparation?.prepared_by_name ?? null,
      issueAt: preparation?.issue_at ?? null,
      issueByName: preparation?.issue_by_name ?? null,
      issueReason: preparation?.issue_reason ?? null,
    },
    deliveryTracking: {
      collectionStatus: preparation?.route_collection_status === "collected" ? "collected" : deliveryTracking?.collection_status ?? "pending",
      deliveryStatus: preparation?.route_delivery_status === "delivered" ? "delivered" : deliveryTracking?.status ?? "pending",
      collectedAt: preparation?.route_collection_status === "collected" ? preparation?.updated_at ?? null : deliveryTracking?.collected_at ?? null,
      deliveredAt: preparation?.route_delivery_status === "delivered" ? preparation?.updated_at ?? null : deliveryTracking?.delivered_at ?? null,
    },
    textiles: {
      sheets: numberValue(frozenTextiles?.sheets ?? property?.numero_sabanas),
      sheetsSmall: numberValue(frozenTextiles?.sheetsSmall ?? property?.numero_sabanas_pequenas),
      sheetsSuite: numberValue(frozenTextiles?.sheetsSuite ?? property?.numero_sabanas_suite),
      pillowCases: numberValue(frozenTextiles?.pillowCases ?? property?.numero_fundas_almohada),
      towelsLarge: numberValue(frozenTextiles?.towelsLarge ?? property?.numero_toallas_grandes),
      towelsSmall: numberValue(frozenTextiles?.towelsSmall ?? property?.numero_toallas_pequenas),
      bathMats: numberValue(frozenTextiles?.bathMats ?? property?.numero_alfombrines),
    },
    amenities: {
      toiletPaper: numberValue(frozenAmenities?.toiletPaper ?? property?.papel_higienico),
      kitchenPaper: numberValue(frozenAmenities?.kitchenPaper ?? property?.papel_cocina),
      shampoo: numberValue(frozenAmenities?.shampoo ?? property?.champu),
      conditioner: numberValue(frozenAmenities?.conditioner ?? property?.acondicionador),
      showerGel: numberValue(frozenAmenities?.showerGel ?? property?.gel_ducha),
      liquidSoap: numberValue(frozenAmenities?.liquidSoap ?? property?.jabon_liquido),
      bathroomAmenities: numberValue(frozenAmenities?.bathroomAmenities ?? property?.amenities_bano),
      kitchenAmenities: numberValue(frozenAmenities?.kitchenAmenities ?? property?.amenities_cocina),
      bathroomAirFreshener: numberValue(frozenAmenities?.bathroomAirFreshener ?? property?.ambientador_bano),
      trashBags: numberValue(frozenAmenities?.trashBags ?? property?.bolsas_basura),
      dishwasherDetergent: numberValue(frozenAmenities?.dishwasherDetergent ?? property?.detergente_lavavajillas),
      kitchenCloths: numberValue(frozenAmenities?.kitchenCloths ?? property?.bayetas_cocina),
      sponges: numberValue(frozenAmenities?.sponges ?? property?.estropajos),
      glassCleaner: numberValue(frozenAmenities?.glassCleaner ?? property?.limpiacristales),
      bathroomDisinfectant: numberValue(frozenAmenities?.bathroomDisinfectant ?? property?.desinfectante_bano),
      oil: numberValue(frozenAmenities?.oil ?? property?.aceite),
      vinegar: numberValue(frozenAmenities?.vinegar ?? property?.vinagre),
      salt: numberValue(frozenAmenities?.salt ?? property?.sal),
      sugar: numberValue(frozenAmenities?.sugar ?? property?.azucar),
      foodKit: numberValue(frozenAmenities?.foodKit ?? property?.kit_alimentario),
    },
    stockConsumables: stockConsumablesByProperty.get(propertyId) ?? [],
  };
}

function mapEventBag(
  event: JsonRecord,
  preparation: JsonRecord | undefined,
  originalTaskIds: Set<string>,
) {
  const payload = getObject(event.payload);
  const content = getObject(payload?.content) ?? {};
  const taskId = String(event.task_id ?? content.taskId ?? "");
  const noveltyType = String(event.novelty_type ?? "cancelled_before");
  const textiles = getObject(content.textiles) ?? {};
  const amenities = getObject(content.amenities) ?? {};
  return {
    taskId,
    propertyId: String(content.propertyId ?? ""),
    propertyCode: String(content.propertyCode ?? event.property_code ?? ""),
    propertyName: String(content.propertyName ?? event.property_code ?? ""),
    address: String(content.address ?? ""),
    date: String(content.date ?? event.delivery_date ?? ""),
    serviceTime: String(content.serviceTime ?? ""),
    cleaner: content.cleaner ?? null,
    isNew: !originalTaskIds.has(taskId),
    noveltyType,
    noveltyResolved: preparation?.route_novelty_resolved !== false,
    isCancelled: noveltyType === "cancelled_before" || noveltyType === "cancelled_after",
    cancellationStage: noveltyType === "cancelled_after" ? "after_preparation" : "before_preparation",
    bagStatus: {
      status: String(preparation?.status ?? "pending"),
      preparedAt: preparation?.prepared_at ?? null,
      preparedByName: preparation?.prepared_by_name ?? null,
      issueAt: preparation?.issue_at ?? null,
      issueByName: preparation?.issue_by_name ?? null,
      issueReason: preparation?.issue_reason ?? null,
    },
    deliveryTracking: {
      collectionStatus: preparation?.route_collection_status ?? "pending",
      deliveryStatus: preparation?.route_delivery_status ?? "pending",
      collectedAt: preparation?.updated_at ?? null,
      deliveredAt: preparation?.updated_at ?? null,
    },
    textiles,
    amenities,
    stockConsumables: [],
  };
}

function contentFromMappedBag(bag: JsonRecord): JsonRecord {
  return {
    taskId: bag.taskId,
    propertyId: bag.propertyId,
    propertyCode: bag.propertyCode,
    propertyName: bag.propertyName,
    address: bag.address,
    date: bag.date,
    serviceTime: bag.serviceTime,
    cleaner: bag.cleaner ?? null,
    textiles: bag.textiles ?? {},
    amenities: bag.amenities ?? {},
  };
}

function authorizationCoversBags(authorization: JsonRecord | null, bags: JsonRecord[]): boolean {
  if (!authorization || bags.length === 0) return false;
  const affectedTaskIds = new Set(stringArray(authorization.affected_task_ids));
  return bags.every((bag) => affectedTaskIds.has(String(bag.taskId)));
}

async function upsertPreparation(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
  taskId: string,
  status: "prepared" | "issue",
  issueReason?: string,
  contentSnapshot?: JsonRecord,
) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("laundry_bag_preparations")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();
  if (existingError) throw existingError;
  const payload: JsonRecord = {
    task_id: taskId,
    status,
    last_share_link_id: shareLinkId,
    updated_at: now,
  };

  const currentContent = getSnapshotContent(existing as JsonRecord | undefined);
  if (!currentContent && contentSnapshot) {
    payload.content_snapshot = contentSnapshot;
    payload.snapshot_locked_at = now;
  }

  if (status === "prepared") {
    payload.prepared_at = now;
    payload.prepared_by_name = "Lavanderia";
    payload.issue_at = null;
    payload.issue_by_name = null;
    payload.issue_reason = null;
    payload.route_novelty_type = "normal";
    payload.route_novelty_resolved = true;
  } else {
    payload.issue_at = now;
    payload.issue_by_name = "Lavanderia";
    payload.issue_reason = String(issueReason ?? "").trim();
    payload.route_novelty_resolved = false;
  }

  const { error } = await supabase
    .from("laundry_bag_preparations")
    .upsert(payload, { onConflict: "task_id" });
  if (error) throw error;
}

async function updateRoutePreparationAction(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
  taskId: string,
  action: "confirm_no_carry" | "undo_bag",
  contentSnapshot?: JsonRecord,
) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("laundry_bag_preparations")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();
  if (existingError) throw existingError;
  const payload: JsonRecord = {
    task_id: taskId,
    last_share_link_id: shareLinkId,
    updated_at: now,
  };
  if (!getSnapshotContent(existing as JsonRecord | undefined) && contentSnapshot) {
    payload.content_snapshot = contentSnapshot;
    payload.snapshot_locked_at = now;
  }
  if (action === "confirm_no_carry") {
    payload.route_novelty_resolved = true;
    payload.route_novelty_type = "cancelled_before";
    payload.status = "pending";
  } else {
    payload.status = "prepared";
    payload.route_novelty_type = "undone";
    payload.route_novelty_resolved = true;
    payload.undone_at = now;
    payload.undone_by_name = "Lavanderia";
    payload.undone_reason = "Bolsa deshecha durante el reparto";
    payload.issue_at = null;
    payload.issue_by_name = null;
    payload.issue_reason = null;
  }
  const { error } = await supabase.from("laundry_bag_preparations").upsert(payload, { onConflict: "task_id" });
  if (error) throw error;
}

async function updateRouteDeliveryStatus(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
  taskId: string,
  action: "collect" | "deliver",
) {
  const now = new Date().toISOString();
  const payload: JsonRecord = {
    task_id: taskId,
    last_share_link_id: shareLinkId,
    updated_at: now,
  };
  if (action === "collect") payload.route_collection_status = "collected";
  if (action === "deliver") payload.route_delivery_status = "delivered";
  const { error } = await supabase.from("laundry_bag_preparations").upsert(payload, { onConflict: "task_id" });
  if (error) throw error;
}

async function upsertDeliveryTracking(
  supabase: ReturnType<typeof createClient>,
  shareLinkId: string,
  taskId: string,
  action: "collect" | "deliver",
) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("laundry_delivery_tracking")
    .select("id")
    .eq("share_link_id", shareLinkId)
    .eq("task_id", taskId)
    .maybeSingle();
  if (existingError) throw existingError;

  const payload: JsonRecord = {};
  if (action === "collect") {
    payload.collection_status = "collected";
    payload.collected_at = now;
    payload.collected_by_name = "Repartidor";
  } else {
    payload.status = "delivered";
    payload.delivered_at = now;
    payload.delivered_by_name = "Repartidor";
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("laundry_delivery_tracking")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("laundry_delivery_tracking")
    .insert({
      share_link_id: shareLinkId,
      task_id: taskId,
      status: action === "deliver" ? "delivered" : "pending",
      collection_status: action === "collect" ? "collected" : "pending",
      ...payload,
    });
  if (error) throw error;
}

async function loadWorkflow(
  supabase: ReturnType<typeof createClient>,
  token: string,
  serviceKey: string,
) {
  let { data: link, error: linkError } = await supabase
    .from("laundry_share_links")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) return { notFound: true };
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { expired: true };

  const workflowVersion = String(link.workflow_version ?? "legacy");
  if (workflowVersion !== "route_v2") {
    return { workflowVersion: "legacy", link };
  }

  await refreshManagedRouteOnOpen(String(link.id), serviceKey);
  const { data: refreshedLink, error: refreshedLinkError } = await supabase
    .from("laundry_share_links")
    .select("*")
    .eq("id", link.id)
    .maybeSingle();
  if (refreshedLinkError) throw refreshedLinkError;
  if (refreshedLink) link = refreshedLink;

  const filters = (link.filters && typeof link.filters === "object" ? link.filters : {}) as JsonRecord;
  const deliveryDate = String(filters.deliveryDate ?? link.date_end);

  const { data: schedulesData, error: schedulesError } = await supabase
    .from("laundry_delivery_schedule")
    .select("*")
    .or(`sede_id.is.null,sede_id.eq.${link.sede_id}`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (schedulesError) throw schedulesError;

  const schedules = pickSchedules((schedulesData ?? []) as JsonRecord[], link.sede_id ?? null)
    .filter((schedule) => ROUTE_V2_DAYS.has(schedule.dayOfWeek));
  const currentSchedule = schedules.find((schedule) => schedule.dayOfWeek === getDayOfWeek(deliveryDate));
  if (!currentSchedule) throw new Error("No hay configuracion de ruta para este dia");
  const currentIndex = schedules.findIndex((schedule) => schedule.dayOfWeek === currentSchedule.dayOfWeek);
  const nextSchedule = schedules[(currentIndex + 1) % schedules.length];
  if (!nextSchedule) throw new Error("No hay siguiente ruta configurada");

  const currentRouteDates = stringArray(filters.routeDates).length
    ? stringArray(filters.routeDates)
    : stringArray(filters.collectionDates).length
      ? stringArray(filters.collectionDates)
      : calculateRouteDates(deliveryDate, currentSchedule.collectionDays);
  const nextDate = typeof filters.nextDeliveryDate === "string"
    ? filters.nextDeliveryDate
    : nextDeliveryDate(deliveryDate, nextSchedule.dayOfWeek);
  const nextRouteDates = stringArray(filters.nextRouteDates).length
    ? stringArray(filters.nextRouteDates)
    : calculateRouteDates(nextDate, nextSchedule.collectionDays);

  const [currentTasksRaw, nextTasksRaw] = await Promise.all([
    fetchTasksForDates(supabase, currentRouteDates, link.sede_id ?? null),
    fetchTasksForDates(supabase, nextRouteDates, link.sede_id ?? null),
  ]);

  const [currentOrder, nextOrder] = await Promise.all([
    loadRouteOrder(supabase, link.sede_id ?? null, getDayOfWeek(deliveryDate)),
    loadRouteOrder(supabase, link.sede_id ?? null, getDayOfWeek(nextDate)),
  ]);
  const currentTasks = sortRouteTasks(currentTasksRaw as JsonRecord[], currentOrder);
  const nextTasks = sortRouteTasks(nextTasksRaw as JsonRecord[], nextOrder);

  const currentTaskIds = currentTasks.map((task) => String(task.id));
  const nextTaskIds = nextTasks.map((task) => String(task.id));
  const routeEvents = await loadRouteEvents(supabase, String(link.id));
  const eventTaskIds = routeEvents.map((event) => String(event.task_id ?? "")).filter(Boolean);
  const allTaskIds = Array.from(new Set([...currentTaskIds, ...nextTaskIds, ...eventTaskIds]));

  const existingSnapshotIds = stringArray(link.snapshot_task_ids);
  const existingOriginalIds = stringArray(link.original_task_ids);
  const snapshotSet = new Set([...existingSnapshotIds, ...currentTaskIds]);
  const nextSnapshot = Array.from(snapshotSet);
  const nextOriginal = existingOriginalIds.length > 0 ? existingOriginalIds : currentTaskIds;
  if (
    nextSnapshot.length !== existingSnapshotIds.length ||
    nextOriginal.length !== existingOriginalIds.length
  ) {
    await supabase
      .from("laundry_share_links")
      .update({
        snapshot_task_ids: nextSnapshot,
        original_task_ids: nextOriginal,
      })
      .eq("id", link.id);
  }

  const originalSet = new Set(nextOriginal);
  const [preparations, tracking, authorization] = await Promise.all([
    loadPreparations(supabase, allTaskIds),
    loadDeliveryTracking(supabase, String(link.id)),
    loadLatestRouteAuthorization(supabase, String(link.id)),
  ]);

  const currentRouteBags = currentTasks.map((task) =>
    mapTask(task, preparations, tracking, new Map(), originalSet)
  );
  const nextRouteBags = nextTasks.map((task) =>
    mapTask(task, preparations, new Map(), new Map(), originalSet)
  );

  const currentTaskSet = new Set(currentTaskIds);
  const cancellationBags = routeEvents
    .filter((event) => event.event_type === "task_cancelled" && !currentTaskSet.has(String(event.task_id ?? "")))
    .map((event) => mapEventBag(event, preparations.get(String(event.task_id ?? "")), originalSet))
    .filter((bag) => !bag.noveltyResolved);
  currentRouteBags.push(...cancellationBags);

  const actualUrgentBags = currentRouteBags.filter((bag) => bag.bagStatus.status === "pending" || bag.noveltyResolved === false);
  const authorizedToContinue = authorizationCoversBags(authorization, actualUrgentBags);
  const urgentBags = authorizedToContinue ? [] : actualUrgentBags;
  const nextPendingBags = nextRouteBags.filter((bag) => bag.bagStatus.status === "pending");
  const blockingStep = urgentBags.length > 0
    ? "urgent"
      : nextPendingBags.length > 0
      ? "prepare_next"
      : "deliver";

  return {
    workflowVersion,
    link: {
      id: link.id,
      token: link.token,
      sedeId: link.sede_id,
      dateStart: link.date_start,
      dateEnd: link.date_end,
    },
    route: {
      deliveryDate,
      routeName: currentSchedule.name,
      routeDates: currentRouteDates,
      nextDeliveryDate: nextDate,
      nextRouteName: nextSchedule.name,
      nextRouteDates,
    },
    blockingStep,
    authorizedToContinue,
    authorization,
    urgentBags,
    nextRouteBags,
    currentRouteBags,
    stats: {
      urgentPending: actualUrgentBags.length,
      nextTotal: nextRouteBags.length,
      nextPrepared: nextRouteBags.filter((bag) => bag.bagStatus.status === "prepared").length,
      nextIssues: nextRouteBags.filter((bag) => bag.bagStatus.status === "issue").length,
      currentTotal: currentRouteBags.length,
      collected: currentRouteBags.filter((bag) => bag.deliveryTracking.collectionStatus === "collected").length,
      delivered: currentRouteBags.filter((bag) => bag.deliveryTracking.deliveryStatus === "delivered").length,
    },
  };
}

function recalculateWorkflowStats(workflow: JsonRecord): JsonRecord {
  const currentRouteBags = Array.isArray(workflow.currentRouteBags) ? workflow.currentRouteBags as JsonRecord[] : [];
  const nextRouteBags = Array.isArray(workflow.nextRouteBags) ? workflow.nextRouteBags as JsonRecord[] : [];
  const urgentBags = currentRouteBags.filter((bag) => {
    const bagStatus = bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {};
    return bagStatus.status === "pending" || bag.noveltyResolved === false;
  });
  const nextPendingBags = nextRouteBags.filter((bag) => {
    const bagStatus = bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {};
    return bagStatus.status === "pending";
  });

  const authorization = workflow.authorization && typeof workflow.authorization === "object"
    ? workflow.authorization as JsonRecord
    : null;
  const authorizedToContinue = authorizationCoversBags(authorization, urgentBags);
  const visibleUrgentBags = authorizedToContinue ? [] : urgentBags;

  return {
    ...workflow,
    urgentBags: visibleUrgentBags,
    authorizedToContinue,
    blockingStep: visibleUrgentBags.length > 0 ? "urgent" : nextPendingBags.length > 0 ? "prepare_next" : "deliver",
    stats: {
      urgentPending: urgentBags.length,
      nextTotal: nextRouteBags.length,
      nextPrepared: nextRouteBags.filter((bag) => {
        const bagStatus = bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {};
        return bagStatus.status === "prepared";
      }).length,
      nextIssues: nextRouteBags.filter((bag) => {
        const bagStatus = bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {};
        return bagStatus.status === "issue";
      }).length,
      currentTotal: currentRouteBags.length,
      collected: currentRouteBags.filter((bag) => {
        const tracking = bag.deliveryTracking && typeof bag.deliveryTracking === "object" ? bag.deliveryTracking as JsonRecord : {};
        return tracking.collectionStatus === "collected";
      }).length,
      delivered: currentRouteBags.filter((bag) => {
        const tracking = bag.deliveryTracking && typeof bag.deliveryTracking === "object" ? bag.deliveryTracking as JsonRecord : {};
        return tracking.deliveryStatus === "delivered";
      }).length,
    },
  };
}

function applyActionToWorkflow(
  workflow: JsonRecord,
  taskId: string,
  action: "prepare" | "issue" | "collect" | "deliver" | "confirm_no_carry" | "undo_bag",
  issueReason = "",
): JsonRecord {
  const updateBag = (bag: JsonRecord): JsonRecord => {
    if (String(bag.taskId) !== taskId) return bag;

    if (action === "prepare") {
      return {
        ...bag,
        bagStatus: {
          ...(bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {}),
          status: "prepared",
          issueReason: null,
          preparedAt: new Date().toISOString(),
        },
        noveltyResolved: true,
        isCancelled: false,
      };
    }

    if (action === "issue" || action === "critical_block") {
      return {
        ...bag,
        bagStatus: {
          ...(bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {}),
          status: "issue",
          issueReason,
        },
        noveltyResolved: false,
      };
    }

    if (action === "confirm_no_carry") {
      return { ...bag, noveltyResolved: true };
    }

    if (action === "undo_bag") {
      return {
        ...bag,
        noveltyResolved: true,
        noveltyType: "undone",
        isCancelled: true,
        cancellationStage: "after_preparation",
        bagStatus: {
          ...(bag.bagStatus && typeof bag.bagStatus === "object" ? bag.bagStatus as JsonRecord : {}),
          status: "prepared",
        },
      };
    }

    const tracking = bag.deliveryTracking && typeof bag.deliveryTracking === "object" ? bag.deliveryTracking as JsonRecord : {};
    return {
      ...bag,
      deliveryTracking: {
        ...tracking,
        collectionStatus: action === "collect" ? "collected" : tracking.collectionStatus,
        deliveryStatus: action === "deliver" ? "delivered" : tracking.deliveryStatus,
      },
    };
  };

  const currentRouteBags = Array.isArray(workflow.currentRouteBags)
    ? (workflow.currentRouteBags as JsonRecord[]).map(updateBag)
    : [];
  const nextRouteBags = Array.isArray(workflow.nextRouteBags)
    ? (workflow.nextRouteBags as JsonRecord[]).map(updateBag)
    : [];

  return recalculateWorkflowStats({
    ...workflow,
    currentRouteBags,
    nextRouteBags,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = (typeof body.action === "string" ? body.action : "load") as RouteAction;
    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    const issueReason = typeof body.issueReason === "string" ? body.issueReason.trim() : "";

    if (!token) return json({ error: "Token requerido" }, 400);

    if (action !== "load") {
      const workflow = await loadWorkflow(supabase, token, serviceKey);
      if ("notFound" in workflow) return json({ error: "Enlace no valido" }, 404);
      if ("expired" in workflow) return json({ error: "Enlace expirado" }, 410);
      if (workflow.workflowVersion !== "route_v2" || !("link" in workflow)) {
        return json({ error: "El enlace no usa el flujo nuevo" }, 400);
      }
      if (!taskId) return json({ error: "taskId requerido" }, 400);

      const allowedTaskIds = new Set([
        ...(workflow.currentRouteBags ?? []).map((bag: JsonRecord) => String(bag.taskId)),
        ...(workflow.nextRouteBags ?? []).map((bag: JsonRecord) => String(bag.taskId)),
      ]);
      if (!allowedTaskIds.has(taskId)) return json({ error: "La tarea no pertenece a esta ruta" }, 400);

      const targetBag = [
        ...(workflow.currentRouteBags ?? []),
        ...(workflow.nextRouteBags ?? []),
      ].find((bag: JsonRecord) => String(bag.taskId) === taskId) as JsonRecord | undefined;
      const contentSnapshot = targetBag ? contentFromMappedBag(targetBag) : undefined;

      if (action === "prepare") {
        await upsertPreparation(supabase, String(workflow.link.id), taskId, "prepared", undefined, contentSnapshot);
      } else if (action === "issue" || action === "critical_block") {
        if (issueReason.length < 3) return json({ error: "El motivo de incidencia es obligatorio" }, 400);
        await upsertPreparation(supabase, String(workflow.link.id), taskId, "issue", issueReason, contentSnapshot);
      } else if (action === "confirm_no_carry" || action === "undo_bag") {
        if (action === "confirm_no_carry" && (!targetBag?.isCancelled || targetBag.cancellationStage === "after_preparation")) {
          return json({ error: "Esta bolsa debe marcarse como deshecha" }, 400);
        }
        if (action === "undo_bag" && (!targetBag?.isCancelled || targetBag.cancellationStage !== "after_preparation")) {
          return json({ error: "Solo se puede deshacer una bolsa cancelada después de prepararla" }, 400);
        }
        await updateRoutePreparationAction(supabase, String(workflow.link.id), taskId, action, contentSnapshot);
      } else if (action === "collect" || action === "deliver") {
        const currentTaskIds = new Set((workflow.currentRouteBags ?? []).map((bag: JsonRecord) => String(bag.taskId)));
        if (!currentTaskIds.has(taskId)) return json({ error: "Solo se puede recoger o entregar la ruta actual" }, 400);
        await updateRouteDeliveryStatus(supabase, String(workflow.link.id), taskId, action);
      }

      const eventType = action === "prepare"
        ? "bag_prepared"
        : action === "issue"
          ? "bag_issue"
          : action === "critical_block"
            ? "critical_block"
          : action === "confirm_no_carry"
            ? "bag_no_carry"
            : action === "undo_bag"
              ? "bag_undo"
              : null;
      if (eventType) {
        await recordEvent(supabase, {
          sede_id: workflow.link.sedeId,
          share_link_id: workflow.link.id,
          delivery_date: workflow.route.deliveryDate,
          task_id: taskId,
          event_type: eventType,
          novelty_type: action === "undo_bag" ? "undone" : targetBag?.noveltyType ?? null,
          property_code: targetBag?.propertyCode ?? null,
          event_key: `bag-action:${eventType}:${workflow.link.id}:${taskId}:${Date.now()}`,
          payload: { issueReason: issueReason || null, content: contentSnapshot ?? null },
          actor_name: "Equipo de ruta",
        });
      }

      return json({
        success: true,
        workflow: applyActionToWorkflow(workflow as JsonRecord, taskId, action, issueReason),
      });
    }

    const workflow = await loadWorkflow(supabase, token, serviceKey);
    if ("notFound" in workflow) return json({ error: "Enlace no valido" }, 404);
    if ("expired" in workflow) return json({ error: "Enlace expirado" }, 410);
    return json({ success: true, workflow });
  } catch (err) {
    console.error("laundry-route-workflow error", err);
    return json({ error: err instanceof Error ? err.message : "Error desconocido" }, 500);
  }
});
