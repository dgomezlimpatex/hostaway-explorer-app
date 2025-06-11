
export interface HostawayReservation {
  id: number;
  listingMapId: number;
  arrivalDate: string;
  departureDate: string;
  reservationDate: string;
  cancellationDate?: string;
  nights: number;
  status: string;
  guestName: string;
  adults: number;
}

export interface HostawayProperty {
  id: number;
  internalName: string;
  listingMapId: number;
}

export interface SyncStats {
  reservations_processed: number;
  new_reservations: number;
  updated_reservations: number;
  cancelled_reservations: number;
  tasks_created: number;
  errors: string[];
}
