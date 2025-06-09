
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
  tipoServicio: 'mantenimiento' | 'cristaleria' | 'airbnb' | 'otro';
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
  tipoServicio: 'mantenimiento' | 'cristaleria' | 'airbnb' | 'otro';
  metodoPago: 'transferencia' | 'efectivo' | 'bizum';
  supervisor: string;
  factura: boolean;
}
