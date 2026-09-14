import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useCreateWorkerHourAdjustment,
  useUpdateWorkerHourAdjustment,
  useDeleteWorkerHourAdjustment,
} from "@/hooks/useWorkerHourAdjustments";
import { useCleaners } from "@/hooks/useCleaners";
import { Adjustment, Period, madridNow, hoursText, dateText } from "./hours";
import { useAdjustmentAudit } from "./usePersonnelHours";
import type { HourAdjustment } from "@/types/workload";
const categories: Record<HourAdjustment["category"], string> = {
  extra: "Horas extra",
  training: "Formación",
  absence: "Ausencia",
  correction: "Corrección",
  other: "Otro motivo",
};
export function AdjustmentManager({
  workerId,
  period,
  adjustments,
  open,
  onOpenChange,
}: {
  workerId?: string;
  period: Period;
  adjustments: Adjustment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { cleaners } = useCleaners();
  const create = useCreateWorkerHourAdjustment(),
    update = useUpdateWorkerHourAdjustment(),
    remove = useDeleteWorkerHourAdjustment();
  const [editing, setEditing] = useState<Adjustment | null>(null),
    [deleting, setDeleting] = useState<Adjustment | null>(null),
    [error, setError] = useState("");
  const today = madridNow().slice(0, 10);
  const [form, setForm] = useState({
    cleanerId: workerId || "",
    date: today,
    hours: "1",
    category: "correction",
    reason: "",
    notes: "",
  });
  useEffect(() => {
    if (open) {
      setError("");
      setForm(
        editing
          ? {
              cleanerId: editing.cleaner_id,
              date: editing.date,
              hours: String(editing.hours),
              category: editing.category,
              reason: editing.reason,
              notes: editing.notes || "",
            }
          : {
              cleanerId: workerId || "",
              date:
                today >= period.from && today <= period.to
                  ? today
                  : period.from,
              hours: "1",
              category: "correction",
              reason: "",
              notes: "",
            },
      );
    }
  }, [open, editing, workerId, period.from, period.to, today]);
  const busy = create.isPending || update.isPending;
  const close = (value: boolean) => {
    onOpenChange(value);
    if (!value) setEditing(null);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = Number(form.hours);
    if (
      !form.cleanerId ||
      !form.date ||
      !Number.isFinite(hours) ||
      hours === 0 ||
      Math.abs(hours) > 24 ||
      !Number.isInteger(hours * 4) ||
      form.reason.trim().length < 3
    ) {
      setError(
        "Selecciona persona y fecha. Introduce de −24 a 24 horas, en pasos de 0,25, y un motivo de al menos 3 caracteres.",
      );
      return;
    }
    try {
      const input = {
        cleanerId: form.cleanerId,
        date: form.date,
        hours,
        category: form.category as HourAdjustment["category"],
        reason: form.reason.trim(),
        notes: form.notes,
      };
      if (editing) await update.mutateAsync({ id: editing.id, ...input });
      else await create.mutateAsync(input);
      close(false);
    } catch {
      setError(
        "No se guardó el ajuste. Comprueba los datos y vuelve a intentarlo.",
      );
    }
  };
  return (
    <>
      {workerId && (
        <section className="p-panel mt-6">
          <div className="p-panel-head">
            <div>
              <h2>Ajustes del periodo</h2>
              <p className="p-muted">
                Corrigen el cómputo sin modificar la jornada de la ficha.
              </p>
            </div>
            <button
              className="p-button small"
              onClick={() => {
                setEditing(null);
                onOpenChange(true);
              }}
            >
              <Plus size={15} />
              Añadir ajuste
            </button>
          </div>
          {!adjustments.length ? (
            <div className="p-empty">No hay ajustes en este periodo.</div>
          ) : (
            <div className="p-table-wrap">
              <table className="p-table responsive">
                <thead>
                  <tr>
                    <th>Motivo</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Horas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.reason}
                        {a.notes && (
                          <small className="block p-muted">{a.notes}</small>
                        )}
                      </td>
                      <td data-label="Fecha">{dateText(a.date)}</td>
                      <td data-label="Tipo">
                        {categories[a.category as HourAdjustment["category"]] ||
                          a.category}
                      </td>
                      <td data-label="Horas">{hoursText(Number(a.hours))}</td>
                      <td className="row-actions">
                        <button
                          className="p-button small"
                          aria-label={`Editar ajuste ${a.reason}`}
                          onClick={() => {
                            setEditing(a);
                            onOpenChange(true);
                          }}
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                        <button
                          className="p-button small"
                          aria-label={`Eliminar ajuste ${a.reason}`}
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="p-content">
            <AdjustmentAuditList workerId={workerId} />
          </div>
        </section>
      )}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar ajuste de horas" : "Añadir ajuste de horas"}
            </DialogTitle>
            <DialogDescription>
              Usa un valor positivo para sumar horas y negativo para restarlas.
              El cambio quedará registrado.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <label className="block text-sm">
              Trabajador
              <select
                className="p-control block w-full border rounded-md p-2 mt-1"
                aria-label="Trabajador del ajuste"
                required
                disabled={!!workerId || !!editing}
                value={form.cleanerId}
                onChange={(e) =>
                  setForm({ ...form, cleanerId: e.target.value })
                }
              >
                <option value="">Seleccionar trabajador</option>
                {cleaners.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm">
                Fecha
                <input
                  required
                  className="block border rounded-md p-2 w-full mt-1"
                  aria-label="Fecha del ajuste"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Horas (+ / −)
                <input
                  required
                  className="block border rounded-md p-2 w-full mt-1"
                  aria-label="Horas del ajuste"
                  type="number"
                  step="0.25"
                  min="-24"
                  max="24"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
              </label>
            </div>
            <label className="block text-sm">
              Categoría
              <select
                className="block border rounded-md p-2 w-full mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(categories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Motivo
              <input
                required
                minLength={3}
                className="block border rounded-md p-2 w-full mt-1"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Notas (opcional)
              <textarea
                className="block border rounded-md p-2 w-full mt-1"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            {error && (
              <p className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="border rounded-lg px-4 py-2"
                onClick={() => close(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="bg-[#310984] text-white rounded-lg px-4 py-2"
              >
                {busy ? "Guardando…" : "Guardar ajuste"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogTitle>Eliminar ajuste</DialogTitle>
          <DialogDescription>
            Se retirarán {hoursText(Number(deleting?.hours || 0))} del cómputo.
            La eliminación quedará en el historial.
          </DialogDescription>
          <div className="flex justify-end gap-3">
            <button
              className="border rounded-lg px-4 py-2"
              onClick={() => setDeleting(null)}
            >
              Cancelar
            </button>
            <button
              disabled={remove.isPending}
              className="bg-[#310984] text-white rounded-lg px-4 py-2"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await remove.mutateAsync({
                    id: deleting.id,
                    cleanerId: deleting.cleaner_id,
                  });
                  setDeleting(null);
                } catch {
                  /* Mutation displays the error; keep the dialog open. */
                }
              }}
            >
              Eliminar ajuste
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function AdjustmentAuditList({ workerId }: { workerId: string }) {
  const query = useAdjustmentAudit(workerId);
  const [limit, setLimit] = useState(20);
  return (
    <details className="p-history-details">
      <summary>Historial de cambios en ajustes</summary>
      {query.error ? (
        <p role="alert">No se pudo cargar el historial.</p>
      ) : query.isLoading ? (
        <p>Cargando…</p>
      ) : !query.data?.length ? (
        <p className="p-muted">
          Los cambios quedarán registrados aquí desde la activación de este
          apartado.
        </p>
      ) : (
        <>
          <div className="p-table-wrap">
            <table className="p-table responsive">
              <thead>
                <tr>
                  <th>Cambio</th>
                  <th>Horas antes → después</th>
                  <th>Fecha</th>
                  <th>Autor</th>
                </tr>
              </thead>
              <tbody>
                {query.data.slice(0, limit).map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.action === "INSERT"
                        ? "Creación"
                        : a.action === "DELETE"
                          ? "Eliminación"
                          : "Modificación"}{" "}
                      · {(a.new_data || a.old_data)?.reason}
                    </td>
                    <td>
                      {hoursText(a.old_data ? Number(a.old_data.hours) : null)}{" "}
                      →{" "}
                      {hoursText(a.new_data ? Number(a.new_data.hours) : null)}
                    </td>
                    <td>
                      {new Date(a.changed_at).toLocaleString("es-ES", {
                        timeZone: "Europe/Madrid",
                      })}
                    </td>
                    <td title={a.changed_by || "Sistema"}>
                      {a.author_name ||
                        (a.changed_by
                          ? `Usuario ${a.changed_by.slice(0, 8)}`
                          : "Sistema")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data.length > limit && (
            <button className="p-link" onClick={() => setLimit((n) => n + 20)}>
              Mostrar más cambios
            </button>
          )}
        </>
      )}
    </details>
  );
}
