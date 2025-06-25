
import { supabase } from '@/integrations/supabase/client';
import { TaskChecklistTemplate } from '@/types/taskReports';

export class ChecklistTemplatesStorageService {
  async getChecklistTemplates(): Promise<TaskChecklistTemplate[]> {
    const { data, error } = await supabase
      .from('task_checklists_templates')
      .select('*')
      .eq('is_active', true)
      .order('template_name');

    if (error) {
      console.error('Error fetching checklist templates:', error);
      throw error;
    }

    // Transform JSON data to proper types
    return (data || []).map(item => ({
      ...item,
      checklist_items: item.checklist_items as any
    }));
  }

  async getChecklistTemplateByPropertyType(propertyType: string): Promise<TaskChecklistTemplate | null> {
    const { data, error } = await supabase
      .from('task_checklists_templates')
      .select('*')
      .eq('property_type', propertyType)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No template found
      }
      console.error('Error fetching checklist template:', error);
      throw error;
    }

    return {
      ...data,
      checklist_items: data.checklist_items as any
    };
  }

  async createChecklistTemplate(templateData: Omit<TaskChecklistTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<TaskChecklistTemplate> {
    // Convert checklist_items to JSON for database storage
    const dbData = {
      ...templateData,
      checklist_items: templateData.checklist_items as any
    };

    const { data, error } = await supabase
      .from('task_checklists_templates')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating checklist template:', error);
      throw error;
    }

    return {
      ...data,
      checklist_items: data.checklist_items as any
    };
  }

  async updateChecklistTemplate(templateId: string, updates: Partial<TaskChecklistTemplate>): Promise<TaskChecklistTemplate> {
    // Convert checklist_items to JSON for database storage if present
    const dbUpdates = {
      ...updates,
      ...(updates.checklist_items && { checklist_items: updates.checklist_items as any })
    };

    const { data, error } = await supabase
      .from('task_checklists_templates')
      .update(dbUpdates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating checklist template:', error);
      throw error;
    }

    return {
      ...data,
      checklist_items: data.checklist_items as any
    };
  }

  async deleteChecklistTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('task_checklists_templates')
      .update({ is_active: false })
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting checklist template:', error);
      throw error;
    }
  }
}

export const checklistTemplatesStorageService = new ChecklistTemplatesStorageService();
