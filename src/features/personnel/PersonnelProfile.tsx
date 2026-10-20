import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, CalendarClock, Mail, Phone } from "lucide-react";
import { useCleaners } from "@/hooks/useCleaners";
import { useSede } from "@/contexts/SedeContext";
import {
  ENTITY_DETAIL_TITLE_ATTR,
  focusEntityDetailTitle,
} from "@/components/navigation/useLinkedSelection";
import { useWorkerMaintenanceCleanings } from "@/hooks/useWorkerMaintenanceCleanings";
import { useWorkerFixedDaysOff } from "@/hooks/useWorkerFixedDaysOff";
import { useWorkerCapabilities } from "@/hooks/useWorkerCapabilities";
import { AbsenceSummary } from "./PersonnelAbsences";
import { PersonnelProfileForm } from "./PersonnelProfileForm";
import { PlanningWindowPanel } from "./PlanningWindowPanel";
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
import { categoryLabel } from "./workerForm";
import { pastUncompletedTaskCount } from "./profileSummary";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function PersonnelProfile() {
  const { workerId } = useParams();
  const { cleaners, isLoading: cleanersLoading, error, refetch } = useCleaners();
  const { isInitialized, loading: sedeLoading } = useSede();
  // The cleaners query waits for the sede: do not report "not found" meanwhile.
  const isLoading = cleanersLoading || !isInitialized || sedeLoading;
  const { params } = usePersonnelParams();
  const { canEdit, canViewSensitive, canViewHours } = useWorkerCapabilities();
  const worker = cleaners.find((c) => c.id === workerId),
    tab = params.get("tab") || "summary";
  const back = params.get("back");
  const safeBack = back?.startsWith("/workers") && !back.startsWith("//") ? back : null;
  // Los enlaces internos conservan la vuelta al listado con sus filtros.
  const keep = (query: string) =>
    `${query}${safeBack ? `${query.includes("?") ? "&" : "?"}back=${encodeURIComponent(safeBack)}` : ""}`;
  const workerFound = !isLoading && !error && !!worker;
  useEffect(() => {
    // Opening a profile (from the global search, a link or a reload) moves focus to its title.
    if (workerFound) focusEntityDetailTitle();
  }, [workerFound, workerId]);
  const tabs = [
    { id: "summary", label: "Resumen" },
    { id: "profile", label: "Ficha" },
    ...(canViewHours ? [{ id: "hours", label: "Horas" }] : []),
    ...(canViewHours ? [{ id: "tasks", label: "Tareas" }] : []),
    { id: "availability", label: "Disponibilidad y ausencias", short: "Disponibilidad" },
  ];
  return (
    <PersonnelShell>
      <PersonnelBack to={safeBack ?? "/workers"} />
      {error && !worker ? (
        <div className="p-empty" role="alert">
          No se pudo consultar la ficha. Puede ser un problema de conexión o de permisos.{" "}
          <button className="p-link" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-empty" role="status">
          Cargando ficha…
        </div>
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
                <h1 tabIndex={-1} {...{ [ENTITY_DETAIL_TITLE_ATTR]: "" }}>
                  {worker.name}
                </h1>
                <p>
                  {categoryLabel(worker.category)} ·{" "}
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
            aria-label="Secciones de la ficha"
          >
            {tabs.map((t) => (
              <Link
                key={t.id}
                to={keep(t.id === "hours" ? `/workers/${worker.id}/hours` : `/workers/${worker.id}?tab=${t.id}`)}
                aria-current={tab === t.id ? "page" : undefined}
                replace={t.id !== "hours"}
              >
                {t.short ? (
                  <>
                    <span className="p-desktop-only">{t.label}</span>
                    <span className="p-mobile-only">{t.short}</span>
                  </>
                ) : (
                  t.label
                )}
              </Link>
            ))}
          </nav>
          {tab === "profile" ? (
            <PersonnelProfileForm key={worker.id} worker={worker} />
          ) : tab === "availability" ? (
            <div className="p-integrated">
              <AbsencesTab
                cleanerId={worker.id}
                cleanerName={worker.name}
                canEdit={canEdit}
                showSensitive={canViewSensitive}
              />
            </div>
          ) : tab === "tasks" && canViewHours ? (
            <HoursWorkspace workerId={worker.id} tasksOnly compact />
          ) : (
            <ProfileSummary
              worker={worker}
              canViewHours={canViewHours}
              showSensitive={canViewSensitive}
              keep={keep}
            />
          )}
        </>
      )}
    </PersonnelShell>
  );
}
function ProfileSummary({
  worker,
  canViewHours,
  showSensitive,
  keep,
}: {
  worker: Cleaner;
  canViewHours: boolean;
  showSensitive: boolean;
  keep: (query: string) => string;
}) {
  const schedules = useWorkerMaintenanceCleanings(worker.id);
  const fixedDays = useWorkerFixedDaysOff(worker.id);
  const period = getPeriod(madridNow().slice(0, 10), "monthly");
  const query = usePersonnelData(period, worker.id, { live: false });
  const summary = query.data
    ? calculateHours([worker], query.data, period)[0]
    : null;
  const pastPending = summary ? pastUncompletedTaskCount(summary) : 0;
  const unavailable = (schedules.data ?? []).filter(
    (s) => s.isActive && s.scheduleType === "unavailability",
  );
  const daysOff = WEEK_ORDER.filter((d) =>
    (fixedDays.data ?? []).some((f) => f.isActive && f.dayOfWeek === d),
  );
  const availabilityError = schedules.error || fixedDays.error;
  return (
    <div className="p-stack">
      <div className="p-detail-grid">
        <section className="p-panel p-content">
          <div className="flex justify-between items-center gap-3">
            <h2>Horas asignadas este mes</h2>
            {canViewHours && (
              <Link className="p-link" to={keep(`/workers/${worker.id}/hours`)}>
                Ver control completo{" "}
                <ArrowUpRight size={14} className="inline" />
              </Link>
            )}
          </div>
          {!canViewHours ? (
            <p className="p-muted mt-4">
              Consulta la ficha y la disponibilidad desde las pestañas.
            </p>
          ) : query.error ? (
            <p className="p-notice p-error mt-4" role="alert">
              No se pudieron consultar las horas.{" "}
              <button onClick={() => query.refetch()}>Reintentar</button>
            </p>
          ) : !summary ? (
            <p className="p-empty" role="status">Consultando horas…</p>
          ) : (
            <>
              <div className="p-summary mt-4 mb-0">
                <div className="py-4">
                  <span className="p-muted">Asignadas ya pasadas*</span>
                  <h2>{hoursText(summary.elapsed)}</h2>
                </div>
                <div className="py-4">
                  <span className="p-muted">Asignadas por venir</span>
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
              {pastPending > 0 && (
                <p className="p-notice mt-4">
                  {pastPending === 1
                    ? "1 tarea con horario ya pasado no consta como completada."
                    : `${pastPending} tareas con horario ya pasado no constan como completadas.`}{" "}
                  <Link
                    className="p-link"
                    to={keep(`/workers/${worker.id}?tab=tasks&phase=elapsed&source=task`)}
                  >
                    Revisar tareas
                  </Link>
                </p>
              )}
              <p className="p-footnote">
                * Según el horario asignado en las tareas: no son horas trabajadas ni
                confirmadas.{" "}
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
              <Mail size={14} className="inline mr-2" aria-hidden="true" />
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
              <Phone size={14} className="inline mr-2" aria-hidden="true" />
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
              <CalendarClock size={18} className="inline mr-2" aria-hidden="true" />
              Días libres y franjas no disponibles
            </h2>
            <Link
              className="p-link"
              to={keep(`/workers/${worker.id}?tab=availability`)}
            >
              Ver disponibilidad
            </Link>
          </div>
          <div className="p-content">
            {availabilityError ? (
              <p className="p-notice p-error" role="alert">
                No se pudieron consultar los días libres o las franjas.{" "}
                <button
                  onClick={() => {
                    schedules.refetch();
                    fixedDays.refetch();
                  }}
                >
                  Reintentar
                </button>
              </p>
            ) : schedules.isLoading || fixedDays.isLoading ? (
              <p className="p-muted" role="status">Cargando…</p>
            ) : (
              <>
                {daysOff.length > 0 && (
                  <div className="py-3 border-b flex justify-between gap-4">
                    <span>Día libre fijo</span>
                    <span>
                      {daysOff.length === 1
                        ? `${DAY_LONG[daysOff[0]]} libre`
                        : daysOff.map((d) => DAY_SHORT[d]).join(" · ")}
                    </span>
                  </div>
                )}
                {unavailable.map((s) => (
                  <div
                    className="py-3 border-b last:border-0 flex justify-between gap-4"
                    key={s.id}
                  >
                    <span>
                      {s.locationName || "No disponible"}
                      <small className="block p-muted">
                        {WEEK_ORDER.filter((d) => s.daysOfWeek.includes(d))
                          .map((d) => DAY_SHORT[d])
                          .join(" · ")}
                      </small>
                    </span>
                    <span>
                      {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                    </span>
                  </div>
                ))}
                {!daysOff.length && !unavailable.length && (
                  <p className="p-muted">
                    Sin días libres fijos ni franjas no disponibles registradas.
                  </p>
                )}
              </>
            )}
            <p className="p-footnote">
              Las franjas no disponibles no suman horas de trabajo.
            </p>
          </div>
        </section>
        <AbsenceSummary
          workerId={worker.id}
          from={period.from}
          to={period.to}
          showSensitive={showSensitive}
          link={keep(`/workers/${worker.id}?tab=availability`)}
        />
      </div>
      <PlanningWindowPanel worker={worker} />
    </div>
  );
}
