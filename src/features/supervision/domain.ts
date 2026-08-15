import type { Task } from '@/types/calendar';
import type { SupervisionCandidate, SupervisionIncident, SupervisionIncidentPriority, SupervisionReview, SupervisionStop, SupervisionMetrics } from './types';

export const SUPERVISION_MENAJE_ITEMS = [
  'Tenedores',
  'Cucharas',
  'Cuchillos',
  'Tenedores pequeños',
  'Cucharas pequeñas',
  'Vasos',
  'Tazas',
  'Tazas pequeñas',
  'Platos pequeños',
  'Platos llanos',
  'Platos hondos',
  'Tostadora',
  'Hervidor',
  'Cafetera',
  'Secador de pelo',
  'Plancha',
  'Tabla de planchar',
  'Perchas',
  'Sartenes',
  'Ollas/potas',
] as const;

export const DEFAULT_APARTMENT_CHECKLIST = [
  { id: 'cleanliness', category: 'Limpieza', label: 'Limpieza general y superficies', required: true },
  { id: 'bathroom', category: 'Limpieza', label: 'Baño completo y consumibles', required: true },
  { id: 'beds', category: 'Lencería', label: 'Camas, toallas y lencería preparada', required: true },
  { id: 'kitchen', category: 'Cocina', label: 'Cocina, electrodomésticos y menaje', required: true },
  { id: 'equipment', category: 'Equipamiento', label: 'Equipamiento y aparatos revisados', required: false },
  { id: 'access', category: 'Salida', label: 'Puertas, ventanas y accesos seguros', required: true },
] as const;

export const DEFAULT_STORAGE_CHECKLIST = [
  { id: 'organization', category: 'Organización', label: 'Trastero organizado y transitable', required: true },
  { id: 'products', category: 'Productos', label: 'Productos y consumibles suficientes', required: true },
  { id: 'material', category: 'Material', label: 'Material operativo disponible', required: true },
  { id: 'linen', category: 'Lencería', label: 'Lencería de repuesto suficiente', required: true },
  { id: 'duvets', category: 'Edredones', label: 'Edredones y mantas almacenados', required: false },
  { id: 'reserve-tableware', category: 'Menaje', label: 'Menaje de reserva disponible', required: false },
] as const;

export const INCIDENT_CATEGORIES = ['Limpieza', 'Menaje', 'Mantenimiento', 'Equipamiento'] as const;

export const INCIDENT_PRIORITY_LABELS: Record<SupervisionIncidentPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export function calculateCapacity(beds: { double?: number; sofa?: number; single?: number }): number {
  return (beds.double || 0) * 2 + (beds.sofa || 0) * 2 + (beds.single || 0);
}

export function calculateExpectedTableware(capacity: number, manualOverride?: number | null): number {
  if (manualOverride !== null && manualOverride !== undefined && Number.isFinite(manualOverride)) {
    return Math.max(0, Math.round(manualOverride));
  }
  return Math.max(0, Math.round(capacity)) + 2;
}

export function buildChecklistSnapshot(stopType: 'apartment' | 'storage', checked: Record<string, boolean> = {}) {
  const source = stopType === 'storage' ? DEFAULT_STORAGE_CHECKLIST : DEFAULT_APARTMENT_CHECKLIST;
  return {
    version: 1,
    templateName: stopType === 'storage' ? 'Trastero · control operativo v1' : 'Apartamento · revisión v1',
    items: source.map((item) => ({
      id: item.id,
      category: item.category,
      label: item.label,
      checked: checked[item.id] ?? false,
    })),
  };
}

export function getEntryMessage(task: Task | undefined, referenceDate: string, defaultCheckIn = '16:00'): string {
  if (!task?.checkIn) return 'Sin próxima entrada conocida';
  const checkInDate = task.checkIn.slice(0, 10);
  if (checkInDate === referenceDate || task.date === referenceDate) {
    const time = task.checkIn.includes('T') ? task.checkIn.slice(11, 16) : task.checkIn.slice(0, 5);
    return `Entrada el mismo día a las ${time || defaultCheckIn}`;
  }
  const date = new Date(`${checkInDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Próxima entrada pendiente de confirmar'
    : `Próxima entrada ${date.toLocaleDateString('es-ES')}`;
}

export function scoreCandidate(
  task: Task,
  metadata: { incidentCount?: number; negativeReviews?: number; cleanerKnowledge?: number; reviewedRecently?: boolean } = {},
): SupervisionCandidate {
  const reasons: string[] = [];
  let score = 0;
  const incidentCount = metadata.incidentCount || 0;
  if (incidentCount > 0) {
    score += incidentCount * 30;
    reasons.push(`${incidentCount} incidencia${incidentCount === 1 ? '' : 's'}`);
  }
  if ((metadata.negativeReviews || 0) > 0) {
    score += (metadata.negativeReviews || 0) * 25;
    reasons.push('revisiones negativas recientes');
  }
  if (metadata.cleanerKnowledge !== undefined && metadata.cleanerKnowledge <= 2) {
    score += 15;
    reasons.push('personal con menor conocimiento del alojamiento');
  }
  if (task.checkIn) {
    score += 12;
    reasons.push('entrada próxima');
  } else {
    reasons.push('sin próxima entrada conocida');
  }
  if (!metadata.reviewedRecently) {
    score += 8;
    reasons.push('no revisado recientemente');
  } else {
    score -= 5;
  }
  return { task, score, reasons };
}

export function sortCandidates(candidates: SupervisionCandidate[]): SupervisionCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score || a.task.startTime.localeCompare(b.task.startTime));
}

export function getReviewStatusLabel(review: SupervisionReview | undefined): string {
  if (!review) return 'Pendiente';
  if (review.state === 'returned_for_rework') return 'Devuelto para repaso';
  if (review.state === 'with_incidents') return 'Revisión con incidencias';
  return 'Revisado';
}

export function getLatestReviewsByStop(reviews: SupervisionReview[]): Map<string, SupervisionReview> {
  const latestByStop = new Map<string, SupervisionReview>();
  for (const review of reviews) {
    const previous = latestByStop.get(review.route_stop_id);
    if (!previous || review.created_at > previous.created_at) latestByStop.set(review.route_stop_id, review);
  }
  return latestByStop;
}

export function getLatestOpenIncidentsByStop(incidents: SupervisionIncident[]): Map<string, SupervisionIncident> {
  const latestByStop = new Map<string, SupervisionIncident>();
  for (const incident of incidents) {
    if (!incident.route_stop_id || ['resolved', 'archived'].includes(incident.status)) continue;
    const previous = latestByStop.get(incident.route_stop_id);
    if (!previous || incident.created_at > previous.created_at) latestByStop.set(incident.route_stop_id, incident);
  }
  return latestByStop;
}

export function calculateSupervisionMetrics(stops: SupervisionStop[], reviews: SupervisionReview[], incidents: SupervisionIncident[]): SupervisionMetrics {
  const latestByStop = new Map<string, SupervisionReview>();
  for (const review of reviews) {
    const previous = latestByStop.get(review.route_stop_id);
    if (!previous || review.created_at > previous.created_at) latestByStop.set(review.route_stop_id, review);
  }
  const latestReviews = [...latestByStop.values()];
  const reviewedStops = latestReviews.filter((review) => ['reviewed', 'with_incidents'].includes(review.state)).length;
  const openIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status));
  const highPriorityIncidents = openIncidents.filter((incident) => ['high', 'critical'].includes(incident.priority));
  return {
    totalStops: stops.length,
    reviewedStops,
    fullReviews: latestReviews.filter((review) => review.review_type === 'full').length,
    returnedForRework: latestReviews.filter((review) => review.state === 'returned_for_rework').length,
    openIncidents: openIncidents.length,
    highPriorityIncidents: highPriorityIncidents.length,
    reviewCoverage: stops.length ? Math.round((reviewedStops / stops.length) * 100) : 0,
    fullReviewCoverage: stops.length ? Math.round((latestReviews.filter((review) => review.review_type === 'full').length / stops.length) * 100) : 0,
  };
}

export function makeRepeatKey(category: string, label: string): string {
  return `${category.trim().toLowerCase()}::${label.trim().toLowerCase()}`;
}
