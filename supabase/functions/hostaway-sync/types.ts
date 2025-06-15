
export interface HostawayReservation {
  id: number;
  listingMapId: number;
  status: string;
  arrivalDate: string;
  departureDate: string;
  reservationDate: string;
  cancellationDate?: string;
  nights: number;
  adults: number;
  guestName: string;
}

export interface SyncStats {
  reservations_processed: number;
  new_reservations: number;
  updated_reservations: number;
  cancelled_reservations: number;
  tasks_created: number;
  errors: string[];
  tasks_details?: TaskDetail[];
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
