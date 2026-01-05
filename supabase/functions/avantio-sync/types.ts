// Tipos para la sincronización con Avantio

export interface AvantioReservation {
  id: string;
  accommodationId: string;
  accommodationName?: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  reservationDate?: string;
  cancellationDate?: string;
  nights: number;
  adults: number;
  children?: number;
  guestName: string;
  guestEmail?: string;
  totalAmount?: number;
  currency?: string;
  notes?: string;
}

export interface AvantioProperty {
  id: string;
  name: string;
  internalName?: string;
}

export interface SyncStats {
  reservations_processed: number;
  new_reservations: number;
  updated_reservations: number;
  cancelled_reservations: number;
  tasks_created: number;
  tasks_cancelled: number;
  tasks_modified: number;
  errors: string[];
  tasks_details?: TaskDetail[];
  tasks_cancelled_details?: TaskDetail[];
  tasks_modified_details?: TaskDetail[];
  reservations_details?: ReservationDetail[];
}

export interface TaskDetail {
  reservation_id: string;
  property_name: string;
  task_id: string;
  task_date: string;
  guest_name: string;
  accommodation_id: string;
  status: string;
}

export interface ReservationDetail {
  reservation_id: string;
  property_name: string;
  guest_name: string;
  accommodation_id: string;
  status: string;
  arrival_date: string;
  departure_date: string;
  action: 'created' | 'updated' | 'cancelled';
}
