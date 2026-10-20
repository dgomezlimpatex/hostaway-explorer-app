import { getRolePermissions, type RolePermissions, type ModulePermission } from './rolePermissions';

/**
 * Capacidades compartidas por Calendario, Clientes y Trabajadores. Deciden qué se
 * muestra y qué controles se ofrecen en la interfaz; NO protegen la base de datos.
 * La protección real depende de RLS, grants y funciones del servidor.
 */
export type OperationalModule = 'calendar' | 'clients' | 'workers';

const MANAGEMENT_ROLES = new Set(['admin', 'manager']);

const operational = (): ModulePermission => ({ canView: true, canCreate: false, canEdit: true, canDelete: false });

/**
 * Contrato final de supervisión decidido por Dani (17/10/2026): consulta y edición
 * operativa en Calendario, Clientes y Trabajadores, sin crear, borrar ni administrar.
 * `tasks` queda igual: su canEdit abre planificación, calendario global y edificios.
 *
 * AÚN NO ESTÁ ACTIVO: ROLE_PERMISSIONS.supervisor no cambia hasta proteger en servidor
 * PIN, DNI, tipo médico y notas y comprobar RLS/escrituras en producción. La activación
 * se entrega por la ruta revisada aplicando este contrato en rolePermissions.ts; las
 * pantallas ya leen canEdit y las capacidades de este archivo.
 */
export const SUPERVISOR_OPERATIONAL_CONTRACT: Pick<RolePermissions, OperationalModule> = {
  calendar: operational(),
  clients: operational(),
  workers: operational(),
};

export const isManagementRole = (role: string | null | undefined): boolean =>
  !!role && MANAGEMENT_ROLES.has(role);

/** Edición de datos operativos (reparto, disponibilidad, ficha no sensible). */
export const canEditOperational = (role: string | null | undefined, module: OperationalModule): boolean =>
  getRolePermissions(role)[module]?.canEdit ?? false;

/** PIN, DNI, tipo médico de una ausencia y notas: solo administración y gerencia. */
export const canViewSensitiveWorkerData = isManagementRole;

/** Alta, activar/desactivar, orden del equipo y rol de repartidor. */
export const canManageWorkerAccounts = isManagementRole;

/** Control de horas (las rutas ya excluyen a supervisión). */
export const canViewWorkerHours = isManagementRole;

/** Campos de la ficha que cuentan como edición operativa no sensible. */
export const WORKER_OPERATIONAL_FIELDS = [
  'name',
  'email',
  'telefono',
  'category',
  'startDate',
  'contractHoursPerWeek',
] as const;

export type WorkerOperationalField = (typeof WORKER_OPERATIONAL_FIELDS)[number];

/** Campos que solo gestiona administración: estado de la cuenta. */
export const WORKER_ACCOUNT_FIELDS = ['isActive'] as const;

/**
 * Devuelve los campos de la actualización que el rol puede enviar. Si el rol no
 * tiene edición en Trabajadores no se permite ninguno.
 */
export const allowedWorkerUpdateFields = (role: string | null | undefined): string[] => {
  if (!canEditOperational(role, 'workers')) return [];
  return isManagementRole(role)
    ? [...WORKER_OPERATIONAL_FIELDS, ...WORKER_ACCOUNT_FIELDS]
    : [...WORKER_OPERATIONAL_FIELDS];
};

export const filterWorkerUpdateForRole = <T extends object>(
  role: string | null | undefined,
  updates: T,
): Partial<T> => {
  const allowed = new Set(allowedWorkerUpdateFields(role));
  return Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.has(key))) as Partial<T>;
};

/** Tipos de ausencia cuyo motivo es sensible (salud o asuntos personales). */
export const SENSITIVE_ABSENCE_TYPES = ['sick', 'personal'] as const;

export const isSensitiveAbsenceType = (type: string | null | undefined): boolean =>
  !!type && (SENSITIVE_ABSENCE_TYPES as readonly string[]).includes(type);

/** Etiqueta genérica «Ausencia» para quien no puede ver el motivo. */
export const absenceLabelForViewer = (
  type: string,
  labels: Record<string, string>,
  showSensitive: boolean,
): string => (!showSensitive && isSensitiveAbsenceType(type) ? 'Ausencia' : labels[type] ?? 'Ausencia');

/**
 * Crear o editar una ausencia: requiere edición en Trabajadores; los tipos sensibles
 * quedan reservados a administración y gerencia.
 */
export const canEditAbsenceType = (role: string | null | undefined, type: string | null | undefined): boolean =>
  canEditOperational(role, 'workers') && (isManagementRole(role) || !isSensitiveAbsenceType(type));
