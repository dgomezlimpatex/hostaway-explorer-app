import { supabase } from '@/integrations/supabase/client';

export interface AmenityMapping {
  id: string;
  amenity_field: string;
  product_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
    category: {
      name: string;
    };
  };
}

export interface CreateAmenityMapping {
  amenity_field: string;
  product_id: string;
}

class AmenityMappingStorage {
  async getAmenityMappings(): Promise<AmenityMapping[]> {
    const { data, error } = await supabase
      .from('property_amenity_inventory_mapping')
      .select(`
        *,
        product:inventory_products(
          name,
          category:inventory_categories(name)
        )
      `)
      .eq('is_active', true)
      .order('amenity_field');

    if (error) {
      console.error('Error fetching amenity mappings:', error);
      throw error;
    }

    return data || [];
  }

  async createAmenityMapping(mapping: CreateAmenityMapping): Promise<AmenityMapping> {
    const { data, error } = await supabase
      .from('property_amenity_inventory_mapping')
      .insert([mapping])
      .select(`
        *,
        product:inventory_products(
          name,
          category:inventory_categories(name)
        )
      `)
      .single();

    if (error) {
      console.error('Error creating amenity mapping:', error);
      throw error;
    }

    return data;
  }

  async updateAmenityMapping(id: string, mapping: Partial<CreateAmenityMapping>): Promise<AmenityMapping> {
    const { data, error } = await supabase
      .from('property_amenity_inventory_mapping')
      .update(mapping)
      .eq('id', id)
      .select(`
        *,
        product:inventory_products(
          name,
          category:inventory_categories(name)
        )
      `)
      .single();

    if (error) {
      console.error('Error updating amenity mapping:', error);
      throw error;
    }

    return data;
  }

  async deleteAmenityMapping(id: string): Promise<void> {
    const { error } = await supabase
      .from('property_amenity_inventory_mapping')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting amenity mapping:', error);
      throw error;
    }
  }

  async processAutomaticConsumption(taskId: string, propertyId: string): Promise<void> {
    const { error } = await supabase.rpc('process_automatic_inventory_consumption', {
      task_id_param: taskId,
      property_id_param: propertyId,
      user_id_param: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      console.error('Error processing automatic consumption:', error);
      throw error;
    }
  }
}

export const amenityMappingStorage = new AmenityMappingStorage();