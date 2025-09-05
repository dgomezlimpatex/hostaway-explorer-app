-- Activar el contrato existente de LILIA MERCEDES
UPDATE worker_contracts 
SET status = 'active'
WHERE cleaner_id = 'cd723fef-ad35-454d-9200-980d0ba0ab29' 
AND status = 'draft';