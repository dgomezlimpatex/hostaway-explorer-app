import { supabase } from '@/integrations/supabase/client';
import { WorkerContract } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';

export interface CreateWorkerContractData {
  cleanerId: string;
  contractType: 'full-time' | 'part-time' | 'temporary' | 'freelance';
  startDate: string;
  endDate?: string;
  baseSalary: number;
  hourlyRate?: number;
  overtimeRate?: number;
  vacationDaysPerYear?: number;
  sickDaysPerYear?: number;
  contractHoursPerWeek?: number;
  paymentFrequency?: 'weekly' | 'biweekly' | 'monthly';
  benefits?: Record<string, any>;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateWorkerContractData extends Partial<CreateWorkerContractData> {}

// Database mapping functions
const mapWorkerContractFromDB = (row: any): WorkerContract => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  cleanerId: row.cleaner_id,
  contractType: row.contract_type,
  startDate: row.start_date,
  endDate: row.end_date,
  baseSalary: row.base_salary,
  hourlyRate: row.hourly_rate,
  overtimeRate: row.overtime_rate,
  vacationDaysPerYear: row.vacation_days_per_year,
  sickDaysPerYear: row.sick_days_per_year,
  contractHoursPerWeek: row.contract_hours_per_week,
  paymentFrequency: row.payment_frequency,
  benefits: row.benefits || {},
  notes: row.notes,
  isActive: row.is_active
});

const mapWorkerContractToDB = (contract: Partial<CreateWorkerContractData>): any => {
  const updateData: any = {};
  
  if (contract.cleanerId !== undefined) updateData.cleaner_id = contract.cleanerId;
  if (contract.contractType !== undefined) updateData.contract_type = contract.contractType;
  if (contract.startDate !== undefined) updateData.start_date = contract.startDate;
  if (contract.endDate !== undefined) updateData.end_date = contract.endDate;
  if (contract.baseSalary !== undefined) updateData.base_salary = contract.baseSalary;
  if (contract.hourlyRate !== undefined) updateData.hourly_rate = contract.hourlyRate;
  if (contract.overtimeRate !== undefined) updateData.overtime_rate = contract.overtimeRate;
  if (contract.vacationDaysPerYear !== undefined) updateData.vacation_days_per_year = contract.vacationDaysPerYear;
  if (contract.sickDaysPerYear !== undefined) updateData.sick_days_per_year = contract.sickDaysPerYear;
  if (contract.contractHoursPerWeek !== undefined) updateData.contract_hours_per_week = contract.contractHoursPerWeek;
  if (contract.paymentFrequency !== undefined) updateData.payment_frequency = contract.paymentFrequency;
  if (contract.benefits !== undefined) updateData.benefits = contract.benefits;
  if (contract.notes !== undefined) updateData.notes = contract.notes;
  if (contract.isActive !== undefined) updateData.is_active = contract.isActive;

  return updateData;
};

interface WorkerContractsStorageConfig {
  tableName: 'worker_contracts';
  mapFromDB: typeof mapWorkerContractFromDB;
  mapToDB: typeof mapWorkerContractToDB;
  enforceSedeFilter: boolean;
}

class WorkerContractsStorageService extends BaseStorageService<WorkerContract, CreateWorkerContractData> {
  constructor() {
    super({
      tableName: 'worker_contracts',
      mapFromDB: mapWorkerContractFromDB,
      mapToDB: mapWorkerContractToDB,
      enforceSedeFilter: false // No direct sede filter, filtered through cleaners
    } as WorkerContractsStorageConfig);
  }

  async getByCleanerId(cleanerId: string): Promise<WorkerContract | null> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No contract found
      }
      console.error('Error fetching worker contract:', error);
      throw error;
    }

    return data ? mapWorkerContractFromDB(data) : null;
  }

  async getActiveContracts(): Promise<WorkerContract[]> {
    const { data, error } = await supabase
      .from('worker_contracts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active contracts:', error);
      throw error;
    }

    return data?.map(mapWorkerContractFromDB) || [];
  }

  async deactivateContract(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('worker_contracts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating contract:', error);
      throw error;
    }

    return true;
  }
}

export const workerContractsStorage = new WorkerContractsStorageService();