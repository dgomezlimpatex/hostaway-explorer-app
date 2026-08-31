-- Update existing tasks with old type to new type
UPDATE public.tasks 
SET type = 'limpieza-turistica' 
WHERE type IN ('mantenimiento-airbnb', 'limpieza-airbnb');