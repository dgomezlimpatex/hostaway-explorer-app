-- Tasks can be assigned or moved even when they overlap an active maintenance
-- block. The rest of the planning guards (active worker, availability,
-- absences, fixed days off and external task overlaps) remain unchanged.
CREATE OR REPLACE FUNCTION public.planning_assert_worker_task_valid(
 _cleaner_id uuid,_task_id uuid,_date date,_start time,_end time,_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF COALESCE(_status,'pending') IN ('completed','cancelled') THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id=_cleaner_id AND is_active) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_INACTIVE' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.cleaner_availability ca WHERE ca.cleaner_id=_cleaner_id
   AND ca.day_of_week=extract(dow from _date)::int
   AND (NOT ca.is_available OR _start<ca.start_time OR _end>ca.end_time)) THEN
  RAISE EXCEPTION 'PLANNING_OUTSIDE_AVAILABILITY' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.worker_absences wa WHERE wa.cleaner_id=_cleaner_id
   AND _date BETWEEN wa.start_date AND wa.end_date
   AND (wa.start_time IS NULL OR (_start<wa.end_time AND wa.start_time<_end))) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_ABSENT' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.worker_fixed_days_off wd WHERE wd.cleaner_id=_cleaner_id
   AND wd.is_active AND wd.day_of_week=extract(dow from _date)::int) THEN
  RAISE EXCEPTION 'PLANNING_WORKER_FIXED_DAY_OFF' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.planning_effective_task_assignments() ea JOIN public.tasks t ON t.id=ea.task_id
   WHERE ea.cleaner_id=_cleaner_id AND t.id<>_task_id AND t.date=_date
   AND t.status NOT IN ('completed','cancelled') AND t.start_time<_end AND _start<t.end_time) THEN
  RAISE EXCEPTION 'PLANNING_EXTERNAL_OVERLAP' USING ERRCODE='23514';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.planning_assert_worker_task_valid(uuid,uuid,date,time,time,text) FROM PUBLIC,anon,authenticated;
