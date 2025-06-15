
export interface ChecklistItem {
  id: string;
  task: string;
  required: boolean;
  photo_required: boolean;
  completed?: boolean;
  notes?: string;
  media_urls?: string[];
}

export interface ChecklistCategory {
  id: string;
  category: string;
  items: ChecklistItem[];
}

export interface TaskChecklistTemplate {
  id: string;
  property_type: string;
  template_name: string;
  checklist_items: ChecklistCategory[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskReport {
  id: string;
  task_id: string;
  cleaner_id?: string;
  checklist_template_id?: string;
  checklist_completed: Record<string, any>;
  overall_status: 'pending' | 'in_progress' | 'completed' | 'needs_review';
  start_time?: string;
  end_time?: string;
  notes?: string;
  issues_found: any[];
  created_at: string;
  updated_at: string;
}

export interface TaskMedia {
  id: string;
  task_report_id: string;
  media_type: 'photo' | 'video';
  file_url: string;
  checklist_item_id?: string;
  description?: string;
  timestamp: string;
  file_size?: number;
  created_at: string;
}

export interface CreateTaskReportData {
  task_id: string;
  cleaner_id?: string;
  checklist_template_id?: string;
  checklist_completed?: Record<string, any>;
  overall_status?: 'pending' | 'in_progress' | 'completed' | 'needs_review';
  start_time?: string;
  end_time?: string;
  notes?: string;
  issues_found?: any[];
}
