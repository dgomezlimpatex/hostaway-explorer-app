-- PDF comercial persistente del presupuestador.
-- Bucket privado y acceso restringido a administradores autenticados.

INSERT INTO storage.buckets (id, name, public)
VALUES ('tourist-budget-documents', 'tourist-budget-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS tourist_budget_documents_admin_insert ON storage.objects;
DROP POLICY IF EXISTS tourist_budget_documents_admin_select ON storage.objects;
DROP POLICY IF EXISTS tourist_budget_documents_admin_update ON storage.objects;
DROP POLICY IF EXISTS tourist_budget_documents_admin_delete ON storage.objects;

CREATE POLICY tourist_budget_documents_admin_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tourist-budget-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY tourist_budget_documents_admin_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'tourist-budget-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY tourist_budget_documents_admin_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'tourist-budget-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'tourist-budget-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY tourist_budget_documents_admin_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'tourist-budget-documents'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
