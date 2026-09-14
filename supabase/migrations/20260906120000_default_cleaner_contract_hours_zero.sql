-- Las horas semanales del trabajador son opcionales y parten de cero.
ALTER TABLE public.cleaners
  ALTER COLUMN contract_hours_per_week SET DEFAULT 0;
