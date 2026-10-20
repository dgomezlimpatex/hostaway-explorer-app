// Reglas compartidas por el alta y la ficha de un trabajador. Sin dependencias de
// React ni Supabase para poder comprobarlas con pruebas Node.

export const STANDARD_WORKER_CATEGORIES = ['Operario de limpieza', 'Supervisor', 'Administrador'] as const;

/** Valor del selector para una ficha sin puesto (Radix no admite valor vacío). */
export const NO_CATEGORY = '__sin-puesto__';
export const NO_CATEGORY_LABEL = 'Sin puesto';

export const MAX_WEEKLY_HOURS = 80;

export interface WorkerFormValues {
  name: string;
  email: string;
  telefono: string;
  /** Valor tal cual en la ficha; '' si no tiene puesto. */
  category: string;
  /** AAAA-MM-DD o '' si no hay fecha. */
  startDate: string;
  /** Texto del campo para poder validar «-5», «37,3» o vacío. */
  contractHours: string;
}

export interface WorkerFormSource {
  name: string;
  email?: string | null;
  telefono?: string | null;
  category?: string | null;
  startDate?: string | null;
  contractHoursPerWeek?: number | null;
}

export type WorkerFormErrors = Partial<Record<keyof WorkerFormValues, string>>;

export const workerFormFromSource = (worker: WorkerFormSource): WorkerFormValues => ({
  name: worker.name ?? '',
  email: worker.email ?? '',
  telefono: worker.telefono ?? '',
  category: worker.category ?? '',
  startDate: worker.startDate ?? '',
  contractHours: worker.contractHoursPerWeek == null ? '' : String(worker.contractHoursPerWeek),
});

/** Etiqueta visible del puesto: nunca inventa «Operario de limpieza» para una ficha vacía. */
export const categoryLabel = (category?: string | null): string => category?.trim() || NO_CATEGORY_LABEL;

export const isNonStandardCategory = (category?: string | null): boolean => {
  const value = category?.trim();
  return !!value && !(STANDARD_WORKER_CATEGORIES as readonly string[]).includes(value);
};

/**
 * Opciones del selector: las estándar más el valor actual si viene de REGISTRO u otra
 * fuente con otro nombre, para que guardar no lo sustituya.
 */
export const categoryOptions = (current?: string | null): string[] => {
  const base: string[] = [...STANDARD_WORKER_CATEGORIES];
  return isNonStandardCategory(current) ? [current!.trim(), ...base] : base;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Convierte el texto de horas a número (admite coma decimal). null = vacío. NaN = no numérico. */
export const parseHours = (raw: string): number | null => {
  const text = raw.trim().replace(',', '.');
  if (!text) return null;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
};

export const hoursError = (raw: string): string | undefined => {
  const value = parseHours(raw);
  if (value === null) return undefined; // vacío se guarda como 0, igual que antes
  if (!Number.isFinite(value)) return 'Escribe un número de horas.';
  if (value < 0 || value > MAX_WEEKLY_HOURS) return `Debe estar entre 0 y ${MAX_WEEKLY_HOURS} horas.`;
  if (Math.round(value * 4) !== value * 4) return 'Usa cuartos de hora: ,00 · ,25 · ,50 · ,75.';
  return undefined;
};

export const validateWorkerForm = (values: WorkerFormValues): WorkerFormErrors => {
  const errors: WorkerFormErrors = {};
  if (!values.name.trim()) errors.name = 'El nombre es obligatorio.';
  const email = values.email.trim();
  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Revisa el formato del correo.';
  const hours = hoursError(values.contractHours);
  if (hours) errors.contractHours = hours;
  return errors;
};

export interface WorkerUpdatePayload {
  name?: string;
  email?: string;
  telefono?: string;
  category?: string;
  /** '' borra la fecha (el mapper la guarda como null). */
  startDate?: string;
  contractHoursPerWeek?: number;
}

const hoursValue = (raw: string): number => parseHours(raw) ?? 0;

/**
 * Solo los campos que cambiaron respecto a la ficha. Un puesto sin tocar no se envía
 * y una fecha vaciada se envía explícitamente para poder borrarla.
 */
export const buildWorkerUpdate = (worker: WorkerFormSource, values: WorkerFormValues): WorkerUpdatePayload => {
  const initial = workerFormFromSource(worker);
  const update: WorkerUpdatePayload = {};
  const name = values.name.trim();
  if (name !== initial.name.trim()) update.name = name;
  const email = values.email.trim();
  if (email !== initial.email.trim()) update.email = email;
  const telefono = values.telefono.trim();
  if (telefono !== initial.telefono.trim()) update.telefono = telefono;
  if (values.category !== initial.category) update.category = values.category;
  if (values.startDate !== initial.startDate) update.startDate = values.startDate;
  const hours = hoursValue(values.contractHours);
  if (hours !== (worker.contractHoursPerWeek ?? 0)) update.contractHoursPerWeek = hours;
  return update;
};

export const hasWorkerChanges = (worker: WorkerFormSource, values: WorkerFormValues): boolean =>
  Object.keys(buildWorkerUpdate(worker, values)).length > 0;

// ---------------------------------------------------------------------------
// Posibles duplicados en el alta manual (solo la sede cargada)
// ---------------------------------------------------------------------------

export const normalizePersonName = (value?: string | null): string =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const phoneKey = (value?: string | null): string => {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
};

export interface DuplicateCandidate {
  id: string;
  name: string;
  email?: string | null;
  telefono?: string | null;
  isActive?: boolean;
}

export interface DuplicateMatch {
  id: string;
  name: string;
  isActive?: boolean;
  reasons: Array<'nombre' | 'correo' | 'teléfono'>;
}

export const findPossibleDuplicates = (
  people: DuplicateCandidate[],
  input: { name: string; email?: string; telefono?: string },
): DuplicateMatch[] => {
  const name = normalizePersonName(input.name);
  const email = (input.email ?? '').trim().toLowerCase();
  const phone = phoneKey(input.telefono);
  return people.flatMap((person) => {
    const reasons: DuplicateMatch['reasons'] = [];
    if (name && normalizePersonName(person.name) === name) reasons.push('nombre');
    if (email && (person.email ?? '').trim().toLowerCase() === email) reasons.push('correo');
    if (phone && phoneKey(person.telefono) === phone) reasons.push('teléfono');
    return reasons.length ? [{ id: person.id, name: person.name, isActive: person.isActive, reasons }] : [];
  });
};
