
import { Client, CreateClientData } from '@/types/client';

// Simulamos almacenamiento en memoria
let clients: Client[] = [
  {
    id: '1',
    nombre: 'Hotel Vista Mar',
    cifNif: 'B12345678',
    telefono: '+34 666 123 456',
    email: 'info@hotelvistamar.com',
    direccionFacturacion: 'Calle de la Playa, 123',
    codigoPostal: '28001',
    ciudad: 'Madrid',
    tipoServicio: 'mantenimiento-airbnb',
    metodoPago: 'transferencia',
    supervisor: 'Ana García',
    factura: true,
    fechaCreacion: '2024-01-15',
    fechaActualizacion: '2024-01-15'
  },
  {
    id: '2',
    nombre: 'Apartamentos Sol',
    cifNif: 'A87654321',
    telefono: '+34 677 987 654',
    email: 'contacto@apartamentossol.es',
    direccionFacturacion: 'Avenida del Sol, 45',
    codigoPostal: '08002',
    ciudad: 'Barcelona',
    tipoServicio: 'limpieza-mantenimiento',
    metodoPago: 'bizum',
    supervisor: 'Carlos López',
    factura: false,
    fechaCreacion: '2024-02-01',
    fechaActualizacion: '2024-02-01'
  }
];

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
