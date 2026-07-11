import type { CleaningPlanningTask, DetectedBuilding } from '../../types/cleaningPlanning';
import type { PropertyGroup } from '../../types/propertyGroups';

const isValidOperationalWindow = (checkOut?: string | null, checkIn?: string | null): boolean => {
  if (!checkOut || !checkIn) return false;
  const [outHours = 0, outMinutes = 0] = checkOut.split(':').map(Number);
  const [inHours = 0, inMinutes = 0] = checkIn.split(':').map(Number);
  if (![outHours, outMinutes, inHours, inMinutes].every(Number.isFinite)) return false;
  const checkOutValue = outHours * 60 + outMinutes;
  const checkInValue = inHours * 60 + inMinutes;
  return checkOutValue >= 0 && checkInValue <= 24 * 60 - 1 && checkInValue > checkOutValue;
};

export const applyBuildingOperationalWindow = (
  task: CleaningPlanningTask,
  detectedBuilding: DetectedBuilding,
  propertyGroups: PropertyGroup[],
): CleaningPlanningTask => {
  if (detectedBuilding.status !== 'detected' || !detectedBuilding.propertyGroupId) return task;

  const group = propertyGroups.find((entry) => (
    entry.id === detectedBuilding.propertyGroupId && entry.isActive
  ));
  if (!group || !isValidOperationalWindow(group.checkOutTime, group.checkInTime)) return task;

  return {
    ...task,
    checkOut: group.checkOutTime,
    checkIn: group.checkInTime,
  };
};
