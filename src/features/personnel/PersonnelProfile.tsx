import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, CalendarClock, Mail, Phone } from "lucide-react";
import { useCleaners } from "@/hooks/useCleaners";
import { useAuth } from "@/hooks/useAuth";
import { useWorkerMaintenanceCleanings } from "@/hooks/useWorkerMaintenanceCleanings";
import { AbsenceSummary } from "./PersonnelAbsences";
import { WorkerProfilePanel } from "@/components/workers/WorkerDetailModal";
import { AbsencesTab } from "@/components/workers/absences/AbsencesTab";
import { Cleaner } from "@/types/calendar";
import {
  PersonnelShell,
  PersonnelBack,
  initials,
  usePersonnelParams,
} from "./PersonnelShell";
import {
  calculateHours,
  getPeriod,
  madridNow,
  hoursText,
  dateText,
} from "./hours";
import { usePersonnelData } from "./usePersonnelHours";
import { BalanceBar, BalanceLabel, HoursWorkspace } from "./HoursControl";

export default function PersonnelProfile() {
  const { workerId } = useParams();
  const { cleaners, isLoading } = useCleaners();
  const { params, change } = usePersonnelParams();
  const { userRole } = useAuth();
  const worker = cleaners.find((c) => c.id === workerId),
    tab = params.get("tab") || "summary";
  const canManage = userRole === "admin" || userRole === "manager";
  const back = params.get("back");
  return (
    <PersonnelShell>
      <PersonnelBack to={back?.startsWith("/workers") ? back : "/workers"} />
      {isLoading ? (
        <div className="p-empty">Cargando ficha…</div>
      ) : !worker ? (
        <div className="p-empty">
          No se encuentra este trabajador en la sede seleccionada.
        </div>
      ) : (
        <>
          <div className="personnel-heading">
            <div className="p-profile-heading">
              <span className="p-avatar">{initials(worker.name)}</span>
              <div>
                <h1>{worker.name}</h1>
                <p>
                  {worker.category || "Operario de limpieza"} ·{" "}
                  <span className={`p-tag ${worker.isActive ? "active" : ""}`}>
                    {worker.isActive ? "Activo" : "Inactivo"}
                  </span>{" "}
                  {worker.externalId && <span className="p-tag">REGISTRO</span>}
                </p>
              </div>
            </div>
            <div className="personnel-actions">
              <div className="text-right">
                <span className="p-muted">Jornada de la ficha</span>
                <h2>{hoursText(worker.contractHoursPerWeek ?? 0)} / semana</h2>
              </div>
            </div>
          </div>
          <nav
            className="p-segments p-profile-tabs"
            aria-label="Ficha del trabajador"
          >
            <button
              aria-current={tab === "summary" ? "page" : undefined}
              onClick={() => change("tab", "summary")}
            >
              Resumen
            </button>
            <button
              aria-current={tab === "profile" ? "page" : undefined}
              onClick={() => change("tab", "profile")}
            >
              Ficha
            </button>
            {canManage && (
              <Link to={`/workers/${worker.id}/hours?${params}`}>Horas</Link>
            )}
            {canManage && (
              <button
                aria-current={tab === "tasks" ? "page" : undefined}
                onClick={() => change("tab", "tasks")}
              >
                Tareas
              </button>
            )}
            <button
              aria-current={tab === "availability" ? "page" : undefined}
              onClick={() => change("tab", "availability")}
            >
              Disponibilidad y ausencias
            </button>
          </nav>
          {tab === "profile" ? (
            <div className="p-integrated">
              <WorkerProfilePanel key={worker.id} worker={worker} />
            </div>
          ) : tab === "availability" ? (
            <div className="p-integrated">
              <AbsencesTab cleanerId={worker.id} cleanerName={worker.name} />
            </div>
          ) : tab === "tasks" ? (
            <HoursWorkspace workerId={worker.id} tasksOnly compact />
          ) : (
            <ProfileSummary worker={worker} canManage={canManage} />
          )}
        </>
      )}
    </PersonnelShell>
  );
}
function ProfileSummary({
  worker,
  canManage,
}: {
  worker: Cleaner;
  canManage: boolean;
}) {
  const { data: schedules = [] } = useWorkerMaintenanceCleanings(worker.id);
  const period = getPeriod(madridNow().slice(0, 10), "monthly");
  const query = usePersonnelData(period, worker.id);
  const summary = query.data
    ? calculateHours([worker], query.data, period)[0]
    : null;
  const unavailable = schedules.filter(
    (s) => s.isActive && s.scheduleType === "unavailability",
  );
  return (
    <div className="p-stack">
      <div className="p-detail-grid">
        <section className="p-panel p-content">
          <div className="flex justify-between items-center">
            <h2>Este mes</h2>
            {canManage && (
              <Link className="p-link" to={`/workers/${worker.id}/hours`}>
                Ver control completo{" "}
                <ArrowUpRight size={14} className="inline" />
              </Link>
            )}
          </div>
          {!canManage ? (
            <p className="p-muted mt-4">
              Consulta la ficha y la disponibilidad desde las pestañas.
            </p>
          ) : query.error ? (
            <p className="p-notice p-error mt-4" role="alert">
              No se pudieron consultar las horas.{" "}
              <button onClick={() => query.refetch()}>Reintentar</button>
            </p>
          ) : !summary ? (
            <p className="p-empty">Consultando horas…</p>
          ) : (
            <>
              <div className="p-summary mt-4 mb-0">
                <div className="py-4">
                  <span className="p-muted">Transcurridas*</span>
                  <h2>{hoursText(summary.elapsed)}</h2>
                </div>
                <div className="py-4">
                  <span className="p-muted">Futuras</span>
                  <h2>{hoursText(summary.future)}</h2>
                </div>
                <div className="py-4">
                  <span className="p-muted">Total previsto</span>
                  <h2>{hoursText(summary.total)}</h2>
                </div>
                <div className="py-4">
                  <span className="p-muted">Objetivo</span>
                  <h2>{hoursText(summary.target)}</h2>
                </div>
              </div>
              <BalanceBar summary={summary} />
              <BalanceLabel s={summary} />
              <p className="p-footnote">
                * Según horario asignado.{" "}
                {summary.reference
                  ? "Objetivo de referencia; el historial comienza este mes."
                  : ""}
              </p>
            </>
          )}
        </section>
        <section className="p-panel p-content">
          <h2>Contacto y acceso</h2>
          <dl className="p-contact">
            <dt>
              <Mail size={14} className="inline mr-2" />
              Correo
            </dt>
            <dd>
              {worker.email ? (
                <a href={`mailto:${worker.email}`}>{worker.email}</a>
              ) : (
                "Sin correo"
              )}
            </dd>
            <dt>
              <Phone size={14} className="inline mr-2" />
              Teléfono
            </dt>
            <dd>
              {worker.telefono ? (
                <a href={`tel:${worker.telefono}`}>{worker.telefono}</a>
              ) : (
                "Sin teléfono"
              )}
            </dd>
            <dt>Acceso</dt>
            <dd>
              {worker.user_id ? "Usuario vinculado" : "Sin usuario vinculado"}
            </dd>
            <dt>Alta</dt>
            <dd>
              {worker.startDate ? dateText(worker.startDate) : "Sin fecha"}
            </dd>
          </dl>
        </section>
      </div>
      <div className="p-detail-grid">
        <section className="p-panel">
          <div className="p-panel-head">
            <h2>
              <CalendarClock size={18} className="inline mr-2" />
              Disponibilidad semanal
            </h2>
            <Link
              className="p-link"
              to={`/workers/${worker.id}?tab=availability`}
            >
              Gestionar
            </Link>
          </div>
          <div className="p-content">
            {unavailable.length ? (
              unavailable.map((s) => (
                <div
                  className="py-3 border-b last:border-0 flex justify-between gap-4"
                  key={s.id}
                >
                  <span>
                    {s.locationName}
                    <small className="block p-muted">
                      {[1, 2, 3, 4, 5, 6, 0]
                        .filter((d) => s.daysOfWeek.includes(d))
                        .map(
                          (d) =>
                            ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][
                              d
                            ],
                        )
                        .join(" · ")}
                    </small>
                  </span>
                  <span>
                    {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-muted">
                No hay franjas de no disponibilidad registradas. Consulta
                también días libres y ausencias.
              </p>
            )}
            <p className="p-footnote">
              Estas franjas no suman horas de trabajo.
            </p>
          </div>
        </section>
        <AbsenceSummary
          workerId={worker.id}
          from={period.from}
          to={period.to}
        />
      </div>
    </div>
  );
}
