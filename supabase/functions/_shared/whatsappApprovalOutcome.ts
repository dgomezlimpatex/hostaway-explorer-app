export const TERMINAL_APPROVAL_CALLBACK_OUTCOMES = new Set([
  'invalid',
  'expired',
  'stale',
  'superseded',
  'not_actionable',
  'unauthorized_sender',
  'duplicate',
  'applied',
]);

const REJECTION_OUTCOMES_REQUIRING_DERIVED_EVENT = new Set(['applied', 'duplicate']);

export interface ApprovalCallbackClassification {
  processed: boolean;
  derivedEventId: string | null;
  missingDerivedEvent: boolean;
}

/**
 * Clasifica el resultado durable de un botón sin confundir un rechazo
 * descartado con una decisión aplicada. Solo applied/duplicate de una acción
 * reject necesitan enviar (o reutilizar) la alerta derivada.
 */
export function classifyApprovalCallbackOutcome(
  action: string | null | undefined,
  outcome: string | null | undefined,
  rejectionEventId: string | null | undefined,
): ApprovalCallbackClassification {
  if (!outcome || !TERMINAL_APPROVAL_CALLBACK_OUTCOMES.has(outcome)) {
    return { processed: false, derivedEventId: null, missingDerivedEvent: false };
  }

  const requiresDerivedEvent = action === 'reject'
    && REJECTION_OUTCOMES_REQUIRING_DERIVED_EVENT.has(outcome);
  if (!requiresDerivedEvent) {
    return { processed: true, derivedEventId: null, missingDerivedEvent: false };
  }

  const derivedEventId = rejectionEventId?.trim() || null;
  return derivedEventId
    ? { processed: true, derivedEventId, missingDerivedEvent: false }
    : { processed: false, derivedEventId: null, missingDerivedEvent: true };
}
