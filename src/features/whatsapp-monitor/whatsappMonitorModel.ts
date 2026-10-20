// Lógica pura del monitor de WhatsApp: estados, causas, línea de tiempo,
// filtros en la URL y validaciones. Sin React ni Supabase para poder probarla.

export const UNCONFIRMED_MINUTES = 30;
export const PAGE_SIZE = 50;
export const RESEND_SAFE_WINDOW_HOURS = 23;

export interface DeliveryRow {
  id: string;
  notification_event_id: string;
  provider_message_ref: string | null;
  recipient_masked: string;
  template_name: string | null;
  status: string;
  error_code: string | null;
  error_detail: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
  event_type: string;
  cleaner_name: string | null;
  property: string | null;
  task_date: string | null;
  total_count: number;
}

export interface SendReconciliationRow {
  delivery_id: string;
  notification_event_id: string;
  channel: 'whatsapp' | 'email';
  provider: string;
  recipient_masked: string;
  template_name: string | null;
  uncertainty_state: string;
  detail: string;
  created_at: string;
  open_action_status: string | null;
}

export interface WebhookReconciliationRow {
  callback_kind: string;
  provider_message_ref: string;
  sender_masked: string;
  callback_state: string;
  detail: string;
  attempts: number;
  received_at: string;
}

/** Intento devuelto por la RPC saneada de detalle (si el servidor la tiene). */
export interface DeliveryAttemptRow {
  attempt_no: number;
  state: string;
  started_at: string | null;
  finalized_at: string | null;
  last_status: string | null;
  status_occurred_at: string | null;
  error_code: string | null;
  error_detail: string | null;
  provider_message_ref: string | null;
}

export interface ManualActionRow {
  resolution: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  requested_by_name: string | null;
  result_detail: string | null;
}

export const EVENT_LABELS: Record<string, string> = {
  task_assigned: 'Tarea asignada',
  task_modified: 'Tarea modificada',
  task_cancelled: 'Asignación cancelada',
  task_approval_reminder: 'Recordatorio de aprobación',
  task_late_start_reminder: 'Recordatorio de inicio',
  task_rejected_alert: 'Alerta de rechazo',
  task_approved_confirmation: 'Confirmación de aceptación',
};

export const eventLabel = (row: Pick<DeliveryRow, 'event_type' | 'template_name'>) =>
  EVENT_LABELS[row.event_type] ?? row.template_name ?? 'WhatsApp';

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

export type StatusKey =
  | 'queued' | 'uncertain' | 'sent' | 'delivered' | 'read'
  | 'failed' | 'undeliverable' | 'skipped' | 'unknown';

export interface StatusInfo {
  key: StatusKey;
  label: string;
  /** Explicación corta para el detalle y lectores de pantalla. */
  meaning: string;
}

const STATUS_INFO: Record<Exclude<StatusKey, 'unknown'>, Omit<StatusInfo, 'key'>> = {
  queued: { label: 'En cola', meaning: 'Preparado en el servidor; todavía no se ha contactado con Meta.' },
  uncertain: { label: 'Resultado incierto', meaning: 'Meta no confirmó ni rechazó el envío. El servidor puede hacer un único reintento automático 2/2 o requiere comprobación manual.' },
  sent: { label: 'Aceptado por Meta', meaning: 'Meta aceptó el mensaje. Aún no ha comunicado la entrega.' },
  delivered: { label: 'Entregado', meaning: 'Meta comunicó que el mensaje llegó al teléfono.' },
  read: { label: 'Leído', meaning: 'Meta comunicó que la persona lo leyó.' },
  failed: { label: 'Fallido', meaning: 'El envío falló.' },
  undeliverable: { label: 'No entregable', meaning: 'Meta no pudo entregarlo a ese número.' },
  skipped: { label: 'No enviado', meaning: 'El servidor no intentó enviarlo.' },
};

export function statusInfo(row: Pick<DeliveryRow, 'status' | 'error_code'> & { error_detail?: string | null }): StatusInfo {
  if (row.status === 'queued' && row.error_code === 'reconciliation_required') {
    // El intento solo se indica si el texto del servidor lo dice; no se supone 1/2.
    const attempt = queueAttempt({ channel: 'whatsapp', detail: row.error_detail ?? '' });
    if (attempt.exhausted) {
      return { key: 'uncertain', label: 'Resultado incierto · 2/2', meaning: 'Meta no confirmó ninguno de los dos intentos. No habrá más intentos automáticos: requiere comprobación manual.' };
    }
    return { key: 'uncertain', ...STATUS_INFO.uncertain, label: attempt.attempt ? `Resultado incierto · ${attempt.attempt}` : STATUS_INFO.uncertain.label };
  }
  const known = STATUS_INFO[row.status as Exclude<StatusKey, 'unknown'>];
  if (known && row.status !== 'uncertain') return { key: row.status as StatusKey, ...known };
  return {
    key: 'unknown',
    label: `Desconocido: ${row.status || 'sin estado'}`,
    meaning: 'El servidor devolvió un estado que esta pantalla no reconoce. No se interpreta como pendiente ni como enviado.',
  };
}

export const isUnconfirmed = (row: Pick<DeliveryRow, 'status' | 'sent_at' | 'created_at'>, now = Date.now()) =>
  row.status === 'sent'
  && new Date(row.sent_at ?? row.created_at).getTime() < now - UNCONFIRMED_MINUTES * 60 * 1000;

// ---------------------------------------------------------------------------
// Causa de «No enviado» y de fallos
// ---------------------------------------------------------------------------

export type SkipCause = 'preparation' | 'admin_phone' | 'no_channel' | 'other';

export interface Cause {
  /** Texto corto para la lista. */
  label: string;
  /** Si alguien puede hacer algo (configurar teléfono, revisar consentimiento…). */
  actionable: boolean;
  /** Qué hacer, si aplica. */
  hint?: string;
  kind: SkipCause | 'consent_or_phone' | 'technical' | 'none';
}

// Los textos los escribe el servidor (send-whatsapp-notification y
// whatsappClient). Se usan solo para clasificar lo que el servidor ya registró;
// si cambian, la fila cae en «Otro motivo» y se muestra el texto original.
const PREPARATION_PATTERN = /modo preparaci[oó]n|dry-run/i;
const ADMIN_PHONE_PATTERN = /tel[eé]fono administrativo/i;
const NO_CHANNEL_PATTERN = /sin tel[eé]fono\/opt-in/i;

export function skipCause(row: Pick<DeliveryRow, 'status' | 'error_code' | 'error_detail'>): Cause | null {
  if (row.status !== 'skipped') return null;
  const detail = row.error_detail ?? '';
  if (PREPARATION_PATTERN.test(detail)) {
    return { kind: 'preparation', label: 'Modo preparación', actionable: false, hint: 'El servidor estaba en modo preparación y no contactó con Meta. Es un estado esperado, no un fallo.' };
  }
  if (row.error_code === 'channel_unavailable' && ADMIN_PHONE_PATTERN.test(detail)) {
    return { kind: 'admin_phone', label: 'Falta teléfono de administración', actionable: true, hint: 'No hay teléfono de WhatsApp de administración configurado; el servidor intenta el email alternativo.' };
  }
  if (row.error_code === 'channel_unavailable' || NO_CHANNEL_PATTERN.test(detail)) {
    return {
      kind: 'no_channel',
      label: 'Sin teléfono o sin consentimiento',
      actionable: true,
      hint: 'La trabajadora no tiene teléfono de WhatsApp o no ha dado su consentimiento. No es un fallo técnico: revisa su ficha. Esta pantalla no cambia el consentimiento.',
    };
  }
  return { kind: 'other', label: 'Otro motivo', actionable: true, hint: detail || 'El servidor no indicó el motivo.' };
}

const FAILURE_CODES: Record<string, string> = {
  invalid_phone: 'Teléfono con formato no válido',
  network_error: 'Error de red al contactar con Meta',
  missing_provider_message_id: 'Meta no devolvió identificador',
  reconciliation_required: 'Resultado incierto',
  '131026': 'Ese número no puede recibir el mensaje',
  '131049': 'Meta limitó la entrega',
  '131047': 'Fuera de la ventana de 24 h de Meta',
  '132000': 'Parámetros de plantilla incorrectos',
  '132001': 'La plantilla no existe en Meta',
};

export function failureLabel(row: Pick<DeliveryRow, 'error_code'>) {
  if (!row.error_code) return null;
  return FAILURE_CODES[row.error_code] ?? `Código ${row.error_code}`;
}

// ---------------------------------------------------------------------------
// Fechas (Europe/Madrid)
// ---------------------------------------------------------------------------

const timeFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const timeSecondsFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const dayFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short' });
const madridDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });

const clean = (value: string) => value.replace(/\./g, '').replace(/,/g, '');

/** «10:20» si es hoy en Madrid; si no, «lun 19 oct 10:20». */
export function formatMoment(value: string | null | undefined, now = Date.now()) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = timeFormatter.format(date);
  if (madridDayKey.format(date) === madridDayKey.format(new Date(now))) return time;
  return `${clean(dayFormatter.format(date))} ${time}`;
}

export const formatClock = (value: number | string | Date) => timeSecondsFormatter.format(new Date(value));

/** Fecha de tarea (YYYY-MM-DD, sin hora) como «mié 21 oct». */
export function formatTaskDate(value: string | null | undefined) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  // Mediodía UTC: el mismo día civil en Madrid durante todo el año.
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return clean(dayFormatter.format(date));
}

// ---------------------------------------------------------------------------
// «Cuándo»: verbo + hora del último hecho comunicado
// ---------------------------------------------------------------------------

export function lastMoment(row: DeliveryRow, now = Date.now()) {
  const info = statusInfo(row);
  if (row.read_at && (info.key === 'read')) return { verb: 'Leído', at: row.read_at };
  if (row.delivered_at && (info.key === 'delivered' || info.key === 'read')) return { verb: 'Entregado', at: row.delivered_at };
  if (row.failed_at) return { verb: info.key === 'undeliverable' ? 'No entregable' : 'Falló', at: row.failed_at };
  if (row.sent_at) return { verb: 'Aceptado', at: row.sent_at };
  if (info.key === 'skipped') return { verb: 'No enviado', at: row.created_at };
  if (info.key === 'uncertain') return { verb: 'Iniciado', at: row.created_at };
  void now;
  return { verb: 'Creado', at: row.created_at };
}

export interface TimelineEntry {
  at: string | null;
  label: string;
  tone: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
}

/**
 * Línea de tiempo con los datos que ya devuelve el monitor. Entregado y Leído
 * solo aparecen si Meta los comunicó; nunca se deducen.
 */
export function basicTimeline(row: DeliveryRow, now = Date.now()): TimelineEntry[] {
  const info = statusInfo(row);
  const entries: TimelineEntry[] = [{ at: row.created_at, label: `Aviso creado (${eventLabel(row)})`, tone: 'neutral' }];
  if (info.key === 'skipped') {
    entries.push({ at: row.created_at, label: `No enviado: ${skipCause(row)?.label ?? 'sin motivo'}`, tone: 'warning' });
    return entries;
  }
  if (info.key === 'uncertain') {
    entries.push({ at: null, label: info.label.endsWith('2/2')
      ? 'Ningún intento tuvo respuesta clara de Meta. No habrá más intentos automáticos.'
      : 'Sin respuesta clara de Meta. Como máximo puede haber un reintento automático.', tone: 'warning' });
  }
  if (info.key === 'queued') entries.push({ at: null, label: 'En cola: aún no se ha contactado con Meta', tone: 'neutral' });
  if (row.sent_at) entries.push({ at: row.sent_at, label: 'Aceptado por Meta', tone: 'info' });
  if (row.delivered_at) entries.push({ at: row.delivered_at, label: 'Entregado (comunicado por Meta)', tone: 'success' });
  if (row.read_at) entries.push({ at: row.read_at, label: 'Leído (comunicado por Meta)', tone: 'success' });
  if (row.failed_at) entries.push({ at: row.failed_at, label: info.key === 'undeliverable' ? 'No entregable' : 'Falló', tone: 'danger' });
  if (row.sent_at && !row.delivered_at && !row.failed_at) {
    entries.push({
      at: null,
      label: isUnconfirmed(row, now)
        ? `Entrega no comunicada por Meta tras más de ${UNCONFIRMED_MINUTES} min`
        : 'Entrega todavía no comunicada por Meta',
      tone: isUnconfirmed(row, now) ? 'warning' : 'neutral',
    });
  }
  if (row.delivered_at && !row.read_at && !row.failed_at) {
    entries.push({ at: null, label: 'Lectura no comunicada (puede no llegar nunca si la persona desactivó la confirmación de lectura)', tone: 'neutral' });
  }
  if (info.key === 'unknown') entries.push({ at: null, label: info.meaning, tone: 'warning' });
  return entries;
}

const ATTEMPT_STATE_LABELS: Record<string, string> = {
  contacting: 'contactando con Meta',
  accepted: 'aceptado por Meta',
  sent: 'aceptado por Meta',
  failed: 'falló',
  uncertain: 'sin respuesta clara',
  completed_uncertain: 'sin respuesta clara',
  retry_authorized: 'reintento autorizado',
};

export const attemptStateLabel = (state: string) => ATTEMPT_STATE_LABELS[state] ?? state;

// ---------------------------------------------------------------------------
// Filtros en la URL
// ---------------------------------------------------------------------------

export const PERIODS = { '24h': 1, '7d': 7, '31d': 31 } as const;
export type PeriodKey = keyof typeof PERIODS;
export const PERIOD_LABELS: Record<PeriodKey, string> = { '24h': 'Últimas 24 h', '7d': 'Últimos 7 días', '31d': 'Últimos 31 días' };

/** Valores de estado que admite la RPC actual (`_status`). */
export const STATUS_FILTERS = {
  all: 'Todos los estados',
  attention: 'Necesitan acción',
  queued: 'En cola o inciertos',
  sent: 'Aceptados por Meta',
  delivered: 'Entregados',
  read: 'Leídos',
  failed: 'Fallidos',
  skipped: 'No enviados',
} as const;
export type StatusFilter = keyof typeof STATUS_FILTERS;

export interface MonitorFilters {
  period: PeriodKey;
  status: StatusFilter;
  q: string;
  page: number;
  delivery: string | null;
}

export const DEFAULT_FILTERS: MonitorFilters = { period: '7d', status: 'all', q: '', page: 0, delivery: null };

export function parseFilters(search: string | URLSearchParams): MonitorFilters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const period = params.get('periodo');
  const status = params.get('estado');
  const page = Number.parseInt(params.get('pagina') ?? '', 10);
  return {
    period: period && period in PERIODS ? (period as PeriodKey) : DEFAULT_FILTERS.period,
    status: status && status in STATUS_FILTERS ? (status as StatusFilter) : DEFAULT_FILTERS.status,
    q: (params.get('q') ?? '').slice(0, 100),
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
    delivery: params.get('envio') || null,
  };
}

/** Conserva parámetros ajenos y omite los valores por defecto. */
export function writeFilters(filters: MonitorFilters, base?: URLSearchParams) {
  const params = new URLSearchParams(base);
  const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
  set('periodo', filters.period === DEFAULT_FILTERS.period ? null : filters.period);
  set('estado', filters.status === DEFAULT_FILTERS.status ? null : filters.status);
  set('q', filters.q.trim() || null);
  set('pagina', filters.page > 0 ? String(filters.page + 1) : null);
  set('envio', filters.delivery);
  return params;
}

export interface ActiveChip { key: 'period' | 'status' | 'q'; label: string }

export function activeChips(filters: MonitorFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.period !== DEFAULT_FILTERS.period) chips.push({ key: 'period', label: PERIOD_LABELS[filters.period] });
  if (filters.status !== DEFAULT_FILTERS.status) chips.push({ key: 'status', label: STATUS_FILTERS[filters.status] });
  if (filters.q.trim()) chips.push({ key: 'q', label: `«${filters.q.trim()}»` });
  return chips;
}

/**
 * La RPC busca con ILIKE '%texto%' y la barra invertida es el escape por
 * defecto de Postgres: así «_» y «%» se buscan literalmente.
 */
export const escapeLikePattern = (value: string) => value.trim().replace(/[\\%_]/g, (char) => `\\${char}`);

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export interface DeliveryStats {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  unconfirmed: number;
  /** Tal como lo calcula el servidor (fallos, no enviados, sin confirmar, inciertos). */
  unresolved: number;
  /**
   * Claves de la versión 2 del resumen (propuesta de backend pendiente). Si el
   * servidor no las devuelve quedan sin definir y se usa el cálculo anterior.
   */
  uncertain?: number;
  skippedPreparation?: number;
  attentionVersion?: number;
}

export function parseStats(raw: unknown): DeliveryStats {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const number = (key: string) => {
    const value = Number(source[key] ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  };
  return {
    sent: number('sent'),
    delivered: number('delivered'),
    read: number('read'),
    failed: number('failed'),
    skipped: number('skipped'),
    unconfirmed: number('unconfirmed'),
    unresolved: number('unresolved'),
    ...(source.attention_version === 2 ? {
      uncertain: number('uncertain'),
      skippedPreparation: number('skipped_preparation'),
      attentionVersion: 2,
    } : {}),
  };
}

/**
 * Desglose de lo que el servidor cuenta en `unresolved`. Las categorías son
 * disjuntas por estado; los inciertos (queued + reconciliation_required) son el
 * resto, porque la RPC actual no los devuelve aparte.
 */
export function attentionBreakdown(stats: DeliveryStats) {
  if (stats.attentionVersion === 2) {
    // v2: el servidor ya excluye el modo preparación de `unresolved`.
    const skipped = Math.max(0, stats.skipped - (stats.skippedPreparation ?? 0));
    return { failed: stats.failed, uncertain: stats.uncertain ?? 0, unconfirmed: stats.unconfirmed, skipped, total: stats.unresolved, preparation: stats.skippedPreparation ?? 0, excludesPreparation: true };
  }
  const uncertain = Math.max(0, stats.unresolved - stats.failed - stats.skipped - stats.unconfirmed);
  return { failed: stats.failed, uncertain, unconfirmed: stats.unconfirmed, skipped: stats.skipped, total: stats.unresolved, preparation: null as number | null, excludesPreparation: false };
}

/**
 * Contador del menú. Un callback de Meta sin correlacionar suele pertenecer a un
 * envío incierto que ya está en `unresolved` (el ID de Meta no llegó a guardarse),
 * así que sumarlos contaría dos veces el mismo problema. El máximo es una cota
 * inferior sin duplicados y nunca es 0 si hay algo pendiente.
 */
export const menuAttentionCount = (deliveryAttention: number, callbackPending: number) =>
  Math.max(deliveryAttention, callbackPending);

// ---------------------------------------------------------------------------
// Resolución manual
// ---------------------------------------------------------------------------

export function validateProviderMessageId(channel: 'whatsapp' | 'email', value: string): string | null {
  const id = value.trim();
  if (!id) return 'Introduce el identificador del mensaje.';
  if (id.length > 255) return 'El identificador es demasiado largo.';
  if (/\s/.test(id)) return 'El identificador no puede contener espacios.';
  if (channel === 'whatsapp') {
    if (!/^wamid\./i.test(id)) return 'Un ID de Meta empieza por «wamid.». Cópialo completo desde el registro de Meta.';
    if (id.length < 20) return 'El ID de Meta parece incompleto.';
  } else if (id.length < 8) {
    return 'El ID de Resend parece incompleto.';
  }
  return null;
}

const RESOLUTION_ERRORS: Record<string, string> = {
  forbidden: 'Solo administración puede resolver envíos.',
  invalid_resolution: 'Tipo de resolución no válido.',
  provider_message_id_required: 'Falta el identificador del mensaje.',
  delivery_not_reconcilable: 'Este envío ya no está pendiente de comprobación (puede que el servidor lo haya resuelto). Actualiza la página.',
  whatsapp_uncertain_cannot_be_reopened: 'Un WhatsApp incierto no se puede reintentar a mano: Meta no permite demostrar que no salió.',
  resend_idempotency_window_expired: 'Han pasado más de 23 h desde el inicio del envío: ya no es seguro reintentarlo. Comprueba en Resend y confirma como enviado si salió.',
};

export function resolutionErrorMessage(error: unknown) {
  const source = (error && typeof error === 'object' ? error : {}) as { message?: string; code?: string };
  const message = source.message ?? '';
  for (const [code, text] of Object.entries(RESOLUTION_ERRORS)) if (message.includes(code)) return text;
  if (source.code === '23505' || /duplicate key|one_open/i.test(message)) return 'Ya hay una resolución en curso para este envío.';
  if (source.code === '42501') return RESOLUTION_ERRORS.forbidden;
  return 'No se pudo encolar la resolución. Inténtalo de nuevo o revisa el envío en el proveedor.';
}

/**
 * Ventana segura de reintento por email. La cola no devuelve la hora real de
 * inicio del envío, solo su creación (siempre anterior o igual), así que el
 * cálculo es una estimación prudente: puede dar por vencida una ventana que el
 * servidor aún acepta, nunca al revés.
 */
export function resendWindow(createdAt: string, now = Date.now()) {
  const deadline = new Date(createdAt).getTime() + RESEND_SAFE_WINDOW_HOURS * 3600 * 1000;
  const remainingMs = deadline - now;
  return { expired: remainingMs <= 0, remainingHours: Math.max(0, Math.floor(remainingMs / 3600000)), remainingMs };
}

export function uncertaintyLabel(state: string) {
  if (state === 'meta_contacting') return { label: 'Contactando con Meta', canConfirm: false, explanation: 'El servidor está contactando con Meta en este momento. Espera a que termine antes de confirmar nada.' };
  if (state === 'meta_uncertain') return { label: 'Resultado incierto en Meta', canConfirm: true, explanation: 'Meta no confirmó ni rechazó el intento. Compruébalo en el registro de Meta.' };
  if (state === 'resend_uncertain') return { label: 'Resultado incierto en Resend', canConfirm: true, explanation: 'Resend no confirmó el email alternativo. Compruébalo en Resend.' };
  return { label: `Estado no reconocido: ${state}`, canConfirm: false, explanation: 'Estado de comprobación no reconocido; no se permite confirmar desde aquí.' };
}

export const ageLabel = (value: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
};

/** PostgREST devuelve PGRST202 cuando la función no existe (servidor sin actualizar). */
export const isMissingRpc = (error: unknown) => {
  const source = (error && typeof error === 'object' ? error : {}) as { code?: string; message?: string };
  return source.code === 'PGRST202' || /could not find the function/i.test(source.message ?? '');
};

export const isForbidden = (error: unknown) => {
  const source = (error && typeof error === 'object' ? error : {}) as { code?: string; message?: string };
  return source.code === '42501' || /forbidden|not_authorized/i.test(source.message ?? '');
};

// ---------------------------------------------------------------------------
// Envíos por comprobar a mano: identificación, asunto, intento y grupos
// ---------------------------------------------------------------------------

/**
 * Últimos 4 dígitos del destinatario enmascarado. El servidor de producción
 * devuelve hoy los puntos mal codificados («â€¢»); se ignoran y nunca se
 * muestran más de 4 dígitos aunque el texto contenga más.
 */
export function phoneTail(masked: string | null | undefined) {
  const digits = (masked ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** «•••• 7093» limpio, para listas compactas. */
export function maskedPhone(masked: string | null | undefined) {
  const tail = phoneTail(masked);
  return tail ? `•••• ${tail}` : '••••';
}

/** «Teléfono acabado en 7093» o la ausencia del dato, sin inventarlo. */
export function recipientLabel(masked: string | null | undefined, channel: 'whatsapp' | 'email' = 'whatsapp') {
  const tail = phoneTail(masked);
  const noun = channel === 'email' ? 'Destinatario' : 'Teléfono';
  if (tail) return `${noun} acabado en ${tail}`;
  return /oculto/i.test(masked ?? '') ? `${noun} oculto` : `${noun} no disponible`;
}

const TEMPLATE_EVENTS: Array<[RegExp, string]> = [
  [/^task_assigned/, 'task_assigned'],
  [/^task_modified/, 'task_modified'],
  [/^task_cancelled/, 'task_cancelled'],
  [/^task_approval_reminder/, 'task_approval_reminder'],
  [/^(task_)?late_start/, 'task_late_start_reminder'],
  [/^task_late_start_reminder/, 'task_late_start_reminder'],
  [/^task_rejected/, 'task_rejected_alert'],
  [/^task_approved/, 'task_approved_confirmation'],
];

/** Asunto legible a partir de la plantilla; null si no se reconoce o falta. */
export function templateSubject(templateName: string | null | undefined) {
  if (!templateName) return null;
  const match = TEMPLATE_EVENTS.find(([pattern]) => pattern.test(templateName));
  return match ? EVENT_LABELS[match[1]] : null;
}

export interface QueueAttempt {
  /** Intento al que se refiere el texto del servidor, si lo indica. */
  attempt: '1/2' | '2/2' | null;
  /** El servidor todavía puede hacer el único reintento automático. */
  retryPending: boolean;
  /** No habrá más intentos automáticos. */
  exhausted: boolean;
}

// Textos que escriben send-whatsapp-notification y la migración del reintento
// acotado. Si cambian, el intento queda «sin indicar» en lugar de suponerlo.
export function queueAttempt(row: Pick<SendReconciliationRow, 'channel' | 'detail'>): QueueAttempt {
  const detail = row.detail ?? '';
  if (row.channel !== 'whatsapp') return { attempt: null, retryPending: false, exhausted: false };
  if (/agotad/i.test(detail)) return { attempt: '2/2', retryPending: false, exhausted: true };
  if (/se permitir[aá] un [uú]nico reintento|tras 15 minutos/i.test(detail)) return { attempt: '1/2', retryPending: true, exhausted: false };
  if (/reintento whatsapp 2\/2|ejecutando reintento/i.test(detail)) return { attempt: '2/2', retryPending: false, exhausted: false };
  if (/intento 1\/2/i.test(detail)) return { attempt: '1/2', retryPending: false, exhausted: false };
  return { attempt: null, retryPending: false, exhausted: false };
}

export type QueueStateKey = 'unconfirmed' | 'contacting' | 'registering' | 'unknown';

/** Estado sencillo para la lista y explicación para el detalle. */
export function queueState(row: SendReconciliationRow) {
  const attempt = queueAttempt(row);
  const email = row.channel === 'email';
  if (row.open_action_status) {
    return { key: 'registering' as QueueStateKey, label: 'Registro en curso', explanation: 'Ya se ha registrado una resolución; el servidor la aplicará en su próximo ciclo.' };
  }
  if (row.uncertainty_state === 'meta_contacting') {
    return { key: 'contacting' as QueueStateKey, label: 'Contactando con Meta', explanation: 'El servidor está contactando con Meta ahora mismo. Espera a que termine antes de registrar nada.' };
  }
  if (row.uncertainty_state === 'meta_uncertain' || row.uncertainty_state === 'resend_uncertain') {
    const explanation = email
      ? 'Resend no confirmó si el email alternativo salió. Búscalo en Resend antes de decidir.'
      : attempt.exhausted
        ? 'Se intentó enviar dos veces y Meta no confirmó ninguno de los dos intentos. No habrá más intentos automáticos.'
        : attempt.retryPending
          ? 'El primer intento no tuvo respuesta clara de Meta. El servidor puede hacer un único reintento automático pasados 15 minutos.'
          : 'Meta no confirmó ni rechazó el envío.';
    return { key: 'unconfirmed' as QueueStateKey, label: email ? 'Email sin confirmar' : 'Entrega sin confirmar', explanation };
  }
  return { key: 'unknown' as QueueStateKey, label: 'Estado no reconocido', explanation: `El servidor devolvió un estado que esta pantalla no reconoce (${row.uncertainty_state}); no se permite registrar nada desde aquí.` };
}

export const RECENT_QUEUE_DAYS = 7;

/**
 * Separa la cola en recientes y anteriores sin quitar ninguna fila: la suma de
 * los dos grupos es siempre el total recibido.
 */
export function splitQueueByAge<T extends { created_at: string }>(rows: T[], now = Date.now()) {
  const limit = now - RECENT_QUEUE_DAYS * 24 * 3600 * 1000;
  const recent: T[] = [];
  const older: T[] = [];
  for (const row of rows) (new Date(row.created_at).getTime() >= limit ? recent : older).push(row);
  const byDate = (a: T, b: T) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return { recent: recent.sort(byDate), older: older.sort(byDate) };
}

/** «del vie 4 sept al jue 8 oct» con fechas de Madrid. */
export function dateRangeLabel(rows: Array<{ created_at: string }>) {
  if (rows.length === 0) return '';
  const times = rows.map((row) => new Date(row.created_at).getTime()).filter(Number.isFinite);
  const day = (time: number) => clean(dayFormatter.format(new Date(time)));
  const first = day(Math.min(...times));
  const last = day(Math.max(...times));
  return first === last ? `el ${first}` : `del ${first} al ${last}`;
}

/** Fecha corta con antigüedad: «vie 4 sept 20:12 · hace 45 días». */
export const momentWithAge = (value: string, now = Date.now()) => `${formatMoment(value, now)} · ${ageLabel(value, now)}`;

/** Límite de filas que pide la página a la RPC de la cola (ordenada de más antigua a más reciente). */
export const MANUAL_QUEUE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Nombre de la destinataria de un envío por comprobar
// ---------------------------------------------------------------------------

/** Campos mínimos de notification_events: sin teléfonos ni snapshot JSON. */
export interface RecipientEventRow {
  id: string;
  cleaner_id: string | null;
  recipient_worker_id: string | null;
  recipient_name_snapshot: string | null;
}

export interface CleanerNameRow {
  id: string;
  name: string | null;
}

export type RecipientName =
  /** snapshot = nombre guardado al crear el aviso; record = nombre actual de la ficha enlazada por ID. */
  | { state: 'known'; name: string; source: 'snapshot' | 'record' }
  /** Ficha borrada, fuera del alcance o evento no legible. */
  | { state: 'missing'; name: null }
  /** El evento apunta a dos fichas distintas y no guardó nombre: no se elige ninguna. */
  | { state: 'ambiguous'; name: null };

export type RecipientLookup =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; byEvent: Map<string, RecipientName> };

const trimmed = (value: string | null | undefined) => (value ?? '').trim() || null;

/** IDs de ficha enlazados al evento, sin repetir (recipient_worker_id primero). */
function linkedWorkerIds(event: RecipientEventRow) {
  return [...new Set([event.recipient_worker_id, event.cleaner_id].filter((id): id is string => Boolean(id)))];
}

/** Fichas que hay que consultar: solo eventos sin nombre guardado y con un único ID. */
export function workerIdsToLookup(events: RecipientEventRow[]) {
  const ids = new Set<string>();
  for (const event of events) {
    if (trimmed(event.recipient_name_snapshot)) continue;
    const linked = linkedWorkerIds(event);
    if (linked.length === 1) ids.add(linked[0]);
  }
  return [...ids];
}

/**
 * Nombre por evento usando solo vínculos exactos: primero el nombre guardado en
 * el aviso; si no existe, el de la ficha enlazada por su ID. Nunca por teléfono
 * ni por la asignación actual de la tarea.
 */
export function resolveRecipientNames(events: RecipientEventRow[], cleaners: CleanerNameRow[]) {
  const names = new Map(cleaners.map((cleaner) => [cleaner.id, trimmed(cleaner.name)]));
  const result = new Map<string, RecipientName>();
  for (const event of events) {
    const snapshot = trimmed(event.recipient_name_snapshot);
    if (snapshot) { result.set(event.id, { state: 'known', name: snapshot, source: 'snapshot' }); continue; }
    const linked = linkedWorkerIds(event);
    if (linked.length > 1) { result.set(event.id, { state: 'ambiguous', name: null }); continue; }
    const name = linked.length === 1 ? names.get(linked[0]) ?? null : null;
    result.set(event.id, name ? { state: 'known', name, source: 'record' } : { state: 'missing', name: null });
  }
  return result;
}

/** Identificación operativa de una fila de la cola, sin inventar datos ausentes. */
export function queueIdentity(row: SendReconciliationRow, history: DeliveryRow | undefined, lookup: RecipientLookup) {
  const subject = history ? eventLabel(history) : templateSubject(row.template_name);
  const task = history ? [history.property, formatTaskDate(history.task_date)].filter(Boolean).join(' · ') : '';
  const resolved: RecipientName = lookup.status === 'ready'
    ? lookup.byEvent.get(row.notification_event_id) ?? { state: 'missing', name: null }
    : { state: 'missing', name: null };
  const tail = phoneTail(row.recipient_masked);
  const phone = tail ? maskedPhone(row.recipient_masked) : null;
  if (resolved.state === 'known') {
    return { title: resolved.name, nameKnown: true, nameSource: resolved.source, nameNote: null, phone, subject, task };
  }
  const nameNote = lookup.status === 'loading'
    ? null
    : lookup.status === 'error'
      ? 'No se pudo consultar el nombre.'
      : resolved.state === 'ambiguous'
        ? 'El aviso enlaza a dos fichas distintas y no guardó el nombre; no se atribuye a ninguna.'
        : 'El aviso no guardó el nombre y su ficha ya no existe o no es visible.';
  return {
    title: lookup.status === 'loading' ? 'Buscando nombre…' : 'Nombre no disponible',
    nameKnown: false,
    nameSource: null,
    nameNote,
    phone,
    subject,
    task,
  };
}
