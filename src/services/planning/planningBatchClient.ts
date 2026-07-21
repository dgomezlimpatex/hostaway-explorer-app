import { supabase } from '@/integrations/supabase/client';

export type PlanningBatchStatus = 'applying' | 'applied' | 'validation_failed' | 'technical_failed';
export type PlanningNotificationPolicy = 'require_all_recipients' | 'best_effort';
export type PlanningJsonValue = string | number | boolean | null | PlanningJsonValue[] | { [key: string]: PlanningJsonValue };

export interface PlanningBatchItem {
  [key: string]: PlanningJsonValue;
}

export interface PlanningBatchApplyRequest {
  batchId: string;
  idempotencyKey: string;
  sedeId: string;
  sourceRunId: string | null;
  sourceRunVersion: number | null;
  notificationPolicy: PlanningNotificationPolicy;
  items: PlanningBatchItem[];
}

export interface PlanningBatchConflict {
  code: string;
  message?: string;
  item_index?: number;
  task_id?: string;
  cleaner_id?: string;
  [key: string]: PlanningJsonValue | undefined;
}

export interface PlanningBatchApplyResult {
  batch_id: string;
  status: PlanningBatchStatus;
  idempotent_replay: boolean;
  applied_task_count: number;
  applied_assignment_count: number;
  notification_event_count: number;
  conflicts: PlanningBatchConflict[];
  code?: string;
}

export interface PlanningBatchRpcArgs {
  _batch_id: string;
  _idempotency_key: string;
  _sede_id: string;
  _source_run_id: string | null;
  _source_run_version: number | null;
  _request_hash: string;
  _notification_policy: PlanningNotificationPolicy;
  _items: PlanningBatchItem[];
}

function comparePostgresJsonbKeys(left: string, right: string): number {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return leftBytes.length - rightBytes.length;
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return 0;
}

/** Reproduce la salida textual estable de jsonb usada por planning_batch_request_hash. */
export function stringifyPostgresJsonb(value: PlanningJsonValue): string {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('El lote contiene un número no finito');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stringifyPostgresJsonb).join(', ')}]`;

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => comparePostgresJsonbKeys(left, right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}: ${stringifyPostgresJsonb(entryValue)}`).join(', ')}}`;
}

function planningBatchHashPayload(request: PlanningBatchApplyRequest): PlanningJsonValue {
  return {
    sede_id: request.sedeId,
    source_run_id: request.sourceRunId,
    source_run_version: request.sourceRunVersion,
    notification_policy: request.notificationPolicy,
    items: request.items,
  };
}

export async function buildPlanningBatchRequestHash(request: PlanningBatchApplyRequest): Promise<string> {
  const bytes = new TextEncoder().encode(stringifyPostgresJsonb(planningBatchHashPayload(request)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createPlanningBatchAttemptIdentity(): Pick<PlanningBatchApplyRequest, 'batchId' | 'idempotencyKey'> {
  const batchId = crypto.randomUUID();
  return { batchId, idempotencyKey: `planning-batch:${batchId}` };
}

export async function buildPlanningBatchRpcArgs(request: PlanningBatchApplyRequest): Promise<PlanningBatchRpcArgs> {
  return {
    _batch_id: request.batchId,
    _idempotency_key: request.idempotencyKey,
    _sede_id: request.sedeId,
    _source_run_id: request.sourceRunId,
    _source_run_version: request.sourceRunVersion,
    _request_hash: await buildPlanningBatchRequestHash(request),
    _notification_policy: request.notificationPolicy,
    _items: request.items,
  };
}

const planningBatchStatuses: readonly PlanningBatchStatus[] = [
  'applying', 'applied', 'validation_failed', 'technical_failed',
];

function isPlanningBatchStatus(value: unknown): value is PlanningBatchStatus {
  return typeof value === 'string'
    && planningBatchStatuses.some((status) => status === value);
}

function isPlanningJsonValue(value: unknown): value is PlanningJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isPlanningJsonValue);
  return typeof value === 'object'
    && Object.values(value).every(isPlanningJsonValue);
}

function isPlanningBatchConflict(value: unknown): value is PlanningBatchConflict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const conflict = value as Record<string, unknown>;
  return typeof conflict.code === 'string'
    && (conflict.message === undefined || typeof conflict.message === 'string')
    && (conflict.item_index === undefined || Number.isInteger(conflict.item_index))
    && (conflict.task_id === undefined || typeof conflict.task_id === 'string')
    && (conflict.cleaner_id === undefined || typeof conflict.cleaner_id === 'string')
    && Object.values(conflict).every((entry) => entry === undefined || isPlanningJsonValue(entry));
}

function requireNonNegativeInteger(result: Record<string, unknown>, field: string): number {
  const value = result[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`La RPC apply_planning_batch devolvió ${field} inválido: se esperaba un entero no negativo`);
  }
  return value;
}

export function parsePlanningBatchResult(value: unknown): PlanningBatchApplyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La RPC apply_planning_batch devolvió un objeto inválido');
  }
  const result = value as Record<string, unknown>;
  if (typeof result.batch_id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.batch_id)) {
    throw new Error('La RPC apply_planning_batch devolvió batch UUID inválido');
  }
  if (!isPlanningBatchStatus(result.status)) {
    throw new Error('La RPC apply_planning_batch devolvió status inválido');
  }
  if (typeof result.idempotent_replay !== 'boolean') {
    throw new Error('La RPC apply_planning_batch devolvió idempotent_replay inválido: se esperaba boolean');
  }
  const appliedTaskCount = requireNonNegativeInteger(result, 'applied_task_count');
  const appliedAssignmentCount = requireNonNegativeInteger(result, 'applied_assignment_count');
  const notificationEventCount = requireNonNegativeInteger(result, 'notification_event_count');
  if (!Array.isArray(result.conflicts) || !result.conflicts.every(isPlanningBatchConflict)) {
    throw new Error('La RPC apply_planning_batch devolvió conflicts inválido: se esperaba un array de conflictos');
  }

  return {
    ...result,
    batch_id: result.batch_id,
    status: result.status,
    idempotent_replay: result.idempotent_replay,
    applied_task_count: appliedTaskCount,
    applied_assignment_count: appliedAssignmentCount,
    notification_event_count: notificationEventCount,
    conflicts: result.conflicts,
  };
}

export async function applyPlanningBatch(request: PlanningBatchApplyRequest): Promise<PlanningBatchApplyResult> {
  const args = await buildPlanningBatchRpcArgs(request);
  const rpcClient = supabase as unknown as {
    rpc(name: 'apply_planning_batch', parameters: PlanningBatchRpcArgs): Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc('apply_planning_batch', {
    _batch_id: args._batch_id,
    _idempotency_key: args._idempotency_key,
    _sede_id: args._sede_id,
    _source_run_id: args._source_run_id,
    _source_run_version: args._source_run_version,
    _request_hash: args._request_hash,
    _notification_policy: args._notification_policy,
    _items: args._items,
  });
  if (error) throw new Error(`No se pudo aplicar el lote de planificación: ${error.message}`);
  return parsePlanningBatchResult(data);
}
