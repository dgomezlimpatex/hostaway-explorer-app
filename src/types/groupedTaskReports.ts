export interface GroupedTaskReport {
  task_id: string;
  total_reports: number;
  completed_reports: number;
  in_progress_reports: number;
  pending_reports: number;
  needs_review_reports: number;
  earliest_start_time: string | null;
  latest_end_time: string | null;
  individual_reports: IndividualReportInfo[];
}

export interface IndividualReportInfo {
  id: string;
  cleaner_id: string;
  cleaner_name: string;
  overall_status: 'pending' | 'in_progress' | 'completed' | 'needs_review';
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
}