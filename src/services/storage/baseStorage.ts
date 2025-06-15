
import { supabase } from '@/integrations/supabase/client';

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface StorageConfig<T> {
  tableName: string;
  mapFromDB: (row: any) => T;
  mapToDB: (entity: Partial<T>) => any;
}

export class BaseStorageService<T extends BaseEntity, CreateData = Omit<T, 'id' | 'created_at' | 'updated_at'>> {
  constructor(private config: StorageConfig<T>) {}

  async getAll(orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let query = supabase.from(this.config.tableName).select('*');
    
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${this.config.tableName}:`, error);
      throw error;
    }

    return data?.map(this.config.mapFromDB) || [];
  }

  async getById(id: string): Promise<T | undefined> {
    const { data, error } = await supabase
      .from(this.config.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No data found
      }
      console.error(`Error fetching ${this.config.tableName}:`, error);
      throw error;
    }

    if (!data) return undefined;
    return this.config.mapFromDB(data);
  }

  async create(entityData: CreateData): Promise<T> {
    const { data, error } = await supabase
      .from(this.config.tableName)
      .insert(this.config.mapToDB(entityData))
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${this.config.tableName}:`, error);
      throw error;
    }

    return this.config.mapFromDB(data);
  }

  async update(id: string, updates: Partial<CreateData>): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.config.tableName)
      .update(this.config.mapToDB(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No data found
      }
      console.error(`Error updating ${this.config.tableName}:`, error);
      throw error;
    }

    if (!data) return null;
    return this.config.mapFromDB(data);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from(this.config.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Error deleting ${this.config.tableName}:`, error);
      throw error;
    }

    return true;
  }
}
