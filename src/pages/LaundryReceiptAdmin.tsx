import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StockLayout } from "@/components/stock/StockLayout";
import { useStockProducts, useStockWarehouses } from "@/hooks/useStock";
import { RECEIPT_MATERIALS } from "../../supabase/functions/_shared/laundryReceiptDomain";
import {
  receiptRequest,
  downloadReceiptExcel,
} from "@/services/laundryReceiptService";
import { receiptEmail, type ReceiptAdminState } from "@/types/laundryReceipt";

export default function LaundryReceiptAdmin() {
  const { data: warehouses = [] } = useStockWarehouses();
  const { data: products = [] } = useStockProducts("laundry");
  const [warehouseId, setWarehouseId] = useState("");
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["laundry-receipt-admin", warehouseId],
    queryFn: () =>
      receiptRequest<ReceiptAdminState>({ action: "admin_read", warehouseId }),
    enabled: Boolean(warehouseId),
    retry: false,
    refetchInterval: 15000,
  });
  const config = query.data?.config;
  // Initialize editing only on warehouse/config change, never on periodic refresh.
  const warehouseScope = warehouses.map((w) => w.id).join(",");
  useEffect(() => {
    setWarehouseId("");
  }, [warehouseScope]);
  useEffect(() => {
    setProductMap(config?.product_map || {});
    setWorkerIds(config?.worker_ids || []);
    setActive(config?.is_active ?? true);
    setMessage("");
  }, [
    warehouseId,
    config?.id,
    config?.token,
    config?.product_map,
    config?.worker_ids,
    config?.is_active,
  ]);
  const link = config
    ? `https://gestionlimpatex.vercel.app/recepcion-lavanderia/${config.token}`
    : "";
  async function configure(rotate = false) {
    if (
      rotate &&
      !window.confirm(
        "¿Revocar el enlace anterior? Habrá que actualizar cualquier QR/NFC que lo utilice.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await receiptRequest({
        action: "admin_configure",
        warehouseId,
        productMap,
        workerIds,
        active,
        rotate,
      });
      await client.invalidateQueries({
        queryKey: ["laundry-receipt-admin", warehouseId],
      });
      setMessage(
        "Configuración guardada. Los empleados deberán introducir de nuevo su PIN.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <StockLayout
      title="Recepciones de ropa limpia"
      description="Configura el acceso del almacén y consulta los recuentos enviados a administración."
      showWarehouseSelect={false}
    >
      <section className="space-y-4 rounded-2xl border bg-background p-5">
        <label htmlFor="receipt-warehouse" className="block font-semibold">
          Almacén que recibe la ropa limpia
        </label>
        <select
          id="receipt-warehouse"
          className="h-12 w-full rounded-md border bg-background px-3"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          <option value="">Seleccionar almacén</option>
          {warehouses
            .filter((w) => !w.location_type || w.location_type === "central")
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
        </select>
        {query.isLoading && <p>Cargando configuración…</p>}
        {query.error && (
          <p role="alert" className="text-red-700">
            {query.error.message}{" "}
            <Button variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </p>
        )}
        {query.data && (
          <>
            <p className="text-sm text-muted-foreground">
              Asocia cada campo al producto existente que representa ropa
              limpia. No se crearán productos automáticamente.
            </p>
            {RECEIPT_MATERIALS.map(([key, label]) => (
              <div
                key={key}
                className="grid gap-2 sm:grid-cols-2 sm:items-center"
              >
                <label htmlFor={`map-${key}`}>{label}</label>
                <select
                  id={`map-${key}`}
                  disabled={busy || Boolean(query.data.receipts.length)}
                  className="h-11 min-w-0 rounded-md border bg-background px-3"
                  value={productMap[key] || ""}
                  onChange={(e) =>
                    setProductMap((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {query.data.receipts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Los productos quedan fijados para conservar el historial de
                stock.
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="mb-2 font-semibold">
                Empleados de ruta autorizados en este almacén
              </legend>
              {query.data.workers.length === 0 && (
                <p>
                  Activa primero el acceso de reparto de los empleados desde su
                  ficha.
                </p>
              )}
              {query.data.workers.map((w) => (
                <label key={w.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={workerIds.includes(w.id)}
                    onChange={(e) =>
                      setWorkerIds((prev) =>
                        e.target.checked
                          ? [...prev, w.id]
                          : prev.filter((id) => id !== w.id),
                      )
                    }
                  />
                  {w.name}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Acceso habilitado
            </label>
            <Button
              disabled={
                busy ||
                (active &&
                  (workerIds.length === 0 ||
                    RECEIPT_MATERIALS.some(([key]) => !productMap[key])))
              }
              onClick={() => void configure()}
            >
              Guardar configuración
            </Button>
            {config && (
              <div className="space-y-3 rounded-xl bg-muted p-4">
                <p className="font-medium">
                  Enlace fijo del almacén ·{" "}
                  {config.is_active ? "Habilitado" : "Deshabilitado"}
                </p>
                <p className="break-all text-sm">{link}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(link)
                        .then(() => setMessage("Enlace copiado"))
                        .catch(() =>
                          setMessage(
                            "No se pudo copiar. Selecciona el enlace manualmente.",
                          ),
                        )
                    }
                  >
                    Copiar enlace
                  </Button>
                  <a
                    className="inline-flex h-10 items-center rounded-md border bg-background px-4 text-sm"
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir página
                  </a>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void configure(true)}
                  >
                    Revocar y generar otro enlace
                  </Button>
                </div>
              </div>
            )}
            <p className="text-sm">
              Excel del recuento al confirmar → dgomez@limpatex.com y
              geisha@limpatex.com
            </p>
          </>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </section>
      {query.data && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Historial · últimos 90 días con recuento
          </h2>
          {query.data.receipts.length === 0 && (
            <p className="text-muted-foreground">Todavía no hay recuentos.</p>
          )}
          {query.data.receipts.map((r) => (
            <details key={r.id} className="rounded-xl border bg-background p-4">
              <summary className="cursor-pointer font-semibold">
                {r.receipt_date} ·{" "}
                {r.latest_version
                  ? `Última versión ${r.latest_version}`
                  : "Sin confirmar"}
              </summary>
              <div className="mt-4 space-y-3">
                <table className="w-full text-sm">
                  <tbody>
                    {RECEIPT_MATERIALS.map(([key, label]) => (
                      <tr key={key}>
                        <td className="py-1">{label}</td>
                        <td className="text-right tabular-nums">
                          {r.counts[key]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-sm">{r.notes}</p>
                {query.data.versions
                  .filter((v) => v.receipt_id === r.id)
                  .map((v) => {
                    const email = receiptEmail(v);
                    return (
                      <div
                        key={v.id}
                        className="space-y-2 border-t pt-3 text-sm"
                      >
                        <p>
                          Versión {v.version} · {v.snapshot.worker_name} ·{" "}
                          {email?.status === "accepted"
                            ? "Aceptado por el proveedor de correo"
                            : email?.status === "error"
                              ? "Error de correo"
                              : email?.status === "uncertain"
                                ? "Revisar aceptación con el proveedor"
                                : "Correo pendiente"}
                        </p>
                        {email?.error_message && (
                          <p className="text-red-700">{email.error_message}</p>
                        )}
                        <Button
                          variant="outline"
                          onClick={() =>
                            void downloadReceiptExcel(v.snapshot).catch((err) =>
                              setMessage(err.message),
                            )
                          }
                        >
                          Descargar Excel v{v.version}
                        </Button>
                        {email &&
                          ["pending", "error"].includes(email.status) && (
                            <Button
                              className="ml-2"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await receiptRequest({
                                    action: "admin_retry",
                                    warehouseId,
                                    versionId: v.id,
                                  });
                                  await query.refetch();
                                } catch (err) {
                                  setMessage(
                                    err instanceof Error
                                      ? err.message
                                      : "Error de envío",
                                  );
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Reintentar correo
                            </Button>
                          )}
                      </div>
                    );
                  })}
              </div>
            </details>
          ))}
        </section>
      )}
    </StockLayout>
  );
}
