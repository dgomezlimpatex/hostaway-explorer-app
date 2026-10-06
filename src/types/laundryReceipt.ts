import type {
  ReceiptCounts,
  ReceiptExport,
} from "../../supabase/functions/_shared/laundryReceiptDomain";
export type ReceiptEmail = {
  id: string;
  status: "pending" | "sending" | "accepted" | "error" | "uncertain";
  error_message?: string;
  attempts: number;
};
export type ReceiptVersion = {
  id: string;
  receipt_id: string;
  version: number;
  revision: number;
  snapshot: ReceiptExport;
  created_at: string;
  email: ReceiptEmail | ReceiptEmail[];
};
export type Receipt = {
  id: string;
  receipt_date: string;
  counts: ReceiptCounts;
  discarded_counts?: ReceiptCounts;
  notes: string;
  revision: number;
  latest_version: number;
  updated_at: string;
};
export type ReceiptOperation = {
  id: string;
  payload: { action: string; material?: string; quantity?: number };
  worker_name: string;
  created_at: string;
  revision: number;
};
export type ReceiptState = {
  date: string;
  workerName: string;
  warehouseName: string;
  receipt: Receipt | null;
  versions: ReceiptVersion[];
  operations: ReceiptOperation[];
  pendingDates: string[];
};
export type ReceiptConfig = {
  id: string;
  token: string;
  warehouse_id: string;
  product_map: Record<string, string>;
  worker_ids: string[];
  is_active: boolean;
};
export type ReceiptAdminState = {
  config: ReceiptConfig | null;
  workers: { id: string; name: string }[];
  receipts: Receipt[];
  versions: ReceiptVersion[];
};
export const receiptEmail = (version: ReceiptVersion) =>
  Array.isArray(version.email) ? version.email[0] : version.email;
