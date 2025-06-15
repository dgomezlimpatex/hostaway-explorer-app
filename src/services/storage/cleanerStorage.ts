
import { supabase } from '@/integrations/supabase/client';
import { Cleaner } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';
import { mapCleanerFromDB, mapCleanerToDB } from './mappers/cleanerMappers';

export interface CreateCleanerData {
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive?: boolean;
  sortOrder?: number;
}

class CleanerStorageService extends BaseStorageService<Cleaner, CreateCleanerData> {
  constructor() {
    super({
      tableName: 'cleaners',
      mapFromDB: mapCleanerFromDB,
      mapToDB: mapCleanerToDB
    });
  }

  async getAll(): Promise<Cleaner[]> {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
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
