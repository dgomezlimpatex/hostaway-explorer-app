import { normalizeSpanishPhoneE164 } from '@/utils/phone/normalizePhone';

export type PlanningRecipientPolicy = 'require_all_recipients' | 'best_effort';

export interface PlanningRecipientWorker {
  id: string;
  name: string;
  telefono?: string | null;
  whatsapp_phone_e164?: string | null;
}

interface PlanningRecipientSummary {
  cleanerId: string;
  cleanerName: string;
}

interface ReachableRecipient extends PlanningRecipientSummary {
  routingSource: 'telefono' | 'legacy_fallback';
}

interface UnreachableRecipient extends PlanningRecipientSummary {
  reason: 'worker_not_found' | 'missing_or_invalid_phone';
}

export interface PlanningRecipientPreflightResult {
  policy: PlanningRecipientPolicy;
  requiredRecipientCount: number;
  canCommit: boolean;
  reachable: ReachableRecipient[];
  legacyFallback: ReachableRecipient[];
  unreachable: UnreachableRecipient[];
}

export function evaluatePlanningRecipientPreflight(params: {
  requiredCleanerIds: string[];
  workers: PlanningRecipientWorker[];
  policy: PlanningRecipientPolicy;
}): PlanningRecipientPreflightResult {
  const uniqueIds = [...new Set(params.requiredCleanerIds.filter(Boolean))].sort();
  const workersById = new Map(params.workers.map((worker) => [worker.id, worker]));
  const reachable: ReachableRecipient[] = [];
  const legacyFallback: ReachableRecipient[] = [];
  const unreachable: UnreachableRecipient[] = [];

  for (const cleanerId of uniqueIds) {
    const worker = workersById.get(cleanerId);
    if (!worker) {
      unreachable.push({ cleanerId, cleanerName: 'Trabajadora no encontrada', reason: 'worker_not_found' });
      continue;
    }

    const primary = normalizeSpanishPhoneE164(worker.telefono);
    if (primary) {
      reachable.push({ cleanerId, cleanerName: worker.name, routingSource: 'telefono' });
      continue;
    }

    const fallback = normalizeSpanishPhoneE164(worker.whatsapp_phone_e164);
    if (fallback) {
      const recipient = { cleanerId, cleanerName: worker.name, routingSource: 'legacy_fallback' as const };
      reachable.push(recipient);
      legacyFallback.push(recipient);
      continue;
    }

    unreachable.push({ cleanerId, cleanerName: worker.name, reason: 'missing_or_invalid_phone' });
  }

  return {
    policy: params.policy,
    requiredRecipientCount: uniqueIds.length,
    canCommit: params.policy === 'best_effort' || unreachable.length === 0,
    reachable,
    legacyFallback,
    unreachable,
  };
}
