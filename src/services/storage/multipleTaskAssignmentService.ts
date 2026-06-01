import { supabase } from '@/integrations/supabase/client';
import { TaskAssignment } from '@/types/taskAssignments';
import { Task } from '@/types/calendar';

type CleanerLite = { id: string; name: string; email: string | null };

export interface SetAssignmentsResult {
  added: CleanerLite[];
  removed: CleanerLite[];
  final: { id: string; name: string }[];
}

const stripVirtualId = (taskId: string) =>
  taskId?.includes('_assignment_') ? taskId.split('_assignment_')[0] : taskId;

export class MultipleTaskAssignmentService {
  async getTaskAssignments(taskId: string): Promise<TaskAssignment[]> {
    const actualTaskId = stripVirtualId(taskId);

    const { data, error } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('task_id', actualTaskId);

    if (error) throw new Error(`Error fetching task assignments: ${error.message}`);
    return data || [];
  }

  /**
   * Reemplaza atómicamente la lista completa de trabajadores asignados a la tarea.
   * Internamente la RPC `set_task_assignments`:
   *  - calcula el diff (added/removed)
   *  - aplica DELETE/INSERT en una sola transacción
   *  - sincroniza `tasks.cleaner` y `tasks.cleaner_id`
   *  - devuelve los emails para que el cliente envíe notificaciones
   */
  async setTaskAssignments(
    taskId: string,
    cleanerIds: string[]
  ): Promise<SetAssignmentsResult> {
    const actualTaskId = stripVirtualId(taskId);

    const { data, error } = await supabase.rpc('set_task_assignments', {
      _task_id: actualTaskId,
      _cleaner_ids: cleanerIds,
    });

    if (error) throw new Error(`Error setting task assignments: ${error.message}`);

    const result = (data || {}) as unknown as SetAssignmentsResult;
    const added = result.added || [];
    const removed = result.removed || [];

    // Sólo después de que la transacción se commitee, enviamos los emails.
    if (added.length > 0 || removed.length > 0) {
      await this.sendAssignmentEmails(actualTaskId, added, removed);
    }

    return { added, removed, final: result.final || [] };
  }

  private async sendAssignmentEmails(
    taskId: string,
    added: CleanerLite[],
    removed: CleanerLite[]
  ): Promise<void> {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.error('No se pudo cargar la tarea para enviar emails:', taskError);
      return;
    }

    // Compute per-worker time window. When multiple workers are assigned,
    // the total scheduled duration is split evenly among them, so each
    // worker's email reflects the real hours they will actually work.
    const { data: currentAssignments } = await supabase
      .from('task_assignments')
      .select('cleaner_id')
      .eq('task_id', taskId);

    const assignedIds: string[] = (currentAssignments || []).map((a: any) => a.cleaner_id);
    const workerCount = Math.max(assignedIds.length, 1);

    const toMin = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const toTime = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const startMin = toMin(task.start_time);
    const endMin = toMin(task.end_time);
    const totalMin = Math.max(endMin - startMin, 0);
    const perWorkerMin = Math.round(totalMin / workerCount);

    const buildTaskData = (cleanerId?: string) => {
      let startTime = task.start_time;
      let endTime = task.end_time;
      if (cleanerId && workerCount > 1) {
        const idx = assignedIds.indexOf(cleanerId);
        if (idx >= 0) {
          const s = startMin + idx * perWorkerMin;
          const e = idx === workerCount - 1 ? endMin : s + perWorkerMin;
          startTime = toTime(s);
          endTime = toTime(e);
        }
      }
      return {
        property: task.property,
        address: task.address,
        date: task.date,
        startTime,
        endTime,
        type: task.type || 'Limpieza general',
        notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined,
      };
    };

    const sends: Promise<unknown>[] = [];

    for (const c of added) {
      if (!c.email) continue;
      sends.push(
        supabase.functions
          .invoke('send-task-assignment-email', {
            body: { taskId: task.id, cleanerEmail: c.email, cleanerName: c.name, taskData: buildTaskData(c.id) },
          })
          .catch((e) => console.error('assignment email failed', c.email, e))
      );
    }

    for (const c of removed) {
      if (!c.email) continue;
      sends.push(
        supabase.functions
          .invoke('send-task-unassignment-email', {
            body: {
              taskId: task.id,
              cleanerEmail: c.email,
              cleanerName: c.name,
              taskData: buildTaskData(c.id),
              reason: 'unassigned',
            },
          })
          .catch((e) => console.error('unassignment email failed', c.email, e))
      );
    }

    await Promise.allSettled(sends);
  }

  /** Compat: equivalente a setTaskAssignments(taskId, []). */
  async clearTaskAssignments(taskId: string): Promise<void> {
    await this.setTaskAssignments(taskId, []);
  }

  async getTasksWithAssignments(): Promise<(Task & { assignments: TaskAssignment[] })[]> {
    const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*');
    if (tasksError) throw new Error(`Error fetching tasks: ${tasksError.message}`);

    const { data: assignments, error: assignmentsError } = await supabase
      .from('task_assignments')
      .select('*');
    if (assignmentsError) throw new Error(`Error fetching assignments: ${assignmentsError.message}`);

    return (tasks || []).map((task) => ({
      id: task.id,
      created_at: task.created_at,
      updated_at: task.updated_at,
      property: task.property,
      address: task.address,
      startTime: task.start_time,
      endTime: task.end_time,
      type: task.type,
      status: task.status as 'pending' | 'in-progress' | 'completed',
      checkOut: task.check_out,
      checkIn: task.check_in,
      cleaner: task.cleaner,
      backgroundColor: task.background_color,
      date: task.date,
      clienteId: task.cliente_id,
      propertyId: task.propiedad_id,
      duration: task.duracion,
      cost: task.coste,
      paymentMethod: task.metodo_pago,
      supervisor: task.supervisor,
      cleanerId: task.cleaner_id,
      assignments: (assignments || []).filter((a) => a.task_id === task.id),
    }));
  }
}

export const multipleTaskAssignmentService = new MultipleTaskAssignmentService();
