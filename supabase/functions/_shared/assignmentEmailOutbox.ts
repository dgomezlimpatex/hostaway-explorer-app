// Lógica pura de la cola de correos de asignación: qué función de envío llamar,
// con qué cuerpo y cómo interpretar su respuesta. Sin red ni Deno, para probarla.

export interface OutboxEmailTask {
  property: string;
  address: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  workerCount: number;
  type: string;
  notes: string | null;
}

export interface ClaimedOutboxEmail {
  id: string;
  kind: 'assigned' | 'unassigned';
  task_id: string | null;
  recipient_email: string;
  recipient_name: string;
  lease_token: string;
  skip_reason: string | null;
  task: OutboxEmailTask | null;
}

export interface OutboxEmailRequest {
  functionName: 'send-task-assignment-email' | 'send-task-unassignment-email';
  body: Record<string, unknown>;
}

export type OutboxSendOutcome =
  | { outcome: 'sent'; detail: null }
  | { outcome: 'retry'; detail: string };

export function buildOutboxEmailRequest(row: ClaimedOutboxEmail): OutboxEmailRequest {
  if (!row.task || !row.task_id) throw new Error('El correo no tiene tarea asociada');
  const taskData = {
    ...row.task,
    // Los envíos existentes esperan los campos opcionales ausentes, no null.
    notes: row.task.notes ?? undefined,
  };
  const common = {
    taskId: row.task_id,
    cleanerEmail: row.recipient_email,
    cleanerName: row.recipient_name,
    taskData,
  };
  return row.kind === 'assigned'
    ? { functionName: 'send-task-assignment-email', body: common }
    : { functionName: 'send-task-unassignment-email', body: { ...common, reason: 'unassigned' } };
}

export function classifyOutboxSend(
  result: { status: number; body: unknown } | { error: unknown },
): OutboxSendOutcome {
  if ('error' in result) {
    return { outcome: 'retry', detail: `Sin respuesta del envío: ${String(result.error).slice(0, 300)}` };
  }
  const body = (result.body && typeof result.body === 'object' ? result.body : {}) as Record<string, unknown>;
  if (result.status >= 200 && result.status < 300 && body.success !== false && !body.error) {
    return { outcome: 'sent', detail: null };
  }
  const reason = typeof body.error === 'string' ? body.error : `HTTP ${result.status}`;
  return { outcome: 'retry', detail: reason.slice(0, 300) };
}
