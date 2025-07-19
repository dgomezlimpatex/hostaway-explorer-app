import { useQuery } from '@tanstack/react-query';
import { Task } from '@/types/calendar';
import { Property } from '@/types/property';
import { supabase } from '@/integrations/supabase/client';

export const useTaskPreview = (task: Task | null) => {
  const { data: property, isLoading } = useQuery({
    queryKey: ['property', task?.propertyId],
    queryFn: async () => {
      if (!task?.propertyId) return null;
      
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', task.propertyId)
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
        numeroBanos: data.numero_banos,
        duracionServicio: data.duracion_servicio,
        costeServicio: data.coste_servicio,
        checkInPredeterminado: data.check_in_predeterminado,
        checkOutPredeterminado: data.check_out_predeterminado,
        numeroSabanas: data.numero_sabanas,
        numeroToallasGrandes: data.numero_toallas_grandes,
        numeroTotallasPequenas: data.numero_toallas_pequenas,
        numeroAlfombrines: data.numero_alfombrines,
        numeroFundasAlmohada: data.numero_fundas_almohada,
        kitAlimentario: data.kit_alimentario,
        
        // Amenities de baño
        jabonLiquido: data.jabon_liquido || 0,
        gelDucha: data.gel_ducha || 0,
        champu: data.champu || 0,
        acondicionador: data.acondicionador || 0,
        papelHigienico: data.papel_higienico || 0,
        ambientadorBano: data.ambientador_bano || 0,
        desinfectanteBano: data.desinfectante_bano || 0,
        
        // Amenities de cocina
        aceite: data.aceite || 0,
        sal: data.sal || 0,
        azucar: data.azucar || 0,
        vinagre: data.vinagre || 0,
        detergenteLavavajillas: data.detergente_lavavajillas || 0,
        limpiacristales: data.limpiacristales || 0,
        bayetasCocina: data.bayetas_cocina || 0,
        estropajos: data.estropajos || 0,
        bolsasBasura: data.bolsas_basura || 0,
        papelCocina: data.papel_cocina || 0,
        
        notas: data.notas || '',
        clienteId: data.cliente_id,
        hostaway_listing_id: data.hostaway_listing_id,
        hostaway_internal_name: data.hostaway_internal_name,
        fechaCreacion: data.fecha_creacion,
        fechaActualizacion: data.fecha_actualizacion,
      };
      
      return property;
    },
    enabled: !!task?.propertyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    property,
    isLoading,
  };
};