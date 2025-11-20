
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
  emergencyContactPhone: row.emergency_contact_phone
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
  if (cleaner.startDate !== undefined) updateData.start_date = cleaner.startDate;
  if (cleaner.emergencyContactName !== undefined) updateData.emergency_contact_name = cleaner.emergencyContactName;
  if (cleaner.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = cleaner.emergencyContactPhone;
  if (cleaner.sede_id !== undefined) updateData.sede_id = cleaner.sede_id;

  return updateData;
};
