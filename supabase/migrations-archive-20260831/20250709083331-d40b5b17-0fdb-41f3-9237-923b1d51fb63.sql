-- Eliminar todas las tareas desde hoy en adelante para probar la recreación automática
DELETE FROM tasks 
WHERE date >= CURRENT_DATE;