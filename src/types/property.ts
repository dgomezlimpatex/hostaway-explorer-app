
export interface Property {
  id: string;
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
  
  // Apartado téxtil
  numeroSabanas: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  
  // Notas
  notas: string;
  
  // Vinculación
  clienteId: string;
  
  // Metadatos
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
  numeroSabanas: number;
  numeroToallasGrandes: number;
  numeroTotallasPequenas: number;
  numeroAlfombrines: number;
  numeroFundasAlmohada: number;
  notas: string;
  clienteId: string;
}
