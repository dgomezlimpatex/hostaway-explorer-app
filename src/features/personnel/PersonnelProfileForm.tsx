import React, { useEffect, useId, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Cleaner } from "@/types/calendar";
import { useUpdateCleaner } from "@/hooks/useCleaners";
import { useWorkerCapabilities } from "@/hooks/useWorkerCapabilities";
import { DeactivateWorkerDialog } from "@/components/workers/DeactivateWorkerDialog";
import { RouteWorkerAccessCard } from "@/components/workers/WorkerDetailModal";
import { filterWorkerUpdateForRole } from "@/lib/roleCapabilities";
import {
  NO_CATEGORY,
  NO_CATEGORY_LABEL,
  buildWorkerUpdate,
  categoryLabel,
  categoryOptions,
  isNonStandardCategory,
  hasWorkerChanges,
  validateWorkerForm,
  workerFormFromSource,
  type WorkerFormValues,
} from "./workerForm";
import { dateText, hoursText } from "./hours";

/** Pestaña «Ficha»: datos editables, estado de la cuenta y origen REGISTRO. */
export function PersonnelProfileForm({ worker }: { worker: Cleaner }) {
  const { canEdit, canManageAccounts, canViewSensitive, role } = useWorkerCapabilities();
  return (
    <div className="p-stack">
      <div className="p-detail-grid">
        {canEdit ? (
          <EditableWorkerData worker={worker} role={role} />
        ) : (
          <ReadOnlyWorkerData worker={worker} />
        )}
        <RegistroOrigin worker={worker} showSensitive={canViewSensitive} />
      </div>
      {canManageAccounts && (
        <div className="p-detail-grid">
          <AccountStatus worker={worker} />
          <RouteWorkerAccessCard worker={worker} />
        </div>
      )}
    </div>
  );
}

function EditableWorkerData({ worker, role }: { worker: Cleaner; role: string | null }) {
  const [values, setValues] = useState<WorkerFormValues>(() => workerFormFromSource(worker));
  const [touched, setTouched] = useState<Partial<Record<keyof WorkerFormValues, boolean>>>({});
  const updateCleaner = useUpdateCleaner();
  const ids = useId();
  useEffect(() => {
    setValues(workerFormFromSource(worker));
    setTouched({});
  }, [worker]);
  const errors = useMemo(() => validateWorkerForm(values), [values]);
  const changed = hasWorkerChanges(worker, values);
  const invalid = Object.keys(errors).length > 0;
  const set = (field: keyof WorkerFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, email: true, contractHours: true });
    if (invalid || !changed) return;
    const updates = filterWorkerUpdateForRole(role, buildWorkerUpdate(worker, values));
    if (!Object.keys(updates).length) return;
    updateCleaner.mutate({ id: worker.id, updates });
  };
  const options = categoryOptions(worker.category);
  const field = (
    name: keyof WorkerFormValues,
    label: string,
    input: React.ReactNode,
    hint?: string,
  ) => {
    const error = touched[name] ? errors[name] : undefined;
    return (
      <div className="p-field">
        <label htmlFor={`${ids}-${name}`}>{label}</label>
        {input}
        {error ? (
          <p className="p-field-error" id={`${ids}-${name}-error`} role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="p-muted" id={`${ids}-${name}-hint`}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  };
  const describedBy = (name: keyof WorkerFormValues, hasHint = false) =>
    touched[name] && errors[name]
      ? `${ids}-${name}-error`
      : hasHint
        ? `${ids}-${name}-hint`
        : undefined;
  const invalidAttr = (name: keyof WorkerFormValues) =>
    touched[name] && errors[name] ? true : undefined;
  return (
    <form className="p-panel" onSubmit={save} noValidate aria-labelledby={`${ids}-title`}>
      <div className="p-panel-head">
        <h2 id={`${ids}-title`}>Datos de la ficha</h2>
        <div className="personnel-actions">
          {changed && (
            <button
              type="button"
              className="p-button small"
              onClick={() => {
                setValues(workerFormFromSource(worker));
                setTouched({});
              }}
              disabled={updateCleaner.isPending}
            >
              Deshacer
            </button>
          )}
          <button
            type="submit"
            className="p-button small primary"
            disabled={!changed || updateCleaner.isPending}
          >
            {updateCleaner.isPending ? "Guardando…" : "Guardar ficha"}
          </button>
        </div>
      </div>
      <div className="p-content p-form-grid">
        {field(
          "name",
          "Nombre completo",
          <input
            id={`${ids}-name`}
            className="p-control"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={invalidAttr("name")}
            aria-describedby={describedBy("name", !!worker.externalId)}
            autoComplete="off"
          />,
          worker.externalId ? "Viene de REGISTRO; puedes ajustarlo aquí." : undefined,
        )}
        {field(
          "email",
          "Correo",
          <input
            id={`${ids}-email`}
            className="p-control"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={invalidAttr("email")}
            aria-describedby={describedBy("email")}
            placeholder="correo@ejemplo.com"
            autoComplete="off"
          />,
        )}
        {field(
          "telefono",
          "Teléfono",
          <input
            id={`${ids}-telefono`}
            className="p-control"
            type="tel"
            inputMode="tel"
            value={values.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            autoComplete="off"
          />,
        )}
        {field(
          "category",
          "Puesto",
          <select
            id={`${ids}-category`}
            className="p-control"
            value={values.category || NO_CATEGORY}
            onChange={(e) => set("category", e.target.value === NO_CATEGORY ? "" : e.target.value)}
            aria-describedby={describedBy("category", true)}
          >
            {!worker.category?.trim() && <option value={NO_CATEGORY}>{NO_CATEGORY_LABEL}</option>}
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>,
          isNonStandardCategory(worker.category)
            ? "Se conserva el puesto que viene de la ficha aunque no esté en la lista habitual."
            : "Si no lo cambias, se conserva el valor actual.",
        )}
        {field(
          "startDate",
          "Fecha de alta",
          <span className="p-inline">
            <input
              id={`${ids}-startDate`}
              className="p-control"
              type="date"
              value={values.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              aria-describedby={describedBy("startDate", true)}
            />
            {values.startDate && (
              <button type="button" className="p-button small" onClick={() => set("startDate", "")}>
                Quitar fecha
              </button>
            )}
          </span>,
          values.startDate ? undefined : "Sin fecha de alta.",
        )}
        {field(
          "contractHours",
          "Horas semanales de la ficha",
          <input
            id={`${ids}-contractHours`}
            className="p-control"
            inputMode="decimal"
            value={values.contractHours}
            onChange={(e) => set("contractHours", e.target.value)}
            aria-invalid={invalidAttr("contractHours")}
            aria-describedby={describedBy("contractHours", true)}
            placeholder="0"
          />,
          "Entre 0 y 80, en cuartos de hora. Vacío se guarda como 0.",
        )}
      </div>
      {invalid && Object.keys(touched).length > 0 && (
        <p className="p-notice p-error p-form-notice" role="status">
          Revisa los campos marcados antes de guardar.
        </p>
      )}
    </form>
  );
}

function ReadOnlyWorkerData({ worker }: { worker: Cleaner }) {
  return (
    <section className="p-panel" aria-labelledby="ficha-solo-lectura">
      <div className="p-panel-head">
        <h2 id="ficha-solo-lectura">Datos de la ficha</h2>
        <span className="p-tag">Solo consulta</span>
      </div>
      <dl className="p-content p-contact">
        <dt>Nombre</dt>
        <dd>{worker.name}</dd>
        <dt>Correo</dt>
        <dd>{worker.email || "Sin correo"}</dd>
        <dt>Teléfono</dt>
        <dd>{worker.telefono || "Sin teléfono"}</dd>
        <dt>Puesto</dt>
        <dd>{categoryLabel(worker.category)}</dd>
        <dt>Alta</dt>
        <dd>{worker.startDate ? dateText(worker.startDate) : "Sin fecha"}</dd>
        <dt>Jornada</dt>
        <dd>{hoursText(worker.contractHoursPerWeek ?? 0)} / semana</dd>
      </dl>
    </section>
  );
}

function RegistroOrigin({ worker, showSensitive }: { worker: Cleaner; showSensitive: boolean }) {
  const linked = !!worker.externalId;
  return (
    <section className="p-panel" aria-labelledby="origen-registro">
      <div className="p-panel-head">
        <h2 id="origen-registro">Origen</h2>
        <span className={`p-tag ${linked ? "active" : "warning"}`}>
          {linked ? "Vinculado a REGISTRO" : "Alta manual"}
        </span>
      </div>
      <dl className="p-content p-contact">
        <dt>Acceso a la app</dt>
        <dd>{worker.user_id ? "Usuario vinculado" : "Sin usuario vinculado"}</dd>
        {showSensitive && (
          <>
            <dt>DNI</dt>
            <dd>{worker.dni || "—"}</dd>
            <dt>PIN de REGISTRO</dt>
            <dd>{worker.pin ? "Disponible (no se muestra)" : "Sin PIN"}</dd>
          </>
        )}
        <dt>Delegación</dt>
        <dd>{worker.delegationName || "—"}</dd>
        <dt>Oficina</dt>
        <dd>{worker.officeName || "—"}</dd>
        {linked && (
          <>
            <dt>ID externo</dt>
            <dd className="p-mono">{worker.externalId}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function AccountStatus({ worker }: { worker: Cleaner }) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const updateCleaner = useUpdateCleaner();
  return (
    <section className="p-panel" aria-labelledby="estado-cuenta">
      <div className="p-panel-head">
        <h2 id="estado-cuenta">Estado</h2>
        <span className={`p-tag ${worker.isActive ? "active" : ""}`}>
          {worker.isActive ? "Activo" : "Inactivo"}
        </span>
      </div>
      <div className="p-content">
        <p className="p-muted">
          {worker.isActive
            ? "Al desactivar se revisan antes sus tareas futuras y se avisa de la sincronización con REGISTRO."
            : "Un perfil inactivo no se usa para nuevas asignaciones."}
        </p>
        <div className="p-form-actions">
          {worker.isActive ? (
            <button type="button" className="p-button small" onClick={() => setDeactivateOpen(true)}>
              Desactivar…
            </button>
          ) : (
            <button
              type="button"
              className="p-button small"
              onClick={() => setReactivateOpen(true)}
              disabled={updateCleaner.isPending}
            >
              Reactivar…
            </button>
          )}
        </div>
      </div>
      <DeactivateWorkerDialog worker={worker} open={deactivateOpen} onOpenChange={setDeactivateOpen} />
      <AlertDialog open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar a {worker.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Volverá a aparecer para nuevas asignaciones. No se recuperan tareas que se le quitaron al desactivarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateCleaner.mutate({ id: worker.id, updates: { isActive: true } })}
            >
              Reactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
