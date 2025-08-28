
import { supabase } from '@/integrations/supabase/client';
import { BaseEntity } from '@/types/common';

export interface StorageConfig<T, CreateData> {
  tableName: string;
  mapFromDB: (row: any) => T;
  mapToDB: (entity: Partial<CreateData>) => any;
  enforceSedeFilter?: boolean; // Nueva opción para controlar el filtro por sede
}

export class BaseStorageService<T extends BaseEntity, CreateData = Omit<T, keyof BaseEntity>> {
  constructor(private config: StorageConfig<T, CreateData>) {}

  private async getActiveSedeId(): Promise<string | null> {
    // Función helper para obtener la sede activa del localStorage
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
  }

  async getAll(orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let query = supabase.from(this.config.tableName as any).select('*');
    
    // Aplicar filtro automático por sede si está habilitado
    if (this.config.enforceSedeFilter !== false) {
      const activeSedeId = await this.getActiveSedeId();
      if (activeSedeId) {
        query = query.eq('sede_id', activeSedeId);
      }
    }
    
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
    let query = supabase
      .from(this.config.tableName as any)
      .select('*')
      .eq('id', id);

    // Aplicar filtro automático por sede si está habilitado
    if (this.config.enforceSedeFilter !== false) {
      const activeSedeId = await this.getActiveSedeId();
      if (activeSedeId) {
        query = query.eq('sede_id', activeSedeId);
      }
    }

    const { data, error } = await query.single();

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
    let dataToInsert = this.config.mapToDB(entityData);
    
    // Agregar sede_id automáticamente si está habilitado el filtro por sede
    if (this.config.enforceSedeFilter !== false && !dataToInsert.sede_id) {
      const activeSedeId = await this.getActiveSedeId();
      if (activeSedeId) {
        dataToInsert = { ...dataToInsert, sede_id: activeSedeId };
      } else {
        console.error('❌ No hay sede activa seleccionada para crear el registro');
        throw new Error('No se puede crear la tarea: no hay una sede activa seleccionada. Por favor, selecciona una sede en el selector de la parte superior.');
      }
    }

    const { data, error } = await supabase
      .from(this.config.tableName as any)
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error(`Error creating ${this.config.tableName}:`, error);
      throw error;
    }

    return this.config.mapFromDB(data);
  }

  async update(id: string, updates: Partial<CreateData>): Promise<T | null> {
    let dataToUpdate = this.config.mapToDB(updates);
    
    // No permitir cambio de sede_id a menos que se especifique explícitamente
    if (this.config.enforceSedeFilter !== false && dataToUpdate.sede_id === undefined) {
      // Mantener la sede actual - no cambiarla
      delete dataToUpdate.sede_id;
    }

    let query = supabase
      .from(this.config.tableName as any)
      .update(dataToUpdate)
      .eq('id', id);

    // Aplicar filtro automático por sede si está habilitado
    if (this.config.enforceSedeFilter !== false) {
      const activeSedeId = await this.getActiveSedeId();
      if (activeSedeId) {
        query = query.eq('sede_id', activeSedeId);
      }
    }

    const { data, error } = await query.select().single();

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
    console.log(`🗑️ BaseStorage - Attempting to delete from ${this.config.tableName} with id:`, id);
    
    let query = supabase
      .from(this.config.tableName as any)
      .delete()
      .eq('id', id);

    // Aplicar filtro automático por sede si está habilitado
    if (this.config.enforceSedeFilter !== false) {
      const activeSedeId = await this.getActiveSedeId();
      if (activeSedeId) {
        query = query.eq('sede_id', activeSedeId);
      }
    }

    const { error, count } = await query;

    if (error) {
      console.error(`❌ Error deleting from ${this.config.tableName}:`, error);
      throw error;
    }

    console.log(`✅ BaseStorage - Delete successful from ${this.config.tableName}, count:`, count);
    return true;
  }
}
