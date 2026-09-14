import type { Property } from '@/types/property';

export const isPropertyActive = (property: Property, clientIsActive?: boolean | null) =>
  property.isActive ?? ((clientIsActive ?? property.clientIsActive) !== false);

// Keep quarter-hour durations exact: 75 minutes is 1,25 h, not 1,3 h.
export const propertyDuration = (minutes?: number | null) =>
  `${((minutes || 0) / 60).toLocaleString('es-ES', { maximumFractionDigits: 2 })} h`;

export const propertyBedCount = (property: Property) =>
  (property.numeroCamas || 0) + (property.numeroCamasPequenas || 0) + (property.numeroCamasSuite || 0) + (property.numeroSofasCama || 0);
