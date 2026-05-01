// Types for the Extraordinary Requests system

export interface ExtraordinaryRequestType {
  id: string;
  code: string;
  label: string;
  icon: string | null;
  description: string | null;
  defaultDurationMinutes: number;
  requiresTime: boolean;
  defaultCost: number;
  isActive: boolean;
  sortOrder: number;
  sedeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientExtraordinaryRequest {
  id: string;
  clientId: string;
  propertyId: string;
  reservationId: string | null;
  requestTypeId: string | null;
  requestTypeLabelSnapshot: string;
  serviceDate: string;
  serviceTime: string | null;
  guestName: string | null;
  notes: string | null;
  costSnapshot: number;
  status: 'active' | 'cancelled' | 'completed';
  taskId: string | null;
  sedeId: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  property?: {
    id: string;
    nombre: string;
    codigo: string;
  };
}

export interface CreateExtraordinaryRequestInput {
  clientId: string;
  propertyId: string;
  requestTypeId: string;
  serviceDate: string; // YYYY-MM-DD
  serviceTime?: string | null; // HH:MM
  guestName?: string | null;
  notes?: string | null;
  reservationId?: string | null;
}
