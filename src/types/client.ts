
import { BaseEntity } from './common';

export interface Client extends BaseEntity {
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
  tipoServicio: 'limpieza-mantenimiento' | 'mantenimiento-cristaleria' | 'limpieza-turistica' | 'limpieza-puesta-punto' | 'limpieza-final-obra' | 'check-in' | 'desplazamiento' | 'limpieza-especial' | 'trabajo-extraordinario';
  metodoPago: 'transferencia' | 'efectivo' | 'bizum';
  supervisor: string;
  factura: boolean;
  linenControlEnabled?: boolean;
  photosVisibleToClient?: boolean;
  isActive: boolean;
  
  // Metadatos (mantenemos por compatibilidad, pero usamos los de BaseEntity)
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
  tipoServicio: 'limpieza-mantenimiento' | 'mantenimiento-cristaleria' | 'limpieza-turistica' | 'limpieza-puesta-punto' | 'limpieza-final-obra' | 'check-in' | 'desplazamiento' | 'limpieza-especial' | 'trabajo-extraordinario';
  metodoPago: 'transferencia' | 'efectivo' | 'bizum';
  supervisor: string;
  factura: boolean;
  linenControlEnabled?: boolean;
  photosVisibleToClient?: boolean;
  isActive?: boolean;
}
