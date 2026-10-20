import * as z from 'zod';
import type { Client, CreateClientData } from '@/types/client';
import { CLIENT_SERVICE_LABELS } from './clientPresentation';
import { clientSchema, type ClientFormData } from './forms/ClientFormSchema';

// Reglas puras de la ficha de cliente: validación, permisos de la pantalla,
// duplicados, búsqueda y relación con propiedades. Sin red ni estado.

export const CLIENT_SERVICE_TYPES = Object.keys(CLIENT_SERVICE_LABELS) as Client['tipoServicio'][];
export const CLIENT_PAYMENT_LABELS: Record<Client['metodoPago'], string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  bizum: 'Bizum',
};
const PAYMENT_METHODS = Object.keys(CLIENT_PAYMENT_LABELS) as Client['metodoPago'][];

export type ClientFormValues = ClientFormData;

type TextField = 'nombre' | 'cifNif' | 'telefono' | 'email' | 'direccionFacturacion' | 'codigoPostal' | 'ciudad' | 'supervisor';
const TEXT_FIELDS: TextField[] = ['nombre', 'cifNif', 'telefono', 'email', 'direccionFacturacion', 'codigoPostal', 'ciudad', 'supervisor'];

/** Nombre y datos fiscales: solo administración/gerencia los modifica (supervisión los ve en solo lectura). */
export const FISCAL_FIELDS = ['nombre', 'cifNif', 'direccionFacturacion', 'codigoPostal', 'metodoPago', 'factura'] as const;
/** Datos que se exigen al activar la factura (requisito actual, no se relaja). */
type FiscalRequiredField = 'cifNif' | 'email' | 'direccionFacturacion' | 'codigoPostal' | 'ciudad';
const FISCAL_REQUIRED: FiscalRequiredField[] = ['cifNif', 'email', 'direccionFacturacion', 'codigoPostal', 'ciudad'];
export const isFiscalField = (field: string) => (FISCAL_FIELDS as readonly string[]).includes(field);

const REQUIRED_MESSAGES: Record<TextField, string> = {
  nombre: 'El nombre es obligatorio',
  cifNif: 'El CIF/NIF es obligatorio',
  telefono: 'El teléfono es obligatorio',
  email: 'El email es obligatorio',
  direccionFacturacion: 'La dirección de facturación es obligatoria',
  codigoPostal: 'El código postal es obligatorio',
  ciudad: 'La ciudad es obligatoria',
  supervisor: 'El supervisor es obligatorio',
};

export const FISCAL_FIELD_LABELS: Record<FiscalRequiredField, string> = {
  cifNif: 'CIF/NIF',
  email: 'email',
  direccionFacturacion: 'dirección de facturación',
  codigoPostal: 'código postal',
  ciudad: 'ciudad',
};

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

/** Valores del formulario a partir de la ficha: nunca null, para no romper la validación ni los inputs. */
export function clientToFormValues(client?: Partial<Client> | null): ClientFormValues {
  return {
    nombre: text(client?.nombre),
    cifNif: text(client?.cifNif),
    telefono: text(client?.telefono),
    email: text(client?.email),
    direccionFacturacion: text(client?.direccionFacturacion),
    codigoPostal: text(client?.codigoPostal),
    ciudad: text(client?.ciudad),
    tipoServicio: text(client?.tipoServicio) || (client ? '' : 'limpieza-turistica'),
    metodoPago: text(client?.metodoPago) || (client ? '' : 'transferencia'),
    supervisor: text(client?.supervisor),
    factura: client?.factura === true,
    linenControlEnabled: client?.linenControlEnabled === true,
    amenitiesControlEnabled: client?.amenitiesControlEnabled !== false,
    photosVisibleToClient: client?.photosVisibleToClient === true,
    isActive: client ? client.isActive !== false : true,
  };
}

const EMAIL = z.string().email();
const isEmail = (value: string) => EMAIL.safeParse(value).success;

/**
 * Alta: se conservan los requisitos actuales (todos los datos).
 * Edición: un campo que no se toca no bloquea el guardado; si se modifica, debe cumplir
 * su requisito; al activar la factura se exigen los datos fiscales. Así se puede inactivar
 * o cambiar datos operativos de una ficha incompleta sin inventar datos fiscales.
 */
export function buildClientSchema(mode: 'create' | 'edit', initial?: ClientFormValues) {
  return clientSchema.superRefine((values, ctx) => {
    const changed = (field: keyof ClientFormValues) => mode === 'create' || !initial
      || (typeof values[field] === 'string' ? text(values[field]).trim() !== text(initial[field]).trim() : values[field] !== initial[field]);
    const enablingInvoice = values.factura && (mode === 'create' || !initial || !initial.factura);
    for (const field of TEXT_FIELDS) {
      const value = values[field].trim();
      const required = field === 'nombre' || changed(field) || (enablingInvoice && (FISCAL_REQUIRED as TextField[]).includes(field));
      if (!value && required) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: REQUIRED_MESSAGES[field] });
    }
    const email = values.email.trim();
    if (email && (changed('email') || enablingInvoice) && !isEmail(email)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Escribe un email válido, por ejemplo nombre@empresa.com' });
    if (changed('tipoServicio') && !CLIENT_SERVICE_TYPES.includes(values.tipoServicio as Client['tipoServicio'])) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tipoServicio'], message: 'Elige un tipo de servicio' });
    if (changed('metodoPago') && !PAYMENT_METHODS.includes(values.metodoPago as Client['metodoPago'])) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['metodoPago'], message: 'Elige un método de pago' });
  });
}

/** Datos de facturación que faltan en un cliente que emite factura. */
export function missingBillingData(client: Partial<ClientFormValues> | Partial<Client>): string[] {
  if (!client.factura) return [];
  return FISCAL_REQUIRED.filter(field => !text((client as Record<string, unknown>)[field]).trim()).map(field => FISCAL_FIELD_LABELS[field])
    .concat(text((client as Record<string, unknown>).email).trim() && !isEmail(text((client as Record<string, unknown>).email).trim()) ? ['email válido'] : []);
}

export type ClientCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canEditFiscal: boolean;
  canDelete: boolean;
  canManagePortal: boolean;
};

/**
 * Qué puede hacer cada rol en /clients. Supervisión (cuando su rol tenga acceso) consulta
 * y edita datos operativos; los fiscales son de solo lectura y no ve ni gestiona el portal.
 * Eliminar queda reservado a administración. La protección real está en la base de datos.
 */
export function getClientCapabilities(input: { canCreate: boolean; canEdit: boolean; canDelete: boolean; isAdmin: boolean; isAdminOrManager: boolean }): ClientCapabilities {
  return {
    canCreate: input.canCreate && input.isAdminOrManager,
    canEdit: input.canEdit,
    canEditFiscal: input.canEdit && input.isAdminOrManager,
    canDelete: input.canDelete && input.isAdmin,
    canManagePortal: input.isAdminOrManager,
  };
}

/** Solo los campos cambiados y permitidos, con espacios sobrantes eliminados. */
export function buildClientUpdate(values: ClientFormValues, initial: ClientFormValues, options: { canEditFiscal: boolean }): Partial<CreateClientData> {
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(values) as (keyof ClientFormValues)[]) {
    if (!options.canEditFiscal && isFiscalField(key)) continue;
    const next = typeof values[key] === 'string' ? text(values[key]).trim() : values[key];
    const previous = typeof initial[key] === 'string' ? text(initial[key]).trim() : initial[key];
    if (next !== previous) updates[key] = next;
  }
  return updates as Partial<CreateClientData>;
}

export function formValuesToCreateData(values: ClientFormValues): CreateClientData {
  const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
  return trimmed as unknown as CreateClientData;
}

// ---------- Búsqueda y duplicados ----------

export const normalizeText = (value: unknown) => text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Solo letras y números: 'b-15.000.001' y 'B15000001' coinciden. */
export const compactText = (value: unknown) => normalizeText(value).replace(/[^a-z0-9]/g, '');

export function clientMatchesSearch(client: Client, term: string, extra: readonly unknown[] = []): boolean {
  const normalized = normalizeText(term);
  if (!normalized) return true;
  const compact = compactText(term);
  const values = [client.nombre, client.cifNif, client.telefono, client.email, client.ciudad, client.supervisor, ...extra];
  return values.some(value => normalizeText(value).includes(normalized) || (compact.length >= 3 && compactText(value).includes(compact)));
}

export type DuplicateMatch = { client: Client; reasons: ('nombre' | 'cif')[] };

/** Posibles duplicados en la sede (aviso, nunca bloqueo ni fusión). */
export function findPossibleDuplicates(candidate: { nombre?: string; cifNif?: string }, clients: readonly Client[], excludeId?: string): DuplicateMatch[] {
  const name = normalizeText(candidate.nombre);
  const cif = compactText(candidate.cifNif);
  if (!name && cif.length < 5) return [];
  return clients.flatMap(client => {
    if (client.id === excludeId) return [];
    const reasons: DuplicateMatch['reasons'] = [];
    if (name && normalizeText(client.nombre) === name) reasons.push('nombre');
    if (cif.length >= 5 && compactText(client.cifNif) === cif) reasons.push('cif');
    return reasons.length ? [{ client, reasons }] : [];
  });
}

/** Supervisores ya usados en la sede, sin repetir variantes de mayúsculas o espacios. */
export function supervisorSuggestions(clients: readonly Client[]): string[] {
  const byKey = new Map<string, string>();
  for (const client of clients) {
    const value = text(client.supervisor).trim().replace(/\s+/g, ' ');
    const key = normalizeText(value);
    if (key && !byKey.has(key)) byKey.set(key, value);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

const sortKey = (value: unknown) => text(value).replace(/\s+/g, ' ').trim();
export const sortClientsByName = (clients: readonly Client[]) => [...clients].sort((a, b) => sortKey(a.nombre).localeCompare(sortKey(b.nombre), 'es', { sensitivity: 'base', numeric: true }));

// ---------- Propiedades del cliente ----------

export type ClientPropertyLike = { id: string; nombre: string; codigo?: string | null; clienteId?: string | null; isActive?: boolean | null };

export function summarizeClientProperties<T extends ClientPropertyLike>(properties: readonly T[], clientId: string) {
  const own = properties.filter(property => property.clienteId === clientId)
    .sort((a, b) => text(a.nombre).localeCompare(text(b.nombre), 'es', { numeric: true, sensitivity: 'base' }));
  const inheriting = own.filter(property => property.isActive == null);
  return { properties: own, total: own.length, inheriting, ownState: own.length - inheriting.length };
}

// ---------- Borrado protegido ----------

export const CLIENT_DEPENDENCY_LABELS = {
  properties: 'propiedades',
  tasks: 'tareas (incluido el histórico)',
  recurringTasks: 'tareas recurrentes',
  portalAccess: 'acceso al portal',
  portalAccessLogs: 'registros de acceso al portal',
  reservations: 'reservas del portal',
  reservationLogs: 'registros de reservas',
  incidents: 'incidencias',
  extraordinaryRequests: 'solicitudes extraordinarias',
  pmsMappings: 'vinculaciones con PMS',
  pmsReservations: 'reservas importadas de PMS',
  budgets: 'tarifas o presupuestos',
} as const;
export type ClientDependencyKey = keyof typeof CLIENT_DEPENDENCY_LABELS;
export type ClientDependencyCounts = Partial<Record<ClientDependencyKey, number | null>>;

export type DeletionCheck =
  | { status: 'blocked'; items: { key: ClientDependencyKey; label: string; count: number }[] }
  | { status: 'unknown'; failed: string[] }
  | { status: 'allowed' };

/** Se bloquea con CUALQUIER dependencia; si una comprobación falla, tampoco se permite borrar. */
export function evaluateClientDeletion(counts: ClientDependencyCounts): DeletionCheck {
  const keys = Object.keys(CLIENT_DEPENDENCY_LABELS) as ClientDependencyKey[];
  const items = keys.filter(key => (counts[key] ?? 0) > 0).map(key => ({ key, label: CLIENT_DEPENDENCY_LABELS[key], count: counts[key] as number }));
  if (items.length) return { status: 'blocked', items };
  const failed = keys.filter(key => counts[key] === null || counts[key] === undefined || Number.isNaN(counts[key])).map(key => CLIENT_DEPENDENCY_LABELS[key]);
  if (failed.length) return { status: 'unknown', failed };
  return { status: 'allowed' };
}

/** Confirmación reforzada: hay que escribir el nombre exacto (sin distinguir mayúsculas ni espacios extremos). */
export const deletionConfirmationMatches = (typed: string, name: string) => normalizeText(typed) !== '' && normalizeText(typed) === normalizeText(name);

export class ClientDeletionBlockedError extends Error {
  constructor(public readonly check: Exclude<DeletionCheck, { status: 'allowed' }>) {
    super('Borrado bloqueado: el cliente tiene registros relacionados o no se han podido comprobar.');
    this.name = 'ClientDeletionBlockedError';
  }
}
