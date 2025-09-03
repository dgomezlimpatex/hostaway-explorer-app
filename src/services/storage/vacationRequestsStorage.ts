import { supabase } from '@/integrations/supabase/client';
import { VacationRequest } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';

export interface CreateVacationRequestData {
  cleanerId: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  requestType?: 'vacation' | 'sick' | 'personal';
  reason?: string;
  notes?: string;
}

export interface UpdateVacationRequestData extends Partial<CreateVacationRequestData> {
  status?: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNotes?: string;
}

// Database mapping functions
const mapVacationRequestFromDB = (row: any): VacationRequest => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  cleanerId: row.cleaner_id,
  startDate: row.start_date,
  endDate: row.end_date,
  daysRequested: row.days_requested,
  requestType: row.request_type,
  status: row.status,
  reason: row.reason,
  notes: row.notes,
  requestedAt: row.requested_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  reviewNotes: row.review_notes
});

const mapVacationRequestToDB = (request: Partial<CreateVacationRequestData | UpdateVacationRequestData>): any => {
  const updateData: any = {};
  
  if (request.cleanerId !== undefined) updateData.cleaner_id = request.cleanerId;
  if (request.startDate !== undefined) updateData.start_date = request.startDate;
  if (request.endDate !== undefined) updateData.end_date = request.endDate;
  if (request.daysRequested !== undefined) updateData.days_requested = request.daysRequested;
  if (request.requestType !== undefined) updateData.request_type = request.requestType;
  if (request.reason !== undefined) updateData.reason = request.reason;
  if (request.notes !== undefined) updateData.notes = request.notes;
  
  // Update-specific fields
  if ('status' in request && request.status !== undefined) updateData.status = request.status;
  if ('reviewedBy' in request && request.reviewedBy !== undefined) updateData.reviewed_by = request.reviewedBy;
  if ('reviewNotes' in request && request.reviewNotes !== undefined) updateData.review_notes = request.reviewNotes;

  return updateData;
};

interface VacationRequestsStorageConfig {
  tableName: 'vacation_requests';
  mapFromDB: typeof mapVacationRequestFromDB;
  mapToDB: typeof mapVacationRequestToDB;
  enforceSedeFilter: boolean;
}

class VacationRequestsStorageService extends BaseStorageService<VacationRequest, CreateVacationRequestData> {
  constructor() {
    super({
      tableName: 'vacation_requests',
      mapFromDB: mapVacationRequestFromDB,
      mapToDB: mapVacationRequestToDB,
      enforceSedeFilter: false // No direct sede filter, filtered through cleaners
    } as VacationRequestsStorageConfig);
  }

  async getByCleanerId(cleanerId: string): Promise<VacationRequest[]> {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching vacation requests by cleaner:', error);
      throw error;
    }

    return data?.map(mapVacationRequestFromDB) || [];
  }

  async getByStatus(status: 'pending' | 'approved' | 'rejected'): Promise<VacationRequest[]> {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching vacation requests by status:', error);
      throw error;
    }

    return data?.map(mapVacationRequestFromDB) || [];
  }

  async getByDateRange(startDate: string, endDate: string): Promise<VacationRequest[]> {
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching vacation requests by date range:', error);
      throw error;
    }

    return data?.map(mapVacationRequestFromDB) || [];
  }

  async approve(id: string, reviewedBy: string, reviewNotes?: string): Promise<VacationRequest> {
    const { data, error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving vacation request:', error);
      throw error;
    }

    return mapVacationRequestFromDB(data);
  }

  async reject(id: string, reviewedBy: string, reviewNotes?: string): Promise<VacationRequest> {
    const { data, error } = await supabase
      .from('vacation_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting vacation request:', error);
      throw error;
    }

    return mapVacationRequestFromDB(data);
  }

  async getPendingRequests(): Promise<VacationRequest[]> {
    return this.getByStatus('pending');
  }

  async getUpcomingVacations(): Promise<VacationRequest[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('vacation_requests')
      .select('*')
      .eq('status', 'approved')
      .gte('start_date', today)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming vacations:', error);
      throw error;
    }

    return data?.map(mapVacationRequestFromDB) || [];
  }
}

export const vacationRequestsStorage = new VacationRequestsStorageService();