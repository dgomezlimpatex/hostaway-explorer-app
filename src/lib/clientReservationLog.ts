import { supabase } from '@/integrations/supabase/client';

/**
 * Información del actor que realiza un cambio en una reserva del portal del cliente.
 *
 * - `client`: cambio realizado desde el portal público (autenticado por PIN, sin user_id).
 * - `admin` / `manager`: cambio realizado por personal interno con sesión iniciada.
 * - `system`: cambios automáticos (sincronizaciones, scripts, etc.).
 */
export type ReservationLogActorType = 'client' | 'admin' | 'manager' | 'system';

export interface ReservationLogActor {
  actor_type: ReservationLogActorType;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

/**
 * Resuelve quién está realizando la acción que se va a registrar en el histórico
 * (`client_reservation_logs`). Si hay sesión activa de Supabase, se asume actor
 * interno (admin/manager); si no, se considera que es el cliente operando vía PIN.
 */
export const buildReservationLogActor = async (
  fallbackClientName?: string,
): Promise<ReservationLogActor> => {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (user) {
      // Intentar obtener el rol y el nombre del usuario interno.
      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      const role = roleRow?.role;
      const actorType: ReservationLogActorType =
        role === 'admin' || role === 'manager'
          ? role
          : 'admin'; // sesión interna sin rol -> tratamos como admin para auditoría

      return {
        actor_type: actorType,
        actor_user_id: user.id,
        actor_name: (profile?.full_name as string | undefined) || user.email || 'Usuario interno',
        actor_email: user.email ?? null,
      };
    }
  } catch (err) {
    // Si falla la consulta del actor no debemos bloquear la operación principal.
    console.warn('[reservation-log] No se pudo resolver el actor autenticado:', err);
  }

  return {
    actor_type: 'client',
    actor_user_id: null,
    actor_name: fallbackClientName ?? 'Cliente (portal)',
    actor_email: null,
  };
};
