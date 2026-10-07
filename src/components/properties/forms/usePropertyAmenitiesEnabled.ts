import { useClients } from '@/hooks/useClients';

export function usePropertyAmenitiesEnabled(propertySetting: boolean | null | undefined, clientId?: string) {
  const { data: clients, isLoading, isError } = useClients();
  if (propertySetting != null) return propertySetting;
  // Existing properties have always displayed their configured amenities.
  if (!clientId) return true;
  if (isLoading || isError || !clients) return undefined;
  const client = clients.find(item => item.id === clientId);
  return client ? client.amenitiesControlEnabled ?? true : undefined;
}
