
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
  
  // Amenities de baño
  jabonLiquido: row.jabon_liquido || 0,
  gelDucha: row.gel_ducha || 0,
  champu: row.champu || 0,
  acondicionador: row.acondicionador || 0,
  papelHigienico: row.papel_higienico || 0,
  ambientadorBano: row.ambientador_bano || 0,
  desinfectanteBano: row.desinfectante_bano || 0,
  
  // Amenities de cocina
  aceite: row.aceite || 0,
  sal: row.sal || 0,
  azucar: row.azucar || 0,
  vinagre: row.vinagre || 0,
  detergenteLavavajillas: row.detergente_lavavajillas || 0,
  limpiacristales: row.limpiacristales || 0,
  bayetasCocina: row.bayetas_cocina || 0,
  estropajos: row.estropajos || 0,
  bolsasBasura: row.bolsas_basura || 0,
  papelCocina: row.papel_cocina || 0,
  
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
  
  // Amenities de baño
  if (property.jabonLiquido !== undefined) updateData.jabon_liquido = property.jabonLiquido;
  if (property.gelDucha !== undefined) updateData.gel_ducha = property.gelDucha;
  if (property.champu !== undefined) updateData.champu = property.champu;
  if (property.acondicionador !== undefined) updateData.acondicionador = property.acondicionador;
  if (property.papelHigienico !== undefined) updateData.papel_higienico = property.papelHigienico;
  if (property.ambientadorBano !== undefined) updateData.ambientador_bano = property.ambientadorBano;
  if (property.desinfectanteBano !== undefined) updateData.desinfectante_bano = property.desinfectanteBano;
  
  // Amenities de cocina
  if (property.aceite !== undefined) updateData.aceite = property.aceite;
  if (property.sal !== undefined) updateData.sal = property.sal;
  if (property.azucar !== undefined) updateData.azucar = property.azucar;
  if (property.vinagre !== undefined) updateData.vinagre = property.vinagre;
  if (property.detergenteLavavajillas !== undefined) updateData.detergente_lavavajillas = property.detergenteLavavajillas;
  if (property.limpiacristales !== undefined) updateData.limpiacristales = property.limpiacristales;
  if (property.bayetasCocina !== undefined) updateData.bayetas_cocina = property.bayetasCocina;
  if (property.estropajos !== undefined) updateData.estropajos = property.estropajos;
  if (property.bolsasBasura !== undefined) updateData.bolsas_basura = property.bolsasBasura;
  if (property.papelCocina !== undefined) updateData.papel_cocina = property.papelCocina;
  
  if (property.notas !== undefined) updateData.notas = property.notas;
  if (property.clienteId !== undefined) updateData.cliente_id = property.clienteId;

  return updateData;
};
