export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      assignment_patterns: {
        Row: {
          avg_completion_time_minutes: number | null
          cleaner_id: string | null
          day_of_week: number | null
          hour_of_day: number | null
          id: string
          last_updated: string | null
          preference_score: number | null
          property_group_id: string | null
          sample_size: number | null
          success_rate: number | null
        }
        Insert: {
          avg_completion_time_minutes?: number | null
          cleaner_id?: string | null
          day_of_week?: number | null
          hour_of_day?: number | null
          id?: string
          last_updated?: string | null
          preference_score?: number | null
          property_group_id?: string | null
          sample_size?: number | null
          success_rate?: number | null
        }
        Update: {
          avg_completion_time_minutes?: number | null
          cleaner_id?: string | null
          day_of_week?: number | null
          hour_of_day?: number | null
          id?: string
          last_updated?: string | null
          preference_score?: number | null
          property_group_id?: string | null
          sample_size?: number | null
          success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_patterns_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_patterns_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_assignment_logs: {
        Row: {
          algorithm_used: string | null
          assigned_cleaner_id: string | null
          assignment_reason: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          property_group_id: string | null
          task_id: string | null
          was_manual_override: boolean | null
        }
        Insert: {
          algorithm_used?: string | null
          assigned_cleaner_id?: string | null
          assignment_reason?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          property_group_id?: string | null
          task_id?: string | null
          was_manual_override?: boolean | null
        }
        Update: {
          algorithm_used?: string | null
          assigned_cleaner_id?: string | null
          assignment_reason?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          property_group_id?: string | null
          task_id?: string | null
          was_manual_override?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_assignment_logs_assigned_cleaner_id_fkey"
            columns: ["assigned_cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_assignment_logs_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_assignment_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_assignment_rules: {
        Row: {
          algorithm: string
          buffer_time_minutes: number | null
          consider_travel_time: boolean | null
          created_at: string | null
          id: string
          learn_from_history: boolean | null
          max_concurrent_tasks: number | null
          property_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          algorithm?: string
          buffer_time_minutes?: number | null
          consider_travel_time?: boolean | null
          created_at?: string | null
          id?: string
          learn_from_history?: boolean | null
          max_concurrent_tasks?: number | null
          property_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          algorithm?: string
          buffer_time_minutes?: number | null
          consider_travel_time?: boolean | null
          created_at?: string | null
          id?: string
          learn_from_history?: boolean | null
          max_concurrent_tasks?: number | null
          property_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_assignment_rules_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_availability: {
        Row: {
          cleaner_id: string
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          is_available: boolean
          start_time: string | null
          updated_at: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          is_available?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_available?: boolean
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_availability_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_group_assignments: {
        Row: {
          cleaner_id: string | null
          created_at: string | null
          estimated_travel_time_minutes: number | null
          id: string
          is_active: boolean
          max_tasks_per_day: number | null
          priority: number
          property_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          cleaner_id?: string | null
          created_at?: string | null
          estimated_travel_time_minutes?: number | null
          id?: string
          is_active?: boolean
          max_tasks_per_day?: number | null
          priority: number
          property_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cleaner_id?: string | null
          created_at?: string | null
          estimated_travel_time_minutes?: number | null
          id?: string
          is_active?: boolean
          max_tasks_per_day?: number | null
          priority?: number
          property_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_group_assignments_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_group_assignments_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_work_schedule: {
        Row: {
          cleaner_id: string
          created_at: string
          date: string
          id: string
          is_working_day: boolean | null
          notes: string | null
          schedule_type: string | null
          scheduled_end_time: string
          scheduled_start_time: string
          updated_at: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          date: string
          id?: string
          is_working_day?: boolean | null
          notes?: string | null
          schedule_type?: string | null
          scheduled_end_time: string
          scheduled_start_time: string
          updated_at?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          date?: string
          id?: string
          is_working_day?: boolean | null
          notes?: string | null
          schedule_type?: string | null
          scheduled_end_time?: string
          scheduled_start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_work_schedule_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaners: {
        Row: {
          avatar: string | null
          contract_hours_per_week: number | null
          contract_type: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          start_date: string | null
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar?: string | null
          contract_hours_per_week?: number | null
          contract_type?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          start_date?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar?: string | null
          contract_hours_per_week?: number | null
          contract_type?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          start_date?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          cif_nif: string
          ciudad: string
          codigo_postal: string
          created_at: string
          direccion_facturacion: string
          email: string
          factura: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          id: string
          metodo_pago: string
          nombre: string
          supervisor: string
          telefono: string
          tipo_servicio: string
          updated_at: string
        }
        Insert: {
          cif_nif: string
          ciudad: string
          codigo_postal: string
          created_at?: string
          direccion_facturacion: string
          email: string
          factura?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          metodo_pago: string
          nombre: string
          supervisor: string
          telefono: string
          tipo_servicio: string
          updated_at?: string
        }
        Update: {
          cif_nif?: string
          ciudad?: string
          codigo_postal?: string
          created_at?: string
          direccion_facturacion?: string
          email?: string
          factura?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          id?: string
          metodo_pago?: string
          nombre?: string
          supervisor?: string
          telefono?: string
          tipo_servicio?: string
          updated_at?: string
        }
        Relationships: []
      }
      hostaway_reservations: {
        Row: {
          adults: number | null
          arrival_date: string
          cancellation_date: string | null
          cliente_id: string | null
          created_at: string
          departure_date: string
          hostaway_reservation_id: number
          id: string
          last_sync_at: string
          nights: number | null
          property_id: string | null
          reservation_date: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          adults?: number | null
          arrival_date: string
          cancellation_date?: string | null
          cliente_id?: string | null
          created_at?: string
          departure_date: string
          hostaway_reservation_id: number
          id?: string
          last_sync_at?: string
          nights?: number | null
          property_id?: string | null
          reservation_date?: string | null
          status: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          adults?: number | null
          arrival_date?: string
          cancellation_date?: string | null
          cliente_id?: string | null
          created_at?: string
          departure_date?: string
          hostaway_reservation_id?: number
          id?: string
          last_sync_at?: string
          nights?: number | null
          property_id?: string | null
          reservation_date?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostaway_reservations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostaway_reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostaway_reservations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      hostaway_sync_logs: {
        Row: {
          cancelled_reservations: number | null
          created_at: string
          errors: string[] | null
          id: string
          new_reservations: number | null
          reservations_details: Json | null
          reservations_processed: number | null
          status: string
          sync_completed_at: string | null
          sync_started_at: string
          tasks_cancelled: number | null
          tasks_cancelled_details: Json | null
          tasks_created: number | null
          tasks_details: Json | null
          tasks_modified: number | null
          tasks_modified_details: Json | null
          updated_reservations: number | null
        }
        Insert: {
          cancelled_reservations?: number | null
          created_at?: string
          errors?: string[] | null
          id?: string
          new_reservations?: number | null
          reservations_details?: Json | null
          reservations_processed?: number | null
          status?: string
          sync_completed_at?: string | null
          sync_started_at: string
          tasks_cancelled?: number | null
          tasks_cancelled_details?: Json | null
          tasks_created?: number | null
          tasks_details?: Json | null
          tasks_modified?: number | null
          tasks_modified_details?: Json | null
          updated_reservations?: number | null
        }
        Update: {
          cancelled_reservations?: number | null
          created_at?: string
          errors?: string[] | null
          id?: string
          new_reservations?: number | null
          reservations_details?: Json | null
          reservations_processed?: number | null
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          tasks_cancelled?: number | null
          tasks_cancelled_details?: Json | null
          tasks_created?: number | null
          tasks_details?: Json | null
          tasks_modified?: number | null
          tasks_modified_details?: Json | null
          updated_reservations?: number | null
        }
        Relationships: []
      }
      inventory_alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["inventory_alert_type"]
          id: string
          is_active: boolean
          notified_users: Json
          product_id: string
          resolved_at: string | null
          triggered_at: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["inventory_alert_type"]
          id?: string
          is_active?: boolean
          notified_users?: Json
          product_id: string
          resolved_at?: string | null
          triggered_at?: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["inventory_alert_type"]
          id?: string
          is_active?: boolean
          notified_users?: Json
          product_id?: string
          resolved_at?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          new_quantity: number
          previous_quantity: number
          product_id: string
          property_id: string | null
          quantity: number
          reason: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          new_quantity: number
          previous_quantity: number
          product_id: string
          property_id?: string | null
          quantity: number
          reason: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          new_quantity?: number
          previous_quantity?: number
          product_id?: string
          property_id?: string | null
          quantity?: number
          reason?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          cost_per_unit: number | null
          current_quantity: number
          id: string
          last_updated: string
          maximum_stock: number
          minimum_stock: number
          product_id: string
          updated_by: string
        }
        Insert: {
          cost_per_unit?: number | null
          current_quantity?: number
          id?: string
          last_updated?: string
          maximum_stock?: number
          minimum_stock?: number
          product_id: string
          updated_by: string
        }
        Update: {
          cost_per_unit?: number | null
          current_quantity?: number
          id?: string
          last_updated?: string
          maximum_stock?: number
          minimum_stock?: number
          product_id?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_deliveries: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          picklist_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["logistics_delivery_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          picklist_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["logistics_delivery_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          picklist_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["logistics_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_deliveries_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "logistics_picklists"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_delivery_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          stop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          stop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          stop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_delivery_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_delivery_items_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "logistics_delivery_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_delivery_stops: {
        Row: {
          actual_time: string | null
          created_at: string
          delivery_id: string
          id: string
          notes: string | null
          planned_time: string | null
          property_id: string
          signature_url: string | null
          status: Database["public"]["Enums"]["logistics_stop_status"]
          updated_at: string
        }
        Insert: {
          actual_time?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          notes?: string | null
          planned_time?: string | null
          property_id: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["logistics_stop_status"]
          updated_at?: string
        }
        Update: {
          actual_time?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          notes?: string | null
          planned_time?: string | null
          property_id?: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["logistics_stop_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_delivery_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "logistics_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_delivery_stops_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_picklist_items: {
        Row: {
          created_at: string
          id: string
          picklist_id: string
          product_id: string
          property_id: string | null
          quantity: number
          reserved: boolean
          reserved_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          picklist_id: string
          product_id: string
          property_id?: string | null
          quantity?: number
          reserved?: boolean
          reserved_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          picklist_id?: string
          product_id?: string
          property_id?: string | null
          quantity?: number
          reserved?: boolean
          reserved_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_picklist_items_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "logistics_picklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_picklist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_picklist_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_picklists: {
        Row: {
          code: string
          committed_at: string | null
          committed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["logistics_picklist_status"]
          updated_at: string
        }
        Insert: {
          code: string
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["logistics_picklist_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["logistics_picklist_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          aceite: number
          acondicionador: number
          ambientador_bano: number
          amenities_bano: number
          amenities_cocina: number
          azucar: number
          bayetas_cocina: number
          bolsas_basura: number
          cantidad_rollos_papel_cocina: number
          cantidad_rollos_papel_higienico: number
          champu: number
          check_in_predeterminado: string
          check_out_predeterminado: string
          cliente_id: string
          codigo: string
          coste_servicio: number
          created_at: string
          desinfectante_bano: number
          detergente_lavavajillas: number
          direccion: string
          duracion_servicio: number
          estropajos: number
          fecha_actualizacion: string
          fecha_creacion: string
          gel_ducha: number
          hostaway_internal_name: string | null
          hostaway_listing_id: number | null
          id: string
          jabon_liquido: number
          kit_alimentario: number
          limpiacristales: number
          nombre: string
          notas: string | null
          numero_alfombrines: number
          numero_banos: number
          numero_camas: number
          numero_camas_pequenas: number
          numero_camas_suite: number
          numero_fundas_almohada: number
          numero_sabanas: number
          numero_sabanas_pequenas: number
          numero_sabanas_suite: number
          numero_sofas_cama: number
          numero_toallas_grandes: number
          numero_toallas_pequenas: number
          papel_cocina: number
          papel_higienico: number
          sal: number
          updated_at: string
          vinagre: number
        }
        Insert: {
          aceite?: number
          acondicionador?: number
          ambientador_bano?: number
          amenities_bano?: number
          amenities_cocina?: number
          azucar?: number
          bayetas_cocina?: number
          bolsas_basura?: number
          cantidad_rollos_papel_cocina?: number
          cantidad_rollos_papel_higienico?: number
          champu?: number
          check_in_predeterminado?: string
          check_out_predeterminado?: string
          cliente_id: string
          codigo: string
          coste_servicio?: number
          created_at?: string
          desinfectante_bano?: number
          detergente_lavavajillas?: number
          direccion: string
          duracion_servicio?: number
          estropajos?: number
          fecha_actualizacion?: string
          fecha_creacion?: string
          gel_ducha?: number
          hostaway_internal_name?: string | null
          hostaway_listing_id?: number | null
          id?: string
          jabon_liquido?: number
          kit_alimentario?: number
          limpiacristales?: number
          nombre: string
          notas?: string | null
          numero_alfombrines?: number
          numero_banos?: number
          numero_camas?: number
          numero_camas_pequenas?: number
          numero_camas_suite?: number
          numero_fundas_almohada?: number
          numero_sabanas?: number
          numero_sabanas_pequenas?: number
          numero_sabanas_suite?: number
          numero_sofas_cama?: number
          numero_toallas_grandes?: number
          numero_toallas_pequenas?: number
          papel_cocina?: number
          papel_higienico?: number
          sal?: number
          updated_at?: string
          vinagre?: number
        }
        Update: {
          aceite?: number
          acondicionador?: number
          ambientador_bano?: number
          amenities_bano?: number
          amenities_cocina?: number
          azucar?: number
          bayetas_cocina?: number
          bolsas_basura?: number
          cantidad_rollos_papel_cocina?: number
          cantidad_rollos_papel_higienico?: number
          champu?: number
          check_in_predeterminado?: string
          check_out_predeterminado?: string
          cliente_id?: string
          codigo?: string
          coste_servicio?: number
          created_at?: string
          desinfectante_bano?: number
          detergente_lavavajillas?: number
          direccion?: string
          duracion_servicio?: number
          estropajos?: number
          fecha_actualizacion?: string
          fecha_creacion?: string
          gel_ducha?: number
          hostaway_internal_name?: string | null
          hostaway_listing_id?: number | null
          id?: string
          jabon_liquido?: number
          kit_alimentario?: number
          limpiacristales?: number
          nombre?: string
          notas?: string | null
          numero_alfombrines?: number
          numero_banos?: number
          numero_camas?: number
          numero_camas_pequenas?: number
          numero_camas_suite?: number
          numero_fundas_almohada?: number
          numero_sabanas?: number
          numero_sabanas_pequenas?: number
          numero_sabanas_suite?: number
          numero_sofas_cama?: number
          numero_toallas_grandes?: number
          numero_toallas_pequenas?: number
          papel_cocina?: number
          papel_higienico?: number
          sal?: number
          updated_at?: string
          vinagre?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenity_inventory_mapping: {
        Row: {
          amenity_field: string
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          updated_at: string
        }
        Insert: {
          amenity_field: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          updated_at?: string
        }
        Update: {
          amenity_field?: string
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenity_inventory_mapping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
        ]
      }
      property_checklist_assignments: {
        Row: {
          assigned_at: string
          checklist_template_id: string
          created_at: string
          id: string
          is_active: boolean
          property_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          checklist_template_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          property_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          checklist_template_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_checklist_assignments_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "task_checklists_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_checklist_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_consumption_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          property_id: string
          quantity_per_cleaning: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          property_id: string
          quantity_per_cleaning?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          property_id?: string
          quantity_per_cleaning?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_consumption_config_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_consumption_config_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_group_assignments: {
        Row: {
          created_at: string | null
          id: string
          property_group_id: string | null
          property_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_group_id?: string | null
          property_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          property_group_id?: string | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_group_assignments_property_group_id_fkey"
            columns: ["property_group_id"]
            isOneToOne: false
            referencedRelation: "property_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_group_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_groups: {
        Row: {
          auto_assign_enabled: boolean
          check_in_time: string
          check_out_time: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          auto_assign_enabled?: boolean
          check_in_time?: string
          check_out_time?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          auto_assign_enabled?: boolean
          check_in_time?: string
          check_out_time?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      recurring_tasks: {
        Row: {
          check_in: string
          check_out: string
          cleaner: string | null
          cleaner_id: string | null
          cliente_id: string | null
          coste: number | null
          created_at: string
          day_of_month: number | null
          days_of_week: number[] | null
          description: string | null
          duracion: number | null
          end_date: string | null
          end_time: string
          frequency: string
          id: string
          interval_days: number
          is_active: boolean
          last_execution: string | null
          metodo_pago: string | null
          name: string
          next_execution: string
          propiedad_id: string | null
          start_date: string
          start_time: string
          supervisor: string | null
          type: string
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          cleaner?: string | null
          cleaner_id?: string | null
          cliente_id?: string | null
          coste?: number | null
          created_at?: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          description?: string | null
          duracion?: number | null
          end_date?: string | null
          end_time: string
          frequency: string
          id?: string
          interval_days?: number
          is_active?: boolean
          last_execution?: string | null
          metodo_pago?: string | null
          name: string
          next_execution: string
          propiedad_id?: string | null
          start_date: string
          start_time: string
          supervisor?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          cleaner?: string | null
          cleaner_id?: string | null
          cliente_id?: string | null
          coste?: number | null
          created_at?: string
          day_of_month?: number | null
          days_of_week?: number[] | null
          description?: string | null
          duracion?: number | null
          end_date?: string | null
          end_time?: string
          frequency?: string
          id?: string
          interval_days?: number
          is_active?: boolean
          last_execution?: string | null
          metodo_pago?: string | null
          name?: string
          next_execution?: string
          propiedad_id?: string | null
          start_date?: string
          start_time?: string
          supervisor?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_tasks_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_tasks_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_rate_limits: {
        Row: {
          action_type: string
          attempt_count: number
          blocked_until: string | null
          created_at: string
          first_attempt_at: string
          id: string
          identifier: string
          last_attempt_at: string
          updated_at: string
        }
        Insert: {
          action_type: string
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier: string
          last_attempt_at?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          first_attempt_at?: string
          id?: string
          identifier?: string
          last_attempt_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          cleaner_id: string
          cleaner_name: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          cleaner_id: string
          cleaner_name: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          cleaner_id?: string
          cleaner_name?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists_templates: {
        Row: {
          checklist_items: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          property_type: string
          template_name: string
          updated_at: string
        }
        Insert: {
          checklist_items?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          property_type: string
          template_name: string
          updated_at?: string
        }
        Update: {
          checklist_items?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          property_type?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_media: {
        Row: {
          checklist_item_id: string | null
          created_at: string
          description: string | null
          file_size: number | null
          file_url: string
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          task_report_id: string
          timestamp: string
        }
        Insert: {
          checklist_item_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          media_type: Database["public"]["Enums"]["media_type"]
          task_report_id: string
          timestamp?: string
        }
        Update: {
          checklist_item_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          task_report_id?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_media_task_report_id_fkey"
            columns: ["task_report_id"]
            isOneToOne: false
            referencedRelation: "task_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reports: {
        Row: {
          checklist_completed: Json
          checklist_template_id: string | null
          cleaner_id: string | null
          created_at: string
          end_time: string | null
          id: string
          issues_found: Json | null
          notes: string | null
          overall_status: Database["public"]["Enums"]["report_status"]
          start_time: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          checklist_completed?: Json
          checklist_template_id?: string | null
          cleaner_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          issues_found?: Json | null
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["report_status"]
          start_time?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          checklist_completed?: Json
          checklist_template_id?: string | null
          cleaner_id?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          issues_found?: Json | null
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["report_status"]
          start_time?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "task_checklists_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reports_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          address: string
          assignment_confidence: number | null
          auto_assigned: boolean | null
          background_color: string | null
          check_in: string
          check_out: string
          cleaner: string | null
          cleaner_id: string | null
          cliente_id: string | null
          coste: number | null
          created_at: string
          date: string
          duracion: number | null
          end_time: string
          extraordinary_billing_address: string | null
          extraordinary_client_email: string | null
          extraordinary_client_name: string | null
          extraordinary_client_phone: string | null
          id: string
          metodo_pago: string | null
          notes: string | null
          property: string
          propiedad_id: string | null
          start_time: string
          status: string
          supervisor: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address: string
          assignment_confidence?: number | null
          auto_assigned?: boolean | null
          background_color?: string | null
          check_in: string
          check_out: string
          cleaner?: string | null
          cleaner_id?: string | null
          cliente_id?: string | null
          coste?: number | null
          created_at?: string
          date: string
          duracion?: number | null
          end_time: string
          extraordinary_billing_address?: string | null
          extraordinary_client_email?: string | null
          extraordinary_client_name?: string | null
          extraordinary_client_phone?: string | null
          id?: string
          metodo_pago?: string | null
          notes?: string | null
          property: string
          propiedad_id?: string | null
          start_time: string
          status?: string
          supervisor?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string
          assignment_confidence?: number | null
          auto_assigned?: boolean | null
          background_color?: string | null
          check_in?: string
          check_out?: string
          cleaner?: string | null
          cleaner_id?: string | null
          cliente_id?: string | null
          coste?: number | null
          created_at?: string
          date?: string
          duracion?: number | null
          end_time?: string
          extraordinary_billing_address?: string | null
          extraordinary_client_email?: string | null
          extraordinary_client_name?: string | null
          extraordinary_client_phone?: string | null
          id?: string
          metodo_pago?: string | null
          notes?: string | null
          property?: string
          propiedad_id?: string | null
          start_time?: string
          status?: string
          supervisor?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_duration_minutes: number | null
          cleaner_id: string
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          overtime_hours: number | null
          status: string | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          cleaner_id: string
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_duration_minutes?: number | null
          cleaner_id?: string
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          status?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_token: string | null
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"] | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"] | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"] | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      task_reports_grouped: {
        Row: {
          completed_reports: number | null
          earliest_start_time: string | null
          in_progress_reports: number | null
          individual_reports: Json[] | null
          latest_end_time: string | null
          needs_review_reports: number | null
          pending_reports: number | null
          task_id: string | null
          total_reports: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_reports_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { invitation_token: string; input_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      check_rate_limit: {
        Args: {
          check_identifier: string
          check_action_type: string
          max_attempts?: number
          window_minutes?: number
          block_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_invitations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_user_invitation_secure: {
        Args: {
          invite_email: string
          invite_role: string
          expires_hours?: number
        }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      log_security_event: {
        Args: { event_type: string; event_data?: Json; target_user_id?: string }
        Returns: undefined
      }
      process_automatic_inventory_consumption: {
        Args: {
          task_id_param: string
          property_id_param: string
          user_id_param: string
        }
        Returns: undefined
      }
      reset_rate_limit: {
        Args: { reset_identifier: string; reset_action_type: string }
        Returns: undefined
      }
      update_cleaners_order: {
        Args: { cleaner_updates: Json[] }
        Returns: undefined
      }
      user_has_role: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      user_is_admin_or_manager: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      verify_invitation: {
        Args: { token: string; email: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "supervisor"
        | "cleaner"
        | "client"
        | "logistics"
      inventory_alert_type: "stock_bajo" | "stock_critico"
      inventory_movement_type:
        | "entrada"
        | "salida"
        | "ajuste"
        | "consumo_automatico"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      logistics_delivery_status:
        | "planned"
        | "in_transit"
        | "completed"
        | "cancelled"
      logistics_picklist_status:
        | "draft"
        | "preparing"
        | "packed"
        | "committed"
        | "cancelled"
      logistics_stop_status: "pending" | "delivered" | "failed" | "skipped"
      media_type: "photo" | "video"
      report_status: "pending" | "in_progress" | "completed" | "needs_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "supervisor",
        "cleaner",
        "client",
        "logistics",
      ],
      inventory_alert_type: ["stock_bajo", "stock_critico"],
      inventory_movement_type: [
        "entrada",
        "salida",
        "ajuste",
        "consumo_automatico",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      logistics_delivery_status: [
        "planned",
        "in_transit",
        "completed",
        "cancelled",
      ],
      logistics_picklist_status: [
        "draft",
        "preparing",
        "packed",
        "committed",
        "cancelled",
      ],
      logistics_stop_status: ["pending", "delivered", "failed", "skipped"],
      media_type: ["photo", "video"],
      report_status: ["pending", "in_progress", "completed", "needs_review"],
    },
  },
} as const
