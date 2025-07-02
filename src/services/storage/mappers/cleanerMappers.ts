
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
  user_id: row.user_id
});

export const mapCleanerToDB = (cleaner: Partial<CreateCleanerData>): any => {
  const updateData: any = {};
  
  if (cleaner.name !== undefined) updateData.name = cleaner.name;
  if (cleaner.email !== undefined) updateData.email = cleaner.email;
  if (cleaner.telefono !== undefined) updateData.telefono = cleaner.telefono;
  if (cleaner.avatar !== undefined) updateData.avatar = cleaner.avatar;
  if (cleaner.isActive !== undefined) updateData.is_active = cleaner.isActive;
  if (cleaner.sortOrder !== undefined) updateData.sort_order = cleaner.sortOrder;

  return updateData;
};
