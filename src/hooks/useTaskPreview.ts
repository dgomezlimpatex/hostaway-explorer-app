import { useQuery } from '@tanstack/react-query';
import { Task } from '@/types/calendar';
import { Property } from '@/types/property';
import { supabase } from '@/integrations/supabase/client';

export const useTaskPreview = (task: Task | null) => {
  // Handle both propertyId and propiedad_id fields for compatibility
  const taskPropertyId = task?.propertyId || (task as any)?.propiedad_id;
  
  const { data: property, isLoading } = useQuery({
    queryKey: ['property', taskPropertyId],
    queryFn: async () => {
      if (!taskPropertyId) return null;
      
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', taskPropertyId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching property:', error);
        return null;
      }
      
      if (!data) return null;
      
      // Map database fields to Property type
      const property: Property = {
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        codigo: data.codigo,
        nombre: data.nombre,
        direccion: data.direccion,
        numeroCamas: data.numero_camas,
        numeroCamasPequenas: data.numero_camas_pequenas || 0,
        numeroCamasSuite: data.numero_camas_suite || 0,
        numeroSofasCama: data.numero_sofas_cama || 0,
        numeroBanos: data.numero_banos,
        duracionServicio: data.duracion_servicio,
        costeServicio: data.coste_servicio,
        checkInPredeterminado: data.check_in_predeterminado,
        checkOutPredeterminado: data.check_out_predeterminado,
        numeroSabanas: data.numero_sabanas,
        numeroSabanasRequenas: data.numero_sabanas_pequenas || 0,
        numeroSabanasSuite: data.numero_sabanas_suite || 0,
        numeroToallasGrandes: data.numero_toallas_grandes,
        numeroTotallasPequenas: data.numero_toallas_pequenas,
        numeroAlfombrines: data.numero_alfombrines,
        numeroFundasAlmohada: data.numero_fundas_almohada,
        kitAlimentario: data.kit_alimentario,
        amenitiesBano: data.amenities_bano || 0,
        amenitiesCocina: data.amenities_cocina || 0,
        cantidadRollosPapelHigienico: data.cantidad_rollos_papel_higienico || 0,
        cantidadRollosPapelCocina: data.cantidad_rollos_papel_cocina || 0,
        notas: data.notas || '',
        clienteId: data.cliente_id,
        hostaway_listing_id: data.hostaway_listing_id,
        hostaway_internal_name: data.hostaway_internal_name,
        linenControlEnabled: data.linen_control_enabled,
        isActive: data.is_active,
        fechaCreacion: data.fecha_creacion,
        fechaActualizacion: data.fecha_actualizacion,
      };
      
      return property;
    },
    enabled: !!taskPropertyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    property,
    isLoading,
  };
};