
import { supabase } from '@/integrations/supabase/client';
import { Client, CreateClientData } from '@/types/client';

export const clientStorage = {
  getAll: async (): Promise<Client[]> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      nombre: row.nombre,
      cifNif: row.cif_nif,
      telefono: row.telefono,
      email: row.email,
      direccionFacturacion: row.direccion_facturacion,
      codigoPostal: row.codigo_postal,
      ciudad: row.ciudad,
      tipoServicio: row.tipo_servicio as Client['tipoServicio'],
      metodoPago: row.metodo_pago as Client['metodoPago'],
      supervisor: row.supervisor,
      factura: row.factura,
      fechaCreacion: row.fecha_creacion,
      fechaActualizacion: row.fecha_actualizacion
    })) || [];
  },

  getById: async (id: string): Promise<Client | undefined> => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No data found
      }
      console.error('Error fetching client:', error);
      throw error;
    }

    if (!data) return undefined;

    return {
      id: data.id,
      nombre: data.nombre,
      cifNif: data.cif_nif,
      telefono: data.telefono,
      email: data.email,
      direccionFacturacion: data.direccion_facturacion,
      codigoPostal: data.codigo_postal,
      ciudad: data.ciudad,
      tipoServicio: data.tipo_servicio as Client['tipoServicio'],
      metodoPago: data.metodo_pago as Client['metodoPago'],
      supervisor: data.supervisor,
      factura: data.factura,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  create: async (clientData: CreateClientData): Promise<Client> => {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        nombre: clientData.nombre,
        cif_nif: clientData.cifNif,
        telefono: clientData.telefono,
        email: clientData.email,
        direccion_facturacion: clientData.direccionFacturacion,
        codigo_postal: clientData.codigoPostal,
        ciudad: clientData.ciudad,
        tipo_servicio: clientData.tipoServicio,
        metodo_pago: clientData.metodoPago,
        supervisor: clientData.supervisor,
        factura: clientData.factura
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      throw error;
    }

    return {
      id: data.id,
      nombre: data.nombre,
      cifNif: data.cif_nif,
      telefono: data.telefono,
      email: data.email,
      direccionFacturacion: data.direccion_facturacion,
      codigoPostal: data.codigo_postal,
      ciudad: data.ciudad,
      tipoServicio: data.tipo_servicio as Client['tipoServicio'],
      metodoPago: data.metodo_pago as Client['metodoPago'],
      supervisor: data.supervisor,
      factura: data.factura,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  update: async (id: string, updates: Partial<CreateClientData>): Promise<Client | null> => {
    const updateData: any = {};
    
    if (updates.nombre !== undefined) updateData.nombre = updates.nombre;
    if (updates.cifNif !== undefined) updateData.cif_nif = updates.cifNif;
    if (updates.telefono !== undefined) updateData.telefono = updates.telefono;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.direccionFacturacion !== undefined) updateData.direccion_facturacion = updates.direccionFacturacion;
    if (updates.codigoPostal !== undefined) updateData.codigo_postal = updates.codigoPostal;
    if (updates.ciudad !== undefined) updateData.ciudad = updates.ciudad;
    if (updates.tipoServicio !== undefined) updateData.tipo_servicio = updates.tipoServicio;
    if (updates.metodoPago !== undefined) updateData.metodo_pago = updates.metodoPago;
    if (updates.supervisor !== undefined) updateData.supervisor = updates.supervisor;
    if (updates.factura !== undefined) updateData.factura = updates.factura;

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No data found
      }
      console.error('Error updating client:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      nombre: data.nombre,
      cifNif: data.cif_nif,
      telefono: data.telefono,
      email: data.email,
      direccionFacturacion: data.direccion_facturacion,
      codigoPostal: data.codigo_postal,
      ciudad: data.ciudad,
      tipoServicio: data.tipo_servicio as Client['tipoServicio'],
      metodoPago: data.metodo_pago as Client['metodoPago'],
      supervisor: data.supervisor,
      factura: data.factura,
      fechaCreacion: data.fecha_creacion,
      fechaActualizacion: data.fecha_actualizacion
    };
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting client:', error);
      throw error;
    }

    return true;
  }
};
