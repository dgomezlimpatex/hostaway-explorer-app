import { supabase } from '@/integrations/supabase/client';
import { BaseStorageService } from './baseStorage';

export interface WorkerContract {
  id: string;
  cleaner_id: string;
  contract_type: 'full-time' | 'part-time' | 'temporary' | 'freelance';
  position: string;
  department: string;
  hourly_rate: number;
  contract_hours_per_week: number;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  benefits: string[];
  notes?: string;
  documents: Array<{
    name: string;
    url: string;
    uploadDate: string;
  }>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

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
    cleaner_id: row.cleaner_id,
    contract_type: row.contract_type,
    position: row.position,
    department: row.department,
    hourly_rate: parseFloat(row.hourly_rate),
    contract_hours_per_week: row.contract_hours_per_week,
    start_date: row.start_date,
    end_date: row.end_date,
    renewal_date: row.renewal_date,
    status: row.status,
    benefits: row.benefits || [],
    notes: row.notes,
    documents: row.documents || [],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const mapWorkerContractToDB = (data: CreateWorkerContractData | UpdateWorkerContractData) => {
  return {
    ...data,
    hourly_rate: data.hourly_rate?.toString(),
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
      throw new Error(`Failed to fetch worker contracts: ${error.message}`);
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
      console.error(`Error fetching contracts for cleaner ${cleanerId}:`, error);
      throw new Error(`Failed to fetch contracts: ${error.message}`);
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async getByStatus(status: 'draft' | 'active' | 'expired' | 'terminated'): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching contracts with status ${status}:`, error);
      throw new Error(`Failed to fetch contracts: ${error.message}`);
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async getActiveContracts(): Promise<WorkerContract[]> {
    return this.getByStatus('active');
  }

  async create(contractData: CreateWorkerContractData): Promise<WorkerContract> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('worker_contracts')
      .insert({ ...contractData, created_by: userData.user.id })
      .select()
      .single();

    if (error) throw new Error(`Failed to create contract: ${error.message}`);
    return mapWorkerContractFromDB(data);
  }

  async update(id: string, updates: UpdateWorkerContractData): Promise<WorkerContract> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update contract: ${error.message}`);
    return mapWorkerContractFromDB(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('worker_contracts')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete contract: ${error.message}`);
  }

  async activate(id: string, activatedBy: string): Promise<WorkerContract> {
    return this.update(id, { status: 'active' });
  }

  async terminate(id: string, terminatedBy: string, notes?: string): Promise<WorkerContract> {
    return this.update(id, { status: 'terminated', notes });
  }
}

export const workerContractsStorage = new WorkerContractsStorageService();