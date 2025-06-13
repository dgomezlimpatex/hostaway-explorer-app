export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      cleaners: {
        Row: {
          avatar: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          telefono?: string | null
          updated_at?: string
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
          reservations_processed: number | null
          status: string
          sync_completed_at: string | null
          sync_started_at: string
          tasks_created: number | null
          updated_reservations: number | null
        }
        Insert: {
          cancelled_reservations?: number | null
          created_at?: string
          errors?: string[] | null
          id?: string
          new_reservations?: number | null
          reservations_processed?: number | null
          status?: string
          sync_completed_at?: string | null
          sync_started_at: string
          tasks_created?: number | null
          updated_reservations?: number | null
        }
        Update: {
          cancelled_reservations?: number | null
          created_at?: string
          errors?: string[] | null
          id?: string
          new_reservations?: number | null
          reservations_processed?: number | null
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          tasks_created?: number | null
          updated_reservations?: number | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          check_in_predeterminado: string
          check_out_predeterminado: string
          cliente_id: string
          codigo: string
          coste_servicio: number
          created_at: string
          direccion: string
          duracion_servicio: number
          fecha_actualizacion: string
          fecha_creacion: string
          hostaway_internal_name: string | null
          hostaway_listing_id: number | null
          id: string
          nombre: string
          notas: string | null
          numero_alfombrines: number
          numero_banos: number
          numero_camas: number
          numero_fundas_almohada: number
          numero_sabanas: number
          numero_toallas_grandes: number
          numero_toallas_pequenas: number
          updated_at: string
        }
        Insert: {
          check_in_predeterminado?: string
          check_out_predeterminado?: string
          cliente_id: string
          codigo: string
          coste_servicio?: number
          created_at?: string
          direccion: string
          duracion_servicio?: number
          fecha_actualizacion?: string
          fecha_creacion?: string
          hostaway_internal_name?: string | null
          hostaway_listing_id?: number | null
          id?: string
          nombre: string
          notas?: string | null
          numero_alfombrines?: number
          numero_banos?: number
          numero_camas?: number
          numero_fundas_almohada?: number
          numero_sabanas?: number
          numero_toallas_grandes?: number
          numero_toallas_pequenas?: number
          updated_at?: string
        }
        Update: {
          check_in_predeterminado?: string
          check_out_predeterminado?: string
          cliente_id?: string
          codigo?: string
          coste_servicio?: number
          created_at?: string
          direccion?: string
          duracion_servicio?: number
          fecha_actualizacion?: string
          fecha_creacion?: string
          hostaway_internal_name?: string | null
          hostaway_listing_id?: number | null
          id?: string
          nombre?: string
          notas?: string | null
          numero_alfombrines?: number
          numero_banos?: number
          numero_camas?: number
          numero_fundas_almohada?: number
          numero_sabanas?: number
          numero_toallas_grandes?: number
          numero_toallas_pequenas?: number
          updated_at?: string
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
      tasks: {
        Row: {
          address: string
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
          id: string
          metodo_pago: string | null
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
          id?: string
          metodo_pago?: string | null
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
          id?: string
          metodo_pago?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_cleaners_order: {
        Args: { cleaner_updates: Json[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
