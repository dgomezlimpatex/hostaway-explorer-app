
import { supabase } from '@/integrations/supabase/client';
import { Cleaner } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';
import { mapCleanerFromDB, mapCleanerToDB } from './mappers/cleanerMappers';
import { normalizeWorkerPhoneForStorage } from '@/utils/phone/workerPhone';

export interface CreateCleanerData {
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive?: boolean;
  sortOrder?: number;
  contractHoursPerWeek?: number;
  hourlyRate?: number;
  contractType?: string;
  category?: string;
  startDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  sede_id?: string;
  planningMaxDailyMinutes?: number;
  planningZone?: string | null;
  planningOperationalRestrictions?: string | null;
  planningCanHandleLinenLoad?: boolean;
  planningCanHandleComplexCleanings?: boolean;
}

class CleanerStorageService extends BaseStorageService<Cleaner, CreateCleanerData> {
  constructor() {
    super({
      tableName: 'cleaners',
      mapFromDB: mapCleanerFromDB,
      mapToDB: mapCleanerToDB,
      enforceSedeFilter: true // Habilitar filtro automático por sede
    });
  }

  async create(entityData: CreateCleanerData): Promise<Cleaner> {
    return super.create({
      ...entityData,
      telefono: normalizeWorkerPhoneForStorage(entityData.telefono),
    });
  }

  async update(id: string, updates: Partial<CreateCleanerData>): Promise<Cleaner | null> {
    const normalizedUpdates = Object.prototype.hasOwnProperty.call(updates, 'telefono')
      ? { ...updates, telefono: normalizeWorkerPhoneForStorage(updates.telefono) }
      : updates;
    return super.update(id, normalizedUpdates);
  }

  async getAll(): Promise<Cleaner[]> {
    // Para cleaners, necesitamos usar query personalizado por el ordenamiento especial
    const getActiveSedeId = (): string | null => {
      try {
        const activeSede = localStorage.getItem('activeSede');
        if (activeSede) {
          const sede = JSON.parse(activeSede);
          return sede.id;
        }
        return null;
      } catch (error) {
        console.warn('Error getting active sede:', error);
        return null;
      }
    };

    let query = supabase
      .from('cleaners')
      .select('*');

    // Aplicar filtro por sede
    const activeSedeId = getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query
      .order('sort_order', { nullsFirst: false })
      .order('name');

    if (error) {
      console.error('Error fetching cleaners:', error);
      throw error;
    }

    return data?.map(mapCleanerFromDB) || [];
  }

  async updateOrder(cleaners: { id: string; sortOrder: number }[]): Promise<boolean> {
    const { error } = await supabase.rpc('update_cleaners_order', {
      cleaner_updates: cleaners
    });

    if (error) {
      console.error('Error updating cleaners order:', error);
      throw error;
    }

    return true;
  }
}

export const cleanerStorage = new CleanerStorageService();
