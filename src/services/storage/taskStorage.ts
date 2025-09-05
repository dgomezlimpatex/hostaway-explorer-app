
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
    originalTaskId: row.originalTaskId || row.id // Para asignaciones múltiples
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

  async getTasks(options?: {
    cleanerId?: string;
    includePastTasks?: boolean;
    userRole?: string;
    sedeId?: string; // Nuevo: recibir sede_id como parámetro
  }): Promise<Task[]> {
    
    // Función helper para obtener la sede activa
    const getActiveSedeId = (): string | null => {
      try {
        const activeSede = localStorage.getItem('activeSede');
        if (activeSede) {
          const sede = JSON.parse(activeSede);
          return sede.id;
        }
        return null;
      } catch (error) {
        console.warn('Error getting active sede:', error);
        return null;
      }
    };
    
    // Check for recurring tasks that might be causing the issue
    const checkRecurringTasks = async () => {
      try {
        const { data: recurringTasks } = await supabase
          .from('recurring_tasks')
          .select('*')
          .ilike('name', '%Main Street Deluxe Penthouse A%')
          .eq('is_active', true);
        
        if (recurringTasks && recurringTasks.length > 0) {
          console.warn('🔄 FOUND ACTIVE RECURRING TASKS for Main Street:', recurringTasks);
          return recurringTasks;
        }
      } catch (error) {
        console.error('Error checking recurring tasks:', error);
      }
      return [];
    };
    
    // Aplicar filtro por sede - usar parámetro si está disponible, sino localStorage
    const sedeId = options?.sedeId || getActiveSedeId();
    
    // Check for recurring tasks that might be causing the issue
    const recurringTasks = await checkRecurringTasks();
    
    // FIXED: Use pagination to get ALL tasks beyond Supabase's 1000 record limit
    let allTasks: any[] = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;
    
    while (hasMore) {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          properties!tasks_propiedad_id_fkey(codigo),
          task_reports(overall_status),
          task_assignments(id, cleaner_id, cleaner_name)
        `);
      
      // Solo aplicar filtro de sede si existe
      if (sedeId && sedeId !== 'no-sede') {
        query = query.eq('sede_id', sedeId);
      }
      
      const { data: batchData, error } = await query
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('❌ Error fetching tasks batch:', error);
        throw error;
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false;
      } else {
        allTasks = [...allTasks, ...batchData];
        offset += batchSize;
        
        // If we got less than batchSize, we've reached the end
        if (batchData.length < batchSize) {
          hasMore = false;
        }
        
        console.log(`📦 Fetched batch: ${batchData.length} tasks, total so far: ${allTasks.length}`);
      }
    }
    
    const data = allTasks;

    console.log(`📦 Fetched ${data?.length || 0} task records from database`);
    
    // Debugging: Check for the problematic task
    const mainStreetTasks = (data || []).filter(task => 
      task.property?.includes('Main Street Deluxe Penthouse A')
    );
    
    if (mainStreetTasks.length > 0) {
      console.log('🔍 FOUND Main Street Deluxe Penthouse A tasks:', {
        count: mainStreetTasks.length,
        tasks: mainStreetTasks.map(t => ({
          id: t.id,
          date: t.date,
          property: t.property,
          status: t.status,
          assignments: t.task_assignments?.length || 0,
          reports: t.task_reports?.length || 0
        }))
      });
      
      // Check if this might be from recurring tasks
      const uniqueDates = [...new Set(mainStreetTasks.map(t => t.date))];
      if (uniqueDates.length > 5) {
        console.warn('⚠️ POSSIBLE RECURRING TASK ISSUE: Main Street task appears on multiple dates:', uniqueDates);
      }
    }

    // Map and sync task status with report status, handle multiple assignments
    const mappedTasks: Task[] = [];
    
    (data || []).forEach(task => {
      const hasCompletedReport = task.task_reports?.some(report => report.overall_status === 'completed');
      
      // Sync task status: if has completed report but task status is not 'completed', prioritize report status
      const finalStatus = hasCompletedReport ? 'completed' : task.status;

      // Base task data
      const baseTaskData = {
        ...task,
        status: finalStatus
      };

      // Handle multiple assignments - combine all cleaners into one task
      if (task.task_assignments && task.task_assignments.length > 0) {
        // Combine all cleaner names separated by commas
        const allCleanerNames = task.task_assignments.map(a => a.cleaner_name).join(', ');
        
        // Use the first cleaner's ID as primary, but store all cleaner names
        const primaryAssignment = task.task_assignments[0];
        
        const taskData = {
          ...baseTaskData,
          cleaner: allCleanerNames, // Combine all names
          cleaner_id: primaryAssignment.cleaner_id, // Primary cleaner ID
          originalTaskId: task.id,
          // Store all assignments for reference
          assignments: task.task_assignments
        };
        
        const mappedTask = taskStorageConfig.mapFromDB(taskData);
        mappedTasks.push(mappedTask);
        
      } else {
        // No specific assignments, use original task data
        const mappedTask = taskStorageConfig.mapFromDB(baseTaskData);
        mappedTasks.push(mappedTask);
      }
    });
    return mappedTasks;
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
