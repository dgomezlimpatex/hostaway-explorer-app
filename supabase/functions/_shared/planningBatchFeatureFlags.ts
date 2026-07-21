export type PlanningProviderMode = 'shadow' | 'test' | 'live';
export type PlanningEnvironmentReader = (name: string) => string | undefined;

export interface PlanningBatchServerFlags {
  batchDispatchEnabled: boolean;
  transactionalApplyShadow: boolean;
  notificationsLive: boolean;
  whatsAppEnabled: boolean;
  emailEnabled: boolean;
  remindersEnabled: boolean;
  workerV2Enabled: boolean;
  providerMode: PlanningProviderMode;
}

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function resolvePlanningProviderMode(
  rawMode: string | undefined,
  notificationsLive: boolean,
): PlanningProviderMode {
  const normalized = rawMode?.trim().toLowerCase();
  if (normalized === 'test') return 'test';
  if (normalized === 'live' && notificationsLive) return 'live';
  return 'shadow';
}

/**
 * Configuración fail-closed del pipeline v2. Es deliberadamente independiente
 * de los flags legacy para poder desplegar esquema/código sin activar envíos.
 */
export function getPlanningBatchServerFlags(
  readEnv: PlanningEnvironmentReader = (name) => Deno.env.get(name),
): PlanningBatchServerFlags {
  const notificationsLive = isExplicitlyEnabled(readEnv('PLANNING_NOTIFICATIONS_LIVE'));
  return {
    batchDispatchEnabled: isExplicitlyEnabled(readEnv('WHATSAPP_BATCH_DISPATCH_ENABLED')),
    transactionalApplyShadow: isExplicitlyEnabled(readEnv('PLANNING_TRANSACTIONAL_APPLY_SHADOW')),
    notificationsLive,
    whatsAppEnabled: isExplicitlyEnabled(readEnv('PLANNING_WHATSAPP_ENABLED')),
    emailEnabled: isExplicitlyEnabled(readEnv('PLANNING_EMAIL_DISPATCH_ENABLED')),
    remindersEnabled: isExplicitlyEnabled(readEnv('PLANNING_REMINDERS_ENABLED')),
    workerV2Enabled: isExplicitlyEnabled(readEnv('PLANNING_WORKER_V2_ENABLED')),
    providerMode: resolvePlanningProviderMode(readEnv('PLANNING_PROVIDER_MODE'), notificationsLive),
  };
}

/** shadow/test no deben siquiera intentar leer tokens de Meta o Resend. */
export function shouldReadPlanningProviderCredentials(flags: PlanningBatchServerFlags): boolean {
  return flags.providerMode === 'live' && flags.notificationsLive;
}
