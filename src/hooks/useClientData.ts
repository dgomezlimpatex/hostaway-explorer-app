
import { useClients } from './useClients';

export const useClientData = () => {
  const { data: clients = [] } = useClients();

  const getClientName = (clientId: string) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client ? client.nombre : clientId;
  };

  return {
    clients,
    getClientName
  };
};
