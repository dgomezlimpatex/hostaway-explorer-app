import type { Task } from '@/types/calendar';

export interface ExtraordinaryTaskFormData {
  serviceName: string;
  serviceAddress: string;
  serviceDate: string;
  startTime: string;
  durationMinutes: number;
  cleanerId?: string;
  cleanerName?: string;
  clientName: string;
  billingAddress: string;
  email: string;
  phoneNumber: string;
  serviceCost: number;
  paymentMethod: string;
  needsInvoice: boolean;
  notes: string;
}

const timeFromMinutes = (minutes: number) => {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

export const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const [hours, minutes] = time.split(':').map(Number);
  const startMinutes = (hours || 0) * 60 + (minutes || 0);
  return timeFromMinutes(startMinutes + minutesToAdd);
};

const buildNotes = (notes: string, needsInvoice: boolean) => {
  const parts = [];
  if (needsInvoice) parts.push('Factura requerida');
  if (notes.trim()) parts.push(notes.trim());
  return parts.join('\n\n');
};

export const buildExtraordinaryTask = (form: ExtraordinaryTaskFormData): Omit<Task, 'id'> => {
  const startTime = form.startTime || '09:00';
  const duration = Math.max(15, Math.round(form.durationMinutes || 60));

  return {
    date: form.serviceDate,
    startTime,
    endTime: addMinutesToTime(startTime, duration),
    checkIn: startTime,
    checkOut: startTime,
    property: form.serviceName.trim(),
    address: form.serviceAddress.trim(),
    type: 'trabajo-extraordinario',
    status: 'pending',
    cleaner: form.cleanerName || '',
    cleanerId: form.cleanerId,
    duration,
    cost: Math.max(0, Number(form.serviceCost) || 0),
    paymentMethod: form.paymentMethod || 'transferencia',
    supervisor: '',
    backgroundColor: '#8B5CF6',
    notes: buildNotes(form.notes, form.needsInvoice),
    clienteId: null,
    propertyId: null,
    extraordinaryClientName: form.clientName.trim(),
    extraordinaryClientEmail: form.email.trim(),
    extraordinaryClientPhone: form.phoneNumber.trim(),
    extraordinaryBillingAddress: form.billingAddress.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};
