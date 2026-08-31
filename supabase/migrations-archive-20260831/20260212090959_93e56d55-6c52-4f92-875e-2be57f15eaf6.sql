-- Fix FK constraint to SET NULL on delete so tasks can be deleted freely
ALTER TABLE avantio_reservations 
  DROP CONSTRAINT avantio_reservations_task_id_fkey,
  ADD CONSTRAINT avantio_reservations_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Also fix hostaway_reservations FK
ALTER TABLE hostaway_reservations 
  DROP CONSTRAINT hostaway_reservations_task_id_fkey,
  ADD CONSTRAINT hostaway_reservations_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Also fix client_reservations FK
ALTER TABLE client_reservations
  DROP CONSTRAINT client_reservations_task_id_fkey,
  ADD CONSTRAINT client_reservations_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Clear the specific stuck reference
UPDATE avantio_reservations SET task_id = NULL WHERE task_id = 'b9dd7cd3-f1c8-421c-8426-76bdc6d70fc4';