-- Proposed schema extension. Apply only after Dani authorizes this specific SQL.
-- Existing quantities, stock, schedules, permissions and policies are preserved.
BEGIN;
ALTER TABLE public.clients ADD COLUMN amenities_control_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.properties ADD COLUMN amenities_control_enabled boolean DEFAULT NULL;
COMMENT ON COLUMN public.clients.amenities_control_enabled IS 'Default amenities display/editing setting for properties; true preserves existing configuration.';
COMMENT ON COLUMN public.properties.amenities_control_enabled IS 'NULL inherits client amenities setting; explicit true/false overrides it. Does not erase configured quantities.';
COMMIT;
