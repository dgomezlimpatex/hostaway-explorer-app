
import { BaseEntity } from './common';

export interface Property extends BaseEntity {
  // Información básica
  codigo: string;
  nombre: string;
  direccion: string;
  
  // Características
  numeroCamas: number;
  numeroCamasPequenas: number;
  numeroCamasSuite: number;
  numeroSofasCama: number;
  numeroBanos: number;
  numeroCocinas: number;
  
  // Servicio
  duracionServicio: number; // en minutos
  costeServicio: number; // en euros
  planningEstimatedCheckoutMinutes?: number | null;
  planningEstimatedStayMinutes?: number | null;
  planningRequiredCleaners?: number;
  planningComplexity?: number;
  planningRequiresLinenLoad?: boolean;
  planningRequiresAmenitiesLoad?: boolean;
  planningSpecialInstructions?: string | null;
  
  // Horarios predeterminados
  checkInPredeterminado: string; // formato HH:MM
  checkOutPredeterminado: string; // formato HH:MM
  
  // Apartado téxtil
  numeroSabanas: number;
  numeroSabanasRequenas: number;
  numeroSabanasSuite: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  kitAlimentario: number;
  
  // Amenities
  amenitiesBano: number;
  amenitiesCocina: number;
  
  // Consumibles
  cantidadRollosPapelHigienico: number;
  cantidadRollosPapelCocina: number;
  bayetasCocina: number;
  bolsasBasura: number;
  
  // Notas
  notas: string;
  
  // Vinculación
  clienteId: string;
  
  // Hostaway integration
  hostaway_listing_id: number | null;
  hostaway_internal_name: string | null;
  
  // Linen control (null = inherit from client)
  linenControlEnabled: boolean | null;
  
  // Active status (null = inherit from client)
  isActive: boolean | null;
  clientIsActive?: boolean | null;
  clientName?: string | null;
  
  // Export exclusion
  excludeFromExport: boolean;
  
  // Metadatos (mantenemos por compatibilidad, pero usamos los de BaseEntity)
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CreatePropertyData {
  codigo: string;
  nombre: string;
  direccion: string;
  numeroCamas: number;
  numeroCamasPequenas: number;
  numeroCamasSuite: number;
  numeroSofasCama: number;
  numeroBanos: number;
  numeroCocinas: number;
  duracionServicio: number;
  costeServicio: number;
  planningEstimatedCheckoutMinutes?: number | null;
  planningEstimatedStayMinutes?: number | null;
  planningRequiredCleaners?: number;
  planningComplexity?: number;
  planningRequiresLinenLoad?: boolean;
  planningRequiresAmenitiesLoad?: boolean;
  planningSpecialInstructions?: string | null;
  checkInPredeterminado: string;
  checkOutPredeterminado: string;
  numeroSabanas: number;
  numeroSabanasRequenas: number;
  numeroSabanasSuite: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  kitAlimentario: number;
  amenitiesBano: number;
  amenitiesCocina: number;
  cantidadRollosPapelHigienico: number;
  cantidadRollosPapelCocina: number;
  bayetasCocina?: number;
  bolsasBasura?: number;
  notas: string;
  clienteId: string;
  linenControlEnabled?: boolean | null;
  isActive?: boolean | null;
  excludeFromExport?: boolean;
}
