import type { Task } from '@/types/calendar';

export type SupervisionRouteStatus = 'planned' | 'in_progress' | 'completed';
export type SupervisionStopType = 'apartment' | 'storage';
export type SupervisionStopStatus = 'pending' | 'in_progress' | 'reviewed' | 'needs_rework' | 'skipped';
export type SupervisionReviewType = 'quick' | 'full';
export type SupervisionReviewState = 'reviewed' | 'with_incidents' | 'returned_for_rework' | 'historical';
export type SupervisionReviewResult = 'correct' | 'incorrect';
export type SupervisionIncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type SupervisionIncidentStatus = 'open' | 'in_progress' | 'resolved' | 'archived';

export interface SupervisionRoute {
  id: string;
  sede_id: string;
  route_date: string;
  name: string;
  reviewer_user_id?: string | null;
  status: SupervisionRouteStatus;
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupervisionStop {
  id: string;
  route_id: string;
  sequence: number;
  stop_type: SupervisionStopType;
  property_id?: string | null;
  property_group_id?: string | null;
  task_id?: string | null;
  label: string;
  access_note?: string | null;
  status: SupervisionStopStatus;
  created_at: string;
  updated_at: string;
  task?: Task;
}

export interface SupervisionReview {
  id: string;
  route_id: string;
  route_stop_id: string;
  task_id?: string | null;
  property_id?: string | null;
  property_group_id?: string | null;
  reviewer_user_id?: string | null;
  review_type: SupervisionReviewType;
  state: SupervisionReviewState;
  result: SupervisionReviewResult;
  notes?: string | null;
  rework_reason?: string | null;
  checklist_snapshot: ChecklistSnapshot;
  inventory_snapshot: InventorySnapshot;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemSnapshot {
  id: string;
  category: string;
  label: string;
  checked: boolean;
  note?: string;
}

export interface ChecklistSnapshot {
  version: number;
  templateName: string;
  items: ChecklistItemSnapshot[];
}

export interface InventorySnapshot {
  capacity: number;
  expectedTableware: number;
  manualExpectedTableware?: number | null;
  results: Record<string, 'correct' | 'incorrect'>;
  notes?: string;
}

export interface SupervisionReservationSnapshot {
  id: string;
  route_stop_id: string;
  task_id?: string | null;
  source: string;
  check_in?: string | null;
  check_out?: string | null;
  guests?: number | null;
  captured_at: string;
}

export interface SupervisionIncident {
  id: string;
  sede_id: string;
  route_id: string;
  route_stop_id?: string | null;
  review_id?: string | null;
  task_id?: string | null;
  property_id?: string | null;
  property_group_id?: string | null;
  category: string;
  priority: SupervisionIncidentPriority;
  status: SupervisionIncidentStatus;
  description: string;
  responsible_user_id?: string | null;
  target_date?: string | null;
  repeat_key?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupervisionWorkspaceData {
  routes: SupervisionRoute[];
  stops: SupervisionStop[];
  reviews: SupervisionReview[];
  reservations: SupervisionReservationSnapshot[];
  incidents: SupervisionIncident[];
  storageMode: 'remote' | 'offline';
  warning?: string;
}

export interface SupervisionCandidate {
  task: Task;
  score: number;
  reasons: string[];
}

export interface SupervisionMetrics {
  totalStops: number;
  reviewedStops: number;
  fullReviews: number;
  returnedForRework: number;
  openIncidents: number;
  highPriorityIncidents: number;
  reviewCoverage: number;
  fullReviewCoverage: number;
}
