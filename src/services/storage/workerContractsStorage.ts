import { supabase } from '@/integrations/supabase/client';

// Simple local interface
export interface WorkerContract {
  id: string;
  cleanerId: string;
  contractType: string;
  startDate: string;
  endDate?: string;
  baseSalary: number;
  hourlyRate: number;
  overtimeRate: number;
  vacationDaysPerYear: number;
  sickDaysPerYear: number;
  contractHoursPerWeek: number;
  paymentFrequency: string;
  benefits: Record<string, any>;
  notes?: string;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerContractData {
  cleaner_id: string;
  contract_type: string;
  position: string;
  department: string;
  hourly_rate: number;
  contract_hours_per_week: number;
  start_date: string;
  end_date?: string;
  status?: string;
  benefits?: any[];
  notes?: string;
}

export interface UpdateWorkerContractData {
  contract_type?: string;
  position?: string;
  department?: string;
  hourly_rate?: number;
  contract_hours_per_week?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  benefits?: any[];
  notes?: string;
}

const mapFromDB = (row: any): WorkerContract => ({
  id: row.id,
  cleanerId: row.cleaner_id,
  contractType: row.contract_type || 'full-time',
  startDate: row.start_date,
  endDate: row.end_date,
  baseSalary: row.base_salary || 0,
  hourlyRate: parseFloat(String(row.hourly_rate || 0)),
  overtimeRate: row.overtime_rate || 1.5,
  vacationDaysPerYear: row.vacation_days_per_year || 22,
  sickDaysPerYear: row.sick_days_per_year || 10,
  contractHoursPerWeek: row.contract_hours_per_week || 40,
  paymentFrequency: row.payment_frequency || 'monthly',
  benefits: row.benefits || {},
  notes: row.notes,
  isActive: row.status === 'active',
  created_at: row.created_at,
  updated_at: row.updated_at,
});

class WorkerContractsStorageService {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('worker_contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapFromDB);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      return [];
    }
  }

  async getByCleanerId(cleanerId: string) {
    try {
      const { data, error } = await supabase
        .from('worker_contracts')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapFromDB);
    } catch (error) {
      console.error('Error fetching contracts by cleaner:', error);
      return [];
    }
  }

  async getActiveContracts() {
    try {
      // @ts-ignore - Temporary fix for TypeScript type inference issue
      const { data, error } = await supabase
        .from('worker_contracts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapFromDB);
    } catch (error) {
      console.error('Error fetching active contracts:', error);
      return [];
    }
  }

  async getByStatus(status: string) {
    try {
      const { data, error } = await supabase
        .from('worker_contracts')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapFromDB);
    } catch (error) {
      console.error('Error fetching contracts by status:', error);
      return [];
    }
  }

  async create(contractData: any) {
    try {
      const { data, error } = await supabase
        .from('worker_contracts')
        .insert(contractData)
        .select()
        .single();

      if (error) throw error;
      return mapFromDB(data);
    } catch (error) {
      console.error('Error creating contract:', error);
      throw error;
    }
  }

  async update(id: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('worker_contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapFromDB(data);
    } catch (error) {
      console.error('Error updating contract:', error);
      throw error;
    }
  }

  async activate(id: string, activatedBy: string) {
    return this.update(id, { 
      status: 'active',
      updated_at: new Date().toISOString()
    });
  }

  async terminate(id: string, terminatedBy: string, notes?: string) {
    return this.update(id, { 
      status: 'terminated',
      notes: notes || 'Contract terminated',
      updated_at: new Date().toISOString()
    });
  }

  async delete(id: string) {
    try {
      const { error } = await supabase
        .from('worker_contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting contract:', error);
      throw error;
    }
  }
}

export const workerContractsStorage = new WorkerContractsStorageService();