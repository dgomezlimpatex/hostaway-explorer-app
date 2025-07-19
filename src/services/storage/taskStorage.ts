
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
    cleanerId: row.cleaner_id
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

    return data;
  }
};

export class TaskStorageService extends BaseStorageService<Task, TaskCreateData> {
  constructor() {
    super(taskStorageConfig);
  }

  async getTasks(): Promise<Task[]> {
    console.log('📋 taskStorage - getTasks called, checking for completed reports');
    
    // Get all tasks with a LEFT JOIN to task_reports
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_reports(overall_status)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching tasks with reports:', error);
      throw error;
    }

    // Map and sync task status with report status
    const mappedTasks = (data || []).map(task => {
      const hasCompletedReport = task.task_reports?.some(report => report.overall_status === 'completed');
      
      // Sync task status: if has completed report but task status is not 'completed', prioritize report status
      const finalStatus = hasCompletedReport ? 'completed' : task.status;
      
      if (hasCompletedReport && task.status !== 'completed') {
        console.log(`🔄 Task ${task.property} (${task.id}) has completed report but status is ${task.status}, updating to completed`);
      }

      return taskStorageConfig.mapFromDB({
        ...task,
        status: finalStatus
      });
    });

    console.log(`📋 taskStorage - returning ${mappedTasks.length} tasks, ${mappedTasks.filter(t => t.status === 'completed').length} completed`);
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
