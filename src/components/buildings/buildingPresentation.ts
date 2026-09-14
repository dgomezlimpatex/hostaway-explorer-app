import type { PropertyGroup } from '@/types/propertyGroups';
import type { SupervisionBuildingCoverage } from '@/hooks/useSupervisionBuildingCoverage';

export function buildingSetup(group: PropertyGroup, propertyCount: number, teamCount: number) {
  if (!propertyCount) return { rank: 0, label: 'Faltan propiedades', helper: 'Vincula las propiedades desde la ficha del edificio.', className: 'bg-red-50 text-red-800' };
  if (!teamCount) return { rank: 1, label: 'Falta equipo', helper: 'Asigna titulares, suplentes o personal de apoyo.', className: 'bg-amber-50 text-amber-800' };
  if (!group.autoAssignEnabled) return { rank: 2, label: 'Listo para probar', helper: 'Ya tiene propiedades y equipo. Revisa su configuración antes de activar la asignación automática.', className: 'bg-sky-50 text-sky-800' };
  return { rank: 3, label: 'Configurado', helper: 'Propiedades, equipo y asignación automática configurados.', className: 'bg-emerald-50 text-emerald-800' };
}

export interface BuildingDirectoryItem {
  group: PropertyGroup;
  propertyCount: number;
  teamCount: number;
  excludedCount: number;
  primaryCount: number;
  secondaryCount: number;
  backupCount: number;
  setup: ReturnType<typeof buildingSetup>;
  coverage?: SupervisionBuildingCoverage;
}
