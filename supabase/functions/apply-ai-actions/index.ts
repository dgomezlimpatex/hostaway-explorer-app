import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const ALLOWED_EMAIL = "dgomezlimpatex@gmail.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
function extractBearer(req: Request): string | null {
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const token = extractBearer(req);
    if (!token) return json({ success: false, error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, error: "Invalid session" }, 401);
    if ((authData.user.email ?? "").toLowerCase() !== ALLOWED_EMAIL) {
      return json({ success: false, error: "AI copilot is not enabled for this user" }, 403);
    }

    const body = await req.json().catch(() => null) as null | { proposalId?: string };
    if (!body?.proposalId) return json({ success: false, error: "Falta proposalId" }, 400);

    const { data, error: rpcError } = await supabase.rpc("apply_ai_actions_transactional", {
      _proposal_id: body.proposalId,
      _actor_id: authData.user.id,
    });
    if (rpcError) {
      console.error("apply_ai_actions_transactional failed", rpcError.code, rpcError.message);
      const status = rpcError.code === "42501" ? 403
        : rpcError.code === "P0002" ? 404
        : rpcError.code === "40001" ? 409
        : rpcError.code === "22023" ? 400
        : 500;
      return json({ success: false, error: rpcError.message, code: rpcError.code }, status);
    }

    const result = data as Record<string, unknown> | null;
    if (!result || result.success !== true || !["applied", "already_applied"].includes(String(result.status))) {
      return json({ success: false, error: "Resultado semántico inválido de la RPC" }, 500);
    }
    return json(result, 200);
  } catch (error) {
    console.error("apply-ai-actions error", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Error desconocido" }, 500);
  }
});
