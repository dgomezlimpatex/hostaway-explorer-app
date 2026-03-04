import { supabase } from "@/integrations/supabase/client";

export interface PropertyPreferredCleaner {
  id: string;
  property_id: string;
  cleaner_id: string;
  priority: number;
  notes: string | null;
  created_at: string;
  cleaner_name?: string;
}

export const propertyPreferredCleanersStorage = {
  async getByPropertyId(propertyId: string): Promise<PropertyPreferredCleaner[]> {
    const { data, error } = await supabase
      .from('property_preferred_cleaners' as any)
      .select('*, cleaners(name)')
      .eq('property_id', propertyId)
      .order('priority', { ascending: true });

    if (error) throw error;

    return (data as any[] || []).map((item: any) => ({
      id: item.id,
      property_id: item.property_id,
      cleaner_id: item.cleaner_id,
      priority: item.priority,
      notes: item.notes,
      created_at: item.created_at,
      cleaner_name: item.cleaners?.name,
    }));
  },

  async getPreferredCleanerIdsByPropertyName(propertyName: string): Promise<{ cleaner_id: string; priority: number; notes: string | null }[]> {
    const { data, error } = await supabase
      .from('properties' as any)
      .select('id')
      .eq('nombre', propertyName)
      .single();

    if (error || !data) return [];

    const { data: prefs, error: prefsError } = await supabase
      .from('property_preferred_cleaners' as any)
      .select('cleaner_id, priority, notes')
      .eq('property_id', (data as any).id)
      .order('priority', { ascending: true });

    if (prefsError) return [];
    return (prefs as any[]) || [];
  },

  async assign(propertyId: string, cleanerId: string, priority: number = 0, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('property_preferred_cleaners' as any)
      .upsert({
        property_id: propertyId,
        cleaner_id: cleanerId,
        priority,
        notes: notes || null,
      } as any, { onConflict: 'property_id,cleaner_id' });

    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('property_preferred_cleaners' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async updatePriority(id: string, priority: number): Promise<void> {
    const { error } = await supabase
      .from('property_preferred_cleaners' as any)
      .update({ priority } as any)
      .eq('id', id);

    if (error) throw error;
  },

  async copyFromProperty(sourcePropertyId: string, targetPropertyId: string): Promise<void> {
    const sourceCleaners = await this.getByPropertyId(sourcePropertyId);
    for (const cleaner of sourceCleaners) {
      await this.assign(targetPropertyId, cleaner.cleaner_id, cleaner.priority, cleaner.notes || undefined);
    }
  },
};
