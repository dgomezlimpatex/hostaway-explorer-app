import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ArrowUpDown, ArrowUpRight } from "lucide-react";
import { useCleaners, useUpdateCleanersOrder } from "@/hooks/useCleaners";
import { useAuth } from "@/hooks/useAuth";
import { WorkersList } from "@/components/workers/WorkersList";
import { CreateWorkerModal } from "@/components/workers/CreateWorkerModal";
import { PersonnelShell, initials, usePersonnelParams } from "./PersonnelShell";
import { hoursText } from "./hours";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function PersonnelDirectory() {
  const { cleaners, isLoading, error, refetch } = useCleaners();
  const { userRole } = useAuth();
  const canManage = userRole === "admin" || userRole === "manager";
  const { params, change } = usePersonnelParams();
  const [create, setCreate] = useState(false),
    [ordering, setOrdering] = useState(false);
  const status = params.get("status") || "active",
    category = params.get("category") || "",
    registro = params.get("registro") || "",
    q = params.get("q") || "";
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const filtered = cleaners.filter(
    (c) =>
      (status === "all" || c.isActive === (status === "active")) &&
      (!category || c.category === category) &&
      (!registro ||
        (registro === "linked"
          ? !!c.externalId
          : registro === "manual"
            ? !c.externalId
            : !c.user_id)) &&
      normalize([c.name, c.telefono, c.email, c.dni].join(" ")).includes(
        normalize(q),
      ),
  );
  const categories = [
    ...new Set(cleaners.map((c) => c.category).filter(Boolean)),
  ];
  const active = cleaners.filter((c) => c.isActive).length,
    back = encodeURIComponent(`/workers?${params.toString()}`);
  return (
    <PersonnelShell>
      <div className="personnel-heading">
        <div>
          <h1>Trabajadores</h1>
          <p>Gestión del equipo, jornadas y disponibilidad.</p>
        </div>
        <div className="personnel-actions">
          {canManage && (
            <>
              <button className="p-button" onClick={() => setOrdering(true)}>
                <ArrowUpDown size={16} />
                Ordenar equipo
              </button>
              <button
                className="p-button primary"
                onClick={() => setCreate(true)}
              >
                <Plus size={17} />
                Nuevo trabajador
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-overview">
        <button
          onClick={() => change("status", "active")}
          aria-pressed={status === "active"}
        >
          <span>Equipo activo</span>
          <strong>
            {active}
            <span> / {cleaners.length}</span>
          </strong>
        </button>
        <button
          onClick={() => change("status", "inactive")}
          aria-pressed={status === "inactive"}
        >
          <span>Inactivos · consultar historial</span>
          <strong>{cleaners.length - active}</strong>
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
            {cleaners.filter((c) => c.isActive && !c.user_id).length}
          </strong>
        </button>
        {canManage && (
          <Link className="p-content" to="/workers/hours">
            <span className="p-muted">Seguimiento del mes</span>
            <h2 className="mt-2 flex items-center gap-2">
              Control de horas <ArrowUpRight size={18} />
            </h2>
          </Link>
        )}
      </div>
      <section className="p-panel" aria-label="Directorio de trabajadores">
        <div className="p-toolbar">
          <div className="p-search">
            <Search size={17} />
            <input
              aria-label="Buscar trabajador"
              placeholder="Nombre, teléfono, correo o DNI"
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
            aria-label="Categoría"
            value={category}
            onChange={(e) => change("category", e.target.value)}
          >
            <option value="">Todos los puestos</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
          <span className="p-muted">{filtered.length} personas</span>
        </div>
        {error ? (
          <div className="p-empty" role="alert">
            No se pudo consultar el equipo.{" "}
            <button className="p-link" onClick={() => refetch()}>
              Reintentar
            </button>
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
                  <th>Jornada semanal</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="p-person"
                          to={`/workers/${c.id}?back=${back}`}
                        >
                          <span className="p-avatar">{initials(c.name)}</span>
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
                      <td data-label="Puesto">
                        {c.category || "Operario de limpieza"}
                      </td>
                      <td data-label="Estado">
                        <span className={`p-tag ${c.isActive ? "active" : ""}`}>
                          {c.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td data-label="Jornada semanal">
                        {hoursText(c.contractHoursPerWeek ?? 0)}
                      </td>
                      <td className="row-actions">
                        {canManage && (
                          <Link
                            className="p-button small"
                            to={`/workers/${c.id}/hours?back=${back}`}
                          >
                            Ver horas <ArrowUpRight size={13} />
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
        Las horas semanales se toman exclusivamente de la ficha de cada
        trabajador.
      </p>
      <CreateWorkerModal open={create} onOpenChange={setCreate} />
      <Dialog open={ordering} onOpenChange={setOrdering}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-auto">
          <DialogTitle>Ordenar equipo</DialogTitle>
          <DialogDescription>
            Arrastra para cambiar el orden. También puedes activar o desactivar
            trabajadores desde esta lista.
          </DialogDescription>
          <OrderControls />
          <WorkersList
            workers={cleaners}
            isLoading={isLoading}
            onViewWorker={() => {}}
          />
        </DialogContent>
      </Dialog>
    </PersonnelShell>
  );
}

function OrderControls() {
  const { cleaners } = useCleaners();
  const update = useUpdateCleanersOrder();
  const [selected, setSelected] = useState("");
  const index = cleaners.findIndex((c) => c.id === selected);
  const move = (direction: number) => {
    const next = cleaners.slice();
    const other = index + direction;
    if (index < 0 || other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    update.mutate(next.map((c, sortOrder) => ({ id: c.id, sortOrder })));
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        className="border rounded-md p-2 max-w-full"
        aria-label="Trabajador a reordenar"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Ordenar con teclado</option>
        {cleaners.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        className="border rounded-md px-3 py-2"
        disabled={index <= 0 || update.isPending}
        onClick={() => move(-1)}
      >
        Subir
      </button>
      <button
        className="border rounded-md px-3 py-2"
        disabled={index < 0 || index >= cleaners.length - 1 || update.isPending}
        onClick={() => move(1)}
      >
        Bajar
      </button>
    </div>
  );
}
