
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
}

export const checklistTemplatesStorageService = new ChecklistTemplatesStorageService();
