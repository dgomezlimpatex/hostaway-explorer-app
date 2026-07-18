-- Materializa ocurrencias recurrentes de forma atómica e idempotente.
-- Las filas históricas se consultan usando su fecha civil Madrid, pero no se
-- reescriben ni se deduplican silenciosamente durante el despliegue.

ALTER TABLE public.recurring_task_executions
  ADD COLUMN IF NOT EXISTS execution_day date;

ALTER TABLE public.recurring_tasks
  ADD COLUMN IF NOT EXISTS state_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_recurring_task_state_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.state_revision := OLD.state_revision + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_recurring_task_state_revision
  ON public.recurring_tasks;

CREATE TRIGGER bump_recurring_task_state_revision
BEFORE UPDATE ON public.recurring_tasks
FOR EACH ROW
EXECUTE FUNCTION public.bump_recurring_task_state_revision();

CREATE UNIQUE INDEX IF NOT EXISTS recurring_task_executions_success_once
  ON public.recurring_task_executions (recurring_task_id, execution_day)
  WHERE success = true AND execution_day IS NOT NULL;

CREATE OR REPLACE FUNCTION public.materialize_recurring_task(
  p_recurring_task_id uuid,
  p_execution_date date,
  p_next_execution date,
  p_schedule_snapshot jsonb
)
RETURNS TABLE(generated_task_id uuid, was_created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_recurring public.recurring_tasks%ROWTYPE;
  v_current_schedule jsonb;
  v_existing_task_id uuid;
  v_generated_task_id uuid;
  v_property_name text;
  v_property_address text;
BEGIN
  SELECT *
  INTO v_recurring
  FROM public.recurring_tasks
  WHERE id = p_recurring_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring task % does not exist', p_recurring_task_id;
  END IF;

  IF NOT v_recurring.is_active THEN
    RAISE EXCEPTION 'Recurring task % is inactive', p_recurring_task_id;
  END IF;

  IF v_recurring.next_execution::date <> p_execution_date THEN
    RAISE EXCEPTION
      'Stale recurring execution for %, expected %, received %',
      p_recurring_task_id,
      v_recurring.next_execution::date,
      p_execution_date;
  END IF;

  v_current_schedule := jsonb_build_object(
    'frequency', v_recurring.frequency,
    'interval_days', v_recurring.interval_days,
    'days_of_week', v_recurring.days_of_week,
    'day_of_month', v_recurring.day_of_month,
    'start_date', v_recurring.start_date,
    'end_date', v_recurring.end_date
  );

  IF v_current_schedule IS DISTINCT FROM p_schedule_snapshot THEN
    RAISE EXCEPTION
      'Recurring schedule changed while materializing %',
      p_recurring_task_id;
  END IF;

  SELECT execution.generated_task_id
  INTO v_existing_task_id
  FROM public.recurring_task_executions AS execution
  WHERE execution.recurring_task_id = p_recurring_task_id
    AND (
      execution.execution_day = p_execution_date
      OR (
        execution.execution_day IS NULL
        AND (execution.execution_date AT TIME ZONE 'Europe/Madrid')::date = p_execution_date
      )
    )
    AND execution.success = true
  ORDER BY execution.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.recurring_tasks
    SET
      last_execution = p_execution_date,
      next_execution = COALESCE(p_next_execution, DATE '2099-12-31'),
      is_active = p_next_execution IS NOT NULL
    WHERE id = p_recurring_task_id;

    RETURN QUERY SELECT v_existing_task_id, false;
    RETURN;
  END IF;

  SELECT
    COALESCE(property.nombre, v_recurring.name),
    COALESCE(property.direccion, '')
  INTO v_property_name, v_property_address
  FROM public.properties AS property
  WHERE property.id = v_recurring.propiedad_id;

  v_property_name := COALESCE(v_property_name, v_recurring.name);
  v_property_address := COALESCE(v_property_address, '');

  INSERT INTO public.tasks (
    property,
    address,
    date,
    start_time,
    end_time,
    type,
    status,
    check_out,
    check_in,
    cleaner,
    cleaner_id,
    cliente_id,
    propiedad_id,
    duracion,
    coste,
    metodo_pago,
    supervisor,
    sede_id,
    background_color,
    notes
  ) VALUES (
    v_property_name,
    v_property_address,
    p_execution_date,
    v_recurring.start_time,
    v_recurring.end_time,
    v_recurring.type,
    'pending',
    v_recurring.check_out,
    v_recurring.check_in,
    v_recurring.cleaner,
    v_recurring.cleaner_id,
    v_recurring.cliente_id,
    v_recurring.propiedad_id,
    v_recurring.duracion,
    v_recurring.coste,
    v_recurring.metodo_pago,
    v_recurring.supervisor,
    v_recurring.sede_id,
    '#3B82F6',
    'Generada automáticamente desde tarea recurrente: ' || v_recurring.name
  )
  RETURNING id INTO v_generated_task_id;

  INSERT INTO public.recurring_task_executions (
    recurring_task_id,
    generated_task_id,
    execution_date,
    execution_day,
    success
  ) VALUES (
    p_recurring_task_id,
    v_generated_task_id,
    p_execution_date::timestamp AT TIME ZONE 'Europe/Madrid',
    p_execution_date,
    true
  );

  UPDATE public.recurring_tasks
  SET
    last_execution = p_execution_date,
    next_execution = COALESCE(p_next_execution, DATE '2099-12-31'),
    is_active = p_next_execution IS NOT NULL
  WHERE id = p_recurring_task_id;

  RETURN QUERY SELECT v_generated_task_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_recurring_task(uuid, date, date, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materialize_recurring_task(uuid, date, date, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.materialize_recurring_task(uuid, date, date, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_task(uuid, date, date, jsonb) TO service_role;
