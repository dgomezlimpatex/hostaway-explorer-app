export interface PlanningBatchClientFlags {
  readEnabled: boolean;
  writeEnabled: boolean;
}

type ClientEnvironment = Record<string, string | boolean | undefined>;

function isExplicitlyEnabled(value: string | boolean | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return value?.trim().toLowerCase() === 'true';
}

/**
 * Flags del cliente para el rollout de Planificación Hermes v2.
 * Ambos quedan apagados cuando Vite no inyecta una habilitación explícita.
 */
export function getPlanningBatchClientFlags(
  env: ClientEnvironment = import.meta.env as ClientEnvironment,
): PlanningBatchClientFlags {
  return {
    readEnabled: isExplicitlyEnabled(env.VITE_PLANNING_BATCH_V2_READ_ENABLED),
    writeEnabled: isExplicitlyEnabled(env.VITE_PLANNING_BATCH_V2_WRITE_ENABLED),
  };
}
