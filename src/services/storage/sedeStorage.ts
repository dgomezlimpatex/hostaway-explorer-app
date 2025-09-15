import { supabase } from '@/integrations/supabase/client';
import { Sede, CreateSedeData, UserSedeAccess, CreateUserSedeAccessData } from '@/types/sede';
import { BaseStorageService } from './baseStorage';

// Mappers para Sede
const mapSedeFromDB = (row: any): Sede => ({
  id: row.id,
  nombre: row.nombre,
  codigo: row.codigo,
  ciudad: row.ciudad,
  direccion: row.direccion,
  telefono: row.telefono,
  email: row.email,
  is_active: row.is_active,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapSedeToDB = (sede: Partial<CreateSedeData>): any => ({
  nombre: sede.nombre,
  codigo: sede.codigo,
  ciudad: sede.ciudad,
  direccion: sede.direccion,
  telefono: sede.telefono,
  email: sede.email,
});

// Mappers para UserSedeAccess
const mapUserSedeAccessFromDB = (row: any): UserSedeAccess => ({
  id: row.id,
  user_id: row.user_id,
  sede_id: row.sede_id,
  can_access: row.can_access,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapUserSedeAccessToDB = (access: Partial<CreateUserSedeAccessData>): any => ({
  user_id: access.user_id,
  sede_id: access.sede_id,
  can_access: access.can_access ?? true,
});

// Servicio base para Sedes
const baseSedeService = new BaseStorageService<Sede, CreateSedeData>({
  tableName: 'sedes',
  mapFromDB: mapSedeFromDB,
  mapToDB: mapSedeToDB,
  enforceSedeFilter: false, // Las sedes no deben filtrarse por sede_id
});

// Servicio base para UserSedeAccess
const baseUserSedeAccessService = new BaseStorageService<UserSedeAccess, CreateUserSedeAccessData>({
  tableName: 'user_sede_access',
  mapFromDB: mapUserSedeAccessFromDB,
  mapToDB: mapUserSedeAccessToDB,
});

// Servicio extendido con funciones específicas de sedes
export const sedeStorageService = {
  // Operaciones básicas de sedes
  ...baseSedeService,
  
  // Obtener todas las sedes activas
  async getActiveSedes(): Promise<Sede[]> {
    const { data, error } = await supabase
      .from('sedes')
      .select('*')
      .eq('is_active', true)
      .order('nombre');

    if (error) {
      console.error('Error fetching active sedes:', error);
      throw error;
    }

    return data?.map(mapSedeFromDB) || [];
  },

  // Obtener sedes accesibles por el usuario actual
  async getUserAccessibleSedes(): Promise<Sede[]> {
    try {
      // Usar la función RPC que maneja correctamente admins y usuarios regulares
      const { data: sedeIds, error: rpcError } = await supabase
        .rpc('get_user_accessible_sedes');

      if (rpcError) {
        console.error('Error calling get_user_accessible_sedes:', rpcError);
        throw rpcError;
      }

      // Si no hay sedes accesibles, retornar array vacío
      if (!sedeIds || sedeIds.length === 0) {
        return [];
      }

      // Obtener los datos completos de las sedes
      const { data: sedes, error: sedesError } = await supabase
        .from('sedes')
        .select('*')
        .in('id', sedeIds)
        .eq('is_active', true)
        .order('nombre');

      if (sedesError) {
        console.error('Error fetching sedes data:', sedesError);
        throw sedesError;
      }

      return sedes?.map(mapSedeFromDB) || [];
    } catch (error) {
      console.error('Error in getUserAccessibleSedes:', error);
      return [];
    }
  },

  // Verificar si el usuario tiene acceso a una sede específica
  async hasUserAccessToSede(sedeId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('user_has_sede_access', {
        _user_id: (await supabase.auth.getUser()).data.user?.id,
        _sede_id: sedeId
      });

    if (error) {
      console.error('Error checking sede access:', error);
      return false;
    }

    return data || false;
  },

  // Gestión de accesos de usuarios a sedes
  async grantUserSedeAccess(userId: string, sedeId: string): Promise<UserSedeAccess> {
    return baseUserSedeAccessService.create({
      user_id: userId,
      sede_id: sedeId,
      can_access: true,
    });
  },

  async revokeUserSedeAccess(userId: string, sedeId: string): Promise<void> {
    const { error } = await supabase
      .from('user_sede_access')
      .update({ can_access: false })
      .eq('user_id', userId)
      .eq('sede_id', sedeId);

    if (error) {
      console.error('Error revoking sede access:', error);
      throw error;
    }
  },

  async getUserSedeAccess(userId: string): Promise<UserSedeAccess[]> {
    const { data, error } = await supabase
      .from('user_sede_access')
      .select('*')
      .eq('user_id', userId)
      .eq('can_access', true);

    if (error) {
      console.error('Error fetching user sede access:', error);
      throw error;
    }

    return data?.map(mapUserSedeAccessFromDB) || [];
  },

  // Crear nueva sede
  async createSede(sedeData: CreateSedeData): Promise<Sede> {
    return baseSedeService.create(sedeData);
  },

  // Actualizar sede
  async updateSede(sedeId: string, updates: Partial<CreateSedeData>): Promise<Sede | null> {
    return baseSedeService.update(sedeId, updates);
  },

  // Desactivar sede (no eliminar para mantener integridad referencial)
  async deactivateSede(sedeId: string): Promise<void> {
    const { error } = await supabase
      .from('sedes')
      .update({ is_active: false })
      .eq('id', sedeId);

    if (error) {
      console.error('Error deactivating sede:', error);
      throw error;
    }
  },
};