// Definición de plantillas WhatsApp (categoría Utility) y mapeo de parámetros.
// Los nombres deben coincidir con las plantillas aprobadas en Meta Business Manager.

export type WhatsAppTemplateName =
  | 'task_assigned_approval_es'
  | 'task_modified_es'
  | 'task_cancelled_es'
  | 'task_approval_reminder_es'
  | 'task_late_start_reminder_es'
  | 'task_rejected_admin_alert_es';

export interface WhatsAppTemplateDef {
  name: WhatsAppTemplateName;
  languageCode: string;
  /** Número de parámetros {{n}} del cuerpo. */
  bodyParamCount: number;
  /** Si la plantilla tiene botones de respuesta rápida (quick reply). */
  hasButtons: boolean;
  category: 'utility';
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateName, WhatsAppTemplateDef> = {
  task_assigned_approval_es: {
    name: 'task_assigned_approval_es',
    languageCode: 'es',
    bodyParamCount: 6, // nombre, dirección, propiedad, fecha, horaInicio, horaFin
    hasButtons: true,
    category: 'utility',
  },
  task_modified_es: {
    name: 'task_modified_es',
    languageCode: 'es',
    bodyParamCount: 5, // nombre, propiedad, fecha, horaInicio, horaFin
    hasButtons: true,
    category: 'utility',
  },
  task_cancelled_es: {
    name: 'task_cancelled_es',
    languageCode: 'es',
    bodyParamCount: 5, // nombre, propiedad, fecha, horaInicio, horaFin
    hasButtons: false,
    category: 'utility',
  },
  task_approval_reminder_es: {
    name: 'task_approval_reminder_es',
    languageCode: 'es',
    bodyParamCount: 5, // nombre, propiedad, fecha, horaInicio, horaFin
    hasButtons: true,
    category: 'utility',
  },
  task_late_start_reminder_es: {
    name: 'task_late_start_reminder_es',
    languageCode: 'es',
    bodyParamCount: 3, // nombre, propiedad, horaInicio
    hasButtons: true,
    category: 'utility',
  },
  task_rejected_admin_alert_es: {
    name: 'task_rejected_admin_alert_es',
    languageCode: 'es',
    bodyParamCount: 5, // limpiadora, propiedad, fecha, hora, motivo
    hasButtons: false,
    category: 'utility',
  },
};

/** Mapea el tipo de evento de notificación a la plantilla WhatsApp correspondiente. */
export function templateForEventType(eventType: string): WhatsAppTemplateName | null {
  switch (eventType) {
    case 'task_assigned':
      return 'task_assigned_approval_es';
    case 'task_modified':
      return 'task_modified_es';
    case 'task_cancelled':
      return 'task_cancelled_es';
    case 'task_approval_reminder':
      return 'task_approval_reminder_es';
    case 'task_late_start_reminder':
      return 'task_late_start_reminder_es';
    case 'task_rejected_alert':
      return 'task_rejected_admin_alert_es';
    default:
      return null;
  }
}

/** Construye los componentes "body" de la API de Meta a partir de parámetros de texto. */
export function buildBodyComponent(bodyParameters: string[]) {
  return {
    type: 'body',
    parameters: bodyParameters.map((text) => ({ type: 'text', text })),
  };
}
