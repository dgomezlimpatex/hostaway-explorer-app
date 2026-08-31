-- Evidencias fotográficas de supervisión: retención indefinida y alcance por sede.
CREATE TABLE IF NOT EXISTS public.supervision_review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.supervision_reviews(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  original_bytes INTEGER,
  compressed_bytes INTEGER,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supervision_media_review ON public.supervision_review_media(review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supervision_media_sede ON public.supervision_review_media(sede_id, created_at DESC);

ALTER TABLE public.supervision_review_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS supervision_review_media_scope ON public.supervision_review_media;
CREATE POLICY supervision_review_media_scope ON public.supervision_review_media FOR ALL TO authenticated
USING (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id))
WITH CHECK (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), sede_id));

GRANT SELECT, INSERT, UPDATE ON public.supervision_review_media TO authenticated;

DROP POLICY IF EXISTS supervision_evidence_read ON storage.objects;
CREATE POLICY supervision_evidence_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'supervision-evidence' AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS supervision_evidence_write ON storage.objects;
CREATE POLICY supervision_evidence_write ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'supervision-evidence' AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
DROP POLICY IF EXISTS supervision_evidence_update ON storage.objects;
CREATE POLICY supervision_evidence_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'supervision-evidence' AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), ((storage.foldername(name))[1])::uuid)))
WITH CHECK (bucket_id = 'supervision-evidence' AND (public.user_has_role('admin'::public.app_role) OR public.user_has_sede_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
