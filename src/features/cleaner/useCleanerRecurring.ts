import { supabase } from '@/integrations/supabase/client';
import type { Task } from '@/types/calendar';
import { getTaskDateRange } from '@/utils/taskQueryRange';
import { recurringExecutionBounds, buildRecurringExecutionSet } from '@/utils/recurringExecutions';
import { calculateOccurrences } from '../../../supabase/functions/_shared/recurringSchedule';
import { useCleanerCachedQuery, useCleanerIdentity } from './useCleanerData';

export function useCleanerRecurring(date: Date) {
  const identity = useCleanerIdentity();
  const range = getTaskDateRange(date, 'week');
  const from = range.dateFrom;
  const toDate = new Date(`${range.dateTo}T12:00:00Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const to = toDate.toISOString().slice(0, 10);
  return useCleanerCachedQuery<Task[]>(
    ['cleaner-recurring', identity.ownerId, identity.sedeId, from, to],
    `${identity.ownerId}:${identity.sedeId}:recurring:${from}:${to}`, async () => {
      const { data: definitions, error } = await supabase.from('recurring_tasks')
        .select('*,properties:propiedad_id(nombre,direccion,codigo,duracion_servicio)')
        .eq('is_active', true).eq('sede_id', identity.sedeId).eq('cleaner_id', identity.data!.id);
      if (error) throw error;
      if (!definitions?.length) return [];
      const bounds = recurringExecutionBounds(from, to);
      const { data: executions, error: executionsError } = await supabase.from('recurring_task_executions')
        .select('recurring_task_id,execution_date').in('recurring_task_id', definitions.map(item => item.id))
        .gte('execution_date', bounds.from).lt('execution_date', bounds.until).eq('success', true);
      if (executionsError) throw executionsError;
      const executed = buildRecurringExecutionSet(executions || []);
      return definitions.flatMap(item => calculateOccurrences(item, from, to).filter(day => !executed.has(`${item.id}_${day}`)).map(day => ({
        id: `recurring_${item.id}_${day}`, date: day, property: item.properties?.nombre || item.name,
        propertyCode: item.properties?.codigo || '', address: item.properties?.direccion || '',
        propertyDurationMinutes: item.properties?.duracion_servicio || item.duracion || undefined,
        startTime: item.start_time, endTime: item.end_time, duration: item.duracion || undefined,
        checkIn: item.check_in, checkOut: item.check_out, type: item.type, status: 'pending',
        cleaner: item.cleaner || undefined, cleanerId: item.cleaner_id || undefined,
        clienteId: item.cliente_id || undefined, propertyId: item.propiedad_id || undefined,
        sedeId: item.sede_id || undefined, notes: `🔄 Tarea recurrente: ${item.name}`,
        isRecurringInstance: true, recurringTaskId: item.id, created_at: item.created_at, updated_at: item.updated_at,
      } as Task)));
    }, Boolean(identity.data?.id && identity.data.isActive !== false),
  );
}

export function mergeCleanerCalendarTasks(real: Task[], virtual: Task[]) {
  return [...real, ...virtual.filter(task => !real.some(saved => saved.propertyId === task.propertyId &&
    saved.date === task.date && saved.startTime.slice(0, 5) === task.startTime.slice(0, 5) && saved.cleanerId === task.cleanerId))];
}
