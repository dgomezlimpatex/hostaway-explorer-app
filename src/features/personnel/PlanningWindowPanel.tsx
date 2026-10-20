import React from "react";
import { Link } from "react-router-dom";
import { useCleanerAvailability } from "@/hooks/useCleanerAvailability";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Cleaner } from "@/types/calendar";
import { describePlanningWindow, minutesAsHours, planningWindowText } from "./planningWindow";

/**
 * Solo lectura: ventana semanal y límites que usa el planificador para esta persona.
 * La ventana no tiene editor activo en la app; los límites se editan en Ajustes de
 * planificación (Cobertura), si el rol tiene acceso.
 */
export function PlanningWindowPanel({ worker }: { worker: Cleaner }) {
  const query = useCleanerAvailability(worker.id);
  const { canAccessModule } = useRolePermissions();
  const days = query.data ? describePlanningWindow(worker, query.data) : [];
  const withoutRows = days.length > 0 && days.every((d) => d.source === "contract_fallback");
  return (
    <section className="p-panel" aria-labelledby="ventana-planificador">
      <div className="p-panel-head">
        <h2 id="ventana-planificador">Ventana del planificador</h2>
        {canAccessModule("propertyGroups") && (
          <Link className="p-link" to="/planning-settings">
            Editar límites
          </Link>
        )}
      </div>
      <div className="p-content">
        <p className="p-muted">
          Horario semanal y límites con los que el planificador propone tareas. Es una regla de reparto, no
          horas trabajadas.
        </p>
        {query.error ? (
          <p className="p-notice p-error mt-3" role="alert">
            No se pudo consultar la ventana semanal.{" "}
            <button type="button" className="p-link" onClick={() => query.refetch()}>
              Reintentar
            </button>
          </p>
        ) : query.isLoading ? (
          <p className="p-muted mt-3" role="status">
            Consultando ventana semanal…
          </p>
        ) : (
          <>
            {withoutRows && (
              <p className="p-notice mt-3">
                Esta persona no tiene horario semanal propio: el planificador usa una estimación.
              </p>
            )}
            <dl className="p-contact p-window">
              {days.map((d) => (
                <React.Fragment key={d.day}>
                  <dt>{d.day}</dt>
                  <dd>{planningWindowText(d)}</dd>
                </React.Fragment>
              ))}
            </dl>
          </>
        )}
        <dl className="p-contact">
          <dt>Capacidad diaria</dt>
          <dd>{minutesAsHours(worker.planningMaxDailyMinutes)}</dd>
          <dt>Zona</dt>
          <dd>{worker.planningZone || "Sin zona"}</dd>
          <dt>Restricciones</dt>
          <dd>{worker.planningOperationalRestrictions || "Sin restricciones anotadas"}</dd>
          <dt>Carga de ropa</dt>
          <dd>{worker.planningCanHandleLinenLoad === false ? "No asignar" : "Puede"}</dd>
          <dt>Limpiezas complejas</dt>
          <dd>{worker.planningCanHandleComplexCleanings === false ? "No asignar" : "Puede"}</dd>
        </dl>
        <p className="p-footnote">
          La ventana semanal no tiene editor activo en la app: se crea con el alta (06:00–23:00 todos los días).
          Los límites son datos anotados a mano en planificación.
        </p>
      </div>
    </section>
  );
}
