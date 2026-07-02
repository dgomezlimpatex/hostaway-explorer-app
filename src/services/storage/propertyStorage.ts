
import { supabase } from '@/integrations/supabase/client';
import { Property, CreatePropertyData } from '@/types/property';
import { BaseStorageService } from './baseStorage';
import { mapPropertyFromDB, mapPropertyToDB } from './mappers/propertyMappers';

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

class PropertyStorageService extends BaseStorageService<Property, CreatePropertyData> {
  constructor() {
    super({
      tableName: 'properties',
      mapFromDB: mapPropertyFromDB,
      mapToDB: mapPropertyToDB,
      enforceSedeFilter: true // Habilitar filtro automático por sede
    });
  }

  async getAll(): Promise<Property[]> {
    let query = supabase
      .from('properties')
      .select(`
        *,
        clients:cliente_id (
          nombre,
          is_active
        )
      `);

    const activeSedeId = getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }

    return data?.map(mapPropertyFromDB) || [];
  }

  async getByClientId(clienteId: string): Promise<Property[]> {
    let query = supabase
      .from('properties')
      .select(`
        *,
        clients:cliente_id (
          nombre,
          is_active
        )
      `)
      .eq('cliente_id', clienteId);

    // Aplicar filtro por sede
    const activeSedeId = getActiveSedeId();
    if (activeSedeId) {
      query = query.eq('sede_id', activeSedeId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties by client:', error);
      throw error;
    }

    return data?.map(mapPropertyFromDB) || [];
  }
}

export const propertyStorage = new PropertyStorageService();
