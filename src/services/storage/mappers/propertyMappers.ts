
import { Property, CreatePropertyData } from '@/types/property';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- property rows are mapped from Supabase's generated schema plus legacy columns.
export const mapPropertyFromDB = (row: any): Property => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  codigo: row.codigo,
  nombre: row.nombre,
  direccion: row.direccion,
  numeroCamas: row.numero_camas,
  numeroCamasPequenas: row.numero_camas_pequenas || 0,
  numeroCamasSuite: row.numero_camas_suite || 0,
  numeroSofasCama: row.numero_sofas_cama || 0,
  numeroBanos: row.numero_banos,
  numeroCocinas: row.numero_cocinas ?? 1,
  duracionServicio: row.duracion_servicio,
  costeServicio: row.coste_servicio,
  planningEstimatedCheckoutMinutes: row.planning_estimated_checkout_minutes ?? null,
  planningEstimatedStayMinutes: row.planning_estimated_stay_minutes ?? null,
  planningRequiredCleaners: row.planning_required_cleaners ?? 1,
  planningComplexity: row.planning_complexity ?? 1,
  planningRequiresLinenLoad: row.planning_requires_linen_load ?? false,
  planningRequiresAmenitiesLoad: row.planning_requires_amenities_load ?? false,
  planningSpecialInstructions: row.planning_special_instructions ?? null,
  checkInPredeterminado: row.check_in_predeterminado,
  checkOutPredeterminado: row.check_out_predeterminado,
  numeroSabanas: row.numero_sabanas,
  numeroSabanasRequenas: row.numero_sabanas_pequenas || 0,
  numeroSabanasSuite: row.numero_sabanas_suite || 0,
  numeroToallasGrandes: row.numero_toallas_grandes,
  numeroTotallasPequenas: row.numero_toallas_pequenas,
  numeroAlfombrines: row.numero_alfombrines,
  numeroFundasAlmohada: row.numero_fundas_almohada,
  kitAlimentario: row.kit_alimentario || 0,
  amenitiesBano: row.amenities_bano || 0,
  amenitiesCocina: row.amenities_cocina || 0,
  cantidadRollosPapelHigienico: row.cantidad_rollos_papel_higienico || 0,
  cantidadRollosPapelCocina: row.cantidad_rollos_papel_cocina || 0,
  bayetasCocina: row.bayetas_cocina || 0,
  bolsasBasura: row.bolsas_basura || 0,
  notas: row.notas || '',
  clienteId: row.cliente_id,
  hostaway_listing_id: row.hostaway_listing_id,
  hostaway_internal_name: row.hostaway_internal_name,
  linenControlEnabled: row.linen_control_enabled,
  isActive: row.is_active,
  excludeFromExport: row.exclude_from_export || false,
  fechaCreacion: row.fecha_creacion,
  fechaActualizacion: row.fecha_actualizacion
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- BaseStorage accepts table-specific payloads with DB column names.
export const mapPropertyToDB = (property: Partial<CreatePropertyData>): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Built incrementally to avoid writing undefined fields to Supabase.
  const updateData: any = {};
  
  if (property.codigo !== undefined) updateData.codigo = property.codigo;
  if (property.nombre !== undefined) updateData.nombre = property.nombre;
  if (property.direccion !== undefined) updateData.direccion = property.direccion;
  if (property.numeroCamas !== undefined) updateData.numero_camas = property.numeroCamas;
  if (property.numeroCamasPequenas !== undefined) updateData.numero_camas_pequenas = property.numeroCamasPequenas;
  if (property.numeroCamasSuite !== undefined) updateData.numero_camas_suite = property.numeroCamasSuite;
  if (property.numeroSofasCama !== undefined) updateData.numero_sofas_cama = property.numeroSofasCama;
  if (property.numeroBanos !== undefined) updateData.numero_banos = property.numeroBanos;
  if (property.numeroCocinas !== undefined) updateData.numero_cocinas = property.numeroCocinas;
  if (property.duracionServicio !== undefined) updateData.duracion_servicio = property.duracionServicio;
  if (property.costeServicio !== undefined) updateData.coste_servicio = property.costeServicio;
  if (property.planningEstimatedCheckoutMinutes !== undefined) updateData.planning_estimated_checkout_minutes = property.planningEstimatedCheckoutMinutes;
  if (property.planningEstimatedStayMinutes !== undefined) updateData.planning_estimated_stay_minutes = property.planningEstimatedStayMinutes;
  if (property.planningRequiredCleaners !== undefined) updateData.planning_required_cleaners = property.planningRequiredCleaners;
  if (property.planningComplexity !== undefined) updateData.planning_complexity = property.planningComplexity;
  if (property.planningRequiresLinenLoad !== undefined) updateData.planning_requires_linen_load = property.planningRequiresLinenLoad;
  if (property.planningRequiresAmenitiesLoad !== undefined) updateData.planning_requires_amenities_load = property.planningRequiresAmenitiesLoad;
  if (property.planningSpecialInstructions !== undefined) updateData.planning_special_instructions = property.planningSpecialInstructions;
  if (property.checkInPredeterminado !== undefined) updateData.check_in_predeterminado = property.checkInPredeterminado;
  if (property.checkOutPredeterminado !== undefined) updateData.check_out_predeterminado = property.checkOutPredeterminado;
  if (property.numeroSabanas !== undefined) updateData.numero_sabanas = property.numeroSabanas;
  if (property.numeroSabanasRequenas !== undefined) updateData.numero_sabanas_pequenas = property.numeroSabanasRequenas;
  if (property.numeroSabanasSuite !== undefined) updateData.numero_sabanas_suite = property.numeroSabanasSuite;
  if (property.numeroToallasGrandes !== undefined) updateData.numero_toallas_grandes = property.numeroToallasGrandes;
  if (property.numeroTotallasPequenas !== undefined) updateData.numero_toallas_pequenas = property.numeroTotallasPequenas;
  if (property.numeroAlfombrines !== undefined) updateData.numero_alfombrines = property.numeroAlfombrines;
  if (property.numeroFundasAlmohada !== undefined) updateData.numero_fundas_almohada = property.numeroFundasAlmohada;
  if (property.kitAlimentario !== undefined) updateData.kit_alimentario = property.kitAlimentario;
  if (property.amenitiesBano !== undefined) updateData.amenities_bano = property.amenitiesBano;
  if (property.amenitiesCocina !== undefined) updateData.amenities_cocina = property.amenitiesCocina;
  if (property.cantidadRollosPapelHigienico !== undefined) updateData.cantidad_rollos_papel_higienico = property.cantidadRollosPapelHigienico;
  if (property.cantidadRollosPapelCocina !== undefined) updateData.cantidad_rollos_papel_cocina = property.cantidadRollosPapelCocina;
  if (property.bayetasCocina !== undefined) updateData.bayetas_cocina = property.bayetasCocina;
  if (property.bolsasBasura !== undefined) updateData.bolsas_basura = property.bolsasBasura;
  if (property.notas !== undefined) updateData.notas = property.notas;
  if (property.clienteId !== undefined) updateData.cliente_id = property.clienteId;
  if (property.linenControlEnabled !== undefined) updateData.linen_control_enabled = property.linenControlEnabled;
  if (property.isActive !== undefined) updateData.is_active = property.isActive;
  if (property.excludeFromExport !== undefined) updateData.exclude_from_export = property.excludeFromExport;

  return updateData;
};
