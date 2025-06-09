
import { useState, useEffect } from 'react';
import { Client } from "@/types/client";
import { Property } from "@/types/property";

interface FormData {
  property: string;
  address: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed';
  checkOut: string;
  checkIn: string;
  cleaner: string;
  date: string;
  duracion: number;
  coste: number;
  metodoPago: string;
  supervisor: string;
}

export const useCreateTaskForm = (currentDate: Date) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    property: '',
    address: '',
    startTime: '',
    endTime: '',
    type: 'checkout-checkin',
    status: 'pending' as const,
    checkOut: '',
    checkIn: '',
    cleaner: '',
    date: currentDate.toISOString().split('T')[0],
    duracion: 0,
    coste: 0,
    metodoPago: '',
    supervisor: ''
  });

  // Función para convertir minutos a formato HH:MM
  const convertMinutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Autocompletar campos cuando se selecciona una propiedad
  useEffect(() => {
    if (selectedProperty && selectedClient) {
      setFormData(prev => ({
        ...prev,
        property: `${selectedProperty.codigo} - ${selectedProperty.nombre}`,
        address: selectedProperty.direccion,
        duracion: selectedProperty.duracionServicio,
        coste: selectedProperty.costeServicio,
        metodoPago: selectedClient.metodoPago,
        supervisor: selectedClient.supervisor,
        checkOut: selectedProperty.checkOutPredeterminado || '',
        checkIn: selectedProperty.checkInPredeterminado || ''
      }));
    }
  }, [selectedProperty, selectedClient]);

  // Recalcular hora de fin cuando cambia la hora de inicio o la duración
  useEffect(() => {
    if (formData.startTime && formData.duracion > 0) {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + formData.duracion;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      setFormData(prev => ({
        ...prev,
        endTime: `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
      }));
    }
  }, [formData.startTime, formData.duracion]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setSelectedClient(null);
    setSelectedProperty(null);
    setFormData({
      property: '',
      address: '',
      startTime: '',
      endTime: '',
      type: 'checkout-checkin',
      status: 'pending',
      checkOut: '',
      checkIn: '',
      cleaner: '',
      date: currentDate.toISOString().split('T')[0],
      duracion: 0,
      coste: 0,
      metodoPago: '',
      supervisor: ''
    });
  };

  return {
    selectedClient,
    setSelectedClient,
    selectedProperty,
    setSelectedProperty,
    formData,
    handleChange,
    convertMinutesToTime,
    resetForm
  };
};
