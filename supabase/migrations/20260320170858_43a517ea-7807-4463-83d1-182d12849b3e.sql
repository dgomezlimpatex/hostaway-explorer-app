-- Fix orphaned tasks: clear cleaner name where cleaner_id is null but cleaner name still set
-- This is a one-time data fix for tasks assigned to deleted worker ALICIA PEREIRO ALVAREZ
UPDATE tasks SET cleaner = NULL, updated_at = now() WHERE cleaner = 'ALICIA PEREIRO ALVAREZ' AND cleaner_id IS NULL;