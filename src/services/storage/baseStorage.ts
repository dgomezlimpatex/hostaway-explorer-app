
import { supabase } from '@/integrations/supabase/client';
import { BaseEntity } from '@/types/common';

export interface StorageConfig<T, CreateData> {
  tableName: string;
  mapFromDB: (row: any) => T;
  mapToDB: (entity: Partial<CreateData>) => any;
  enforceSedeFilter?: boolean;
}

// Contexto global para la sede activa (usado por BaseStorage)
let globalSedeContext: {
  getActiveSedeId: () => string | null;
  waitForActiveSede: () => Promise<string>;
} | null = null;

export const setGlobalSedeContext = (context: {
  getActiveSedeId: () => string | null;
  waitForActiveSede: () => Promise<string>;
}) => {
  globalSedeContext = context;
};

export class BaseStorageService<T extends BaseEntity, CreateData = Omit<T, keyof BaseEntity>> {
  constructor(private config: StorageConfig<T, CreateData>) {}

  private async getActiveSedeId(): Promise<string | null> {
    console.log('🔍 BaseStorage.getActiveSedeId called', {
      hasGlobalContext: !!globalSedeContext,
      tableName: this.config.tableName
    });
    
    // Usar contexto global si está disponible
    if (globalSedeContext) {
      const sedeId = globalSedeContext.getActiveSedeId();
      console.log('🔍 BaseStorage: Got sede from global context:', sedeId);
      
      // Si hay sede, devolverla directamente
      if (sedeId) {
        return sedeId;
      }
      
      // Si no hay sede pero el contexto está disponible, NO esperar aquí
      // Las queries ya tienen su propia lógica de enabled
      console.log('🔍 BaseStorage: No sede available from global context, returning null');
      return null;
    }
    
    // Fallback a localStorage (mantener compatibilidad)
    try {
      const activeSede = localStorage.getItem('activeSede');
      if (activeSede) {
        const sede = JSON.parse(activeSede);
        console.log('🔍 BaseStorage: Got sede from localStorage:', sede.id);
        return sede.id;
      }
      console.log('🔍 BaseStorage: No sede in localStorage');
      return null;
    } catch (error) {
      console.warn('Error getting active sede from localStorage:', error);
      return null;
    }
  }
  
  private async ensureActiveSedeId(): Promise<string> {
    const sedeId = await this.getActiveSedeId();
    if (sedeId) {
      return sedeId;
    }
    
    // Intentar esperar por una sede activa si el contexto global está disponible
    if (globalSedeContext) {
      try {
        return await globalSedeContext.waitForActiveSede();
      } catch (error) {
        throw new Error('No se puede realizar la operación: no hay una sede activa seleccionada. Por favor, selecciona una sede en el selector de la parte superior.');
      }
    }
    
    throw new Error('No se puede realizar la operación: no hay una sede activa seleccionada. Por favor, selecciona una sede en el selector de la parte superior.');
  }

  async getAll(orderBy?: { column: string; ascending?: boolean }): Promise<T[]> {
    let query = supabase.from(this.config.tableName as any).select('*');
    
    // Aplicar filtro automático por sede si está habilitado
    if (this.config.enforceSedeFilter !== false) {
      const activeSedeId = await this.getActiveSedeId();
      console.log(`🏢 BaseStorage.getAll for table ${this.config.tableName}:`, {
        enforceSedeFilter: this.config.enforceSedeFilter,
        activeSedeId,
        hasGlobalContext: !!globalSedeContext
      });
      
      if (activeSedeId) {
        query = query.eq('sede_id', activeSedeId);
        console.log(`🔍 Applied sede filter: ${activeSedeId} for table ${this.config.tableName}`);
      } else {
        console.warn(`⚠️ NO SEDE FILTER applied for table ${this.config.tableName} - activeSedeId is null`);
      }
    } else {
      console.log(`🚫 Sede filter disabled for table ${this.config.tableName}`);
    }
    
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching ${this.config.tableName}:`, error);
      throw error;
    }

    console.log(`📊 BaseStorage.getAll result for ${this.config.tableName}:`, {
      recordCount: data?.length || 0,
      activeSedeId: await this.getActiveSedeId(),
      sampleRecords: data?.slice(0, 2).map((r: any) => ({ id: r.id, sede_id: r.sede_id })) || []
    });

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
      const activeSedeId = await this.ensureActiveSedeId();
      dataToInsert = { ...dataToInsert, sede_id: activeSedeId };
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
