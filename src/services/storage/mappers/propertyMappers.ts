
import { Property, CreatePropertyData } from '@/types/property';

export const mapPropertyFromDB = (row: any): Property => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
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
  kitAlimentario: row.kit_alimentario || 0,
  amenitiesBano: row.amenities_bano || 0,
  amenitiesCocina: row.amenities_cocina || 0,
  notas: row.notas || '',
  clienteId: row.cliente_id,
  hostaway_listing_id: row.hostaway_listing_id,
  hostaway_internal_name: row.hostaway_internal_name,
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion
});

export const mapPropertyToDB = (property: Partial<CreatePropertyData>): any => {
  const updateData: any = {};
  
  if (property.codigo !== undefined) updateData.codigo = property.codigo;
  if (property.nombre !== undefined) updateData.nombre = property.nombre;
  if (property.direccion !== undefined) updateData.direccion = property.direccion;
  if (property.numeroCamas !== undefined) updateData.numero_camas = property.numeroCamas;
  if (property.numeroBanos !== undefined) updateData.numero_banos = property.numeroBanos;
  if (property.duracionServicio !== undefined) updateData.duracion_servicio = property.duracionServicio;
  if (property.costeServicio !== undefined) updateData.coste_servicio = property.costeServicio;
  if (property.checkInPredeterminado !== undefined) updateData.check_in_predeterminado = property.checkInPredeterminado;
  if (property.checkOutPredeterminado !== undefined) updateData.check_out_predeterminado = property.checkOutPredeterminado;
  if (property.numeroSabanas !== undefined) updateData.numero_sabanas = property.numeroSabanas;
  if (property.numeroToallasGrandes !== undefined) updateData.numero_toallas_grandes = property.numeroToallasGrandes;
  if (property.numeroTotallasPequenas !== undefined) updateData.numero_toallas_pequenas = property.numeroTotallasPequenas;
  if (property.numeroAlfombrines !== undefined) updateData.numero_alfombrines = property.numeroAlfombrines;
  if (property.numeroFundasAlmohada !== undefined) updateData.numero_fundas_almohada = property.numeroFundasAlmohada;
  if (property.kitAlimentario !== undefined) updateData.kit_alimentario = property.kitAlimentario;
  if (property.amenitiesBano !== undefined) updateData.amenities_bano = property.amenitiesBano;
  if (property.amenitiesCocina !== undefined) updateData.amenities_cocina = property.amenitiesCocina;
  if (property.notas !== undefined) updateData.notas = property.notas;
  if (property.clienteId !== undefined) updateData.cliente_id = property.clienteId;

  return updateData;
};
