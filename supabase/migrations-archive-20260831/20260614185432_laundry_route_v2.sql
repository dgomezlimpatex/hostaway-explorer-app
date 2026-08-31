-- Route v2 for laundry delivery links:
-- - current route: collect dirty laundry and deliver clean bags
-- - next route: prepare bags one by one before the next delivery day
-- Bag preparation is global per task so a bag prepared in one route remains
-- prepared when the delivery route link is opened later.

ALTER TABLE public.laundry_share_links
  ADD COLUMN IF NOT EXISTS workflow_version TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE public.laundry_share_links
  DROP CONSTRAINT IF EXISTS laundry_share_links_workflow_version_check;

ALTER TABLE public.laundry_share_links
  ADD CONSTRAINT laundry_share_links_workflow_version_check
  CHECK (workflow_version IN ('legacy', 'route_v2'));

CREATE INDEX IF NOT EXISTS idx_laundry_share_links_workflow_version
  ON public.laundry_share_links(workflow_version);

CREATE TABLE IF NOT EXISTS public.laundry_bag_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  prepared_at TIMESTAMPTZ,
  prepared_by_name TEXT,
  issue_at TIMESTAMPTZ,
  issue_by_name TEXT,
  issue_reason TEXT,
  last_share_link_id UUID REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT laundry_bag_preparations_task_unique UNIQUE (task_id),
  CONSTRAINT laundry_bag_preparations_status_check CHECK (status IN ('pending', 'prepared', 'issue')),
  CONSTRAINT laundry_bag_preparations_issue_reason_check CHECK (
    status <> 'issue' OR length(trim(coalesce(issue_reason, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_laundry_bag_preparations_task
  ON public.laundry_bag_preparations(task_id);

CREATE INDEX IF NOT EXISTS idx_laundry_bag_preparations_status
  ON public.laundry_bag_preparations(status);

CREATE INDEX IF NOT EXISTS idx_laundry_bag_preparations_last_link
  ON public.laundry_bag_preparations(last_share_link_id);

DROP TRIGGER IF EXISTS update_laundry_bag_preparations_updated_at
  ON public.laundry_bag_preparations;

CREATE TRIGGER update_laundry_bag_preparations_updated_at
  BEFORE UPDATE ON public.laundry_bag_preparations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.laundry_bag_preparations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can manage laundry bag preparations"
  ON public.laundry_bag_preparations;

CREATE POLICY "Admins and managers can manage laundry bag preparations"
  ON public.laundry_bag_preparations
  FOR ALL
  TO authenticated
  USING (public.user_is_admin_or_manager())
  WITH CHECK (public.user_is_admin_or_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_bag_preparations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_bag_preparations TO service_role;
GRANT SELECT ON public.laundry_bag_preparations TO anon;

COMMENT ON COLUMN public.laundry_share_links.workflow_version IS
  'Workflow renderer for public laundry links. route_v2 uses global bag preparation and sequential next-route preparation.';

COMMENT ON TABLE public.laundry_bag_preparations IS
  'Global per-task laundry bag preparation status used across route links.';
