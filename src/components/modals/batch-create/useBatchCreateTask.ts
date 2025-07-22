
import { useState } from 'react';
import { Task } from '@/types/calendar';
import { useProperties } from '@/hooks/useProperties';

export interface BatchTaskData {
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner?: string;
  paymentMethod: string;
  supervisor: string;
}

export const useBatchCreateTask = () => {
  const { data: properties = [] } = useProperties();
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [batchData, setBatchData] = useState<BatchTaskData>({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '12:00',
    type: 'mantenimiento-airbnb',
    status: 'pending',
    checkOut: '11:00',
    checkIn: '15:00',
    paymentMethod: 'transferencia',
    supervisor: '',
  });

  const updateBatchData = (field: keyof BatchTaskData, value: any) => {
    setBatchData(prev => ({ ...prev, [field]: value }));
  };

  const generateTasksFromBatch = (): Omit<Task, 'id'>[] => {
    return selectedProperties.map(propertyId => {
      const property = properties.find(p => p.id === propertyId);
      if (!property) return null;

      return {
        ...batchData,
        property: `${property.codigo} - ${property.nombre}`,
        address: property.direccion,
        clienteId: property.clienteId,
        propertyId: property.id,
        duration: property.duracionServicio,
        cost: property.costeServicio,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean) as Omit<Task, 'id'>[];
  };

  const resetBatchForm = () => {
    setSelectedProperties([]);
    setSelectedClientId(null);
    setBatchData({
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '12:00',
      type: 'mantenimiento-airbnb',
      status: 'pending',
      checkOut: '11:00',
      checkIn: '15:00',
      paymentMethod: 'transferencia',
      supervisor: '',
    });
  };

  return {
    selectedProperties,
    setSelectedProperties,
    selectedClientId,
    setSelectedClientId,
    batchData,
    updateBatchData,
    generateTasksFromBatch,
    resetBatchForm,
  };
};
