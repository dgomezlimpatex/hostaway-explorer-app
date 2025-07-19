
import { BaseEntity } from './common';

export interface Property extends BaseEntity {
  // Información básica
  codigo: string;
  nombre: string;
  direccion: string;
  
  // Características
  numeroCamas: number;
  numeroBanos: number;
  
  // Servicio
  duracionServicio: number; // en minutos
  costeServicio: number; // en euros
  
  // Horarios predeterminados
  checkInPredeterminado: string; // formato HH:MM
  checkOutPredeterminado: string; // formato HH:MM
  
  // Apartado téxtil
  numeroSabanas: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  kitAlimentario: number;
  
  // Amenities de baño
  jabonLiquido: number;
  gelDucha: number;
  champu: number;
  acondicionador: number;
  papelHigienico: number;
  ambientadorBano: number;
  desinfectanteBano: number;
  
  // Amenities de cocina
  aceite: number;
  sal: number;
  azucar: number;
  vinagre: number;
  detergenteLavavajillas: number;
  limpiacristales: number;
  bayetasCocina: number;
  estropajos: number;
  bolsasBasura: number;
  papelCocina: number;
  
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
  numeroBanos: number;
  duracionServicio: number;
  costeServicio: number;
  checkInPredeterminado: string;
  checkOutPredeterminado: string;
  numeroSabanas: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  kitAlimentario: number;
  
  // Amenities de baño
  jabonLiquido: number;
  gelDucha: number;
  champu: number;
  acondicionador: number;
  papelHigienico: number;
  ambientadorBano: number;
  desinfectanteBano: number;
  
  // Amenities de cocina
  aceite: number;
  sal: number;
  azucar: number;
  vinagre: number;
  detergenteLavavajillas: number;
  limpiacristales: number;
  bayetasCocina: number;
  estropajos: number;
  bolsasBasura: number;
  papelCocina: number;
  notas: string;
  clienteId: string;
}
