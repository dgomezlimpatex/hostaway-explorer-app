import { supabase } from '@/integrations/supabase/client';
import { isAiAllowedEmail } from '@/utils/aiAccess';

type ObservedData = Record<string, unknown> | null | undefined;

interface RecordAiObservedEventInput {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  sedeId?: string | null;
  summary: string;
  beforeData?: ObservedData;
  afterData?: ObservedData;
  metadata?: Record<string, unknown>;
  source?: string;
}

const SENSITIVE_KEY_PARTS = [
  'email',
  'phone',
  'telefono',
  'dni',
  'pin',
  'password',
  'token',
  'secret',
  'key',
];

function getActiveSedeIdFromStorage(): string | null {
  try {
    const activeSede = localStorage.getItem('activeSede');
    if (!activeSede) return null;
    return JSON.parse(activeSede)?.id || null;
  } catch {
    return null;
  }
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).slice(0, 80).forEach(([key, nested]) => {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
      output[key] = '[redacted]';
      return;
    }
    output[key] = redactValue(nested, depth + 1);
  });
  return output;
}

export async function recordAiObservedEvent(input: RecordAiObservedEventInput): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    const email = user?.email?.toLowerCase() || '';
    if (!user || !isAiAllowedEmail(email)) return;

    await supabase.from('ai_observed_events' as never).insert({
      owner_user_id: user.id,
      owner_email: email,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      sede_id: input.sedeId || getActiveSedeIdFromStorage(),
      source: input.source || 'app',
      summary: input.summary.slice(0, 500),
      before_data: input.beforeData ? redactValue(input.beforeData) : null,
      after_data: input.afterData ? redactValue(input.afterData) : null,
      metadata: redactValue(input.metadata || {}) as Record<string, unknown>,
    } as never);
  } catch (error) {
    console.warn('AI observed event skipped:', error);
  }
}
