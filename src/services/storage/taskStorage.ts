
import { Task } from '@/types/calendar';
import { BaseStorageService } from './baseStorage';

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
    return this.getAll({ column: 'date', ascending: false });
  }

  async createTask(task: TaskCreateData): Promise<Task> {
    return this.create(task);
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const result = await this.update(taskId, updates);
    if (!result) {
      throw new Error(`Task with id ${taskId} not found`);
    }
    return result;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    return this.delete(taskId);
  }
}

export const taskStorageService = new TaskStorageService();
