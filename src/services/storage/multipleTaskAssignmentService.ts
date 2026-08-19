import { supabase } from '@/integrations/supabase/client';
import { TaskAssignment } from '@/types/taskAssignments';
import { Task } from '@/types/calendar';

type CleanerLite = { id: string; name: string; email: string | null };

export interface SetAssignmentsResult {
  added: CleanerLite[];
  removed: CleanerLite[];
  final: { id: string; name: string }[];
}

export interface SetAssignmentsOptions {
  notify?: boolean;
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
    cleanerIds: string[],
    options: SetAssignmentsOptions = {},
  ): Promise<SetAssignmentsResult> {
    const actualTaskId = stripVirtualId(taskId);
    const shouldNotify = options.notify ?? true;

    const { data, error } = await supabase.rpc('set_task_assignments', {
      _task_id: actualTaskId,
      _cleaner_ids: cleanerIds,
    });

    if (error) throw new Error(`Error setting task assignments: ${error.message}`);

    const result = (data || {}) as unknown as SetAssignmentsResult;
    const added = result.added || [];
    const removed = result.removed || [];

    // Sólo después de que la transacción se commitee, enviamos notificaciones.
    // En batch se puede desactivar y notificar al final, evitando avisos de una
    // aplicación parcial si otra tarea falla después.
    if (shouldNotify && (added.length > 0 || removed.length > 0)) {
      await this.notifyAssignmentDiff(actualTaskId, added, removed, result.final?.length || 0);
    }

    return { added, removed, final: result.final || [] };
  }

  async notifyAssignmentDiff(taskId: string, added: CleanerLite[], removed: CleanerLite[], workerCount = 1): Promise<void> {
    const actualTaskId = stripVirtualId(taskId);
    // WhatsApp se encola de forma canónica mediante el trigger de
    // task_assignments. Aquí mantenemos únicamente el correo legado.
    await this.sendAssignmentEmails(actualTaskId, added, removed, workerCount);
  }

  private async sendAssignmentEmails(
    taskId: string,
    added: CleanerLite[],
    removed: CleanerLite[],
    workerCount: number,
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

    const effectiveWorkerCount = Math.max(1, workerCount);
    const buildTaskData = () => ({
      property: task.property,
      address: task.address,
      date: task.date,
      startTime: task.start_time,
      endTime: task.end_time,
      durationMinutes: task.duracion,
      workerCount: effectiveWorkerCount,
      type: task.type || 'Limpieza general',
      notes: task.supervisor ? `Supervisor: ${task.supervisor}` : undefined,
    });

    const sends: Promise<unknown>[] = [];

    for (const c of added) {
      if (!c.email) continue;
      sends.push(
        supabase.functions
          .invoke('send-task-assignment-email', {
            body: { taskId: task.id, cleanerEmail: c.email, cleanerName: c.name, taskData: buildTaskData() },
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
              taskData: buildTaskData(),
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
