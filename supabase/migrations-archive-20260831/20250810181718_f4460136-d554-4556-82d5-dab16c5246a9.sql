-- Step 1: add 'logistics' to app_role in its own transaction
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'logistics'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'logistics';
  END IF;
END$$;