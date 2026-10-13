import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import "@/components/inventory/laundryReceiptMobile.css";
import { handleReceiptQuantityKey } from "@/components/inventory/receiptKeyboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LaundryReceiptStart from "@/components/inventory/LaundryReceiptStart";
import LaundryReceiptReview from "@/components/inventory/LaundryReceiptReview";
import {
  RECEIPT_MATERIALS,
  emptyReceiptCounts,
  madridReceiptDate,
  receiptQuantity,
  isReceiptDate,
} from "../../supabase/functions/_shared/laundryReceiptDomain";
import {
  downloadReceiptExcel,
  receiptRequest,
  ReceiptRequestError,
} from "@/services/laundryReceiptService";
import { receiptEmail, type ReceiptState } from "@/types/laundryReceipt";

type Access = {
  sessionToken: string;
  workerId: string;
  workerName: string;
  expiresAt: string;
};
type Pending = {
  operationId: string;
  date: string;
  payload: Record<string, unknown>;
  workerId: string;
  workerName: string;
};
function readStored<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
const emailLabels = {
  pending: "Correo pendiente",
  sending: "Enviando correo",
  accepted: "Correo aceptado por el proveedor",
  error: "Error de envío",
  uncertain: "Envío pendiente de revisión por administración",
};

type Props = {
  adminAccess?: { warehouseId: string; userId: string };
  onSaved?: () => void;
  onEditingChange?: (editing: boolean) => void;
};
export default function PublicLaundryReceipt({ adminAccess, onSaved, onEditingChange }: Props = {}) {
  const { token = "" } = useParams();
  const adminMode = Boolean(adminAccess);
  const warehouseId = adminAccess?.warehouseId || "";
  const adminUserId = adminAccess?.userId || "";
  const scope = adminMode ? `admin:${warehouseId}:${adminUserId}` : token;
  const accessKey = `laundry-receipt-access:${scope}`;
  const pendingKey = `laundry-receipt-pending:${scope}`;
  const [savedAccess, setAccess] = useState<Access | null>(() =>
    readStored<Access>(accessKey),
  );
  const access = useMemo<Access | null>(() => adminMode ? {
    sessionToken: "", workerId: adminUserId, workerName: "Administración", expiresAt: "",
  } : savedAccess, [adminMode, adminUserId, savedAccess]);
  const [pending, setPending] = useState<Pending | null>(() =>
    readStored<Pending>(pendingKey),
  );
  const [state, setState] = useState<ReceiptState | null>(null);
  const [date, setDate] = useState(() => readStored<Pending>(pendingKey)?.date || madridReceiptDate());
  const [reviewing, setReviewing] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [inputRevisions, setInputRevisions] = useState<Record<string, number>>(
    {},
  );
  const readSequence = useRef(0);
  const cancelReads = useCallback(() => {
    readSequence.current++;
  }, []);

  const refresh = useCallback(async () => {
    if (!access) return;
    const sequence = ++readSequence.current;
    try {
      const next = await receiptRequest<ReceiptState>({
        action: adminMode ? "admin_receipt_read" : "read",
        warehouseId: adminMode ? warehouseId : undefined,
        token,
        sessionToken: access.sessionToken,
        date: date || null,
      });
      if (sequence === readSequence.current) setState(next);
    } catch (err) {
      if (!adminMode && err instanceof ReceiptRequestError && err.status === 401) {
        localStorage.removeItem(accessKey);
        setAccess(null);
        setState(null);
      }
      throw err;
    }
  }, [access, token, date, accessKey, adminMode, warehouseId]);
  useEffect(() => {
    if (!access) return;
    refresh().catch((err) => setError(err.message));
    const timer = window.setInterval(() => {
      if (!busy) refresh().catch((err) => setError(err.message));
    }, 8000);
    return () => {
      window.clearInterval(timer);
      cancelReads();
    };
  }, [access, busy, refresh, cancelReads]);
  useEffect(() => {
    setReviewing(false);
    setInputs({});
    setInputRevisions({});
  }, [state?.date, state?.receipt?.id]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await receiptRequest<Access>({
        action: "login",
        token,
        pin,
      });
      localStorage.setItem(accessKey, JSON.stringify(next));
      setAccess(next);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo acceder");
    } finally {
      setBusy(false);
    }
  }
  async function sendPending(operation: Pending) {
    if (!access) return;
    if (operation.workerId !== access.workerId) {
      setError(
        `La operación pendiente es de ${operation.workerName}. Debe acceder esa persona para recuperarla.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await receiptRequest({
        action: adminMode ? "admin_receipt_mutate" : "mutate",
        warehouseId: adminMode ? warehouseId : undefined,
        token,
        sessionToken: access.sessionToken,
        ...operation,
      });
      localStorage.removeItem(pendingKey);
      setPending(null);
      if (operation.payload.material) {
        const inputKey = `${String(operation.payload.action).includes("discard") ? "discard:" : ""}${String(operation.payload.material)}`;
        setInputs((prev) => ({
          ...prev,
          [inputKey]: "",
        }));
        setInputRevisions((prev) => {
          const next = { ...prev };
          delete next[inputKey];
          return next;
        });
      }
      await refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      if (err instanceof ReceiptRequestError && err.status === 409)
        await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(payload: Record<string, unknown>) {
    if (pending || !access || !state) return;
    const operation: Pending = {
      operationId: crypto.randomUUID(),
      date: state.date,
      payload: { expectedRevision: state.receipt?.revision ?? 0, ...payload },
      workerId: access.workerId,
      workerName: access.workerName,
    };
    try {
      localStorage.setItem(pendingKey, JSON.stringify(operation));
    } catch {
      setError(
        "No se puede conservar la operación en este móvil. Libera espacio antes de contar.",
      );
      return;
    }
    setPending(operation);
    await sendPending(operation);
  }
  function quantityAction(
    material: string,
    action: "add" | "set" | "add_discard",
  ) {
    try {
      const inputKey = `${action === "add_discard" ? "discard:" : ""}${material}`;
      const quantity = receiptQuantity(inputs[inputKey] || "");
      if (action !== "set" && quantity === 0)
        throw new Error("Introduce una cantidad mayor que cero para sumar.");
      if (
        action === "set" &&
        !window.confirm(`¿Sustituir el total de este material por ${quantity}?`)
      )
        return;
      void mutate({
        action,
        material,
        quantity,
        expectedRevision:
          inputRevisions[inputKey] ?? state?.receipt?.revision ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cantidad inválida");
    }
  }
  const locked = busy || Boolean(pending);
  const latest = state?.versions[0];
  const discardedCounts =
    state?.receipt?.discarded_counts ?? emptyReceiptCounts();
  const changed =
    !latest ||
    RECEIPT_MATERIALS.some(
      ([key]) => (latest.snapshot.counts[key] ?? 0) !== (state?.receipt?.counts[key] ?? 0),
    ) ||
    RECEIPT_MATERIALS.some(
      ([key]) =>
        (latest.snapshot.discarded_counts?.[key] ?? 0) !== (discardedCounts[key] ?? 0),
    ) ||
    latest.snapshot.notes !== state?.receipt?.notes;
  const lastEditable = state?.operations.find(
    (op) =>
      ["add", "set", "add_discard", "set_discard"].includes(
        op.payload.action,
      ) && op.revision === state.receipt?.revision,
  );
  const unsubmitted = Object.values(inputs).some((value) => value !== "");
  useEffect(() => { onEditingChange?.(locked || unsubmitted || reviewing); }, [onEditingChange, locked, unsubmitted, reviewing]);
  const today = madridReceiptDate();
  function selectDate(next: string) {
    if (locked || reviewing) return;
    if (!isReceiptDate(next, today)) {
      setError("Selecciona una fecha válida de hoy o de un día anterior.");
      return;
    }
    if (next === (date || state?.date || today)) return;
    if (unsubmitted && !window.confirm("Hay cantidades escritas sin añadir. ¿Descartarlas y cambiar de fecha?")) return;
    cancelReads();
    setState(null);
    setInputs({});
    setInputRevisions({});
    setReviewing(false);
    setError("");
    setDate(next);
  }
  const starting = Boolean(access && state && !state.receipt);
  const Container = adminMode ? "section" : "main";
  const Heading = adminMode ? "h3" : "h1";

  return (
    <Container data-embedded={adminMode} data-entry-active={unsubmitted || locked} className={`laundry-receipt ${adminMode ? "rounded-xl" : "min-h-[100dvh]"} bg-slate-50 px-3 py-4 text-slate-900`}>
      <div className="relative mx-auto max-w-xl space-y-2">
        <header className={starting ? "hidden" : undefined}>
          <p className="hidden">APP GESTIÓN LIMPATEX</p>
          <Heading className="text-xl font-bold leading-7 tracking-tight sm:text-2xl">
            Inventario de lencería
          </Heading>
          <p className="hidden">Cuenta por tandas y confirma al terminar.</p>
        </header>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {!access ? (
          <form
            onSubmit={login}
            className="receipt-stage space-y-4 rounded-2xl border bg-white p-5 shadow-sm"
          >
            <label htmlFor="receipt-pin" className="block font-medium">
              Tu PIN de empleado
            </label>
            <p className="text-sm text-slate-500">Accede para registrar la lencería recibida.</p>
            <Input
              id="receipt-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              className="h-12 text-lg"
            />
            <Button
              type="submit"
              disabled={busy || pin.length < 3}
              className="h-12 w-full"
            >
              {busy ? "Comprobando…" : "Entrar al recuento"}
            </Button>
          </form>
        ) : (
          <>
            <div className={`${starting ? "hidden" : "flex"} flex-wrap items-center justify-between gap-2 text-xs leading-4 text-slate-600 [&_button]:hidden`}>
              <span>{state?.workerName || access.workerName}</span>
              {!adminMode && <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  await receiptRequest({
                    action: "logout",
                    token,
                    sessionToken: access.sessionToken,
                  }).catch(() => undefined);
                  localStorage.removeItem(accessKey);
                  setAccess(null);
                  setState(null);
                  setInputs({});
                  setDate("");
                }}
              >
                Cambiar empleado
              </Button>}
            </div>
            {!starting && <div className="space-y-1 rounded-xl border bg-white p-3">
              <label htmlFor={`receipt-date-${adminMode ? "admin" : "public"}`} className="block text-sm font-semibold">Fecha de la entrega</label>
              <Input id={`receipt-date-${adminMode ? "admin" : "public"}`} type="date" min="0001-01-01" max={today}
                value={date || state?.date || today} disabled={locked || reviewing} className="h-11 text-base"
                onChange={(event) => selectDate(event.target.value)} />
              {(date || state?.date || today) < today && <p className="text-xs text-amber-800">Estás registrando la entrega de un día pasado. Al confirmar, se actualizará el stock actual.</p>}
            </div>}
            {!state && (
              <div className="receipt-stage space-y-3 rounded-2xl border bg-white p-4">
                <p className="flex items-center gap-2 text-sm text-slate-600" role="status"><Loader2 className="receipt-spinner h-4 w-4" aria-hidden="true" />Cargando recuento…</p>
              <Button
                variant="outline"
                onClick={() => refresh().catch((err) => setError(err.message))}
              >
                Cargar recuento
              </Button>
              </div>
            )}
            {access && state && (state.receipt || busy || pending) && <div role="status" aria-live="polite" className={`flex min-h-9 items-center gap-2 text-xs ${pending && !busy ? "text-amber-800" : "text-slate-600"}`}>
              {busy ? <><Loader2 className="receipt-spinner h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>Guardando operación…</span></> : pending ? <span>Hay una operación pendiente de recuperar.</span> : state.receipt ? <><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{changed ? "Borrador guardado · el stock cambia al confirmar" : "Recuento confirmado"}</span></> : <span>Listo para registrar la entrega</span>}
            </div>}
            {pending && !busy && (
              <div
                className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
                role="status"
              >
                <p>
                  <strong>Operación pendiente de guardar</strong> ·{" "}
                  {pending.date} · {pending.workerName}
                </p>
                <p>
                  {
                    (
                      {
                        add: "Añadir",
                        add_discard: "Añadir descartes",
                        set_discard: "Corregir descartes",
                        set: "Corregir total",
                        start: "Iniciar recuento",
                        notes: "Guardar observaciones",
                        undo: "Deshacer",
                        confirm: "Confirmar recuento",
                      } as Record<string, string>
                    )[String(pending.payload.action)]
                  }{" "}
                  {String(pending.payload.quantity ?? "")}{" "}
                  {RECEIPT_MATERIALS.find(
                    ([key]) => key === pending.payload.material,
                  )?.[1] || ""}
                  . Aún no se ha confirmado su resultado.
                </p>
                <Button
                  disabled={busy}
                  onClick={() => void sendPending(pending)}
                >
                  Recuperar operación
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "¿Descartar la operación pendiente? Si llegó a guardarse, seguirá en el recuento. Revisa el total antes de volver a añadirla.",
                      )
                    )
                      return;
                    localStorage.removeItem(pendingKey);
                    setPending(null);
                    setInputRevisions({});
                    await refresh().catch((err) => setError(err.message));
                  }}
                >
                  Descartar y revisar
                </Button>
              </div>
            )}
            {state && (
              <>
                <section className={starting ? "hidden" : "space-y-2"}>
                  <h2 className="text-xs text-slate-500">{state.warehouseName}</h2>
                  {state.date !== today && (
                    <Button
                      variant="outline"
                      className="mt-2"
                      disabled={locked || reviewing}
                      onClick={() => {
                        selectDate(today);
                      }}
                    >
                      Volver a hoy · {madridReceiptDate()}
                    </Button>
                  )}
                </section>
                {state.receipt && state.pendingDates.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4 text-sm">
                    <p className="font-medium">
                      Hay recuentos anteriores sin confirmar
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {state.pendingDates.map((d) => (
                        <Button
                          key={d}
                          variant="outline"
                          disabled={locked || unsubmitted || reviewing}
                          onClick={() => {
                            selectDate(d);
                          }}
                        >
                          Retomar {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {!state.receipt ? (
                  <LaundryReceiptStart
                    workerName={state.workerName || access.workerName}
                    warehouseName={state.warehouseName}
                    date={state.date}
                    today={today}
                    pendingDates={state.pendingDates}
                    locked={locked}
                    resumeDisabled={locked || unsubmitted || reviewing}
                    adminMode={adminMode}
                    onSelectDate={selectDate}
                    onStart={() => void mutate({ action: "start" })}
                  />
                ) : (
                  <>
                    {reviewing ? (
                      <LaundryReceiptReview
                        counts={state.receipt.counts}
                        discardedCounts={discardedCounts}
                        onCorrectDiscard={(
                          material,
                          quantity,
                          expectedRevision,
                        ) =>
                          void mutate({
                            action: "set_discard",
                            material,
                            quantity,
                            expectedRevision,
                          })
                        }
                        revision={state.receipt.revision}
                        notes={state.receipt.notes}
                        locked={locked}
                        confirmed={!changed}
                        updated={Boolean(state.receipt.latest_version)}
                        onCorrect={(material, quantity, expectedRevision) =>
                          void mutate({
                            action: "set",
                            material,
                            quantity,
                            expectedRevision,
                          })
                        }
                        onConfirm={() => void mutate({ action: "confirm" })}
                        onBack={() => {
                          setReviewing(false);
                          window.scrollTo({ top: 0 });
                        }}
                      />
                    ) : (
                      <div className="receipt-stage space-y-3">
                        <p className="hidden" role="status">
                          {changed
                            ? "Borrador · el stock cambia al confirmar"
                            : `Confirmado · versión ${state.receipt.latest_version}`}
                          <br />
                          Guardado:{" "}
                          {new Date(
                            state.receipt.updated_at,
                          ).toLocaleTimeString("es-ES", {
                            timeZone: "Europe/Madrid",
                          })}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                        {RECEIPT_MATERIALS.map(([key, label]) => (
                          <section
                            key={key}
                            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <label
                                htmlFor={`count-${key}`}
                                className="text-sm font-semibold leading-5"
                              >
                                {label}
                              </label>
                              <output
                                aria-label={`Total ${label}`}
                                className="text-2xl font-bold leading-7 tabular-nums text-primary"
                              >
                                <span className="receipt-total" key={state.receipt!.counts[key] ?? 0}>{state.receipt!.counts[key] ?? 0}</span>
                              </output>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                id={`count-${key}`}
                                aria-label={`Cantidad ${label}`}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Cantidad de esta tanda"
                                value={inputs[key] || ""}
                                disabled={locked}
                                enterKeyHint="done"
                                onKeyDown={(event) => handleReceiptQuantityKey(event, locked, inputs[key], () => quantityAction(key, "add"))}
                                onChange={(e) => {
                                  const value = e.target.value.replace(
                                    /\D/g,
                                    "",
                                  );
                                  setInputs((prev) => ({
                                    ...prev,
                                    [key]: value,
                                  }));
                                  setInputRevisions((prev) => {
                                    const next = { ...prev };
                                    if (!value) delete next[key];
                                    else if (next[key] === undefined)
                                      next[key] = state.receipt!.revision;
                                    return next;
                                  });
                                }}
                                className="h-11 min-w-0 text-base"
                              />
                              <Button
                                className="h-12 min-w-20 shrink-0 rounded-xl px-4"
                                aria-busy={busy && pending?.payload.material === key && pending?.payload.action === "add"}
                                disabled={locked || !inputs[key]}
                                onClick={() => quantityAction(key, "add")}
                              >
                                Añadir
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              className="hidden"
                              disabled={
                                locked ||
                                inputs[key] === undefined ||
                                inputs[key] === ""
                              }
                              onClick={() => quantityAction(key, "set")}
                            >
                              Usar esta cantidad como total corregido
                            </Button>
                          </section>
                        ))}
                        </div>
                        <Button
                          variant="outline"
                          disabled={locked || !lastEditable}
                          onClick={() =>
                            void mutate({
                              action: "undo",
                              targetId: lastEditable?.id,
                            })
                          }
                        >
                          Deshacer última suma o corrección
                        </Button>
                        <details className="rounded-xl border bg-white p-3">
                          <summary className="cursor-pointer py-2 text-sm font-semibold">
                            DESCARTES
                          </summary>
                          <p className="mb-3 text-xs text-slate-600">
                            Ropa sucia, rota o rechazada para devolver a
                            lavandería. No suma al inventario y se incluye en el
                            Excel.
                          </p>
                          <div className="space-y-2">
                            {RECEIPT_MATERIALS.map(([key, label]) => (
                              <section
                                key={key}
                                className="rounded-lg border p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <label
                                    htmlFor={`discard-${key}`}
                                    className="text-sm font-semibold"
                                  >
                                    {label}
                                  </label>
                                  <output
                                    aria-label={`Total descartes ${label}`}
                                    className="text-2xl font-bold tabular-nums text-primary"
                                  >
                                    <span className="receipt-total" key={discardedCounts[key] ?? 0}>{discardedCounts[key] ?? 0}</span>
                                  </output>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    id={`discard-${key}`}
                                    aria-label={`Cantidad descartes ${label}`}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Cantidad de esta tanda"
                                    value={inputs[`discard:${key}`] || ""}
                                    disabled={locked}
                                    enterKeyHint="done"
                                    onKeyDown={(event) => handleReceiptQuantityKey(event, locked, inputs[`discard:${key}`], () => quantityAction(key, "add_discard"))}
                                    className="h-11 min-w-0 text-base"
                                    onChange={(e) =>
                                      setInputs((prev) => ({
                                        ...prev,
                                        [`discard:${key}`]: e.target.value,
                                      }))
                                    }
                                  />
                                  <Button
                                    className="h-12 min-w-20 shrink-0 rounded-xl px-4"
                                    aria-label={`Añadir descartes ${label}`}
                                    disabled={
                                      locked || !inputs[`discard:${key}`]
                                    }
                                    onClick={() =>
                                      quantityAction(key, "add_discard")
                                    }
                                  >
                                    Añadir
                                  </Button>
                                </div>
                              </section>
                            ))}
                          </div>
                        </details>
                        <div className="receipt-action-dock space-y-2">
                        {unsubmitted && (
                          <p className="text-sm text-amber-800">
                            Hay cantidades escritas sin añadir. Añádelas o vacía
                            sus campos antes de confirmar.
                          </p>
                        )}
                        <Button
                          className="h-auto min-h-12 w-full whitespace-normal rounded-xl py-3 text-base"
                          disabled={locked || unsubmitted}
                          onClick={() => {
                            setReviewing(true);
                            window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
                          }}
                        >
                          Revisar recuento
                        </Button>
                        <p className="text-center text-xs text-slate-600">
                          Destinatarios: dgomez@limpatex.com y
                          geisha@limpatex.com
                        </p>
                        </div>
                      </div>
                    )}
                    {state.versions.map((v) => {
                      const email = receiptEmail(v);
                      return (
                        <section
                          key={v.id}
                          className="space-y-2 rounded-xl border bg-white p-4 text-sm"
                        >
                          <p className="font-semibold">
                            Versión {v.version} · {v.snapshot.worker_name}
                          </p>
                          <p>
                            {email
                              ? emailLabels[email.status]
                              : "Correo pendiente"}
                          </p>
                          {email?.error_message && (
                            <p className="text-red-700">
                              {email.error_message}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            onClick={() =>
                              void downloadReceiptExcel(v.snapshot).catch(
                                (err) => setError(err.message),
                              )
                            }
                          >
                            Descargar Excel
                          </Button>
                          {email &&
                            ["pending", "error"].includes(email.status) && (
                              <Button
                                className="ml-2"
                                disabled={locked}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await receiptRequest({
                                      action: adminMode ? "admin_receipt_retry" : "retry",
                                      warehouseId: adminMode ? warehouseId : undefined,
                                      token,
                                      sessionToken: access.sessionToken,
                                      date: state.date,
                                      versionId: v.id,
                                    });
                                    await refresh();
                                  } catch (err) {
                                    setError(
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
                        </section>
                      );
                    })}
                    <details className="rounded-xl border bg-white p-4 text-sm">
                      <summary className="cursor-pointer font-medium">
                        Historial del recuento
                      </summary>
                      <ul className="mt-3 space-y-2">
                        {state.operations.map((op) => (
                          <li key={op.id}>
                            {op.worker_name} ·{" "}
                            {new Date(op.created_at).toLocaleTimeString(
                              "es-ES",
                              { timeZone: "Europe/Madrid" },
                            )}{" "}
                            ·{" "}
                            {
                              (
                                {
                                  add: "Añadió",
                                  set: "Corrigió",
                                  undo: "Deshizo",
                                  notes: "Guardó observaciones",
                                  confirm: "Confirmó",
                                  start: "Inició",
                                } as Record<string, string>
                              )[op.payload.action]
                            }{" "}
                            {
                              RECEIPT_MATERIALS.find(
                                ([k]) => k === op.payload.material,
                              )?.[1]
                            }{" "}
                            {op.payload.quantity ?? ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Container>
  );
}
