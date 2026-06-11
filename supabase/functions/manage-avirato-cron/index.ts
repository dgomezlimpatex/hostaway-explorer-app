import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, scheduleId } = await req.json().catch(() => ({}));

    await assertAdminOrInternal(req, supabase, supabaseServiceKey);

    switch (action) {
      case "setup":
        return setupCronJobs(supabase, supabaseUrl, supabaseServiceKey);
      case "list":
        return listCronJobs(supabase);
      case "delete":
        return deleteCronJob(supabase, scheduleId);
      case "sync":
        return runSync(supabase, scheduleId);
      default:
        return json({ error: "Accion no valida", validActions: ["setup", "list", "delete", "sync"] }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: message }, 500);
  }
});

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

async function setupCronJobs(supabase: any, supabaseUrl: string, supabaseServiceKey: string) {
  const { data: schedules, error } = await supabase
    .from("avirato_sync_schedules")
    .select("*")
    .eq("is_active", true)
    .order("hour", { ascending: true });

  if (error) throw new Error(`Error obteniendo horarios: ${error.message}`);
  if (!schedules || schedules.length === 0) {
    return json({ success: true, message: "No hay horarios activos configurados para Avirato", jobsCreated: 0 });
  }

  const functionUrl = `${supabaseUrl}/functions/v1/avirato-sync`;
  const authHeader = JSON.stringify({
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseServiceKey}`,
  });
  const results = [];

  for (const schedule of schedules) {
    const cronSchedule = `${schedule.minute} ${schedule.hour} * * *`;
    const jobName = `avirato_sync_${schedule.id.substring(0, 8)}`;
    const requestBody = JSON.stringify({
      mode: "sync",
      triggered_by: "scheduled",
      schedule_id: schedule.id,
      schedule_name: schedule.name,
    });

    const { data, error: rpcError } = await supabase.rpc("manage_avirato_cron_job", {
      job_name: jobName,
      cron_schedule: cronSchedule,
      function_url: functionUrl,
      auth_header: authHeader,
      request_body: requestBody,
      job_timezone: schedule.timezone || "Europe/Madrid",
    });

    if (rpcError) results.push({ schedule: schedule.name, success: false, error: rpcError.message });
    else results.push({ schedule: schedule.name, success: true, jobName, data });
  }

  const jobsCreated = results.filter((r) => r.success).length;
  return json({
    success: true,
    message: `${jobsCreated} de ${schedules.length} cron jobs Avirato configurados`,
    jobsCreated,
    details: results,
  });
}

async function listCronJobs(supabase: any) {
  const { data, error } = await supabase.rpc("list_avirato_cron_jobs");
  if (error) throw new Error(`Error listando jobs: ${error.message}`);
  return json({ success: true, jobs: data });
}

async function deleteCronJob(supabase: any, scheduleId?: string) {
  if (!scheduleId) return json({ error: "scheduleId es requerido" }, 400);
  const jobName = `avirato_sync_${scheduleId.substring(0, 8)}`;
  const { data, error } = await supabase.rpc("delete_avirato_cron_job", { job_name: jobName });
  if (error) throw new Error(`Error eliminando job: ${error.message}`);
  return json({ success: true, message: `Job ${jobName} eliminado`, data });
}

async function runSync(supabase: any, scheduleId?: string) {
  const { data, error } = await supabase.functions.invoke("avirato-sync", {
    body: {
      mode: "sync",
      triggered_by: scheduleId ? "scheduled" : "manual",
      schedule_id: scheduleId ?? null,
    },
  });
  if (error) throw new Error(`Error en sincronizacion: ${error.message}`);
  return json({ success: true, syncResult: data });
}
