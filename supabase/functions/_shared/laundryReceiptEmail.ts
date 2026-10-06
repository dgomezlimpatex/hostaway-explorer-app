import * as XLSX from "npm:xlsx@0.18.5";
import {
  receiptFilename,
  receiptWorkbookRows,
  type ReceiptExport,
} from "./laundryReceiptDomain.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export async function sendReceiptEmail(db: SupabaseClient, versionId?: string) {
  const { data: job, error } = await db.rpc("claim_laundry_receipt_email", {
    _version: versionId ?? null,
  });
  if (error) throw error;
  if (!job) return false;
  let provider: string | null = null;
  let failure: string | null = null;
  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) throw new Error("Falta la configuración del proveedor de correo");
    const snapshot = job.snapshot as ReceiptExport;
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(receiptWorkbookRows(snapshot));
    sheet["!cols"] = snapshot.discarded_counts
      ? [{ wch: 36 }, { wch: 55 }, { wch: 38 }]
      : [{ wch: 36 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, sheet, "Recuento");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `laundry-receipt/${job.email.version_id}`,
      },
      body: JSON.stringify({
        from: "APP GESTIÓN LIMPATEX <alertas@limpatexgestion.es>",
        to: ["dgomez@limpatex.com", "geisha@limpatex.com"],
        subject: `${snapshot.version > 1 ? "ACTUALIZADO · " : ""}Recuento lavandería ${snapshot.receipt_date} · ${snapshot.warehouse_name} · v${snapshot.version}`,
        text: `Adjuntamos el recuento de ropa limpia recibida del ${snapshot.receipt_date}, confirmado por ${snapshot.worker_name}.\n${snapshot.version > 1 ? "Esta versión sustituye al recuento anterior de este día y almacén." : ""}\n${snapshot.discarded_counts ? "El Excel distingue la ropa aceptada y los descartes para devolver a lavandería. Los descartes no se incorporan al inventario. No incluye existencias totales del almacén." : "El Excel contiene el recuento recibido, no las existencias totales del almacén."}`,
        attachments: [
          {
            filename: receiptFilename(snapshot),
            content: XLSX.write(wb, { type: "base64", bookType: "xlsx" }),
          },
        ],
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.id)
      throw new Error(
        `El proveedor no confirmó la aceptación (${response.status})`,
      );
    provider = String(result.id);
  } catch (err) {
    // Never log credentials, PINs, tokens or request bodies.
    failure =
      err instanceof Error ? err.message : "No se pudo enviar el correo";
  }
  const { error: finishError } = await db.rpc("finish_laundry_receipt_email", {
    _id: job.email.id,
    _claim: job.email.claim_token,
    _provider: provider,
    _error: failure,
  });
  if (finishError) throw finishError;
  return true;
}
