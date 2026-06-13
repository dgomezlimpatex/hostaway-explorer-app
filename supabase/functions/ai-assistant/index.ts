import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const ALLOWED_EMAIL = "dgomezlimpatex@gmail.com";
const DEFAULT_MODEL = "gpt-5.4-mini";
const MAX_CONTEXT_ROWS = 250;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function madridDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}-${parts.find((p) => p.type === "day")?.value}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

function safeText(value: unknown, max = 1800): string {
  return String(value ?? "").slice(0, max);
}

function extractOutputText(response: JsonRecord): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as JsonRecord).content) ? (item as JsonRecord).content as JsonRecord[] : [];
    for (const part of content) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseAssistantJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
  }
  return { answer: text, proposal: null, memories: [] };
}

function estimateCostUsd(model: string, inputTokens = 0, outputTokens = 0): number | null {
  const isMini = model.toLowerCase().includes("mini");
  const inputPerMillion = isMini ? 0.75 : 2.5;
  const outputPerMillion = isMini ? 4.5 : 15;
  return Number(((inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion).toFixed(6));
}

async function loadPlanningContext(
  supabase: ReturnType<typeof createClient>,
  ownerUserId: string,
  dateFrom: string,
  dateTo: string,
  sedeId: string | null,
) {
  let tasksQuery = supabase
    .from("tasks")
    .select("id,property,address,date,start_time,end_time,status,cleaner,cleaner_id,type,duracion,propiedad_id,sede_id,cliente_id")
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(MAX_CONTEXT_ROWS);
  if (sedeId) tasksQuery = tasksQuery.eq("sede_id", sedeId);

  let cleanersQuery = supabase
    .from("cleaners")
    .select("id,name,email,is_active,sede_id,contract_hours_per_week,category")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);
  if (sedeId) cleanersQuery = cleanersQuery.eq("sede_id", sedeId);

  let propertiesQuery = supabase
    .from("properties")
    .select("id,nombre,codigo,direccion,sede_id,is_active,duracion_servicio,coste_servicio,check_in_predeterminado,check_out_predeterminado")
    .eq("is_active", true)
    .order("nombre", { ascending: true })
    .limit(200);
  if (sedeId) propertiesQuery = propertiesQuery.eq("sede_id", sedeId);

  let reservationsQuery = supabase
    .from("avirato_reservations")
    .select("id,external_id,check_in,check_out,space_name,guest_name,normalized_status,status,space_subtype_id,sede_id")
    .gte("check_out", dateFrom)
    .lte("check_in", dateTo)
    .order("check_in", { ascending: true })
    .limit(150);
  if (sedeId) reservationsQuery = reservationsQuery.eq("sede_id", sedeId);

  const [tasks, cleaners, properties, reservations, memories] = await Promise.all([
    tasksQuery,
    cleanersQuery,
    propertiesQuery,
    reservationsQuery,
    supabase
      .from("ai_memories")
      .select("id,category,content,updated_at")
      .eq("owner_user_id", ownerUserId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  return {
    dateFrom,
    dateTo,
    sedeId,
    tasks: tasks.data ?? [],
    cleaners: cleaners.data ?? [],
    properties: properties.data ?? [],
    aviratoReservations: reservations.data ?? [],
    memories: memories.data ?? [],
    loadWarnings: [
      tasks.error ? `tasks: ${tasks.error.message}` : null,
      cleaners.error ? `cleaners: ${cleaners.error.message}` : null,
      properties.error ? `properties: ${properties.error.message}` : null,
      reservations.error ? `avirato_reservations: ${reservations.error.message}` : null,
      memories.error ? `ai_memories: ${memories.error.message}` : null,
    ].filter(Boolean),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "Falta configurar OPENAI_API_KEY en Supabase secrets" }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { user, email } = await getAllowedUser(req, supabase);
    const body = await req.json().catch(() => ({}));

    const message = safeText(body.message, 4000).trim();
    if (!message) return json({ error: "Mensaje vacío" }, 400);

    const today = madridDate();
    const dateFrom = typeof body.dateFrom === "string" ? body.dateFrom : today;
    const dateTo = typeof body.dateTo === "string" ? body.dateTo : addDays(dateFrom, 15);
    const sedeId = typeof body.sedeId === "string" && body.sedeId ? body.sedeId : null;
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;

    let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    if (conversationId) {
      const { data: existing, error } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (error || !existing) conversationId = null;
    }

    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("ai_conversations")
        .insert({
          owner_user_id: user.id,
          owner_email: email,
          title: message.slice(0, 80) || "Nueva conversacion",
          metadata: { dateFrom, dateTo, sedeId },
        })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = created.id;
    }

    const { data: userMessage } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        owner_user_id: user.id,
        role: "user",
        content: message,
        metadata: { dateFrom, dateTo, sedeId },
      })
      .select("id")
      .single();

    const context = await loadPlanningContext(supabase, user.id, dateFrom, dateTo, sedeId);

    const systemPrompt = [
      "Eres el copiloto IA privado de Limpatex. Solo ayudas a Daniel Gomez.",
      "Tu objetivo es ayudar a planificar tareas de limpieza, detectar riesgos y proponer acciones.",
      "Nunca afirmes que has aplicado cambios. Solo propones acciones; otra función las aplicará tras confirmación.",
      "No propongas borrar tareas, completar tareas, tocar inventario, modificar reservas ni cambiar usuarios.",
      "Si propones acciones, deben usar IDs reales presentes en el contexto.",
      "Puedes proponer memorias si el usuario te enseña una regla operativa útil.",
      "Devuelve SIEMPRE JSON válido con esta forma:",
      '{"answer":"texto claro en español","proposal":null|{"title":"...","summary":"...","actions":[{"type":"assign_task","taskId":"uuid","cleanerId":"uuid","startTime":"HH:MM opcional","endTime":"HH:MM opcional","reason":"..."},{"type":"create_task","propertyId":"uuid","date":"YYYY-MM-DD","startTime":"HH:MM","duration":60,"taskType":"limpieza-turistica","cleanerId":"uuid opcional","reason":"..."}]},"memories":[{"category":"operativa","content":"..."}]}',
    ].join("\n");

    const userPrompt = [
      `Mensaje del usuario: ${message}`,
      `Rango de planificacion: ${dateFrom} a ${dateTo}`,
      "Contexto operativo JSON:",
      JSON.stringify(context),
    ].join("\n\n");

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] },
        ],
        store: false,
        max_output_tokens: 2200,
      }),
    });

    const raw = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      return json({ error: raw.error?.message || `OpenAI error ${openaiResponse.status}` }, 502);
    }

    const outputText = extractOutputText(raw);
    const parsed = parseAssistantJson(outputText);
    const answer = safeText(parsed.answer || outputText || "No he podido generar una respuesta.", 8000);
    const usage = raw.usage || {};
    const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
    const estimatedCostUsd = estimateCostUsd(model, inputTokens, outputTokens);

    const { data: assistantMessage } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        owner_user_id: user.id,
        role: "assistant",
        content: answer,
        input_tokens: inputTokens || null,
        output_tokens: outputTokens || null,
        estimated_cost_usd: estimatedCostUsd,
        metadata: { rawModel: model, proposal: parsed.proposal ?? null },
      })
      .select("id")
      .single();

    const memories = Array.isArray(parsed.memories) ? parsed.memories.slice(0, 5) : [];
    const savedMemories = [];
    for (const memory of memories) {
      const content = safeText(memory?.content, 1000).trim();
      if (!content) continue;
      const { data } = await supabase
        .from("ai_memories")
        .insert({
          owner_user_id: user.id,
          owner_email: email,
          category: safeText(memory?.category || "operativa", 60),
          content,
          source: "chat",
          source_message_id: assistantMessage?.id ?? userMessage?.id ?? null,
        })
        .select("id,category,content,is_active,updated_at")
        .single();
      if (data) savedMemories.push(data);
    }

    let proposal = null;
    const proposalActions = Array.isArray(parsed.proposal?.actions) ? parsed.proposal.actions.slice(0, 25) : [];
    if (parsed.proposal && proposalActions.length > 0) {
      const { data } = await supabase
        .from("ai_action_proposals")
        .insert({
          conversation_id: conversationId,
          owner_user_id: user.id,
          owner_email: email,
          title: safeText(parsed.proposal.title || "Propuesta de planificacion", 120),
          summary: safeText(parsed.proposal.summary || "Propuesta generada por IA", 2000),
          date_from: dateFrom,
          date_to: dateTo,
          sede_id: sedeId,
          actions: proposalActions,
        })
        .select("*")
        .single();
      proposal = data;
    }

    return json({
      success: true,
      conversationId,
      message: { id: assistantMessage?.id, role: "assistant", content: answer },
      proposal,
      savedMemories,
      usage: { inputTokens, outputTokens, estimatedCostUsd, model },
      warnings: context.loadWarnings,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ai-assistant error", err);
    return json({ error: err instanceof Error ? err.message : "Error desconocido" }, 500);
  }
});
