import { supabase } from '@/integrations/supabase/client';
import { WorkerContract } from '@/types/calendar';

export interface CreateWorkerContractData {
  cleaner_id: string;
  contract_type: 'full-time' | 'part-time' | 'temporary' | 'freelance';
  position: string;
  department: string;
  hourly_rate: number;
  contract_hours_per_week: number;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  status?: 'draft' | 'active' | 'expired' | 'terminated';
  benefits?: string[];
  notes?: string;
}

export interface UpdateWorkerContractData {
  contract_type?: 'full-time' | 'part-time' | 'temporary' | 'freelance';
  position?: string;
  department?: string;
  hourly_rate?: number;
  contract_hours_per_week?: number;
  start_date?: string;
  end_date?: string;
  renewal_date?: string;
  status?: 'draft' | 'active' | 'expired' | 'terminated';
  benefits?: string[];
  notes?: string;
}

const mapWorkerContractFromDB = (row: any): WorkerContract => {
  return {
    id: row.id,
    cleanerId: row.cleaner_id,
    contractType: row.contract_type,
    startDate: row.start_date,
    endDate: row.end_date,
    baseSalary: 0,
    hourlyRate: parseFloat(row.hourly_rate || 0),
    overtimeRate: 1.5,
    vacationDaysPerYear: 22,
    sickDaysPerYear: 10,
    contractHoursPerWeek: row.contract_hours_per_week || 40,
    paymentFrequency: 'monthly' as const,
    benefits: row.benefits || {},
    notes: row.notes,
    isActive: row.status === 'active',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

class WorkerContractsStorageService {
  async getAll(): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching worker contracts:', error);
      throw error;
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async getByCleanerId(cleanerId: string): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching worker contracts by cleaner:', error);
      throw error;
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async getActiveContracts(): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active contracts:', error);
      throw error;
    }

    return data ? data.map(mapWorkerContractFromDB) : [];
  }

  async create(contractData: CreateWorkerContractData): Promise<WorkerContract> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .insert(contractData)
      .select()
      .single();

    if (error) {
      console.error('Error creating worker contract:', error);
      throw error;
    }

    return mapWorkerContractFromDB(data);
  }

  async update(id: string, updates: UpdateWorkerContractData): Promise<WorkerContract> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating worker contract:', error);
      throw error;
    }

    return mapWorkerContractFromDB(data);
  }

  async getByStatus(status: string): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contracts by status:', error);
      throw error;
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async activate(id: string, activatedBy: string): Promise<WorkerContract> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error activating worker contract:', error);
      throw error;
    }

    return mapWorkerContractFromDB(data);
  }

  async terminate(id: string, terminatedBy: string, notes?: string): Promise<WorkerContract> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .update({ 
        status: 'terminated',
        notes: notes || 'Contract terminated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error terminating worker contract:', error);
      throw error;
    }

    return mapWorkerContractFromDB(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('worker_contracts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting worker contract:', error);
      throw error;
    }
  }
}

export const workerContractsStorage = new WorkerContractsStorageService();