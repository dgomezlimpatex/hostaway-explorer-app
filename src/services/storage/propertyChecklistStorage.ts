
import { supabase } from '@/integrations/supabase/client';

export interface PropertyChecklistAssignment {
  id: string;
  property_id: string;
  checklist_template_id: string;
  assigned_at: string;
  is_active: boolean;
}

export class PropertyChecklistStorageService {
  async assignChecklistToProperty(propertyId: string, templateId: string): Promise<PropertyChecklistAssignment> {
    // First, deactivate any existing assignments for this property
    await supabase
      .from('property_checklist_assignments')
      .update({ is_active: false })
      .eq('property_id', propertyId);

    // Create new assignment
    const { data, error } = await supabase
      .from('property_checklist_assignments')
      .insert({
        property_id: propertyId,
        checklist_template_id: templateId,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error assigning checklist to property:', error);
      throw error;
    }

    return data;
  }

  async getPropertyChecklistAssignment(propertyId: string): Promise<PropertyChecklistAssignment | null> {
    const { data, error } = await supabase
      .from('property_checklist_assignments')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No assignment found
      }
      console.error('Error fetching property checklist assignment:', error);
      throw error;
    }

    return data;
  }

  async removeChecklistFromProperty(propertyId: string): Promise<void> {
    const { error } = await supabase
      .from('property_checklist_assignments')
      .update({ is_active: false })
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error removing checklist from property:', error);
      throw error;
    }
  }
}

export const propertyChecklistStorageService = new PropertyChecklistStorageService();
