import { Client } from '@/types/client';

export const CLIENT_SERVICE_LABELS: Record<Client['tipoServicio'], string> = {
  'limpieza-mantenimiento': 'Limpieza y mantenimiento',
  'mantenimiento-cristaleria': 'Mantenimiento de cristalería',
  'limpieza-turistica': 'Limpieza turística',
  'limpieza-puesta-punto': 'Limpieza de puesta a punto',
  'limpieza-final-obra': 'Limpieza de final de obra',
  'check-in': 'Check-in',
  desplazamiento: 'Desplazamiento',
  'limpieza-especial': 'Limpieza especial',
  'trabajo-extraordinario': 'Trabajo extraordinario',
};

export const clientInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
