-- A newly created profile establishes its first known value, just like rollout baselines.
CREATE OR REPLACE FUNCTION workers_internal.capture_contract_hours() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.contract_hours_per_week IS DISTINCT FROM OLD.contract_hours_per_week THEN
  INSERT INTO public.worker_contract_hours_history(cleaner_id,hours_per_week,changed_by,is_baseline)
   VALUES(NEW.id,COALESCE(NEW.contract_hours_per_week,0),auth.uid(),TG_OP='INSERT');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION workers_internal.capture_contract_hours() FROM PUBLIC,anon,authenticated;
UPDATE public.worker_contract_hours_history h SET is_baseline=true
 WHERE h.id=(SELECT min(v.id) FROM public.worker_contract_hours_history v WHERE v.cleaner_id=h.cleaner_id)
 AND NOT EXISTS(SELECT 1 FROM public.worker_contract_hours_history v WHERE v.cleaner_id=h.cleaner_id AND v.is_baseline);
