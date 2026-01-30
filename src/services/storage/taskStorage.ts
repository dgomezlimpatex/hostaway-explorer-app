import { Task } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';
import { supabase } from '@/integrations/supabase/client';
import { InventoryMovementType, InventoryAlertType } from '@/types/inventory';

interface TaskCreateData extends Omit<Task, 'id' | 'created_at' | 'updated_at'> {}

const taskStorageConfig = {
  tableName: 'tasks',
  mapFromDB: (row: any): Task => ({
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    property: row.property,
    propertyCode: row.properties?.codigo || null,
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
    notes: row.notes,
    extraordinaryClientName: row.extraordinary_client_name,
    extraordinaryClientEmail: row.extraordinary_client_email,
    extraordinaryClientPhone: row.extraordinary_client_phone,
    extraordinaryBillingAddress: row.extraordinary_billing_address,
    originalTaskId: row.originalTaskId || row.id, // Para asignaciones múltiples
    additionalTasks: row.additional_tasks || [], // Map additional tasks
  }),
  mapToDB: (task: Partial<TaskCreateData>): any => {
    const data: any = {};
    
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

  // Optimized method for cleaners - fetches only their tasks from server
  async getTasksForCleaner(cleanerId: string, sedeId?: string): Promise<Task[]> {
    const effectiveSedeId = sedeId || this.getSedeIdFromStorage();
    
    // Get today's date for filtering - only fetch from today onwards
    const today = new Date().toISOString().split('T')[0];
    
    // Query tasks where cleaner is assigned via task_assignments table
    let query = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo),
        task_reports(overall_status),
        task_assignments!inner(id, cleaner_id, cleaner_name)
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
        properties!tasks_propiedad_id_fkey(codigo),
        task_reports(overall_status),
        task_assignments(id, cleaner_id, cleaner_name)
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
    const taskMap = new Map<string, any>();
    
    [...(assignedTasks || []), ...(legacyTasks || [])].forEach(task => {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    });
    
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

  private mapTaskFromDB(task: any): Task {
    const hasCompletedReport = task.task_reports?.some((report: any) => report.overall_status === 'completed');
    const finalStatus = hasCompletedReport ? 'completed' : task.status;

    // Handle multiple assignments - combine all cleaners into one task
    let cleanerName = task.cleaner;
    let cleanerIdValue = task.cleaner_id;
    
    if (task.task_assignments && task.task_assignments.length > 0) {
      cleanerName = task.task_assignments.map((a: any) => a.cleaner_name).join(', ');
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
      dateFrom = defaultFrom.toISOString().split('T')[0];
    }
    
    if (!dateTo) {
      const defaultTo = new Date(today);
      defaultTo.setDate(defaultTo.getDate() + 45);
      dateTo = defaultTo.toISOString().split('T')[0];
    }
    
    console.log('📦 TaskStorage.getTasks - date range:', { dateFrom, dateTo });
    
    // Query optimizada con rango de fechas
    let query = supabase
      .from('tasks')
      .select(`
        *,
        properties!tasks_propiedad_id_fkey(codigo),
        task_reports(overall_status),
        task_assignments(id, cleaner_id, cleaner_name)
      `)
      .gte('date', dateFrom)
      .lte('date', dateTo);
    
    if (sedeId && sedeId !== 'no-sede') {
      query = query.eq('sede_id', sedeId);
    }
    
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('❌ TaskStorage.getTasks - Error fetching tasks:', error);
      throw error;
    }
    
    console.log('📦 TaskStorage.getTasks - tasks fetched:', data?.length || 0);
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
        properties!tasks_propiedad_id_fkey(codigo),
        task_reports(overall_status),
        task_assignments(id, cleaner_id, cleaner_name)
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
    return this.create(task);
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const result = await this.update(taskId, updates);
    if (!result) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    // Si la tarea se está marcando como completada, procesar consumo automático
    if (updates.status === 'completed' && result.propertyId) {
      try {
        // Importar dinámicamente para evitar dependencias circulares
        const { inventoryStorage } = await import('@/services/storage/inventoryStorage');
        
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
      const { inventoryStorage } = await import('@/services/storage/inventoryStorage');
      
      // Obtener configuraciones de consumo para la propiedad
      const configs = await inventoryStorage.getConsumptionByProperty(propertyId);
      
      if (!configs || configs.length === 0) {
        console.log(`📦 No hay configuraciones de consumo para propiedad ${propertyId}`);
        return;
      }

      console.log(`📦 Procesando consumo automático para ${configs.length} productos`);

      for (const config of configs) {
        if (!config.is_active) continue;

        try {
          // Obtener stock actual del producto
          const stock = await inventoryStorage.getStockByProduct(config.product_id);
          
          if (!stock || stock.current_quantity < config.quantity_per_cleaning) {
            // Si no hay stock suficiente, crear alerta
            await inventoryStorage.createAlert({
              product_id: config.product_id,
              alert_type: 'stock_bajo'
            });
            
            console.log(`⚠️ Stock insuficiente para producto ${config.product?.name}`);
            continue;
          }

          // Calcular nueva cantidad
          const newQuantity = stock.current_quantity - config.quantity_per_cleaning;

          // Actualizar stock
          await inventoryStorage.updateStock(config.product_id, {
            current_quantity: newQuantity,
            updated_by: userId
          });

          // Crear movimiento de inventario
          await inventoryStorage.createMovement({
            product_id: config.product_id,
            movement_type: 'consumo_automatico',
            quantity: config.quantity_per_cleaning,
            previous_quantity: stock.current_quantity,
            new_quantity: newQuantity,
            reason: `Consumo automático - Tarea ${taskId} completada`,
            created_by: userId,
            property_id: propertyId,
            task_id: taskId
          });

          // Verificar si el nuevo stock está por debajo del mínimo
          if (newQuantity <= stock.minimum_stock) {
            await inventoryStorage.createAlert({
              product_id: config.product_id,
              alert_type: newQuantity === 0 ? 'stock_critico' : 'stock_bajo'
            });
          }

          console.log(`✅ Consumo automático procesado: ${config.product?.name} (-${config.quantity_per_cleaning})`);

        } catch (error) {
          console.error(`❌ Error procesando consumo para producto ${config.product?.name}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ Error en processAutomaticConsumption:', error);
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.delete(taskId);
  }
}

export const taskStorageService = new TaskStorageService();