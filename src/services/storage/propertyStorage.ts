
import { supabase } from '@/integrations/supabase/client';
import { Property, CreatePropertyData } from '@/types/property';
import { BaseStorageService } from './baseStorage';
import { mapPropertyFromDB, mapPropertyToDB } from './mappers/propertyMappers';

class PropertyStorageService extends BaseStorageService<Property, CreatePropertyData> {
  constructor() {
    super({
      tableName: 'properties',
      mapFromDB: mapPropertyFromDB,
      mapToDB: mapPropertyToDB
    });
  }

  async getAll(): Promise<Property[]> {
    return super.getAll({ column: 'created_at', ascending: false });
  }

  async getByClientId(clienteId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties by client:', error);
      throw error;
    }

    return data?.map(mapPropertyFromDB) || [];
  }
}

export const propertyStorage = new PropertyStorageService();
