
// Types for Client Portal System

export interface ClientPortalAccess {
  id: string;
  clientId: string;
  accessPin: string;
  portalToken: string;
  isActive: boolean;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientReservation {
  id: string;
  clientId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number | null;
  specialRequests: string | null;
  taskId: string | null;
  status: 'active' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
  // Joined data
  property?: {
    id: string;
    nombre: string;
    codigo: string;
    direccion: string;
    checkOutPredeterminado: string;
  };
}

export interface ClientReservationLog {
  id: string;
  reservationId: string | null;
  clientId: string;
  action: 'created' | 'updated' | 'cancelled';
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  createdAt: string;
}

export interface CreateReservationData {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount?: number | null;
  specialRequests?: string | null;
}

export interface PortalSession {
  clientId: string;
  clientName: string;
  portalToken: string;
  authenticatedAt: number;
}
