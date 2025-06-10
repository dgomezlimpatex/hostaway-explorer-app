
import { supabase } from '@/integrations/supabase/client';
import { Property, CreatePropertyData } from '@/types/property';

export const propertyStorage = {
  getAll: async (): Promise<Property[]> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      direccion: row.direccion,
      numeroCamas: row.numero_camas,
      numeroBanos: row.numero_banos,
      duracionServicio: row.duracion_servicio,
      costeServicio: row.coste_servicio,
      checkInPredeterminado: row.check_in_predeterminado,
      checkOutPredeterminado: row.check_out_predeterminado,
      numeroSabanas: row.numero_sabanas,
      numeroToallasGrandes: row.numero_toallas_grandes,
      numeroTotallasPequenas: row.numero_toallas_pequenas,
      numeroAlfombrines: row.numero_alfombrines,
      numeroFundasAlmohada: row.numero_fundas_almohada,
      notas: row.notas || '',
      clienteId: row.cliente_id,
      fechaCreacion: row.fecha_creacion,
      fechaActualizacion: row.fecha_actualizacion
    })) || [];
  },

  getById: async (id: string): Promise<Property | undefined> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No data found
      }
      console.error('Error fetching property:', error);
      throw error;
    }

    if (!data) return undefined;

    return {
      id: data.id,
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
      notas: data.notas || '',
      clienteId: data.cliente_id,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  getByClientId: async (clienteId: string): Promise<Property[]> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties by client:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      direccion: row.direccion,
      numeroCamas: row.numero_camas,
      numeroBanos: row.numero_banos,
      duracionServicio: row.duracion_servicio,
      costeServicio: row.coste_servicio,
      checkInPredeterminado: row.check_in_predeterminado,
      checkOutPredeterminado: row.check_out_predeterminado,
      numeroSabanas: row.numero_sabanas,
      numeroToallasGrandes: row.numero_toallas_grandes,
      numeroTotallasPequenas: row.numero_toallas_pequenas,
      numeroAlfombrines: row.numero_alfombrines,
      numeroFundasAlmohada: row.numero_fundas_almohada,
      notas: row.notas || '',
      clienteId: row.cliente_id,
      fechaCreacion: row.fecha_creacion,
      fechaActualizacion: row.fecha_actualizacion
    })) || [];
  },

  create: async (propertyData: CreatePropertyData): Promise<Property> => {
    const { data, error } = await supabase
      .from('properties')
      .insert({
        codigo: propertyData.codigo,
        nombre: propertyData.nombre,
        direccion: propertyData.direccion,
        numero_camas: propertyData.numeroCamas,
        numero_banos: propertyData.numeroBanos,
        duracion_servicio: propertyData.duracionServicio,
        coste_servicio: propertyData.costeServicio,
        check_in_predeterminado: propertyData.checkInPredeterminado,
        check_out_predeterminado: propertyData.checkOutPredeterminado,
        numero_sabanas: propertyData.numeroSabanas,
        numero_toallas_grandes: propertyData.numeroToallasGrandes,
        numero_toallas_pequenas: propertyData.numeroTotallasPequenas,
        numero_alfombrines: propertyData.numeroAlfombrines,
        numero_fundas_almohada: propertyData.numeroFundasAlmohada,
        notas: propertyData.notas,
        cliente_id: propertyData.clienteId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      throw error;
    }

    return {
      id: data.id,
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
      notas: data.notas || '',
      clienteId: data.cliente_id,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  update: async (id: string, updates: Partial<CreatePropertyData>): Promise<Property | null> => {
    const updateData: any = {};
    
    if (updates.codigo !== undefined) updateData.codigo = updates.codigo;
    if (updates.nombre !== undefined) updateData.nombre = updates.nombre;
    if (updates.direccion !== undefined) updateData.direccion = updates.direccion;
    if (updates.numeroCamas !== undefined) updateData.numero_camas = updates.numeroCamas;
    if (updates.numeroBanos !== undefined) updateData.numero_banos = updates.numeroBanos;
    if (updates.duracionServicio !== undefined) updateData.duracion_servicio = updates.duracionServicio;
    if (updates.costeServicio !== undefined) updateData.coste_servicio = updates.costeServicio;
    if (updates.checkInPredeterminado !== undefined) updateData.check_in_predeterminado = updates.checkInPredeterminado;
    if (updates.checkOutPredeterminado !== undefined) updateData.check_out_predeterminado = updates.checkOutPredeterminado;
    if (updates.numeroSabanas !== undefined) updateData.numero_sabanas = updates.numeroSabanas;
    if (updates.numeroToallasGrandes !== undefined) updateData.numero_toallas_grandes = updates.numeroToallasGrandes;
    if (updates.numeroTotallasPequenas !== undefined) updateData.numero_toallas_pequenas = updates.numeroTotallasPequenas;
    if (updates.numeroAlfombrines !== undefined) updateData.numero_alfombrines = updates.numeroAlfombrines;
    if (updates.numeroFundasAlmohada !== undefined) updateData.numero_fundas_almohada = updates.numeroFundasAlmohada;
    if (updates.notas !== undefined) updateData.notas = updates.notas;
    if (updates.clienteId !== undefined) updateData.cliente_id = updates.clienteId;

    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No data found
      }
      console.error('Error updating property:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
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
      notas: data.notas || '',
      clienteId: data.cliente_id,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting property:', error);
      throw error;
    }

    return true;
  }
};
