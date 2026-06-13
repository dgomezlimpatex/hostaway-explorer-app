import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const ALLOWED_EMAIL = "dgomezlimpatex@gmail.com";
const DEFAULT_MODEL = "gpt-5.4-mini";

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
  if (email !== ALLOWED_EMAIL) {
    throw new Response("AI learning is not enabled for this user", { status: 403, headers: corsHeaders });
  }

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

function parseAssistantJson(text: string): { suggestions: JsonRecord[] } {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] };
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return { suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] };
      } catch {
        // fall through
      }
    }
  }
  return { suggestions: [] };
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
    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
    const limit = Math.min(Math.max(Number(body.limit ?? 80) || 80, 10), 160);

    const { data: events, error: eventsError } = await supabase
      .from("ai_observed_events")
      .select("id,event_type,entity_type,entity_id,sede_id,occurred_at,summary,before_data,after_data,metadata")
      .eq("owner_user_id", user.id)
      .is("processed_at", null)
      .gte("occurred_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (eventsError) throw eventsError;
    if (!events?.length) return json({ success: true, analyzed: 0, inserted: 0, suggestions: [] });

    const { data: memories } = await supabase
      .from("ai_memories")
      .select("category,content")
      .eq("owner_user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(80);

    const { data: pendingSuggestions } = await supabase
      .from("ai_learning_suggestions")
      .select("title,content,status")
      .eq("owner_user_id", user.id)
      .in("status", ["pending", "approved", "edited"])
      .order("created_at", { ascending: false })
      .limit(80);

    const systemPrompt = [
      "Eres un analista operativo de Limpatex.",
      "Tu trabajo es revisar eventos reales hechos por Daniel y sugerir aprendizajes revisables.",
      "No conviertas una accion aislada en regla general. Prioriza patrones repetidos, criterios utiles o excepciones claras.",
      "No incluyas datos sensibles de personas. Usa nombres de propiedades/zonas solo si aparecen como contexto operativo.",
      "No sugieras reglas duplicadas de memorias activas o sugerencias ya existentes.",
      "Devuelve SIEMPRE JSON valido con esta forma exacta:",
      '{"suggestions":[{"title":"titulo breve","content":"regla operativa redactada en primera persona plural o estilo instruccion","category":"planificacion|inventario|tareas|integraciones|operativa","confidence":0.65,"sourceEventIds":["uuid"],"evidence":[{"eventId":"uuid","summary":"resumen breve"}]}]}',
      "Devuelve maximo 6 sugerencias. Si no hay patron util, devuelve suggestions vacio.",
    ].join("\n");

    const userPrompt = [
      "Memorias activas:",
      JSON.stringify(memories ?? []),
      "Sugerencias existentes recientes:",
      JSON.stringify(pendingSuggestions ?? []),
      "Eventos observados recientes:",
      JSON.stringify(events),
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
        max_output_tokens: 1800,
      }),
    });

    const raw = await openaiResponse.json().catch(() => ({}));
    if (!openaiResponse.ok) {
      return json({ error: raw.error?.message || `OpenAI error ${openaiResponse.status}` }, 502);
    }

    const parsed = parseAssistantJson(extractOutputText(raw));
    const knownEventIds = new Set(events.map((event) => event.id));
    const rows = parsed.suggestions
      .slice(0, 6)
      .map((suggestion) => {
        const sourceEventIds = Array.isArray(suggestion.sourceEventIds)
          ? suggestion.sourceEventIds.filter((id) => typeof id === "string" && knownEventIds.has(id))
          : [];
        const content = safeText(suggestion.content, 1000).trim();
        const title = safeText(suggestion.title || content, 120).trim();
        if (!content || !title || sourceEventIds.length === 0) return null;
        return {
          owner_user_id: user.id,
          owner_email: email,
          category: safeText(suggestion.category || "operativa", 60),
          title,
          content,
          confidence: Math.min(Math.max(Number(suggestion.confidence ?? 0.5), 0), 1),
          evidence: Array.isArray(suggestion.evidence) ? suggestion.evidence.slice(0, 5) : [],
          source_event_ids: sourceEventIds,
        };
      })
      .filter(Boolean);

    let inserted = 0;
    if (rows.length) {
      const { data, error } = await supabase
        .from("ai_learning_suggestions")
        .insert(rows)
        .select("id,title,content,category,confidence,evidence,status,created_at");
      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    await supabase
      .from("ai_observed_events")
      .update({ processed_at: new Date().toISOString() })
      .in("id", events.map((event) => event.id));

    return json({
      success: true,
      analyzed: events.length,
      inserted,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ai-learning-review error", err);
    return json({ error: err instanceof Error ? err.message : "Error desconocido" }, 500);
  }
});
