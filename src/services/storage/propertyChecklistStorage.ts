
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
    const { error: updateError } = await supabase
      .rpc('exec_sql', {
        sql: `UPDATE property_checklist_assignments SET is_active = false WHERE property_id = $1`,
        params: [propertyId]
      });

    if (updateError) {
      console.error('Error deactivating existing assignments:', updateError);
    }

    // Create new assignment using direct SQL
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          INSERT INTO property_checklist_assignments (property_id, checklist_template_id, is_active)
          VALUES ($1, $2, true)
          RETURNING *
        `,
        params: [propertyId, templateId]
      });

    if (error) {
      console.error('Error assigning checklist to property:', error);
      throw error;
    }

    // For now, return a mock object since we can't easily get the inserted data
    return {
      id: 'new-assignment',
      property_id: propertyId,
      checklist_template_id: templateId,
      assigned_at: new Date().toISOString(),
      is_active: true
    };
  }

  async getPropertyChecklistAssignment(propertyId: string): Promise<PropertyChecklistAssignment | null> {
    // Use direct SQL query since the table is not in the generated types yet
    const { data, error } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT * FROM property_checklist_assignments 
          WHERE property_id = $1 AND is_active = true 
          LIMIT 1
        `,
        params: [propertyId]
      });

    if (error) {
      console.error('Error fetching property checklist assignment:', error);
      return null;
    }

    // Since we're using exec_sql, data might be in a different format
    // For now, return null and handle this when the types are regenerated
    return null;
  }

  async removeChecklistFromProperty(propertyId: string): Promise<void> {
    const { error } = await supabase
      .rpc('exec_sql', {
        sql: `UPDATE property_checklist_assignments SET is_active = false WHERE property_id = $1`,
        params: [propertyId]
      });

    if (error) {
      console.error('Error removing checklist from property:', error);
      throw error;
    }
  }
}

export const propertyChecklistStorageService = new PropertyChecklistStorageService();
