-- Permite que el orquestador frontend registre eventos lógicos de notificación
-- después de una confirmación humana. La RLS existente sigue limitando el INSERT
-- a admin/manager mediante WITH CHECK en notification_events_admin_manager_all.

GRANT INSERT ON public.notification_events TO authenticated;
