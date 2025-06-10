
export interface Client {
  id: string;
  // Información Personal
  nombre: string;
  cifNif: string;
  
  // Información de Contacto
  telefono: string;
  email: string;
  
  // Dirección
  direccionFacturacion: string;
  codigoPostal: string;
  ciudad: string;
  
  // Información de Servicio
  tipoServicio: 'limpieza-mantenimiento' | 'mantenimiento-cristaleria' | 'mantenimiento-airbnb' | 'limpieza-puesta-punto' | 'limpieza-final-obra' | 'check-in' | 'desplazamiento' | 'limpieza-especial' | 'trabajo-extraordinario';
  metodoPago: 'transferencia' | 'efectivo' | 'bizum';
  supervisor: string;
  factura: boolean;
  
  // Metadatos
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CreateClientData {
  nombre: string;
  cifNif: string;
  telefono: string;
  email: string;
  direccionFacturacion: string;
  codigoPostal: string;
  ciudad: string;
  tipoServicio: 'limpieza-mantenimiento' | 'mantenimiento-cristaleria' | 'mantenimiento-airbnb' | 'limpieza-puesta-punto' | 'limpieza-final-obra' | 'check-in' | 'desplazamiento' | 'limpieza-especial' | 'trabajo-extraordinario';
  metodoPago: 'transferencia' | 'efectivo' | 'bizum';
  supervisor: string;
  factura: boolean;
}
