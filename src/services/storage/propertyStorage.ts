
import { supabase } from '@/integrations/supabase/client';
import { Property, CreatePropertyData } from '@/types/property';
import { BaseStorageService } from './baseStorage';
import { mapPropertyFromDB, mapPropertyToDB } from './mappers/propertyMappers';

// Keep every field consumed by mapPropertyFromDB, without downloading unused columns.
const PROPERTY_LIST_SELECTION = `
  id,created_at,updated_at,codigo,nombre,direccion,
  numero_camas,numero_camas_pequenas,numero_camas_suite,numero_sofas_cama,numero_banos,numero_cocinas,
  duracion_servicio,coste_servicio,planning_estimated_checkout_minutes,planning_estimated_stay_minutes,
  planning_required_cleaners,planning_complexity,planning_requires_linen_load,planning_requires_amenities_load,planning_special_instructions,
  check_in_predeterminado,check_out_predeterminado,
  numero_sabanas,numero_sabanas_pequenas,numero_sabanas_suite,numero_toallas_grandes,numero_toallas_pequenas,numero_alfombrines,numero_fundas_almohada,
  kit_alimentario,amenities_bano,amenities_cocina,cantidad_rollos_papel_higienico,cantidad_rollos_papel_cocina,bayetas_cocina,bolsas_basura,
  notas,cliente_id,hostaway_listing_id,hostaway_internal_name,linen_control_enabled,amenities_control_enabled,is_active,exclude_from_export,fecha_creacion,fecha_actualizacion,
  clients:cliente_id (nombre,is_active,linen_control_enabled)
`;

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
      .select(PROPERTY_LIST_SELECTION);

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
          is_active,
          linen_control_enabled
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
