import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CleanerGroupAssignment, PropertyGroup, PropertyGroupAssignment } from '@/types/propertyGroups';

type PropertyGroupRow = {
  id: string;
  name: string;
  internal_code?: string | null;
  display_name?: string | null;
  zone?: string | null;
  client_name?: string | null;
  supervisor_name?: string | null;
  general_instructions?: string | null;
  difficulty_level?: number | null;
  recommended_capacity?: number | null;
  planning_notes?: string | null;
  description: string | null;
  check_out_time: string;
  check_in_time: string;
  is_active: boolean;
  auto_assign_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type PropertyGroupAssignmentRow = {
  id: string;
  property_group_id: string;
  property_id: string;
  created_at: string;
};

type CleanerGroupAssignmentRow = {
  id: string;
  property_group_id: string;
  cleaner_id: string;
  priority: number;
  role_type?: 'primary' | 'secondary' | 'backup' | 'excluded';
  knowledge_level?: number | null;
  max_tasks_per_day: number;
  max_daily_minutes_override?: number | null;
  estimated_travel_time_minutes: number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export interface CleaningPlanningBuildingData {
  propertyGroups: PropertyGroup[];
  propertyAssignments: PropertyGroupAssignment[];
  cleanerAssignments: CleanerGroupAssignment[];
  excludedCleanerAssignments: CleanerGroupAssignment[];
}

const mapPropertyGroup = (row: PropertyGroupRow): PropertyGroup => ({
  id: row.id,
  name: row.name,
  internalCode: row.internal_code || undefined,
  displayName: row.display_name || undefined,
  zone: row.zone || undefined,
  clientName: row.client_name || undefined,
  supervisorName: row.supervisor_name || undefined,
  generalInstructions: row.general_instructions || undefined,
  difficultyLevel: row.difficulty_level ?? undefined,
  recommendedCapacity: row.recommended_capacity ?? undefined,
  planningNotes: row.planning_notes || undefined,
  description: row.description || undefined,
  checkOutTime: row.check_out_time,
  checkInTime: row.check_in_time,
  isActive: row.is_active,
  autoAssignEnabled: row.auto_assign_enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPropertyAssignment = (row: PropertyGroupAssignmentRow): PropertyGroupAssignment => ({
  id: row.id,
  propertyGroupId: row.property_group_id,
  propertyId: row.property_id,
  createdAt: row.created_at,
});

const mapCleanerAssignment = (row: CleanerGroupAssignmentRow): CleanerGroupAssignment => ({
  id: row.id,
  propertyGroupId: row.property_group_id,
  cleanerId: row.cleaner_id,
  priority: row.priority,
  roleType: row.role_type,
  knowledgeLevel: row.knowledge_level ?? undefined,
  maxTasksPerDay: row.max_tasks_per_day,
  maxDailyMinutesOverride: row.max_daily_minutes_override ?? undefined,
  estimatedTravelTimeMinutes: row.estimated_travel_time_minutes,
  notes: row.notes || undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useCleaningPlanningBuildingData = () => useQuery({
  queryKey: ['cleaning-planning-building-data'],
  queryFn: async (): Promise<CleaningPlanningBuildingData> => {
    const [groupsResult, propertyAssignmentsResult, cleanerAssignmentsResult, excludedCleanerAssignmentsResult] = await Promise.all([
      supabase.from('property_groups').select('*').eq('is_active', true).order('name'),
      supabase.from('property_group_assignments').select('*'),
      supabase.from('cleaner_group_assignments').select('*').eq('is_active', true).order('priority'),
      supabase.from('cleaner_group_assignments').select('*').eq('role_type', 'excluded').order('priority'),
    ]);

    if (groupsResult.error) throw groupsResult.error;
    if (propertyAssignmentsResult.error) throw propertyAssignmentsResult.error;
    if (cleanerAssignmentsResult.error) throw cleanerAssignmentsResult.error;
    if (excludedCleanerAssignmentsResult.error) throw excludedCleanerAssignmentsResult.error;

    return {
      propertyGroups: ((groupsResult.data || []) as PropertyGroupRow[]).map(mapPropertyGroup),
      propertyAssignments: ((propertyAssignmentsResult.data || []) as PropertyGroupAssignmentRow[]).map(mapPropertyAssignment),
      cleanerAssignments: ((cleanerAssignmentsResult.data || []) as CleanerGroupAssignmentRow[]).map(mapCleanerAssignment),
      excludedCleanerAssignments: ((excludedCleanerAssignmentsResult.data || []) as CleanerGroupAssignmentRow[]).map(mapCleanerAssignment),
    };
  },
  staleTime: 60_000,
});
