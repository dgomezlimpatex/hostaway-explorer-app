import { useState } from 'react';
import { Task } from '@/types/calendar';
import { useProperties } from '@/hooks/useProperties';
import { useCleaners } from '@/hooks/useCleaners';
import { BatchAssignmentConfig, AssignmentMode } from './BatchCleanerAssignment';

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
  const { cleaners } = useCleaners();
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

  const [assignmentConfig, setAssignmentConfig] = useState<BatchAssignmentConfig>({
    mode: 'none',
    selectedCleanerId: undefined,
    selectedCleanerIds: [],
    autoScale: true
  });

  const updateBatchData = (field: keyof BatchTaskData, value: any) => {
    setBatchData(prev => ({ ...prev, [field]: value }));
  };

  const generateTasksFromBatch = (): Omit<Task, 'id'>[] => {
    const selectedProps = selectedProperties.map(propertyId => 
      properties.find(p => p.id === propertyId)
    ).filter(Boolean);

    if (selectedProps.length === 0) return [];

    // Determine cleaner assignments based on mode
    const cleanerAssignments = getCleanerAssignments(selectedProps.length);
    
    // Calculate start times based on scaling mode
    const startTimes = calculateStartTimes(selectedProps, cleanerAssignments);

    return selectedProps.map((property, index) => {
      if (!property) return null;

      const assignment = cleanerAssignments[index];
      const startTime = startTimes[index];
      
      // Calculate endTime based on startTime + property duration
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(startHour, startMinute, 0, 0);
      const endDate = new Date(startDate.getTime() + property.duracionServicio * 60000);
      const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

      return {
        ...batchData,
        startTime,
        endTime,
        property: `${property.codigo} - ${property.nombre}`,
        address: property.direccion,
        clienteId: property.clienteId,
        propertyId: property.id,
        duration: property.duracionServicio,
        cost: property.costeServicio,
        cleaner: assignment.cleanerName || '',
        cleanerId: assignment.cleanerId || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean) as Omit<Task, 'id'>[];
  };

  const getCleanerAssignments = (taskCount: number): Array<{ cleanerId?: string; cleanerName?: string }> => {
    const { mode, selectedCleanerId, selectedCleanerIds } = assignmentConfig;

    if (mode === 'none') {
      return Array(taskCount).fill({ cleanerId: undefined, cleanerName: undefined });
    }

    if (mode === 'single' && selectedCleanerId) {
      const cleaner = cleaners.find(c => c.id === selectedCleanerId);
      return Array(taskCount).fill({
        cleanerId: selectedCleanerId,
        cleanerName: cleaner?.name || ''
      });
    }

    if (mode === 'distributed' && selectedCleanerIds.length > 0) {
      // Round-robin distribution
      return Array(taskCount).fill(null).map((_, index) => {
        const cleanerIndex = index % selectedCleanerIds.length;
        const cleanerId = selectedCleanerIds[cleanerIndex];
        const cleaner = cleaners.find(c => c.id === cleanerId);
        return {
          cleanerId,
          cleanerName: cleaner?.name || ''
        };
      });
    }

    return Array(taskCount).fill({ cleanerId: undefined, cleanerName: undefined });
  };

  const calculateStartTimes = (
    selectedProps: any[],
    cleanerAssignments: Array<{ cleanerId?: string; cleanerName?: string }>
  ): string[] => {
    const { autoScale, mode, selectedCleanerIds } = assignmentConfig;

    // If auto-scaling is disabled, all tasks start at the same time
    if (!autoScale) {
      return Array(selectedProps.length).fill(batchData.startTime);
    }

    const [baseHour, baseMinute] = batchData.startTime.split(':').map(Number);
    const baseMinutes = baseHour * 60 + baseMinute;

    if (mode === 'distributed' && selectedCleanerIds.length > 0) {
      // Parallel scaling: each cleaner has their own timeline
      const cleanerTimelines: Record<string, number> = {};
      selectedCleanerIds.forEach(id => {
        cleanerTimelines[id] = baseMinutes;
      });

      return selectedProps.map((property, index) => {
        const assignment = cleanerAssignments[index];
        const cleanerId = assignment.cleanerId;
        
        if (!cleanerId || !cleanerTimelines[cleanerId]) {
          return batchData.startTime;
        }

        const currentStart = cleanerTimelines[cleanerId];
        const startTime = minutesToTime(currentStart);
        
        // Update timeline for this cleaner
        cleanerTimelines[cleanerId] = currentStart + (property?.duracionServicio || 60);
        
        return startTime;
      });
    }

    // Sequential scaling for 'none' or 'single' mode
    let currentMinutes = baseMinutes;
    return selectedProps.map((property) => {
      const startTime = minutesToTime(currentMinutes);
      currentMinutes += property?.duracionServicio || 60;
      return startTime;
    });
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getSchedulePreview = (): Array<{ cleanerName: string; startTime: string; endTime: string; taskCount: number }> => {
    if (selectedProperties.length === 0) return [];

    const selectedProps = selectedProperties.map(propertyId => 
      properties.find(p => p.id === propertyId)
    ).filter(Boolean);

    const cleanerAssignments = getCleanerAssignments(selectedProps.length);
    const startTimes = calculateStartTimes(selectedProps, cleanerAssignments);

    if (assignmentConfig.mode === 'distributed' && assignmentConfig.selectedCleanerIds.length > 0) {
      // Group by cleaner for preview
      const cleanerGroups: Record<string, { tasks: number; minStart: number; maxEnd: number }> = {};

      selectedProps.forEach((property, index) => {
        const assignment = cleanerAssignments[index];
        const cleanerId = assignment.cleanerId || 'unassigned';
        const [startHour, startMinute] = startTimes[index].split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = startMinutes + (property?.duracionServicio || 60);

        if (!cleanerGroups[cleanerId]) {
          cleanerGroups[cleanerId] = { tasks: 0, minStart: Infinity, maxEnd: 0 };
        }
        cleanerGroups[cleanerId].tasks++;
        cleanerGroups[cleanerId].minStart = Math.min(cleanerGroups[cleanerId].minStart, startMinutes);
        cleanerGroups[cleanerId].maxEnd = Math.max(cleanerGroups[cleanerId].maxEnd, endMinutes);
      });

      return Object.entries(cleanerGroups).map(([cleanerId, data]) => {
        const cleaner = cleaners.find(c => c.id === cleanerId);
        return {
          cleanerName: cleaner?.name || 'Sin asignar',
          startTime: minutesToTime(data.minStart),
          endTime: minutesToTime(data.maxEnd),
          taskCount: data.tasks
        };
      });
    }

    // For single or none mode
    if (selectedProps.length > 0) {
      const lastIndex = selectedProps.length - 1;
      const [lastStartHour, lastStartMinute] = startTimes[lastIndex].split(':').map(Number);
      const lastEndMinutes = lastStartHour * 60 + lastStartMinute + (selectedProps[lastIndex]?.duracionServicio || 60);
      
      const cleanerName = assignmentConfig.mode === 'single' && assignmentConfig.selectedCleanerId
        ? cleaners.find(c => c.id === assignmentConfig.selectedCleanerId)?.name || 'Sin asignar'
        : 'Sin asignar';

      return [{
        cleanerName,
        startTime: startTimes[0],
        endTime: minutesToTime(lastEndMinutes),
        taskCount: selectedProps.length
      }];
    }

    return [];
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
    setAssignmentConfig({
      mode: 'none',
      selectedCleanerId: undefined,
      selectedCleanerIds: [],
      autoScale: true
    });
  };

  return {
    selectedProperties,
    setSelectedProperties,
    selectedClientId,
    setSelectedClientId,
    batchData,
    updateBatchData,
    assignmentConfig,
    setAssignmentConfig,
    generateTasksFromBatch,
    getSchedulePreview,
    resetBatchForm,
  };
};
