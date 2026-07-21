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

function parsePlanningBatchResult(value: unknown): PlanningBatchApplyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La RPC apply_planning_batch devolvió una respuesta inválida');
  }
  const result = value as Record<string, unknown>;
  const validStatuses: PlanningBatchStatus[] = ['applying', 'applied', 'validation_failed', 'technical_failed'];
  if (typeof result.batch_id !== 'string' || !validStatuses.includes(result.status as PlanningBatchStatus)) {
    throw new Error('La RPC apply_planning_batch devolvió un estado inválido');
  }
  return result as unknown as PlanningBatchApplyResult;
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
