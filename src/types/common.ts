
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface ServiceInfo {
  type: string;
  duration: number;
  cost: number;
}

export interface ContactInfo {
  email: string;
  telefono: string;
}

export interface Address {
  direccion: string;
  ciudad: string;
  codigo_postal: string;
}
