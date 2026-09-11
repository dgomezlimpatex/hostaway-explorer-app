import React from "react";
import { Link } from "react-router-dom";
import { useWorkerAbsences } from "@/hooks/useWorkerAbsences";
import { dateText } from "./hours";
export function AbsenceSummary({
  workerId,
  from,
  to,
}: {
  workerId: string;
  from: string;
  to: string;
}) {
  const { data: absences = [], isLoading, error } = useWorkerAbsences(workerId);
  const rows = absences.filter((a) => a.startDate <= to && a.endDate >= from);
  return (
    <section className="p-panel">
      <div className="p-panel-head">
        <h2>Ausencias del periodo</h2>
        <Link className="p-link" to={`/workers/${workerId}?tab=availability`}>
          Consultar
        </Link>
      </div>
      <div className="p-content">
        {error ? (
          <p role="alert">No se pudieron consultar las ausencias.</p>
        ) : isLoading ? (
          <p>Cargando…</p>
        ) : rows.length ? (
          rows.map((a) => (
            <div key={a.id} className="py-3 border-b last:border-0">
              <strong>
                {a.locationName ||
                  {
                    vacation: "Vacaciones",
                    sick: "Baja",
                    day_off: "Día libre",
                    holiday: "Festivo",
                    personal: "Ausencia personal",
                    external_work: "Trabajo externo",
                  }[a.absenceType]}
              </strong>
              <span className="block p-muted">
                {dateText(a.startDate)} – {dateText(a.endDate)}
              </span>
            </div>
          ))
        ) : (
          <p className="p-muted">Sin ausencias registradas en este periodo.</p>
        )}
        <p className="p-footnote">
          Las ausencias no reducen automáticamente el objetivo contractual.
        </p>
      </div>
    </section>
  );
}
