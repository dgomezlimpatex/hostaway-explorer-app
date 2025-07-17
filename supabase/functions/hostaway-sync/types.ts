
export interface HostawayReservation {
  id: number;
  listingMapId: number;
  listingName?: string; // NUEVO: para fallback de mapeo por nombre
  status: string;
  arrivalDate: string;
  departureDate: string;
  reservationDate: string;
  cancellationDate?: string;
  nights: number;
  adults: number;
  guestName: string;
}

export interface HostawayProperty {
  id: number;
  name: string;
  internalName: string;
}

export interface SyncStats {
  reservations_processed: number;
  new_reservations: number;
  updated_reservations: number;
  cancelled_reservations: number;
  tasks_created: number;
  tasks_deleted: number;
  tasks_modified: number;
  errors: string[];
  tasks_details?: TaskDetail[];
  tasks_deleted_details?: TaskDetail[];
  tasks_modified_details?: TaskDetail[];
  reservations_details?: ReservationDetail[];
}

export interface TaskDetail {
  reservation_id: number;
  property_name: string;
  task_id: string;
  task_date: string;
  guest_name: string;
  listing_id: number;
  status: string;
  action?: 'created' | 'deleted' | 'modified';
}

export interface ReservationDetail {
  reservation_id: number;
  property_name: string;
  guest_name: string;
  listing_id: number;
  status: string;
  arrival_date: string;
  departure_date: string;
  action: 'created' | 'updated' | 'cancelled';
}
