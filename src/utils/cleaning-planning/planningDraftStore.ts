import type { AssignmentProposal, PlanningAssignmentRole } from '../../types/cleaningPlanning';
import { buildProposalSignature } from './proposalBatchApply';

/**
 * Almacén local de borradores del planificador diario.
 *
 * Solo guarda lo necesario para reconstruir el reparto pendiente (identificadores, operaciones y
 * horarios) y una «línea base» para detectar cambios externos al recuperarlo. Nunca toca tareas
 * reales ni envía comunicaciones: es únicamente almacenamiento del navegador.
 */

export const PLANNING_DRAFT_FORMAT_VERSION = 1;
export const PLANNING_DRAFT_KEY_PREFIX = 'limpatex:planning-draft:';
/** Un borrador no se conserva indefinidamente: pasado este tiempo sin cambios se limpia. */
export const PLANNING_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RECORD_CHARS = 400_000;
const MAX_PROPOSALS = 2_000;
const MAX_TEXTS = 8;
const MAX_TEXT_LENGTH = 240;

export interface DraftStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export interface DraftIdentity {
  userId: string;
  sedeId: string;
  startDate: string;
  endDate: string;
}

export interface StoredDraftProposal {
  operation?: 'unassign';
  taskId: string;
  cleanerId: string;
  propertyGroupId?: string;
  propertyGroupName?: string;
  bundleId?: string;
  assignmentRole?: PlanningAssignmentRole;
  durationMinutes: number;
  proposedStartTime?: string;
  proposedEndTime?: string;
  requiredCleaners?: number;
  assignmentIndex?: number;
  confidence: number;
  reasons: string[];
  warnings: string[];
  manualOverrideWarnings?: string[];
  capacityAfterAssignment: { assignedMinutes: number; remainingMinutes: number };
}

/** Cómo estaba una tarea cuando se construyó el borrador. */
export interface DraftTaskBaseline {
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  cleanerIds: string[];
  requiredCleaners: number;
  building?: string;
}

export interface DraftBaseline {
  tasks: Record<string, DraftTaskBaseline>;
  /** Huella de disponibilidad por `trabajadora|día`. */
  availability: Record<string, string>;
}

/** Contenido que cambia con la edición; la revisión y la fecha las pone el almacén. */
export interface PlanningDraftContent {
  proposals: StoredDraftProposal[];
  editedTaskIds: string[];
  baseline: DraftBaseline;
}

export interface PlanningDraftRecord extends PlanningDraftContent {
  version: number;
  userId: string;
  sedeId: string;
  startDate: string;
  endDate: string;
  revision: number;
  writerId: string;
  updatedAt: string;
  taskCount: number;
  signature: string;
}

export interface DraftSummary {
  identity: DraftIdentity;
  revision: number;
  updatedAt: string;
  taskCount: number;
}

export type DraftReadResult =
  | { status: 'none' }
  | { status: 'ok'; record: PlanningDraftRecord }
  | { status: 'invalid'; reason: string }
  | { status: 'unsupported'; version: number }
  | { status: 'unavailable' };

export type DraftWriteFailure = 'unavailable' | 'quota' | 'too-large';

export type DraftWriteResult =
  | { status: 'written'; record: PlanningDraftRecord }
  /** Otra pestaña (o una versión más reciente) guardó algo distinto de lo que esta conoce. */
  | { status: 'conflict'; current: PlanningDraftRecord | null }
  | { status: 'unsupported' }
  | { status: 'failed'; reason: DraftWriteFailure };

export type DraftRemoveResult =
  | { status: 'removed' }
  | { status: 'absent' }
  | { status: 'conflict'; current: PlanningDraftRecord }
  | { status: 'failed' };

const encode = (value: string): string => encodeURIComponent(value);

export const draftStorageKey = (identity: DraftIdentity): string => (
  `${PLANNING_DRAFT_KEY_PREFIX}v${PLANNING_DRAFT_FORMAT_VERSION}:${encode(identity.userId)}:${encode(identity.sedeId)}:${identity.startDate}:${identity.endDate}`
);

const userPrefix = (userId: string, sedeId: string): string => (
  `${PLANNING_DRAFT_KEY_PREFIX}v${PLANNING_DRAFT_FORMAT_VERSION}:${encode(userId)}:${encode(sedeId)}:`
);

export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const isText = (value: unknown, max = 120): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const isOptionalText = (value: unknown, max = 120): boolean => value === undefined || (typeof value === 'string' && value.length <= max);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isOptionalTime = (value: unknown): boolean => value === undefined || (typeof value === 'string' && timePattern.test(value));
const clip = (value: string): string => value.slice(0, MAX_TEXT_LENGTH);
const clipList = (values: unknown): string[] => (Array.isArray(values) ? values : [])
  .filter((item): item is string => typeof item === 'string')
  .slice(0, MAX_TEXTS)
  .map(clip);

/** Reduce una propuesta al mínimo: sin nombres de trabajadoras, que se reconstruyen al recuperar. */
export const sanitizeProposal = (proposal: AssignmentProposal): StoredDraftProposal => {
  const stored: StoredDraftProposal = {
    taskId: proposal.taskId,
    cleanerId: proposal.cleanerId,
    durationMinutes: proposal.durationMinutes,
    confidence: proposal.confidence,
    reasons: clipList(proposal.reasons),
    warnings: clipList(proposal.warnings),
    capacityAfterAssignment: {
      assignedMinutes: proposal.capacityAfterAssignment?.assignedMinutes ?? 0,
      remainingMinutes: proposal.capacityAfterAssignment?.remainingMinutes ?? 0,
    },
  };
  if (proposal.operation) stored.operation = proposal.operation;
  if (proposal.propertyGroupId) stored.propertyGroupId = proposal.propertyGroupId;
  if (proposal.propertyGroupName) stored.propertyGroupName = clip(proposal.propertyGroupName);
  if (proposal.bundleId) stored.bundleId = proposal.bundleId;
  if (proposal.assignmentRole) stored.assignmentRole = proposal.assignmentRole;
  if (proposal.proposedStartTime) stored.proposedStartTime = proposal.proposedStartTime;
  if (proposal.proposedEndTime) stored.proposedEndTime = proposal.proposedEndTime;
  if (proposal.requiredCleaners !== undefined) stored.requiredCleaners = proposal.requiredCleaners;
  if (proposal.assignmentIndex !== undefined) stored.assignmentIndex = proposal.assignmentIndex;
  if (proposal.manualOverrideWarnings) stored.manualOverrideWarnings = clipList(proposal.manualOverrideWarnings);
  return stored;
};

export const hydrateProposal = (stored: StoredDraftProposal, cleanerName: (cleanerId: string) => string | undefined): AssignmentProposal => ({
  ...stored,
  reasons: [...stored.reasons],
  warnings: [...stored.warnings],
  capacityAfterAssignment: { ...stored.capacityAfterAssignment },
  cleanerName: stored.operation === 'unassign' ? 'Sin asignar' : cleanerName(stored.cleanerId) || 'Sin nombre',
});

export const countDraftTasks = (proposals: Array<{ taskId: string }>): number => new Set(proposals.map((item) => item.taskId)).size;

/** Lo que el usuario ve del borrador. Dos contenidos iguales no necesitan una escritura nueva. */
export const draftContentFingerprint = (content: Pick<PlanningDraftContent, 'proposals' | 'editedTaskIds'>): string => JSON.stringify({
  proposals: content.proposals,
  editedTaskIds: [...content.editedTaskIds].sort(),
});

const validProposal = (value: unknown): value is StoredDraftProposal => {
  if (!isRecord(value)) return false;
  if (value.operation !== undefined && value.operation !== 'unassign') return false;
  if (!isText(value.taskId) || typeof value.cleanerId !== 'string' || value.cleanerId.length > 120) return false;
  if (value.operation !== 'unassign' && !value.cleanerId) return false;
  if (!isNumber(value.durationMinutes) || !isNumber(value.confidence)) return false;
  if (!isOptionalTime(value.proposedStartTime) || !isOptionalTime(value.proposedEndTime)) return false;
  if (!isOptionalText(value.propertyGroupId) || !isOptionalText(value.propertyGroupName, MAX_TEXT_LENGTH) || !isOptionalText(value.bundleId)) return false;
  if (value.assignmentRole !== undefined && !['primary', 'secondary', 'backup'].includes(value.assignmentRole as string)) return false;
  if (value.requiredCleaners !== undefined && !isNumber(value.requiredCleaners)) return false;
  if (value.assignmentIndex !== undefined && !isNumber(value.assignmentIndex)) return false;
  const lists = [value.reasons, value.warnings, ...(value.manualOverrideWarnings === undefined ? [] : [value.manualOverrideWarnings])];
  if (lists.some((list) => !Array.isArray(list) || list.length > MAX_TEXTS || list.some((item) => typeof item !== 'string'))) return false;
  const capacity = value.capacityAfterAssignment;
  return isRecord(capacity) && isNumber(capacity.assignedMinutes) && isNumber(capacity.remainingMinutes);
};

const validTaskBaseline = (value: unknown): value is DraftTaskBaseline => (
  isRecord(value)
  && typeof value.label === 'string'
  && isText(value.date, 10) && isoDatePattern.test(value.date)
  && typeof value.startTime === 'string' && typeof value.endTime === 'string'
  && typeof value.status === 'string'
  && Array.isArray(value.cleanerIds) && value.cleanerIds.every((id) => typeof id === 'string')
  && isNumber(value.requiredCleaners)
  && isOptionalText(value.building)
);

const validBaseline = (value: unknown): value is DraftBaseline => (
  isRecord(value)
  && isRecord(value.tasks) && Object.values(value.tasks).every(validTaskBaseline)
  && isRecord(value.availability) && Object.values(value.availability).every((item) => typeof item === 'string')
);

type ParsedRecord = { status: 'ok'; record: PlanningDraftRecord } | { status: 'invalid'; reason: string } | { status: 'unsupported'; version: number };

/** Valida un texto leído del almacenamiento y comprueba que pertenece a esta identidad. */
export const parseDraftRecord = (raw: string, identity: DraftIdentity): ParsedRecord => {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { status: 'invalid', reason: 'json' }; }
  if (!isRecord(value)) return { status: 'invalid', reason: 'shape' };
  if (!isNumber(value.version) || !Number.isInteger(value.version) || value.version < 1) return { status: 'invalid', reason: 'legacy-format' };
  if (value.version > PLANNING_DRAFT_FORMAT_VERSION) return { status: 'unsupported', version: value.version };
  if (value.userId !== identity.userId || value.sedeId !== identity.sedeId
    || value.startDate !== identity.startDate || value.endDate !== identity.endDate) return { status: 'invalid', reason: 'identity' };
  if (!isNumber(value.revision) || !Number.isInteger(value.revision) || value.revision < 1) return { status: 'invalid', reason: 'revision' };
  if (typeof value.writerId !== 'string' || typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return { status: 'invalid', reason: 'metadata' };
  if (!Array.isArray(value.proposals) || value.proposals.length > MAX_PROPOSALS || !value.proposals.every(validProposal)) return { status: 'invalid', reason: 'proposals' };
  if (!Array.isArray(value.editedTaskIds) || value.editedTaskIds.length > MAX_PROPOSALS || value.editedTaskIds.some((id) => typeof id !== 'string')) return { status: 'invalid', reason: 'edited' };
  if (!validBaseline(value.baseline)) return { status: 'invalid', reason: 'baseline' };
  const proposals = value.proposals as StoredDraftProposal[];
  return {
    status: 'ok',
    record: {
      version: value.version,
      userId: identity.userId,
      sedeId: identity.sedeId,
      startDate: identity.startDate,
      endDate: identity.endDate,
      revision: value.revision,
      writerId: value.writerId,
      updatedAt: value.updatedAt,
      proposals,
      editedTaskIds: value.editedTaskIds as string[],
      baseline: value.baseline as DraftBaseline,
      taskCount: countDraftTasks(proposals),
      signature: buildProposalSignature(proposals as unknown as AssignmentProposal[]),
    },
  };
};

export const readDraft = (storage: DraftStorage | null, identity: DraftIdentity): DraftReadResult => {
  if (!storage) return { status: 'unavailable' };
  let raw: string | null;
  try { raw = storage.getItem(draftStorageKey(identity)); } catch { return { status: 'unavailable' }; }
  if (raw === null) return { status: 'none' };
  return parseDraftRecord(raw, identity);
};

const isQuotaError = (error: unknown): boolean => {
  const candidate = error as { name?: string; code?: number } | null;
  return candidate?.name === 'QuotaExceededError' || candidate?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || candidate?.code === 22 || candidate?.code === 1014;
};

/**
 * Escribe una revisión nueva solo si lo almacenado sigue siendo la revisión que esta pestaña
 * conoce (`expectedRevision`, o `null` si no esperaba ninguna). Si no, devuelve `conflict` sin tocar nada.
 * Después de escribir vuelve a leer para confirmar que la revisión quedó realmente guardada.
 */
export const writeDraft = (
  storage: DraftStorage | null,
  identity: DraftIdentity,
  content: PlanningDraftContent,
  options: { expectedRevision: number | null; writerId: string; now: number },
): DraftWriteResult => {
  if (!storage) return { status: 'failed', reason: 'unavailable' };
  const current = readDraft(storage, identity);
  if (current.status === 'unavailable') return { status: 'failed', reason: 'unavailable' };
  if (current.status === 'unsupported') return { status: 'unsupported' };
  const currentRecord = current.status === 'ok' ? current.record : null;
  if (currentRecord ? currentRecord.revision !== options.expectedRevision : options.expectedRevision !== null) {
    return { status: 'conflict', current: currentRecord };
  }
  const revision = (currentRecord?.revision ?? options.expectedRevision ?? 0) + 1;
  const record = {
    version: PLANNING_DRAFT_FORMAT_VERSION,
    userId: identity.userId,
    sedeId: identity.sedeId,
    startDate: identity.startDate,
    endDate: identity.endDate,
    revision,
    writerId: options.writerId,
    updatedAt: new Date(options.now).toISOString(),
    proposals: content.proposals,
    editedTaskIds: content.editedTaskIds,
    baseline: content.baseline,
  };
  const serialized = JSON.stringify(record);
  if (serialized.length > MAX_RECORD_CHARS) return { status: 'failed', reason: 'too-large' };
  const key = draftStorageKey(identity);
  try {
    storage.setItem(key, serialized);
  } catch (error) {
    return { status: 'failed', reason: isQuotaError(error) ? 'quota' : 'unavailable' };
  }
  const confirmed = readDraft(storage, identity);
  if (confirmed.status === 'ok' && confirmed.record.revision === revision && confirmed.record.writerId === options.writerId) {
    return { status: 'written', record: confirmed.record };
  }
  if (confirmed.status === 'ok') return { status: 'conflict', current: confirmed.record };
  return { status: 'failed', reason: 'unavailable' };
};

/** Quita el borrador solo si es la revisión indicada; un borrador ilegible también se puede quitar. */
export const removeDraft = (
  storage: DraftStorage | null,
  identity: DraftIdentity,
  expectedRevision: number | null,
): DraftRemoveResult => {
  if (!storage) return { status: 'failed' };
  const current = readDraft(storage, identity);
  if (current.status === 'unavailable') return { status: 'failed' };
  if (current.status === 'none') return { status: 'absent' };
  if (current.status === 'unsupported') return { status: 'failed' };
  if (current.status === 'ok' && current.record.revision !== expectedRevision) return { status: 'conflict', current: current.record };
  try {
    storage.removeItem(draftStorageKey(identity));
    return readDraft(storage, identity).status === 'none' ? { status: 'removed' } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
};

const identityFromKey = (key: string, userId: string, sedeId: string): DraftIdentity | null => {
  const prefix = userPrefix(userId, sedeId);
  if (!key.startsWith(prefix)) return null;
  const [startDate, endDate, ...rest] = key.slice(prefix.length).split(':');
  if (rest.length || !isoDatePattern.test(startDate || '') || !isoDatePattern.test(endDate || '')) return null;
  return { userId, sedeId, startDate, endDate };
};

export const summarizeDraft = (record: PlanningDraftRecord): DraftSummary => ({
  identity: { userId: record.userId, sedeId: record.sedeId, startDate: record.startDate, endDate: record.endDate },
  revision: record.revision,
  updatedAt: record.updatedAt,
  taskCount: record.taskCount,
});

/**
 * Borradores del mismo usuario y sede (todos los días). Con `cleanup`, retira los ilegibles o
 * caducados de ESTE usuario; los de otros usuarios y los de versiones futuras no se tocan nunca.
 */
export const listDrafts = (
  storage: DraftStorage | null,
  userId: string,
  sedeId: string,
  options: { now: number; cleanup?: boolean },
): { drafts: DraftSummary[]; cleaned: number } => {
  const drafts: DraftSummary[] = [];
  let cleaned = 0;
  if (!storage) return { drafts, cleaned };
  const keys: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
  } catch { return { drafts, cleaned }; }
  for (const key of keys) {
    const identity = identityFromKey(key, userId, sedeId);
    if (!identity) continue;
    const result = readDraft(storage, identity);
    if (result.status === 'ok') {
      const expired = options.now - Date.parse(result.record.updatedAt) > PLANNING_DRAFT_MAX_AGE_MS;
      if (expired && options.cleanup) {
        try { storage.removeItem(key); cleaned += 1; } catch { /* Se reintenta en la próxima limpieza. */ }
      } else if (!expired) drafts.push(summarizeDraft(result.record));
    } else if (result.status === 'invalid' && options.cleanup) {
      try { storage.removeItem(key); cleaned += 1; } catch { /* Se reintenta en la próxima limpieza. */ }
    }
  }
  drafts.sort((a, b) => a.identity.startDate.localeCompare(b.identity.startDate));
  return { drafts, cleaned };
};
