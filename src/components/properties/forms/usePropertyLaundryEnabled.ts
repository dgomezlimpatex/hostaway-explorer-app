import { useClients } from '@/hooks/useClients';

/** Resolve the property override before the inherited client setting. */
export function usePropertyLaundryEnabled(propertySetting: boolean | null | undefined, clientId?: string) {
  const { data: clients, isLoading, isError } = useClients();
  if (propertySetting != null) return propertySetting;
  if (!clientId) return false;
  if (isLoading || isError || !clients) return undefined;
  const client = clients.find(item => item.id === clientId);
  return client ? client.linenControlEnabled ?? false : undefined;
}
