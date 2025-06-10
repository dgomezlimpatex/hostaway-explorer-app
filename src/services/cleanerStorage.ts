
import { supabase } from '@/integrations/supabase/client';
import { Cleaner } from '@/types/calendar';

export interface CreateCleanerData {
  name: string;
  email?: string;
  telefono?: string;
  avatar?: string;
  isActive?: boolean;
}

export const cleanerStorage = {
  getAll: async (): Promise<Cleaner[]> => {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching cleaners:', error);
      throw error;
    }

    return data?.map(row => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      isActive: row.is_active
    })) || [];
  },

  getById: async (id: string): Promise<Cleaner | undefined> => {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No data found
      }
      console.error('Error fetching cleaner:', error);
      throw error;
    }

    if (!data) return undefined;

    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      isActive: data.is_active
    };
  },

  create: async (cleanerData: CreateCleanerData): Promise<Cleaner> => {
    const { data, error } = await supabase
      .from('cleaners')
      .insert({
        name: cleanerData.name,
        email: cleanerData.email,
        telefono: cleanerData.telefono,
        avatar: cleanerData.avatar,
        is_active: cleanerData.isActive ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating cleaner:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      isActive: data.is_active
    };
  },

  update: async (id: string, updates: Partial<CreateCleanerData>): Promise<Cleaner | null> => {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.telefono !== undefined) updateData.telefono = updates.telefono;
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('cleaners')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No data found
      }
      console.error('Error updating cleaner:', error);
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      isActive: data.is_active
    };
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('cleaners')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting cleaner:', error);
      throw error;
    }

    return true;
  }
};
