ALTER TABLE public.avirato_room_mapping
  DROP CONSTRAINT IF EXISTS avirato_room_mapping_default_duration_min_check;

ALTER TABLE public.avirato_room_mapping
  ADD CONSTRAINT avirato_room_mapping_default_duration_min_check
  CHECK (default_duration_min >= 1);
