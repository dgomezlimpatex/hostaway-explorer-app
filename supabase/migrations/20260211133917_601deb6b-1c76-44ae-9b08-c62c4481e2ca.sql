
-- Fix: Insert full availability for Laura Yaneth (and any other cleaner missing availability)
INSERT INTO cleaner_availability (cleaner_id, day_of_week, is_available, start_time, end_time)
SELECT c.id, d.day_of_week, true, '06:00'::time, '23:00'::time
FROM cleaners c
CROSS JOIN generate_series(0, 6) AS d(day_of_week)
LEFT JOIN cleaner_availability ca ON ca.cleaner_id = c.id AND ca.day_of_week = d.day_of_week
WHERE ca.id IS NULL
ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;

-- Create a trigger function to auto-create availability for new cleaners
CREATE OR REPLACE FUNCTION public.create_default_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO cleaner_availability (cleaner_id, day_of_week, is_available, start_time, end_time)
  SELECT NEW.id, d, true, '06:00'::time, '23:00'::time
  FROM generate_series(0, 6) AS d
  ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to cleaners table
DROP TRIGGER IF EXISTS on_cleaner_created_set_availability ON cleaners;
CREATE TRIGGER on_cleaner_created_set_availability
  AFTER INSERT ON cleaners
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_availability();
