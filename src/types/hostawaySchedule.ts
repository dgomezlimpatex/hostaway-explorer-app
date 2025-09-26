export interface HostawaySchedule {
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

export interface HostawaySyncError {
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