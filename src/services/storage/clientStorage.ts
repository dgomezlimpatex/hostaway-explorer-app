
import { supabase } from '@/integrations/supabase/client';
import { Client, CreateClientData } from '@/types/client';
import { ClientDeletionBlockedError, evaluateClientDeletion, type ClientDependencyCounts, type ClientDependencyKey } from '@/components/clients/clientRules';
import { BaseStorageService } from './baseStorage';
import { mapClientFromDB, mapClientToDB } from './mappers/clientMappers';

// Tablas que guardan relación con un cliente, en cualquier sede y fecha (también histórico).
// Si una consulta falla, su recuento queda como desconocido y la pantalla no permite borrar.
const CLIENT_DEPENDENCY_SOURCES: { key: ClientDependencyKey; table: string; column: string }[] = [
  { key: 'properties', table: 'properties', column: 'cliente_id' },
  { key: 'tasks', table: 'tasks', column: 'cliente_id' },
  { key: 'recurringTasks', table: 'recurring_tasks', column: 'cliente_id' },
  { key: 'portalAccess', table: 'client_portal_access', column: 'client_id' },
  { key: 'portalAccessLogs', table: 'client_portal_access_logs', column: 'client_id' },
  { key: 'reservations', table: 'client_reservations', column: 'client_id' },
  { key: 'reservationLogs', table: 'client_reservation_logs', column: 'client_id' },
  { key: 'incidents', table: 'cleaning_incidents', column: 'client_id' },
  { key: 'extraordinaryRequests', table: 'client_extraordinary_requests', column: 'client_id' },
  { key: 'pmsMappings', table: 'lh_room_mapping', column: 'cliente_id' },
  { key: 'pmsMappings', table: 'avirato_room_mapping', column: 'cliente_id' },
  { key: 'pmsReservations', table: 'avantio_reservations', column: 'cliente_id' },
  { key: 'pmsReservations', table: 'hostaway_reservations', column: 'cliente_id' },
  { key: 'budgets', table: 'budget_rate_profiles', column: 'client_id' },
  { key: 'budgets', table: 'tourist_budgets', column: 'client_id' },
];

class ClientStorageService extends BaseStorageService<Client, CreateClientData> {
  constructor() {
    super({
      tableName: 'clients',
      mapFromDB: mapClientFromDB,
      mapToDB: mapClientToDB,
      enforceSedeFilter: true // Habilitar filtro automático por sede
    });
  }

  async getAll(): Promise<Client[]> {
    return super.getAll({ column: 'created_at', ascending: false });
  }

  /** Solo lectura: cuenta los registros relacionados con el cliente para decidir si se puede borrar. */
  async getDeletionDependencies(clientId: string): Promise<ClientDependencyCounts> {
    const results = await Promise.all(CLIENT_DEPENDENCY_SOURCES.map(async source => {
      try {
        // Tablas variables (algunas no figuran en los tipos generados): solo se cuenta, sin leer filas.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await supabase.from(source.table as any)
          .select('id', { count: 'exact', head: true })
          .eq(source.column, clientId);
        return { key: source.key, count: error || typeof count !== 'number' ? null : count };
      } catch {
        return { key: source.key, count: null };
      }
    }));
    const counts: ClientDependencyCounts = {};
    for (const { key, count } of results) {
      const previous = counts[key];
      counts[key] = previous === null || count === null ? null : (previous ?? 0) + count;
    }
    return counts;
  }

  /** Lanza ClientDeletionBlockedError si hay cualquier registro relacionado o no se ha podido comprobar. */
  async assertDeletable(clientId: string): Promise<void> {
    const check = evaluateClientDeletion(await this.getDeletionDependencies(clientId));
    if (check.status !== 'allowed') throw new ClientDeletionBlockedError(check);
  }
}

export const clientStorage = new ClientStorageService();
