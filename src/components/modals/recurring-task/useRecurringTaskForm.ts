
import { useState } from 'react';
import { RecurringTask } from '@/types/recurring';
import { Client } from '@/types/client';
import { Property } from '@/types/property';

export interface RecurringTaskFormData {
  name: string;
  description: string;
  clienteId: string;
  propiedadId: string;
  type: string;
  startTime: string;
  endTime: string;
  checkOut: string;
  checkIn: string;
  duracion: number;
  coste: number;
  metodoPago: string;
  supervisor: string;
  cleaner: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export const useRecurringTaskForm = () => {
  const [formData, setFormData] = useState<RecurringTaskFormData>({
    name: '',
    description: '',
    clienteId: '',
    propiedadId: '',
    type: 'mantenimiento-airbnb',
    startTime: '09:00',
    endTime: '12:00',
    checkOut: '11:00',
    checkIn: '15:00',
    duracion: 180,
    coste: 0,
    metodoPago: 'transferencia',
    supervisor: '',
    cleaner: '',
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [1],
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true
  });

  const updateFormData = (field: keyof RecurringTaskFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClientChange = (client: Client | null) => {
    setFormData(prev => ({ 
      ...prev, 
      clienteId: client?.id || '',
      propiedadId: '' // Reset property when client changes
    }));
  };

  const handlePropertyChange = (property: Property | null) => {
    setFormData(prev => ({ 
      ...prev, 
      propiedadId: property?.id || ''
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      clienteId: '',
      propiedadId: '',
      type: 'mantenimiento-airbnb',
      startTime: '09:00',
      endTime: '12:00',
      checkOut: '11:00',
      checkIn: '15:00',
      duracion: 180,
      coste: 0,
      metodoPago: 'transferencia',
      supervisor: '',
      cleaner: '',
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1],
      dayOfMonth: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isActive: true
    });
  };

  const getTaskData = (): Omit<RecurringTask, 'id' | 'createdAt' | 'nextExecution'> => {
    return {
      ...formData,
      clienteId: formData.clienteId || undefined,
      propiedadId: formData.propiedadId || undefined,
      endDate: formData.endDate || undefined,
      cleaner: formData.cleaner || undefined,
      lastExecution: undefined
    };
  };

  return {
    formData,
    updateFormData,
    handleClientChange,
    handlePropertyChange,
    resetForm,
    getTaskData
  };
};
