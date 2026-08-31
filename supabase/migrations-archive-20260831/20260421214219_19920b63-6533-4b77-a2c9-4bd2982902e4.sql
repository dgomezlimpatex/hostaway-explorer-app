ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS allow_reservation_creation boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clients.allow_reservation_creation IS
'Si es true, el cliente puede crear nuevas reservas desde el portal. Si es false, solo puede consultar las existentes.';