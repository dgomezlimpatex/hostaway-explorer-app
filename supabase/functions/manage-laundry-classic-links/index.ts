import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { assertAdminManagerOrServiceRole, authorizationErrorResponse } from '../_shared/edgeAuthorization.ts';
const OWNER_EMAIL = 'dgomezlimpatex@gmail.com';
const MADRID_TIME_ZONE = 'Europe/Madrid';
const MANAGED_WORKFLOW = 'legacy';
const MANAGED_LINK_TYPE = 'scheduled';
const LINK_EXPIRATION_DAYS = 30;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret'
};
class HttpError extends Error {
  status;
  constructor(status, message){
    super(message);
    this.status = status;
  }
}
const jsonResponse = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
const unique = (values)=>Array.from(new Set(values));
const getMadridDate = ()=>{
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part)=>[
      part.type,
      part.value
    ]));
  return `${values.year}-${values.month}-${values.day}`;
};
const parseDate = (value)=>{
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Fecha invalida. Usa el formato YYYY-MM-DD.');
  }
  return new Date(`${value}T12:00:00.000Z`);
};
const formatDate = (date)=>date.toISOString().slice(0, 10);
const addDays = (dateValue, amount)=>{
  const date = parseDate(dateValue);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
};
const getDayOfWeek = (dateValue)=>parseDate(dateValue).getUTCDay();
const getCollectionDates = (deliveryDate, schedule)=>{
  const deliveryDay = getDayOfWeek(deliveryDate);
  return unique((schedule.collection_days || []).map((collectionDay)=>{
    const daysBack = (deliveryDay - collectionDay + 7) % 7;
    return addDays(deliveryDate, -daysBack);
  })).sort();
};
const getManagedExpiry = (deliveryDate)=>`${addDays(deliveryDate, LINK_EXPIRATION_DAYS)}T23:59:59.000Z`;
const isNotCountCleaner = (cleaner)=>(cleaner || '').trim().toUpperCase() === 'NOT COUNT';
const asProperty = (value)=>{
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};
const loadEffectiveSchedules = async (admin, sedeId)=>{
  const { data, error } = await admin.from('laundry_delivery_schedule').select('id, sede_id, day_of_week, name, collection_days, is_active, sort_order').or(`sede_id.is.null,sede_id.eq.${sedeId}`).eq('is_active', true).order('sort_order', {
    ascending: true
  });
  if (error) throw error;
  const effective = new Map();
  for (const raw of data || []){
    const row = {
      ...raw,
      collection_days: Array.isArray(raw.collection_days) ? raw.collection_days : []
    };
    if (!effective.has(row.day_of_week) || row.sede_id === sedeId) {
      effective.set(row.day_of_week, row);
    }
  }
  return Array.from(effective.values()).sort((a, b)=>a.sort_order - b.sort_order);
};
const getNextDeliveryDates = (schedules, startDate, count = 3)=>{
  const byDay = new Map(schedules.map((schedule)=>[
      schedule.day_of_week,
      schedule
    ]));
  const result = [];
  for(let offset = 0; offset <= 21 && result.length < count; offset += 1){
    const date = addDays(startDate, offset);
    const schedule = byDay.get(getDayOfWeek(date));
    if (schedule && !result.some((item)=>item.date === date)) {
      result.push({
        date,
        schedule
      });
    }
  }
  return result;
};
const loadEligibleTasks = async (admin, sedeId, collectionDates)=>{
  const { data, error } = await admin.from('tasks').select(`
      id,
      propiedad_id,
      property,
      date,
      start_time,
      cleaner,
      properties:propiedad_id (
        id,
        linen_control_enabled,
        is_active,
        clients:cliente_id (
          linen_control_enabled,
          is_active
        )
      )
    `).eq('sede_id', sedeId).eq('type', 'limpieza-turistica').in('date', collectionDates);
  if (error) throw error;
  return (data || []).map((task)=>({
      ...task,
      properties: asProperty(task.properties)
    })).filter((task)=>{
    if (isNotCountCleaner(task.cleaner)) return false;
    const property = task.properties;
    if (!property) return false;
    const clientIsActive = property.clients?.is_active !== false;
    const propertyIsActive = property.is_active !== null ? property.is_active : clientIsActive;
    if (!propertyIsActive) return false;
    const propertyLinen = property.linen_control_enabled;
    const clientLinen = property.clients?.linen_control_enabled ?? false;
    return (propertyLinen !== null ? propertyLinen : clientLinen) === true;
  });
};
const orderTasks = async (admin, tasks, sedeId, deliveryDate)=>{
  if (tasks.length < 2) return tasks;
  const routeDay = getDayOfWeek(deliveryDate);
  const { data, error } = await admin.from('laundry_classic_route_order').select('property_id, position, delivery_day').eq('sede_id', sedeId).in('delivery_day', [
    routeDay,
    -1
  ]);
  if (error) throw error;
  const rows = data || [];
  const globalRows = rows.filter((row)=>row.delivery_day === -1);
  const specificRows = rows.filter((row)=>row.delivery_day === routeDay);
  const applicable = globalRows.length > 0 ? globalRows : specificRows;
  const positionByProperty = new Map(applicable.map((row)=>[
      row.property_id,
      row.position
    ]));
  return [
    ...tasks
  ].sort((a, b)=>{
    const positionA = positionByProperty.get(a.propiedad_id || '') ?? Number.MAX_SAFE_INTEGER;
    const positionB = positionByProperty.get(b.propiedad_id || '') ?? Number.MAX_SAFE_INTEGER;
    if (positionA !== positionB) return positionA - positionB;
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const timeCompare = String(a.start_time || '').localeCompare(String(b.start_time || ''));
    if (timeCompare !== 0) return timeCompare;
    return String(a.property || '').localeCompare(String(b.property || ''), 'es', {
      numeric: true
    });
  });
};
const loadLinkForDate = async (admin, sedeId, deliveryDate)=>{
  const { data, error } = await admin.from('laundry_share_links').select(`
      id, token, created_by, sede_id, date_start, date_end, delivery_day,
      delivery_date, expires_at, is_permanent, is_active, snapshot_task_ids,
      original_task_ids, manual_excluded_task_ids, filters, link_type,
      workflow_version, route_order_applied, auto_managed,
      last_synced_at, sync_status, sync_error
    `).eq('sede_id', sedeId).eq('is_active', true).eq('link_type', MANAGED_LINK_TYPE).or('workflow_version.neq.route_v2,workflow_version.is.null');
  if (error) throw error;
  return (data || []).find((link)=>{
    const filterDate = typeof link.filters?.deliveryDate === 'string' ? link.filters.deliveryDate : null;
    return link.delivery_date === deliveryDate || filterDate === deliveryDate;
  }) || null;
};
const getOwnerId = async (admin)=>{
  const { data: profile } = await admin.from('profiles').select('id').eq('email', OWNER_EMAIL).maybeSingle();
  if (profile?.id) return profile.id;
  const { data: adminRole, error } = await admin.from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle();
  if (error || !adminRole?.user_id) throw new Error('No se encontro un usuario administrador para crear el enlace.');
  return adminRole.user_id;
};
const getActorEmail = async (admin, actor)=>{
  if (!actor.userId) return null;
  const { data } = await admin.from('profiles').select('email').eq('id', actor.userId).maybeSingle();
  return data?.email?.toLowerCase() || null;
};
const userCanAccessSede = async (admin, actor, sedeId)=>{
  if (actor.kind !== 'user' || actor.role === 'admin') return true;
  if (!actor.userId) return false;
  const { data, error } = await admin.from('user_sede_access').select('id').eq('user_id', actor.userId).eq('sede_id', sedeId).eq('can_access', true).maybeSingle();
  return !error && !!data;
};
const deriveManualExclusions = (link)=>{
  const original = link.original_task_ids || [];
  const snapshot = new Set(link.snapshot_task_ids || []);
  return original.filter((taskId)=>!snapshot.has(taskId));
};
const ensureManagedLink = async ({ admin, sedeId, deliveryDate, schedule, actorId, trigger })=>{
  let link = await loadLinkForDate(admin, sedeId, deliveryDate);
  const collectionDates = getCollectionDates(deliveryDate, schedule);
  const dateStart = collectionDates[0] || deliveryDate;
  const filters = {
    ...link?.filters || {},
    protocolized: true,
    workflowVersion: MANAGED_WORKFLOW,
    deliveryDate,
    collectionDates,
    routeDates: collectionDates
  };
  if (!link) {
    const createdBy = actorId || await getOwnerId(admin);
    const token = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
    const insertData = {
      token,
      created_by: createdBy,
      sede_id: sedeId,
      date_start: dateStart,
      date_end: deliveryDate,
      delivery_day: getDayOfWeek(deliveryDate),
      delivery_date: deliveryDate,
      expires_at: getManagedExpiry(deliveryDate),
      is_permanent: false,
      is_active: true,
      snapshot_task_ids: [],
      original_task_ids: [],
      manual_excluded_task_ids: [],
      filters,
      link_type: MANAGED_LINK_TYPE,
      workflow_version: MANAGED_WORKFLOW,
      route_order_applied: true,
      auto_managed: true,
      sync_status: 'pending',
      sync_error: null
    };
    const { data, error } = await admin.from('laundry_share_links').insert(insertData).select(`
        id, token, created_by, sede_id, date_start, date_end, delivery_day,
        delivery_date, expires_at, is_permanent, is_active, snapshot_task_ids,
        original_task_ids, manual_excluded_task_ids, filters, link_type,
        workflow_version, route_order_applied, auto_managed,
        last_synced_at, sync_status, sync_error
      `).single();
    if (error?.code === '23505') {
      link = await loadLinkForDate(admin, sedeId, deliveryDate);
    } else if (error) {
      throw error;
    } else {
      link = data;
    }
  }
  if (!link) throw new Error(`No se pudo preparar el enlace del ${deliveryDate}.`);
  const excluded = link.manual_excluded_task_ids?.length ? link.manual_excluded_task_ids : deriveManualExclusions(link);
  const { data: updated, error: updateError } = await admin.from('laundry_share_links').update({
    delivery_date: deliveryDate,
    date_start: dateStart,
    date_end: deliveryDate,
    delivery_day: getDayOfWeek(deliveryDate),
    filters,
    route_order_applied: true,
    auto_managed: true,
    manual_excluded_task_ids: excluded,
    sync_status: 'pending',
    sync_error: null
  }).eq('id', link.id).select(`
      id, token, created_by, sede_id, date_start, date_end, delivery_day,
      delivery_date, expires_at, is_permanent, is_active, snapshot_task_ids,
      original_task_ids, manual_excluded_task_ids, filters, link_type,
      workflow_version, route_order_applied, auto_managed,
      last_synced_at, sync_status, sync_error
    `).single();
  if (updateError) throw updateError;
  return await reconcileLink({
    admin,
    link: updated,
    schedule,
    trigger,
    actorId,
    excluded
  });
};
const insertSyncRun = async (admin, values)=>{
  const { error } = await admin.from('laundry_link_sync_runs').insert(values);
  if (error) console.error('No se pudo guardar la auditoria del enlace:', error);
};
const reconcileLink = async ({ admin, link, schedule, trigger, actorId, excluded })=>{
  const startedAt = new Date().toISOString();
  try {
    if (!link.sede_id) throw new Error('El enlace no tiene sede asociada.');
    const collectionDates = getCollectionDates(link.delivery_date || link.date_end, schedule);
    const tasks = await loadEligibleTasks(admin, link.sede_id, collectionDates);
    const orderedTasks = await orderTasks(admin, tasks, link.sede_id, link.delivery_date || link.date_end);
    const excludedSet = new Set(excluded);
    const includedTasks = orderedTasks.filter((task)=>!excludedSet.has(task.id));
    const currentTaskIds = unique(tasks.map((task)=>task.id));
    const nextSnapshot = includedTasks.map((task)=>task.id);
    const previousSnapshot = unique(link.snapshot_task_ids || []);
    const previousSet = new Set(previousSnapshot);
    const nextSet = new Set(nextSnapshot);
    const added = nextSnapshot.filter((taskId)=>!previousSet.has(taskId));
    const removed = previousSnapshot.filter((taskId)=>!nextSet.has(taskId));
    const nextFilters = {
      ...link.filters || {},
      protocolized: true,
      workflowVersion: MANAGED_WORKFLOW,
      deliveryDate: link.delivery_date || link.date_end,
      collectionDates,
      routeDates: collectionDates
    };
    const { data: updated, error } = await admin.from('laundry_share_links').update({
      snapshot_task_ids: nextSnapshot,
      original_task_ids: currentTaskIds,
      manual_excluded_task_ids: excluded,
      filters: nextFilters,
      route_order_applied: true,
      auto_managed: true,
      last_synced_at: new Date().toISOString(),
      sync_status: 'ok',
      sync_error: null
    }).eq('id', link.id).select(`
        id, token, created_by, sede_id, date_start, date_end, delivery_day,
        delivery_date, expires_at, is_permanent, is_active, snapshot_task_ids,
        original_task_ids, manual_excluded_task_ids, filters, link_type,
        workflow_version, route_order_applied, auto_managed,
        last_synced_at, sync_status, sync_error
      `).single();
    if (error) throw error;
    await insertSyncRun(admin, {
      sede_id: link.sede_id,
      share_link_id: link.id,
      delivery_date: link.delivery_date || link.date_end,
      trigger,
      actor_id: actorId,
      status: 'ok',
      task_count: nextSnapshot.length,
      added_count: added.length,
      removed_count: removed.length,
      excluded_count: excluded.length,
      details: {
        collectionDates,
        addedTaskIds: added,
        removedTaskIds: removed,
        excludedTaskIds: excluded,
        startedAt
      },
      started_at: startedAt,
      completed_at: new Date().toISOString()
    });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido de sincronizacion';
    await admin.from('laundry_share_links').update({
      last_synced_at: new Date().toISOString(),
      sync_status: 'error',
      sync_error: message.slice(0, 500)
    }).eq('id', link.id);
    await insertSyncRun(admin, {
      sede_id: link.sede_id,
      share_link_id: link.id,
      delivery_date: link.delivery_date || link.date_end,
      trigger,
      actor_id: actorId,
      status: 'error',
      task_count: 0,
      details: {
        error: message,
        startedAt
      },
      started_at: startedAt,
      completed_at: new Date().toISOString()
    });
    throw error;
  }
};
const reconcileSede = async (admin, sedeId, trigger, actorId)=>{
  const schedules = await loadEffectiveSchedules(admin, sedeId);
  const deliveryDates = getNextDeliveryDates(schedules, getMadridDate(), 3);
  const links = [];
  for (const item of deliveryDates){
    links.push(await ensureManagedLink({
      admin,
      sedeId,
      deliveryDate: item.date,
      schedule: item.schedule,
      actorId,
      trigger
    }));
  }
  return links;
};
const reconcileSingleDate = async (admin, sedeId, deliveryDate, trigger, actorId)=>{
  const schedules = await loadEffectiveSchedules(admin, sedeId);
  const schedule = schedules.find((item)=>item.day_of_week === getDayOfWeek(deliveryDate));
  if (!schedule) throw new HttpError(400, 'La fecha elegida no es un dia activo de reparto.');
  return ensureManagedLink({
    admin,
    sedeId,
    deliveryDate,
    schedule,
    actorId,
    trigger
  });
};
const refreshPublicLink = async (admin, token)=>{
  if (!token || token.length > 100) throw new HttpError(400, 'Token invalido.');
  const { data, error } = await admin.from('laundry_share_links').select(`
      id, token, created_by, sede_id, date_start, date_end, delivery_day,
      delivery_date, expires_at, is_permanent, is_active, snapshot_task_ids,
      original_task_ids, manual_excluded_task_ids, filters, link_type,
      workflow_version, route_order_applied, auto_managed,
      last_synced_at, sync_status, sync_error
    `).eq('token', token).eq('is_active', true).maybeSingle();
  if (error) throw error;
  const link = data;
  if (!link || link.workflow_version === 'route_v2' || link.auto_managed !== true || !link.sede_id) {
    return link;
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) return link;
  const schedules = await loadEffectiveSchedules(admin, link.sede_id);
  const schedule = schedules.find((item)=>item.day_of_week === (link.delivery_date ? getDayOfWeek(link.delivery_date) : link.delivery_day));
  if (!schedule) return link;
  return ensureManagedLink({
    admin,
    sedeId: link.sede_id,
    deliveryDate: link.delivery_date || link.date_end,
    schedule,
    actorId: null,
    trigger: 'on_open'
  });
};
const handleRequest = async (req)=>{
  if (req.method === 'OPTIONS') return new Response(null, {
    headers: corsHeaders
  });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Faltan variables de Supabase.');
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const body = await req.json().catch(()=>({}));
  // The scheduled job sends only its source marker. Treat that invocation as
  // a full reconciliation so a stale cron payload cannot silently do nothing.
  const action = body.action || (body.source === 'cron' ? 'reconcile' : null);
  if (action === 'refresh') {
    const link = await refreshPublicLink(admin, String(body.token || ''));
    return jsonResponse({
      success: true,
      shareLink: link
    });
  }
  const actor = await assertAdminManagerOrServiceRole(req, admin, serviceRoleKey);
  const actorEmail = await getActorEmail(admin, actor);
  const actorId = actor.userId || (actor.kind === 'user' ? null : await getOwnerId(admin));
  if (action === 'ensure_link') {
    const sedeId = String(body.sedeId || '');
    const deliveryDate = String(body.deliveryDate || '');
    if (!sedeId || !deliveryDate) throw new HttpError(400, 'sedeId y deliveryDate son obligatorios.');
    if (!await userCanAccessSede(admin, actor, sedeId)) throw new Response('Forbidden', {
      status: 403
    });
    const link = await reconcileSingleDate(admin, sedeId, deliveryDate, 'create', actorId);
    return jsonResponse({
      success: true,
      shareLink: link
    });
  }
  if (action === 'reconcile') {
    if (actor.kind === 'user' && actorEmail !== OWNER_EMAIL) throw new Response('Forbidden', {
      status: 403
    });
    const sedeId = body.sedeId ? String(body.sedeId) : null;
    let sedeIds;
    if (sedeId) {
      sedeIds = [
        sedeId
      ];
    } else {
      const { data: sedes, error } = await admin.from('sedes').select('id').eq('is_active', true);
      if (error) throw error;
      sedeIds = (sedes || []).map((sede)=>sede.id);
    }
    const results = [];
    for (const id of sedeIds){
      results.push(...await reconcileSede(admin, id, actor.kind === 'cron' ? 'cron' : 'manual', actorId));
    }
    return jsonResponse({
      success: true,
      sedes: sedeIds.length,
      links: results
    });
  }
  if (action === 'deactivate') {
    if (actor.kind === 'user' && actorEmail !== OWNER_EMAIL) throw new Response('Forbidden', {
      status: 403
    });
    const linkId = String(body.linkId || '');
    if (!linkId) throw new HttpError(400, 'linkId es obligatorio.');
    const { error } = await admin.from('laundry_share_links').update({
      is_active: false
    }).eq('id', linkId);
    if (error) throw error;
    return jsonResponse({
      success: true
    });
  }
  throw new HttpError(400, 'Accion no reconocida.');
};
serve(async (req)=>{
  try {
    return await handleRequest(req);
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    if (error instanceof HttpError) return jsonResponse({
      success: false,
      error: error.message
    }, error.status);
    console.error('Error en manage-laundry-classic-links:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, 500);
  }
});
