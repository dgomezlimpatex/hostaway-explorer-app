export const RECEIPT_MATERIALS = [
  ["suite_sheets", "Sábanas de suite"],
  ["double_sheets", "Sábanas de matrimonio"],
  ["single_sheets", "Sábanas individuales"],
  ["pillowcases", "Fundas de almohada"],
  ["hand_towels", "Toallas de manos"],
  ["bath_towels", "Toallas de baño"],
  ["bath_mats", "Alfombrín de ducha"],
  ["pillows", "Almohada"],
  ["mattress_protectors", "Cubre colchón"],
  ["duvets", "Edredón"],
] as const;

export type MaterialKey = (typeof RECEIPT_MATERIALS)[number][0];
// Older receipts/snapshots predate suite sheets. Their absent suite count is zero.
export type ReceiptCounts = Record<Exclude<MaterialKey, "suite_sheets">, number> & {
  suite_sheets?: number;
};
export const emptyReceiptCounts = (): ReceiptCounts =>
  Object.fromEntries(
    RECEIPT_MATERIALS.map(([key]) => [key, 0]),
  ) as ReceiptCounts;
export function madridReceiptDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function receiptQuantity(value: string): number {
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 999999999
  )
    throw new Error("Introduce una cantidad entera entre 0 y 999.999.999.");
  return Number(value);
}
export type ReceiptExport = {
  receipt_date: string;
  warehouse_name: string;
  version: number;
  worker_name: string;
  confirmed_at: string;
  counts: ReceiptCounts;
  discarded_counts?: ReceiptCounts;
  notes: string;
};
export function receiptWorkbookRows(
  snapshot: ReceiptExport,
  legacyLayout = false,
): (string | number)[][] {
  // Pending email retries must retain the original provider payload/idempotency key.
  const materials = legacyLayout ? [
    ["double_sheets", "Sábanas de matrimonio"],
    ["single_sheets", "Sábanas individuales"],
    ["pillowcases", "Fundas de almohada"],
    ["bath_towels", "Toallas de baño"],
    ["hand_towels", "Toallas de manos"],
    ["bath_mats", "Alfombrines de ducha"],
    ["duvets", "Edredones"],
    ["mattress_protectors", "Protectores de colchón"],
    ["pillows", "Almohadas"],
  ] as const : RECEIPT_MATERIALS;
  // Untrusted names/notes stay string cells, never Excel formula cells.
  return [
    ["APP GESTIÓN LIMPATEX — Recepción de ropa limpia"],
    ["Fecha", snapshot.receipt_date],
    ["Almacén", snapshot.warehouse_name],
    ["Versión", snapshot.version],
    ["Confirmado por", snapshot.worker_name],
    [
      "Confirmado el",
      new Date(snapshot.confirmed_at).toLocaleString("es-ES", {
        timeZone: "Europe/Madrid",
      }),
    ],
    [],
    snapshot.discarded_counts
      ? ["Material", "Unidades recibidas", "Descartes (no suman al inventario)"]
      : ["Material", "Unidades recibidas"],
    ...materials.map(([key, label]) =>
      snapshot.discarded_counts
        ? [label, snapshot.counts[key] ?? 0, snapshot.discarded_counts[key] ?? 0]
        : [label, snapshot.counts[key] ?? 0],
    ),
    [],
    ["Observaciones", snapshot.notes],
  ];
}
export const receiptFilename = (s: ReceiptExport) =>
  `recepcion-lavanderia-${s.receipt_date}-v${s.version}.xlsx`;
