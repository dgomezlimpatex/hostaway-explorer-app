export interface TaskAssignment {
  id: string;
  task_id: string;
  cleaner_id: string;
  cleaner_name: string;
  assigned_at: string;
  assigned_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MultipleAssignmentRequest {
  taskId: string;
  cleanerIds: string[];
}