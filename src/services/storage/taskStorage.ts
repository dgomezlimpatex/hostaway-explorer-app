import { Task } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';
import { supabase } from '@/integrations/supabase/client';
import { formatMadridDate } from '@/utils/date';
import { recordAiObservedEvent } from '@/services/aiObservedEvents';

type StockRpcClient = {
  rpc: (
    fn: 'process_stock_consumption_for_task',
    args: {
      task_id_param: string;
      property_id_param: string;
      user_id_param: string;
    }
  ) => Promise<{ data: unknown; error: Error | null }>;
};

type TaskCreateData = Omit<Task, 'id' | 'created_at' | 'updated_at'>;

type TaskPropertyRow = {
  codigo?: string | null;
  duracion_servicio?: number | null;
  nombre?: string | null;
  direccion?: string | null;
};

type TaskReportRow = {
  overall_status?: string | null;
};

type TaskAssignmentRow = {
  id: string;
  task_id?: string;
  cleaner_id: string;
  cleaner_name: string;
  assigned_at?: string;
  assigned_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

type TaskDBRow = {
  id: string;
  created_at: string;
  updated_at: string;
  property: string;
  properties?: TaskPropertyRow | null;
  address: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  check_out: string;
  check_in: string;
  cleaner?: string | null;
  background_color?: string | null;
  date: string;
  cliente_id?: string | null;
  propiedad_id?: string | null;
  sede_id?: string | null;
  duracion?: number | null;
  coste?: number | null;
  metodo_pago?: string | null;
  supervisor?: string | null;
  cleaner_id?: string | null;
  notes?: string | null;
  extraordinary_client_name?: string | null;
  extraordinary_client_email?: string | null;
  extraordinary_client_phone?: string | null;
  extraordinary_billing_address?: string | null;
  originalTaskId?: string;
  additional_tasks?: Task['additionalTasks'];
  task_reports?: TaskReportRow[] | null;
  task_assignments?: TaskAssignmentRow[] | null;
  assignments?: TaskAssignmentRow[] | null;
  assignment_count?: number | null;
};

type TaskDBWrite = Record<string, unknown>;

const taskStorageConfig = {
  tableName: 'tasks',
  mapFromDB: (row: TaskDBRow): Task => ({
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    property: row.property,
    propertyCode: row.properties?.codigo || null,
    propertyDurationMinutes: row.properties?.duracion_servicio || null,
    propertyName: row.properties?.nombre || null,
    propertyAddress: row.properties?.direccion || null,
    address: row.address,
    startTime: row.start_time,
    endTime: row.end_time,
    type: row.type,
    status: row.status as 'pending' | 'in-progress' | 'completed',
    checkOut: row.check_out,
    checkIn: row.check_in,
    cleaner: row.cleaner,
    backgroundColor: row.background_color,
    date: row.date,
    clienteId: row.cliente_id,
    propertyId: row.propiedad_id,
    duration: row.duracion,
    cost: row.coste,
    paymentMethod: row.metodo_pago,
    supervisor: row.supervisor,
    cleanerId: row.cleaner_id,
    assignmentCount: row.assignment_count ?? undefined,
    assignments: (row.assignments || row.task_assignments || []).map((assignment) => ({
      id: assignment.id,
      task_id: assignment.task_id || row.id,
      cleaner_id: assignment.cleaner_id,
      cleaner_name: assignment.cleaner_name,
      assigned_at: assignment.assigned_at || row.updated_at,
      assigned_by: assignment.assigned_by || undefined,
      created_at: assignment.created_at || assignment.assigned_at || row.created_at,
      updated_at: assignment.updated_at || assignment.assigned_at || row.updated_at,
    })),
    notes: row.notes,
    extraordinaryClientName: row.extraordinary_client_name,
    extraordinaryClientEmail: row.extraordinary_client_email,
    extraordinaryClientPhone: row.extraordinary_client_phone,
    extraordinaryBillingAddress: row.extraordinary_billing_address,
    originalTaskId: row.originalTaskId || row.id, // Para asignaciones múltiples
    additionalTasks: row.additional_tasks || [], // Map additional tasks
  }),
  mapToDB: (task: Partial<TaskCreateData>): TaskDBWrite => {
    const data: TaskDBWrite = {};
    
    if (task.property !== undefined) data.property = task.property;
    if (task.address !== undefined) data.address = task.address;
    if (task.startTime !== undefined) data.start_time = task.startTime;
    if (task.endTime !== undefined) data.end_time = task.endTime;
    if (task.type !== undefined) data.type = task.type;
    if (task.status !== undefined) data.status = task.status;
    if (task.checkOut !== undefined) data.check_out = task.checkOut;
    if (task.checkIn !== undefined) data.check_in = task.checkIn;
    if (task.cleaner !== undefined) data.cleaner = task.cleaner;
    if (task.backgroundColor !== undefined) data.background_color = task.backgroundColor;
    if (task.date !== undefined) data.date = task.date;
    if (task.clienteId !== undefined) data.cliente_id = task.clienteId;
    if (task.propertyId !== undefined) data.propiedad_id = task.propertyId;
    if (task.duration !== undefined) data.duracion = task.duration;
    if (task.cost !== undefined) data.coste = task.cost;
    if (task.paymentMethod !== undefined) data.metodo_pago = task.paymentMethod;
    if (task.supervisor !== undefined) data.supervisor = task.supervisor;
    if (task.cleanerId !== undefined) data.cleaner_id = task.cleanerId;
    if (task.notes !== undefined) data.notes = task.notes;
    if (task.extraordinaryClientName !== undefined) data.extraordinary_client_name = task.extraordinaryClientName;
    if (task.extraordinaryClientEmail !== undefined) data.extraordinary_client_email = task.extraordinaryClientEmail;
    if (task.extraordinaryClientPhone !== undefined) data.extraordinary_client_phone = task.extraordinaryClientPhone;
    if (task.extraordinaryBillingAddress !== undefined) data.extraordinary_billing_address = task.extraordinaryBillingAddress;

    return data;
  },
  enforceSedeFilter: true // Habilitar filtro automático por sede
};

export class TaskStorageService extends BaseStorageService<Task, TaskCreateData> {
  constructor() {
    super(taskStorageConfig);
  }

  private async applyAssignmentCounts(tasks: Map<string, TaskDBRow> | TaskDBRow[]): Promise<void> {
    const taskRows = Array.isArray(tasks) ? tasks : Array.from(tasks.values());
    const taskIds = taskRows.map((task) => task.id).filter(Boolean);
    if (taskIds.length === 0) return;

    try {
      const { data, error } = await (supabase as any).rpc('get_task_assignment_counts', {
        _task_ids: taskIds,
      });

      if (error || !Array.isArray(data)) {
        if (error) console.warn('Task assignment count RPC unavailable:', error.message);
        return;
      }

      const counts = new Map<string, number>(
        data.map((row: { task_id: string; assignment_count: number }) => [
          row.task_id,
          row.assignment_count,
        ])
      );

      taskRows.forEach((task) => {
        const count = counts.get(task.id);
        if (typeof count === 'number' && count > 0) {
          task.assignment_count = count;
        }
      });
    } catch (error) {
      console.warn('Task assignment count RPC failed:', error);
    }
  }

  // Optimized method for cleaners - fetches only their tasks from server
  async getTasksForCleaner(cleanerId: string, sedeId?: string): Promise<Task[]> {
    const effectiveSedeId = sedeId || this.getSedeIdFromStorage();
    
    // Get today's date for filtering - only fetch from today onwards
    const today = formatMadridDate(new Date());
    
    // Query tasks where cleaner is assigned via task_assignments table
    let query = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo, duracion_servicio, nombre, direccion),
        task_reports(overall_status),
        task_assignments!inner(id, task_id, cleaner_id, cleaner_name, assigned_at, assigned_by, created_at, updated_at)
      `)
      .eq('task_assignments.cleaner_id', cleanerId)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (effectiveSedeId && effectiveSedeId !== 'no-sede') {
      query = query.eq('sede_id', effectiveSedeId);
    }
    
    const { data: assignedTasks, error: assignedError } = await query;
    
    if (assignedError) {
      console.error('Error fetching assigned tasks for cleaner:', assignedError);
      throw assignedError;
    }
    
    // Also fetch tasks directly assigned via cleaner_id field (legacy)
    let legacyQuery = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo, duracion_servicio, nombre, direccion),
        task_reports(overall_status),
        task_assignments(id, task_id, cleaner_id, cleaner_name, assigned_at, assigned_by, created_at, updated_at)
      `)
      .eq('cleaner_id', cleanerId)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (effectiveSedeId && effectiveSedeId !== 'no-sede') {
      legacyQuery = legacyQuery.eq('sede_id', effectiveSedeId);
    }
    
    const { data: legacyTasks, error: legacyError } = await legacyQuery;
    
    if (legacyError) {
      console.error('Error fetching legacy tasks for cleaner:', legacyError);
    }
    
    // Merge and deduplicate by task id
    const taskMap = new Map<string, TaskDBRow>();
    
    [...(assignedTasks || []), ...(legacyTasks || [])].forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });
    
    // The inner join above only returns the assignment row matching this cleaner.
    // For multi-worker tasks we need ALL assignments so the UI can split duration
    // per worker correctly. Fetch the full assignment list for these task ids.
    const taskIds = Array.from(taskMap.keys());
    if (taskIds.length > 0) {
      const { data: allAssignments, error: assignErr } = await supabase
        .from('task_assignments')
        .select('id, task_id, cleaner_id, cleaner_name, assigned_at, assigned_by, created_at, updated_at')
        .in('task_id', taskIds);
      if (!assignErr && allAssignments) {
        const byTask = new Map<string, TaskAssignmentRow[]>();
        allAssignments.forEach(a => {
          const arr = byTask.get(a.task_id) || [];
          arr.push(a);
          byTask.set(a.task_id, arr);
        });
        taskMap.forEach((task, id) => {
          const full = byTask.get(id);
          if (full && full.length > 0) {
            task.task_assignments = full;
          }
        });
      }
    }
    
    await this.applyAssignmentCounts(taskMap);

    // Map to Task objects
    return Array.from(taskMap.values()).map(task => this.mapTaskFromDB(task));
  }

  private getSedeIdFromStorage(): string | null {
    try {
      const activeSede = localStorage.getItem('activeSede');
      if (activeSede) {
        const sede = JSON.parse(activeSede);
        return sede.id;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private mapTaskFromDB(task: TaskDBRow): Task {
    const hasCompletedReport = task.task_reports?.some((report) => report.overall_status === 'completed');
    const finalStatus = hasCompletedReport ? 'completed' : task.status;

    // Handle multiple assignments - combine all cleaners into one task
    let cleanerName = task.cleaner;
    let cleanerIdValue = task.cleaner_id;
    
    if (task.task_assignments && task.task_assignments.length > 0) {
      cleanerName = task.task_assignments.map((assignment) => assignment.cleaner_name).join(', ');
      cleanerIdValue = task.task_assignments[0].cleaner_id;
    }

    return taskStorageConfig.mapFromDB({
      ...task,
      status: finalStatus,
      cleaner: cleanerName,
      cleaner_id: cleanerIdValue,
      originalTaskId: task.id,
      assignments: task.task_assignments
    });
  }

  async getTasks(options?: {
    cleanerId?: string;
    includePastTasks?: boolean;
    userRole?: string;
    sedeId?: string;
    dateFrom?: string;  // Nueva opción: fecha inicio del rango
    dateTo?: string;    // Nueva opción: fecha fin del rango
  }): Promise<Task[]> {
    console.log('📦 TaskStorage.getTasks called with options:', options);
    
    const sedeId = options?.sedeId || this.getSedeIdFromStorage();
    console.log('📦 TaskStorage.getTasks - effective sedeId:', sedeId);
    
    // OPTIMIZED: For cleaners, use the dedicated method
    if (options?.userRole === 'cleaner' && options?.cleanerId) {
      return this.getTasksForCleaner(options.cleanerId, sedeId || undefined);
    }
    
    // Usar las fechas proporcionadas o calcular valores por defecto con días fijos
    const today = new Date();
    let dateFrom = options?.dateFrom;
    let dateTo = options?.dateTo;
    
    // Si no se proporcionan fechas, usar ±45 días desde hoy
    if (!dateFrom) {
      const defaultFrom = new Date(today);
      defaultFrom.setDate(defaultFrom.getDate() - 45);
      dateFrom = formatMadridDate(defaultFrom);
    }
    
    if (!dateTo) {
      const defaultTo = new Date(today);
      defaultTo.setDate(defaultTo.getDate() + 45);
      dateTo = formatMadridDate(defaultTo);
    }
    
    console.log('📦 TaskStorage.getTasks - date range:', { dateFrom, dateTo });
    
    // Query optimizada con rango de fechas
    let query = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo, duracion_servicio, nombre, direccion),
        task_reports(overall_status),
        task_assignments(id, task_id, cleaner_id, cleaner_name, assigned_at, assigned_by, created_at, updated_at)
      `)
      .gte('date', dateFrom)
      .lte('date', dateTo);
    
    if (sedeId && sedeId !== 'no-sede') {
      query = query.eq('sede_id', sedeId);
    }
    
    const TASK_LIMIT = 5000;
    const WARNING_THRESHOLD = 4000; // 80% del límite
    
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(TASK_LIMIT);

    if (error) {
      console.error('❌ TaskStorage.getTasks - Error fetching tasks:', error);
      throw error;
    }
    
    const taskCount = data?.length || 0;
    console.log('📦 TaskStorage.getTasks - tasks fetched:', taskCount);
    
    // Advertencia cuando nos acercamos al límite
    if (taskCount >= WARNING_THRESHOLD) {
      console.warn(`⚠️ TaskStorage: Se han cargado ${taskCount} tareas (límite: ${TASK_LIMIT}). Considerar reducir el rango de fechas.`);
    }
    
    // Advertencia crítica si llegamos al límite exacto
    if (taskCount >= TASK_LIMIT) {
      console.error(`🚨 TaskStorage: LÍMITE ALCANZADO (${TASK_LIMIT} tareas). Es posible que falten tareas. Reduce el rango de fechas.`);
    }
    
    if (data?.length) {
      data.forEach((task) => {
        const assignmentCount = task.task_assignments?.length || 0;
        if (assignmentCount > 0) {
          (task as TaskDBRow).assignment_count = assignmentCount;
        }
      });
    }

    return (data || []).map(task => this.mapTaskFromDB(task));
  }

  // Nuevo método para reportes: obtiene tareas en un rango específico sin límites
  async getTasksForReports(options: {
    dateFrom: string;
    dateTo: string;
    sedeId?: string;
    clienteId?: string;
    propertyId?: string;
    status?: string;
  }): Promise<Task[]> {
    const sedeId = options.sedeId || this.getSedeIdFromStorage();
    
    let query = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo, duracion_servicio, nombre, direccion),
        task_reports(overall_status),
        task_assignments(id, task_id, cleaner_id, cleaner_name, assigned_at, assigned_by, created_at, updated_at)
      `)
      .gte('date', options.dateFrom)
      .lte('date', options.dateTo);
    
    if (sedeId && sedeId !== 'no-sede') {
      query = query.eq('sede_id', sedeId);
    }
    
    if (options.clienteId) {
      query = query.eq('cliente_id', options.clienteId);
    }
    
    if (options.propertyId) {
      query = query.eq('propiedad_id', options.propertyId);
    }
    
    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }
    
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching tasks for reports:', error);
      throw error;
    }
    
    return (data || []).map(task => this.mapTaskFromDB(task));
  }

  async createTask(task: TaskCreateData): Promise<Task> {
    const created = await this.create(task);
    void recordAiObservedEvent({
      eventType: 'task_created',
      entityType: 'tasks',
      entityId: created.id,
      summary: `Creada tarea ${created.property} para ${created.date}`,
      afterData: {
        id: created.id,
        property: created.property,
        date: created.date,
        startTime: created.startTime,
        endTime: created.endTime,
        cleaner: created.cleaner,
        cleanerId: created.cleanerId,
        type: created.type,
        status: created.status,
      },
      metadata: { source: 'taskStorage.createTask' },
    });
    return created;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    let previousTask: Task | undefined;
    try {
      previousTask = await this.getById(taskId);
    } catch {
      previousTask = undefined;
    }

    const result = await this.update(taskId, updates);
    if (!result) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    void recordAiObservedEvent({
      eventType: 'task_updated',
      entityType: 'tasks',
      entityId: taskId,
      summary: `Actualizada tarea ${result.property} para ${result.date}`,
      beforeData: previousTask ? {
        id: previousTask.id,
        property: previousTask.property,
        date: previousTask.date,
        startTime: previousTask.startTime,
        endTime: previousTask.endTime,
        cleaner: previousTask.cleaner,
        cleanerId: previousTask.cleanerId,
        type: previousTask.type,
        status: previousTask.status,
      } : null,
      afterData: {
        id: result.id,
        property: result.property,
        date: result.date,
        startTime: result.startTime,
        endTime: result.endTime,
        cleaner: result.cleaner,
        cleanerId: result.cleanerId,
        type: result.type,
        status: result.status,
      },
      metadata: { changedFields: Object.keys(updates), source: 'taskStorage.updateTask' },
    });

    // Si la tarea se está marcando como completada, procesar consumo automático
    if (updates.status === 'completed' && result.propertyId) {
      try {
        // Importar dinámicamente para evitar dependencias circulares
        // Obtener el usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Procesar consumo automático en background
          await this.processAutomaticConsumption(taskId, result.propertyId, user.id);
        }
      } catch (error) {
        console.error('Error procesando consumo automático:', error);
        // No fallar la actualización de la tarea por esto
      }
    }

    return result;
  }

  private async processAutomaticConsumption(taskId: string, propertyId: string, userId: string) {
    try {
      const stockRpc = supabase as unknown as StockRpcClient;
      const { data, error } = await stockRpc.rpc('process_stock_consumption_for_task', {
        task_id_param: taskId,
        property_id_param: propertyId,
        user_id_param: userId,
      });

      if (error) {
        throw error;
      }

      const result = data as { disabled?: boolean; consumed?: number; skipped?: number; alerts?: number; reason?: string } | null;
      if (result?.disabled) {
        console.info('Consumo automatico de stock desactivado:', result.reason);
        return;
      }

      console.log('Consumo automatico de stock procesado:', result);
    } catch (error) {
      console.error('Error en processAutomaticConsumption:', error);
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    let previousTask: Task | undefined;
    try {
      previousTask = await this.getById(taskId);
    } catch {
      previousTask = undefined;
    }
    const deleted = await this.delete(taskId);
    void recordAiObservedEvent({
      eventType: 'task_deleted',
      entityType: 'tasks',
      entityId: taskId,
      summary: previousTask ? `Eliminada tarea ${previousTask.property} para ${previousTask.date}` : `Eliminada tarea ${taskId}`,
      beforeData: previousTask ? {
        id: previousTask.id,
        property: previousTask.property,
        date: previousTask.date,
        startTime: previousTask.startTime,
        endTime: previousTask.endTime,
        cleaner: previousTask.cleaner,
        cleanerId: previousTask.cleanerId,
        type: previousTask.type,
        status: previousTask.status,
      } : null,
      metadata: { source: 'taskStorage.deleteTask' },
    });
    return deleted;
  }
}

export const taskStorageService = new TaskStorageService();
