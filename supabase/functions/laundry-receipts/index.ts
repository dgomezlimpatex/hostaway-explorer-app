import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import {
  assertAdminManagerOrServiceRole,
  authorizationErrorResponse,
} from "../_shared/edgeAuthorization.ts";
import {
  sha256,
  listActiveRouteWorkers,
} from "../_shared/laundryRouteAccess.ts";
import { sendReceiptEmail } from "../_shared/laundryReceiptEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
export async function handleReceiptRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, key);
    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args);
      if (error) {
        if (error.code === "28000") throw json({ error: error.message }, 401);
        if (error.code === "40001")
          throw json({ error: error.message, conflict: true }, 409);
        throw json(
          {
            error:
              error.code === "P0002"
                ? "Enlace o recuento no disponible"
                : error.message,
          },
          400,
        );
      }
      return data;
    };
    if (action === "drain") {
      if (!key || req.headers.get("Authorization") !== `Bearer ${key}`)
        return json({ error: "No autorizado" }, 403);
      let processed = 0;
      for (let i = 0; i < 5; i++) {
        if (!(await sendReceiptEmail(db))) break;
        processed++;
      }
      return json({ processed });
    }
    if (action.startsWith("admin_")) {
      const actor = await assertAdminManagerOrServiceRole(req, db, key);
      const warehouseId = String(body.warehouseId ?? "");
      const { data: warehouse, error: we } = await db
        .from("stock_warehouses")
        .select("id,name,sede_id")
        .eq("id", warehouseId)
        .single();
      if (we || !warehouse)
        return json({ error: "Almacén no disponible" }, 404);
      if (actor.kind === "user") {
        const { data: access, error: ae } = await db
          .from("user_sede_access")
          .select("sede_id")
          .eq("user_id", actor.userId!)
          .eq("sede_id", warehouse.sede_id)
          .eq("can_access", true)
          .maybeSingle();
        if (ae) throw ae;
        if (!access)
          return json(
            { error: "No tienes acceso a la sede de este almacén" },
            403,
          );
      }
      if (action === "admin_configure") {
        return json({
          config: await rpc("configure_laundry_receipt", {
            _warehouse: warehouseId,
            _map: body.productMap,
            _workers: body.workerIds,
            _active: body.active === true,
            _rotate: body.rotate === true,
          }),
        });
      }
      const { data: config, error: ce } = await db
        .from("laundry_receipt_links")
        .select("*")
        .eq("warehouse_id", warehouseId)
        .maybeSingle();
      if (ce) throw ce;
      const workers = await listActiveRouteWorkers(db, warehouse.sede_id);
      const { data: receipts, error: re } = config
        ? await db
            .from("laundry_receipts")
            .select(
              "id,receipt_date,counts,discarded_counts,notes,revision,latest_version,updated_at",
            )
            .eq("link_id", config.id)
            .order("receipt_date", { ascending: false })
            .limit(90)
        : { data: [], error: null };
      if (re) throw re;
      const ids = (receipts ?? []).map((r) => r.id);
      const { data: versions, error: ve } = ids.length
        ? await db
            .from("laundry_receipt_versions")
            .select("*,email:laundry_receipt_emails(*)")
            .in("receipt_id", ids)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (ve) throw ve;
      if (action === "admin_retry") {
        const version = versions?.find((v) => v.id === body.versionId);
        if (!version) return json({ error: "Versión no disponible" }, 404);
        await rpc("retry_laundry_receipt_email", { _version: version.id });
        await sendReceiptEmail(db, version.id);
        return json({ success: true });
      }
      if (action !== "admin_read")
        return json({ error: "Acción inválida" }, 400);
      return json({ config, workers, receipts, versions });
    }
    const token = String(body.token ?? "");
    if (!/^[a-f0-9]{64}$/.test(token))
      return json({ error: "Enlace no válido" }, 404);
    if (action === "login") {
      const ip = (
        req.headers.get("x-forwarded-for") ||
        req.headers.get("cf-connecting-ip") ||
        ""
      )
        .split(",")[0]
        .trim();
      if (!ip)
        return json({ error: "No se pudo identificar la conexión" }, 503);
      const sessionToken = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const result = await rpc("login_laundry_receipt", {
        _token: token,
        _pin: String(body.pin ?? ""),
        _ip_hash: await sha256(`${token}:${ip}`),
        _session_hash: await sha256(sessionToken),
      });
      if (result.error) return json({ error: result.error }, result.status);
      return json({ ...result, sessionToken });
    }
    const hash = await sha256(String(body.sessionToken ?? ""));
    if (action === "logout") {
      await rpc("laundry_receipt_identity", {
        _token: token,
        _session_hash: hash,
      });
      const { error } = await db
        .from("laundry_receipt_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", hash);
      if (error) throw error;
      return json({ success: true });
    }
    if (action === "mutate") {
      const result = await rpc("mutate_laundry_receipt", {
        _token: token,
        _session_hash: hash,
        _date: body.date,
        _op_id: body.operationId,
        _payload: body.payload,
      });
      // Stock is already committed; a mail failure never turns confirmation into a stock retry.
      if (result.versionId && !result.unchanged)
        await sendReceiptEmail(db, result.versionId).catch(() => undefined);
      return json({ result });
    }
    if (action === "read" || action === "retry") {
      const state = await rpc("read_laundry_receipt", {
        _token: token,
        _session_hash: hash,
        _date: body.date ?? null,
      });
      if (action === "retry") {
        if (
          !state.versions.some((v: { id: string }) => v.id === body.versionId)
        )
          return json({ error: "Versión no disponible" }, 404);
        await rpc("retry_laundry_receipt_email", { _version: body.versionId });
        await sendReceiptEmail(db, body.versionId);
        return json({ success: true });
      }
      return json(state);
    }
    return json({ error: "Acción inválida" }, 400);
  } catch (error) {
    if (error instanceof Response)
      return error.headers.get("Content-Type")?.includes("json")
        ? error
        : authorizationErrorResponse(error, cors)!;
    return json(
      { error: "No se pudo completar la operación. Inténtalo de nuevo." },
      500,
    );
  }
}
Deno.serve(handleReceiptRequest);
