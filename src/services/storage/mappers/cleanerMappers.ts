
import { Cleaner } from '@/types/calendar';
import { CreateCleanerData } from '@/services/cleanerStorage';

export const mapCleanerFromDB = (row: any): Cleaner => ({
  id: row.id,
  created_at: row.created_at,
  updated_at: row.updated_at,
  name: row.name,
  email: row.email,
  telefono: row.telefono,
  avatar: row.avatar,
  isActive: row.is_active,
  sortOrder: row.sort_order,
  user_id: row.user_id,
  contractHoursPerWeek: row.contract_hours_per_week,
  hourlyRate: row.hourly_rate,
  contractType: row.contract_type,
  startDate: row.start_date,
  emergencyContactName: row.emergency_contact_name,
  emergencyContactPhone: row.emergency_contact_phone,
  externalId: row.external_id,
  firstName: row.first_name,
  lastName: row.last_name,
  dni: row.dni,
  pin: row.pin,
  category: row.category,
  delegationName: row.delegation_name,
  officeName: row.office_name,
  planningMaxDailyMinutes: row.planning_max_daily_minutes ?? 480,
  planningZone: row.planning_zone ?? null,
  planningOperationalRestrictions: row.planning_operational_restrictions ?? null,
  planningCanHandleLinenLoad: row.planning_can_handle_linen_load ?? true,
  planningCanHandleComplexCleanings: row.planning_can_handle_complex_cleanings ?? true,
});

export const mapCleanerToDB = (cleaner: Partial<CreateCleanerData>): any => {
  const updateData: any = {};
  
  if (cleaner.name !== undefined) updateData.name = cleaner.name;
  if (cleaner.email !== undefined) updateData.email = cleaner.email;
  if (cleaner.telefono !== undefined) updateData.telefono = cleaner.telefono;
  if (cleaner.avatar !== undefined) updateData.avatar = cleaner.avatar;
  if (cleaner.isActive !== undefined) updateData.is_active = cleaner.isActive;
  if (cleaner.sortOrder !== undefined) updateData.sort_order = cleaner.sortOrder;
  if (cleaner.contractHoursPerWeek !== undefined) updateData.contract_hours_per_week = cleaner.contractHoursPerWeek;
  if (cleaner.hourlyRate !== undefined) updateData.hourly_rate = cleaner.hourlyRate;
  if (cleaner.contractType !== undefined) updateData.contract_type = cleaner.contractType;
  if (cleaner.startDate !== undefined) updateData.start_date = cleaner.startDate || null;
  if (cleaner.emergencyContactName !== undefined) updateData.emergency_contact_name = cleaner.emergencyContactName;
  if (cleaner.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = cleaner.emergencyContactPhone;
  if (cleaner.sede_id !== undefined) updateData.sede_id = cleaner.sede_id;
  if ((cleaner as any).planningMaxDailyMinutes !== undefined) updateData.planning_max_daily_minutes = (cleaner as any).planningMaxDailyMinutes;
  if ((cleaner as any).planningZone !== undefined) updateData.planning_zone = (cleaner as any).planningZone;
  if ((cleaner as any).planningOperationalRestrictions !== undefined) updateData.planning_operational_restrictions = (cleaner as any).planningOperationalRestrictions;
  if ((cleaner as any).planningCanHandleLinenLoad !== undefined) updateData.planning_can_handle_linen_load = (cleaner as any).planningCanHandleLinenLoad;
  if ((cleaner as any).planningCanHandleComplexCleanings !== undefined) updateData.planning_can_handle_complex_cleanings = (cleaner as any).planningCanHandleComplexCleanings;

  return updateData;
};
