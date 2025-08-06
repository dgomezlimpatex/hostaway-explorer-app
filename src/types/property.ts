
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
  
  // Servicio
  duracionServicio: number; // en minutos
  costeServicio: number; // en euros
  
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
  
  // Notas
  notas: string;
  
  // Vinculación
  clienteId: string;
  
  // Hostaway integration
  hostaway_listing_id: number | null;
  hostaway_internal_name: string | null;
  
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
  duracionServicio: number;
  costeServicio: number;
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
  notas: string;
  clienteId: string;
}
