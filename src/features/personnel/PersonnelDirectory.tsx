import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ArrowUpDown, ArrowUpRight, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { useCleaners, useUpdateCleanersOrder } from "@/hooks/useCleaners";
import { useSede } from "@/contexts/SedeContext";
import { useWorkerCapabilities } from "@/hooks/useWorkerCapabilities";
import { useAllWorkerAbsencesForDate } from "@/hooks/useWorkerAbsences";
import { useAllWorkerFixedDaysOff } from "@/hooks/useWorkerFixedDaysOff";
import { useAllWorkerMaintenanceCleanings } from "@/hooks/useWorkerMaintenanceCleanings";
import { useAllCleanersAvailability } from "@/hooks/useAllCleanersAvailability";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateWorkerModal } from "@/components/workers/CreateWorkerModal";
import {
  dayStatusFor,
  dayStatusText,
  isUnavailableToday,
  madridTodayKey,
  type DayStatus,
} from "@/components/workers/absences/availabilityStatus";
import { Cleaner } from "@/types/calendar";
import { PersonnelShell, initials, usePersonnelParams } from "./PersonnelShell";
import { hoursText } from "./hours";
import { NO_CATEGORY, NO_CATEGORY_LABEL, categoryLabel } from "./workerForm";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Estado «Hoy» de cada persona: genérico, sin el tipo de ausencia ni notas. */
function useTodayStatus() {
  const today = madridTodayKey();
  const absences = useAllWorkerAbsencesForDate(today);
  const fixedDays = useAllWorkerFixedDaysOff();
  const schedules = useAllWorkerMaintenanceCleanings();
  const weekly = useAllCleanersAvailability();
  const queries = [absences, fixedDays, schedules, weekly];
  const error = queries.some((q) => q.error);
  const loading = queries.some((q) => q.isLoading);
  const statusFor = (id: string): DayStatus | null =>
    error || loading
      ? null
      : dayStatusFor(id, today, {
          absences: absences.data,
          fixedDaysOff: fixedDays.data,
          schedules: schedules.data,
          weekly: weekly.data,
        });
  const retry = () => queries.forEach((q) => q.error && q.refetch());
  return { statusFor, error, loading, retry };
}

export default function PersonnelDirectory() {
  const { cleaners, isLoading: cleanersLoading, error, refetch } = useCleaners();
  const { activeSede, isInitialized, loading: sedeLoading } = useSede();
  const { canManageAccounts, canViewHours, canViewSensitive } = useWorkerCapabilities();
  const { params, change } = usePersonnelParams();
  const [create, setCreate] = useState(false),
    [ordering, setOrdering] = useState(false);
  const today = useTodayStatus();
  // Sin sede la consulta está desactivada (TanStack informa isLoading=false): es carga, no «vacío».
  const sedePending = !isInitialized || sedeLoading;
  const noSede = isInitialized && !sedeLoading && !activeSede;
  const isLoading = cleanersLoading || sedePending;
  const countsKnown = !isLoading && !error && !noSede;
  const status = params.get("status") || "active",
    category = params.get("category") || "",
    registro = params.get("registro") || "",
    todayFilter = params.get("today") || "",
    q = params.get("q") || "";
  const filtered = cleaners.filter(
    (c) =>
      (status === "all" || c.isActive === (status === "active")) &&
      (!category ||
        (category === NO_CATEGORY ? !c.category?.trim() : c.category === category)) &&
      (!registro ||
        (registro === "linked"
          ? !!c.externalId
          : registro === "manual"
            ? !c.externalId
            : !c.user_id)) &&
      (!todayFilter || (() => {
        const s = today.statusFor(c.id);
        return !!s && isUnavailableToday(s);
      })()) &&
      normalize(
        [c.name, c.telefono, c.email, canViewSensitive ? c.dni : ""].join(" "),
      ).includes(normalize(q)),
  );
  const categories = [
    ...new Set(cleaners.map((c) => c.category?.trim()).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const hasWithoutCategory = cleaners.some((c) => !c.category?.trim());
  const active = cleaners.filter((c) => c.isActive).length,
    back = encodeURIComponent(`/workers?${params.toString()}`);
  const count = (value: number) => (countsKnown ? value : "—");
  return (
    <PersonnelShell>
      <div className="personnel-heading">
        <div>
          <h1>Trabajadores</h1>
          <p>Gestión del equipo, jornadas y disponibilidad.</p>
        </div>
        <div className="personnel-actions">
          {canManageAccounts && (
            <>
              <button className="p-button" onClick={() => setOrdering(true)}>
                <ArrowUpDown size={16} aria-hidden="true" />
                Ordenar equipo
              </button>
              <button
                className="p-button primary"
                onClick={() => setCreate(true)}
              >
                <Plus size={17} aria-hidden="true" />
                Nuevo trabajador
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-overview" aria-busy={!countsKnown || undefined}>
        <button
          onClick={() => change("status", "active")}
          aria-pressed={status === "active"}
        >
          <span>Equipo activo</span>
          <strong>
            {count(active)}
            {countsKnown && <span> / {cleaners.length}</span>}
          </strong>
        </button>
        <button
          onClick={() => change("status", "inactive")}
          aria-pressed={status === "inactive"}
        >
          <span>Inactivos · consultar historial</span>
          <strong>{count(cleaners.length - active)}</strong>
        </button>
        <button
          onClick={() =>
            change(
              "registro",
              registro === "without-access" ? "" : "without-access",
              { status: "active" },
            )
          }
          aria-pressed={registro === "without-access"}
        >
          <span>Activos sin acceso</span>
          <strong>
            {count(cleaners.filter((c) => c.isActive && !c.user_id).length)}
          </strong>
        </button>
        <button
          onClick={() =>
            change("today", todayFilter ? "" : "unavailable", { status: "active" })
          }
          aria-pressed={!!todayFilter}
        >
          <span>No disponibles hoy</span>
          <strong>
            {countsKnown && !today.error && !today.loading
              ? cleaners.filter((c) => {
                  const s = c.isActive ? today.statusFor(c.id) : null;
                  return !!s && isUnavailableToday(s);
                }).length
              : "—"}
          </strong>
        </button>
      </div>
      {canViewHours && (
        <p className="p-muted mb-4">
          <Link className="p-link" to="/workers/hours">
            Control de horas del mes <ArrowUpRight size={14} className="inline" />
          </Link>
        </p>
      )}
      <section className="p-panel" aria-label="Directorio de trabajadores">
        <div className="p-toolbar">
          <div className="p-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Buscar trabajador"
              placeholder={canViewSensitive ? "Nombre, teléfono, correo o DNI" : "Nombre, teléfono o correo"}
              value={q}
              onChange={(e) => change("q", e.target.value)}
            />
          </div>
          <select
            aria-label="Estado del trabajador"
            value={status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todo el equipo</option>
          </select>
          <select
            aria-label="Puesto"
            value={category}
            onChange={(e) => change("category", e.target.value)}
          >
            <option value="">Todos los puestos</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {hasWithoutCategory && <option value={NO_CATEGORY}>{NO_CATEGORY_LABEL}</option>}
          </select>
          <select
            aria-label="Vinculación"
            value={registro}
            onChange={(e) => change("registro", e.target.value)}
          >
            <option value="">Todos los registros</option>
            <option value="linked">Vinculado a REGISTRO</option>
            <option value="manual">Alta manual</option>
            <option value="without-access">Sin acceso</option>
          </select>
          <span className="p-muted" aria-live="polite">
            {countsKnown ? `${filtered.length} personas` : ""}
          </span>
        </div>
        {today.error && (
          <p className="p-notice p-error p-form-notice mt-4" role="alert">
            No se pudo consultar la disponibilidad de hoy; la columna «Hoy» queda sin datos.{" "}
            <button className="p-link" onClick={today.retry}>
              Reintentar
            </button>
          </p>
        )}
        {error ? (
          <div className="p-empty" role="alert">
            No se pudo consultar el equipo.{" "}
            <button className="p-link" onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        ) : noSede ? (
          <div className="p-empty">
            No hay una sede seleccionada. Elige una sede para ver su equipo.
          </div>
        ) : isLoading ? (
          <div className="p-empty" role="status">
            Cargando equipo…
          </div>
        ) : !filtered.length ? (
          <div className="p-empty">
            No hay trabajadores con estos filtros.{" "}
            <Link className="p-link" to="/workers?status=all">
              Ver todo el equipo
            </Link>
          </div>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table responsive">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>Puesto</th>
                  <th>Estado</th>
                  <th>Hoy</th>
                  <th>Jornada de ficha</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const day = c.isActive ? today.statusFor(c.id) : null;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="p-person"
                          to={`/workers/${c.id}?back=${back}`}
                        >
                          <span className="p-avatar" aria-hidden="true">{initials(c.name)}</span>
                          <span>
                            <span className="p-person-name">{c.name}</span>
                            <small>
                              {c.externalId
                                ? "Vinculado a REGISTRO"
                                : "Alta manual"}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td data-label="Puesto">{categoryLabel(c.category)}</td>
                      <td data-label="Estado">
                        <span className={`p-tag ${c.isActive ? "active" : ""}`}>
                          {c.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td data-label="Hoy">
                        <TodayCell status={day} active={c.isActive} />
                      </td>
                      <td data-label="Jornada">
                        {hoursText(c.contractHoursPerWeek ?? 0)}
                      </td>
                      <td className="row-actions">
                        {canViewHours && (
                          <Link
                            className="p-button small"
                            to={`/workers/${c.id}/hours?back=${back}`}
                            aria-label={`Ver horas de ${c.name}`}
                          >
                            Horas <ArrowUpRight size={13} aria-hidden="true" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="p-footnote">
        La jornada se toma de la ficha de cada trabajador. «Hoy» resume ausencias, días
        libres fijos, horario semanal y franjas no disponibles registradas; no indica
        carga de trabajo.
      </p>
      {canManageAccounts && (
        <>
          <CreateWorkerModal open={create} onOpenChange={setCreate} existingWorkers={cleaners} />
          <Dialog open={ordering} onOpenChange={setOrdering}>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[85dvh] overflow-y-auto overflow-x-hidden">
              <OrderDialogBody workers={cleaners} />
            </DialogContent>
          </Dialog>
        </>
      )}
    </PersonnelShell>
  );
}

function TodayCell({ status, active }: { status: DayStatus | null; active: boolean }) {
  if (!active) return <span className="p-muted">—</span>;
  if (!status) return <span className="p-muted" title="Sin datos de disponibilidad">—</span>;
  const tone =
    status.kind === "available" ? "" : status.kind === "partial_absence" || status.kind === "restricted" ? "partial" : "off";
  return <span className={`p-today ${tone}`}>{dayStatusText(status)}</span>;
}

/** Solo ordena: el estado activo/inactivo se cambia desde la ficha con su diálogo. */
function OrderDialogBody({ workers }: { workers: Cleaner[] }) {
  const update = useUpdateCleanersOrder();
  const isMobile = useIsMobile();
  const [list, setList] = useState(workers);
  const [dragged, setDragged] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  useEffect(() => setList(workers), [workers]);
  const save = (next: Cleaner[], moved: Cleaner, position: number) => {
    setList(next);
    setAnnounce(`${moved.name}: posición ${position + 1} de ${next.length}`);
    update.mutate(next.map((c, sortOrder) => ({ id: c.id, sortOrder })));
  };
  const move = (index: number, direction: number) => {
    const other = index + direction;
    if (other < 0 || other >= list.length) return;
    const next = list.slice();
    [next[index], next[other]] = [next[other], next[index]];
    save(next, list[index], other);
  };
  const drop = (target: number) => {
    if (dragged === null || dragged === target) return setDragged(null);
    const next = list.slice();
    const [item] = next.splice(dragged, 1);
    next.splice(target, 0, item);
    setDragged(null);
    save(next, item, target);
  };
  return (
    <>
      <DialogTitle>Ordenar equipo</DialogTitle>
      <DialogDescription>
        {isMobile
          ? "Usa Subir y Bajar para cambiar el orden en el que aparece el equipo."
          : "Arrastra una fila o usa Subir y Bajar para cambiar el orden en el que aparece el equipo."}{" "}
        Para activar o desactivar a alguien, abre su ficha.
      </DialogDescription>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol className="p-order-list">
        {list.map((worker, index) => (
          <li
            key={worker.id}
            className="p-order-row"
            data-dragging={dragged === index || undefined}
            onDragOver={(e) => !isMobile && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              drop(index);
            }}
          >
            {!isMobile && (
              <span
                className="p-order-handle"
                draggable
                onDragStart={(e) => {
                  setDragged(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => setDragged(null)}
                aria-hidden="true"
                title="Arrastrar para ordenar"
              >
                <GripVertical size={16} />
              </span>
            )}
            <span className="p-order-name">
              {index + 1}. {worker.name}
            </span>
            {!worker.isActive && <span className="p-tag">Inactivo</span>}
            <button
              type="button"
              className="p-button small"
              aria-label={`Subir a ${worker.name}`}
              disabled={index === 0 || update.isPending}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={14} aria-hidden="true" />
              <span className="p-desktop-only">Subir</span>
            </button>
            <button
              type="button"
              className="p-button small"
              aria-label={`Bajar a ${worker.name}`}
              disabled={index === list.length - 1 || update.isPending}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={14} aria-hidden="true" />
              <span className="p-desktop-only">Bajar</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
