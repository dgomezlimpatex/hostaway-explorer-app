-- Insert availability records for SARA LOUREIRO VIEITEZ who is missing them
INSERT INTO cleaner_availability (cleaner_id, day_of_week, is_available, start_time, end_time)
SELECT '4594ede0-581b-4bcc-8e0e-341d54f8c766', d, true, '06:00', '23:00'
FROM generate_series(0, 6) AS d
ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;

-- Also fix any other cleaners that might be missing availability records
INSERT INTO cleaner_availability (cleaner_id, day_of_week, is_available, start_time, end_time)
SELECT c.id, d, true, '06:00', '23:00'
FROM cleaners c
CROSS JOIN generate_series(0, 6) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM cleaner_availability ca 
  WHERE ca.cleaner_id = c.id AND ca.day_of_week = d
)
ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;