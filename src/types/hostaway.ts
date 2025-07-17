
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

export interface HostawaySyncLog {
  id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: string;
  reservations_processed: number | null;
  new_reservations: number | null;
  updated_reservations: number | null;
  cancelled_reservations: number | null;
  tasks_created: number | null;
  tasks_deleted?: number | null;
  tasks_modified?: number | null;
  errors: string[] | null;
  tasks_details: TaskDetail[] | null;
  tasks_deleted_details?: TaskDetail[] | null;
  tasks_modified_details?: TaskDetail[] | null;
  reservations_details: ReservationDetail[] | null;
  created_at: string;
}
