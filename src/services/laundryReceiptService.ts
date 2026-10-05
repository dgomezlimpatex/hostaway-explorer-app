import { supabase } from "@/integrations/supabase/client";
import {
  receiptFilename,
  receiptWorkbookRows,
  type ReceiptExport,
} from "../../supabase/functions/_shared/laundryReceiptDomain";
export class ReceiptRequestError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function receiptRequest<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("laundry-receipts", {
    body,
  });
  if (error) {
    const response =
      "context" in error && error.context instanceof Response
        ? error.context
        : null;
    const detail = response
      ? await response
          .clone()
          .json()
          .catch(() => null)
      : null;
    throw new ReceiptRequestError(
      detail?.error || error.message || "No se pudo guardar",
      response?.status ?? 0,
    );
  }
  if (data?.error) throw new ReceiptRequestError(data.error);
  return data as T;
}
export async function downloadReceiptExcel(snapshot: ReceiptExport) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(receiptWorkbookRows(snapshot));
  sheet["!cols"] = [{ wch: 36 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, sheet, "Recuento");
  XLSX.writeFile(wb, receiptFilename(snapshot));
}
