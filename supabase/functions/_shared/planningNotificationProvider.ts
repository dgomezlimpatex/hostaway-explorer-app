import {
  shouldReadPlanningProviderCredentials,
  type PlanningBatchServerFlags,
} from './planningBatchFeatureFlags.ts';

export interface PlanningNotificationMessage {
  id: string;
  [key: string]: unknown;
}

export interface PlanningProviderResult {
  outcome: 'accepted' | 'shadowed' | 'failed';
  providerMessageId?: string;
  errorCode?: string;
}

export interface PlanningNotificationProvider<Message extends PlanningNotificationMessage = PlanningNotificationMessage> {
  deliver(message: Message): Promise<PlanningProviderResult>;
}

export interface PlanningProviderDependencies<Credentials, Message extends PlanningNotificationMessage> {
  readCredentials: () => Credentials;
  createLiveProvider: (credentials: Credentials) => PlanningNotificationProvider<Message>;
  testProvider: PlanningNotificationProvider<Message>;
}

const shadowProvider: PlanningNotificationProvider = {
  async deliver() {
    return { outcome: 'shadowed' };
  },
};

/**
 * Selecciona el provider sin tocar credenciales en shadow/test. La lectura de
 * secrets y la creación del cliente de red están confinadas a la rama live.
 */
export function createPlanningNotificationProvider<
  Credentials,
  Message extends PlanningNotificationMessage = PlanningNotificationMessage,
>(
  flags: PlanningBatchServerFlags,
  dependencies: PlanningProviderDependencies<Credentials, Message>,
): PlanningNotificationProvider<Message> {
  if (flags.providerMode === 'test') return dependencies.testProvider;
  if (flags.providerMode !== 'live' || !shouldReadPlanningProviderCredentials(flags)) {
    return shadowProvider as PlanningNotificationProvider<Message>;
  }

  const credentials = dependencies.readCredentials();
  return dependencies.createLiveProvider(credentials);
}
