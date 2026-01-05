// Tipos para la integración con Avantio Channel Manager

export interface AvantioReservation {
  id: string; // ID único en Avantio
  accommodationId: string; // ID del alojamiento en Avantio
  accommodationName?: string; // Nombre del alojamiento
  status: string; // confirmed, cancelled, pending, etc.
  arrivalDate: string; // YYYY-MM-DD
  departureDate: string; // YYYY-MM-DD
  reservationDate?: string; // Fecha de creación de la reserva
  cancellationDate?: string; // Fecha de cancelación (si aplica)
  nights: number;
  adults: number;
  children?: number;
  guestName: string; // Nombre del huésped (identificador principal)
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

export interface AvantioSyncLog {
  id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: string;
  reservations_processed: number | null;
  new_reservations: number | null;
  updated_reservations: number | null;
  cancelled_reservations: number | null;
  tasks_created: number | null;
  tasks_cancelled: number | null;
  tasks_modified: number | null;
  errors: string[] | null;
  tasks_details: TaskDetail[] | null;
  tasks_cancelled_details: TaskDetail[] | null;
  tasks_modified_details: TaskDetail[] | null;
  reservations_details: ReservationDetail[] | null;
  triggered_by: string | null;
  created_at: string;
}

export interface AvantioSchedule {
  id: string;
  name: string;
  hour: number;
  minute: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AvantioSyncError {
  id: string;
  sync_log_id?: string;
  schedule_id?: string;
  error_type: string;
  error_message: string;
  error_details?: Record<string, any>;
  retry_attempt: number;
  resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface CreateScheduleRequest {
  name: string;
  hour: number;
  minute: number;
  timezone?: string;
  is_active?: boolean;
}

export interface UpdateScheduleRequest {
  name?: string;
  hour?: number;
  minute?: number;
  timezone?: string;
  is_active?: boolean;
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
