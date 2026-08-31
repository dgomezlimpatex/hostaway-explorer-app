-- Private AI copilot MVP. Access is intentionally limited to one owner email.

CREATE OR REPLACE FUNCTION public.ai_is_allowed_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'dgomezlimpatex@gmail.com';
$$;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nueva conversacion',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'operativa',
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'chat',
  source_message_id UUID REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'discarded', 'failed')),
  title TEXT NOT NULL DEFAULT 'Propuesta IA',
  summary TEXT NOT NULL,
  date_from DATE,
  date_to DATE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_action_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES public.ai_action_proposals(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'skipped')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_observed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'app',
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_learning_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'discarded')),
  category TEXT NOT NULL DEFAULT 'operativa',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.5,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_event_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  generated_by TEXT NOT NULL DEFAULT 'ai-learning-review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_created
  ON public.ai_conversations(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_memories_owner_active
  ON public.ai_memories(owner_user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_action_proposals_owner_status
  ON public.ai_action_proposals(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_observed_events_owner_created
  ON public.ai_observed_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_observed_events_processed
  ON public.ai_observed_events(owner_user_id, processed_at, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_learning_suggestions_owner_status
  ON public.ai_learning_suggestions(owner_user_id, status, created_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_observed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo owner IA gestiona conversaciones" ON public.ai_conversations;
CREATE POLICY "Solo owner IA gestiona conversaciones"
  ON public.ai_conversations FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA gestiona mensajes" ON public.ai_messages;
CREATE POLICY "Solo owner IA gestiona mensajes"
  ON public.ai_messages FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA gestiona memoria" ON public.ai_memories;
CREATE POLICY "Solo owner IA gestiona memoria"
  ON public.ai_memories FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA gestiona propuestas" ON public.ai_action_proposals;
CREATE POLICY "Solo owner IA gestiona propuestas"
  ON public.ai_action_proposals FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA lee auditoria" ON public.ai_action_audit_logs;
CREATE POLICY "Solo owner IA lee auditoria"
  ON public.ai_action_audit_logs FOR SELECT
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA gestiona eventos observados" ON public.ai_observed_events;
CREATE POLICY "Solo owner IA gestiona eventos observados"
  ON public.ai_observed_events FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Solo owner IA gestiona sugerencias" ON public.ai_learning_suggestions;
CREATE POLICY "Solo owner IA gestiona sugerencias"
  ON public.ai_learning_suggestions FOR ALL
  USING (public.ai_is_allowed_user() AND auth.uid() = owner_user_id)
  WITH CHECK (public.ai_is_allowed_user() AND auth.uid() = owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memories TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_action_proposals TO authenticated, service_role;
GRANT SELECT, INSERT ON public.ai_action_audit_logs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_observed_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_learning_suggestions TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_is_allowed_user() TO authenticated, service_role;
