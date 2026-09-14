import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PersonnelBack,
  PersonnelShell,
  initials,
  usePersonnelParams,
} from "./PersonnelShell";
import {
  calculateHours,
  getPeriod,
  madridNow,
  shiftPeriod,
  hoursText,
  periodText,
  dateText,
  downloadCSV,
  HoursSummary,
  HoursLine,
  Period,
  daysBetween,
} from "./hours";
import { usePersonnelData } from "./usePersonnelHours";
import { AbsenceSummary } from "./PersonnelAbsences";
import { AdjustmentManager } from "./PersonnelAdjustments";
import { TaskDetailsModal } from "@/components/modals/TaskDetailsModal";
import { taskStorageService } from "@/services/storage/taskStorage";
import { taskStorageService as taskActions } from "@/services/taskStorage";
import { Task } from "@/types/calendar";

export function BalanceBar({ summary }: { summary: HoursSummary }) {
  const scale = Math.max(
    summary.elapsed + summary.future,
    summary.target || 0,
    1,
  );
  return (
    <div
      className="p-balance"
      role="img"
      aria-label={`${hoursText(summary.elapsed)} transcurridas; ${hoursText(summary.future)} futuras; objetivo ${hoursText(summary.target)}`}
    >
      <div className="p-balance-track">
        <div
          className="p-balance-elapsed"
          style={{ width: `${(summary.elapsed / scale) * 100}%` }}
        />
        <div
          className="p-balance-future"
          style={{ width: `${(summary.future / scale) * 100}%` }}
        />
        {summary.target !== null && summary.target > 0 && (
          <span
            className="p-balance-target"
            style={{
              left: `${Math.min(99.8, (summary.target / scale) * 100)}%`,
            }}
          />
        )}
      </div>
      <div className="p-balance-labels">
        <span>
          <i className="p-dot" />
          {hoursText(summary.elapsed)} transcurridas
        </span>
        <span>
          <i className="p-dot future" />
          {hoursText(summary.future)} futuras
        </span>
        <span>│ Objetivo {hoursText(summary.target)}</span>
      </div>
      {summary.adjustments !== 0 && (
        <p className="p-footnote">
          Ajustes aparte: {hoursText(summary.adjustments)}. Incluidos en el
          total previsto.
        </p>
      )}
    </div>
  );
}
export function BalanceLabel({ s }: { s: HoursSummary }) {
  if (s.target === null)
    return <span className="p-muted">Sin base histórica</span>;
  if (s.target === 0)
    return <span className="p-tag">Sin horas de contrato</span>;
  const balance = s.balance || 0;
  return (
    <span
      className={`p-tag ${balance > 0.005 ? "warning" : balance < -0.005 ? "purple" : "active"}`}
    >
      {Math.abs(balance) < 0.005
        ? "En objetivo"
        : `${balance > 0 ? "Sobran" : "Faltan"} ${hoursText(Math.abs(balance))}`}
    </span>
  );
}
export default function HoursControl() {
  const { workerId } = useParams();
  return (
    <PersonnelShell hours>
      <HoursWorkspace workerId={workerId} />
    </PersonnelShell>
  );
}
export function HoursWorkspace({
  workerId,
  tasksOnly = false,
  compact = false,
}: {
  workerId?: string;
  tasksOnly?: boolean;
  compact?: boolean;
}) {
  const { params, change } = usePersonnelParams();
  const location = useLocation();
  const [now, setNow] = useState(madridNow());
  useEffect(() => {
    const t = setInterval(() => setNow(madridNow()), 30000);
    return () => clearInterval(t);
  }, []);
  const mode = params.get("view") === "weekly" ? "weekly" : "monthly",
    period = getPeriod(params.get("date") || now.slice(0, 10), mode);
  const query = usePersonnelData(period, workerId);
  const summaries = useMemo(
    () =>
      query.data ? calculateHours(query.people, query.data, period, now) : [],
    [query.data, query.people, period, now],
  );
  const summary = summaries[0];
  const [adjusting, setAdjusting] = useState(false);
  const status = params.get("status") || "active",
    filter = params.get("balance") || "all",
    q = params.get("q") || "",
    sort = params.get("sort") || "name";
  const base = summaries.filter(
    (s) =>
      (status === "all" || s.person.isActive === (status === "active")) &&
      s.person.name.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")),
  );
  const match = (s: HoursSummary) =>
    filter === "all" ||
    (filter === "excess" && s.target > 0 && (s.balance || 0) > 0.005) ||
    (filter === "deficit" && (s.balance || 0) < -0.005) ||
    (filter === "zero" && s.target === 0) ||
    (filter === "incomplete" && (s.incomplete || s.issues > 0));
  const rows = base
    .filter(match)
    .sort((a, b) =>
      sort === "name"
        ? a.person.name.localeCompare(b.person.name, "es")
        : sort === "balance"
          ? (b.balance ?? -Infinity) - (a.balance ?? -Infinity)
          : b.total - a.total,
    );
  if (!query.canManage)
    return (
      <div className="p-empty">
        El control de horas está disponible para administración y gerencia.
      </div>
    );
  const back = params.get("back");
  const safeBack =
    back?.startsWith("/workers") && !back.startsWith("//")
      ? back
      : "/workers/hours";
  const exportSummary = () =>
    downloadCSV(`limpatex-horas-${period.from}.csv`, [
      [
        "Trabajador",
        "Contrato semanal actual",
        "Objetivo",
        "Transcurridas según asignación",
        "Futuras",
        "Ajustes",
        "Total previsto",
        "Balance",
        "Calidad",
      ],
      ...rows.map((s) => [
        s.person.name,
        s.person.contractHoursPerWeek ?? 0,
        s.target,
        s.elapsed,
        s.future,
        s.adjustments,
        s.total,
        s.balance,
        s.incomplete
          ? "Histórico incompleto / referencia"
          : "Datos disponibles",
      ]),
    ]);
  return (
    <>
      {!compact && (
        <>
          <PersonnelBack to={workerId ? safeBack : "/workers"}>
            {workerId ? "Volver al listado" : "Volver al equipo"}
          </PersonnelBack>
          <div className="personnel-heading">
            <div>
              {workerId ? (
                <>
                  <div className="p-profile-heading">
                    <span className="p-avatar">
                      {initials(
                        summary?.person.name || query.people[0]?.name || "",
                      )}
                    </span>
                    <div>
                      <h1>
                        {summary?.person.name ||
                          query.people[0]?.name ||
                          "Control individual"}
                      </h1>
                      <p>
                        Horas y actividad ·{" "}
                        {hoursText(query.people[0]?.contractHoursPerWeek ?? 0)}{" "}
                        semanales en ficha
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h1>Control de horas</h1>
                  <p>Lo asignado, lo transcurrido y lo que queda por cubrir.</p>
                </>
              )}
            </div>
            <div className="personnel-actions">
              <button
                className="p-button"
                disabled={!query.data}
                onClick={
                  workerId
                    ? () =>
                        document
                          .getElementById("personnel-detail")
                          ?.scrollIntoView({ behavior: "smooth" })
                    : exportSummary
                }
              >
                <ArrowDownToLine size={16} />
                {workerId ? "Ver desglose" : "Exportar CSV"}
              </button>
              <button
                className="p-button primary"
                onClick={() => setAdjusting(true)}
                disabled={query.isLoading || !query.people.length}
              >
                <Plus size={16} />
                Ajustar horas
              </button>
            </div>
          </div>
          {workerId && (
            <div className="p-segments p-profile-tabs">
              <Link
                to={`/workers/${workerId}?${new URLSearchParams({ ...Object.fromEntries(params), tab: "summary" })}`}
              >
                Resumen
              </Link>
              <Link
                to={`/workers/${workerId}?${new URLSearchParams({ ...Object.fromEntries(params), tab: "profile" })}`}
              >
                Ficha
              </Link>
              <Link
                aria-current="page"
                to={`/workers/${workerId}/hours?${params}`}
              >
                Horas
              </Link>
              <Link
                to={`/workers/${workerId}?${new URLSearchParams({ ...Object.fromEntries(params), tab: "tasks" })}`}
              >
                Tareas
              </Link>
              <Link
                to={`/workers/${workerId}?${new URLSearchParams({ ...Object.fromEntries(params), tab: "availability" })}`}
              >
                Disponibilidad y ausencias
              </Link>
            </div>
          )}
        </>
      )}
      <div className="personnel-heading">
        <div className="personnel-actions">
          <button
            className="p-button small"
            aria-label="Periodo anterior"
            onClick={() => change("date", shiftPeriod(period, -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <h2 className="min-w-[180px]">{periodText(period)}</h2>
          <button
            className="p-button small"
            aria-label="Periodo siguiente"
            onClick={() => change("date", shiftPeriod(period, 1))}
          >
            <ChevronRight size={17} />
          </button>
          <input
            className="p-control"
            type={mode === "monthly" ? "month" : "date"}
            aria-label="Seleccionar periodo"
            value={mode === "monthly" ? period.from.slice(0, 7) : period.from}
            onChange={(e) =>
              e.target.value &&
              change(
                "date",
                mode === "monthly" ? e.target.value + "-01" : e.target.value,
              )
            }
          />
        </div>
        <div className="personnel-actions">
          <button
            className={`p-button small ${mode === "monthly" ? "selected" : ""}`}
            onClick={() => change("view", "monthly")}
          >
            Mes
          </button>
          <button
            className={`p-button small ${mode === "weekly" ? "selected" : ""}`}
            onClick={() => change("view", "weekly")}
          >
            Semana
          </button>
          <button
            className="p-button small"
            onClick={() => change("date", now.slice(0, 10))}
          >
            Hoy
          </button>
          <button
            className="p-button small"
            aria-label="Actualizar horas"
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      {query.error ? (
        <div className="p-notice p-error" role="alert">
          <AlertCircle size={18} />
          <span>
            No se pudieron consultar las horas. No se muestran totales
            parciales.{" "}
            <button className="p-link" onClick={() => query.refetch()}>
              Reintentar
            </button>
          </span>
        </div>
      ) : query.isLoading ? (
        <div className="p-empty" role="status">
          Consultando asignaciones e historial…
        </div>
      ) : !query.people.length ? (
        <div className="p-empty">
          No se encuentra este trabajador en la sede seleccionada.
        </div>
      ) : workerId && summary ? (
        <>
          {!tasksOnly && (
            <>
              <div className="p-panel p-summary">
                {(
                  [
                    ["Trabajadas", "elapsed", summary.elapsed],
                    ["Futuras", "future", summary.future],
                    ["Ajustes", "adjustment", summary.adjustments],
                    ["Total previsto", "all", summary.total],
                  ] as const
                ).map(([label, phase, value]) => (
                  <button
                    key={phase}
                    onClick={() => {
                      change("phase", phase, {
                        source: "all",
                        day: "",
                        taskQ: "",
                        taskStatus: "all",
                      });
                      document
                        .getElementById("personnel-detail")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <span>{label}</span>
                    <strong>{hoursText(value)}</strong>
                    <small>
                      {phase === "elapsed"
                        ? "Según horario asignado"
                        : phase === "all"
                          ? "Incluye ajustes"
                          : "Ver detalle"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="p-panel p-content mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2>Balance del periodo</h2>
                    <p className="p-muted">
                      Objetivo: {hoursText(summary.target)} ·{" "}
                      {mode === "monthly"
                        ? "jornada semanal × 4,345"
                        : "jornada semanal de la ficha"}
                    </p>
                  </div>
                  <BalanceLabel s={summary} />
                </div>
                <BalanceBar summary={summary} />
              </div>
            </>
          )}
          {summary.incomplete && (
            <div className="p-notice">
              <AlertCircle size={17} />
              <span>
                {summary.target === null
                  ? "Sin base contractual histórica para este periodo."
                  : summary.reference
                    ? "Objetivo de referencia: se utiliza la primera jornada registrada para los días anteriores al inicio del historial."
                    : "Historial anterior parcialmente disponible."}{" "}
                Las tareas guardadas se incluyen; los mantenimientos y
                recurrentes anteriores sin evidencia no se inventan.
              </span>
            </div>
          )}
          <HoursDetail
            summary={summary}
            period={period}
            tasksOnly={tasksOnly}
          />
          {!tasksOnly && !compact && (
            <>
              <div className="mt-6">
                <AbsenceSummary
                  workerId={workerId}
                  from={period.from}
                  to={period.to}
                />
              </div>
              <HoursHistory workerId={workerId} now={now} />
              <details className="p-panel p-content mt-6">
                <summary className="p-link cursor-pointer">
                  Cambios de jornada en la ficha
                </summary>
                <div className="p-table-wrap">
                  <table className="p-table">
                    <thead>
                      <tr>
                        <th>Desde</th>
                        <th>Horas semanales</th>
                        <th>Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data?.contracts
                        .filter((v) => v.cleaner_id === workerId)
                        .slice()
                        .reverse()
                        .map((v) => (
                          <tr key={v.id}>
                            <td>{v.effective_date}</td>
                            <td>{hoursText(Number(v.hours_per_week))}</td>
                            <td>
                              {v.is_baseline
                                ? "Inicio del historial"
                                : "Cambio de ficha"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
              <AdjustmentManager
                workerId={workerId}
                period={period}
                adjustments={query.data?.adjustments || []}
                open={adjusting}
                onOpenChange={setAdjusting}
              />
            </>
          )}
        </>
      ) : (
        <>
          <div className="p-overview">
            <button
              aria-pressed={filter === "all"}
              onClick={() => change("balance", "all")}
            >
              <span>Total previsto · {base.length} personas</span>
              <strong>
                {hoursText(base.reduce((n, s) => n + s.total, 0))}
              </strong>
            </button>
            <button
              aria-pressed={filter === "excess"}
              onClick={() => change("balance", "excess")}
            >
              <span>Con exceso de horas</span>
              <strong>
                {
                  base.filter((s) => s.target > 0 && (s.balance || 0) > 0.005)
                    .length
                }
              </strong>
            </button>
            <button
              aria-pressed={filter === "deficit"}
              onClick={() => change("balance", "deficit")}
            >
              <span>Con horas por asignar</span>
              <strong>
                {base.filter((s) => (s.balance || 0) < -0.005).length}
              </strong>
            </button>
            <button
              aria-pressed={filter === "incomplete"}
              onClick={() => change("balance", "incomplete")}
            >
              <span>Datos por revisar</span>
              <strong>
                {base.filter((s) => s.incomplete || s.issues > 0).length}
              </strong>
            </button>
          </div>
          <section className="p-panel">
            <div className="p-toolbar">
              <div className="p-search">
                <Search size={17} />
                <input
                  aria-label="Buscar trabajador"
                  placeholder="Buscar en el equipo"
                  value={q}
                  onChange={(e) => change("q", e.target.value)}
                />
              </div>
              <select
                aria-label="Estado"
                value={status}
                onChange={(e) => change("status", e.target.value)}
              >
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="all">Todo el equipo</option>
              </select>
              <select
                aria-label="Balance de horas"
                value={filter}
                onChange={(e) => change("balance", e.target.value)}
              >
                <option value="all">Todos los balances</option>
                <option value="excess">Exceso de horas</option>
                <option value="deficit">Falta de horas</option>
                <option value="zero">Sin horas de contrato</option>
                <option value="incomplete">Datos incompletos</option>
              </select>
              <select
                aria-label="Ordenar por"
                value={sort}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="name">Nombre</option>
                <option value="balance">Mayor exceso</option>
                <option value="total">Más horas previstas</option>
              </select>
            </div>
            <div className="p-table-wrap">
              <table className="p-table responsive">
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th className="numeric optional">Contrato / sem.</th>
                    <th className="numeric">Objetivo</th>
                    <th className="numeric">Trabajadas*</th>
                    <th className="numeric">Futuras</th>
                    <th className="numeric optional">Ajustes</th>
                    <th className="numeric">Total previsto</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.person.id}>
                      <td>
                        <Link
                          className="p-person"
                          to={`/workers/${s.person.id}/hours?date=${period.from}&view=${mode}&back=${encodeURIComponent(location.pathname + location.search)}`}
                        >
                          <span className="p-avatar">
                            {initials(s.person.name)}
                          </span>
                          <span>
                            <span className="p-person-name">
                              {s.person.name}
                            </span>
                            <small>
                              {s.issues
                                ? `${s.issues} incidencias de duración`
                                : s.reference
                                  ? "Objetivo de referencia"
                                  : s.incomplete
                                    ? "Histórico incompleto"
                                    : "Ver detalle"}{" "}
                              <ArrowUpRight size={11} className="inline" />
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td className="numeric optional">
                        {hoursText(s.person.contractHoursPerWeek ?? 0)}
                      </td>
                      <td className="numeric" data-label="Objetivo">
                        {hoursText(s.target)}
                      </td>
                      <td className="numeric" data-label="Trabajadas*">
                        {hoursText(s.elapsed)}
                      </td>
                      <td className="numeric" data-label="Futuras">
                        {hoursText(s.future)}
                      </td>
                      <td className="numeric optional">
                        {hoursText(s.adjustments)}
                      </td>
                      <td className="numeric" data-label="Total previsto">
                        <strong>{hoursText(s.total)}</strong>
                      </td>
                      <td data-label="Balance">
                        <BalanceLabel s={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="p-empty">
                  No hay trabajadores con estos filtros.
                </div>
              )}
            </div>
          </section>
          <p className="p-footnote">
            * Según horario asignado, aunque la tarea siga pendiente. Objetivo
            mensual: ficha × 4,345. Las franjas no disponibles no suman horas.
          </p>
          <AdjustmentManager
            period={period}
            adjustments={[]}
            open={adjusting}
            onOpenChange={setAdjusting}
          />
        </>
      )}
    </>
  );
}
const sourceLabel = {
  task: "Tarea",
  maintenance: "Mantenimiento",
  recurring: "Recurrente",
  adjustment: "Ajuste",
};
export function HoursDetail({
  summary,
  period,
  tasksOnly = false,
}: {
  summary: HoursSummary;
  period: Period;
  tasksOnly?: boolean;
}) {
  const { params, change } = usePersonnelParams();
  const cache = useQueryClient();
  const phase = params.get("phase") || "all",
    source = params.get("source") || "all",
    day = params.get("day") || "",
    q = params.get("taskQ") || "",
    taskStatus = params.get("taskStatus") || "all",
    distribution = params.get("distribution") || "week";
  const [page, setPage] = useState(1);
  useEffect(
    () => setPage(1),
    [phase, source, day, q, taskStatus, period.from, period.to],
  );
  const [task, setTask] = useState<Task | null>(null),
    [opening, setOpening] = useState(false);
  const rows = summary.lines.filter(
    (l) =>
      (!tasksOnly || l.source !== "adjustment") &&
      (phase === "all" || l.phase === phase) &&
      (source === "all" || l.source === source) &&
      (!day || l.date === day) &&
      (taskStatus === "all" || l.status === taskStatus) &&
      l.label.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es")),
  );
  const openTask = async (line: HoursLine) => {
    setOpening(true);
    try {
      const value = await taskStorageService.getById(line.sourceId);
      if (value) setTask(value);
      else toast.error("Esta tarea ya no está disponible.");
    } catch {
      toast.error("No se pudo abrir la tarea.");
    } finally {
      setOpening(false);
    }
  };
  const refresh = () => {
    cache.invalidateQueries({ queryKey: ["workload"] });
    cache.invalidateQueries({ queryKey: ["tasks"] });
  };
  const weeks = new Map<string, number>();
  for (const l of summary.lines) {
    const week =
      distribution === "day" ? l.date : getPeriod(l.date, "weekly").from;
    weeks.set(week, (weeks.get(week) || 0) + l.minutes / 60);
  }
  const exportRows = () =>
    downloadCSV(`limpatex-detalle-${period.from}.csv`, [
      [
        "Trabajador",
        "Fecha",
        "Tarea / motivo",
        "Tipo",
        "Inicio",
        "Fin",
        "Horas",
        "Cómputo",
        "Estado",
        "Incidencia",
      ],
      ...rows.map((l) => [
        summary.person.name,
        l.date,
        l.label,
        sourceLabel[l.source],
        l.start || "",
        l.end || "",
        l.minutes / 60,
        l.phase === "elapsed"
          ? "Transcurrida según asignación"
          : l.phase === "future"
            ? "Futura"
            : "Ajuste",
        l.status,
        l.issue || "",
      ]),
    ]);
  return (
    <div className="p-stack" id="personnel-detail">
      <section className="p-panel p-content">
        <div className="flex justify-between items-center gap-3">
          <h2>Distribución {distribution === "day" ? "diaria" : "semanal"}</h2>
          <div className="personnel-actions">
            <button
              className={`p-button small ${distribution === "week" ? "selected" : ""}`}
              onClick={() => change("distribution", "week")}
            >
              Semanas
            </button>
            <button
              className={`p-button small ${distribution === "day" ? "selected" : ""}`}
              onClick={() => change("distribution", "day")}
            >
              Días
            </button>
          </div>
        </div>
        <div className="p-week-grid mt-4">
          {[...weeks.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([from, hours]) => (
              <div className="p-week" key={from}>
                <span className="p-muted">
                  {distribution === "week" ? "Semana del " : ""}
                  {dateText(from)}
                </span>
                <strong>{hoursText(hours)}</strong>
              </div>
            ))}
          {!weeks.size && (
            <p className="p-muted">Sin asignaciones registradas.</p>
          )}
        </div>
      </section>
      <section className="p-panel">
        <div className="p-panel-head">
          <div>
            <h2>{tasksOnly ? "Tareas del periodo" : "Detalle del cómputo"}</h2>
            <p className="p-muted">
              {rows.length} movimientos ·{" "}
              {hoursText(rows.reduce((n, l) => n + l.minutes, 0) / 60)}
            </p>
          </div>
          <button className="p-button small" onClick={exportRows}>
            <ArrowDownToLine size={14} />
            Exportar CSV
          </button>
        </div>
        <div className="p-toolbar">
          <input
            className="p-control"
            aria-label="Buscar tarea"
            placeholder="Propiedad o motivo"
            value={q}
            onChange={(e) => change("taskQ", e.target.value)}
          />
          <select
            aria-label="Cómputo"
            value={phase}
            onChange={(e) => change("phase", e.target.value)}
          >
            <option value="all">Todo el cómputo</option>
            <option value="elapsed">Transcurridas</option>
            <option value="future">Futuras / en curso</option>
            {!tasksOnly && <option value="adjustment">Ajustes</option>}
          </select>
          <select
            aria-label="Tipo de tarea"
            value={source}
            onChange={(e) => change("source", e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {Object.entries(sourceLabel)
              .filter(([k]) => !tasksOnly || k !== "adjustment")
              .map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
          </select>
          <select
            aria-label="Estado de tarea"
            value={taskStatus}
            onChange={(e) => change("taskStatus", e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Completadas</option>
            <option value="in-progress">En curso</option>
            <option value="scheduled">Programadas</option>
          </select>
          <select
            aria-label="Día"
            value={day}
            onChange={(e) => change("day", e.target.value)}
          >
            <option value="">Todos los días</option>
            {daysBetween(period.from, period.to).map((d) => (
              <option value={d} key={d}>
                {dateText(d)}
              </option>
            ))}
          </select>
          {(phase !== "all" ||
            source !== "all" ||
            day ||
            q ||
            taskStatus !== "all") && (
            <Link
              className="p-link"
              to={`?${new URLSearchParams([...params.entries()].filter(([k]) => !["phase", "source", "day", "taskQ", "taskStatus"].includes(k)))}`}
            >
              Limpiar
            </Link>
          )}
        </div>
        <div className="p-table-wrap">
          <table className="p-table responsive">
            <thead>
              <tr>
                <th>Tarea / lugar</th>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Tipo</th>
                <th className="numeric">Horas</th>
                <th>Cómputo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 25, page * 25).map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.source === "task" ? (
                      <button
                        className="p-link text-left"
                        disabled={opening}
                        onClick={() => openTask(l)}
                      >
                        {l.label}
                      </button>
                    ) : l.source === "maintenance" ? (
                      <Link
                        to={`/workers/${summary.person.id}?tab=availability`}
                      >
                        {l.label}
                      </Link>
                    ) : l.source === "recurring" ? (
                      <Link to="/recurring-tasks">{l.label}</Link>
                    ) : (
                      l.label
                    )}
                    {l.issue && (
                      <small className="block text-amber-700">{l.issue}</small>
                    )}
                  </td>
                  <td data-label="Fecha">{dateText(l.date)}</td>
                  <td data-label="Horario">
                    {l.start?.slice(0, 5) || "—"}
                    {l.end && ` – ${l.end.slice(0, 5)}`}
                  </td>
                  <td data-label="Tipo">{sourceLabel[l.source]}</td>
                  <td className="numeric" data-label="Horas">
                    {hoursText(l.minutes / 60)}
                  </td>
                  <td data-label="Cómputo">
                    <span
                      className={`p-tag ${l.phase === "future" ? "purple" : ""}`}
                    >
                      {l.inProgress
                        ? "En curso"
                        : l.phase === "elapsed"
                          ? "Transcurrida"
                          : l.phase === "future"
                            ? "Futura"
                            : "Ajuste"}
                    </span>
                  </td>
                  <td data-label="Estado">
                    {l.status === "completed"
                      ? "Completada"
                      : l.status === "pending"
                        ? "Pendiente"
                        : l.status === "scheduled"
                          ? "Programada"
                          : l.status === "in-progress"
                            ? "En curso"
                            : l.source === "adjustment"
                              ? "Registrado"
                              : l.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="p-empty">No hay movimientos con estos filtros.</div>
          )}
        </div>
        {rows.length > 25 && (
          <div className="p-toolbar justify-between">
            <span className="p-muted">
              Página {page} de {Math.ceil(rows.length / 25)} · {rows.length}{" "}
              movimientos
            </span>
            <div className="personnel-actions">
              <button
                className="p-button small"
                disabled={page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                Anterior
              </button>
              <button
                className="p-button small"
                disabled={page * 25 >= rows.length}
                onClick={() => setPage((n) => n + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
      {task && (
        <TaskDetailsModal
          task={task}
          open
          onOpenChange={(open) => {
            if (!open) {
              setTask(null);
              refresh();
            }
          }}
          onUpdateTask={refresh}
          onDeleteTask={async (id) => {
            try {
              await taskActions.deleteTask(id);
              setTask(null);
              refresh();
            } catch {
              toast.error("No se pudo eliminar la tarea.");
            }
          }}
        />
      )}
    </div>
  );
}
function HoursHistory({ workerId, now }: { workerId: string; now: string }) {
  const [year, setYear] = useState("recent");
  const currentYear = Number(now.slice(0, 4));
  const current = getPeriod(now.slice(0, 10), "monthly");
  const from = year === "recent" ? shiftPeriod(current, -11) : `${year}-01-01`,
    to = year === "recent" ? current.to : `${year}-12-31`;
  const query = usePersonnelData({ from, to }, workerId);
  const { change } = usePersonnelParams();
  const months = Array.from({ length: 12 }, (_, i) =>
    getPeriod(shiftPeriod(getPeriod(from, "monthly"), i), "monthly"),
  );
  const entries = query.data
    ? months
        .map((p) => ({
          p,
          s: calculateHours(query.people, query.data!, p, now)[0],
        }))
        .filter((e) => e.s)
        .reverse()
    : [];
  return (
    <section className="p-panel mt-6">
      <div className="p-panel-head">
        <div>
          <h2>Historial de horas</h2>
          <p className="p-muted">
            Cada periodo conserva la jornada registrada entonces.
          </p>
        </div>
        <select
          className="p-control"
          aria-label="Año del historial"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="recent">Últimos 12 meses</option>
          {Array.from({ length: 12 }, (_, i) => currentYear - i).map((y) => (
            <option value={y} key={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {query.error ? (
        <div className="p-empty" role="alert">
          No se pudo cargar el historial.{" "}
          <button className="p-link" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </div>
      ) : query.isLoading ? (
        <div className="p-empty">Consultando historial…</div>
      ) : (
        <div className="p-table-wrap">
          <table className="p-table responsive">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="numeric">Objetivo</th>
                <th className="numeric">Transcurridas</th>
                <th className="numeric">Total previsto</th>
                <th>Balance</th>
                <th>Información disponible</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ p, s }) => (
                <tr key={p.from}>
                  <td>
                    <button
                      className="p-link"
                      onClick={() => {
                        change("date", p.from, { view: "monthly" });
                      }}
                    >
                      {periodText(p)}
                    </button>
                  </td>
                  <td className="numeric" data-label="Objetivo">
                    {hoursText(s.target)}
                  </td>
                  <td className="numeric" data-label="Transcurridas">
                    {hoursText(
                      !s.lines.length && s.incomplete ? null : s.elapsed,
                    )}
                  </td>
                  <td className="numeric" data-label="Total previsto">
                    {hoursText(
                      !s.lines.length && s.incomplete ? null : s.total,
                    )}
                  </td>
                  <td data-label="Balance">
                    <BalanceLabel s={s} />
                  </td>
                  <td className="p-muted" data-label="Información">
                    {s.target === null
                      ? "Sin base contractual histórica"
                      : s.reference
                        ? "Objetivo de referencia"
                        : s.incomplete
                          ? "Histórico parcial"
                          : "Historial registrado"}
                    {!s.lines.length ? " · Sin movimientos guardados" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
