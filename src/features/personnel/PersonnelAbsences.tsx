import React from "react";
import { Link } from "react-router-dom";
import { useWorkerAbsences } from "@/hooks/useWorkerAbsences";
import { ABSENCE_TYPE_LABELS } from "@/types/workerAbsence";
import { absenceLabelForViewer } from "@/lib/roleCapabilities";
import { dateText } from "./hours";
export function AbsenceSummary({
  workerId,
  from,
  to,
  showSensitive = true,
  link,
}: {
  workerId: string;
  from: string;
  to: string;
  /** Tipo médico/personal visible (solo administración y gerencia). */
  showSensitive?: boolean;
  link?: string;
}) {
  const { data: absences = [], isLoading, error, refetch } = useWorkerAbsences(workerId);
  const rows = absences.filter((a) => a.startDate <= to && a.endDate >= from);
  return (
    <section className="p-panel">
      <div className="p-panel-head">
        <h2>Ausencias del periodo</h2>
        <Link className="p-link" to={link ?? `/workers/${workerId}?tab=availability`}>
          Consultar
        </Link>
      </div>
      <div className="p-content">
        {error ? (
          <p className="p-notice p-error" role="alert">
            No se pudieron consultar las ausencias.{" "}
            <button onClick={() => refetch()}>Reintentar</button>
          </p>
        ) : isLoading ? (
          <p role="status">Cargando…</p>
        ) : rows.length ? (
          rows.map((a) => (
            <div key={a.id} className="py-3 border-b last:border-0">
              <strong>
                {a.locationName && a.absenceType === "external_work"
                  ? `Trabajo externo · ${a.locationName}`
                  : absenceLabelForViewer(a.absenceType, ABSENCE_TYPE_LABELS, showSensitive)}
              </strong>
              <span className="block p-muted">
                {dateText(a.startDate)} – {dateText(a.endDate)}
                {a.startTime && a.endTime
                  ? ` · ${a.startTime.slice(0, 5)}–${a.endTime.slice(0, 5)}`
                  : ""}
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
