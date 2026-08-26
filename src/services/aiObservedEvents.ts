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

export async function recordAiObservedEvent(_input: RecordAiObservedEventInput): Promise<void> {
  // The AI assistant was retired. Keep this compatibility shim until callers are cleaned up.
}
