import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RECEIPT_MATERIALS,
  receiptQuantity,
  emptyReceiptCounts,
  type ReceiptCounts,
  type MaterialKey,
} from "../../../supabase/functions/_shared/laundryReceiptDomain";

type Props = {
  counts: ReceiptCounts;
  discardedCounts?: ReceiptCounts;
  onCorrectDiscard?: Props["onCorrect"];
  revision: number;
  notes: string;
  locked: boolean;
  confirmed: boolean;
  updated: boolean;
  onCorrect: (
    material: MaterialKey,
    quantity: number,
    revision: number,
  ) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export default function LaundryReceiptReview({
  counts,
  discardedCounts = emptyReceiptCounts(),
  onCorrectDiscard,
  revision,
  notes,
  locked,
  confirmed,
  updated,
  onCorrect,
  onConfirm,
  onBack,
}: Props) {
  const [edit, setEdit] = useState<{
    material: MaterialKey;
    discarded: boolean;
    value: string;
    revision: number;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      edit &&
      revision !== edit.revision &&
      edit.value !== "" &&
      (edit.discarded ? discardedCounts : counts)[edit.material] ===
        Number(edit.value)
    )
      setEdit(null);
  }, [counts, discardedCounts, revision, edit]);
  const stale = Boolean(edit && edit.revision !== revision);
  const materialRows = (totals: ReceiptCounts, discarded: boolean) => (
    <div className="divide-y rounded-xl border bg-white px-3">
      {RECEIPT_MATERIALS.map(([material, label]) => (
        <div key={material} className="py-1">
          <div className="flex min-h-11 items-center gap-3">
            <span className="flex-1 text-sm font-medium">{label}</span>
            <output
              aria-label={`${discarded ? "Revisado descartes" : "Revisado"} ${label}`}
              className="text-xl font-bold tabular-nums text-primary"
            >
              {totals[material]}
            </output>
            {
              <Button
                variant="ghost"
                className="h-11 w-11 shrink-0 p-0"
                aria-label={`${discarded ? "Editar descartes" : "Editar"} ${label}`}
                disabled={
                  locked || Boolean(edit) || (discarded && !onCorrectDiscard)
                }
                onClick={() => {
                  setError("");
                  setEdit({
                    material,
                    discarded,
                    value: String(totals[material]),
                    revision,
                  });
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            }
          </div>
          {edit?.material === material && edit.discarded === discarded && (
            <div className="space-y-2 pb-1">
              <Input
                aria-label={`${discarded ? "Total corregido descartes" : "Total corregido"} ${label}`}
                inputMode="numeric"
                pattern="[0-9]*"
                className="h-11 text-base"
                value={edit.value}
                disabled={locked}
                onChange={(event) => {
                  setError("");
                  setEdit({
                    ...edit,
                    value: event.target.value,
                  });
                }}
              />
              {stale && (
                <p className="text-sm text-amber-800" role="alert">
                  El recuento ha cambiado. Cancela la edición, revisa el total
                  vigente y vuelve a editar.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  className="h-11"
                  disabled={locked || stale}
                  onClick={() => {
                    try {
                      (edit.discarded ? onCorrectDiscard! : onCorrect)(
                        material,
                        receiptQuantity(edit.value),
                        edit.revision,
                      );
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Cantidad inválida",
                      );
                    }
                  }}
                >
                  Guardar corrección
                </Button>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={locked}
                  onClick={() => {
                    setEdit(null);
                    setError("");
                  }}
                >
                  Cancelar edición
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <section className="space-y-3" aria-label="Revisión final del recuento">
      <div>
        <h2 className="text-lg font-semibold">
          {confirmed ? "Recuento confirmado" : "Revisa las cantidades"}
        </h2>
        <p className="text-sm text-slate-600">
          {confirmed
            ? "Puedes corregir los totales o consultar el correo y descargar el Excel más abajo."
            : "Edita cualquier total antes de confirmar el envío."}
        </p>
      </div>
      {materialRows(counts, false)}
      <details className="rounded-xl border bg-white p-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold">
          DESCARTES
        </summary>
        <p className="mb-2 text-xs text-slate-600">
          Para devolver a lavandería. No suman al inventario.
        </p>
        {materialRows(discardedCounts, true)}
      </details>
      {notes && (
        <p className="rounded-xl border bg-white p-3 text-sm whitespace-pre-wrap">
          <strong>Observaciones: </strong>
          {notes}
        </p>
      )}
      {!confirmed && (
        <>
          {edit && (
            <p className="text-sm text-amber-800">
              Guarda o cancela la corrección antes de enviar.
            </p>
          )}
          <p className="text-sm text-slate-600">
            Al confirmar solo la ropa aceptada se añadirá al inventario. El
            Excel incluirá los descartes y se enviará a dgomez@limpatex.com y
            geisha@limpatex.com.
          </p>
          <Button
            className="h-auto min-h-14 w-full whitespace-normal px-3 py-3 text-base"
            disabled={locked || Boolean(edit)}
            onClick={onConfirm}
          >
            {locked
              ? "Guardando…"
              : updated
                ? "Confirmar cambios y reenviar Excel"
                : "Confirmar y enviar Excel"}
          </Button>
        </>
      )}
      <Button
        variant="outline"
        className="h-11 w-full"
        disabled={locked}
        onClick={onBack}
      >
        Volver al recuento
      </Button>
    </section>
  );
}
