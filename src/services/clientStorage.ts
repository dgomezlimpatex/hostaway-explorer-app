
import { Client, CreateClientData } from '@/types/client';

// Simulamos almacenamiento en memoria - iniciamos con array vacío
let clients: Client[] = [];

export const clientStorage = {
  getAll: (): Client[] => {
    return [...clients];
  },

  getById: (id: string): Client | undefined => {
    return clients.find(client => client.id === id);
  },

  create: (clientData: CreateClientData): Client => {
    const newClient: Client = {
      ...clientData,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString().split('T')[0],
      fechaActualizacion: new Date().toISOString().split('T')[0]
    };
    
    clients.push(newClient);
    return newClient;
  },

  update: (id: string, updates: Partial<CreateClientData>): Client | null => {
    const index = clients.findIndex(client => client.id === id);
    if (index === -1) return null;

    clients[index] = {
      ...clients[index],
      ...updates,
      fechaActualizacion: new Date().toISOString().split('T')[0]
    };

    return clients[index];
  },

  delete: (id: string): boolean => {
    const index = clients.findIndex(client => client.id === id);
    if (index === -1) return false;

    clients.splice(index, 1);
    return true;
  }
};
