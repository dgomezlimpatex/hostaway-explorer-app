-- Retire the client-facing extraordinary service workflow without deleting
-- historical requests or tasks that were already created.
UPDATE public.clients
SET allow_extraordinary_requests = false
WHERE allow_extraordinary_requests IS TRUE;

DROP FUNCTION IF EXISTS public.create_extraordinary_request_with_task(
  uuid,
  uuid,
  uuid,
  date,
  time without time zone,
  text,
  text,
  uuid
);

DROP FUNCTION IF EXISTS public.cancel_extraordinary_request(uuid);

DROP FUNCTION IF EXISTS public.update_extraordinary_request(
  uuid,
  date,
  time without time zone,
  text,
  text
);
