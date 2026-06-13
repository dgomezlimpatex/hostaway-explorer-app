import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const ALLOWED_EMAIL = "dgomezlimpatex@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function getAllowedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const token = extractBearer(req);
  if (!token) throw new Response("Missing authorization", { status: 401, headers: corsHeaders });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response("Invalid session", { status: 401, headers: corsHeaders });

  const email = data.user.email?.toLowerCase() ?? "";
  if (email !== ALLOWED_EMAIL) throw new Response("AI copilot is not enabled for this user", { status: 403, headers: corsHeaders });

  return { user: data.user, email };
}

function addMinutes(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + Math.max(1, Math.round(minutes));
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

async function audit(
  supabase: ReturnType<typeof createClient>,
  proposal: Record<string, unknown>,
  ownerEmail: string,
  actionType: string,
  status: "started" | "success" | "failed" | "skipped",
  payload: unknown,
  result?: unknown,
) {
  await supabase.from("ai_action_audit_logs").insert({
    proposal_id: proposal.id,
    owner_user_id: proposal.owner_user_id,
    owner_email: ownerEmail,
    action_type: actionType,
    status,
    payload,
    result: result ?? null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { user, email } = await getAllowedUser(req, supabase);
    const body = await req.json().catch(() => ({}));
    const proposalId = typeof body.proposalId === "string" ? body.proposalId : "";
    if (!proposalId) return json({ error: "Falta proposalId" }, 400);

    const { data: proposal, error: proposalError } = await supabase
      .from("ai_action_proposals")
      .select("*")
      .eq("id", proposalId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (proposalError) throw proposalError;
    if (!proposal) return json({ error: "Propuesta no encontrada" }, 404);
    if (proposal.status !== "pending") return json({ error: "La propuesta ya no está pendiente" }, 409);

    const actions = Array.isArray(proposal.actions) ? proposal.actions : [];
    const results: Array<Record<string, unknown>> = [];
    let failures = 0;

    for (const rawAction of actions) {
      const action = rawAction as Record<string, unknown>;
      const type = safeString(action.type);
      await audit(supabase, proposal, email, type || "unknown", "started", action);

      try {
        if (type === "assign_task") {
          const taskId = safeString(action.taskId);
          const cleanerId = safeString(action.cleanerId);
          if (!taskId || !cleanerId) throw new Error("assign_task requiere taskId y cleanerId");

          const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("id,sede_id,status")
            .eq("id", taskId)
            .maybeSingle();
          if (taskError) throw taskError;
          if (!task) throw new Error("Tarea no encontrada");
          if (task.status === "completed") throw new Error("No se asignan tareas completadas");

          const { data: cleaner, error: cleanerError } = await supabase
            .from("cleaners")
            .select("id,name,sede_id,is_active")
            .eq("id", cleanerId)
            .maybeSingle();
          if (cleanerError) throw cleanerError;
          if (!cleaner || !cleaner.is_active) throw new Error("Trabajador no encontrado o inactivo");
          if (cleaner.sede_id !== task.sede_id) throw new Error("La tarea y el trabajador no pertenecen a la misma sede");

          const updatePayload: Record<string, unknown> = {
            cleaner_id: cleaner.id,
            cleaner: cleaner.name,
            updated_at: new Date().toISOString(),
          };
          const startTime = validTime(action.startTime);
          const endTime = validTime(action.endTime);
          if (startTime) updatePayload.start_time = startTime;
          if (endTime) updatePayload.end_time = endTime;

          const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update(updatePayload)
            .eq("id", taskId)
            .select("id,property,cleaner,date,start_time,end_time")
            .single();
          if (updateError) throw updateError;

          results.push({ type, status: "success", taskId, cleanerId, task: updated });
          await audit(supabase, proposal, email, type, "success", action, updated);
          continue;
        }

        if (type === "create_task") {
          const propertyId = safeString(action.propertyId);
          const date = safeString(action.date);
          const startTime = validTime(action.startTime) ?? "10:00";
          const duration = Number(action.duration ?? 60);
          const cleanerId = safeString(action.cleanerId);
          if (!propertyId || !date) throw new Error("create_task requiere propertyId y date");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Fecha inválida");

          const { data: property, error: propertyError } = await supabase
            .from("properties")
            .select("id,nombre,direccion,cliente_id,sede_id,duracion_servicio,coste_servicio,check_in_predeterminado,check_out_predeterminado,is_active")
            .eq("id", propertyId)
            .maybeSingle();
          if (propertyError) throw propertyError;
          if (!property || property.is_active === false) throw new Error("Propiedad no encontrada o inactiva");

          let cleanerName: string | null = null;
          if (cleanerId) {
            const { data: cleaner, error: cleanerError } = await supabase
              .from("cleaners")
              .select("id,name,sede_id,is_active")
              .eq("id", cleanerId)
              .maybeSingle();
            if (cleanerError) throw cleanerError;
            if (!cleaner || !cleaner.is_active) throw new Error("Trabajador no encontrado o inactivo");
            if (cleaner.sede_id !== property.sede_id) throw new Error("La propiedad y el trabajador no pertenecen a la misma sede");
            cleanerName = cleaner.name;
          }

          const minutes = Number.isFinite(duration) ? Math.max(1, Math.round(duration)) : Number(property.duracion_servicio ?? 60);
          const endTime = addMinutes(startTime, minutes);
          const taskType = safeString(action.taskType, "limpieza-turistica");

          const { data: created, error: insertError } = await supabase
            .from("tasks")
            .insert({
              property: property.nombre,
              address: property.direccion,
              date,
              start_time: startTime,
              end_time: endTime,
              check_in: property.check_in_predeterminado ?? "",
              check_out: property.check_out_predeterminado ?? "",
              type: taskType,
              status: "pending",
              cleaner_id: cleanerId || null,
              cleaner: cleanerName,
              cliente_id: property.cliente_id,
              propiedad_id: property.id,
              sede_id: property.sede_id,
              duracion: minutes,
              coste: property.coste_servicio ?? 0,
              notes: null,
            })
            .select("id,property,date,start_time,end_time,cleaner")
            .single();
          if (insertError) throw insertError;

          results.push({ type, status: "success", taskId: created.id, task: created });
          await audit(supabase, proposal, email, type, "success", action, created);
          continue;
        }

        throw new Error(`Tipo de accion no permitido: ${type}`);
      } catch (error) {
        failures += 1;
        const message = error instanceof Error ? error.message : "Error desconocido";
        results.push({ type, status: "failed", error: message, action });
        await audit(supabase, proposal, email, type || "unknown", "failed", action, { error: message });
      }
    }

    const finalStatus = failures > 0 ? "failed" : "applied";
    await supabase
      .from("ai_action_proposals")
      .update({ status: finalStatus, result: { results, failures }, updated_at: new Date().toISOString() })
      .eq("id", proposalId);

    return json({ success: failures === 0, status: finalStatus, results, failures });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("apply-ai-actions error", err);
    return json({ error: err instanceof Error ? err.message : "Error desconocido" }, 500);
  }
});
