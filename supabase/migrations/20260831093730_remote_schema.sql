

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'manager',
    'supervisor',
    'cleaner',
    'client',
    'logistics'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."incident_status" AS ENUM (
    'pending_limpatex',
    'discarded_limpatex',
    'open',
    'in_progress',
    'resolved',
    'discarded'
);


ALTER TYPE "public"."incident_status" OWNER TO "postgres";


CREATE TYPE "public"."incident_visibility" AS ENUM (
    'public',
    'internal'
);


ALTER TYPE "public"."incident_visibility" OWNER TO "postgres";


CREATE TYPE "public"."inventory_alert_type" AS ENUM (
    'stock_bajo',
    'stock_critico'
);


ALTER TYPE "public"."inventory_alert_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_movement_type" AS ENUM (
    'entrada',
    'salida',
    'ajuste',
    'consumo_automatico'
);


ALTER TYPE "public"."inventory_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."laundry_delivery_status" AS ENUM (
    'pending',
    'prepared',
    'delivered'
);


ALTER TYPE "public"."laundry_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."logistics_delivery_status" AS ENUM (
    'planned',
    'in_transit',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."logistics_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."logistics_picklist_status" AS ENUM (
    'draft',
    'preparing',
    'packed',
    'committed',
    'cancelled'
);


ALTER TYPE "public"."logistics_picklist_status" OWNER TO "postgres";


CREATE TYPE "public"."logistics_stop_status" AS ENUM (
    'pending',
    'delivered',
    'failed',
    'skipped'
);


ALTER TYPE "public"."logistics_stop_status" OWNER TO "postgres";


CREATE TYPE "public"."media_type" AS ENUM (
    'photo',
    'video'
);


ALTER TYPE "public"."media_type" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'needs_review'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."stock_alert_type" AS ENUM (
    'stock_bajo',
    'stock_critico'
);


ALTER TYPE "public"."stock_alert_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_item_kind" AS ENUM (
    'laundry',
    'amenity',
    'other'
);


ALTER TYPE "public"."stock_item_kind" OWNER TO "postgres";


CREATE TYPE "public"."stock_movement_type" AS ENUM (
    'entrada',
    'salida',
    'ajuste',
    'consumo_automatico',
    'transferencia'
);


ALTER TYPE "public"."stock_movement_type" OWNER TO "postgres";


CREATE TYPE "public"."supervision_incident_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."supervision_incident_priority" OWNER TO "postgres";


CREATE TYPE "public"."supervision_incident_status" AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'archived'
);


ALTER TYPE "public"."supervision_incident_status" OWNER TO "postgres";


CREATE TYPE "public"."supervision_review_result" AS ENUM (
    'correct',
    'incorrect'
);


ALTER TYPE "public"."supervision_review_result" OWNER TO "postgres";


CREATE TYPE "public"."supervision_review_state" AS ENUM (
    'reviewed',
    'with_incidents',
    'returned_for_rework',
    'historical'
);


ALTER TYPE "public"."supervision_review_state" OWNER TO "postgres";


CREATE TYPE "public"."supervision_review_type" AS ENUM (
    'quick',
    'full'
);


ALTER TYPE "public"."supervision_review_type" OWNER TO "postgres";


CREATE TYPE "public"."supervision_route_status" AS ENUM (
    'planned',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."supervision_route_status" OWNER TO "postgres";


CREATE TYPE "public"."supervision_stop_status" AS ENUM (
    'pending',
    'in_progress',
    'reviewed',
    'needs_rework',
    'skipped'
);


ALTER TYPE "public"."supervision_stop_status" OWNER TO "postgres";


CREATE TYPE "public"."supervision_stop_type" AS ENUM (
    'apartment',
    'storage'
);


ALTER TYPE "public"."supervision_stop_type" OWNER TO "postgres";


CREATE TYPE "public"."tourist_budget_activation_status" AS ENUM (
    'proposed',
    'applied',
    'failed'
);


ALTER TYPE "public"."tourist_budget_activation_status" OWNER TO "postgres";


CREATE TYPE "public"."tourist_budget_logistics_mode" AS ENUM (
    'provisional-hourly',
    'activity-based'
);


ALTER TYPE "public"."tourist_budget_logistics_mode" OWNER TO "postgres";


CREATE TYPE "public"."tourist_budget_status" AS ENUM (
    'draft',
    'review',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'archived'
);


ALTER TYPE "public"."tourist_budget_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("invitation_token" "text", "input_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    invitation_record RECORD;
    user_email TEXT;
    user_name TEXT;
    existing_cleaner_id UUID;
BEGIN
    IF invitation_token IS NULL OR trim(invitation_token) = '' THEN
        RAISE EXCEPTION 'Token de invitación es requerido';
    END IF;

    IF input_user_id IS NULL THEN
        RAISE EXCEPTION 'ID de usuario es requerido';
    END IF;

    IF NOT public.check_rate_limit(
        input_user_id::TEXT,
        'invitation_accept',
        5, 60, 60
    ) THEN
        RAISE EXCEPTION 'Demasiados intentos de aceptar invitaciones. Intenta de nuevo más tarde.';
    END IF;

    SELECT role, email, expires_at, status, invited_by, sede_id
    INTO invitation_record
    FROM public.user_invitations
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token)
    AND status = 'pending';

    IF invitation_record.role IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada o ya procesada';
    END IF;

    IF invitation_record.expires_at <= now() THEN
        UPDATE public.user_invitations
        SET status = 'expired'
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        RAISE EXCEPTION 'La invitación ha expirado';
    END IF;

    SELECT email, COALESCE(raw_user_meta_data ->> 'full_name', email)
    INTO user_email, user_name
    FROM auth.users
    WHERE id = accept_invitation.input_user_id;

    IF user_email IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado o no autenticado';
    END IF;

    IF LOWER(TRIM(user_email)) != LOWER(TRIM(invitation_record.email)) THEN
        RAISE EXCEPTION 'El email del usuario (%) no coincide con la invitación (%)', user_email, invitation_record.email;
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = accept_invitation.input_user_id) THEN
        UPDATE public.user_invitations
        SET status = 'accepted', accepted_at = now()
        WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);
        RAISE EXCEPTION 'El usuario ya tiene un rol asignado en el sistema';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = invitation_record.invited_by
        AND ur.role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'El usuario que envió la invitación ya no tiene permisos para asignar roles';
    END IF;

    UPDATE public.user_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE user_invitations.invitation_token::text = trim(accept_invitation.invitation_token);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (accept_invitation.input_user_id, invitation_record.role);

    IF invitation_record.role = 'cleaner' THEN
        IF invitation_record.sede_id IS NULL THEN
            RAISE EXCEPTION 'La invitación para cleaner debe incluir una sede válida';
        END IF;

        -- Try to link to an existing cleaner by email (no user_id yet) — created via REGISTRO sync or manual
        SELECT id INTO existing_cleaner_id
        FROM public.cleaners
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(user_email))
          AND user_id IS NULL
        ORDER BY created_at ASC
        LIMIT 1;

        IF existing_cleaner_id IS NOT NULL THEN
            UPDATE public.cleaners
            SET user_id = accept_invitation.input_user_id,
                is_active = true,
                sede_id = COALESCE(sede_id, invitation_record.sede_id),
                name = COALESCE(NULLIF(name, ''), user_name),
                updated_at = now()
            WHERE id = existing_cleaner_id;
        ELSE
            INSERT INTO public.cleaners (user_id, name, email, is_active, sede_id)
            VALUES (accept_invitation.input_user_id, user_name, user_email, true, invitation_record.sede_id)
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                is_active = true,
                sede_id = EXCLUDED.sede_id,
                updated_at = now();
        END IF;
    END IF;

    IF invitation_record.sede_id IS NOT NULL AND invitation_record.role != 'admin' THEN
        INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
        VALUES (accept_invitation.input_user_id, invitation_record.sede_id, true)
        ON CONFLICT (user_id, sede_id) DO UPDATE SET
            can_access = true,
            updated_at = now();
    END IF;

    PERFORM public.log_security_event('invitation_accepted', jsonb_build_object(
        'accepted_role', invitation_record.role,
        'invited_by', invitation_record.invited_by,
        'sede_id', invitation_record.sede_id,
        'linked_existing_cleaner', existing_cleaner_id IS NOT NULL
    ), accept_invitation.input_user_id);

    RETURN invitation_record.role;
EXCEPTION
    WHEN OTHERS THEN
        PERFORM public.log_security_event('invitation_accept_failed', jsonb_build_object(
            'error', SQLERRM,
            'token_hash', md5(invitation_token)
        ), input_user_id);
        RAISE;
END;
$$;


ALTER FUNCTION "public"."accept_invitation"("invitation_token" "text", "input_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activate_tourist_budget"("p_budget_id" "uuid", "p_version_id" "uuid", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  budget_row public.tourist_budgets%ROWTYPE;
  version_exists BOOLEAN;
  previous_run UUID;
  run_id UUID;
  item JSONB;
  item_index INTEGER := 0;
  requested_property_id UUID;
  final_property_id UUID;
  action_name TEXT;
  action_choice TEXT;
  before_snapshot JSONB;
  after_snapshot JSONB;
  property_name TEXT;
  property_address TEXT;
  property_code TEXT;
  duration_minutes INTEGER;
  sale_price NUMERIC(10,2);
  bedrooms INTEGER;
  bathrooms INTEGER;
  beds INTEGER;
  kitchens INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede activar presupuestos';
  END IF;

  SELECT * INTO budget_row FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;
  IF budget_row.status <> 'accepted' THEN
    RAISE EXCEPTION 'Solo se puede activar un presupuesto aceptado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tourist_budget_versions WHERE id = p_version_id AND budget_id = p_budget_id
  ) INTO version_exists;
  IF NOT version_exists THEN RAISE EXCEPTION 'La versión no pertenece al presupuesto'; END IF;

  SELECT id INTO previous_run
  FROM public.tourist_budget_activation_runs
  WHERE budget_id = p_budget_id AND version_id = p_version_id AND status = 'applied'
  ORDER BY created_at DESC LIMIT 1;
  IF previous_run IS NOT NULL THEN
    RETURN jsonb_build_object('activationRunId', previous_run, 'idempotent', true);
  END IF;

  INSERT INTO public.tourist_budget_activation_runs (
    budget_id, version_id, status, created_by, applied_by, applied_at
  ) VALUES (
    p_budget_id, p_version_id, 'applied', auth.uid(), auth.uid(), now()
  ) RETURNING id INTO run_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    requested_property_id := NULLIF(item->>'propertyId', '')::UUID;
    property_name := COALESCE(NULLIF(item->>'propertyName', ''), item #>> '{property,name}', format('Propiedad %s', item_index + 1));
    property_address := COALESCE(NULLIF(item->>'propertyAddress', ''), item #>> '{property,address}', 'Dirección pendiente');
    property_code := COALESCE(NULLIF(item->>'propertyCode', ''), item #>> '{property,code}', format('%s-%s', budget_row.quote_number, item_index + 1));
    duration_minutes := GREATEST(COALESCE(NULLIF(item->>'durationMinutes', '')::INTEGER, (item #>> '{resultSnapshot,durationMinutes}')::INTEGER, 60), 1);
    sale_price := GREATEST(COALESCE(NULLIF(item->>'salePrice', '')::NUMERIC, (item #>> '{resultSnapshot,salePrice}')::NUMERIC, 0), 0);
    bedrooms := GREATEST(COALESCE(NULLIF(item->>'bedrooms', '')::INTEGER, (item #>> '{featureCounts,bedrooms}')::INTEGER, 0), 0);
    bathrooms := GREATEST(COALESCE(NULLIF(item->>'bathrooms', '')::INTEGER, (item #>> '{featureCounts,bathrooms}')::INTEGER, 0), 0);
    beds := GREATEST(COALESCE(NULLIF(item->>'beds', '')::INTEGER, (item #>> '{featureCounts,beds}')::INTEGER, 0), 0);
    kitchens := GREATEST(COALESCE(NULLIF(item->>'kitchens', '')::INTEGER, (item #>> '{featureCounts,kitchens}')::INTEGER, 0), 0);
    action_choice := COALESCE(item->>'activationAction', CASE WHEN requested_property_id IS NULL THEN 'create' ELSE 'update' END);
    IF action_choice NOT IN ('create', 'update') THEN
      RAISE EXCEPTION 'La acción de activación no es válida';
    END IF;
    IF requested_property_id IS NULL AND action_choice <> 'create' THEN
      RAISE EXCEPTION 'Una propiedad nueva debe activarse con la acción crear';
    END IF;
    IF requested_property_id IS NOT NULL AND action_choice <> 'update' THEN
      RAISE EXCEPTION 'Una propiedad existente debe activarse con la acción actualizar';
    END IF;

    IF requested_property_id IS NULL THEN
      IF budget_row.client_id IS NULL THEN
        RAISE EXCEPTION 'No se puede crear una propiedad sin cliente vinculado';
      END IF;
      INSERT INTO public.properties (
        codigo, nombre, direccion, numero_camas, numero_banos, numero_cocinas,
        duracion_servicio, coste_servicio, cliente_id, sede_id,
        planning_estimated_checkout_minutes, planning_estimated_stay_minutes,
        planning_required_cleaners, planning_complexity,
        planning_requires_linen_load, planning_requires_amenities_load, notas
      ) VALUES (
        property_code, property_name, property_address, beds, bathrooms, kitchens,
        duration_minutes, sale_price, budget_row.client_id, budget_row.sede_id,
        duration_minutes, duration_minutes, GREATEST(1, LEAST(4, CEIL(duration_minutes / 180.0)::INTEGER)),
        GREATEST(1, LEAST(5, CEIL(duration_minutes / 60.0)::INTEGER)),
        COALESCE((item #>> '{logisticsInput,bags}')::NUMERIC, 0) > 0,
        COALESCE((item #>> '{serviceLines,amenities,salePrice}')::NUMERIC, 0) > 0,
        format('Creada desde el presupuesto %s. Revisar configuración operativa antes de programar.', budget_row.quote_number)
      ) RETURNING id INTO final_property_id;
      action_name := 'create';
      before_snapshot := NULL;
    ELSE
      SELECT to_jsonb(p) INTO before_snapshot
      FROM public.properties p
      WHERE p.id = requested_property_id AND p.sede_id = budget_row.sede_id
      FOR UPDATE;
      IF before_snapshot IS NULL THEN
        RAISE EXCEPTION 'La propiedad seleccionada no pertenece a la sede del presupuesto';
      END IF;
      UPDATE public.properties SET
        duracion_servicio = duration_minutes,
        coste_servicio = sale_price,
        numero_camas = CASE WHEN beds > 0 THEN beds ELSE numero_camas END,
        numero_banos = CASE WHEN bathrooms > 0 THEN bathrooms ELSE numero_banos END,
        numero_cocinas = CASE WHEN kitchens > 0 THEN kitchens ELSE numero_cocinas END,
        planning_estimated_checkout_minutes = duration_minutes,
        planning_estimated_stay_minutes = duration_minutes,
        planning_required_cleaners = GREATEST(1, LEAST(4, CEIL(duration_minutes / 180.0)::INTEGER)),
        planning_complexity = GREATEST(1, LEAST(5, CEIL(duration_minutes / 60.0)::INTEGER)),
        planning_requires_linen_load = COALESCE((item #>> '{logisticsInput,bags}')::NUMERIC, 0) > 0,
        planning_requires_amenities_load = COALESCE((item #>> '{serviceLines,amenities,salePrice}')::NUMERIC, 0) > 0,
        notas = concat_ws(E'\n', NULLIF(notas, ''), format('Actualizada desde el presupuesto %s.', budget_row.quote_number))
      WHERE id = requested_property_id;
      final_property_id := requested_property_id;
      action_name := 'update';
    END IF;

    SELECT to_jsonb(p) INTO after_snapshot FROM public.properties p WHERE p.id = final_property_id;
    INSERT INTO public.tourist_budget_activation_items (
      activation_run_id, property_id, action, before_snapshot, after_snapshot
    ) VALUES (run_id, final_property_id, action_name, before_snapshot, after_snapshot);
    item_index := item_index + 1;
  END LOOP;

  RETURN jsonb_build_object('activationRunId', run_id, 'idempotent', false, 'items', item_index);
EXCEPTION WHEN OTHERS THEN
  IF run_id IS NOT NULL THEN
    UPDATE public.tourist_budget_activation_runs SET status = 'failed', error_message = SQLERRM WHERE id = run_id;
  END IF;
  RAISE;
END;
$$;


ALTER FUNCTION "public"."activate_tourist_budget"("p_budget_id" "uuid", "p_version_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."laundry_dirty_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "current_quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "laundry_dirty_stock_non_negative" CHECK (("current_quantity" >= (0)::numeric))
);


ALTER TABLE "public"."laundry_dirty_stock" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_dirty_stock" IS 'Current dirty laundry waiting to be sent to the laundry service.';



CREATE OR REPLACE FUNCTION "public"."adjust_laundry_dirty_stock"("product_id_param" "uuid", "warehouse_id_param" "uuid", "movement_type_param" "text", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") RETURNS "public"."laundry_dirty_stock"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  product_record RECORD;
  warehouse_record RECORD;
  dirty_record public.laundry_dirty_stock;
  previous_quantity NUMERIC(12, 2);
  new_quantity NUMERIC(12, 2);
  movement_quantity NUMERIC(12, 2);
BEGIN
  IF product_id_param IS NULL
    OR warehouse_id_param IS NULL
    OR user_id_param IS NULL
    OR quantity_param IS NULL
  THEN
    RAISE EXCEPTION 'product, warehouse, quantity and user are required';
  END IF;

  IF auth.uid() IS NULL OR user_id_param <> auth.uid() THEN
    RAISE EXCEPTION 'The acting user must match the authenticated user';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'User not allowed to adjust dirty laundry stock';
  END IF;

  IF movement_type_param NOT IN ('entrada', 'salida', 'ajuste') THEN
    RAISE EXCEPTION 'Invalid dirty laundry movement type';
  END IF;

  IF quantity_param < 0 OR (movement_type_param <> 'ajuste' AND quantity_param = 0) THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF length(trim(COALESCE(reason_param, ''))) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT p.id, p.sede_id, sc.kind
  INTO product_record
  FROM public.stock_products p
  JOIN public.stock_categories sc ON sc.id = p.category_id
  WHERE p.id = product_id_param
    AND p.is_active = true;

  IF product_record.id IS NULL OR product_record.kind <> 'laundry'::public.stock_item_kind THEN
    RAISE EXCEPTION 'Active laundry product not found';
  END IF;

  SELECT *
  INTO warehouse_record
  FROM public.stock_warehouses
  WHERE id = warehouse_id_param
    AND is_active = true;

  IF warehouse_record.id IS NULL OR warehouse_record.sede_id <> product_record.sede_id THEN
    RAISE EXCEPTION 'Product and warehouse must belong to the same sede';
  END IF;

  INSERT INTO public.laundry_dirty_stock (product_id, warehouse_id, current_quantity, updated_by)
  VALUES (product_id_param, warehouse_id_param, 0, user_id_param)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  SELECT *
  INTO dirty_record
  FROM public.laundry_dirty_stock
  WHERE product_id = product_id_param
    AND warehouse_id = warehouse_id_param
  FOR UPDATE;

  IF movement_type_param = 'entrada' THEN
    previous_quantity := dirty_record.current_quantity;
    new_quantity := dirty_record.current_quantity + quantity_param;
  ELSIF movement_type_param = 'salida' THEN
    IF dirty_record.current_quantity < quantity_param THEN
      RAISE EXCEPTION 'No hay suficiente ropa sucia para enviar esa cantidad';
    END IF;
    previous_quantity := dirty_record.current_quantity;
    new_quantity := dirty_record.current_quantity - quantity_param;
  ELSE
    previous_quantity := dirty_record.current_quantity;
    new_quantity := quantity_param;
  END IF;

  movement_quantity := CASE
    WHEN movement_type_param = 'ajuste' THEN abs(new_quantity - dirty_record.current_quantity)
    ELSE quantity_param
  END;

  IF movement_quantity <= 0 THEN
    RAISE EXCEPTION 'The adjustment does not change dirty laundry stock';
  END IF;

  UPDATE public.laundry_dirty_stock
  SET current_quantity = new_quantity,
      updated_by = user_id_param
  WHERE id = dirty_record.id
  RETURNING * INTO dirty_record;

  INSERT INTO public.laundry_dirty_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    reason,
    created_by
  )
  VALUES (
    product_id_param,
    warehouse_id_param,
    movement_type_param,
    movement_quantity,
    previous_quantity,
    new_quantity,
    trim(reason_param),
    user_id_param
  );

  RETURN dirty_record;
END;
$$;


ALTER FUNCTION "public"."adjust_laundry_dirty_stock"("product_id_param" "uuid", "warehouse_id_param" "uuid", "movement_type_param" "text", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_is_allowed_user"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'dgomezlimpatex@gmail.com';
$$;


ALTER FUNCTION "public"."ai_is_allowed_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_ai_actions_transactional"("_proposal_id" "uuid", "_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_proposal public.ai_action_proposals%ROWTYPE;
  v_action jsonb;
  v_type text;
  v_task public.tasks%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_cleaner_ids uuid[];
  v_all_cleaner_ids uuid[];
  v_valid_count integer;
  v_results jsonb := '[]'::jsonb;
  v_start time;
  v_end time;
  v_minutes integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'Esta RPC solo puede ser invocada por el writer autenticado'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_proposal
  FROM public.ai_action_proposals p
  WHERE p.id = _proposal_id
  FOR UPDATE;
  IF NOT FOUND OR v_proposal.owner_user_id <> _actor_id THEN
    RAISE EXCEPTION 'Propuesta no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposal.status = 'applied' THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_applied', 'result', v_proposal.result);
  END IF;
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'La propuesta ya no está pendiente' USING ERRCODE = '40001';
  END IF;
  IF NOT public.ai_is_allowed_user() AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _actor_id AND lower(p.email) = 'dgomezlimpatex@gmail.com'
  ) THEN
    RAISE EXCEPTION 'AI copilot no habilitado para este usuario' USING ERRCODE = '42501';
  END IF;
  IF v_proposal.sede_id IS NOT NULL AND NOT public.writer_actor_can_access_sede(
    _actor_id, v_proposal.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para aplicar la propuesta en esta sede' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_proposal.actions) <> 'array' THEN
    RAISE EXCEPTION 'Acciones inválidas' USING ERRCODE = '22023';
  END IF;

  -- Bloqueo global previo: dos propuestas A→B/B→A adquieren siempre las tareas por UUID.
  PERFORM t.id
  FROM public.tasks t
  JOIN (
    SELECT DISTINCT nullif(action->>'taskId', '')::uuid AS task_id
    FROM jsonb_array_elements(v_proposal.actions) action
    WHERE action->>'type' = 'assign_task'
  ) ids ON ids.task_id = t.id
  ORDER BY ids.task_id
  FOR UPDATE OF t;

  -- Segundo nivel global: todos los cleaners de todas las acciones por UUID.
  SELECT coalesce(array_agg(DISTINCT raw::uuid ORDER BY raw::uuid), '{}'::uuid[])
  INTO v_all_cleaner_ids
  FROM jsonb_array_elements(v_proposal.actions) action
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(action->'cleanerIds') = 'array' THEN action->'cleanerIds'
    WHEN nullif(action->>'cleanerId', '') IS NOT NULL THEN jsonb_build_array(action->>'cleanerId')
    ELSE '[]'::jsonb END
  ) raw
  WHERE nullif(trim(raw), '') IS NOT NULL;
  PERFORM c.id FROM public.cleaners c
  WHERE c.id = ANY(v_all_cleaner_ids)
  ORDER BY c.id
  FOR KEY SHARE;

  -- Tercer nivel global: properties usadas por create_task, por UUID.
  PERFORM p.id FROM public.properties p
  JOIN (
    SELECT DISTINCT nullif(action->>'propertyId', '')::uuid AS property_id
    FROM jsonb_array_elements(v_proposal.actions) action
    WHERE action->>'type' = 'create_task'
  ) ids ON ids.property_id = p.id
  ORDER BY p.id
  FOR KEY SHARE OF p;

  FOR v_action IN SELECT value FROM jsonb_array_elements(v_proposal.actions)
  LOOP
    v_type := nullif(trim(v_action->>'type'), '');
    IF v_type NOT IN ('assign_task', 'create_task') THEN
      RAISE EXCEPTION 'Tipo de acción no permitido: %', coalesce(v_type, '<vacío>') USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[]) INTO v_cleaner_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(v_action->'cleanerIds') = 'array' THEN v_action->'cleanerIds'
        WHEN nullif(v_action->>'cleanerId', '') IS NOT NULL THEN jsonb_build_array(v_action->>'cleanerId')
        ELSE '[]'::jsonb END
      ) WITH ORDINALITY x(raw, ord)
      CROSS JOIN LATERAL (SELECT nullif(trim(raw), '')::uuid AS id) parsed
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) deduped;

    IF v_type = 'assign_task' THEN
      SELECT * INTO v_task FROM public.tasks t
      WHERE t.id = nullif(v_action->>'taskId', '')::uuid
      FOR UPDATE;
      IF NOT FOUND OR v_task.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Tarea no encontrada o cerrada' USING ERRCODE = '22023';
      END IF;
      IF NOT public.writer_actor_can_access_sede(
        _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
      ) THEN
        RAISE EXCEPTION 'No autorizado para la sede de la tarea' USING ERRCODE = '42501';
      END IF;

      SELECT count(*) INTO v_valid_count FROM public.cleaners c
      WHERE c.id = ANY(v_cleaner_ids) AND c.is_active = true AND c.sede_id = v_task.sede_id;
      IF cardinality(v_cleaner_ids) = 0 OR v_valid_count <> cardinality(v_cleaner_ids) THEN
        RAISE EXCEPTION 'Trabajadores inválidos para assign_task' USING ERRCODE = '22023';
      END IF;

      PERFORM public.set_task_assignments(v_task.id, v_cleaner_ids);
      UPDATE public.tasks SET
        start_time = coalesce(nullif(v_action->>'startTime', '')::time, start_time),
        end_time = coalesce(nullif(v_action->>'endTime', '')::time, end_time),
        updated_at = now()
      WHERE id = v_task.id
      RETURNING * INTO v_task;
      IF v_task.end_time <= v_task.start_time THEN
        RAISE EXCEPTION 'Horario inválido para assign_task' USING ERRCODE = '22023';
      END IF;

    ELSE
      SELECT * INTO v_property FROM public.properties p
      WHERE p.id = nullif(v_action->>'propertyId', '')::uuid;
      IF NOT FOUND OR v_property.is_active = false THEN
        RAISE EXCEPTION 'Propiedad no encontrada o inactiva' USING ERRCODE = '22023';
      END IF;
      IF NOT public.writer_actor_can_access_sede(
        _actor_id, v_property.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
      ) THEN
        RAISE EXCEPTION 'No autorizado para la sede de la propiedad' USING ERRCODE = '42501';
      END IF;
      SELECT count(*) INTO v_valid_count FROM public.cleaners c
      WHERE c.id = ANY(v_cleaner_ids) AND c.is_active = true AND c.sede_id = v_property.sede_id;
      IF v_valid_count <> cardinality(v_cleaner_ids) THEN
        RAISE EXCEPTION 'Trabajadores inválidos para create_task' USING ERRCODE = '22023';
      END IF;

      v_start := coalesce(nullif(v_action->>'startTime', '')::time, '10:00'::time);
      v_minutes := greatest(1, coalesce(nullif(v_action->>'duration', '')::integer, v_property.duracion_servicio, 60));
      v_end := v_start + make_interval(mins => v_minutes);
      INSERT INTO public.tasks(
        property, address, date, start_time, end_time, type, status,
        check_in, check_out, cliente_id, propiedad_id, sede_id, duracion, coste
      ) VALUES (
        v_property.nombre, v_property.direccion, (v_action->>'date')::date,
        v_start, v_end, coalesce(nullif(v_action->>'taskType', ''), 'limpieza-turistica'), 'pending',
        v_property.check_in_predeterminado, v_property.check_out_predeterminado,
        v_property.cliente_id, v_property.id, v_property.sede_id, v_minutes, v_property.coste_servicio
      ) RETURNING * INTO v_task;
      IF cardinality(v_cleaner_ids) > 0 THEN
        PERFORM public.set_task_assignments(v_task.id, v_cleaner_ids);
      END IF;
    END IF;

    INSERT INTO public.ai_action_audit_logs(
      proposal_id, owner_user_id, owner_email, action_type, status, payload, result
    ) VALUES (
      v_proposal.id, v_proposal.owner_user_id, v_proposal.owner_email,
      v_type, 'success', v_action, jsonb_build_object('taskId', v_task.id)
    );
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'type', v_type, 'status', 'success', 'taskId', v_task.id, 'cleanerIds', to_jsonb(v_cleaner_ids)
    ));
  END LOOP;

  UPDATE public.ai_action_proposals SET
    status = 'applied',
    result = jsonb_build_object('results', v_results, 'failures', 0),
    updated_at = now()
  WHERE id = v_proposal.id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conflicto al finalizar la propuesta' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'applied', 'results', v_results, 'failures', 0);
END;
$$;


ALTER FUNCTION "public"."apply_ai_actions_transactional"("_proposal_id" "uuid", "_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_ai_actions_transactional"("_proposal_id" "uuid", "_actor_id" "uuid") IS 'CAS por fila de propuesta y aplica todas las acciones/auditoría/estado en una transacción.';



CREATE OR REPLACE FUNCTION "public"."apply_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid") RETURNS TABLE("event_id" "uuid", "channel" "text", "resolution" "text", "force_email_fallback" boolean, "fallback_whatsapp_delivery_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  action public.notification_send_reconciliation_actions%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  fallback_trigger uuid;
  trigger_count integer;
BEGIN
  SELECT candidate.notification_event_id INTO action.notification_event_id
  FROM public.notification_send_reconciliation_actions candidate
  WHERE candidate.id = _action_id;
  IF action.notification_event_id IS NULL THEN
    RAISE EXCEPTION 'reconciliation_action_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(action.notification_event_id::text, 20260720)
  );

  SELECT * INTO action
  FROM public.notification_send_reconciliation_actions
  WHERE id = _action_id
    AND status = 'processing'
    AND claim_token = _claim_token
  FOR UPDATE;
  IF action.id IS NULL THEN
    RAISE EXCEPTION 'reconciliation_action_stale_claim' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO event_row FROM public.notification_events
  WHERE id = action.notification_event_id FOR UPDATE;
  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = action.delivery_id
    AND notification_event_id = action.notification_event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR delivery.id IS NULL
     OR delivery.channel IS DISTINCT FROM action.channel THEN
    RAISE EXCEPTION 'reconciliation_delivery_missing_or_mismatched' USING ERRCODE = '22023';
  END IF;

  -- Una acción recuperada nunca puede degradar un resultado que otro worker o
  -- callback ya hizo terminal. Si la misma decisión ya surtió efecto, es idempotente.
  IF action.resolution = 'confirmed_sent'
     AND delivery.status IN ('sent', 'delivered', 'read') THEN
    IF delivery.provider_message_id IS DISTINCT FROM action.provider_message_id THEN
      RAISE EXCEPTION 'provider_message_id_conflict' USING ERRCODE = '23514';
    END IF;
    RETURN QUERY SELECT action.notification_event_id, action.channel, action.resolution,
      false, NULL::uuid;
    RETURN;
  END IF;

  IF action.resolution = 'confirmed_not_sent'
     AND action.channel = 'whatsapp' THEN
    RAISE EXCEPTION 'whatsapp_uncertain_cannot_be_reopened' USING ERRCODE = '23514';
  END IF;
  IF action.resolution = 'confirmed_not_sent'
     AND action.channel = 'email'
     AND (
       delivery.provider_response->>'fallback_send_started_at' IS NULL
       OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
         <= now() - interval '23 hours'
     ) THEN
    RAISE EXCEPTION 'resend_idempotency_window_expired' USING ERRCODE = '23514';
  END IF;

  IF delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR NOT (
       (delivery.channel = 'whatsapp' AND (
          delivery.error_code = 'reconciliation_required'
          OR delivery.provider_payload->>'send_started_at' IS NOT NULL
       ))
       OR (delivery.channel = 'email'
           AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'delivery_no_longer_reconcilable' USING ERRCODE = '23514';
  END IF;

  IF action.resolution = 'confirmed_sent' THEN
    IF EXISTS (
      SELECT 1 FROM public.notification_deliveries sibling
      WHERE sibling.notification_event_id = action.notification_event_id
        AND sibling.id <> delivery.id
        AND sibling.channel <> delivery.channel
        AND sibling.status IN ('sent', 'delivered', 'read')
    ) THEN
      RAISE EXCEPTION 'other_channel_already_succeeded' USING ERRCODE = '23514';
    END IF;

    UPDATE public.notification_deliveries
    SET status = 'sent',
        provider_message_id = action.provider_message_id,
        sent_at = COALESCE(sent_at, now()),
        error_code = NULL,
        error_message = NULL,
        provider_response = COALESCE(provider_response, '{}'::jsonb)
          || jsonb_build_object('manual_reconciliation', 'confirmed_sent', 'resolved_at', now())
    WHERE id = delivery.id;

    UPDATE public.notification_events
    SET status = 'sent', processed_at = now(), processing_lease_token = NULL,
        error_message = NULL
    WHERE id = action.notification_event_id;

  ELSE
    -- La única resolución no enviada que llega aquí pertenece a Resend.
    IF delivery.channel <> 'email' THEN
      RAISE EXCEPTION 'confirmed_not_sent_channel_not_supported' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.notification_deliveries whatsapp
      WHERE whatsapp.notification_event_id = action.notification_event_id
        AND whatsapp.channel = 'whatsapp'
        AND whatsapp.status IN ('sent', 'delivered', 'read')
    ) THEN
      RAISE EXCEPTION 'whatsapp_already_succeeded' USING ERRCODE = '23514';
    END IF;

    SELECT count(*)
    INTO trigger_count
    FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = action.notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status = 'failed';
    IF trigger_count <> 1 THEN
      RAISE EXCEPTION 'fallback_whatsapp_delivery_ambiguous' USING ERRCODE = '23514';
    END IF;
    SELECT whatsapp.id INTO fallback_trigger
    FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = action.notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status = 'failed';

    UPDATE public.notification_deliveries
    SET status = 'failed',
        error_code = 'manual_confirmed_not_sent',
        error_message = 'Operador confirmó que Resend no recibió el intento',
        failed_at = now(),
        provider_response = COALESCE(provider_response, '{}'::jsonb)
          || jsonb_build_object(
            'fallback_attempt_state', 'manual_confirmed_not_sent',
            'manual_resolved_at', now()
          )
    WHERE id = delivery.id;

    UPDATE public.notification_events
    SET status = 'failed', processed_at = now(), processing_lease_token = NULL,
        error_message = 'Fallback confirmado como no enviado; reintento manual autorizado'
    WHERE id = action.notification_event_id;

    UPDATE public.notification_send_reconciliation_actions
    SET status = 'effect_pending',
        effect_started_at = COALESCE(effect_started_at, now()),
        fallback_whatsapp_delivery_id = fallback_trigger
    WHERE id = action.id
      AND status = 'processing'
      AND claim_token = _claim_token;
  END IF;

  RETURN QUERY SELECT action.notification_event_id, action.channel, action.resolution,
    (action.resolution = 'confirmed_not_sent' AND action.channel = 'email'), fallback_trigger;
END;
$$;


ALTER FUNCTION "public"."apply_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
DECLARE
 v_actor uuid:=auth.uid(); v_count integer; v_expected_assignments integer; v_hash text; v_existing public.planning_apply_batches%ROWTYPE;
 v_conflicts jsonb:='[]'::jsonb; v_work jsonb:=_items; v_item jsonb; v_task public.tasks%ROWTYPE; v_rec public.recurring_tasks%ROWTYPE;
 v_ord integer; v_key text; v_task_id uuid; v_generated uuid; v_created boolean; v_old_ids uuid[]; v_new_ids uuid[];
 v_before jsonb; v_after jsonb; v_summary jsonb; v_error text; v_error_context text; v_changed integer:=0;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role::text IN ('admin','manager')) THEN
  RAISE EXCEPTION 'PLANNING_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 IF NOT public.user_has_sede_access(v_actor,_sede_id) THEN RAISE EXCEPTION 'PLANNING_SEDE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF _batch_id IS NULL OR length(btrim(COALESCE(_idempotency_key,'')))<8 OR length(_idempotency_key)>200 THEN
  RETURN jsonb_build_object('status','validation_failed','code','INVALID_BATCH_IDEMPOTENCY','batch_id',COALESCE(_batch_id,'00000000-0000-0000-0000-000000000000'::uuid),'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','INVALID_BATCH_IDEMPOTENCY')));
 END IF;

 -- El payload jsonb recibido ya está canonicalizado por PostgreSQL. Su hash
 -- efectivo se calcula siempre antes de mirar un replay; _request_hash queda
 -- como dato de compatibilidad del cliente, nunca como autoridad.
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
  RETURN jsonb_build_object('status','validation_failed','code','ITEMS_MUST_BE_ARRAY','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','ITEMS_MUST_BE_ARRAY')));
 END IF;
 v_count:=jsonb_array_length(_items);
 IF v_count<1 OR v_count>500 THEN
  RETURN jsonb_build_object('status','validation_failed','code','ITEM_COUNT_OUT_OF_RANGE','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','ITEM_COUNT_OUT_OF_RANGE')));
 END IF;
 IF _notification_policy NOT IN ('require_all_recipients','best_effort') THEN
  RETURN jsonb_build_object('status','validation_failed','code','INVALID_NOTIFICATION_POLICY','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','INVALID_NOTIFICATION_POLICY')));
 END IF;
 v_hash:=public.planning_batch_request_hash(_sede_id,_source_run_id,_source_run_version,_notification_policy,_items);

 PERFORM pg_advisory_xact_lock(hashtextextended('planning-sede:'||_sede_id::text,0));
 SELECT * INTO v_existing FROM public.planning_apply_batches WHERE sede_id=_sede_id AND idempotency_key=_idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF v_existing.request_hash<>v_hash OR v_existing.id<>_batch_id THEN
   RETURN jsonb_build_object('status','validation_failed','code','IDEMPOTENCY_CONFLICT','batch_id',v_existing.id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','IDEMPOTENCY_CONFLICT')));
  END IF;
  RETURN v_existing.result_summary||jsonb_build_object('status',v_existing.status,'batch_id',v_existing.id,'idempotent_replay',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id=_batch_id) THEN RETURN jsonb_build_object('status','validation_failed','code','BATCH_IDEMPOTENCY_CONFLICT','batch_id',_batch_id,'idempotent_replay',false,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts',jsonb_build_array(jsonb_build_object('code','BATCH_IDEMPOTENCY_CONFLICT'))); END IF;

 SELECT COALESCE(sum(CASE WHEN jsonb_typeof(x->'cleaner_ids')='array' THEN jsonb_array_length(x->'cleaner_ids') ELSE 0 END),0)::int INTO v_expected_assignments FROM jsonb_array_elements(_items) x;
 INSERT INTO public.planning_apply_batches(id,sede_id,source_run_id,source_run_version,idempotency_key,request_hash,request_items,actor_id,status,expected_task_count,expected_assignment_count,notification_policy)
 VALUES(_batch_id,_sede_id,_source_run_id,_source_run_version,_idempotency_key,v_hash,_items,v_actor,'applying',v_count,v_expected_assignments,_notification_policy);
 PERFORM set_config('app.planning_batch_id',_batch_id::text,true);
 PERFORM set_config('app.planning_notification_mode','shadow',true);

 BEGIN
  -- Forma, duplicados y source run.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(_items) x WHERE jsonb_typeof(x)<>'object' OR ((x?'task_id')=(x?'recurring_task_id'))
    OR NOT (x?'date' AND x?'start_time' AND x?'end_time' AND x?'cleaner_ids') OR jsonb_typeof(x->'cleaner_ids')<>'array'
    OR (x?'task_id' AND (NOT (x?'expected_planning_version' AND x?'expected_status' AND x?'expected_cleaner_ids') OR COALESCE(x->>'task_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR (x?'recurring_task_id' AND (NOT (x?'execution_date' AND x?'expected_recurring_revision' AND x?'schedule_snapshot') OR COALESCE(x->>'recurring_task_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(x->'cleaner_ids')='array' THEN x->'cleaner_ids' ELSE '[]'::jsonb END)e WHERE COALESCE(e#>>'{}','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) THEN
   v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','INVALID_ITEM_SCHEMA'));
  END IF;
  IF EXISTS(SELECT 1 FROM (SELECT COALESCE(x->>'task_id',(x->>'recurring_task_id')||':'||(x->>'execution_date')) k,count(*) FROM jsonb_array_elements(_items)x GROUP BY 1 HAVING count(*)>1)d) THEN
   v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','DUPLICATE_ITEM'));
  END IF;
  IF _source_run_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.planning_runs WHERE id=_source_run_id AND sede_id=_sede_id AND status IN ('draft','approved') AND version=_source_run_version FOR UPDATE) THEN
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('code','SOURCE_RUN_STALE'));
   END IF;
  END IF;

  -- No se intenta bloquear ni castear payloads estructuralmente inválidos.
  IF jsonb_array_length(v_conflicts)>0 THEN
   INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,request_item,apply_status,conflict_code)
   SELECT _batch_id,o,COALESCE(x->>'task_id',x->>'recurring_task_id','invalid')||':'||o,x,'conflict','BATCH_VALIDATION_FAILED'
   FROM jsonb_array_elements(_items) WITH ORDINALITY q(x,o);
   UPDATE public.planning_apply_batches SET status='validation_failed',failure_code='VALIDATION_FAILED',failure_summary=jsonb_build_object('conflicts',v_conflicts),completed_at=now(),result_summary=jsonb_build_object('status','validation_failed','code','VALIDATION_FAILED','conflicts',v_conflicts,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0) WHERE id=_batch_id;
   RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
  END IF;

  -- Orden global compatible con los writers 13000: tasks, cleaners,
  -- recurrencias y, al final, protocolo común scope/cleaner+fecha.
  PERFORM 1 FROM public.tasks WHERE id IN (
   SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(_items)x WHERE x?'task_id'
   UNION
   SELECT rte.generated_task_id FROM public.recurring_task_executions rte
   JOIN jsonb_array_elements(_items)x ON x?'recurring_task_id'
    AND rte.recurring_task_id=(x->>'recurring_task_id')::uuid
    AND rte.execution_day=(x->>'execution_date')::date AND rte.success
  ) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.cleaners WHERE id IN (
   SELECT (e#>>'{}')::uuid FROM jsonb_array_elements(_items)x
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  ) ORDER BY id FOR KEY SHARE;
  PERFORM 1 FROM public.recurring_tasks WHERE id IN (SELECT (x->>'recurring_task_id')::uuid FROM jsonb_array_elements(_items)x WHERE x?'recurring_task_id') ORDER BY id FOR UPDATE;
  PERFORM public.planning_lock_worker_dates(COALESCE((SELECT jsonb_agg(jsonb_build_object('cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d
   FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
   UNION
   SELECT ea.cleaner_id,t.date FROM jsonb_array_elements(_items)x JOIN public.tasks t ON x?'task_id' AND t.id=(x->>'task_id')::uuid JOIN public.planning_effective_task_assignments() ea ON ea.task_id=t.id
   UNION
   SELECT ea.cleaner_id,(x->>'date')::date FROM jsonb_array_elements(_items)x JOIN public.tasks t ON x?'task_id' AND t.id=(x->>'task_id')::uuid JOIN public.planning_effective_task_assignments() ea ON ea.task_id=t.id
  )p),'[]'));

  FOR v_item,v_ord IN SELECT value,ordinality::int FROM jsonb_array_elements(_items) WITH ORDINALITY LOOP
   v_task_id:=NULL;
   BEGIN
    IF v_item?'task_id' THEN
     v_task_id:=(v_item->>'task_id')::uuid;
     SELECT * INTO v_task FROM public.tasks WHERE id=v_task_id;
     IF NOT FOUND THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_NOT_FOUND')); CONTINUE; END IF;
     IF v_task.sede_id<>_sede_id THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_SEDE_MISMATCH')); END IF;
     IF v_task.planning_version<>COALESCE((v_item->>'expected_planning_version')::bigint,-1) THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','PLANNING_VERSION_CONFLICT')); END IF;
     IF v_task.status<>COALESCE(v_item->>'expected_status','') OR v_task.status IN ('in-progress','completed','cancelled') THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','TASK_STATUS_CONFLICT')); END IF;
     SELECT COALESCE(array_agg(cleaner_id ORDER BY cleaner_id),'{}') INTO v_old_ids FROM public.planning_effective_task_assignments() WHERE task_id=v_task_id;
     SELECT COALESCE(array_agg((e#>>'{}')::uuid ORDER BY (e#>>'{}')::uuid),'{}') INTO v_new_ids FROM jsonb_array_elements(COALESCE(v_item->'expected_cleaner_ids','[]'))e;
     IF v_old_ids<>v_new_ids THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_ASSIGNMENTS_CONFLICT')); END IF;
     IF v_item?'expected_start_time' AND v_task.start_time<>(v_item->>'expected_start_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_SCHEDULE_CONFLICT')); END IF;
     IF v_item?'expected_end_time' AND v_task.end_time<>(v_item->>'expected_end_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','EXPECTED_SCHEDULE_CONFLICT')); END IF;
     IF (v_item->>'start_time')::time<v_task.check_out OR (v_item->>'end_time')::time>v_task.check_in THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','CHECKOUT_CHECKIN_WINDOW')); END IF;
   ELSE
     SELECT * INTO v_rec FROM public.recurring_tasks WHERE id=(v_item->>'recurring_task_id')::uuid;
     IF NOT FOUND OR v_rec.sede_id<>_sede_id OR NOT v_rec.is_active OR v_rec.next_execution<>(v_item->>'execution_date')::date OR v_rec.state_revision<>COALESCE((v_item->>'expected_recurring_revision')::bigint,-1) THEN
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','RECURRENCE_CONFLICT'));
      END IF;
      IF EXISTS(
      SELECT 1 FROM public.recurring_task_executions rte
      WHERE rte.recurring_task_id=(v_item->>'recurring_task_id')::uuid
        AND rte.execution_day=(v_item->>'execution_date')::date AND rte.success
      ) THEN
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','RECURRENCE_ALREADY_MATERIALIZED'));
      END IF;
   END IF;
   IF (v_item->>'start_time')::time >= (v_item->>'end_time')::time THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','INVALID_SCHEDULE')); END IF;
   IF (SELECT count(*) FROM jsonb_array_elements(COALESCE(v_item->'cleaner_ids','[]')))<>(SELECT count(DISTINCT e#>>'{}') FROM jsonb_array_elements(COALESCE(v_item->'cleaner_ids','[]'))e) THEN v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','DUPLICATE_CLEANER')); END IF;
   EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR null_value_not_allowed THEN
    v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object('ordinal',v_ord,'code','INVALID_ITEM_VALUE'));
   END;
  END LOOP;

  -- Trabajadores, teléfonos, disponibilidad y solapes del estado prospectivo.
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','CLEANER_INVALID','cleaner_id',d.cid)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
   EXCEPT SELECT id FROM public.cleaners WHERE is_active AND sede_id=_sede_id AND COALESCE(planning_operational_restrictions,'')!~*'no apta'
  )d),'[]');
  IF _notification_policy='require_all_recipients' THEN
   v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','RECIPIENT_PHONE_REQUIRED','cleaner_id',d.cid)) FROM (
    SELECT DISTINCT (e#>>'{}')::uuid cid FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
    EXCEPT SELECT id FROM public.cleaners WHERE COALESCE(public.normalize_spanish_phone_e164(telefono),public.normalize_spanish_phone_e164(whatsapp_phone_e164)) IS NOT NULL
   )d),'[]');
  END IF;
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','INTERNAL_OVERLAP','cleaner_id',a.cid,'date',a.d)) FROM (
   SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,row_number()over() rn
   FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )a JOIN (SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,row_number()over() rn FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e)b ON a.cid=b.cid AND a.d=b.d AND a.rn<b.rn AND a.s<b.f AND b.s<a.f),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','EXTERNAL_OVERLAP','cleaner_id',p.cid,'task_id',t.id)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.planning_effective_task_assignments() ea ON ea.cleaner_id=p.cid JOIN public.tasks t ON t.id=ea.task_id AND t.date=p.d AND t.start_time<p.f AND p.s<t.end_time AND t.status NOT IN ('completed','cancelled') WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_items)i WHERE i->>'task_id'=t.id::text)),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','OUTSIDE_AVAILABILITY','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.cleaner_availability ca ON ca.cleaner_id=p.cid AND ca.day_of_week=extract(dow from p.d)::int WHERE NOT ca.is_available OR p.s<ca.start_time OR p.f>ca.end_time),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','WORKER_ABSENT','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_absences wa ON wa.cleaner_id=p.cid AND p.d BETWEEN wa.start_date AND wa.end_date AND (wa.start_time IS NULL OR (p.s<wa.end_time AND wa.start_time<p.f))),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','WORKER_FIXED_DAY_OFF','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_fixed_days_off wd ON wd.cleaner_id=p.cid AND wd.is_active AND wd.day_of_week=extract(dow from p.d)::int),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','MAINTENANCE_OVERLAP','cleaner_id',p.cid,'date',p.d)) FROM (
   SELECT DISTINCT (e#>>'{}')::uuid cid,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
  )p JOIN public.worker_maintenance_cleanings wm ON wm.cleaner_id=p.cid AND wm.is_active AND extract(dow from p.d)::int=ANY(wm.days_of_week) AND p.s<wm.end_time AND wm.start_time<p.f),'[]');
  v_conflicts:=v_conflicts||COALESCE((SELECT jsonb_agg(jsonb_build_object('code','DAILY_CAPACITY_EXCEEDED','cleaner_id',w.cid,'date',w.d,'minutes',w.minutes)) FROM (
   SELECT z.cid,z.d,sum(z.minutes)::int minutes FROM (
    SELECT (e#>>'{}')::uuid cid,(x->>'date')::date d,
      COALESCE(NULLIF(x->>'duration_minutes','')::int,extract(epoch from ((x->>'end_time')::time-(x->>'start_time')::time))/60)::int minutes
    FROM jsonb_array_elements(_items)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e
    UNION ALL
    SELECT ea.cleaner_id,t.date,
      COALESCE(t.duracion,extract(epoch from (t.end_time-t.start_time))/60)::int
    FROM public.planning_effective_task_assignments() ea JOIN public.tasks t ON t.id=ea.task_id
    WHERE t.status NOT IN ('completed','cancelled')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(_items)i WHERE i->>'task_id'=t.id::text)
   )z GROUP BY z.cid,z.d
  )w JOIN public.cleaners c ON c.id=w.cid WHERE w.minutes>c.planning_max_daily_minutes),'[]');

  IF jsonb_array_length(v_conflicts)>0 THEN
   INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,task_id,recurring_task_id,execution_date,expected_planning_version,request_item,apply_status,conflict_code)
   SELECT _batch_id,o,COALESCE(x->>'task_id',(x->>'recurring_task_id')||':'||(x->>'execution_date'))||':'||o,NULLIF(x->>'task_id','')::uuid,NULLIF(x->>'recurring_task_id','')::uuid,NULLIF(x->>'execution_date','')::date,NULLIF(x->>'expected_planning_version','')::bigint,x,'conflict','BATCH_VALIDATION_FAILED'
   FROM jsonb_array_elements(_items) WITH ORDINALITY q(x,o);
   UPDATE public.planning_apply_batches SET status='validation_failed',failure_code='VALIDATION_FAILED',failure_summary=jsonb_build_object('conflicts',v_conflicts),completed_at=now(),result_summary=jsonb_build_object('status','validation_failed','code','VALIDATION_FAILED','conflicts',v_conflicts,'applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0) WHERE id=_batch_id;
   RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
  END IF;

  -- Materialización recurrente dentro de la misma subtransacción.
  FOR v_item,v_ord IN SELECT value,ordinality::int FROM jsonb_array_elements(v_work) WITH ORDINALITY LOOP
   IF v_item?'recurring_task_id' THEN
    SELECT generated_task_id,was_created INTO v_generated,v_created FROM public.materialize_recurring_task((v_item->>'recurring_task_id')::uuid,(v_item->>'execution_date')::date,NULLIF(v_item->>'next_execution','')::date,COALESCE(v_item->'schedule_snapshot','{}'));
    v_work:=jsonb_set(v_work,ARRAY[(v_ord-1)::text],v_item||jsonb_build_object('task_id',v_generated));
   END IF;
  END LOOP;

  -- Snapshot previo + ledger de items.
  INSERT INTO public.planning_apply_batch_items(batch_id,item_ordinal,item_key,task_id,recurring_task_id,execution_date,expected_planning_version,request_item,before_snapshot,apply_status)
  SELECT _batch_id,o,CASE WHEN x?'recurring_task_id' THEN (x->>'recurring_task_id')||':'||(x->>'execution_date') ELSE x->>'task_id' END,(x->>'task_id')::uuid,NULLIF(x->>'recurring_task_id','')::uuid,NULLIF(x->>'execution_date','')::date,NULLIF(x->>'expected_planning_version','')::bigint,x,
   to_jsonb(t)||jsonb_build_object('cleaner_ids',COALESCE((SELECT jsonb_agg(ea.cleaner_id ORDER BY ea.cleaner_id) FROM public.planning_effective_task_assignments() ea WHERE ea.task_id=t.id),'[]'::jsonb)),'pending'
  FROM jsonb_array_elements(v_work) WITH ORDINALITY q(x,o) JOIN public.tasks t ON t.id=(x->>'task_id')::uuid;

  -- Horarios set-based; el trigger incrementa planning_version.
  UPDATE public.tasks t SET date=d.d,start_time=d.s,end_time=d.f,duracion=COALESCE(d.minutes,t.duracion),updated_at=now()
  FROM (SELECT (x->>'task_id')::uuid id,(x->>'date')::date d,(x->>'start_time')::time s,(x->>'end_time')::time f,NULLIF(x->>'duration_minutes','')::int minutes FROM jsonb_array_elements(v_work)x)d WHERE t.id=d.id;

  -- task_assignments canónico; orden final persistido por assigned_at.
  DELETE FROM public.task_assignments ta USING (SELECT (x->>'task_id')::uuid tid,(e#>>'{}')::uuid cid FROM jsonb_array_elements(v_work)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]'))e) desired
  WHERE ta.task_id IN (SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(v_work)x) AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_work)i CROSS JOIN LATERAL jsonb_array_elements(COALESCE(i->'cleaner_ids','[]'))c WHERE (i->>'task_id')::uuid=ta.task_id AND (c#>>'{}')::uuid=ta.cleaner_id);
  INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name,assigned_at,assigned_by)
  SELECT (x->>'task_id')::uuid,(e#>>'{}')::uuid,c.name,clock_timestamp()+((o*1000+eo)::text||' microseconds')::interval,v_actor
  FROM jsonb_array_elements(v_work) WITH ORDINALITY q(x,o) CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]')) WITH ORDINALITY a(e,eo) JOIN public.cleaners c ON c.id=(e#>>'{}')::uuid
  ON CONFLICT(task_id,cleaner_id) DO UPDATE SET assigned_at=EXCLUDED.assigned_at,assigned_by=EXCLUDED.assigned_by,cleaner_name=EXCLUDED.cleaner_name;
  UPDATE public.tasks t SET cleaner_id=p.cid,cleaner=p.name FROM (
   SELECT DISTINCT ON ((x->>'task_id')::uuid) (x->>'task_id')::uuid tid,c.id cid,c.name FROM jsonb_array_elements(v_work)x CROSS JOIN LATERAL jsonb_array_elements(COALESCE(x->'cleaner_ids','[]')) WITH ORDINALITY a(e,o) JOIN public.cleaners c ON c.id=(e#>>'{}')::uuid ORDER BY (x->>'task_id')::uuid,o
  )p WHERE t.id=p.tid;
  UPDATE public.tasks t SET cleaner_id=NULL,cleaner=NULL WHERE t.id IN (SELECT (x->>'task_id')::uuid FROM jsonb_array_elements(v_work)x WHERE jsonb_array_length(COALESCE(x->'cleaner_ids','[]'))=0);

  UPDATE public.planning_apply_batch_items bi SET after_snapshot=to_jsonb(t)||jsonb_build_object('cleaner_ids',COALESCE((SELECT jsonb_agg(ta.cleaner_id ORDER BY ta.assigned_at,ta.id) FROM public.task_assignments ta WHERE ta.task_id=t.id),'[]'::jsonb)),apply_status='applied'
  FROM public.tasks t WHERE bi.batch_id=_batch_id AND bi.task_id=t.id;
  INSERT INTO public.planning_assignment_audit(batch_id,batch_item_id,task_id,actor_id,before_snapshot,after_snapshot,net_change)
  SELECT _batch_id,id,task_id,v_actor,before_snapshot,after_snapshot,
   CASE WHEN before_snapshot->'cleaner_ids'=after_snapshot->'cleaner_ids' AND (before_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])=(after_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids']) THEN 'unchanged'
        WHEN jsonb_array_length(before_snapshot->'cleaner_ids')=0 THEN 'assigned' WHEN jsonb_array_length(after_snapshot->'cleaner_ids')=0 THEN 'cancelled'
        WHEN before_snapshot->'cleaner_ids'=after_snapshot->'cleaner_ids' THEN 'modified' ELSE 'mixed' END
  FROM public.planning_apply_batch_items WHERE batch_id=_batch_id;

  -- Suprime eventos trigger intermedios y publica exclusivamente el diff final.
  DELETE FROM public.notification_events WHERE batch_id=_batch_id;
  INSERT INTO public.notification_events(event_type,entity_type,entity_id,task_id,cleaner_id,recipient_worker_id,recipient_name_snapshot,recipient_phone_snapshot,sede_id,batch_id,payload,snapshot,dedupe_key,status,recipient_sequence,notification_mode)
  SELECT kind,'tasks',a.task_id,a.task_id,cid,cid,
   (SELECT c.name FROM public.cleaners c WHERE c.id=cid),
   (SELECT COALESCE(public.normalize_spanish_phone_e164(c.telefono),public.normalize_spanish_phone_e164(c.whatsapp_phone_e164)) FROM public.cleaners c WHERE c.id=cid),
   _sede_id,_batch_id,jsonb_build_object('source','apply_planning_batch','net_change',kind),
   CASE WHEN kind='task_cancelled' THEN a.before_snapshot ELSE a.after_snapshot END,
   kind||':'||_batch_id||':'||a.task_id||':'||cid,'pending',row_number()over(partition by cid order by a.task_id,kind),'shadow'
  FROM public.planning_assignment_audit a CROSS JOIN LATERAL (
   SELECT 'task_cancelled' kind,(v#>>'{}')::uuid cid FROM jsonb_array_elements(a.before_snapshot->'cleaner_ids')v WHERE NOT (a.after_snapshot->'cleaner_ids')? (v#>>'{}')
   UNION ALL SELECT 'task_assigned',(v#>>'{}')::uuid FROM jsonb_array_elements(a.after_snapshot->'cleaner_ids')v WHERE NOT (a.before_snapshot->'cleaner_ids')? (v#>>'{}')
   UNION ALL SELECT 'task_modified',(v#>>'{}')::uuid FROM jsonb_array_elements(a.after_snapshot->'cleaner_ids')v WHERE (a.before_snapshot->'cleaner_ids')? (v#>>'{}') AND (a.before_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])<>(a.after_snapshot-ARRAY['updated_at','planning_version','cleaner','cleaner_id','cleaner_ids'])
  )diff WHERE a.batch_id=_batch_id;

  IF _source_run_id IS NOT NULL THEN
   UPDATE public.planning_runs SET status='approved',approved_by=v_actor,approved_at=COALESCE(approved_at,now()),
     applied_batch_id=_batch_id,version=version+1,updated_at=now()
   WHERE id=_source_run_id;
   UPDATE public.planning_run_items SET status='applied',applied_at=now(),updated_at=now()
   WHERE run_id=_source_run_id AND task_id IN(
    SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id
   );
  END IF;
  SELECT count(*) INTO v_changed FROM public.planning_assignment_audit WHERE batch_id=_batch_id AND net_change<>'unchanged';
  v_summary:=jsonb_build_object('status','applied','applied_task_count',v_count,'changed_task_count',v_changed,'applied_assignment_count',(SELECT count(*) FROM public.task_assignments WHERE task_id IN(SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id)),'assignment_count',(SELECT count(*) FROM public.task_assignments WHERE task_id IN(SELECT task_id FROM public.planning_apply_batch_items WHERE batch_id=_batch_id)),'notification_event_count',(SELECT count(*) FROM public.notification_events WHERE batch_id=_batch_id),'conflicts','[]'::jsonb);
  UPDATE public.planning_apply_batches SET status='applied',result_summary=v_summary,completed_at=now() WHERE id=_batch_id;
  RETURN v_summary||jsonb_build_object('batch_id',_batch_id,'idempotent_replay',false);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT,v_error_context=PG_EXCEPTION_CONTEXT;
  UPDATE public.planning_apply_batches SET status='technical_failed',failure_code='TECHNICAL_FAILURE',failure_summary=jsonb_build_object('sqlstate',SQLSTATE,'message',left(v_error,160),'context',left(v_error_context,500)),completed_at=now(),result_summary=jsonb_build_object('status','technical_failed','code','TECHNICAL_FAILURE','applied_task_count',0,'applied_assignment_count',0,'notification_event_count',0,'conflicts','[]'::jsonb) WHERE id=_batch_id;
  RETURN (SELECT result_summary||jsonb_build_object('batch_id',id,'idempotent_replay',false) FROM public.planning_apply_batches WHERE id=_batch_id);
 END;
END $_$;


ALTER FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") IS 'Aplica 1..500 items de planificación en una única transacción lógica; objetivo/SLO certificado por integración: 150.';



CREATE OR REPLACE FUNCTION "public"."apply_smoobu_reservation"("_external_id" "text", "_property_name" "text", "_property_id" "uuid", "_cliente_id" "uuid", "_check_in" "date", "_check_out" "date", "_status" "text", "_guest_name" "text", "_synced_at" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reservation_id UUID;
  v_reservation_created BOOLEAN := false;
  v_reservation_updated BOOLEAN := false;
  v_link_id UUID;
  v_previous_task_id UUID;
  v_previous_task_status TEXT;
  v_previous_task_date DATE;
  v_previous_link_status TEXT;
  v_task_id UUID;
  v_task_created BOOLEAN := false;
  v_task_updated BOOLEAN := false;
  v_task_cancelled BOOLEAN := false;
  v_task_preserved BOOLEAN := false;
  v_is_cancelled BOOLEAN;
BEGIN
  IF NULLIF(trim(_external_id), '') IS NULL THEN
    RAISE EXCEPTION 'external_id es obligatorio';
  END IF;
  IF _check_out <= _check_in THEN
    RAISE EXCEPTION 'check_out debe ser posterior a check_in';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = _property_id
      AND nombre = _property_name
      AND cliente_id = _cliente_id
  ) THEN
    RAISE EXCEPTION 'La propiedad no pertenece al cliente o no coincide por nombre';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _cliente_id) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  SELECT id INTO v_reservation_id
  FROM public.smoobu_reservations
  WHERE external_id = _external_id
  FOR UPDATE;

  IF v_reservation_id IS NULL THEN
    INSERT INTO public.smoobu_reservations (
      external_id, property_name, property_id, cliente_id,
      check_in, check_out, status, guest_name, synced_at
    ) VALUES (
      _external_id, _property_name, _property_id, _cliente_id,
      _check_in, _check_out, lower(coalesce(_status, 'confirmed')),
      NULLIF(trim(_guest_name), ''), coalesce(_synced_at, now())
    )
    RETURNING id INTO v_reservation_id;
    v_reservation_created := true;
  ELSE
    v_reservation_updated := EXISTS (
      SELECT 1
      FROM public.smoobu_reservations
      WHERE id = v_reservation_id
        AND (
          property_name IS DISTINCT FROM _property_name
          OR property_id IS DISTINCT FROM _property_id
          OR cliente_id IS DISTINCT FROM _cliente_id
          OR check_in IS DISTINCT FROM _check_in
          OR check_out IS DISTINCT FROM _check_out
          OR status IS DISTINCT FROM lower(coalesce(_status, 'confirmed'))
          OR guest_name IS DISTINCT FROM NULLIF(trim(_guest_name), '')
        )
    );
    UPDATE public.smoobu_reservations
    SET property_name = _property_name,
        property_id = _property_id,
        cliente_id = _cliente_id,
        check_in = _check_in,
        check_out = _check_out,
        status = lower(coalesce(_status, 'confirmed')),
        guest_name = NULLIF(trim(_guest_name), ''),
        synced_at = coalesce(_synced_at, now())
    WHERE id = v_reservation_id;
  END IF;

  SELECT rt.id, rt.task_id, rt.status, t.status, t.date
  INTO v_link_id, v_previous_task_id, v_previous_link_status, v_previous_task_status, v_previous_task_date
  FROM public.smoobu_reservation_tasks rt
  LEFT JOIN public.tasks t ON t.id = rt.task_id
  WHERE rt.reservation_id = v_reservation_id
    AND rt.service_kind = 'checkout'
  FOR UPDATE OF rt;

  v_is_cancelled := lower(coalesce(_status, 'confirmed')) IN ('cancelled', 'canceled', 'no_show');

  IF v_is_cancelled THEN
    IF v_previous_task_id IS NOT NULL AND v_previous_task_status = 'pending' THEN
      DELETE FROM public.tasks
      WHERE id = v_previous_task_id
        AND status = 'pending';
      v_task_cancelled := FOUND;
    ELSIF v_previous_task_id IS NOT NULL THEN
      v_task_preserved := true;
    END IF;

    IF v_link_id IS NULL THEN
      INSERT INTO public.smoobu_reservation_tasks (
        reservation_id, task_id, service_kind, task_date, status
      ) VALUES (
        v_reservation_id, v_previous_task_id, 'checkout', _check_out, 'cancelled'
      );
    ELSE
      UPDATE public.smoobu_reservation_tasks
      SET status = 'cancelled', task_date = _check_out
      WHERE id = v_link_id;
    END IF;
  ELSE
    IF v_previous_task_id IS NOT NULL
       AND v_previous_task_status IS NOT NULL
       AND v_previous_task_status <> 'pending'
       AND v_previous_task_date IS DISTINCT FROM _check_out THEN
      -- No movemos tareas iniciadas/completadas; se conserva la evidencia operativa.
      v_task_preserved := true;
    ELSIF v_previous_task_id IS NOT NULL
       AND v_previous_task_status = 'pending'
       AND v_previous_task_date IS DISTINCT FROM _check_out THEN
      UPDATE public.tasks
      SET date = _check_out, updated_at = now()
      WHERE id = v_previous_task_id AND status = 'pending';
      v_task_updated := FOUND;
    END IF;

    IF v_link_id IS NULL OR v_previous_link_status = 'cancelled' OR v_previous_task_id IS NULL OR v_previous_task_status IS NULL THEN
      v_task_id := gen_random_uuid();
      INSERT INTO public.tasks (
        id, property, address, start_time, end_time, type, status,
        check_out, check_in, cleaner, background_color, date,
        cliente_id, propiedad_id, cleaner_id, duracion, coste, sede_id
      )
      SELECT
        v_task_id,
        p.nombre,
        p.direccion,
        TIME '11:00',
        (TIME '11:00' + make_interval(mins => greatest(coalesce(p.duracion_servicio, 60), 15)))::time,
        'limpieza-turistica',
        'pending',
        p.check_out_predeterminado,
        p.check_in_predeterminado,
        NULL,
        '#3B82F6',
        _check_out,
        _cliente_id,
        p.id,
        NULL,
        greatest(coalesce(p.duracion_servicio, 60), 15),
        p.coste_servicio,
        p.sede_id
      FROM public.properties p
      WHERE p.id = _property_id;
      v_task_created := true;

      IF v_link_id IS NULL THEN
        INSERT INTO public.smoobu_reservation_tasks (
          reservation_id, task_id, service_kind, task_date, status
        ) VALUES (
          v_reservation_id, v_task_id, 'checkout', _check_out, 'active'
        );
      ELSE
        UPDATE public.smoobu_reservation_tasks
        SET task_id = v_task_id, task_date = _check_out, status = 'active'
        WHERE id = v_link_id;
      END IF;
    ELSIF v_link_id IS NOT NULL THEN
      UPDATE public.smoobu_reservation_tasks
      SET task_date = _check_out, status = 'active'
      WHERE id = v_link_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id,
    'reservation_created', v_reservation_created,
    'reservation_updated', v_reservation_updated,
    'task_id', coalesce(v_task_id, v_previous_task_id),
    'task_created', v_task_created,
    'task_updated', v_task_updated,
    'task_cancelled', v_task_cancelled,
    'task_preserved', v_task_preserved,
    'status', lower(coalesce(_status, 'confirmed'))
  );
END;
$$;


ALTER FUNCTION "public"."apply_smoobu_reservation"("_external_id" "text", "_property_name" "text", "_property_id" "uuid", "_cliente_id" "uuid", "_check_in" "date", "_check_out" "date", "_status" "text", "_guest_name" "text", "_synced_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_whatsapp_approval_response"("_whatsapp_message_id" "text", "_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_occurred_at" timestamp with time zone) RETURNS TABLE("outcome" "text", "rejection_event_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  task_record public.tasks%ROWTYPE;
  source_delivery public.notification_deliveries%ROWTYPE;
  source_event public.notification_events%ROWTYPE;
  latest_decision_at timestamptz;
  alert_id uuid;
  alert_dedupe text;
  normalized_sender text;
  normalized_recipient text;
BEGIN
  IF _action NOT IN ('approve', 'reject', 'late_started', 'late_issue')
     OR COALESCE(_whatsapp_message_id, '') = ''
     OR COALESCE(_source_provider_message_id, '') = ''
     OR COALESCE(_sender, '') = ''
     OR COALESCE(_button_payload, '') = ''
     OR _occurred_at IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  SELECT task.* INTO task_record FROM public.tasks task
  WHERE task.id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN; END IF;

  SELECT delivery.* INTO source_delivery FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.provider_message_id = _source_provider_message_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'source_not_found'::text, NULL::uuid; RETURN;
  END IF;
  IF source_delivery.status NOT IN ('sent', 'delivered', 'read')
     OR NOT (COALESCE(source_delivery.provider_payload->'buttonPayloads', '[]'::jsonb) ? _button_payload) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  normalized_sender := regexp_replace(_sender, '[^0-9]', '', 'g');
  normalized_recipient := regexp_replace(source_delivery.recipient, '[^0-9]', '', 'g');
  IF normalized_sender = '' OR normalized_sender <> normalized_recipient THEN
    RETURN QUERY SELECT 'unauthorized_sender'::text, NULL::uuid; RETURN;
  END IF;

  SELECT event.* INTO source_event FROM public.notification_events event
  WHERE event.id = source_delivery.notification_event_id;
  IF NOT FOUND
     OR source_event.task_id <> _task_id
     OR (_action IN ('approve', 'reject') AND source_event.event_type NOT IN ('task_assigned', 'task_modified', 'task_approval_reminder'))
     OR (_action IN ('late_started', 'late_issue') AND source_event.event_type <> 'task_late_start_reminder') THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  -- task_assignments es la fuente canónica cuando existe. tasks.cleaner_id solo
  -- representa la primera trabajadora y se conserva como fallback para tareas
  -- antiguas que todavía no tienen filas en task_assignments.
  IF source_event.cleaner_id IS NULL OR NOT (
    EXISTS (
      SELECT 1
      FROM public.task_assignments assignment
      WHERE assignment.task_id = _task_id
        AND assignment.cleaner_id = source_event.cleaner_id
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.task_assignments assignment
        WHERE assignment.task_id = _task_id
      )
      AND source_event.cleaner_id = task_record.cleaner_id
    )
  ) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  -- Un botón no puede permanecer operativo indefinidamente. Los recordatorios
  -- se emiten el mismo día y las asignaciones tienen un máximo de siete días.
  IF _occurred_at < source_event.created_at - interval '5 minutes'
     OR _occurred_at > source_event.created_at + interval '7 days' THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.task_approval_events approval
             WHERE approval.whatsapp_message_id = _whatsapp_message_id) THEN
    RETURN QUERY SELECT 'duplicate'::text,
      (SELECT event.id FROM public.notification_events event
       WHERE event.dedupe_key = 'task_rejected_alert:' || _task_id::text || ':' || _whatsapp_message_id
       LIMIT 1);
    RETURN;
  END IF;

  -- La comparación usa el evento lógico, no la inserción tardía de delivery.
  IF _action IN ('approve', 'reject') AND EXISTS (
    SELECT 1 FROM public.notification_events newer
    WHERE newer.task_id = _task_id
      AND newer.cleaner_id IS NOT DISTINCT FROM source_event.cleaner_id
      AND newer.event_type IN ('task_assigned', 'task_modified', 'task_cancelled')
      AND newer.created_at > source_event.created_at
  ) THEN
    RETURN QUERY SELECT 'superseded'::text, NULL::uuid; RETURN;
  END IF;

  latest_decision_at := GREATEST(task_record.approved_at, task_record.rejected_at);
  IF latest_decision_at IS NOT NULL AND _occurred_at <= latest_decision_at THEN
    RETURN QUERY SELECT 'stale'::text, NULL::uuid; RETURN;
  END IF;

  IF _action IN ('approve', 'reject') THEN
    IF task_record.approval_status <> 'pending'
       OR task_record.status IN ('completed', 'cancelled') THEN
      RETURN QUERY SELECT 'not_actionable'::text, NULL::uuid; RETURN;
    END IF;

    UPDATE public.tasks SET
      approval_status = CASE WHEN _action = 'approve' THEN 'approved' ELSE 'rejected' END,
      approved_at = CASE WHEN _action = 'approve' THEN _occurred_at ELSE NULL END,
      rejected_at = CASE WHEN _action = 'reject' THEN _occurred_at ELSE NULL END,
      approval_response_source = 'whatsapp'
    WHERE id = _task_id;

    INSERT INTO public.task_approval_events (
      task_id, cleaner_id, action, source, whatsapp_message_id
    ) VALUES (
      _task_id, source_event.cleaner_id,
      CASE WHEN _action = 'approve' THEN 'approved' ELSE 'rejected' END,
      'whatsapp', _whatsapp_message_id
    );

    IF _action = 'reject' THEN
      alert_dedupe := 'task_rejected_alert:' || _task_id::text || ':' || _whatsapp_message_id;
      INSERT INTO public.notification_events (
        event_type, entity_type, entity_id, task_id, cleaner_id, sede_id, dedupe_key, payload
      ) VALUES (
        'task_rejected_alert', 'tasks', _task_id, _task_id, source_event.cleaner_id,
        source_event.sede_id, alert_dedupe,
        jsonb_build_object('source', 'whatsapp', 'whatsapp_message_id', _whatsapp_message_id)
      )
      ON CONFLICT (dedupe_key) DO UPDATE SET dedupe_key = EXCLUDED.dedupe_key
      RETURNING id INTO alert_id;
    END IF;
  ELSE
    IF task_record.status <> 'pending' THEN
      RETURN QUERY SELECT 'not_actionable'::text, NULL::uuid; RETURN;
    END IF;
    INSERT INTO public.task_approval_events (
      task_id, cleaner_id, action, source, whatsapp_message_id, reason
    ) VALUES (
      _task_id, source_event.cleaner_id, 'admin_override', 'whatsapp',
      _whatsapp_message_id, _action
    );
  END IF;

  RETURN QUERY SELECT 'applied'::text, alert_id;
END;
$$;


ALTER FUNCTION "public"."apply_whatsapp_approval_response"("_whatsapp_message_id" "text", "_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_occurred_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_whatsapp_delivery_status"("_provider_message_id" "text", "_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text" DEFAULT NULL::"text") RETURNS TABLE("delivery_id" "uuid", "notification_event_id" "uuid", "applied" boolean, "effective_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  target_delivery_id uuid;
  locked_event_id uuid;
  current_rank integer;
  incoming_rank integer;
  current_occurred_at timestamptz;
  successful_whatsapp boolean;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  IF _status NOT IN ('sent', 'delivered', 'read', 'failed') THEN
    RAISE EXCEPTION 'unsupported_whatsapp_status' USING ERRCODE = '22023';
  END IF;

  SELECT delivery.id, delivery.notification_event_id
  INTO target_delivery_id, locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND (
      delivery.provider_message_id = _provider_message_id
      OR EXISTS (
        SELECT 1
        FROM public.notification_delivery_attempts attempt
        WHERE attempt.delivery_id = delivery.id
          AND attempt.provider_message_id = _provider_message_id
      )
    );
  IF locked_event_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row
  FROM public.notification_events event
  WHERE event.id = locked_event_id
  FOR UPDATE;
  IF event_row.id IS NULL THEN
    RETURN;
  END IF;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT delivery.* INTO target
  FROM public.notification_deliveries delivery
  WHERE delivery.id = target_delivery_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api';
  IF NOT FOUND OR target.notification_event_id <> locked_event_id THEN
    RETURN;
  END IF;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = target.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;

  IF target.status = 'failed' AND _status <> 'failed' THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  current_rank := CASE target.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'failed' THEN 2
    WHEN 'undeliverable' THEN 2 WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 ELSE 0 END;
  incoming_rank := CASE _status
    WHEN 'sent' THEN 1 WHEN 'failed' THEN 2 WHEN 'delivered' THEN 3 WHEN 'read' THEN 4 END;
  IF COALESCE(target.provider_response->>'whatsapp_status_occurred_at', '')
      ~ '^\d{4}-\d{2}-\d{2}T' THEN
    current_occurred_at := (target.provider_response->>'whatsapp_status_occurred_at')::timestamptz;
  END IF;

  IF (
       current_occurred_at IS NOT NULL
       AND (
         _occurred_at < current_occurred_at
         OR (_occurred_at = current_occurred_at AND incoming_rank <= current_rank)
       )
     ) OR incoming_rank < current_rank THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries delivery
  SET status = _status,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object(
          'whatsapp_status', _status,
          'whatsapp_status_occurred_at', _occurred_at,
          'whatsapp_status_provider_message_id', _provider_message_id
        ),
      sent_at = CASE WHEN _status='sent' THEN COALESCE(delivery.sent_at,_occurred_at) ELSE delivery.sent_at END,
      delivered_at = CASE WHEN _status='delivered' THEN COALESCE(delivery.delivered_at,_occurred_at) ELSE delivery.delivered_at END,
      read_at = CASE WHEN _status='read' THEN COALESCE(delivery.read_at,_occurred_at) ELSE delivery.read_at END,
      failed_at = CASE WHEN _status='failed' THEN COALESCE(delivery.failed_at,_occurred_at) ELSE delivery.failed_at END,
      error_code = CASE WHEN _status='failed' THEN 'meta_delivery_failed' ELSE NULL END,
      error_message = CASE WHEN _status='failed'
        THEN left(COALESCE(_error_message,'Meta informó de un fallo'),1000) ELSE NULL END
  WHERE delivery.id = target.id;

  UPDATE public.notification_delivery_attempts attempt
  SET last_status = _status,
      status_occurred_at = _occurred_at,
      error_code = CASE WHEN _status='failed' THEN 'meta_delivery_failed' ELSE attempt.error_code END,
      error_message = CASE WHEN _status='failed'
        THEN left(COALESCE(_error_message,'Meta informó de un fallo'),1000) ELSE attempt.error_message END
  WHERE attempt.delivery_id = target.id
    AND attempt.provider_message_id = _provider_message_id;

  SELECT EXISTS (
    SELECT 1 FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel='whatsapp' AND sibling.provider='meta_cloud_api'
      AND sibling.status IN ('sent','delivered','read')
  ) INTO successful_whatsapp;

  UPDATE public.notification_events event
  SET status = CASE
        WHEN event.status='cancelled' THEN 'cancelled'
        WHEN _status IN ('sent','delivered','read') THEN 'sent'
        WHEN successful_whatsapp THEN 'sent'
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id=target.notification_event_id
            AND fallback.channel='email'
            AND fallback.template_name='task_rejected_admin_fallback_email'
            AND fallback.status='sent'
        ) THEN 'sent'
        ELSE 'failed' END,
      processed_at = now(),
      error_message = CASE
        WHEN event.status='cancelled' OR _status IN ('sent','delivered','read') OR successful_whatsapp THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id=target.notification_event_id
            AND fallback.channel='email'
            AND fallback.template_name='task_rejected_admin_fallback_email'
            AND fallback.status='sent'
        ) THEN 'WhatsApp falló; correo de respaldo enviado'
        ELSE left(COALESCE(_error_message,'Meta informó de un fallo'),1000) END
  WHERE event.id = target.notification_event_id;

  RETURN QUERY SELECT target.id, target.notification_event_id, true, _status;
END;
$$;


ALTER FUNCTION "public"."apply_whatsapp_delivery_status"("_provider_message_id" "text", "_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_whatsapp_delivery_status"("_provider_message_id" "text", "_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") IS 'Aplica estados WhatsApp bajo bloqueo de fila, ignorando duplicados y transiciones regresivas.';



CREATE OR REPLACE FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_group public.property_groups%ROWTYPE;
  v_group_id uuid;
  v_locked_group_id uuid;
  v_candidate record;
  v_cleaner public.cleaners%ROWTYPE;
  v_day integer;
  v_count integer;
  v_reason text;
  v_score numeric;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '42501';
  END IF;
  IF coalesce(auth.role(), '') = 'authenticated' AND _actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Actor inválido' USING ERRCODE = '42501';
  END IF;

  -- Orden global compartido con IA: task antes de cualquier cleaner.
  SELECT * INTO v_task FROM public.tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para autoasignar en esta sede' USING ERRCODE = '42501';
  END IF;

  SELECT pga.property_group_id INTO v_group_id
  FROM public.property_group_assignments pga
  WHERE pga.property_id = v_task.propiedad_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Property not in enabled auto-assignment group');
  END IF;

  -- Segundo nivel: cleaners candidatos ordenados. Serializa la capacidad.
  PERFORM c.id
  FROM public.cleaner_group_assignments cga
  JOIN public.cleaners c ON c.id = cga.cleaner_id
  WHERE cga.property_group_id = v_group_id AND cga.is_active = true
  ORDER BY c.id
  FOR UPDATE OF c;

  -- Tercer nivel: property → property_group_assignment → property_group.
  SELECT * INTO v_property FROM public.properties p
  WHERE p.id = v_task.propiedad_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;
  SELECT pga.property_group_id INTO v_locked_group_id
  FROM public.property_group_assignments pga
  WHERE pga.property_id = v_property.id
  FOR UPDATE;
  IF NOT FOUND OR v_locked_group_id IS DISTINCT FROM v_group_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;
  SELECT * INTO v_group FROM public.property_groups pg
  WHERE pg.id = v_locked_group_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Auto-assignment configuration changed; retry');
  END IF;

  -- Revalidación autoritativa después de adquirir todos los locks.
  IF v_task.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'No se puede autoasignar una tarea cerrada' USING ERRCODE = '22023';
  END IF;
  IF v_task.cleaner_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = v_task.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Task already assigned');
  END IF;
  IF NOT v_property.is_active OR NOT v_group.is_active OR NOT v_group.auto_assign_enabled
     OR v_task.sede_id IS DISTINCT FROM v_property.sede_id THEN
    RAISE EXCEPTION 'La tarea cambió de propiedad/sede' USING ERRCODE = '40001';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, v_task.sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'El acceso a la sede cambió durante la autoasignación' USING ERRCODE = '42501';
  END IF;

  v_day := extract(dow FROM v_task.date)::integer;
  FOR v_candidate IN
    SELECT cga.cleaner_id, cga.priority, cga.max_tasks_per_day,
           coalesce(cga.estimated_travel_time_minutes, 0) AS travel
    FROM public.cleaner_group_assignments cga
    WHERE cga.property_group_id = v_group.id AND cga.is_active = true
    ORDER BY cga.priority, cga.cleaner_id
  LOOP
    SELECT * INTO v_cleaner FROM public.cleaners c WHERE c.id = v_candidate.cleaner_id;
    CONTINUE WHEN NOT FOUND OR NOT v_cleaner.is_active OR v_cleaner.sede_id IS DISTINCT FROM v_task.sede_id;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.cleaner_availability ca
      WHERE ca.cleaner_id = v_cleaner.id AND ca.day_of_week = v_day
        AND (NOT ca.is_available OR ca.start_time > v_task.start_time OR ca.end_time < v_task.end_time)
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_absences wa
      WHERE wa.cleaner_id = v_cleaner.id
        AND v_task.date BETWEEN wa.start_date AND wa.end_date
        AND (wa.start_time IS NULL OR (wa.start_time < v_task.end_time AND wa.end_time > v_task.start_time))
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_fixed_days_off wd
      WHERE wd.cleaner_id = v_cleaner.id AND wd.day_of_week = v_day AND wd.is_active
    );
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.worker_maintenance_cleanings wm
      WHERE wm.cleaner_id = v_cleaner.id AND wm.is_active AND v_day = ANY(wm.days_of_week)
        AND wm.start_time < v_task.end_time AND wm.end_time > v_task.start_time
    );

    WITH assigned_existing AS (
      SELECT ta.task_id FROM public.task_assignments ta WHERE ta.cleaner_id = v_cleaner.id
      UNION
      SELECT existing.id FROM public.tasks existing
      WHERE NOT EXISTS (SELECT 1 FROM public.task_assignments any_ta WHERE any_ta.task_id = existing.id)
        AND (existing.cleaner_id = v_cleaner.id OR (
          existing.cleaner_id IS NULL AND v_cleaner.name = ANY(regexp_split_to_array(coalesce(existing.cleaner, ''), '\s*,\s*'))
        ))
    )
    SELECT count(DISTINCT assigned.task_id) INTO v_count
    FROM assigned_existing assigned
    JOIN public.tasks existing ON existing.id = assigned.task_id
    WHERE true
      AND existing.date = v_task.date
      AND existing.id <> v_task.id
      AND coalesce(existing.status, 'pending') NOT IN ('completed', 'cancelled');
    CONTINUE WHEN v_count >= coalesce(v_candidate.max_tasks_per_day, 8);

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.tasks existing
      WHERE (
        EXISTS (SELECT 1 FROM public.task_assignments ta WHERE ta.task_id = existing.id AND ta.cleaner_id = v_cleaner.id)
        OR (NOT EXISTS (SELECT 1 FROM public.task_assignments any_ta WHERE any_ta.task_id = existing.id)
          AND (existing.cleaner_id = v_cleaner.id OR (
            existing.cleaner_id IS NULL AND v_cleaner.name = ANY(regexp_split_to_array(coalesce(existing.cleaner, ''), '\s*,\s*'))
          )))
      )
        AND existing.date = v_task.date
        AND existing.id <> v_task.id
        AND coalesce(existing.status, 'pending') NOT IN ('completed', 'cancelled')
        AND existing.start_time < (v_task.end_time + make_interval(mins => v_candidate.travel))::time
        AND (existing.end_time + make_interval(mins => v_candidate.travel))::time > v_task.start_time
    );

    v_score := 1000 - (v_candidate.priority * 100) + (coalesce(v_candidate.max_tasks_per_day, 8) - v_count);
    v_reason := format('priority-saturation: prioridad %s, carga %s/%s',
      v_candidate.priority, v_count, coalesce(v_candidate.max_tasks_per_day, 8));

    PERFORM public.set_task_assignments(v_task.id, ARRAY[v_cleaner.id]);
    UPDATE public.tasks SET auto_assigned = true, assignment_confidence = v_score, updated_at = now()
    WHERE id = v_task.id;
    INSERT INTO public.auto_assignment_logs(
      task_id, property_group_id, assigned_cleaner_id, algorithm_used,
      assignment_reason, confidence_score, was_manual_override
    ) VALUES (
      v_task.id, v_group.id, v_cleaner.id, 'priority-saturation-transactional-v5',
      v_reason, v_score, false
    );

    RETURN jsonb_build_object(
      'success', true, 'taskId', v_task.id, 'cleanerId', v_cleaner.id,
      'cleanerName', v_cleaner.name, 'confidence', v_score,
      'reason', v_reason, 'algorithm', 'priority-saturation-transactional-v5'
    );
  END LOOP;

  RETURN jsonb_build_object('success', false, 'taskId', v_task.id, 'reason', 'No available cleaners');
END;
$$;


ALTER FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") IS 'Bloquea task, cleaners y configuración en orden global, revalida disponibilidad completa y escribe asignación, metadata y log atómicamente.';



CREATE OR REPLACE FUNCTION "public"."batch_create_tasks_transactional"("_actor_id" "uuid", "_sede_id" "uuid", "_tasks" "jsonb", "_idempotency_key" "text", "_payload_hash" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_item jsonb;
  v_index integer := 0;
  v_property public.properties%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_cleaner_ids uuid[];
  v_all_cleaner_ids uuid[];
  v_valid_count integer;
  v_task_ids uuid[] := '{}'::uuid[];
  v_email_batches jsonb;
  v_request public.batch_task_creation_requests%ROWTYPE;
  v_result jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' OR _actor_id IS NULL THEN
    RAISE EXCEPTION 'Esta RPC solo puede ser invocada por el writer autenticado'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.writer_actor_can_access_sede(
    _actor_id, _sede_id, ARRAY['admin', 'manager', 'supervisor']::public.app_role[]
  ) THEN
    RAISE EXCEPTION 'No autorizado para crear tareas en esta sede' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_tasks) <> 'array' OR jsonb_array_length(_tasks) < 1 OR jsonb_array_length(_tasks) > 50 THEN
    RAISE EXCEPTION 'tasks debe contener entre 1 y 50 elementos' USING ERRCODE = '22023';
  END IF;
  IF nullif(trim(_idempotency_key), '') IS NULL OR length(_idempotency_key) > 200
     OR _payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Idempotency key/hash inválidos' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.batch_task_creation_requests(actor_id, sede_id, idempotency_key, payload_hash)
  VALUES (_actor_id, _sede_id, _idempotency_key, _payload_hash)
  ON CONFLICT (actor_id, idempotency_key) DO NOTHING;
  SELECT * INTO v_request FROM public.batch_task_creation_requests r
  WHERE r.actor_id = _actor_id AND r.idempotency_key = _idempotency_key FOR UPDATE;
  IF v_request.payload_hash IS DISTINCT FROM _payload_hash OR v_request.sede_id IS DISTINCT FROM _sede_id THEN
    RAISE EXCEPTION 'Idempotency key reutilizada con payload distinto' USING ERRCODE = '23505';
  END IF;
  IF v_request.status = 'completed' AND v_request.result IS NOT NULL THEN
    RETURN v_request.result || jsonb_build_object('idempotentReplay', true);
  END IF;

  -- Estas tasks aún no existen: bloquea todos los cleaners y después todas las
  -- properties por UUID antes de procesar el lote.
  SELECT coalesce(array_agg(DISTINCT raw::uuid ORDER BY raw::uuid), '{}'::uuid[])
  INTO v_all_cleaner_ids
  FROM jsonb_array_elements(_tasks) item
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(item->'cleanerIds', '[]'::jsonb)) raw
  WHERE nullif(trim(raw), '') IS NOT NULL;
  PERFORM c.id FROM public.cleaners c
  WHERE c.id = ANY(v_all_cleaner_ids)
  ORDER BY c.id
  FOR KEY SHARE;
  PERFORM p.id FROM public.properties p
  JOIN (
    SELECT DISTINCT nullif(item->>'propertyId', '')::uuid AS property_id
    FROM jsonb_array_elements(_tasks) item
  ) ids ON ids.property_id = p.id
  ORDER BY p.id
  FOR KEY SHARE OF p;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_tasks)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Elemento de tarea inválido en índice %', v_index USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_property
    FROM public.properties p
    WHERE p.id = nullif(v_item->>'propertyId', '')::uuid;
    IF NOT FOUND OR v_property.sede_id IS DISTINCT FROM _sede_id OR v_property.is_active = false THEN
      RAISE EXCEPTION 'Propiedad inválida o fuera de sede en índice %', v_index USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[]) INTO v_cleaner_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM jsonb_array_elements_text(coalesce(v_item->'cleanerIds', '[]'::jsonb)) WITH ORDINALITY x(raw, ord)
      CROSS JOIN LATERAL (SELECT nullif(trim(raw), '')::uuid AS id) parsed
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) deduped;

    SELECT count(*) INTO v_valid_count
    FROM public.cleaners c
    WHERE c.id = ANY(v_cleaner_ids)
      AND c.is_active = true
      AND c.sede_id = _sede_id;
    IF v_valid_count <> cardinality(v_cleaner_ids) THEN
      RAISE EXCEPTION 'Trabajador inválido, inactivo o fuera de sede en índice %', v_index USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.tasks (
      property, address, date, start_time, end_time, type, status,
      check_in, check_out, cliente_id, propiedad_id, duracion, coste,
      metodo_pago, supervisor, sede_id
    ) VALUES (
      v_property.nombre,
      v_property.direccion,
      (v_item->>'date')::date,
      (v_item->>'startTime')::time,
      (v_item->>'endTime')::time,
      coalesce(nullif(v_item->>'type', ''), 'limpieza-turistica'),
      coalesce(nullif(v_item->>'status', ''), 'pending'),
      coalesce(nullif(v_item->>'checkIn', '')::time, v_property.check_in_predeterminado),
      coalesce(nullif(v_item->>'checkOut', '')::time, v_property.check_out_predeterminado),
      v_property.cliente_id,
      v_property.id,
      coalesce(nullif(v_item->>'duration', '')::integer, v_property.duracion_servicio),
      coalesce(nullif(v_item->>'cost', '')::numeric, v_property.coste_servicio),
      nullif(v_item->>'paymentMethod', ''),
      nullif(v_item->>'supervisor', ''),
      _sede_id
    ) RETURNING * INTO v_task;

    IF v_task.end_time <= v_task.start_time THEN
      RAISE EXCEPTION 'Horario inválido en índice %', v_index USING ERRCODE = '22023';
    END IF;

    IF cardinality(v_cleaner_ids) > 0 THEN
      INSERT INTO public.task_assignments(task_id, cleaner_id, cleaner_name, assigned_by)
      SELECT v_task.id, c.id, c.name, _actor_id
      FROM unnest(v_cleaner_ids) WITH ORDINALITY ids(id, ord)
      JOIN public.cleaners c ON c.id = ids.id
      ORDER BY ids.ord;

      UPDATE public.tasks t SET
        cleaner_id = v_cleaner_ids[1],
        cleaner = (
          SELECT string_agg(c.name, ', ' ORDER BY ids.ord)
          FROM unnest(v_cleaner_ids) WITH ORDINALITY ids(id, ord)
          JOIN public.cleaners c ON c.id = ids.id
        ),
        updated_at = now()
      WHERE t.id = v_task.id;
      -- El trigger de task_assignments crea el notification_events/outbox en esta transacción.
    END IF;

    v_task_ids := array_append(v_task_ids, v_task.id);
    v_index := v_index + 1;
  END LOOP;

  SELECT coalesce(jsonb_agg(batch ORDER BY batch->>'cleanerId'), '[]'::jsonb)
  INTO v_email_batches
  FROM (
    SELECT jsonb_build_object(
      'cleanerId', c.id,
      'cleanerName', c.name,
      'email', c.email,
      'tasks', jsonb_agg(jsonb_build_object(
        'taskId', t.id,
        'property', t.property,
        'address', t.address,
        'date', t.date,
        'startTime', t.start_time,
        'endTime', t.end_time
      ) ORDER BY t.date, t.start_time, t.id)
    ) AS batch
    FROM public.task_assignments ta
    JOIN public.tasks t ON t.id = ta.task_id
    JOIN public.cleaners c ON c.id = ta.cleaner_id
    WHERE ta.task_id = ANY(v_task_ids) AND nullif(trim(c.email), '') IS NOT NULL
    GROUP BY c.id, c.name, c.email
  ) batches;

  v_result := jsonb_build_object(
    'success', true,
    'created', cardinality(v_task_ids),
    'taskIds', to_jsonb(v_task_ids),
    'emailBatches', v_email_batches,
    'requestId', v_request.id,
    'idempotentReplay', false
  );
  INSERT INTO public.batch_task_email_deliveries(request_id, cleaner_id, recipient, idempotency_key)
  SELECT v_request.id, (batch->>'cleanerId')::uuid, batch->>'email',
         'batch-task-email/' || v_request.id::text || '/' || (batch->>'cleanerId')
  FROM jsonb_array_elements(v_email_batches) batch
  ON CONFLICT (request_id, cleaner_id) DO NOTHING;
  UPDATE public.batch_task_creation_requests
  SET status = 'completed', result = v_result, completed_at = now() WHERE id = v_request.id;
  RETURN v_result;
END;
$_$;


ALTER FUNCTION "public"."batch_create_tasks_transactional"("_actor_id" "uuid", "_sede_id" "uuid", "_tasks" "jsonb", "_idempotency_key" "text", "_payload_hash" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."batch_create_tasks_transactional"("_actor_id" "uuid", "_sede_id" "uuid", "_tasks" "jsonb", "_idempotency_key" "text", "_payload_hash" "text") IS 'Crea el lote exactamente una vez por actor/key/payload, con asignaciones, outbox y estado durable de email en una transacción.';



CREATE OR REPLACE FUNCTION "public"."begin_supervision_stock_check"("_warehouse_id" "uuid", "_property_group_id" "uuid", "_scheduled_date" "date", "_check_type" "text" DEFAULT 'inventory'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  check_id UUID;
BEGIN
  IF NOT public.supervision_stock_warehouse_can_access(_warehouse_id) THEN
    RAISE EXCEPTION 'stock warehouse access denied';
  END IF;
  IF _check_type NOT IN ('restock', 'inventory') THEN RAISE EXCEPTION 'invalid stock check type'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_warehouses w
    WHERE w.id = _warehouse_id
      AND w.property_group_id IS NOT DISTINCT FROM _property_group_id
  ) THEN RAISE EXCEPTION 'warehouse and building do not match'; END IF;

  INSERT INTO public.supervision_stock_checks (warehouse_id, property_group_id, scheduled_date, check_type, status, checked_by, started_at)
  VALUES (_warehouse_id, _property_group_id, _scheduled_date, _check_type, 'in_progress', auth.uid(), now())
  ON CONFLICT (warehouse_id, scheduled_date, check_type) DO UPDATE SET
    status = CASE WHEN supervision_stock_checks.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
    checked_by = COALESCE(supervision_stock_checks.checked_by, auth.uid()),
    started_at = COALESCE(supervision_stock_checks.started_at, now()),
    updated_at = now()
  RETURNING id INTO check_id;

  IF check_id IS NULL THEN
    SELECT id INTO check_id FROM public.supervision_stock_checks
    WHERE warehouse_id = _warehouse_id AND scheduled_date = _scheduled_date AND check_type = _check_type;
  END IF;

  INSERT INTO public.supervision_stock_check_lines (check_id, stock_level_id, product_id, expected_quantity, observed_quantity, difference)
  SELECT check_id, l.id, l.product_id, l.target_quantity, l.current_quantity, 0
  FROM public.stock_levels l
  WHERE l.warehouse_id = _warehouse_id
  ON CONFLICT (check_id, stock_level_id) DO NOTHING;
  RETURN check_id;
END;
$$;


ALTER FUNCTION "public"."begin_supervision_stock_check"("_warehouse_id" "uuid", "_property_group_id" "uuid", "_scheduled_date" "date", "_check_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  fallback public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT * INTO fallback FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _notification_event_id
  FOR UPDATE;

  IF fallback.id IS NULL
     OR fallback.channel <> 'email'
     OR fallback.provider <> 'resend'
     OR fallback.template_name <> 'task_rejected_admin_fallback_email'
     OR fallback.status <> 'queued'
     OR fallback.provider_message_id IS NOT NULL
     OR (fallback.provider_response->>'fallback_claim_token')::uuid IS DISTINCT FROM _claim_token THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = _notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status IN ('queued', 'sent', 'delivered', 'read')
      AND (
        whatsapp.status <> 'queued'
        OR whatsapp.provider_payload->>'send_started_at' IS NOT NULL
        OR whatsapp.error_code = 'reconciliation_required'
      )
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.notification_deliveries
  SET provider_response = COALESCE(provider_response, '{}'::jsonb)
      || jsonb_build_object(
        'fallback_send_started_at', COALESCE(
          provider_response->'fallback_send_started_at',
          to_jsonb(now())
        ),
        'fallback_attempt_state', 'contacting_resend'
      ),
      error_code = NULL,
      error_message = NULL
  WHERE id = _delivery_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."begin_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_whatsapp_send_attempt"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_attempt_token" "uuid", "_provider_payload" "jsonb") RETURNS TABLE("attempt_id" "uuid", "attempt_token" "uuid", "attempt_no" integer, "claimed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  existing_attempt public.notification_delivery_attempts%ROWTYPE;
  created_attempt public.notification_delivery_attempts%ROWTYPE;
  next_attempt_no integer;
  legacy_attempt_count integer;
BEGIN
  IF _attempt_token IS NULL OR _lease_token IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_tokens_required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = _delivery_id AND notification_event_id = _event_id;

  IF event_row.id IS NULL OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token
     OR delivery_row.id IS NULL OR delivery_row.channel <> 'whatsapp'
     OR delivery_row.provider <> 'meta_cloud_api'
     OR delivery_row.status <> 'queued' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::integer, false;
    RETURN;
  END IF;

  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT attempt.* INTO existing_attempt
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id
    AND attempt.state = 'contacting_meta'
  ORDER BY attempt.attempt_no DESC LIMIT 1;
  IF existing_attempt.id IS NOT NULL THEN
    RETURN QUERY SELECT existing_attempt.id, existing_attempt.claim_token,
      existing_attempt.attempt_no::integer, false;
    RETURN;
  END IF;

  legacy_attempt_count := COALESCE((delivery_row.provider_payload->>'meta_attempt_count')::integer, 0);
  SELECT GREATEST(COALESCE(max(attempt.attempt_no), 0), legacy_attempt_count) + 1
  INTO next_attempt_no
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = _delivery_id;

  IF next_attempt_no >= 2 AND next_attempt_no > 2 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;
  IF next_attempt_no = 2 AND NOT (
    delivery_row.provider_payload->>'meta_attempt_state' = 'retry_authorized'
    AND legacy_attempt_count = 1
  ) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;
  IF next_attempt_no = 1 AND COALESCE(delivery_row.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, next_attempt_no, false;
    RETURN;
  END IF;

  INSERT INTO public.notification_delivery_attempts (
    delivery_id, attempt_no, claim_token, event_lease_token, state,
    provider_response, started_at
  ) VALUES (
    _delivery_id, next_attempt_no, _attempt_token, _lease_token,
    'contacting_meta', '{}'::jsonb, now()
  ) RETURNING * INTO created_attempt;

  UPDATE public.notification_deliveries delivery
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
    || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
    || CASE
      WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
      WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
      ELSE '{}'::jsonb
    END
    || jsonb_build_object(
      'first_send_started_at', COALESCE(
        delivery.provider_payload->'first_send_started_at', to_jsonb(created_attempt.started_at)
      ),
      'send_started_at', created_attempt.started_at,
      'meta_attempt_count', next_attempt_no,
      'meta_attempt_state', 'contacting_meta',
      'send_lease_token', _lease_token,
      'send_attempt_id', created_attempt.id,
      'retry_risk_policy', CASE WHEN next_attempt_no = 2
        THEN 'prioritize_delivery' ELSE 'none' END
    ), error_code = NULL,
    error_message = CASE WHEN next_attempt_no = 2
      THEN 'Ejecutando reintento WhatsApp 2/2; riesgo excepcional de duplicado aceptado'
      ELSE NULL END
  WHERE delivery.id = _delivery_id;

  RETURN QUERY SELECT created_attempt.id, created_attempt.claim_token,
    created_attempt.attempt_no::integer, true;
END;
$$;


ALTER FUNCTION "public"."begin_whatsapp_send_attempt"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_attempt_token" "uuid", "_provider_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."begin_whatsapp_send_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_provider_payload" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  attempt_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN RETURN false; END IF;

  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = _delivery_id AND notification_event_id = _event_id FOR UPDATE;
  IF delivery.id IS NULL OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api' OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL THEN
    RETURN false;
  END IF;

  attempt_count := COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 0);
  IF NOT (
    (NOT (COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at') AND attempt_count = 0)
    OR (
      delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
      AND attempt_count = 1
    )
  ) THEN RETURN false; END IF;

  UPDATE public.notification_deliveries
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
    || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
    || CASE
      WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
      WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
      ELSE '{}'::jsonb
    END
    || jsonb_build_object(
      'first_send_started_at', COALESCE(
        delivery.provider_payload->'first_send_started_at',
        delivery.provider_payload->'send_started_at',
        to_jsonb(now())
      ),
      'send_started_at', now(),
      'meta_attempt_count', LEAST(attempt_count + 1, 2),
      'meta_attempt_state', 'contacting_meta',
      'send_lease_token', _lease_token,
      'retry_risk_policy', CASE WHEN attempt_count = 1
        THEN 'prioritize_delivery'
        ELSE COALESCE(delivery.provider_payload->>'retry_risk_policy', 'none') END
    ),
    error_code = NULL,
    error_message = CASE WHEN attempt_count = 1
      THEN 'Ejecutando reintento WhatsApp 2/2; riesgo excepcional de duplicado aceptado'
      ELSE NULL END
  WHERE id = _delivery_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."begin_whatsapp_send_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_provider_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bind_whatsapp_delivery_from_button"("_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  candidate_ids uuid[];
  target_delivery_id uuid;
  target_attempt_id uuid;
  locked_event_id uuid;
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  normalized_sender text;
BEGIN
  normalized_sender:=regexp_replace(COALESCE(_sender,''),'[^0-9]','','g');
  IF COALESCE(btrim(_source_provider_message_id),'')='' OR normalized_sender=''
     OR COALESCE(btrim(_button_payload),'')='' THEN RETURN NULL; END IF;
  SELECT attempt.delivery_id INTO target_delivery_id FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id=_source_provider_message_id;
  IF target_delivery_id IS NULL THEN
    SELECT delivery.id INTO target_delivery_id FROM public.notification_deliveries delivery
    WHERE delivery.channel='whatsapp' AND delivery.provider='meta_cloud_api'
      AND delivery.provider_message_id=_source_provider_message_id;
  END IF;
  IF target_delivery_id IS NULL THEN
    SELECT array_agg(DISTINCT delivery.id ORDER BY delivery.id) INTO candidate_ids
    FROM public.notification_deliveries delivery
    JOIN public.notification_delivery_attempts attempt ON attempt.delivery_id=delivery.id
    WHERE delivery.channel='whatsapp' AND delivery.provider='meta_cloud_api'
      AND delivery.status IN ('queued','sent','delivered','read')
      AND regexp_replace(delivery.recipient,'[^0-9]','','g')=normalized_sender
      AND COALESCE(delivery.provider_payload->'buttonPayloads','[]'::jsonb)?_button_payload;
    IF cardinality(COALESCE(candidate_ids,'{}'::uuid[]))=1 THEN target_delivery_id:=candidate_ids[1]; END IF;
  END IF;
  IF target_delivery_id IS NULL THEN RETURN NULL; END IF;
  SELECT notification_event_id INTO locked_event_id FROM public.notification_deliveries WHERE id=target_delivery_id;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(locked_event_id::text,20260720));
  SELECT * INTO event_row FROM public.notification_events event
  WHERE event.id=locked_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id=locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries delivery
  WHERE delivery.id=target_delivery_id AND delivery.notification_event_id=locked_event_id;
  IF delivery_row.id IS NULL THEN RETURN NULL; END IF;
  PERFORM 1 FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id=target_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts attempt
                 WHERE attempt.provider_message_id=_source_provider_message_id) THEN
    SELECT attempt.id INTO target_attempt_id FROM public.notification_delivery_attempts attempt
    WHERE attempt.delivery_id=target_delivery_id AND attempt.provider_message_id IS NULL
    ORDER BY attempt.attempt_no, attempt.id LIMIT 1;
    IF target_attempt_id IS NOT NULL THEN
      UPDATE public.notification_delivery_attempts SET
        provider_message_id=_source_provider_message_id, correlation_source='button_callback',
        state='callback_observed', last_status='sent', status_occurred_at=now()
      WHERE id=target_attempt_id;
    END IF;
  END IF;
  UPDATE public.notification_deliveries delivery SET
    provider_message_id=_source_provider_message_id,
    status=CASE WHEN delivery.status='queued' THEN 'sent' ELSE delivery.status END,
    sent_at=COALESCE(delivery.sent_at,now()), error_code=NULL,error_message=NULL,
    provider_response=COALESCE(delivery.provider_response,'{}'::jsonb)
      ||jsonb_build_object('reconciled_from_attempt_button',true)
  WHERE delivery.id=target_delivery_id;
  UPDATE public.notification_events event SET
    status=CASE WHEN event.status='cancelled' THEN 'cancelled' ELSE 'sent' END,
    processed_at=now(),error_message=CASE WHEN event.status='cancelled' THEN event.error_message ELSE NULL END
  WHERE event.id=locked_event_id;
  RETURN target_delivery_id;
EXCEPTION WHEN unique_violation THEN
  SELECT attempt.delivery_id INTO target_delivery_id FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id=_source_provider_message_id;
  RETURN target_delivery_id;
END;
$$;


ALTER FUNCTION "public"."bind_whatsapp_delivery_from_button"("_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bind_whatsapp_delivery_from_status"("_provider_message_id" "text", "_recipient" "text", "_occurred_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target_delivery_id uuid;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' OR _occurred_at IS NULL THEN
    RETURN NULL;
  END IF;

  -- _recipient se conserva por compatibilidad de firma, pero nunca participa en
  -- la correlación. Un ID desconocido permanece unmatched en webhook_inbox.
  SELECT attempt.delivery_id INTO target_delivery_id
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.provider_message_id = _provider_message_id;

  IF target_delivery_id IS NULL THEN
    SELECT delivery.id INTO target_delivery_id
    FROM public.notification_deliveries delivery
    WHERE delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.provider_message_id = _provider_message_id;
  END IF;

  RETURN target_delivery_id;
END;
$$;


ALTER FUNCTION "public"."bind_whatsapp_delivery_from_status"("_provider_message_id" "text", "_recipient" "text", "_occurred_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_recurring_task_state_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.state_revision := OLD.state_revision + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."bump_recurring_task_state_revision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_task_planning_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['planning_version','updated_at','approval_status','approval_requested_at','approved_at','rejected_at','approval_response_source','approval_rejection_reason','last_approval_reminder_at','late_start_reminder_sent_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['planning_version','updated_at','approval_status','approval_requested_at','approved_at','rejected_at','approval_response_source','approval_rejection_reason','last_approval_reminder_at','late_start_reminder_sent_at']) THEN
    NEW.planning_version := OLD.planning_version + 1;
  ELSE
    NEW.planning_version := OLD.planning_version;
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."bump_task_planning_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("check_identifier" "text", "check_action_type" "text", "max_attempts" integer DEFAULT 5, "window_minutes" integer DEFAULT 15, "block_minutes" integer DEFAULT 15) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_record RECORD;
    window_start TIMESTAMP WITH TIME ZONE;
    block_until TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validar parámetros de entrada
    IF check_identifier IS NULL OR trim(check_identifier) = '' THEN
        RAISE EXCEPTION 'identifier es requerido';
    END IF;
    
    IF check_action_type IS NULL OR trim(check_action_type) = '' THEN
        RAISE EXCEPTION 'action_type es requerido';
    END IF;
    
    window_start := now() - (window_minutes || ' minutes')::INTERVAL;
    
    -- Get or create rate limit record
    SELECT * INTO current_record
    FROM public.security_rate_limits
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- Check if currently blocked
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > now() THEN
        RETURN FALSE;
    END IF;
    
    -- Reset if outside window
    IF current_record.first_attempt_at IS NULL OR current_record.first_attempt_at < window_start THEN
        UPDATE public.security_rate_limits
        SET 
            attempt_count = 1,
            first_attempt_at = now(),
            last_attempt_at = now(),
            blocked_until = NULL,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        RETURN TRUE;
    END IF;
    
    -- Check if exceeded limits
    IF current_record.attempt_count >= max_attempts THEN
        block_until := now() + (block_minutes || ' minutes')::INTERVAL;
        
        UPDATE public.security_rate_limits
        SET 
            blocked_until = block_until,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        
        -- Log security event
        PERFORM public.log_security_event('rate_limit_exceeded', jsonb_build_object(
            'identifier', check_identifier,
            'action_type', check_action_type,
            'attempt_count', current_record.attempt_count,
            'blocked_until', block_until
        ));
        
        RETURN FALSE;
    END IF;
    
    -- Increment attempt count
    UPDATE public.security_rate_limits
    SET 
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO public.security_rate_limits (
            identifier,
            action_type,
            attempt_count,
            first_attempt_at,
            last_attempt_at
        ) VALUES (
            check_identifier,
            check_action_type,
            1,
            now(),
            now()
        );
    END IF;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("check_identifier" "text", "check_action_type" "text", "max_attempts" integer, "window_minutes" integer, "block_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_bounded_whatsapp_retry"("_event_id" "uuid", "_lease_token" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  stale_attempt public.notification_delivery_attempts%ROWTYPE;
  recovering_authorized boolean := false;
  attempt_count integer := 0;
BEGIN
  IF _lease_token IS NULL THEN
    RAISE EXCEPTION 'whatsapp_retry_lease_required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row
  FROM public.notification_events event
  WHERE event.id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL OR NOT (
    event_row.status = 'failed'
    OR (
      event_row.status = 'processing'
      AND event_row.processed_at < now() - interval '10 minutes'
    )
  ) THEN
    RETURN NULL;
  END IF;

  -- Orden global Meta: advisory(event) -> event -> deliveries(id) ->
  -- attempts(attempt_no,id). Se bloquean también siblings/fallback antes de
  -- evaluar exclusión para que ningún writer observe una mezcla de versiones.
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT delivery.* INTO delivery_row
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _event_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.status = 'queued'
  ORDER BY delivery.created_at DESC
  LIMIT 1;
  IF delivery_row.id IS NULL OR delivery_row.provider_message_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN
    RETURN NULL;
  END IF;

  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;

  SELECT count(*)::integer INTO attempt_count
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id;

  SELECT attempt.* INTO stale_attempt
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
    AND attempt.state = 'contacting_meta'
    AND attempt.started_at <= now() - interval '15 minutes'
    AND (
      event_row.status = 'failed'
      OR attempt.event_lease_token = event_row.processing_lease_token
    )
  ORDER BY attempt.attempt_no DESC
  LIMIT 1;

  IF stale_attempt.id IS NOT NULL THEN
    UPDATE public.notification_delivery_attempts attempt
    SET state = 'completed_uncertain',
        finalized_at = now(),
        error_code = 'worker_crash_recovered',
        error_message = 'Worker abandonado después de begin; resultado Meta incierto',
        provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
          || jsonb_build_object('worker_crash_recovered_at', now())
    WHERE attempt.id = stale_attempt.id
      AND attempt.state = 'contacting_meta';

    UPDATE public.notification_deliveries delivery
    SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
          || jsonb_build_object('meta_attempt_state', 'completed_uncertain'),
        error_code = 'reconciliation_required',
        error_message = 'Worker abandonado después de begin; resultado Meta incierto'
    WHERE delivery.id = delivery_row.id;
    delivery_row.provider_payload := COALESCE(delivery_row.provider_payload, '{}'::jsonb)
      || jsonb_build_object('meta_attempt_state', 'completed_uncertain');
    delivery_row.error_code := 'reconciliation_required';
  END IF;

  -- El presupuesto ya se consumió por completo. La llamada queda visible como
  -- incierta y el sender cerrará el evento sin contactar Meta por tercera vez.
  IF attempt_count >= 2 THEN
    RETURN NULL;
  END IF;

  recovering_authorized := delivery_row.error_code = 'bounded_retry_authorized'
    AND delivery_row.provider_payload->>'meta_attempt_state' = 'retry_authorized'
    AND delivery_row.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
    AND event_row.status = 'processing'
    AND event_row.processed_at < now() - interval '10 minutes';

  IF attempt_count <> 1
     OR COALESCE((delivery_row.provider_payload->>'meta_attempt_count')::integer, 1) <> 1
     OR NOT (
       recovering_authorized
       OR (
         delivery_row.error_code = 'reconciliation_required'
         AND delivery_row.provider_payload->>'meta_attempt_state' = 'completed_uncertain'
         AND (delivery_row.provider_payload->>'send_started_at')::timestamptz
           <= now() - interval '15 minutes'
       )
     ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.notification_events event
  SET status = 'processing', processed_at = now(), processing_lease_token = _lease_token,
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado tras expirar el worker anterior'
        ELSE 'Reintento WhatsApp 2/2 autorizado: política priorizar entrega' END
  WHERE event.id = _event_id;

  UPDATE public.notification_deliveries delivery
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'meta_attempt_state', 'retry_authorized',
          'retry_authorized_at', COALESCE(
            delivery.provider_payload->'retry_authorized_at', to_jsonb(now())
          ),
          'retry_recovered_at', CASE WHEN recovering_authorized THEN to_jsonb(now()) ELSE NULL END,
          'retry_risk_policy', 'prioritize_delivery'
        )),
      error_code = 'bounded_retry_authorized',
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado; existe riesgo excepcional de duplicado'
        ELSE 'Reintento WhatsApp 2/2 autorizado; existe riesgo excepcional de duplicado' END
  WHERE delivery.id = delivery_row.id;

  RETURN delivery_row.id;
END;
$$;


ALTER FUNCTION "public"."claim_bounded_whatsapp_retry"("_event_id" "uuid", "_lease_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_notification_send_reconciliation_actions"("_limit" integer DEFAULT 20) RETURNS TABLE("action_id" "uuid", "delivery_id" "uuid", "notification_event_id" "uuid", "channel" "text", "resolution" "text", "provider_message_id" "text", "claim_token" "uuid", "action_status" "text", "force_email_fallback" boolean, "fallback_whatsapp_delivery_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Si la ejecución externa quedó incierta más allá de la ventana conservadora
  -- de idempotencia de Resend, vuelve a revisión humana y jamás se auto-reenvía.
  UPDATE public.notification_send_reconciliation_actions action
  SET status = 'failed',
      completed_at = now(),
      result_detail = 'Ventana idempotente agotada; comprobar Resend antes de solicitar otra resolución'
  FROM public.notification_deliveries delivery
  WHERE delivery.id = action.delivery_id
    AND action.status = 'effect_pending'
    AND (
      delivery.provider_response->>'fallback_send_started_at' IS NULL
      OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
        <= now() - interval '23 hours'
    )
    AND action.processing_started_at < now() - interval '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT action.id
    FROM public.notification_send_reconciliation_actions action
    JOIN public.notification_deliveries delivery ON delivery.id = action.delivery_id
    WHERE action.status = 'pending'
       OR (action.status = 'processing' AND action.processing_started_at < now() - interval '10 minutes')
       OR (
         action.status = 'effect_pending'
         AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
         AND (delivery.provider_response->>'fallback_send_started_at')::timestamptz
           > now() - interval '23 hours'
         AND action.processing_started_at < now() - interval '10 minutes'
       )
    ORDER BY action.requested_at
    LIMIT GREATEST(1, LEAST(_limit, 50))
    FOR UPDATE OF action SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_send_reconciliation_actions action
    SET status = CASE WHEN action.status = 'effect_pending' THEN 'effect_pending' ELSE 'processing' END,
        processing_started_at = now(),
        claim_token = gen_random_uuid(),
        attempts = action.attempts + 1,
        result_detail = NULL
    FROM candidates
    WHERE action.id = candidates.id
    RETURNING action.*
  )
  SELECT claimed.id, claimed.delivery_id, claimed.notification_event_id,
    claimed.channel, claimed.resolution, claimed.provider_message_id, claimed.claim_token,
    claimed.status,
    claimed.status = 'effect_pending',
    claimed.fallback_whatsapp_delivery_id
  FROM claimed;
END;
$$;


ALTER FUNCTION "public"."claim_notification_send_reconciliation_actions"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_supervision_daily_report"("_report_date" "date", "_email_to" "text", "_route_count" integer) RETURNS TABLE("claimed" boolean, "claim_token" "uuid", "reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_run public.supervision_daily_report_runs;
  next_token UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.supervision_daily_report_runs (
    report_date, status, claim_token, email_to, route_count, started_at, updated_at
  ) VALUES (
    _report_date, 'sending', next_token, _email_to, GREATEST(_route_count, 0), now(), now()
  )
  ON CONFLICT (report_date) DO NOTHING;

  SELECT * INTO current_run
  FROM public.supervision_daily_report_runs
  WHERE report_date = _report_date
  FOR UPDATE;

  IF current_run.status = 'sent' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'report already sent for date';
    RETURN;
  END IF;

  IF current_run.status = 'sending'
     AND current_run.started_at > now() - INTERVAL '30 minutes' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'report send already claimed';
    RETURN;
  END IF;

  UPDATE public.supervision_daily_report_runs
  SET status = 'sending',
      claim_token = next_token,
      email_to = _email_to,
      route_count = GREATEST(_route_count, 0),
      started_at = now(),
      updated_at = now(),
      error_message = NULL
  WHERE id = current_run.id;

  RETURN QUERY SELECT TRUE, next_token, 'claimed';
END;
$$;


ALTER FUNCTION "public"."claim_supervision_daily_report"("_report_date" "date", "_email_to" "text", "_route_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_whatsapp_admin_fallback"("_notification_event_id" "uuid", "_recipient" "text", "_trigger_error" "text") RETURNS TABLE("delivery_id" "uuid", "claimed" boolean, "delivery_status" "text", "provider_message_id" "text", "error_message" "text", "claim_token" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  claimed_row public.notification_deliveries%ROWTYPE;
  existing public.notification_deliveries%ROWTYPE;
  new_claim_token uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF _recipient IS NULL OR btrim(_recipient) = '' THEN
    RAISE EXCEPTION 'fallback_recipient_required' USING ERRCODE = '22023';
  END IF;

  -- Este es el punto linealizable de decisión: si una delivery WhatsApp hermana
  -- ya tuvo éxito, no se autoriza ningún efecto externo de Resend. Las RPC que
  -- aplican/finalizan WhatsApp usan exactamente la misma exclusión por evento.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT delivery.* INTO existing
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _notification_event_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.status IN ('sent', 'delivered', 'read')
  ORDER BY delivery.created_at DESC
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, 'whatsapp_succeeded'::text,
      existing.provider_message_id, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  -- Un POST iniciado sin resultado conciliado significa que Meta pudo aceptar
  -- el mensaje. No autorizamos otro canal hasta conocer su resultado.
  IF EXISTS (
    SELECT 1
    FROM public.notification_deliveries delivery
    WHERE delivery.notification_event_id = _notification_event_id
      AND delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.status = 'queued'
      AND (
        delivery.provider_payload->>'send_started_at' IS NOT NULL
        OR delivery.error_code = 'reconciliation_required'
      )
  ) THEN
    RETURN QUERY SELECT NULL::uuid, false, 'whatsapp_in_flight'::text,
      NULL::text, 'WhatsApp pendiente de conciliación'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.notification_deliveries (
    notification_event_id,
    channel,
    provider,
    recipient,
    template_name,
    status,
    provider_payload,
    provider_response
  ) VALUES (
    _notification_event_id,
    'email',
    'resend',
    _recipient,
    'task_rejected_admin_fallback_email',
    'queued',
    jsonb_build_object('triggerError', _trigger_error),
    jsonb_build_object(
      'fallback_claimed_at', now(),
      'fallback_attempt_count', 1,
      'fallback_claim_token', new_claim_token,
      'fallback_attempt_state', 'claimed'
    )
  )
  ON CONFLICT (notification_event_id)
    WHERE channel = 'email'
      AND template_name = 'task_rejected_admin_fallback_email'
  DO UPDATE SET
    status = 'queued',
    recipient = EXCLUDED.recipient,
    provider_payload = EXCLUDED.provider_payload,
    provider_response = COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb)
      || jsonb_build_object(
        'fallback_claimed_at', now(),
        'fallback_attempt_count',
          COALESCE((public.notification_deliveries.provider_response->>'fallback_attempt_count')::integer, 0) + 1,
        'fallback_claim_token', new_claim_token,
        'fallback_attempt_state', 'claimed'
      ),
    provider_message_id = NULL,
    error_code = NULL,
    error_message = NULL,
    sent_at = NULL,
    failed_at = NULL
  WHERE (
      public.notification_deliveries.status = 'failed'
      AND (
        NOT (COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb) ? 'fallback_send_started_at')
        OR (public.notification_deliveries.provider_response->>'fallback_send_started_at')::timestamptz
          > now() - interval '23 hours'
      )
    )
     OR (
       public.notification_deliveries.status = 'queued'
       AND public.notification_deliveries.provider_message_id IS NULL
       AND (public.notification_deliveries.provider_response->>'fallback_claimed_at')::timestamptz
         < now() - interval '10 minutes'
       AND (
         NOT (COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb) ? 'fallback_send_started_at')
         OR (
           (public.notification_deliveries.provider_response->>'fallback_send_started_at')::timestamptz
             > now() - interval '23 hours'
           AND public.notification_deliveries.provider_response->>'fallback_attempt_state'
             IN ('contacting_resend', 'reconciliation_required')
         )
       )
     )
  RETURNING public.notification_deliveries.* INTO claimed_row;

  IF claimed_row.id IS NOT NULL THEN
    RETURN QUERY SELECT claimed_row.id, true, claimed_row.status,
      claimed_row.provider_message_id, claimed_row.error_message,
      (claimed_row.provider_response->>'fallback_claim_token')::uuid;
    RETURN;
  END IF;

  SELECT delivery.* INTO existing
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _notification_event_id
    AND delivery.channel = 'email'
    AND delivery.template_name = 'task_rejected_admin_fallback_email';

  RETURN QUERY SELECT existing.id, false, existing.status,
    existing.provider_message_id, existing.error_message, NULL::uuid;
END;
$$;


ALTER FUNCTION "public"."claim_whatsapp_admin_fallback"("_notification_event_id" "uuid", "_recipient" "text", "_trigger_error" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_whatsapp_admin_fallback"("_notification_event_id" "uuid", "_recipient" "text", "_trigger_error" "text") IS 'Reclama de forma atómica el email de respaldo de un rechazo WhatsApp y permite reintentos seguros.';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_webhook_inbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "callback_key" "text" NOT NULL,
    "callback_kind" "text" NOT NULL,
    "provider_message_id" "text" NOT NULL,
    "whatsapp_message_id" "text",
    "sender" "text",
    "button_payload" "text",
    "action" "text",
    "task_id" "uuid",
    "delivery_status" "text",
    "occurred_at" timestamp with time zone NOT NULL,
    "error_message" "text",
    "processing_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "outcome" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "claimed_at" timestamp with time zone,
    "callback_claim_token" "uuid",
    "last_error" "text",
    CONSTRAINT "whatsapp_webhook_inbox_callback_kind_check" CHECK (("callback_kind" = ANY (ARRAY['status'::"text", 'button'::"text", 'quarantine'::"text"]))),
    CONSTRAINT "whatsapp_webhook_inbox_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'processed'::"text", 'manual_review'::"text"])))
);


ALTER TABLE "public"."whatsapp_webhook_inbox" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_whatsapp_webhook_callbacks"("_limit" integer DEFAULT 50) RETURNS SETOF "public"."whatsapp_webhook_inbox"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT inbox.id
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.processing_status = 'pending'
       OR (
         inbox.processing_status = 'processing'
         AND inbox.claimed_at < now() - interval '10 minutes'
       )
    ORDER BY inbox.received_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(_limit, 100))
  )
  UPDATE public.whatsapp_webhook_inbox inbox
  SET processing_status = 'processing',
      claimed_at = now(),
      callback_claim_token = gen_random_uuid()
  FROM candidates
  WHERE inbox.id = candidates.id
  RETURNING inbox.*;
END;
$$;


ALTER FUNCTION "public"."claim_whatsapp_webhook_callbacks"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_invitations"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    UPDATE public.user_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
$$;


ALTER FUNCTION "public"."cleanup_expired_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_add_incident_comment"("_incident_id" "uuid", "_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_incident record;
  v_comment_id uuid;
BEGIN
  IF _body IS NULL OR length(trim(_body)) = 0 THEN
    RAISE EXCEPTION 'El comentario no puede estar vacío';
  END IF;

  SELECT id, status, client_id, visibility
  INTO v_incident
  FROM public.cleaning_incidents
  WHERE id = _incident_id;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;

  IF v_incident.visibility <> 'public'
     OR v_incident.status NOT IN ('open', 'in_progress', 'resolved', 'discarded') THEN
    RAISE EXCEPTION 'Incidencia no visible para cliente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_portal_access cpa
    WHERE cpa.client_id = v_incident.client_id
      AND cpa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Portal del cliente no activo';
  END IF;

  INSERT INTO public.cleaning_incident_comments (
    incident_id,
    body,
    author_kind,
    author_name
  ) VALUES (
    _incident_id,
    trim(_body),
    'client',
    'Cliente (portal)'
  )
  RETURNING id INTO v_comment_id;

  INSERT INTO public.cleaning_incident_events (
    incident_id,
    event_type,
    to_status,
    note,
    actor_name,
    actor_role
  ) VALUES (
    _incident_id,
    'client_comment',
    v_incident.status,
    trim(_body),
    'Cliente (portal)',
    'client'
  );

  RETURN v_comment_id;
END;
$$;


ALTER FUNCTION "public"."client_add_incident_comment"("_incident_id" "uuid", "_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_update_incident_status"("_incident_id" "uuid", "_to_status" "text", "_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_incident RECORD;
BEGIN
  IF _to_status NOT IN ('resolved', 'discarded', 'in_progress') THEN
    RAISE EXCEPTION 'Estado no permitido para cliente: %', _to_status;
  END IF;

  SELECT id, status, client_id, visibility
  INTO v_incident
  FROM public.cleaning_incidents
  WHERE id = _incident_id;

  IF v_incident.id IS NULL THEN
    RAISE EXCEPTION 'Incidencia no encontrada';
  END IF;

  IF v_incident.visibility <> 'public' THEN
    RAISE EXCEPTION 'Incidencia no visible para cliente';
  END IF;

  IF v_incident.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'La incidencia no puede modificarse en su estado actual';
  END IF;

  -- Ensure client portal is active
  IF NOT EXISTS (
    SELECT 1 FROM public.client_portal_access cpa
    WHERE cpa.client_id = v_incident.client_id
    AND cpa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Portal del cliente no activo';
  END IF;

  UPDATE public.cleaning_incidents
  SET
    status = _to_status::incident_status,
    resolved_at = CASE WHEN _to_status = 'resolved' THEN now() ELSE resolved_at END,
    resolution_note = CASE WHEN _to_status = 'resolved' AND _note IS NOT NULL THEN _note ELSE resolution_note END,
    client_discard_reason = CASE WHEN _to_status = 'discarded' AND _note IS NOT NULL THEN _note ELSE client_discard_reason END,
    updated_at = now()
  WHERE id = _incident_id;

  INSERT INTO public.cleaning_incident_events (
    incident_id, event_type, from_status, to_status, note,
    actor_user_id, actor_name, actor_role
  ) VALUES (
    _incident_id,
    CASE WHEN _to_status = 'resolved' THEN 'client_resolved'
         WHEN _to_status = 'discarded' THEN 'client_discarded'
         ELSE 'client_in_progress' END,
    v_incident.status,
    _to_status::incident_status,
    _note,
    NULL,
    'Cliente (portal)',
    'client'
  );
END;
$$;


ALTER FUNCTION "public"."client_update_incident_status"("_incident_id" "uuid", "_to_status" "text", "_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_stale_avantio_syncs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.avantio_sync_logs
  SET 
    status = 'failed',
    sync_completed_at = now(),
    errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['Cerrado automáticamente por watchdog: sync sin actividad por más de 30 minutos']
  WHERE status = 'running'
    AND sync_started_at < now() - interval '30 minutes';
END;
$$;


ALTER FUNCTION "public"."close_stale_avantio_syncs"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_stock_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "property_group_id" "uuid",
    "scheduled_date" "date" NOT NULL,
    "check_type" "text" DEFAULT 'inventory'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "checked_by" "uuid",
    "notes" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_stock_checks_check_type_check" CHECK (("check_type" = ANY (ARRAY['restock'::"text", 'inventory'::"text"]))),
    CONSTRAINT "supervision_stock_checks_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'completed'::"text", 'blocked'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."supervision_stock_checks" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_supervision_stock_check"("_check_id" "uuid", "_notes" "text" DEFAULT NULL::"text") RETURNS "public"."supervision_stock_checks"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_check public.supervision_stock_checks;
  line RECORD;
  result_check public.supervision_stock_checks;
  target_delta NUMERIC(12,2);
  physical_delta NUMERIC(12,2);
BEGIN
  SELECT * INTO current_check FROM public.supervision_stock_checks WHERE id = _check_id FOR UPDATE;
  IF current_check.id IS NULL THEN RAISE EXCEPTION 'stock check not found'; END IF;
  IF NOT public.supervision_stock_warehouse_can_access(current_check.warehouse_id) THEN RAISE EXCEPTION 'stock warehouse access denied'; END IF;
  IF current_check.status = 'completed' THEN RETURN current_check; END IF;

  FOR line IN SELECT c.*, l.current_quantity AS physical_quantity, l.warehouse_id, l.product_id AS level_product_id
    FROM public.supervision_stock_check_lines c
    JOIN public.stock_levels l ON l.id = c.stock_level_id
    WHERE c.check_id = _check_id
    FOR UPDATE OF c, l LOOP
    IF line.observed_quantity IS NULL THEN RAISE EXCEPTION 'all stock lines require an observed quantity'; END IF;
    target_delta := line.observed_quantity - line.expected_quantity;
    physical_delta := line.observed_quantity - line.physical_quantity;

    UPDATE public.supervision_stock_check_lines
    SET difference = target_delta, updated_at = now()
    WHERE id = line.id;

    IF physical_delta <> 0 THEN
      UPDATE public.stock_levels
      SET current_quantity = line.observed_quantity, updated_by = auth.uid()
      WHERE id = line.stock_level_id;
      INSERT INTO public.stock_movements (
        product_id, warehouse_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_by
      ) VALUES (
        line.level_product_id, line.warehouse_id, 'ajuste'::public.stock_movement_type,
        abs(physical_delta), line.physical_quantity, line.observed_quantity,
        'Recuento de supervisión ' || current_check.id::text, auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.supervision_stock_checks
  SET status = 'completed', notes = COALESCE(_notes, notes), completed_at = now(), updated_at = now()
  WHERE id = _check_id
  RETURNING * INTO result_check;
  RETURN result_check;
END;
$$;


ALTER FUNCTION "public"."complete_supervision_stock_check"("_check_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configure_laundry_classic_cron"("p_service_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'cron', 'pg_temp'
    AS $_$
DECLARE
  existing_job_name TEXT;
  project_url CONSTANT TEXT := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'laundry_classic_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'laundry_classic_cron_service_role',
    'Service role usada solo por pg_cron para sincronizar enlaces clasicos'
  );

  FOR existing_job_name IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'laundry-classic-link-sync'
  LOOP
    PERFORM cron.unschedule(existing_job_name);
  END LOOP;

  PERFORM cron.schedule(
    'laundry-classic-link-sync',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'laundry_classic_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{"action":"reconcile","source":"cron"}'::jsonb
      );
    $command$, project_url || '/functions/v1/manage-laundry-classic-links')
  );
END;
$_$;


ALTER FUNCTION "public"."configure_laundry_classic_cron"("p_service_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configure_laundry_route_v2_cron"("p_service_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'cron', 'pg_temp'
    AS $_$
DECLARE
  existing_job_name TEXT;
  project_url CONSTANT TEXT := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'laundry_route_v2_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'laundry_route_v2_cron_service_role',
    'Service role usada solo por pg_cron para sincronizar el nuevo sistema de ruta'
  );

  FOR existing_job_name IN
    SELECT jobname FROM cron.job
    WHERE jobname = 'laundry-route-v2-sync'
  LOOP
    PERFORM cron.unschedule(existing_job_name);
  END LOOP;

  PERFORM cron.schedule(
    'laundry-route-v2-sync',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'laundry_route_v2_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{"action":"reconcile","source":"cron"}'::jsonb
      );
    $command$, project_url || '/functions/v1/manage-laundry-route-v2-links')
  );
END;
$_$;


ALTER FUNCTION "public"."configure_laundry_route_v2_cron"("p_service_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configure_supervision_report_cron"("p_service_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'cron', 'pg_temp'
    AS $_$
DECLARE
  existing_job_id bigint;
  project_url constant text := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida';
  END IF;

  DELETE FROM vault.secrets WHERE name = 'supervision_report_cron_service_role';
  PERFORM vault.create_secret(p_service_role_key, 'supervision_report_cron_service_role', 'Service role usada solo por el cron de informes de supervisión');

  FOR existing_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'supervision-daily-report' LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'supervision-daily-report',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supervision_report_cron_service_role' LIMIT 1)
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/send-supervision-daily-report')
  );
END;
$_$;


ALTER FUNCTION "public"."configure_supervision_report_cron"("p_service_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."configure_whatsapp_notification_cron"("p_service_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  existing_job_id bigint;
  project_url constant text := 'https://qyipyygojlfhdghnraus.supabase.co';
BEGIN
  IF p_service_role_key IS NULL OR length(p_service_role_key) < 20 THEN
    RAISE EXCEPTION 'service role key invalida' USING ERRCODE = '22023';
  END IF;

  DELETE FROM vault.secrets
  WHERE name = 'whatsapp_notification_cron_service_role';

  PERFORM vault.create_secret(
    p_service_role_key,
    'whatsapp_notification_cron_service_role',
    'Service role usada solo por pg_cron para notificaciones WhatsApp'
  );

  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'whatsapp-remind-unapproved',
      'whatsapp-remind-late-start',
      'whatsapp-process-pending'
    )
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'whatsapp-remind-unapproved',
    '*/15 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/remind-unapproved-tasks')
  );

  PERFORM cron.schedule(
    'whatsapp-remind-late-start',
    '*/5 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/remind-late-start-tasks')
  );

  PERFORM cron.schedule(
    'whatsapp-process-pending',
    '*/2 * * * *',
    format($command$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'whatsapp_notification_cron_service_role'
            LIMIT 1
          )
        ),
        body := '{}'::jsonb
      );
    $command$, project_url || '/functions/v1/process-pending-whatsapp-notifications')
  );
END;
$_$;


ALTER FUNCTION "public"."configure_whatsapp_notification_cron"("p_service_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO cleaner_availability (cleaner_id, day_of_week, is_available, start_time, end_time)
  SELECT NEW.id, d, true, '06:00'::time, '23:00'::time
  FROM generate_series(0, 6) AS d
  ON CONFLICT (cleaner_id, day_of_week) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_stock_alert_if_needed"("stock_level_id_param" "uuid", "product_id_param" "uuid", "warehouse_id_param" "uuid", "alert_type_param" "public"."stock_alert_type") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.stock_alerts (
    stock_level_id,
    product_id,
    warehouse_id,
    alert_type
  )
  SELECT
    stock_level_id_param,
    product_id_param,
    warehouse_id_param,
    alert_type_param
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stock_alerts a
    WHERE a.stock_level_id = stock_level_id_param
      AND a.alert_type = alert_type_param
      AND a.is_active = true
  );
END;
$$;


ALTER FUNCTION "public"."create_stock_alert_if_needed"("stock_level_id_param" "uuid", "product_id_param" "uuid", "warehouse_id_param" "uuid", "alert_type_param" "public"."stock_alert_type") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_group_id" "uuid",
    "location_type" "text" DEFAULT 'central'::"text" NOT NULL,
    CONSTRAINT "stock_warehouses_location_type_check" CHECK (("location_type" = ANY (ARRAY['central'::"text", 'building_storage'::"text"]))),
    CONSTRAINT "stock_warehouses_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."stock_warehouses" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_warehouses" IS 'New stock module: warehouses per sede. Legacy inventory_* tables are intentionally not used.';



CREATE OR REPLACE FUNCTION "public"."create_stock_warehouse"("sede_id_param" "uuid", "name_param" "text", "address_param" "text" DEFAULT NULL::"text", "is_default_param" boolean DEFAULT false, "sort_order_param" integer DEFAULT 0) RETURNS "public"."stock_warehouses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_warehouse public.stock_warehouses;
BEGIN
  IF sede_id_param IS NULL THEN
    RAISE EXCEPTION 'La sede es obligatoria';
  END IF;

  IF length(trim(COALESCE(name_param, ''))) = 0 THEN
    RAISE EXCEPTION 'El nombre del almacen es obligatorio';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para crear almacenes';
  END IF;

  IF is_default_param THEN
    UPDATE public.stock_warehouses
    SET is_default = false
    WHERE sede_id = sede_id_param
      AND is_default = true;
  END IF;

  INSERT INTO public.stock_warehouses (
    sede_id,
    name,
    address,
    is_default,
    sort_order
  )
  VALUES (
    sede_id_param,
    trim(name_param),
    NULLIF(trim(COALESCE(address_param, '')), ''),
    COALESCE(is_default_param, false),
    COALESCE(sort_order_param, 0)
  )
  RETURNING * INTO new_warehouse;

  INSERT INTO public.stock_levels (
    product_id,
    warehouse_id,
    current_quantity,
    minimum_quantity,
    target_quantity
  )
  SELECT
    p.id,
    new_warehouse.id,
    0,
    0,
    0
  FROM public.stock_products p
  WHERE p.sede_id = sede_id_param
    AND p.is_active = true
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  RETURN new_warehouse;
END;
$$;


ALTER FUNCTION "public"."create_stock_warehouse"("sede_id_param" "uuid", "name_param" "text", "address_param" "text", "is_default_param" boolean, "sort_order_param" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tourist_budget"("p_sede_id" "uuid", "p_client_id" "uuid", "p_title" "text", "p_prospect_name" "text", "p_validity_date" "date", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_commercial_notes" "text" DEFAULT NULL::"text", "p_internal_notes" "text" DEFAULT NULL::"text", "p_terms" "text" DEFAULT NULL::"text", "p_source_profile_version_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_budget_id UUID;
  new_version_id UUID;
  quote TEXT;
  item JSONB;
  item_index INTEGER := 0;
  total_cost NUMERIC(12,2) := COALESCE((p_totals->>'totalCost')::NUMERIC, 0);
  total_revenue NUMERIC(12,2) := COALESCE((p_totals->>'totalRevenue')::NUMERIC, 0);
  contribution NUMERIC(12,2) := COALESCE((p_totals->>'contribution')::NUMERIC, 0);
  margin NUMERIC(7,2) := COALESCE((p_totals->>'marginPercentage')::NUMERIC, 0);
  monthly_cost NUMERIC(12,2) := COALESCE((p_totals->>'monthlyCost')::NUMERIC, 0);
  monthly_revenue NUMERIC(12,2) := COALESCE((p_totals->>'monthlyRevenue')::NUMERIC, 0);
  monthly_contribution NUMERIC(12,2) := COALESCE((p_totals->>'monthlyContribution')::NUMERIC, 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede crear presupuestos';
  END IF;
  IF p_sede_id IS NULL OR p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'La sede y el título del presupuesto son obligatorios';
  END IF;
  IF total_cost < 0 OR total_revenue < 0 OR monthly_cost < 0 OR monthly_revenue < 0 THEN
    RAISE EXCEPTION 'Los totales no pueden ser negativos';
  END IF;

  quote := format('PRES-%s-%s', to_char(current_date, 'YYYYMMDD'), lpad(nextval('public.tourist_budget_quote_seq')::TEXT, 5, '0'));

  INSERT INTO public.tourist_budgets (
    sede_id, client_id, quote_number, title, prospect_name, validity_date,
    monthly_rotations, total_cost, total_revenue, contribution, margin_percentage,
    monthly_cost, monthly_revenue, monthly_contribution,
    commercial_notes, internal_notes, terms, created_by
  ) VALUES (
    p_sede_id, p_client_id, quote, trim(p_title), NULLIF(trim(p_prospect_name), ''), p_validity_date,
    GREATEST(COALESCE((p_snapshot->>'monthlyRotations')::INTEGER, 1), 1),
    total_cost, total_revenue, contribution, margin, monthly_cost, monthly_revenue, monthly_contribution,
    p_commercial_notes, p_internal_notes, p_terms, auth.uid()
  ) RETURNING id INTO new_budget_id;

  INSERT INTO public.tourist_budget_versions (
    budget_id, version_number, source_profile_version_id, input_snapshot, totals_snapshot, created_by
  ) VALUES (
    new_budget_id, 1, p_source_profile_version_id, COALESCE(p_snapshot, '{}'::jsonb), COALESCE(p_totals, '{}'::jsonb), auth.uid()
  ) RETURNING id INTO new_version_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.tourist_budget_items (
      budget_version_id, sort_order, property_id, property_code, property_name, property_address,
      feature_counts, time_input, logistics_input, service_lines, result_snapshot
    ) VALUES (
      new_version_id,
      item_index,
      NULLIF(item->>'propertyId', '')::UUID,
      NULLIF(item->>'propertyCode', ''),
      COALESCE(NULLIF(item->>'propertyName', ''), format('Propiedad %s', item_index + 1)),
      NULLIF(item->>'propertyAddress', ''),
      COALESCE(item->'featureCounts', '{}'::jsonb),
      COALESCE(item->'timeInput', '{}'::jsonb),
      COALESCE(item->'logisticsInput', '{}'::jsonb),
      COALESCE(item->'serviceLines', '{}'::jsonb),
      COALESCE(item->'resultSnapshot', '{}'::jsonb)
    );
    item_index := item_index + 1;
  END LOOP;

  INSERT INTO public.tourist_budget_status_history (budget_id, from_status, to_status, changed_by)
  VALUES (new_budget_id, NULL, 'draft', auth.uid());

  RETURN jsonb_build_object('budgetId', new_budget_id, 'versionId', new_version_id, 'quoteNumber', quote);
END;
$$;


ALTER FUNCTION "public"."create_tourist_budget"("p_sede_id" "uuid", "p_client_id" "uuid", "p_title" "text", "p_prospect_name" "text", "p_validity_date" "date", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_commercial_notes" "text", "p_internal_notes" "text", "p_terms" "text", "p_source_profile_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "expires_hours" integer DEFAULT 48) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    current_user_role TEXT;
    invitation_token UUID;
    invite_expires_at TIMESTAMP WITH TIME ZONE;
    inviter_user_id UUID;
BEGIN
    inviter_user_id := auth.uid();
    
    -- Validar que el usuario esté autenticado
    IF inviter_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Input validation mejorado
    IF invite_email IS NULL OR trim(invite_email) = '' THEN
        RAISE EXCEPTION 'Email es requerido';
    END IF;
    
    -- Validar formato de email básico
    IF NOT invite_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Formato de email inválido';
    END IF;
    
    IF invite_role IS NULL THEN
        RAISE EXCEPTION 'Rol es requerido';
    END IF;
    
    -- Validate role values (incluye logistics)
    IF invite_role NOT IN ('admin', 'manager', 'supervisor', 'cleaner', 'client', 'logistics') THEN
        RAISE EXCEPTION 'Rol no válido: %', invite_role;
    END IF;
    
    -- Validar expires_hours
    IF expires_hours IS NULL OR expires_hours < 1 OR expires_hours > 168 THEN -- máximo 1 semana
        RAISE EXCEPTION 'expires_hours debe estar entre 1 y 168 horas';
    END IF;
    
    -- Rate limiting check
    IF NOT public.check_rate_limit(
        inviter_user_id::TEXT, 
        'invitation_request', 
        10, -- max 10 invitations
        60, -- per hour
        60  -- block for 1 hour
    ) THEN
        RAISE EXCEPTION 'Demasiadas invitaciones enviadas. Intenta de nuevo más tarde.';
    END IF;
    
    -- Get current user role for authorization
    SELECT role::TEXT INTO current_user_role
    FROM public.user_roles
    WHERE user_id = inviter_user_id;
    
    -- Authorization check
    IF current_user_role NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'No tienes permisos para enviar invitaciones';
    END IF;
    
    -- Prevent privilege escalation
    IF current_user_role = 'manager' AND invite_role = 'admin' THEN
        RAISE EXCEPTION 'Los managers no pueden crear usuarios admin';
    END IF;
    
    -- Check if user already exists
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = LOWER(TRIM(invite_email))
    ) THEN
        RAISE EXCEPTION 'Un usuario con este email ya existe en el sistema';
    END IF;
    
    -- Check for existing pending invitation
    IF EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
        AND status = 'pending'
        AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este email';
    END IF;
    
    -- Mark any existing invitations as superseded
    UPDATE public.user_invitations
    SET status = 'superseded'
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
    AND status = 'pending';
    
    -- Generate secure invitation token and expiration
    invitation_token := gen_random_uuid();
    invite_expires_at := now() + (expires_hours || ' hours')::INTERVAL;
    
    -- Create invitation record
    INSERT INTO public.user_invitations (
        invitation_token,
        email,
        role,
        invited_by,
        expires_at,
        status
    ) VALUES (
        invitation_token,
        LOWER(TRIM(invite_email)),
        invite_role::app_role,
        inviter_user_id,
        invite_expires_at,
        'pending'
    );
    
    -- Log security event
    PERFORM public.log_security_event('invitation_created', jsonb_build_object(
        'invited_email', LOWER(TRIM(invite_email)),
        'invited_role', invite_role,
        'expires_at', invite_expires_at
    ));
    
    RETURN invitation_token;
EXCEPTION
    WHEN OTHERS THEN
        -- Log failed invitation creation
        PERFORM public.log_security_event('invitation_create_failed', jsonb_build_object(
            'error', SQLERRM,
            'invite_email', LOWER(TRIM(invite_email)),
            'invite_role', invite_role
        ));
        RAISE;
END;
$_$;


ALTER FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "expires_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "invite_sede_id" "uuid" DEFAULT NULL::"uuid", "expires_hours" integer DEFAULT 48) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
    current_user_role TEXT;
    invitation_token UUID;
    invite_expires_at TIMESTAMP WITH TIME ZONE;
    inviter_user_id UUID;
BEGIN
    inviter_user_id := auth.uid();
    
    -- Validar que el usuario esté autenticado
    IF inviter_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;
    
    -- Input validation mejorado
    IF invite_email IS NULL OR trim(invite_email) = '' THEN
        RAISE EXCEPTION 'Email es requerido';
    END IF;
    
    -- Validar formato de email básico
    IF NOT invite_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Formato de email inválido';
    END IF;
    
    IF invite_role IS NULL THEN
        RAISE EXCEPTION 'Rol es requerido';
    END IF;
    
    -- Validate role values (incluye logistics)
    IF invite_role NOT IN ('admin', 'manager', 'supervisor', 'cleaner', 'client', 'logistics') THEN
        RAISE EXCEPTION 'Rol no válido: %', invite_role;
    END IF;
    
    -- Validar que si es cleaner, debe tener sede_id
    IF invite_role = 'cleaner' AND invite_sede_id IS NULL THEN
        RAISE EXCEPTION 'Para invitar un cleaner debe especificar una sede';
    END IF;
    
    -- Validar expires_hours
    IF expires_hours IS NULL OR expires_hours < 1 OR expires_hours > 168 THEN -- máximo 1 semana
        RAISE EXCEPTION 'expires_hours debe estar entre 1 y 168 horas';
    END IF;
    
    -- Rate limiting check
    IF NOT public.check_rate_limit(
        inviter_user_id::TEXT, 
        'invitation_request', 
        10, -- max 10 invitations
        60, -- per hour
        60  -- block for 1 hour
    ) THEN
        RAISE EXCEPTION 'Demasiadas invitaciones enviadas. Intenta de nuevo más tarde.';
    END IF;
    
    -- Get current user role for authorization
    SELECT role::TEXT INTO current_user_role
    FROM public.user_roles
    WHERE user_id = inviter_user_id;
    
    -- Authorization check
    IF current_user_role NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'No tienes permisos para enviar invitaciones';
    END IF;
    
    -- Prevent privilege escalation
    IF current_user_role = 'manager' AND invite_role = 'admin' THEN
        RAISE EXCEPTION 'Los managers no pueden crear usuarios admin';
    END IF;
    
    -- Check if user already exists
    IF EXISTS (
        SELECT 1 FROM auth.users 
        WHERE email = LOWER(TRIM(invite_email))
    ) THEN
        RAISE EXCEPTION 'Un usuario con este email ya existe en el sistema';
    END IF;
    
    -- Check for existing pending invitation
    IF EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
        AND status = 'pending'
        AND expires_at > now()
    ) THEN
        RAISE EXCEPTION 'Ya existe una invitación pendiente para este email';
    END IF;
    
    -- Mark any existing invitations as superseded
    UPDATE public.user_invitations
    SET status = 'superseded'
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(invite_email))
    AND status = 'pending';
    
    -- Generate secure invitation token and expiration
    invitation_token := gen_random_uuid();
    invite_expires_at := now() + (expires_hours || ' hours')::INTERVAL;
    
    -- Create invitation record
    INSERT INTO public.user_invitations (
        invitation_token,
        email,
        role,
        invited_by,
        expires_at,
        status,
        sede_id
    ) VALUES (
        invitation_token,
        LOWER(TRIM(invite_email)),
        invite_role::app_role,
        inviter_user_id,
        invite_expires_at,
        'pending',
        invite_sede_id
    );
    
    -- Log security event
    PERFORM public.log_security_event('invitation_created', jsonb_build_object(
        'invited_email', LOWER(TRIM(invite_email)),
        'invited_role', invite_role,
        'expires_at', invite_expires_at,
        'sede_id', invite_sede_id
    ));
    
    RETURN invitation_token;
EXCEPTION
    WHEN OTHERS THEN
        -- Log failed invitation creation
        PERFORM public.log_security_event('invitation_create_failed', jsonb_build_object(
            'error', SQLERRM,
            'invite_email', LOWER(TRIM(invite_email)),
            'invite_role', invite_role
        ));
        RAISE;
END;
$_$;


ALTER FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "invite_sede_id" "uuid", "expires_hours" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_planning_batch_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE v uuid;
BEGIN
  BEGIN v:=NULLIF(current_setting('app.planning_batch_id',true),'')::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END;
  IF v IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.planning_apply_batches WHERE id=v AND status='applying' AND actor_id=auth.uid()) THEN RETURN v; END IF;
  RETURN NULL;
END $$;


ALTER FUNCTION "public"."current_planning_batch_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
 v_cleaner public.cleaners%ROWTYPE; v_task record; v_remaining_names text;
 v_remaining_primary uuid; v_unassigned_count integer:=0;
 v_had_modern_assignment boolean;
BEGIN
 IF COALESCE(auth.role(),'')<>'service_role' AND NOT public.user_is_admin_or_manager() THEN
  RAISE EXCEPTION 'No autorizado para desactivar trabajadores' USING ERRCODE='42501';
 END IF;

 -- Snapshot sin lock solo para descubrir el conjunto inicial y autorizar sede.
 SELECT * INTO v_cleaner FROM public.cleaners WHERE id=_cleaner_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado'; END IF;
 IF COALESCE(auth.role(),'')<>'service_role'
    AND NOT (v_cleaner.sede_id=ANY(public.get_user_accessible_sedes())) THEN
  RAISE EXCEPTION 'No autorizado para desactivar trabajadores de esta sede' USING ERRCODE='42501';
 END IF;

 IF _unassign_future_tasks THEN
  PERFORM t.id FROM public.tasks t
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
    AND (
      EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
      OR t.cleaner_id=_cleaner_id
      OR (t.cleaner_id IS NULL AND EXISTS(
        SELECT 1 FROM public.planning_effective_task_assignments() ea
        WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
      ))
    )
  ORDER BY t.id FOR UPDATE;
 END IF;

 SELECT * INTO v_cleaner FROM public.cleaners WHERE id=_cleaner_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trabajador no encontrado'; END IF;
 IF COALESCE(auth.role(),'')<>'service_role'
    AND NOT (v_cleaner.sede_id=ANY(public.get_user_accessible_sedes())) THEN
  RAISE EXCEPTION 'No autorizado para desactivar trabajadores de esta sede' USING ERRCODE='42501';
 END IF;
 IF v_cleaner.is_active=false THEN
  RETURN jsonb_build_object('unassignedCount',0,'alreadyInactive',true);
 END IF;
 PERFORM set_config('app.planning_deactivation_cleaner_id',_cleaner_id::text,true);

 IF _unassign_future_tasks THEN
  -- Relectura obligatoria tras cleaner lock: incluye carreras ya confirmadas.
  PERFORM t.id FROM public.tasks t
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
    AND (
      EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
      OR t.cleaner_id=_cleaner_id
      OR (t.cleaner_id IS NULL AND EXISTS(
        SELECT 1 FROM public.planning_effective_task_assignments() ea
        WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
      ))
    )
  ORDER BY t.id FOR UPDATE;

  FOR v_task IN
   SELECT t.id,t.sede_id FROM public.tasks t
   WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
     AND COALESCE(t.status,'pending') NOT IN ('completed','cancelled')
     AND (
       EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.cleaner_id=_cleaner_id)
       OR t.cleaner_id=_cleaner_id
       OR (t.cleaner_id IS NULL AND EXISTS(
         SELECT 1 FROM public.planning_effective_task_assignments() ea
         WHERE ea.task_id=t.id AND ea.cleaner_id=_cleaner_id
       ))
     )
   ORDER BY t.id
  LOOP
   SELECT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=v_task.id AND ta.cleaner_id=_cleaner_id)
    INTO v_had_modern_assignment;
   IF v_had_modern_assignment THEN
    DELETE FROM public.task_assignments WHERE task_id=v_task.id AND cleaner_id=_cleaner_id;
   ELSE
    INSERT INTO public.notification_events(
     event_type,entity_type,entity_id,task_id,cleaner_id,sede_id,payload,dedupe_key,status
    ) VALUES(
     'task_cancelled','tasks',v_task.id,v_task.id,_cleaner_id,v_task.sede_id,
     jsonb_build_object('source','deactivate_cleaner_legacy_assignment'),
     concat('task_cancelled:',v_task.id::text,':',_cleaner_id::text,':legacy-deactivation:',v_cleaner.activation_cycle_id::text),
     'pending'
    ) ON CONFLICT(dedupe_key) DO NOTHING;
   END IF;
   SELECT string_agg(c.name,', ' ORDER BY ta.assigned_at,ta.id),
          (array_agg(c.id ORDER BY ta.assigned_at,ta.id))[1]
    INTO v_remaining_names,v_remaining_primary
   FROM public.task_assignments ta JOIN public.cleaners c ON c.id=ta.cleaner_id
   WHERE ta.task_id=v_task.id;
   UPDATE public.tasks SET cleaner=v_remaining_names,cleaner_id=v_remaining_primary,updated_at=now()
   WHERE id=v_task.id;
   v_unassigned_count:=v_unassigned_count+1;
  END LOOP;
 END IF;

 UPDATE public.cleaners SET is_active=false,updated_at=now() WHERE id=_cleaner_id;
 RETURN jsonb_build_object('unassignedCount',v_unassigned_count,'alreadyInactive',false);
END $$;


ALTER FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean) IS 'Desactiva un trabajador y retira sus tareas futuras de forma atómica, preservando asignaciones compartidas.';



CREATE OR REPLACE FUNCTION "public"."delete_avantio_cron_job"("job_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  result JSONB;
BEGIN
  PERFORM cron.unschedule(job_name);
  
  result := jsonb_build_object(
    'success', true,
    'job_name', job_name,
    'message', 'Job unscheduled successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."delete_avantio_cron_job"("job_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_avirato_cron_job"("job_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = job_name;

  RETURN jsonb_build_object('success', true, 'job_name', job_name);
END;
$$;


ALTER FUNCTION "public"."delete_avirato_cron_job"("job_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_hostaway_cron_job"("job_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM cron.unschedule(job_name);
  
  result := jsonb_build_object(
    'success', true,
    'job_name', job_name,
    'message', 'Job unscheduled successfully'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."delete_hostaway_cron_job"("job_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dismiss_notification_send_reconciliation"("_delivery_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  action_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries
  WHERE id = _delivery_id
  FOR UPDATE;

  IF delivery.id IS NULL
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR NOT (
       (delivery.channel = 'whatsapp' AND delivery.provider = 'meta_cloud_api'
        AND (
          delivery.error_code = 'reconciliation_required'
          OR delivery.provider_payload->>'send_started_at' IS NOT NULL
        ))
       OR
       (delivery.channel = 'email' AND delivery.provider = 'resend'
        AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
        AND delivery.provider_response->>'fallback_attempt_state'
          IN ('contacting_resend', 'reconciliation_required'))
     ) THEN
    RAISE EXCEPTION 'delivery_not_reconcilable' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_send_reconciliation_actions dismissed
    WHERE dismissed.delivery_id = delivery.id
      AND dismissed.resolution = 'dismissed'
      AND dismissed.status = 'completed'
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.notification_send_reconciliation_actions (
    delivery_id,
    notification_event_id,
    channel,
    resolution,
    status,
    requested_by,
    completed_at,
    result_detail
  ) VALUES (
    delivery.id,
    delivery.notification_event_id,
    delivery.channel,
    'dismissed',
    'completed',
    auth.uid(),
    now(),
    'Descartada por administraciÃ³n: no se confirma el envÃ­o ni se solicita un reintento'
  )
  RETURNING id INTO action_id;

  RETURN action_id IS NOT NULL;
END;
$$;


ALTER FUNCTION "public"."dismiss_notification_send_reconciliation"("_delivery_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_notification_event_delivery_mode"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE ctx_batch uuid; ctx_mode text;
BEGIN
 IF TG_OP='INSERT' THEN
  ctx_batch:=public.current_planning_batch_id();
  ctx_mode:=NULLIF(current_setting('app.planning_notification_mode',true),'');
  IF ctx_batch IS NOT NULL THEN
   NEW.batch_id:=ctx_batch;
   NEW.notification_mode:=CASE WHEN ctx_mode='test' THEN 'test' ELSE 'shadow' END;
  ELSIF NEW.notification_mode IS NULL THEN
   NEW.notification_mode:='live';
  END IF;
 ELSIF OLD.batch_id IS NOT NULL THEN
  IF NEW.batch_id IS DISTINCT FROM OLD.batch_id THEN
   RAISE EXCEPTION 'NOTIFICATION_BATCH_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.notification_mode NOT IN ('shadow','test') THEN
   RAISE EXCEPTION 'NOTIFICATION_BATCH_MODE_IMMUTABLE' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.status='processing'
    AND NOT public.notification_event_is_live_send_allowed(NEW.notification_mode,NEW.batch_id) THEN
  RAISE EXCEPTION 'NOTIFICATION_LIVE_DISABLED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."enforce_notification_event_delivery_mode"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_notification_event_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  task_sede uuid;
  cleaner_sede uuid;
BEGIN
  IF NEW.task_id IS NULL THEN
    RAISE EXCEPTION 'notification_event_requires_task' USING ERRCODE = '23514';
  END IF;

  SELECT task.sede_id INTO task_sede
  FROM public.tasks task
  WHERE task.id = NEW.task_id;

  IF NOT FOUND OR task_sede IS NULL THEN
    RAISE EXCEPTION 'notification_event_task_not_found' USING ERRCODE = '23503';
  END IF;

  IF NEW.cleaner_id IS NOT NULL THEN
    SELECT cleaner.sede_id INTO cleaner_sede
    FROM public.cleaners cleaner
    WHERE cleaner.id = NEW.cleaner_id;

    IF NOT FOUND OR cleaner_sede IS DISTINCT FROM task_sede THEN
      RAISE EXCEPTION 'notification_event_cleaner_sede_mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.sede_id := task_sede;
  NEW.entity_type := 'tasks';
  NEW.entity_id := NEW.task_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_notification_event_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_deleted_cleaner_cancellations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  task_row public.tasks%ROWTYPE;
  recipient_snapshot jsonb;
BEGIN
  recipient_snapshot := public.snapshot_notification_recipient(OLD);

  FOR assignment_row IN
    SELECT candidate.*
    FROM public.task_assignments candidate
    WHERE candidate.cleaner_id = OLD.id
    ORDER BY candidate.id
  LOOP
    SELECT task.* INTO task_row
    FROM public.tasks task
    WHERE task.id = assignment_row.task_id;

    IF task_row.id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notification_events (
      event_type, entity_type, entity_id, task_id, cleaner_id,
      recipient_worker_id, recipient_name_snapshot, recipient_phone_snapshot,
      sede_id, payload, snapshot, dedupe_key, status
    ) VALUES (
      'task_cancelled', 'tasks', task_row.id, NULL, NULL,
      OLD.id, recipient_snapshot->>'name', recipient_snapshot->>'effective_phone_e164',
      task_row.sede_id,
      jsonb_build_object(
        'source', 'tasks_before_cleaner_delete_trigger',
        'assignment_id', assignment_row.id,
        'operation', 'delete'
      ),
      jsonb_build_object(
        'task', jsonb_build_object(
          'id', task_row.id, 'property', task_row.property, 'address', task_row.address,
          'date', task_row.date, 'start_time', task_row.start_time, 'end_time', task_row.end_time,
          'sede_id', task_row.sede_id
        ),
        'assignment', jsonb_build_object(
          'id', assignment_row.id, 'cleaner_id', OLD.id,
          'cleaner_name', assignment_row.cleaner_name
        ),
        'recipient', recipient_snapshot
      ),
      concat('task_cancelled:', task_row.id::text, ':', OLD.id::text,
        ':assignment:', assignment_row.id::text),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enqueue_deleted_cleaner_cancellations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_deleted_task_cancellations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  cleaner_row public.cleaners%ROWTYPE;
  recipient_snapshot jsonb;
BEGIN
  FOR assignment_row IN
    SELECT candidate.*
    FROM public.task_assignments candidate
    WHERE candidate.task_id = OLD.id
      AND candidate.cleaner_id IS NOT NULL
    ORDER BY candidate.id
  LOOP
    SELECT cleaner.* INTO cleaner_row
    FROM public.cleaners cleaner
    WHERE cleaner.id = assignment_row.cleaner_id;

    recipient_snapshot := CASE WHEN cleaner_row.id IS NOT NULL
      THEN public.snapshot_notification_recipient(cleaner_row)
      ELSE jsonb_build_object(
        'name', assignment_row.cleaner_name,
        'email', NULL,
        'telefono', NULL,
        'whatsapp_phone_e164', NULL,
        'effective_phone_e164', NULL,
        'whatsapp_notifications_enabled', false,
        'whatsapp_opt_in', false
      ) END;

    INSERT INTO public.notification_events (
      event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
      payload, snapshot, dedupe_key, status
    ) VALUES (
      'task_cancelled', 'tasks', OLD.id, OLD.id, assignment_row.cleaner_id, OLD.sede_id,
      jsonb_build_object(
        'source', 'tasks_before_delete_trigger',
        'assignment_id', assignment_row.id,
        'operation', 'delete'
      ),
      jsonb_build_object(
        'task', jsonb_build_object(
          'id', OLD.id, 'property', OLD.property, 'address', OLD.address,
          'date', OLD.date, 'start_time', OLD.start_time, 'end_time', OLD.end_time,
          'sede_id', OLD.sede_id
        ),
        'assignment', jsonb_build_object(
          'id', assignment_row.id, 'cleaner_id', assignment_row.cleaner_id,
          'cleaner_name', assignment_row.cleaner_name
        ),
        'recipient', recipient_snapshot
      ),
      concat('task_cancelled:', OLD.id::text, ':', assignment_row.cleaner_id::text,
        ':assignment:', assignment_row.id::text),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enqueue_deleted_task_cancellations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_deleted_task_cancellations"() IS 'Conserva una cancelación inmutable por asignación antes del hard-delete de tasks.';



CREATE OR REPLACE FUNCTION "public"."enqueue_task_assignment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  notification_type text;
  task_record public.tasks%ROWTYPE;
  cleaner_row public.cleaners%ROWTYPE;
  event_snapshot jsonb;
  worker_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    assignment_row := NEW;
    notification_type := 'task_assigned';
  ELSE
    assignment_row := OLD;
    notification_type := 'task_cancelled';
  END IF;

  SELECT task.* INTO task_record FROM public.tasks task
  WHERE task.id = assignment_row.task_id;
  IF NOT FOUND OR assignment_row.cleaner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*)::integer + CASE WHEN TG_OP = 'DELETE' THEN 1 ELSE 0 END
    INTO worker_count
    FROM public.task_assignments
   WHERE task_id = assignment_row.task_id
     AND cleaner_id IS NOT NULL;
  worker_count := GREATEST(COALESCE(worker_count, 1), 1);

  SELECT cleaner.* INTO cleaner_row FROM public.cleaners cleaner
  WHERE cleaner.id = assignment_row.cleaner_id;
  event_snapshot := jsonb_build_object(
      'task', jsonb_build_object(
        'id', task_record.id, 'property', task_record.property,
        'address', task_record.address, 'date', task_record.date,
        'start_time', task_record.start_time, 'end_time', task_record.end_time,
        'duracion', task_record.duracion,
        'worker_count', worker_count,
        'sede_id', task_record.sede_id
      ),
      'assignment', jsonb_build_object(
        'id', assignment_row.id, 'cleaner_id', assignment_row.cleaner_id,
        'cleaner_name', assignment_row.cleaner_name
      ),
      'recipient', CASE WHEN cleaner_row.id IS NOT NULL
        THEN public.snapshot_notification_recipient(cleaner_row)
        ELSE jsonb_build_object(
          'name', assignment_row.cleaner_name, 'email', NULL, 'telefono', NULL,
          'whatsapp_phone_e164', NULL, 'effective_phone_e164', NULL,
          'whatsapp_notifications_enabled', false, 'whatsapp_opt_in', false
        ) END
  );

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
    payload, snapshot, dedupe_key, status
  ) VALUES (
    notification_type, 'tasks', assignment_row.task_id, assignment_row.task_id,
    assignment_row.cleaner_id, task_record.sede_id,
    jsonb_build_object(
      'source', 'task_assignments_after_write_trigger',
      'assignment_id', assignment_row.id,
      'operation', lower(TG_OP),
      'worker_count', worker_count
    ),
    event_snapshot,
    concat(notification_type, ':', assignment_row.task_id::text, ':',
      assignment_row.cleaner_id::text, ':assignment:', assignment_row.id::text),
    'pending'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."enqueue_task_assignment_notification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_task_assignment_notification"() IS 'Encola asignaciones/cancelaciones con duración total y número de trabajadores para calcular horarios individuales.';



CREATE OR REPLACE FUNCTION "public"."enqueue_task_modified_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  changed_fields jsonb := '[]'::jsonb;
  change_token uuid := gen_random_uuid();
  assigned_cleaner_id uuid;
BEGIN
  -- Allowlist cerrada: solamente día y horas planificadas.
  IF ROW(OLD.date, OLD.start_time, OLD.end_time)
     IS NOT DISTINCT FROM
     ROW(NEW.date, NEW.start_time, NEW.end_time) THEN
    RETURN NEW;
  END IF;

  IF OLD.date IS DISTINCT FROM NEW.date THEN
    changed_fields := changed_fields || jsonb_build_array('date');
  END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    changed_fields := changed_fields || jsonb_build_array('start_time');
  END IF;
  IF OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    changed_fields := changed_fields || jsonb_build_array('end_time');
  END IF;

  FOR assigned_cleaner_id IN
    SELECT current_assignments.cleaner_id
    FROM (
      SELECT cleaner_id
      FROM public.task_assignments
      WHERE task_id = NEW.id
        AND cleaner_id IS NOT NULL

      UNION

      SELECT NEW.cleaner_id
      WHERE NEW.cleaner_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.task_assignments
          WHERE task_id = NEW.id
            AND cleaner_id IS NOT NULL
        )
    ) AS current_assignments
  LOOP
    INSERT INTO public.notification_events (
      event_type,
      entity_type,
      entity_id,
      task_id,
      cleaner_id,
      sede_id,
      payload,
      dedupe_key,
      status
    ) VALUES (
      'task_modified',
      'tasks',
      NEW.id,
      NEW.id,
      assigned_cleaner_id,
      NEW.sede_id,
      jsonb_build_object(
        'source', 'tasks_after_update_trigger',
        'changed_fields', changed_fields
      ),
      concat(
        'task_modified:',
        NEW.id::text,
        ':',
        assigned_cleaner_id::text,
        ':',
        change_token::text
      ),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enqueue_task_modified_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_task_modified_notifications"() IS 'Crea task_modified únicamente si cambia tasks.date, tasks.start_time o tasks.end_time.';



CREATE OR REPLACE FUNCTION "public"."finalize_uncertain_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") RETURNS TABLE("effective_status" "text", "provider_message_id" "text", "reconciliation_required" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  attempt_count integer;
  owns_generation boolean;
  stale_exhausted_attempt boolean;
  terminal_message text;
BEGIN
  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  SELECT row.* INTO delivery FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;

  IF delivery.id IS NULL OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF delivery.provider_message_id IS NOT NULL OR delivery.status <> 'queued' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, false;
    RETURN;
  END IF;

  attempt_count := COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1);
  owns_generation := _lease_token IS NOT NULL
    AND delivery.provider_payload->>'send_lease_token' = _lease_token::text
    AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta';
  stale_exhausted_attempt := attempt_count >= 2
    AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta'
    AND event_row.status = 'processing'
    AND event_row.processed_at < now() - interval '10 minutes';

  IF NOT owns_generation AND NOT stale_exhausted_attempt THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, true;
    RETURN;
  END IF;

  terminal_message := CASE WHEN attempt_count >= 2
    THEN 'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual'
    ELSE _error_message END;

  UPDATE public.notification_deliveries row
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_build_object(
          'meta_attempt_state', 'completed_uncertain',
          'meta_attempt_completed_at', now(),
          'retry_exhausted', attempt_count >= 2
        ),
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = 'reconciliation_required',
      error_message = terminal_message
  WHERE row.id = _delivery_id;

  IF attempt_count >= 2 THEN
    UPDATE public.notification_events event
    SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE 'failed' END,
        processed_at = now(),
        processing_lease_token = NULL,
        error_message = CASE WHEN event.status = 'cancelled'
          THEN event.error_message ELSE terminal_message END
    WHERE event.id = locked_event_id;
  END IF;

  RETURN QUERY SELECT 'queued'::text, NULL::text, true;
END;
$$;


ALTER FUNCTION "public"."finalize_uncertain_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid", "_provider_message_id" "text", "_uncertain" boolean, "_error_message" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  fallback public.notification_deliveries%ROWTYPE;
  result_status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT * INTO fallback FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _notification_event_id
  FOR UPDATE;

  IF fallback.id IS NULL
     OR fallback.channel <> 'email'
     OR fallback.provider <> 'resend'
     OR fallback.template_name <> 'task_rejected_admin_fallback_email' THEN
    RAISE EXCEPTION 'fallback_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF fallback.status = 'sent' THEN
    RETURN 'sent';
  END IF;
  IF (fallback.provider_response->>'fallback_claim_token')::uuid IS DISTINCT FROM _claim_token THEN
    RETURN fallback.status;
  END IF;

  result_status := CASE
    WHEN COALESCE(btrim(_provider_message_id), '') <> '' THEN 'sent'
    WHEN _uncertain THEN 'queued'
    ELSE 'failed'
  END;

  UPDATE public.notification_deliveries
  SET status = result_status,
      provider_message_id = CASE WHEN result_status = 'sent' THEN _provider_message_id ELSE NULL END,
      provider_response = COALESCE(provider_response, '{}'::jsonb)
        || jsonb_build_object(
          'fallback_attempt_state', CASE
            WHEN result_status = 'sent' THEN 'sent'
            WHEN _uncertain THEN 'reconciliation_required'
            ELSE 'provider_rejected'
          END
        ),
      error_code = CASE
        WHEN result_status = 'sent' THEN NULL
        WHEN _uncertain THEN 'reconciliation_required'
        ELSE 'resend_error'
      END,
      error_message = CASE WHEN result_status = 'sent' THEN NULL ELSE left(_error_message, 1000) END,
      sent_at = CASE WHEN result_status = 'sent' THEN now() ELSE NULL END,
      failed_at = CASE WHEN result_status = 'failed' THEN now() ELSE NULL END
  WHERE id = _delivery_id;

  RETURN result_status;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid", "_provider_message_id" "text", "_uncertain" boolean, "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_non_delivery_result"("_delivery_id" "uuid", "_lease_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") RETURNS TABLE("effective_status" "text", "provider_message_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
BEGIN
  IF _result_status NOT IN ('failed', 'skipped') THEN
    RAISE EXCEPTION 'invalid_non_delivery_status' USING ERRCODE = '22023';
  END IF;

  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT row.* INTO delivery
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;

  IF NOT FOUND OR delivery.channel <> 'whatsapp' OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Un callback, un botón o una decisión administrativa pudieron completar el
  -- envío mientras este worker esperaba la respuesta síncrona de Meta.
  IF delivery.status IN ('sent', 'delivered', 'read')
     OR delivery.provider_message_id IS NOT NULL THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id;
    RETURN;
  END IF;

  -- Una generación obsoleta solo observa. No modifica una delivery recuperada
  -- o finalizada por otro worker.
  IF delivery.status <> 'queued'
     OR delivery.provider_payload->>'send_lease_token' IS DISTINCT FROM _lease_token::text
     OR delivery.provider_payload->>'meta_attempt_state' IS DISTINCT FROM 'contacting_meta' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries row
  SET status = _result_status,
      provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_build_object(
          'meta_attempt_state', 'completed_not_sent',
          'meta_attempt_completed_at', now()
        ),
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = NULLIF(left(COALESCE(_error_code, ''), 255), ''),
      error_message = NULLIF(left(COALESCE(_error_message, ''), 1000), ''),
      failed_at = CASE WHEN _result_status = 'failed' THEN now() ELSE delivery.failed_at END
  WHERE row.id = _delivery_id
  RETURNING row.status, row.provider_message_id
  INTO effective_status, provider_message_id;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_non_delivery_result"("_delivery_id" "uuid", "_lease_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_notification_event"("_delivery_id" "uuid", "_fallback_ok" boolean, "_fallback_error" "text", "_send_error" "text") RETURNS TABLE("effective_delivery_status" "text", "event_status" "text", "send_ok" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  target public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
  resolved_event_status text;
  resolved_send_ok boolean;
  resolved_error text;
  successful_whatsapp boolean;
  exhausted_retry boolean;
BEGIN
  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api';
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT delivery.* INTO target FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR target.channel <> 'whatsapp' OR target.provider <> 'meta_cloud_api'
     OR target.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel = 'whatsapp'
      AND sibling.provider = 'meta_cloud_api'
      AND sibling.status IN ('sent', 'delivered', 'read')
  ) INTO successful_whatsapp;

  exhausted_retry := target.status = 'queued'
    AND target.error_code = 'reconciliation_required'
    AND COALESCE((target.provider_payload->>'meta_attempt_count')::integer, 0) >= 2;
  resolved_send_ok := target.status IN ('sent', 'delivered', 'read') OR successful_whatsapp;
  resolved_event_status := CASE
    WHEN COALESCE(_fallback_ok, false) THEN 'sent'
    WHEN resolved_send_ok THEN 'sent'
    WHEN exhausted_retry THEN 'failed'
    WHEN target.status IN ('failed', 'undeliverable', 'skipped') THEN 'failed'
    ELSE 'processing'
  END;
  resolved_error := CASE
    WHEN COALESCE(_fallback_ok, false) AND NOT resolved_send_ok
      THEN 'WhatsApp falló; correo de respaldo enviado: '
        || left(COALESCE(target.error_message, _send_error, 'error desconocido'), 900)
    WHEN resolved_send_ok THEN NULL
    WHEN exhausted_retry
      THEN left(COALESCE(target.error_message,
        'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados'), 1000)
    ELSE left(COALESCE(_fallback_error, target.error_message, _send_error), 1000)
  END;

  UPDATE public.notification_events event
  SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE resolved_event_status END,
      processed_at = now(),
      processing_lease_token = CASE
        WHEN event.status = 'cancelled' OR resolved_event_status IN ('sent', 'failed')
          THEN NULL ELSE event.processing_lease_token END,
      error_message = CASE WHEN event.status = 'cancelled' THEN event.error_message ELSE resolved_error END
  WHERE event.id = target.notification_event_id
  RETURNING event.status INTO resolved_event_status;

  RETURN QUERY SELECT target.status, resolved_event_status, resolved_send_ok;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_notification_event"("_delivery_id" "uuid", "_fallback_ok" boolean, "_fallback_error" "text", "_send_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_pre_delivery_failure"("_event_id" "uuid", "_lease_token" "uuid", "_error_message" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  effective_status text;
BEGIN
  IF _event_id IS NULL OR _lease_token IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.notification_events
  SET status = CASE
        WHEN processing_attempts >= max_attempts THEN 'dead_letter'
        ELSE 'pending'
      END,
      processed_at = now(),
      processing_lease_token = NULL,
      error_message = left(
        COALESCE(NULLIF(btrim(_error_message), ''), 'Fallo anterior al envío WhatsApp'),
        1000
      )
  WHERE id = _event_id
    AND status = 'processing'
    AND processing_lease_token IS NOT DISTINCT FROM _lease_token
  RETURNING status INTO effective_status;

  RETURN effective_status;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_pre_delivery_failure"("_event_id" "uuid", "_lease_token" "uuid", "_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."finalize_whatsapp_pre_delivery_failure"("_event_id" "uuid", "_lease_token" "uuid", "_error_message" "text") IS 'Libera de forma cercada un fallo pre-delivery y lo lleva a dead_letter al agotar intentos.';



CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_send_attempt"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  IF event_row.id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE notification_event_id = locked_event_id
    AND id = (SELECT attempt.delivery_id FROM public.notification_delivery_attempts attempt
              WHERE attempt.id = _attempt_id);
  IF delivery_row.id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_attempt_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = delivery_row.id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id;

  IF attempt_row.claim_token IS DISTINCT FROM _attempt_token THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  IF attempt_row.state = 'accepted'
     AND attempt_row.provider_message_id = _provider_message_id THEN
    RETURN delivery_row.status;
  END IF;
  IF attempt_row.state <> 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;

  -- Un botón firmado con nonce puede haber atribuido provisionalmente el ID del
  -- intento síncrono al slot anterior. Solo el token de finalize demuestra qué
  -- POST devolvió ese ID; los status desconocidos jamás llegan a este camino.
  UPDATE public.notification_delivery_attempts other
  SET provider_message_id = NULL,
      correlation_source = NULL,
      state = CASE WHEN other.attempt_no = 1 THEN 'completed_uncertain' ELSE other.state END
  WHERE other.delivery_id = attempt_row.delivery_id
    AND other.id <> attempt_row.id
    AND other.provider_message_id = _provider_message_id
    AND other.correlation_source = 'button_callback';

  UPDATE public.notification_delivery_attempts attempt
  SET provider_message_id = _provider_message_id,
      provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      state = 'accepted', correlation_source = 'sync_response',
      finalized_at = COALESCE(_sent_at, now()), last_status = 'sent',
      status_occurred_at = COALESCE(_sent_at, now()), error_code = NULL, error_message = NULL
  WHERE attempt.id = _attempt_id;

  UPDATE public.notification_deliveries delivery
  SET provider_message_id = _provider_message_id,
      status = CASE WHEN delivery.status = 'queued' THEN 'sent' ELSE delivery.status END,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      sent_at = COALESCE(delivery.sent_at, _sent_at, now()),
      error_code = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_code END,
      error_message = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_message END
  WHERE delivery.id = attempt_row.delivery_id;

  -- Un status firmado puede llegar antes de la respuesta síncrona. Hasta este
  -- punto quedó pending/unmatched por provider ID; ahora se reproduce por ID
  -- exacto dentro de la misma transacción, nunca por teléfono.
  PERFORM replay.callback_id
  FROM public.replay_whatsapp_status_callbacks(_provider_message_id) replay;

  SELECT delivery.status INTO delivery_row.status
  FROM public.notification_deliveries delivery
  WHERE delivery.id = attempt_row.delivery_id;
  RETURN delivery_row.status;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_send_attempt"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_send_attempt_non_delivery"("_attempt_id" "uuid", "_attempt_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") RETURNS TABLE("effective_status" "text", "provider_message_id" "text", "reconciliation_required" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  locked_delivery_id uuid;
  result_row record;
BEGIN
  SELECT attempt.delivery_id, delivery.notification_event_id
  INTO locked_delivery_id, locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = locked_delivery_id AND notification_event_id = locked_event_id;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = locked_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id AND delivery_id = locked_delivery_id;
  IF attempt_row.id IS NULL OR attempt_row.claim_token IS DISTINCT FROM _attempt_token
     OR attempt_row.state <> 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  UPDATE public.notification_delivery_attempts attempt
  SET state = 'failed', finalized_at = now(), last_status = _result_status,
      provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = NULLIF(left(COALESCE(_error_code, ''), 255), ''),
      error_message = NULLIF(left(COALESCE(_error_message, ''), 1000), '')
  WHERE attempt.id = _attempt_id;
  SELECT * INTO result_row FROM public.finalize_whatsapp_non_delivery_result(
    attempt_row.delivery_id, attempt_row.event_lease_token, _result_status,
    _provider_response, _error_code, _error_message
  );
  RETURN QUERY SELECT result_row.effective_status, result_row.provider_message_id,
    result_row.reconciliation_required;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_send_attempt_non_delivery"("_attempt_id" "uuid", "_attempt_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_send_attempt_uncertain"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") RETURNS TABLE("effective_status" "text", "provider_message_id" "text", "reconciliation_required" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  attempt_row public.notification_delivery_attempts%ROWTYPE;
  delivery_row public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  locked_delivery_id uuid;
  result_row record;
BEGIN
  SELECT attempt.delivery_id, delivery.notification_event_id
  INTO locked_delivery_id, locked_event_id
  FROM public.notification_delivery_attempts attempt
  JOIN public.notification_deliveries delivery ON delivery.id = attempt.delivery_id
  WHERE attempt.id = _attempt_id;
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  PERFORM 1
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = locked_event_id
  ORDER BY delivery.id
  FOR UPDATE;
  SELECT * INTO delivery_row FROM public.notification_deliveries
  WHERE id = locked_delivery_id AND notification_event_id = locked_event_id;
  PERFORM 1
  FROM public.notification_delivery_attempts attempt
  WHERE attempt.delivery_id = locked_delivery_id
  ORDER BY attempt.attempt_no, attempt.id
  FOR UPDATE;
  SELECT * INTO attempt_row FROM public.notification_delivery_attempts
  WHERE id = _attempt_id AND delivery_id = locked_delivery_id;
  IF attempt_row.id IS NULL OR attempt_row.claim_token IS DISTINCT FROM _attempt_token THEN
    RAISE EXCEPTION 'stale_whatsapp_attempt_generation' USING ERRCODE = '22023';
  END IF;
  IF attempt_row.state = 'contacting_meta' THEN
    UPDATE public.notification_delivery_attempts attempt
    SET state = 'completed_uncertain', finalized_at = now(),
        provider_response = COALESCE(attempt.provider_response, '{}'::jsonb)
          || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
        error_code = 'reconciliation_required', error_message = left(_error_message, 1000)
    WHERE attempt.id = _attempt_id;
  END IF;
  SELECT * INTO result_row FROM public.finalize_uncertain_whatsapp_send_delivery(
    attempt_row.delivery_id, attempt_row.event_lease_token, _provider_response, _error_message
  );
  RETURN QUERY SELECT result_row.effective_status, result_row.provider_message_id,
    result_row.reconciliation_required;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_send_attempt_uncertain"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
BEGIN
  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT row.* INTO delivery
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR delivery.channel <> 'whatsapp' OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  IF delivery.provider_payload->>'send_lease_token' IS DISTINCT FROM _lease_token::text
     OR delivery.provider_payload->>'meta_attempt_state' IS DISTINCT FROM 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_send_generation' USING ERRCODE = '22023';
  END IF;
  IF delivery.provider_message_id IS NOT NULL AND delivery.provider_message_id <> _provider_message_id THEN
    RAISE EXCEPTION 'provider_message_id_conflict' USING ERRCODE = '23505';
  END IF;

  UPDATE public.notification_deliveries row
  SET provider_message_id = _provider_message_id,
      status = CASE WHEN delivery.status = 'queued' THEN 'sent' ELSE delivery.status END,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      sent_at = COALESCE(delivery.sent_at, _sent_at),
      error_code = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_code END,
      error_message = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_message END
  WHERE row.id = _delivery_id
  RETURNING row.status INTO delivery.status;
  RETURN delivery.status;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_whatsapp_unavailable_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  IF event_row.id IS NULL
     OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN false;
  END IF;

  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _event_id
  FOR UPDATE;
  IF delivery.id IS NULL
     OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api'
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
    RETURN false;
  END IF;

  UPDATE public.notification_deliveries
  SET status = 'skipped',
      error_code = 'channel_unavailable',
      error_message = left(COALESCE(_reason, 'Canal WhatsApp no disponible'), 1000)
  WHERE id = _delivery_id;

  UPDATE public.notification_events
  SET status = 'failed',
      processed_at = now(),
      processing_lease_token = NULL,
      error_message = left(COALESCE(_reason, 'Canal WhatsApp no disponible'), 1000)
  WHERE id = _event_id;

  RETURN true;
END;
$$;


ALTER FUNCTION "public"."finalize_whatsapp_unavailable_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid", "_completed" boolean, "_detail" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.notification_send_reconciliation_actions
  SET status = CASE WHEN _completed THEN 'completed' ELSE 'failed' END,
      completed_at = now(),
      result_detail = left(COALESCE(_detail, CASE WHEN _completed THEN 'completed' ELSE 'failed' END), 1000)
  WHERE id = _action_id
    AND claim_token = _claim_token
    AND status IN ('processing', 'effect_pending');
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."finish_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid", "_completed" boolean, "_detail" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_random_pin"() RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_random_pin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_short_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_short_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_next_client_entry"("_property_id" "uuid", "_from_date" "date") RETURNS TABLE("check_in_date" "date", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only administrators can view the next client entry'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidate_entries AS (
    SELECT reservation.check_in_date, reservation.updated_at
    FROM public.client_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.check_in_date >= _from_date
      AND lower(reservation.status) NOT IN ('cancelled', 'canceled')

    UNION ALL

    SELECT reservation.arrival_date AS check_in_date, reservation.updated_at
    FROM public.avantio_reservations AS reservation
    WHERE reservation.property_id = _property_id
      AND reservation.arrival_date >= _from_date
      AND reservation.cancellation_date IS NULL
      -- REQUESTED/provisional entries are not real future stays.
      AND lower(reservation.status) IN ('confirmed', 'modified')
  )
  SELECT candidate.check_in_date, candidate.updated_at
  FROM candidate_entries AS candidate
  ORDER BY candidate.check_in_date ASC, candidate.updated_at DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_admin_next_client_entry"("_property_id" "uuid", "_from_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bounded_whatsapp_retry_event_ids"("_limit" integer DEFAULT 50) RETURNS TABLE("event_id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT event.id
  FROM public.notification_events event
  JOIN public.notification_deliveries delivery
    ON delivery.notification_event_id = event.id
   AND delivery.channel = 'whatsapp'
   AND delivery.provider = 'meta_cloud_api'
  WHERE delivery.status = 'queued'
    AND delivery.provider_message_id IS NULL
    AND COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1) = 1
    AND (
      (
        delivery.error_code = 'reconciliation_required'
        AND delivery.provider_payload->>'meta_attempt_state'
          IN ('contacting_meta', 'completed_uncertain')
        AND (delivery.provider_payload->>'send_started_at')::timestamptz
          <= now() - interval '15 minutes'
        AND (
          event.status = 'failed'
          OR (
            event.status = 'processing'
            AND event.processed_at < now() - interval '15 minutes'
          )
        )
      )
      OR (
        delivery.error_code = 'bounded_retry_authorized'
        AND delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
        AND delivery.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
        AND event.status = 'processing'
        AND event.processed_at < now() - interval '10 minutes'
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.notification_deliveries fallback
      WHERE fallback.notification_event_id = event.id
        AND fallback.channel = 'email'
        AND fallback.template_name = 'task_rejected_admin_fallback_email'
    )
  ORDER BY delivery.created_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;


ALTER FUNCTION "public"."get_bounded_whatsapp_retry_event_ids"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_photos_visibility"("_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(photos_visible_to_client, false)
  FROM public.clients
  WHERE id = _client_id
$$;


ALTER FUNCTION "public"."get_client_photos_visibility"("_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_portal_access_history"("_client_id" "uuid", "_limit" integer DEFAULT 200, "_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "client_id" "uuid", "portal_access_id" "uuid", "access_type" "text", "actor_user_id" "uuid", "actor_name" "text", "actor_email" "text", "user_agent" "text", "ip_address" "text", "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el histórico de accesos';
  END IF;

  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.client_id,
    l.portal_access_id,
    l.access_type::text,
    l.actor_user_id,
    l.actor_name::text,
    l.actor_email::text,
    l.user_agent::text,
    l.ip_address::text,
    l.metadata,
    l.created_at
  FROM public.client_portal_access_logs l
  WHERE l.client_id = _client_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;


ALTER FUNCTION "public"."get_client_portal_access_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) RETURNS TABLE("task_id" "uuid", "operational_status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT
    task.id AS task_id,
    CASE
      WHEN task.status = 'completed'
        OR COALESCE(bool_or(report.overall_status = 'completed'), false)
        THEN 'completed'
      WHEN task.status = 'in-progress'
        OR COALESCE(bool_or(report.overall_status = 'in_progress'), false)
        THEN 'in-progress'
      ELSE 'pending'
    END AS operational_status
  FROM public.tasks AS task
  JOIN public.clients AS client
    ON client.id = task.cliente_id
  LEFT JOIN public.task_reports AS report
    ON report.task_id = task.id
  WHERE task.cliente_id = _client_id
    AND task.id = ANY(COALESCE(_task_ids, ARRAY[]::uuid[]))
    AND task.status <> 'cancelled'
    AND client.operational_portal_enabled = true
    AND cardinality(COALESCE(_task_ids, ARRAY[]::uuid[])) BETWEEN 1 AND 20000
    AND EXISTS (
      SELECT 1
      FROM public.client_portal_access AS portal_access
      WHERE portal_access.client_id = _client_id
        AND portal_access.is_active = true
    )
  GROUP BY task.id, task.status;
$$;


ALTER FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") RETURNS TABLE("client_id" "uuid", "allow_reservation_creation" boolean, "allow_extraordinary_requests" boolean, "allow_incidents" boolean, "operational_portal_enabled" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    id,
    allow_reservation_creation,
    allow_extraordinary_requests,
    allow_incidents,
    operational_portal_enabled
  FROM public.clients
  WHERE id = _client_id;
$$;


ALTER FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_reservation_history"("_client_id" "uuid", "_limit" integer DEFAULT 200, "_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "reservation_id" "uuid", "client_id" "uuid", "client_name" "text", "property_id" "uuid", "property_name" "text", "property_code" "text", "action" "text", "actor_type" "text", "actor_user_id" "uuid", "actor_name" "text", "actor_email" "text", "old_data" "jsonb", "new_data" "jsonb", "notes" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'No tienes permisos para consultar el histórico de reservas';
  END IF;

  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.reservation_id,
    l.client_id,
    c.nombre::text AS client_name,
    COALESCE(l.property_id, r.property_id, NULLIF((l.new_data->>'propertyId'),'')::uuid, NULLIF((l.old_data->>'propertyId'),'')::uuid) AS property_id,
    COALESCE(
      l.property_name,
      p.nombre,
      l.new_data->>'propertyName',
      l.old_data->>'propertyName'
    )::text AS property_name,
    p.codigo::text AS property_code,
    l.action::text AS action,
    l.actor_type::text AS actor_type,
    l.actor_user_id,
    l.actor_name::text AS actor_name,
    l.actor_email::text AS actor_email,
    l.old_data,
    l.new_data,
    l.notes::text AS notes,
    l.created_at
  FROM public.client_reservation_logs l
  LEFT JOIN public.clients c ON c.id = l.client_id
  LEFT JOIN public.client_reservations r ON r.id = l.reservation_id
  LEFT JOIN public.properties p
    ON p.id = COALESCE(
        l.property_id,
        r.property_id,
        NULLIF((l.new_data->>'propertyId'),'')::uuid,
        NULLIF((l.old_data->>'propertyId'),'')::uuid
      )
  WHERE l.client_id = _client_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;


ALTER FUNCTION "public"."get_client_reservation_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_user_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = auth.uid() 
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'supervisor' THEN 3
      WHEN 'cleaner' THEN 4
      WHEN 'client' THEN 5
      WHEN 'logistics' THEN 6
    END
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") RETURNS TABLE("id" "uuid", "date" "date", "start_time" time without time zone, "end_time" time without time zone, "property" "text", "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cleaner public.cleaners%ROWTYPE;
BEGIN
  SELECT * INTO v_cleaner
  FROM public.cleaners
  WHERE cleaners.id = _cleaner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trabajador no encontrado';
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT (
       public.user_is_admin_or_manager()
       AND v_cleaner.sede_id = ANY(public.get_user_accessible_sedes())
     ) THEN
    RAISE EXCEPTION 'No autorizado para consultar tareas de este trabajador'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    t.id, t.date, t.start_time, t.end_time, t.property, t.status
  FROM public.tasks t
  WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
    AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
    AND (
      EXISTS (
        SELECT 1 FROM public.task_assignments ta
        WHERE ta.task_id = t.id AND ta.cleaner_id = _cleaner_id
      )
      OR t.cleaner_id = _cleaner_id
      OR (t.cleaner_id IS NULL AND t.cleaner = v_cleaner.name)
    )
  ORDER BY t.date, t.start_time NULLS LAST, t.id;
END;
$$;


ALTER FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") IS 'Lista tareas futuras pendientes modernas o legadas para el diálogo de desactivación.';



CREATE OR REPLACE FUNCTION "public"."get_notification_send_reconciliation_queue"("_limit" integer DEFAULT 50) RETURNS TABLE("delivery_id" "uuid", "notification_event_id" "uuid", "channel" "text", "provider" "text", "recipient_masked" "text", "template_name" "text", "uncertainty_state" "text", "detail" "text", "created_at" timestamp with time zone, "open_action_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    delivery.id,
    delivery.notification_event_id,
    delivery.channel,
    delivery.provider,
    CASE
      WHEN length(regexp_replace(COALESCE(delivery.recipient, ''), '[^0-9]', '', 'g')) >= 4
        THEN 'â€¢â€¢â€¢â€¢ ' || right(regexp_replace(delivery.recipient, '[^0-9]', '', 'g'), 4)
      ELSE 'Oculto'
    END,
    delivery.template_name,
    CASE
      WHEN delivery.channel = 'whatsapp'
       AND delivery.provider_payload->>'meta_attempt_state' = 'completed_uncertain'
        THEN 'meta_uncertain'
      WHEN delivery.channel = 'whatsapp' THEN 'meta_contacting'
      ELSE 'resend_uncertain'
    END,
    left(COALESCE(delivery.error_message, 'Resultado incierto: comprobar el proveedor antes de resolver'), 500),
    delivery.created_at,
    action.status
  FROM public.notification_deliveries delivery
  LEFT JOIN LATERAL (
    SELECT candidate.status
    FROM public.notification_send_reconciliation_actions candidate
    WHERE candidate.delivery_id = delivery.id
      AND candidate.status IN ('pending', 'processing', 'effect_pending')
    ORDER BY candidate.requested_at DESC
    LIMIT 1
  ) action ON true
  WHERE delivery.status = 'queued'
    AND delivery.provider_message_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.notification_send_reconciliation_actions dismissed
      WHERE dismissed.delivery_id = delivery.id
        AND dismissed.resolution = 'dismissed'
        AND dismissed.status = 'completed'
    )
    AND (
      (
        delivery.channel = 'whatsapp'
        AND delivery.provider = 'meta_cloud_api'
        AND (
          delivery.error_code = 'reconciliation_required'
          OR delivery.provider_payload->>'send_started_at' IS NOT NULL
        )
      )
      OR (
        delivery.channel = 'email'
        AND delivery.provider = 'resend'
        AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
        AND delivery.provider_response->>'fallback_attempt_state'
          IN ('contacting_resend', 'reconciliation_required')
      )
    )
  ORDER BY delivery.created_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;


ALTER FUNCTION "public"."get_notification_send_reconciliation_queue"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_portal_reservation_dates_by_task_ids"("_task_ids" "uuid"[]) RETURNS TABLE("task_id" "uuid", "arrival_date" "date", "departure_date" "date", "adults" integer, "children" integer, "source" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    ar.task_id,
    ar.arrival_date,
    ar.departure_date,
    ar.adults,
    ar.children,
    'avantio'::text AS source
  FROM public.avantio_reservations ar
  WHERE ar.task_id = ANY(_task_ids)
    AND ar.status NOT IN ('cancelled', 'CANCELLED', 'Cancelled')
  UNION ALL
  SELECT
    hr.task_id,
    hr.arrival_date,
    hr.departure_date,
    hr.adults,
    NULL::int AS children,
    'hostaway'::text AS source
  FROM public.hostaway_reservations hr
  WHERE hr.task_id = ANY(_task_ids)
    AND hr.status <> 'cancelled';
$$;


ALTER FUNCTION "public"."get_portal_reservation_dates_by_task_ids"("_task_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_laundry_stock_consumptions"("token_param" "text") RETURNS TABLE("task_id" "uuid", "property_id" "uuid", "product_id" "uuid", "product_name" "text", "unit_of_measure" "text", "category_name" "text", "category_kind" "public"."stock_item_kind", "quantity" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH valid_link AS (
    SELECT
      l.id,
      l.snapshot_task_ids
    FROM public.laundry_share_links l
    WHERE l.token = token_param
      AND l.is_active = true
      AND (l.expires_at IS NULL OR l.expires_at > now())
    LIMIT 1
  )
  SELECT
    t.id AS task_id,
    p.id AS property_id,
    sp.id AS product_id,
    sp.name::TEXT AS product_name,
    sp.unit_of_measure::TEXT AS unit_of_measure,
    sc.name::TEXT AS category_name,
    sc.kind AS category_kind,
    r.quantity_per_cleaning AS quantity
  FROM valid_link l
  JOIN public.tasks t ON t.id = ANY(l.snapshot_task_ids)
  JOIN public.properties p ON p.id = t.propiedad_id
  JOIN public.stock_property_consumption_rules r ON r.property_id = p.id
  JOIN public.stock_products sp ON sp.id = r.product_id
  LEFT JOIN public.stock_categories sc ON sc.id = sp.category_id
  WHERE r.is_active = true
    AND r.quantity_per_cleaning > 0
    AND sp.is_active = true
    AND sp.is_consumable = true
    AND sp.sede_id = p.sede_id
    AND COALESCE(sc.kind, 'other'::public.stock_item_kind) <> 'laundry'::public.stock_item_kind
  ORDER BY
    t.date,
    p.codigo,
    CASE
      WHEN lower(coalesce(sc.name, '')) LIKE '%consumible%' THEN 10
      WHEN sc.kind = 'amenity'::public.stock_item_kind THEN 20
      ELSE 30
    END,
    sp.sort_order,
    sp.name;
$$;


ALTER FUNCTION "public"."get_public_laundry_stock_consumptions"("token_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_supervision_property_reservations"("_property_ids" "uuid"[]) RETURNS TABLE("property_id" "uuid", "check_in_date" "date", "check_out_date" "date", "status" "text", "source" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH context AS (
    SELECT (timezone('Europe/Madrid', now()))::DATE AS today_madrid
  ),
  allowed_properties AS (
    SELECT DISTINCT p.id
    FROM public.properties p
    JOIN public.property_group_assignments pga ON pga.property_id = p.id
    JOIN public.supervision_building_supervisors a ON a.property_group_id = pga.property_group_id
    WHERE p.id = ANY(COALESCE(_property_ids, ARRAY[]::UUID[]))
      AND (
        (
          public.user_is_admin_or_manager()
          AND public.user_has_sede_access(auth.uid(), p.sede_id)
        )
        OR (
          a.supervisor_user_id = auth.uid()
          AND a.is_active
          AND (a.starts_on IS NULL OR a.starts_on <= CURRENT_DATE)
          AND (a.ends_on IS NULL OR a.ends_on >= CURRENT_DATE)
          AND public.user_has_sede_access(auth.uid(), p.sede_id)
        )
      )
  )
  SELECT r.property_id, r.check_in_date, r.check_out_date, r.status::TEXT, 'client_portal'::TEXT
  FROM public.client_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) <> 'cancelled'
    AND r.check_out_date >= c.today_madrid
    AND r.check_in_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT, 'avantio'::TEXT
  FROM public.avantio_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.departure_date >= c.today_madrid
    AND r.arrival_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT, 'hostaway'::TEXT
  FROM public.hostaway_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.departure_date >= c.today_madrid
    AND r.arrival_date <= c.today_madrid + 365

  UNION ALL

  SELECT r.property_id, r.check_in, r.check_out, r.status::TEXT, 'smoobu'::TEXT
  FROM public.smoobu_reservations r
  JOIN allowed_properties ap ON ap.id = r.property_id
  CROSS JOIN context c
  WHERE lower(r.status::TEXT) NOT IN ('cancelled', 'canceled')
    AND r.check_out >= c.today_madrid
    AND r.check_in <= c.today_madrid + 365;
$$;


ALTER FUNCTION "public"."get_supervision_property_reservations"("_property_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_task_assignment_counts"("_task_ids" "uuid"[]) RETURNS TABLE("task_id" "uuid", "assignment_count" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    ta.task_id,
    count(*)::integer AS assignment_count
  FROM public.task_assignments ta
  WHERE ta.task_id = ANY(coalesce(_task_ids, '{}'::uuid[]))
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.task_assignments own_ta
        JOIN public.cleaners c ON c.id = own_ta.cleaner_id
        WHERE own_ta.task_id = ta.task_id
          AND c.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        JOIN public.cleaners c ON c.id = t.cleaner_id
        WHERE t.id = ta.task_id
          AND c.user_id = auth.uid()
      )
    )
  GROUP BY ta.task_id;
$$;


ALTER FUNCTION "public"."get_task_assignment_counts"("_task_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_accessible_sedes"() RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT array_agg(usa.sede_id) 
     FROM public.user_sede_access usa
     JOIN public.sedes s ON s.id = usa.sede_id
     WHERE usa.user_id = auth.uid() 
     AND usa.can_access = true 
     AND s.is_active = true),
    ARRAY[]::uuid[]
  );
$$;


ALTER FUNCTION "public"."get_user_accessible_sedes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_accessible_sedes"() IS 'Retorna array de UUIDs de sedes a las que el usuario actual tiene acceso';



CREATE OR REPLACE FUNCTION "public"."get_user_role"("_user_id" "uuid") RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'manager' THEN 2
      WHEN 'supervisor' THEN 3
      WHEN 'cleaner' THEN 4
      WHEN 'client' THEN 5
      WHEN 'logistics' THEN 6
    END
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_delivery_monitor"("_days" integer DEFAULT 7, "_status" "text" DEFAULT 'all'::"text", "_search" "text" DEFAULT ''::"text", "_limit" integer DEFAULT 50, "_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "notification_event_id" "uuid", "provider_message_ref" "text", "recipient_masked" "text", "template_name" "text", "status" "text", "error_code" "text", "error_detail" "text", "sent_at" timestamp with time zone, "delivered_at" timestamp with time zone, "read_at" timestamp with time zone, "failed_at" timestamp with time zone, "created_at" timestamp with time zone, "event_type" "text", "cleaner_name" "text", "property" "text", "task_date" "date", "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    delivery.id,
    delivery.notification_event_id,
    CASE WHEN delivery.provider_message_id IS NULL THEN NULL
      ELSE '…' || right(delivery.provider_message_id, 8) END,
    CASE WHEN length(delivery.recipient) <= 4 THEN '••••'
      ELSE '•••• ' || right(delivery.recipient, 4) END,
    delivery.template_name,
    delivery.status,
    delivery.error_code,
    left(regexp_replace(COALESCE(delivery.error_message, ''), '\+?[0-9][0-9 ()-]{6,}', '[teléfono oculto]', 'g'), 300),
    delivery.sent_at,
    delivery.delivered_at,
    delivery.read_at,
    delivery.failed_at,
    delivery.created_at,
    event.event_type,
    cleaner.name,
    task.property,
    task.date,
    count(*) OVER ()
  FROM public.notification_deliveries delivery
  JOIN public.notification_events event ON event.id = delivery.notification_event_id
  LEFT JOIN public.cleaners cleaner ON cleaner.id = event.cleaner_id
  LEFT JOIN public.tasks task ON task.id = event.task_id
  WHERE delivery.channel = 'whatsapp'
    AND delivery.created_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        event.sede_id IS NOT NULL
        AND task.sede_id = event.sede_id
        AND (event.cleaner_id IS NULL OR cleaner.sede_id = event.sede_id)
        AND public.user_has_sede_access(auth.uid(), event.sede_id)
      )
    )
    AND (
      _status = 'all'
      OR delivery.status = _status
      OR (_status = 'failed' AND delivery.status = 'undeliverable')
      OR (
        _status = 'attention'
        AND (
          delivery.status IN ('failed', 'undeliverable', 'skipped')
          OR (
            delivery.status = 'sent'
            AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
          )
          OR (
            delivery.status = 'queued'
            AND delivery.error_code = 'reconciliation_required'
          )
        )
      )
    )
    AND (
      btrim(_search) = ''
      OR cleaner.name ILIKE '%' || btrim(_search) || '%'
      OR task.property ILIKE '%' || btrim(_search) || '%'
      OR delivery.template_name ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY delivery.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(0, _offset);
END;
$$;


ALTER FUNCTION "public"."get_whatsapp_delivery_monitor"("_days" integer, "_status" "text", "_search" "text", "_limit" integer, "_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_delivery_monitor_stats"("_days" integer DEFAULT 7) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'sent', count(*) FILTER (WHERE delivery.status = 'sent'),
    'delivered', count(*) FILTER (WHERE delivery.status IN ('delivered', 'read')),
    'read', count(*) FILTER (WHERE delivery.status = 'read'),
    'failed', count(*) FILTER (WHERE delivery.status IN ('failed', 'undeliverable')),
    'skipped', count(*) FILTER (WHERE delivery.status = 'skipped'),
    'unconfirmed', count(*) FILTER (
      WHERE delivery.status = 'sent'
        AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
    ),
    'unresolved', count(*) FILTER (
      WHERE delivery.status IN ('failed', 'undeliverable', 'skipped')
         OR (
           delivery.status = 'sent'
           AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
         )
         OR (
           delivery.status = 'queued'
           AND delivery.error_code = 'reconciliation_required'
         )
    )
  ) INTO result
  FROM public.notification_deliveries delivery
  JOIN public.notification_events event ON event.id = delivery.notification_event_id
  JOIN public.tasks task ON task.id = event.task_id
  LEFT JOIN public.cleaners cleaner ON cleaner.id = event.cleaner_id
  WHERE delivery.channel = 'whatsapp'
    AND delivery.created_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        event.sede_id IS NOT NULL
        AND task.sede_id = event.sede_id
        AND (event.cleaner_id IS NULL OR cleaner.sede_id = event.sede_id)
        AND public.user_has_sede_access(auth.uid(), event.sede_id)
      )
    );
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_whatsapp_delivery_monitor_stats"("_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_notification_cron_status"() RETURNS TABLE("jobname" "text", "schedule" "text", "active" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT job.jobname::text, job.schedule::text, job.active
  FROM cron.job AS job
  WHERE job.jobname IN (
    'whatsapp-remind-unapproved',
    'whatsapp-remind-late-start',
    'whatsapp-process-pending'
  )
  ORDER BY job.jobname;
$$;


ALTER FUNCTION "public"."get_whatsapp_notification_cron_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_webhook_pending_count"("_days" integer DEFAULT 7) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Un callback aún no correlacionado no tiene sede fiable. Solo administración
  -- puede ver el agregado global; los managers reciben cero.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT count(*)
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.processing_status IN ('pending', 'manual_review')
      AND inbox.received_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
  );
END;
$$;


ALTER FUNCTION "public"."get_whatsapp_webhook_pending_count"("_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_webhook_reconciliation_queue"("_limit" integer DEFAULT 50) RETURNS TABLE("callback_kind" "text", "provider_message_ref" "text", "sender_masked" "text", "cleaner_name" "text", "callback_state" "text", "detail" "text", "attempts" integer, "received_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    inbox.callback_kind,
    'â€¦' || right(inbox.provider_message_id, 8),
    CASE WHEN inbox.sender IS NULL THEN 'â€”'
      ELSE 'â€¢â€¢â€¢â€¢ ' || right(regexp_replace(inbox.sender, '[^0-9]', '', 'g'), 4) END,
    COALESCE(
      NULLIF(event.recipient_name_snapshot, ''),
      NULLIF(cleaner.name, ''),
      NULLIF(task.cleaner, ''),
      'No identificada'
    ),
    inbox.processing_status,
    left(regexp_replace(
      COALESCE(inbox.outcome, inbox.last_error, 'Pendiente de correlaciÃ³n'),
      '\\+?[0-9][0-9 ()-]{6,}', '[telÃ©fono oculto]', 'g'
    ), 200),
    inbox.attempts,
    inbox.received_at
  FROM public.whatsapp_webhook_inbox inbox
  LEFT JOIN public.notification_deliveries delivery
    ON delivery.channel = 'whatsapp'
   AND delivery.provider = 'meta_cloud_api'
   AND delivery.provider_message_id = inbox.provider_message_id
  LEFT JOIN public.notification_events event
    ON event.id = delivery.notification_event_id
  LEFT JOIN public.tasks task
    ON task.id = COALESCE(event.task_id, inbox.task_id)
  LEFT JOIN public.cleaners cleaner
    ON cleaner.id = COALESCE(event.recipient_worker_id, event.cleaner_id, task.cleaner_id)
  WHERE inbox.processing_status IN ('pending', 'manual_review')
  ORDER BY inbox.received_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;


ALTER FUNCTION "public"."get_whatsapp_webhook_reconciliation_queue"("_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_cleaner_availability_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=NEW.day_of_week
   AND (NOT NEW.is_available OR t.start_time<NEW.start_time OR t.end_time>NEW.end_time)
 ) THEN RAISE EXCEPTION 'PLANNING_AVAILABILITY_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;


ALTER FUNCTION "public"."guard_cleaner_availability_planning_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_cleaner_deactivation_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
 IF OLD.is_active AND NOT NEW.is_active THEN
  PERFORM public.planning_lock_worker_dates(jsonb_build_array(jsonb_build_object('cleaner_id',NEW.id)));
  IF NULLIF(current_setting('app.planning_deactivation_cleaner_id',true),'') IS DISTINCT FROM NEW.id::text
     AND EXISTS(SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
                WHERE ta.cleaner_id=NEW.id AND t.status NOT IN ('completed','cancelled')) THEN
   RAISE EXCEPTION 'PLANNING_DEACTIVATION_REQUIRES_RPC' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."guard_cleaner_deactivation_planning_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_task_assignment_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE pairs jsonb:='[]'; t public.tasks%ROWTYPE;
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
  SELECT * INTO t FROM public.tasks WHERE id=OLD.task_id;
  IF FOUND THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id,'date',t.date)); END IF;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
  SELECT * INTO t FROM public.tasks WHERE id=NEW.task_id;
  IF FOUND THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id,'date',t.date)); END IF;
 END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND public.current_planning_batch_id() IS NULL THEN
  IF t.id IS NOT NULL THEN PERFORM public.planning_assert_worker_task_valid(NEW.cleaner_id,NEW.task_id,t.date,t.start_time,t.end_time,t.status); END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;


ALTER FUNCTION "public"."guard_task_assignment_planning_write"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_task_assignment_planning_write"() IS 'Guarda Planning 150 conservada sin trigger global; no bloquea writers legacy mientras v2 está OFF.';



CREATE OR REPLACE FUNCTION "public"."guard_task_schedule_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE pairs jsonb; cid uuid;
BEGIN
 IF ROW(OLD.date,OLD.start_time,OLD.end_time,OLD.status) IS NOT DISTINCT FROM ROW(NEW.date,NEW.start_time,NEW.end_time,NEW.status) THEN RETURN NEW; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cleaner_id',q.cid,'date',q.d)),'[]') INTO pairs FROM (
  SELECT ta.cleaner_id cid,OLD.date d FROM public.task_assignments ta WHERE ta.task_id=OLD.id
  UNION SELECT ta.cleaner_id,NEW.date FROM public.task_assignments ta WHERE ta.task_id=OLD.id
  UNION SELECT OLD.cleaner_id,OLD.date WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
  UNION SELECT OLD.cleaner_id,NEW.date WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
 )q;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF public.current_planning_batch_id() IS NULL THEN
  FOR cid IN SELECT DISTINCT ta.cleaner_id FROM public.task_assignments ta WHERE ta.task_id=OLD.id
             UNION SELECT OLD.cleaner_id WHERE OLD.cleaner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id=OLD.id)
  LOOP PERFORM public.planning_assert_worker_task_valid(cid,NEW.id,NEW.date,NEW.start_time,NEW.end_time,NEW.status); END LOOP;
 END IF;
 RETURN NEW;
END $$;


ALTER FUNCTION "public"."guard_task_schedule_planning_write"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_task_schedule_planning_write"() IS 'Guarda Planning 150 conservada sin trigger global; no bloquea reprogramaciones legacy mientras v2 está OFF.';



CREATE OR REPLACE FUNCTION "public"."guard_worker_absence_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  pairs jsonb := '[]';
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', OLD.cleaner_id));
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    pairs := pairs || jsonb_build_array(jsonb_build_object('cleaner_id', NEW.cleaner_id));
  END IF;

  PERFORM public.planning_lock_worker_dates(pairs);

  -- Do not reject the absence because of existing assignments. Registering
  -- the absence first is required to calculate and approve substitutions.
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."guard_worker_absence_planning_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_worker_fixed_day_off_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND NEW.is_active AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=NEW.day_of_week
 ) THEN RAISE EXCEPTION 'PLANNING_FIXED_DAY_OFF_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;


ALTER FUNCTION "public"."guard_worker_fixed_day_off_planning_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_worker_maintenance_planning_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE pairs jsonb:='[]';
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',OLD.cleaner_id)); END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN pairs:=pairs||jsonb_build_array(jsonb_build_object('cleaner_id',NEW.cleaner_id)); END IF;
 PERFORM public.planning_lock_worker_dates(pairs);
 IF TG_OP IN ('INSERT','UPDATE') AND NEW.is_active AND EXISTS(
  SELECT 1 FROM public.task_assignments ta JOIN public.tasks t ON t.id=ta.task_id
  WHERE ta.cleaner_id=NEW.cleaner_id AND t.status NOT IN ('completed','cancelled')
   AND extract(dow from t.date)::int=ANY(NEW.days_of_week)
   AND t.start_time<NEW.end_time AND NEW.start_time<t.end_time
 ) THEN RAISE EXCEPTION 'PLANNING_MAINTENANCE_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;


ALTER FUNCTION "public"."guard_worker_maintenance_planning_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_cleaner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Si el cleaner tiene user_id y sede_id, crear acceso automáticamente
  IF NEW.user_id IS NOT NULL AND NEW.sede_id IS NOT NULL THEN
    INSERT INTO public.user_sede_access (user_id, sede_id, can_access)
    VALUES (NEW.user_id, NEW.sede_id, true)
    ON CONFLICT (user_id, sede_id) DO UPDATE SET
      can_access = true,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_cleaner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro del usuario
    RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_portal_access"("_client_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE client_id = _client_id AND is_active = true
  );
$$;


ALTER FUNCTION "public"."has_active_portal_access"("_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_laundry_route_worker_pin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  source_pin TEXT;
BEGIN
  SELECT NULLIF(trim(c.pin), '') INTO source_pin
  FROM public.cleaners c
  WHERE c.id = NEW.cleaner_id;

  IF source_pin IS NULL THEN
    RAISE EXCEPTION 'ROUTE_WORKER_REQUIRES_REGISTRO_PIN';
  END IF;

  NEW.pin_hash := extensions.crypt(source_pin, extensions.gen_salt('bf', 10));
  NEW.pin_synced_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."hash_laundry_route_worker_pin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_laundry_route_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'dgomezlimpatex@gmail.com';
$$;


ALTER FUNCTION "public"."is_laundry_route_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_task_visible_to_client_portal"("_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.clients c ON c.id = t.cliente_id
    JOIN public.client_portal_access cpa ON cpa.client_id = c.id
    WHERE t.id = _task_id
      AND c.photos_visible_to_client = true
      AND cpa.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_task_visible_to_client_portal"("_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_avantio_cron_jobs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  jobs JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'jobid', jobid,
      'schedule', schedule,
      'command', command,
      'jobname', jobname,
      'active', active
    )
  )
  INTO jobs
  FROM cron.job
  WHERE jobname LIKE 'avantio_sync_%';
  
  RETURN COALESCE(jobs, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."list_avantio_cron_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_avirato_cron_jobs"() RETURNS TABLE("jobid" bigint, "schedule" "text", "command" "text", "active" boolean, "jobname" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT jobid, schedule, command, active, jobname
  FROM cron.job
  WHERE jobname LIKE 'avirato_sync_%'
  ORDER BY jobname;
$$;


ALTER FUNCTION "public"."list_avirato_cron_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_hostaway_cron_jobs"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  jobs jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'jobid', jobid,
      'schedule', schedule,
      'command', command,
      'jobname', jobname,
      'active', active
    )
  )
  INTO jobs
  FROM cron.job
  WHERE jobname LIKE 'hostaway_sync_%';
  
  RETURN COALESCE(jobs, '[]'::jsonb);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;


ALTER FUNCTION "public"."list_hostaway_cron_jobs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_client_portal_access"("_client_id" "uuid", "_portal_access_id" "uuid", "_access_type" "text", "_actor_user_id" "uuid" DEFAULT NULL::"uuid", "_actor_name" "text" DEFAULT NULL::"text", "_actor_email" "text" DEFAULT NULL::"text", "_user_agent" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_id UUID;
BEGIN
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'client_id es requerido';
  END IF;
  IF _access_type NOT IN ('client_pin', 'admin_bypass') THEN
    RAISE EXCEPTION 'access_type inválido';
  END IF;

  INSERT INTO public.client_portal_access_logs (
    client_id, portal_access_id, access_type,
    actor_user_id, actor_name, actor_email,
    user_agent, ip_address, metadata
  ) VALUES (
    _client_id, _portal_access_id, _access_type,
    _actor_user_id, _actor_name, _actor_email,
    _user_agent, inet_client_addr()::text, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."log_client_portal_access"("_client_id" "uuid", "_portal_access_id" "uuid", "_access_type" "text", "_actor_user_id" "uuid", "_actor_name" "text", "_actor_email" "text", "_user_agent" "text", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_security_event"("event_type" "text", "event_data" "jsonb" DEFAULT '{}'::"jsonb", "target_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Validar event_type
    IF event_type IS NULL OR trim(event_type) = '' THEN
        RAISE EXCEPTION 'event_type es requerido';
    END IF;

    INSERT INTO public.security_audit_log (
        event_type,
        user_id,
        event_data
    ) VALUES (
        event_type,
        COALESCE(target_user_id, auth.uid()),
        COALESCE(event_data, '{}'::jsonb)
    );
EXCEPTION
    WHEN OTHERS THEN
        -- No fallar si el log de seguridad tiene problemas
        RAISE WARNING 'Error logging security event: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."log_security_event"("event_type" "text", "event_data" "jsonb", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_sede_event"("event_type_param" "text", "from_sede_id_param" "uuid" DEFAULT NULL::"uuid", "to_sede_id_param" "uuid" DEFAULT NULL::"uuid", "event_data_param" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Validar parámetros de entrada
  IF event_type_param IS NULL OR trim(event_type_param) = '' THEN
    RAISE EXCEPTION 'event_type es requerido';
  END IF;

  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  INSERT INTO public.sede_audit_log (
    user_id,
    event_type,
    from_sede_id,
    to_sede_id,
    event_data,
    ip_address
  ) VALUES (
    auth.uid(),
    event_type_param,
    from_sede_id_param,
    to_sede_id_param,
    event_data_param,
    inet_client_addr()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar la operación principal
    RAISE WARNING 'Error logging sede event: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."log_sede_event"("event_type_param" "text", "from_sede_id_param" "uuid", "to_sede_id_param" "uuid", "event_data_param" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_worker_absence_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'absence', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'absence', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'absence', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_worker_absence_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_worker_fixed_days_off_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'fixed_day_off', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'fixed_day_off', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'fixed_day_off', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_worker_fixed_days_off_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_worker_maintenance_cleanings_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, new_data, changed_by)
    VALUES (NEW.id, 'maintenance_cleaning', 'created', NEW.cleaner_id, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, new_data, changed_by)
    VALUES (NEW.id, 'maintenance_cleaning', 'updated', NEW.cleaner_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.worker_absence_audit_log (reference_id, reference_type, action, cleaner_id, old_data, changed_by)
    VALUES (OLD.id, 'maintenance_cleaning', 'deleted', OLD.cleaner_id, row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_worker_maintenance_cleanings_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  result JSONB;
  job_id BIGINT;
BEGIN
  -- Primero, intentar desactivar el job si ya existe
  BEGIN
    PERFORM cron.unschedule(job_name);
    RAISE NOTICE 'Unscheduled existing job: %', job_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing job to unschedule: %', job_name;
  END;
  
  -- Crear el nuevo cron job
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $sql$,
      function_url,
      auth_header,
      request_body
    )
  ) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', cron_schedule
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$_$;


ALTER FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text" DEFAULT 'Europe/Madrid'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  result JSONB;
  job_id BIGINT;
  sql_command TEXT;
  parts TEXT[];
  local_minute INT;
  local_hour INT;
  utc_time TIMESTAMPTZ;
  utc_hour INT;
  utc_minute INT;
  utc_cron TEXT;
BEGIN
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Parse cron minute and hour to convert from local timezone to UTC
  parts := string_to_array(cron_schedule, ' ');
  local_minute := parts[1]::INT;
  local_hour := parts[2]::INT;
  
  -- Convert local time to UTC using PostgreSQL timezone handling
  utc_time := (('2026-01-01 ' || local_hour::TEXT || ':' || local_minute::TEXT || ':00')::TIMESTAMP 
               AT TIME ZONE job_timezone) AT TIME ZONE 'UTC';
  utc_hour := EXTRACT(HOUR FROM utc_time);
  utc_minute := EXTRACT(MINUTE FROM utc_time);
  
  utc_cron := utc_minute || ' ' || utc_hour || ' ' || array_to_string(parts[3:], ' ');
  
  sql_command := format(
    $sql$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := %L::jsonb
    ) as request_id;
    $sql$,
    function_url,
    auth_header,
    request_body
  );
  
  SELECT cron.schedule(job_name, utc_cron, sql_command) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', utc_cron,
    'local_schedule', cron_schedule,
    'timezone', job_timezone
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$_$;


ALTER FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_avirato_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text" DEFAULT 'Europe/Madrid'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  job_id bigint;
  utc_cron text;
  parts text[];
  local_hour int;
  summer_hour int;
  winter_hour int;
  hour_expression text;
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname = job_name;

  parts := string_to_array(cron_schedule, ' ');
  IF array_length(parts, 1) >= 2 AND job_timezone = 'Europe/Madrid' THEN
    local_hour := parts[2]::int;
    summer_hour := (local_hour + 22) % 24;
    winter_hour := (local_hour + 23) % 24;

    IF summer_hour = winter_hour THEN
      hour_expression := summer_hour::text;
    ELSIF summer_hour < winter_hour THEN
      hour_expression := summer_hour::text || ',' || winter_hour::text;
    ELSE
      hour_expression := winter_hour::text || ',' || summer_hour::text;
    END IF;

    parts[2] := hour_expression;
    utc_cron := array_to_string(parts, ' ');
  ELSE
    utc_cron := cron_schedule;
  END IF;

  SELECT cron.schedule(
    job_name,
    utc_cron,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      function_url,
      auth_header,
      request_body
    )
  )
  INTO job_id;

  RETURN jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'local_schedule', cron_schedule,
    'utc_schedule', utc_cron,
    'timezone', job_timezone
  );
END;
$$;


ALTER FUNCTION "public"."manage_avirato_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_hostaway_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  result jsonb;
  job_id bigint;
BEGIN
  -- Primero, intentar desactivar el job si ya existe
  BEGIN
    PERFORM cron.unschedule(job_name);
    RAISE NOTICE 'Unscheduled existing job: %', job_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing job to unschedule: %', job_name;
  END;
  
  -- Crear el nuevo cron job
  SELECT cron.schedule(
    job_name,
    cron_schedule,
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $sql$,
      function_url,
      auth_header,
      request_body
    )
  ) INTO job_id;
  
  result := jsonb_build_object(
    'success', true,
    'job_id', job_id,
    'job_name', job_name,
    'schedule', cron_schedule
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
    RETURN result;
END;
$_$;


ALTER FUNCTION "public"."manage_hostaway_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_whatsapp_webhook_callback"("_callback_id" "uuid", "_outcome" "text", "_processed" boolean, "_last_error" "text" DEFAULT NULL::"text", "_claim_token" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.whatsapp_webhook_inbox inbox
  SET processing_status = CASE
        WHEN _processed THEN 'processed'
        WHEN _outcome = 'retry_failed' THEN 'pending'
        WHEN _outcome IN (
          'unsupported_status', 'invalid_reconciliation_payload',
          'unsupported_action', 'correlation_exhausted'
        ) THEN 'manual_review'
        ELSE 'pending'
      END,
      outcome = left(COALESCE(_outcome, 'unknown'), 100),
      attempts = attempts + 1,
      processed_at = CASE
        WHEN _processed OR _outcome IN (
          'unsupported_status', 'invalid_reconciliation_payload',
          'unsupported_action', 'correlation_exhausted'
        ) THEN now()
        ELSE processed_at
      END,
      claimed_at = NULL,
      callback_claim_token = NULL,
      last_error = NULLIF(left(COALESCE(_last_error, ''), 1000), '')
  WHERE inbox.id = _callback_id
    AND (
      (
        inbox.processing_status = 'processing'
        AND _claim_token IS NOT NULL
        AND inbox.callback_claim_token = _claim_token
      )
      OR (
        inbox.processing_status = 'pending'
        AND _claim_token IS NULL
        AND inbox.callback_claim_token IS NULL
      )
    );
END;
$$;


ALTER FUNCTION "public"."mark_whatsapp_webhook_callback"("_callback_id" "uuid", "_outcome" "text", "_processed" boolean, "_last_error" "text", "_claim_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."materialize_recurring_task"("p_recurring_task_id" "uuid", "p_execution_date" "date", "p_next_execution" "date", "p_schedule_snapshot" "jsonb") RETURNS TABLE("generated_task_id" "uuid", "was_created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."materialize_recurring_task"("p_recurring_task_id" "uuid", "p_execution_date" "date", "p_next_execution" "date", "p_schedule_snapshot" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_spanish_phone_e164"("_raw" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog'
    AS $_$
DECLARE v text;
BEGIN
 IF _raw IS NULL OR btrim(_raw)='' OR _raw ~ '[*xX]' THEN RETURN NULL; END IF;
 v:=regexp_replace(btrim(_raw),'[^0-9]','','g');
 IF v LIKE '00%' THEN v:=substr(v,3); END IF;
 IF length(v)=11 AND left(v,2)='34' THEN v:=substr(v,3); END IF;
 IF v !~ '^[67][0-9]{8}$' THEN RETURN NULL; END IF;
 RETURN '+34'||v;
END $_$;


ALTER FUNCTION "public"."normalize_spanish_phone_e164"("_raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notification_event_is_live_send_allowed"("_mode" "text", "_batch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
 SELECT _mode='live' AND _batch_id IS NULL
$$;


ALTER FUNCTION "public"."notification_event_is_live_send_allowed"("_mode" "text", "_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."planning_assert_worker_task_valid"("_cleaner_id" "uuid", "_task_id" "uuid", "_date" "date", "_start" time without time zone, "_end" time without time zone, "_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
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
 IF EXISTS(SELECT 1 FROM public.worker_maintenance_cleanings wm WHERE wm.cleaner_id=_cleaner_id
   AND wm.is_active AND extract(dow from _date)::int=ANY(wm.days_of_week)
   AND _start<wm.end_time AND wm.start_time<_end) THEN
  RAISE EXCEPTION 'PLANNING_MAINTENANCE_OVERLAP' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.planning_effective_task_assignments() ea JOIN public.tasks t ON t.id=ea.task_id
   WHERE ea.cleaner_id=_cleaner_id AND t.id<>_task_id AND t.date=_date
   AND t.status NOT IN ('completed','cancelled') AND t.start_time<_end AND _start<t.end_time) THEN
  RAISE EXCEPTION 'PLANNING_EXTERNAL_OVERLAP' USING ERRCODE='23514';
 END IF;
END $$;


ALTER FUNCTION "public"."planning_assert_worker_task_valid"("_cleaner_id" "uuid", "_task_id" "uuid", "_date" "date", "_start" time without time zone, "_end" time without time zone, "_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."planning_batch_request_hash"("_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_notification_policy" "text", "_items" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
 SELECT encode(digest(convert_to(jsonb_build_object(
   'sede_id',_sede_id,'source_run_id',_source_run_id,'source_run_version',_source_run_version,
   'notification_policy',_notification_policy,'items',_items)::text,'UTF8'),'sha256'),'hex')
$$;


ALTER FUNCTION "public"."planning_batch_request_hash"("_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_notification_policy" "text", "_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."planning_effective_task_assignments"() RETURNS TABLE("task_id" "uuid", "cleaner_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
 SELECT ta.task_id,ta.cleaner_id FROM public.task_assignments ta
 UNION ALL
 SELECT t.id,t.cleaner_id FROM public.tasks t
 WHERE t.cleaner_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id)
 UNION ALL
 SELECT t.id,matched.cleaner_id FROM public.tasks t
 JOIN LATERAL (
   SELECT (array_agg(c.id ORDER BY c.id))[1] cleaner_id
   FROM public.cleaners c
   WHERE c.sede_id=t.sede_id AND c.is_active
     AND regexp_replace(lower(btrim(c.name)),'[[:space:]]+',' ','g')
         =regexp_replace(lower(btrim(t.cleaner)),'[[:space:]]+',' ','g')
   HAVING count(*)=1
 ) matched ON true
 WHERE t.cleaner_id IS NULL AND t.cleaner IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id)
$$;


ALTER FUNCTION "public"."planning_effective_task_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."planning_lock_worker_dates"("_pairs" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('planning-worker-scope:'||p.cid,0))
 FROM (SELECT DISTINCT x->>'cleaner_id' cid FROM jsonb_array_elements(COALESCE(_pairs,'[]'))x
       WHERE COALESCE(x->>'cleaner_id','')~*'^[0-9a-f-]{36}$' ORDER BY 1)p;
 PERFORM pg_advisory_xact_lock(hashtextextended('planning-worker-date:'||p.cid||':'||p.d,0))
 FROM (SELECT DISTINCT x->>'cleaner_id' cid,x->>'date' d FROM jsonb_array_elements(COALESCE(_pairs,'[]'))x
       WHERE COALESCE(x->>'cleaner_id','')~*'^[0-9a-f-]{36}$' AND COALESCE(x->>'date','')~'^\d{4}-\d{2}-\d{2}$'
       ORDER BY 1,2)p;
END $_$;


ALTER FUNCTION "public"."planning_lock_worker_dates"("_pairs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_authenticate_with_pin"("_identifier" "text", "_pin" "text") RETURNS TABLE("client_id" "uuid", "client_name" "text", "portal_token" "uuid", "short_code" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_rec RECORD;
  v_short text;
BEGIN
  IF _identifier IS NULL OR _pin IS NULL THEN
    RETURN;
  END IF;

  -- Extract short_code (last segment after last '-' if 8 chars, else whole)
  v_short := _identifier;
  IF position('-' in _identifier) > 0 THEN
    v_short := split_part(_identifier, '-', array_length(string_to_array(_identifier, '-'), 1));
  END IF;

  -- Try short_code match first
  SELECT cpa.id, cpa.client_id, cpa.portal_token, cpa.short_code, c.nombre AS client_name
  INTO v_rec
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.short_code = v_short
    AND cpa.access_pin = _pin
    AND cpa.is_active = true
  LIMIT 1;

  -- Fallback to legacy portal_token match (only if identifier looks like a UUID)
  IF v_rec.id IS NULL AND _identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT cpa.id, cpa.client_id, cpa.portal_token, cpa.short_code, c.nombre AS client_name
    INTO v_rec
    FROM public.client_portal_access cpa
    JOIN public.clients c ON c.id = cpa.client_id
    WHERE cpa.portal_token = _identifier::uuid
      AND cpa.access_pin = _pin
      AND cpa.is_active = true
    LIMIT 1;
  END IF;

  IF v_rec.id IS NULL THEN
    RETURN;
  END IF;

  -- Update last_access_at
  UPDATE public.client_portal_access
  SET last_access_at = now()
  WHERE id = v_rec.id;

  client_id := v_rec.client_id;
  client_name := v_rec.client_name::text;
  portal_token := v_rec.portal_token;
  short_code := v_rec.short_code;
  RETURN NEXT;
END;
$_$;


ALTER FUNCTION "public"."portal_authenticate_with_pin"("_identifier" "text", "_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_lookup_by_short_code"("_short_code" "text") RETURNS TABLE("client_id" "uuid", "client_name" "text", "short_code" "text", "is_active" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cpa.client_id, c.nombre::text, cpa.short_code, cpa.is_active
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.short_code = _short_code
    AND cpa.is_active = true
  LIMIT 1
$$;


ALTER FUNCTION "public"."portal_lookup_by_short_code"("_short_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_lookup_by_token"("_portal_token" "uuid") RETURNS TABLE("client_id" "uuid", "client_name" "text", "short_code" "text", "is_active" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cpa.client_id, c.nombre::text, cpa.short_code, cpa.is_active
  FROM public.client_portal_access cpa
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.portal_token = _portal_token
    AND cpa.is_active = true
  LIMIT 1
$$;


ALTER FUNCTION "public"."portal_lookup_by_token"("_portal_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prepare_whatsapp_send_delivery"("_event_id" "uuid", "_lease_token" "uuid", "_recipient" "text", "_template_name" "text", "_provider_payload" "jsonb") RETURNS TABLE("delivery_id" "uuid", "ready_to_send" boolean, "effective_status" "text", "provider_message_id" "text", "reconciliation_required" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  fallback public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row
  FROM public.notification_events
  WHERE id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN QUERY SELECT NULL::uuid, false, 'stale_lease'::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT * INTO fallback
  FROM public.notification_deliveries fallback_row
  WHERE fallback_row.notification_event_id = _event_id
    AND fallback_row.channel = 'email'
    AND fallback_row.template_name = 'task_rejected_admin_fallback_email'
  FOR UPDATE;
  IF fallback.id IS NOT NULL THEN
    UPDATE public.notification_events
    SET status = CASE WHEN fallback.status = 'sent' THEN 'sent' ELSE 'failed' END,
        processed_at = now(), processing_lease_token = NULL,
        error_message = CASE WHEN fallback.status = 'sent'
          THEN 'WhatsApp falló; correo de respaldo enviado'
          ELSE COALESCE(fallback.error_message, 'Fallback email reclamado o pendiente de conciliación') END
    WHERE id = _event_id;
    RETURN QUERY SELECT NULL::uuid, false,
      CASE WHEN fallback.status = 'sent' THEN 'fallback_sent' ELSE 'fallback_committed' END,
      fallback.provider_message_id, fallback.status = 'queued';
    RETURN;
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries row
  WHERE row.notification_event_id = _event_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api'
    AND row.status IN ('queued', 'sent', 'delivered', 'read')
  ORDER BY row.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF delivery.id IS NOT NULL THEN
    IF delivery.status IN ('sent', 'delivered', 'read') THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, false;
      RETURN;
    END IF;

    IF delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
       AND COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1) = 1 THEN
      UPDATE public.notification_deliveries
      SET recipient = _recipient,
          template_name = _template_name,
          provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
            || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
            || CASE
              WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
                THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
              WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
                THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
              ELSE '{}'::jsonb
            END
      WHERE id = delivery.id;
      RETURN QUERY SELECT delivery.id, true, 'retry_authorized'::text, NULL::text, false;
      RETURN;
    END IF;

    IF delivery.provider_message_id IS NOT NULL
       OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, true;
      RETURN;
    END IF;

    UPDATE public.notification_deliveries
    SET recipient = _recipient, template_name = _template_name,
        provider_payload = COALESCE(_provider_payload, '{}'::jsonb),
        error_code = NULL, error_message = NULL
    WHERE id = delivery.id;
    RETURN QUERY SELECT delivery.id, true, 'queued'::text, NULL::text, false;
    RETURN;
  END IF;

  INSERT INTO public.notification_deliveries (
    notification_event_id, channel, provider, recipient, template_name,
    status, provider_payload
  ) VALUES (
    _event_id, 'whatsapp', 'meta_cloud_api', _recipient, _template_name,
    'queued', COALESCE(_provider_payload, '{}'::jsonb)
  ) RETURNING * INTO delivery;

  RETURN QUERY SELECT delivery.id, true, delivery.status,
    delivery.provider_message_id, false;
END;
$$;


ALTER FUNCTION "public"."prepare_whatsapp_send_delivery"("_event_id" "uuid", "_lease_token" "uuid", "_recipient" "text", "_template_name" "text", "_provider_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preserve_supervision_audit_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'supervision_reviews' THEN
    NEW.reviewer_user_id := OLD.reviewer_user_id;
  ELSIF TG_TABLE_NAME = 'supervision_incidents' THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."preserve_supervision_audit_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.is_active = true
     AND NEW.is_active = false
     AND EXISTS (
       SELECT 1
       FROM public.tasks t
       WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
         AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
         AND (
           EXISTS (
             SELECT 1
             FROM public.task_assignments ta
             WHERE ta.task_id = t.id
               AND ta.cleaner_id = OLD.id
           )
           OR t.cleaner_id = OLD.id
           OR (
             t.cleaner_id IS NULL
             AND t.cleaner = OLD.name
           )
         )
     ) THEN
    RAISE EXCEPTION 'No se puede desactivar a la trabajadora mientras tenga tareas futuras pendientes. Usa el flujo de baja para desasignarlas.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() IS 'Bloquea bajas directas que dejarían tareas futuras ligadas a una trabajadora inactiva.';



CREATE OR REPLACE FUNCTION "public"."prevent_notification_event_snapshot_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.snapshot IS NOT NULL AND OLD.snapshot IS DISTINCT FROM NEW.snapshot THEN
    RAISE EXCEPTION 'notification_event_snapshot_is_immutable'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_notification_event_snapshot_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_automatic_inventory_consumption"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  property_data RECORD;
  mapping_record RECORD;
  amenity_quantity INTEGER;
  current_stock_record RECORD;
  movement_reason TEXT;
BEGIN
  -- Validate inputs
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'Todos los parámetros son requeridos';
  END IF;
  
  -- Validar que el usuario esté autenticado y tenga permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_id_param 
    AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado para procesar consumo de inventario';
  END IF;
  
  -- Obtener datos de la propiedad
  SELECT * INTO property_data 
  FROM public.properties 
  WHERE id = property_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Propiedad no encontrada';
  END IF;
  
  movement_reason := 'Consumo automático por limpieza completada en ' || property_data.nombre;
  
  -- Procesar cada mapeo de amenity a producto
  FOR mapping_record IN 
    SELECT * FROM public.property_amenity_inventory_mapping 
    WHERE is_active = true
  LOOP
    -- Obtener la cantidad del amenity específico de la propiedad
    CASE mapping_record.amenity_field
      WHEN 'numero_sabanas' THEN amenity_quantity := property_data.numero_sabanas;
      WHEN 'numero_toallas_grandes' THEN amenity_quantity := property_data.numero_toallas_grandes;
      WHEN 'numero_toallas_pequenas' THEN amenity_quantity := property_data.numero_toallas_pequenas;
      WHEN 'numero_alfombrines' THEN amenity_quantity := property_data.numero_alfombrines;
      WHEN 'numero_fundas_almohada' THEN amenity_quantity := property_data.numero_fundas_almohada;
      WHEN 'kit_alimentario' THEN amenity_quantity := property_data.kit_alimentario;
      ELSE amenity_quantity := 0;
    END CASE;
    
    -- Solo procesar si hay cantidad a consumir
    IF amenity_quantity > 0 THEN
      -- Obtener stock actual
      SELECT * INTO current_stock_record
      FROM public.inventory_stock
      WHERE product_id = mapping_record.product_id;
      
      IF FOUND THEN
        -- Crear movimiento de salida
        INSERT INTO public.inventory_movements (
          product_id,
          movement_type,
          quantity,
          previous_quantity,
          new_quantity,
          reason,
          created_by,
          property_id,
          task_id
        ) VALUES (
          mapping_record.product_id,
          'salida',
          amenity_quantity,
          current_stock_record.current_quantity,
          current_stock_record.current_quantity - amenity_quantity,
          movement_reason,
          user_id_param,
          property_id_param,
          task_id_param
        );
        
        -- Actualizar stock
        UPDATE public.inventory_stock 
        SET 
          current_quantity = current_quantity - amenity_quantity,
          updated_by = user_id_param
        WHERE product_id = mapping_record.product_id;
        
        -- Crear alerta si el stock queda bajo
        INSERT INTO public.inventory_alerts (
          product_id,
          alert_type
        )
        SELECT 
          mapping_record.product_id,
          CASE 
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= 0 THEN 'sin_stock'
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= current_stock_record.minimum_stock THEN 'stock_bajo'
            ELSE NULL
          END
        WHERE 
          CASE 
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= 0 THEN 'sin_stock'
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= current_stock_record.minimum_stock THEN 'stock_bajo'
            ELSE NULL
          END IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.inventory_alerts 
            WHERE product_id = mapping_record.product_id 
            AND is_active = true
          );
      END IF;
    END IF;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero permitir que la tarea continúe
    PERFORM public.log_security_event('inventory_consumption_error', jsonb_build_object(
      'error', SQLERRM,
      'task_id', task_id_param,
      'property_id', property_id_param
    ), user_id_param);
    RAISE WARNING 'Error en consumo automático de inventario: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."process_automatic_inventory_consumption"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_laundry_dirty_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  property_data RECORD;
  task_data RECORD;
  consumption_record RECORD;
  dirty_record RECORD;
  warehouse_id_resolved UUID;
  quantity_to_add NUMERIC(12, 2);
  movement_reason TEXT;
  added_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'task_id, property_id and user_id are required';
  END IF;

  IF auth.uid() IS NULL OR user_id_param <> auth.uid() THEN
    RAISE EXCEPTION 'The acting user must match the authenticated user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'User not allowed to process dirty laundry';
  END IF;

  SELECT id, propiedad_id, sede_id, type, status
  INTO task_data
  FROM public.tasks
  WHERE id = task_id_param;

  IF task_data.id IS NULL
    OR task_data.propiedad_id <> property_id_param
    OR task_data.type <> 'limpieza-turistica'
    OR task_data.status <> 'completed'
  THEN
    RAISE EXCEPTION 'Completed cleaning task not found';
  END IF;

  SELECT *
  INTO property_data
  FROM public.properties
  WHERE id = property_id_param
    AND sede_id = task_data.sede_id;

  IF property_data.id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  movement_reason := 'Ropa sucia por limpieza completada en '
    || COALESCE(property_data.nombre, property_data.codigo, property_id_param::TEXT);

  FOR consumption_record IN
    SELECT source.product_id, source.warehouse_id, SUM(source.quantity)::NUMERIC(12, 2) AS quantity
    FROM (
      SELECT
        r.product_id,
        r.warehouse_id,
        r.quantity_per_cleaning AS quantity
      FROM public.stock_property_consumption_rules r
      JOIN public.stock_products p ON p.id = r.product_id
      JOIN public.stock_categories sc ON sc.id = p.category_id
      WHERE r.property_id = property_id_param
        AND r.is_active = true
        AND p.sede_id = task_data.sede_id
        AND p.is_active = true
        AND sc.kind = 'laundry'::public.stock_item_kind

      UNION ALL

      SELECT
        m.product_id,
        m.warehouse_id,
        (
          CASE m.property_field
            WHEN 'numero_sabanas' THEN COALESCE(property_data.numero_sabanas, 0)
            WHEN 'numero_sabanas_pequenas' THEN COALESCE(property_data.numero_sabanas_pequenas, 0)
            WHEN 'numero_sabanas_suite' THEN COALESCE(property_data.numero_sabanas_suite, 0)
            WHEN 'numero_toallas_grandes' THEN COALESCE(property_data.numero_toallas_grandes, 0)
            WHEN 'numero_toallas_pequenas' THEN COALESCE(property_data.numero_toallas_pequenas, 0)
            WHEN 'numero_alfombrines' THEN COALESCE(property_data.numero_alfombrines, 0)
            WHEN 'numero_fundas_almohada' THEN COALESCE(property_data.numero_fundas_almohada, 0)
            ELSE 0
          END
        )::NUMERIC(12, 2) * m.multiplier AS quantity
      FROM public.stock_property_field_mappings m
      JOIN public.stock_products p ON p.id = m.product_id
      JOIN public.stock_categories sc ON sc.id = p.category_id
      WHERE m.sede_id = task_data.sede_id
        AND m.is_active = true
        AND p.is_active = true
        AND sc.kind = 'laundry'::public.stock_item_kind
        AND NOT EXISTS (
          SELECT 1
          FROM public.stock_property_consumption_rules r
          WHERE r.property_id = property_id_param
            AND r.product_id = m.product_id
            AND r.is_active = true
        )
    ) AS source
    GROUP BY source.product_id, source.warehouse_id
  LOOP
    quantity_to_add := COALESCE(consumption_record.quantity, 0);

    IF quantity_to_add <= 0 THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(
      consumption_record.warehouse_id,
      property_data.default_stock_warehouse_id,
      (
        SELECT w.id
        FROM public.stock_warehouses w
        WHERE w.sede_id = task_data.sede_id
          AND w.is_default = true
          AND w.is_active = true
        LIMIT 1
      )
    )
    INTO warehouse_id_resolved;

    IF NOT EXISTS (
      SELECT 1
      FROM public.stock_warehouses w
      WHERE w.id = warehouse_id_resolved
        AND w.sede_id = task_data.sede_id
        AND w.is_active = true
    ) THEN
      RAISE EXCEPTION 'No valid stock warehouse found for property %', property_id_param;
    END IF;

    INSERT INTO public.laundry_dirty_stock (product_id, warehouse_id, current_quantity, updated_by)
    VALUES (consumption_record.product_id, warehouse_id_resolved, 0, user_id_param)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT *
    INTO dirty_record
    FROM public.laundry_dirty_stock
    WHERE product_id = consumption_record.product_id
      AND warehouse_id = warehouse_id_resolved
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.laundry_dirty_movements dm
      WHERE dm.task_id = task_id_param
        AND dm.product_id = consumption_record.product_id
        AND dm.warehouse_id = warehouse_id_resolved
        AND dm.movement_type = 'entrada'
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.laundry_dirty_stock
    SET current_quantity = current_quantity + quantity_to_add,
        updated_by = user_id_param
    WHERE id = dirty_record.id;

    INSERT INTO public.laundry_dirty_movements (
      product_id,
      warehouse_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      task_id,
      property_id,
      created_by
    )
    VALUES (
      consumption_record.product_id,
      warehouse_id_resolved,
      'entrada',
      quantity_to_add,
      dirty_record.current_quantity,
      dirty_record.current_quantity + quantity_to_add,
      movement_reason,
      task_id_param,
      property_id_param,
      user_id_param
    );

    added_count := added_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'added', added_count,
    'skipped', skipped_count
  );
END;
$$;


ALTER FUNCTION "public"."process_laundry_dirty_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_stock_consumption_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  property_data RECORD;
  sede_settings RECORD;
  consumption_record RECORD;
  stock_record RECORD;
  warehouse_id_resolved UUID;
  movement_reason TEXT;
  quantity_to_consume NUMERIC(12, 2);
  consumed_count INTEGER := 0;
  skipped_count INTEGER := 0;
  alert_count INTEGER := 0;
BEGIN
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'task_id, property_id and user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'User not allowed to process stock consumption';
  END IF;

  SELECT * INTO property_data
  FROM public.properties
  WHERE id = property_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT * INTO sede_settings
  FROM public.stock_sede_settings
  WHERE sede_id = property_data.sede_id;

  IF COALESCE(sede_settings.auto_consumption_enabled, false) = false
    OR COALESCE(sede_settings.preparation_mode, true) = true
  THEN
    RETURN jsonb_build_object(
      'disabled', true,
      'reason', 'stock_auto_consumption_disabled',
      'consumed', 0,
      'skipped', 0,
      'alerts', 0
    );
  END IF;

  movement_reason := 'Consumo automatico por tarea completada en ' || COALESCE(property_data.nombre, property_data.codigo, property_id_param::TEXT);

  FOR consumption_record IN
    SELECT
      r.product_id,
      r.warehouse_id,
      r.quantity_per_cleaning AS quantity
    FROM public.stock_property_consumption_rules r
    JOIN public.stock_products p ON p.id = r.product_id
    WHERE r.property_id = property_id_param
      AND r.is_active = true
      AND p.sede_id = property_data.sede_id
      AND p.is_active = true
      AND p.is_consumable = true

    UNION ALL

    SELECT
      m.product_id,
      m.warehouse_id,
      (
        CASE m.property_field
          WHEN 'numero_sabanas' THEN COALESCE(property_data.numero_sabanas, 0)
          WHEN 'numero_sabanas_pequenas' THEN COALESCE(property_data.numero_sabanas_pequenas, 0)
          WHEN 'numero_sabanas_suite' THEN COALESCE(property_data.numero_sabanas_suite, 0)
          WHEN 'numero_toallas_grandes' THEN COALESCE(property_data.numero_toallas_grandes, 0)
          WHEN 'numero_toallas_pequenas' THEN COALESCE(property_data.numero_toallas_pequenas, 0)
          WHEN 'numero_alfombrines' THEN COALESCE(property_data.numero_alfombrines, 0)
          WHEN 'numero_fundas_almohada' THEN COALESCE(property_data.numero_fundas_almohada, 0)
          WHEN 'amenities_bano' THEN COALESCE(property_data.amenities_bano, 0)
          WHEN 'amenities_cocina' THEN COALESCE(property_data.amenities_cocina, 0)
          WHEN 'cantidad_rollos_papel_higienico' THEN COALESCE(property_data.cantidad_rollos_papel_higienico, 0)
          WHEN 'cantidad_rollos_papel_cocina' THEN COALESCE(property_data.cantidad_rollos_papel_cocina, 0)
          WHEN 'kit_alimentario' THEN COALESCE(property_data.kit_alimentario, 0)
          WHEN 'bayetas_cocina' THEN COALESCE(property_data.bayetas_cocina, 0)
          WHEN 'bolsas_basura' THEN COALESCE(property_data.bolsas_basura, 0)
          ELSE 0
        END
      )::NUMERIC(12, 2) * m.multiplier AS quantity
    FROM public.stock_property_field_mappings m
    JOIN public.stock_products p ON p.id = m.product_id
    WHERE m.sede_id = property_data.sede_id
      AND m.is_active = true
      AND p.is_active = true
      AND p.is_consumable = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.stock_property_consumption_rules r
        WHERE r.property_id = property_id_param
          AND r.product_id = m.product_id
          AND r.is_active = true
      )
  LOOP
    quantity_to_consume := COALESCE(consumption_record.quantity, 0);

    IF quantity_to_consume <= 0 THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT COALESCE(
      consumption_record.warehouse_id,
      property_data.default_stock_warehouse_id,
      (
        SELECT w.id
        FROM public.stock_warehouses w
        WHERE w.sede_id = property_data.sede_id
          AND w.is_default = true
          AND w.is_active = true
        LIMIT 1
      )
    )
    INTO warehouse_id_resolved;

    IF warehouse_id_resolved IS NULL THEN
      RAISE EXCEPTION 'No default stock warehouse found for property %', property_id_param;
    END IF;

    INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity, updated_by)
    VALUES (consumption_record.product_id, warehouse_id_resolved, 0, 0, 0, user_id_param)
    ON CONFLICT (product_id, warehouse_id) DO NOTHING;

    SELECT * INTO stock_record
    FROM public.stock_levels
    WHERE product_id = consumption_record.product_id
      AND warehouse_id = warehouse_id_resolved
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.task_id = task_id_param
        AND sm.product_id = consumption_record.product_id
        AND sm.warehouse_id = warehouse_id_resolved
        AND sm.movement_type = 'consumo_automatico'
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    IF stock_record.current_quantity < quantity_to_consume THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        'stock_critico'
      );
      alert_count := alert_count + 1;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    UPDATE public.stock_levels
    SET
      current_quantity = current_quantity - quantity_to_consume,
      updated_by = user_id_param
    WHERE id = stock_record.id;

    INSERT INTO public.stock_movements (
      product_id,
      warehouse_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason,
      task_id,
      property_id,
      created_by
    )
    VALUES (
      consumption_record.product_id,
      warehouse_id_resolved,
      'consumo_automatico',
      quantity_to_consume,
      stock_record.current_quantity,
      stock_record.current_quantity - quantity_to_consume,
      movement_reason,
      task_id_param,
      property_id_param,
      user_id_param
    );

    consumed_count := consumed_count + 1;

    IF stock_record.current_quantity - quantity_to_consume <= stock_record.minimum_quantity THEN
      PERFORM public.create_stock_alert_if_needed(
        stock_record.id,
        consumption_record.product_id,
        warehouse_id_resolved,
        CASE
          WHEN stock_record.current_quantity - quantity_to_consume = 0 THEN 'stock_critico'::public.stock_alert_type
          ELSE 'stock_bajo'::public.stock_alert_type
        END
      );
      alert_count := alert_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'disabled', false,
    'consumed', consumed_count,
    'skipped', skipped_count,
    'alerts', alert_count
  );
END;
$$;


ALTER FUNCTION "public"."process_stock_consumption_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_whatsapp_webhook_inbox"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.whatsapp_webhook_inbox inbox
  WHERE (
      inbox.processing_status = 'processed'
      AND inbox.received_at < now() - interval '30 days'
    )
    OR inbox.received_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_whatsapp_webhook_inbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_whatsapp_webhook_callback"("_callback_key" "text", "_callback_kind" "text", "_provider_message_id" "text", "_whatsapp_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_delivery_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text" DEFAULT NULL::"text") RETURNS TABLE("callback_id" "uuid", "processing_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF COALESCE(btrim(_callback_key), '') = ''
     OR _callback_kind NOT IN ('status', 'button')
     OR COALESCE(btrim(_provider_message_id), '') = ''
     OR _occurred_at IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_callback' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.whatsapp_webhook_inbox AS inbox (
    callback_key, callback_kind, provider_message_id, whatsapp_message_id,
    sender, button_payload, action, task_id, delivery_status, occurred_at,
    error_message
  ) VALUES (
    left(_callback_key, 500), _callback_kind, left(_provider_message_id, 500),
    NULLIF(left(COALESCE(_whatsapp_message_id, ''), 500), ''),
    NULLIF(left(COALESCE(_sender, ''), 100), ''),
    NULLIF(left(COALESCE(_button_payload, ''), 500), ''),
    NULLIF(left(COALESCE(_action, ''), 50), ''), _task_id,
    NULLIF(left(COALESCE(_delivery_status, ''), 30), ''), _occurred_at,
    NULLIF(left(COALESCE(_error_message, ''), 1000), '')
  )
  ON CONFLICT (callback_key) DO UPDATE
    SET received_at = LEAST(inbox.received_at, EXCLUDED.received_at)
  RETURNING inbox.id, inbox.processing_status;
END;
$$;


ALTER FUNCTION "public"."record_whatsapp_webhook_callback"("_callback_key" "text", "_callback_kind" "text", "_provider_message_id" "text", "_whatsapp_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_delivery_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_whatsapp_webhook_quarantine"("_callback_key" "text", "_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  quarantined_id uuid;
BEGIN
  IF COALESCE(btrim(_callback_key), '') = ''
     OR COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'invalid_whatsapp_quarantine' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.whatsapp_webhook_inbox AS inbox (
    callback_key, callback_kind, provider_message_id, occurred_at,
    processing_status, outcome, attempts, processed_at, last_error
  ) VALUES (
    left(_callback_key, 500), 'quarantine', left(_callback_key, 500), now(),
    'manual_review', left(_reason, 100), 1, now(), left(_reason, 1000)
  )
  ON CONFLICT (callback_key) DO UPDATE
    SET received_at = LEAST(inbox.received_at, EXCLUDED.received_at),
        processing_status = 'manual_review',
        outcome = EXCLUDED.outcome,
        attempts = inbox.attempts + 1,
        processed_at = COALESCE(inbox.processed_at, now()),
        last_error = EXCLUDED.last_error
  RETURNING inbox.id INTO quarantined_id;

  RETURN quarantined_id;
END;
$$;


ALTER FUNCTION "public"."record_whatsapp_webhook_quarantine"("_callback_key" "text", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_supervision_stop"("_stop_id" "uuid", "_neighbor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_stop public.supervision_route_stops;
  neighbor_stop public.supervision_route_stops;
  route_sede UUID;
  route_status public.supervision_route_status;
  temporary_sequence INTEGER;
BEGIN
  PERFORM 1
  FROM public.supervision_route_stops
  WHERE id IN (_stop_id, _neighbor_id)
  ORDER BY id
  FOR UPDATE;

  SELECT s.*
  INTO current_stop
  FROM public.supervision_route_stops s
  WHERE s.id = _stop_id;

  SELECT r.sede_id, r.status
  INTO route_sede, route_status
  FROM public.supervision_routes r
  WHERE r.id = current_stop.route_id;

  SELECT s.*
  INTO neighbor_stop
  FROM public.supervision_route_stops s
  WHERE s.id = _neighbor_id;

  IF current_stop.id IS NULL OR neighbor_stop.id IS NULL THEN
    RAISE EXCEPTION 'supervision stop not found';
  END IF;
  IF current_stop.route_id IS DISTINCT FROM neighbor_stop.route_id THEN
    RAISE EXCEPTION 'supervision stops must belong to the same route';
  END IF;
  IF route_status = 'completed' THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF NOT public.supervision_user_can_access_sede(route_sede) THEN
    RAISE EXCEPTION 'supervision route access denied';
  END IF;

  SELECT COALESCE(MIN(sequence), 0) - 1
  INTO temporary_sequence
  FROM public.supervision_route_stops
  WHERE route_id = current_stop.route_id;

  UPDATE public.supervision_route_stops
  SET sequence = temporary_sequence
  WHERE id = current_stop.id;

  UPDATE public.supervision_route_stops
  SET sequence = current_stop.sequence
  WHERE id = neighbor_stop.id;

  UPDATE public.supervision_route_stops
  SET sequence = neighbor_stop.sequence
  WHERE id = current_stop.id;
END;
$$;


ALTER FUNCTION "public"."reorder_supervision_stop"("_stop_id" "uuid", "_neighbor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replay_whatsapp_status_callbacks"("_provider_message_id" "text") RETURNS TABLE("callback_id" "uuid", "notification_event_id" "uuid", "effective_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  pending public.whatsapp_webhook_inbox%ROWTYPE;
  transition record;
BEGIN
  FOR pending IN
    SELECT inbox.*
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.callback_kind = 'status'
      AND inbox.processing_status = 'pending'
      AND inbox.provider_message_id = _provider_message_id
    ORDER BY inbox.occurred_at, inbox.received_at
    FOR UPDATE
  LOOP
    SELECT * INTO transition
    FROM public.apply_whatsapp_delivery_status(
      pending.provider_message_id,
      pending.delivery_status,
      pending.occurred_at,
      pending.error_message
    );

    IF FOUND THEN
      UPDATE public.whatsapp_webhook_inbox inbox
      SET processing_status = CASE
            WHEN transition.effective_status = 'failed' THEN 'pending'
            ELSE 'processed'
          END,
          outcome = transition.effective_status,
          attempts = inbox.attempts + 1,
          processed_at = CASE
            WHEN transition.effective_status = 'failed' THEN NULL
            ELSE now()
          END,
          last_error = CASE
            WHEN transition.effective_status = 'failed' THEN 'awaiting_admin_fallback'
            ELSE NULL
          END
      WHERE inbox.id = pending.id;
      callback_id := pending.id;
      notification_event_id := transition.notification_event_id;
      effective_status := transition.effective_status;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."replay_whatsapp_status_callbacks"("_provider_message_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_cleaning_incident"("_task_id" "uuid", "_category_id" "uuid", "_description" "text", "_media_urls" "text"[], "_location" "text" DEFAULT NULL::"text", "_visibility" "public"."incident_visibility" DEFAULT 'public'::"public"."incident_visibility", "_create_as_open" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role app_role;
  v_is_admin_or_manager boolean;
  v_task record;
  v_client record;
  v_cleaner_id uuid;
  v_reporter_kind text;
  v_initial_status public.incident_status;
  v_incident_id uuid;
  v_url text;
  v_full_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF _task_id IS NULL OR _category_id IS NULL THEN
    RAISE EXCEPTION 'Faltan campos obligatorios';
  END IF;

  IF _description IS NULL OR length(trim(_description)) = 0 THEN
    RAISE EXCEPTION 'La descripción es obligatoria';
  END IF;

  IF _media_urls IS NULL OR array_length(_media_urls, 1) IS NULL OR array_length(_media_urls, 1) < 2 THEN
    RAISE EXCEPTION 'Debes adjuntar al menos 2 archivos (fotos o vídeo)';
  END IF;

  SELECT t.id, t.status, t.cliente_id, t.propiedad_id, t.sede_id, t.cleaner_id
  INTO v_task
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF v_task.id IS NULL THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF v_task.cliente_id IS NULL OR v_task.sede_id IS NULL THEN
    RAISE EXCEPTION 'La tarea no tiene cliente o sede asignada';
  END IF;

  -- Validar permisos / detectar tipo de reporter
  v_role := public.get_current_user_role();
  v_is_admin_or_manager := v_role IN ('admin','manager');

  SELECT id INTO v_cleaner_id FROM public.cleaners WHERE user_id = v_uid LIMIT 1;

  IF v_is_admin_or_manager THEN
    v_reporter_kind := 'limpatex_admin';
  ELSIF v_cleaner_id IS NOT NULL THEN
    v_reporter_kind := 'cleaner';
    -- El cleaner debe estar asignado a la tarea
    IF v_task.cleaner_id IS DISTINCT FROM v_cleaner_id
       AND NOT EXISTS (
         SELECT 1 FROM public.task_assignments ta
         WHERE ta.task_id = _task_id AND ta.cleaner_id = v_cleaner_id
       )
    THEN
      RAISE EXCEPTION 'No estás asignada a esta tarea';
    END IF;
    -- La tarea debe estar en curso
    IF v_task.status <> 'in-progress' THEN
      RAISE EXCEPTION 'Solo puedes reportar incidencias mientras la tarea está en curso';
    END IF;
  ELSE
    RAISE EXCEPTION 'No tienes permisos para reportar incidencias';
  END IF;

  -- Cliente debe tener incidencias activadas
  SELECT id, allow_incidents INTO v_client FROM public.clients WHERE id = v_task.cliente_id;
  IF v_client.allow_incidents IS NOT TRUE THEN
    RAISE EXCEPTION 'Este cliente no tiene activado el módulo de incidencias';
  END IF;

  -- Estado inicial
  IF v_is_admin_or_manager AND _create_as_open THEN
    v_initial_status := 'open';
  ELSE
    v_initial_status := 'pending_limpatex';
  END IF;

  -- Visibility coherente
  IF NOT v_is_admin_or_manager THEN
    _visibility := 'public';
  END IF;

  -- Crear la incidencia
  INSERT INTO public.cleaning_incidents (
    task_id, property_id, client_id, sede_id,
    reporter_cleaner_id, reporter_user_id, reporter_kind,
    category_id, location, description,
    status, visibility,
    approved_at, approved_by
  ) VALUES (
    _task_id, v_task.propiedad_id, v_task.cliente_id, v_task.sede_id,
    v_cleaner_id, v_uid, v_reporter_kind,
    _category_id, NULLIF(trim(_location),''), trim(_description),
    v_initial_status, _visibility,
    CASE WHEN v_initial_status='open' THEN now() END,
    CASE WHEN v_initial_status='open' THEN v_uid END
  )
  RETURNING id INTO v_incident_id;

  -- Adjuntos
  FOREACH v_url IN ARRAY _media_urls LOOP
    INSERT INTO public.cleaning_incident_media (incident_id, url, kind, uploaded_by, uploaded_by_role)
    VALUES (
      v_incident_id, v_url,
      CASE WHEN v_url ILIKE '%.mp4' OR v_url ILIKE '%.mov' OR v_url ILIKE '%.webm' THEN 'video' ELSE 'photo' END,
      v_uid, v_role::text
    );
  END LOOP;

  -- Resolver nombre legible
  SELECT COALESCE(p.full_name, p.email)
  INTO v_full_name
  FROM public.profiles p
  WHERE p.id = v_uid;

  -- Evento inicial
  INSERT INTO public.cleaning_incident_events (
    incident_id, event_type, to_status, actor_user_id, actor_name, actor_role,
    metadata
  ) VALUES (
    v_incident_id, 'created', v_initial_status, v_uid, v_full_name, v_role::text,
    jsonb_build_object('reporter_kind', v_reporter_kind, 'media_count', array_length(_media_urls,1))
  );

  RETURN v_incident_id;
END;
$$;


ALTER FUNCTION "public"."report_cleaning_incident"("_task_id" "uuid", "_category_id" "uuid", "_description" "text", "_media_urls" "text"[], "_location" "text", "_visibility" "public"."incident_visibility", "_create_as_open" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_notification_send_reconciliation"("_delivery_id" "uuid", "_resolution" "text", "_provider_message_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  action_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _resolution NOT IN ('confirmed_sent', 'confirmed_not_sent') THEN
    RAISE EXCEPTION 'invalid_resolution' USING ERRCODE = '22023';
  END IF;
  IF _resolution = 'confirmed_sent'
     AND (_provider_message_id IS NULL OR btrim(_provider_message_id) = '' OR length(_provider_message_id) > 255) THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries
  WHERE id = _delivery_id
  FOR UPDATE;

  IF delivery.id IS NULL
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR NOT (
       (delivery.channel = 'whatsapp' AND delivery.provider = 'meta_cloud_api'
        AND (delivery.error_code = 'reconciliation_required'
             OR delivery.provider_payload->>'send_started_at' IS NOT NULL))
       OR
       (delivery.channel = 'email' AND delivery.provider = 'resend'
        AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
        AND delivery.provider_response->>'fallback_attempt_state'
          IN ('contacting_resend', 'reconciliation_required'))
     ) THEN
    RAISE EXCEPTION 'delivery_not_reconcilable' USING ERRCODE = '22023';
  END IF;

  -- Meta no ofrece una consulta/cancelación que demuestre que un POST incierto
  -- no produjo efecto. Por tanto, un WhatsApp incierto solo puede confirmarse
  -- como enviado; nunca se reabre ni se reintenta.
  IF _resolution = 'confirmed_not_sent'
     AND delivery.channel = 'whatsapp' THEN
    RAISE EXCEPTION 'whatsapp_uncertain_cannot_be_reopened' USING ERRCODE = '22023';
  END IF;
  IF _resolution = 'confirmed_not_sent'
     AND delivery.channel = 'email'
     AND (
       delivery.provider_response->>'fallback_send_started_at' IS NULL
       OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
         <= now() - interval '23 hours'
     ) THEN
    RAISE EXCEPTION 'resend_idempotency_window_expired' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notification_send_reconciliation_actions (
    delivery_id, notification_event_id, channel, resolution, provider_message_id
  ) VALUES (
    delivery.id, delivery.notification_event_id, delivery.channel,
    _resolution, nullif(btrim(_provider_message_id), '')
  )
  RETURNING id INTO action_id;

  RETURN action_id;
END;
$$;


ALTER FUNCTION "public"."request_notification_send_reconciliation"("_delivery_id" "uuid", "_resolution" "text", "_provider_message_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_rate_limit"("reset_identifier" "text", "reset_action_type" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Validar parámetros
    IF reset_identifier IS NULL OR trim(reset_identifier) = '' THEN
        RAISE EXCEPTION 'identifier es requerido';
    END IF;
    
    IF reset_action_type IS NULL OR trim(reset_action_type) = '' THEN
        RAISE EXCEPTION 'action_type es requerido';
    END IF;

    UPDATE public.security_rate_limits
    SET 
        attempt_count = 0,
        blocked_until = NULL,
        updated_at = now()
    WHERE identifier = reset_identifier
    AND action_type = reset_action_type;
END;
$$;


ALTER FUNCTION "public"."reset_rate_limit"("reset_identifier" "text", "reset_action_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_cleaner_activation_cycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.is_active = false AND NEW.is_active = true THEN
    NEW.activation_cycle_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."rotate_cleaner_activation_cycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_tourist_budget_version"("p_budget_id" "uuid", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_change_reason" "text" DEFAULT NULL::"text", "p_source_profile_version_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  budget_row public.tourist_budgets%ROWTYPE;
  new_version_number INTEGER;
  new_version_id UUID;
  item JSONB;
  item_index INTEGER := 0;
  total_cost NUMERIC(12,2) := COALESCE((p_totals->>'totalCost')::NUMERIC, 0);
  total_revenue NUMERIC(12,2) := COALESCE((p_totals->>'totalRevenue')::NUMERIC, 0);
  contribution NUMERIC(12,2) := COALESCE((p_totals->>'contribution')::NUMERIC, 0);
  margin NUMERIC(7,2) := COALESCE((p_totals->>'marginPercentage')::NUMERIC, 0);
  monthly_cost NUMERIC(12,2) := COALESCE((p_totals->>'monthlyCost')::NUMERIC, 0);
  monthly_revenue NUMERIC(12,2) := COALESCE((p_totals->>'monthlyRevenue')::NUMERIC, 0);
  monthly_contribution NUMERIC(12,2) := COALESCE((p_totals->>'monthlyContribution')::NUMERIC, 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede versionar presupuestos';
  END IF;

  SELECT * INTO budget_row FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;
  IF budget_row.status IN ('accepted', 'archived') THEN
    RAISE EXCEPTION 'Un presupuesto aceptado o archivado no se puede editar; cree una nueva versión operativa';
  END IF;

  new_version_number := budget_row.current_version_number + 1;
  INSERT INTO public.tourist_budget_versions (
    budget_id, version_number, source_profile_version_id, input_snapshot, totals_snapshot, change_reason, created_by
  ) VALUES (
    p_budget_id, new_version_number, p_source_profile_version_id, COALESCE(p_snapshot, '{}'::jsonb), COALESCE(p_totals, '{}'::jsonb), p_change_reason, auth.uid()
  ) RETURNING id INTO new_version_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.tourist_budget_items (
      budget_version_id, sort_order, property_id, property_code, property_name, property_address,
      feature_counts, time_input, logistics_input, service_lines, result_snapshot
    ) VALUES (
      new_version_id,
      item_index,
      NULLIF(item->>'propertyId', '')::UUID,
      NULLIF(item->>'propertyCode', ''),
      COALESCE(NULLIF(item->>'propertyName', ''), format('Propiedad %s', item_index + 1)),
      NULLIF(item->>'propertyAddress', ''),
      COALESCE(item->'featureCounts', '{}'::jsonb),
      COALESCE(item->'timeInput', '{}'::jsonb),
      COALESCE(item->'logisticsInput', '{}'::jsonb),
      COALESCE(item->'serviceLines', '{}'::jsonb),
      COALESCE(item->'resultSnapshot', '{}'::jsonb)
    );
    item_index := item_index + 1;
  END LOOP;

  UPDATE public.tourist_budgets SET
    current_version_number = new_version_number,
    monthly_rotations = GREATEST(COALESCE((p_snapshot->>'monthlyRotations')::INTEGER, monthly_rotations), 1),
    total_cost = total_cost,
    total_revenue = total_revenue,
    contribution = contribution,
    margin_percentage = margin,
    monthly_cost = monthly_cost,
    monthly_revenue = monthly_revenue,
    monthly_contribution = monthly_contribution
  WHERE id = p_budget_id;

  RETURN jsonb_build_object('budgetId', p_budget_id, 'versionId', new_version_id, 'versionNumber', new_version_number);
END;
$$;


ALTER FUNCTION "public"."save_tourist_budget_version"("p_budget_id" "uuid", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_change_reason" "text", "p_source_profile_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_stock_warehouse"("warehouse_id_param" "uuid") RETURNS "public"."stock_warehouses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_warehouse public.stock_warehouses;
BEGIN
  IF warehouse_id_param IS NULL THEN
    RAISE EXCEPTION 'El almacen es obligatorio';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el almacen principal';
  END IF;

  SELECT * INTO target_warehouse
  FROM public.stock_warehouses
  WHERE id = warehouse_id_param
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Almacen no encontrado';
  END IF;

  UPDATE public.stock_warehouses
  SET is_default = false
  WHERE sede_id = target_warehouse.sede_id
    AND is_default = true;

  UPDATE public.stock_warehouses
  SET is_default = true
  WHERE id = warehouse_id_param
  RETURNING * INTO target_warehouse;

  RETURN target_warehouse;
END;
$$;


ALTER FUNCTION "public"."set_default_stock_warehouse"("warehouse_id_param" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_storage_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "property_group_id" "uuid" NOT NULL,
    "warehouse_id" "uuid",
    "access_type" "text" DEFAULT 'shared'::"text" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_storage_access_access_type_check" CHECK (("access_type" = ANY (ARRAY['shared'::"text", 'none'::"text"]))),
    CONSTRAINT "property_storage_access_type_consistency" CHECK (((("access_type" = 'shared'::"text") AND ("warehouse_id" IS NOT NULL)) OR (("access_type" = 'none'::"text") AND ("warehouse_id" IS NULL))))
);


ALTER TABLE "public"."property_storage_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."property_storage_access" IS 'Operational access from an apartment to its building storage location. Stock is counted once per physical warehouse.';



COMMENT ON COLUMN "public"."property_storage_access"."access_type" IS 'shared: apartment uses the building warehouse; none: apartment has no storage access.';



CREATE OR REPLACE FUNCTION "public"."set_property_storage_access"("_property_id" "uuid", "_property_group_id" "uuid", "_access_type" "text", "_warehouse_id" "uuid" DEFAULT NULL::"uuid", "_notes" "text" DEFAULT NULL::"text") RETURNS "public"."property_storage_access"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result public.property_storage_access;
BEGIN
  IF NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'property storage access requires administrator or manager';
  END IF;

  IF _access_type NOT IN ('shared', 'none') THEN
    RAISE EXCEPTION 'invalid property storage access type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.property_group_assignments a
    WHERE a.property_group_id = _property_group_id
      AND a.property_id = _property_id
  ) THEN
    RAISE EXCEPTION 'property is not assigned to this building';
  END IF;

  IF _access_type = 'none' AND _warehouse_id IS NOT NULL THEN
    RAISE EXCEPTION 'property without storage access cannot have a warehouse';
  END IF;

  IF _access_type = 'shared' AND NOT EXISTS (
    SELECT 1
    FROM public.stock_warehouses w
    WHERE w.id = _warehouse_id
      AND w.property_group_id = _property_group_id
      AND w.location_type = 'building_storage'
      AND w.is_active = true
  ) THEN
    RAISE EXCEPTION 'shared property storage must use an active building warehouse';
  END IF;

  INSERT INTO public.property_storage_access (
    property_id,
    property_group_id,
    warehouse_id,
    access_type,
    notes,
    is_active,
    updated_at
  )
  VALUES (
    _property_id,
    _property_group_id,
    _warehouse_id,
    _access_type,
    NULLIF(trim(_notes), ''),
    true,
    now()
  )
  ON CONFLICT (property_id) DO UPDATE SET
    property_group_id = EXCLUDED.property_group_id,
    warehouse_id = EXCLUDED.warehouse_id,
    access_type = EXCLUDED.access_type,
    notes = EXCLUDED.notes,
    is_active = true,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."set_property_storage_access"("_property_id" "uuid", "_property_group_id" "uuid", "_access_type" "text", "_warehouse_id" "uuid", "_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_supervision_actor_from_auth"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'supervision_reviews' THEN
      NEW.reviewer_user_id := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_review_events' THEN
      NEW.actor_user_id := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_incidents' THEN
      NEW.created_by := auth.uid();
    ELSIF TG_TABLE_NAME = 'supervision_incident_events' THEN
      NEW.actor_user_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_supervision_actor_from_auth"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_assignments"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE ids uuid[]; task_row public.tasks%ROWTYPE; pairs jsonb;
BEGIN
 SELECT COALESCE(array_agg(id ORDER BY ord),'{}') INTO ids FROM (
  SELECT DISTINCT ON (id) id,ord FROM unnest(COALESCE(_cleaner_ids,'{}')) WITH ORDINALITY q(id,ord)
  WHERE id IS NOT NULL ORDER BY id,ord
 )d;
 SELECT * INTO task_row FROM public.tasks WHERE id=_task_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarea no encontrada'; END IF;
 IF COALESCE(auth.role(),'')<>'service_role' AND NOT (
  EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','supervisor'))
  AND public.user_has_sede_access(auth.uid(),task_row.sede_id)
 ) THEN RAISE EXCEPTION 'No autorizado para gestionar asignaciones de esta sede' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.cleaners WHERE id=ANY(ids) ORDER BY id FOR KEY SHARE;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('cleaner_id',p.cid,'date',task_row.date)),'[]') INTO pairs FROM (
  SELECT unnest(ids) cid UNION SELECT cleaner_id FROM public.planning_effective_task_assignments() WHERE task_id=_task_id
 )p;
 PERFORM public.planning_lock_worker_dates(pairs);
 RETURN public.set_task_assignments_unlocked_15000(_task_id,ids);
END $$;


ALTER FUNCTION "public"."set_task_assignments"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_task_assignments_unlocked_15000"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_names text;
  v_primary uuid;
  v_ids uuid[];
  v_valid_cleaner_count integer;
  v_task_sede uuid;
BEGIN
  IF _task_id IS NULL THEN
    RAISE EXCEPTION 'task_id es requerido';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY ord), '{}'::uuid[])
    INTO v_ids
    FROM (
      SELECT DISTINCT ON (id) id, ord
      FROM unnest(coalesce(_cleaner_ids, '{}'::uuid[])) WITH ORDINALITY AS t(id, ord)
      WHERE id IS NOT NULL
      ORDER BY id, ord
    ) s;

  SELECT t.sede_id INTO v_task_sede
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT (
       (
         public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager')
         OR public.has_role(auth.uid(), 'supervisor')
       )
       AND v_task_sede = ANY(public.get_user_accessible_sedes())
     ) THEN
    RAISE EXCEPTION 'No autorizado para gestionar asignaciones de esta sede'
      USING ERRCODE = '42501';
  END IF;

  -- Bloquea primero las fichas de los operarios. Si una baja está en curso,
  -- esta lectura espera y la validación posterior ve el estado ya confirmado.
  PERFORM c.id
  FROM public.cleaners c
  WHERE c.id = ANY(v_ids)
  ORDER BY c.id
  FOR KEY SHARE;

  SELECT count(*)
    INTO v_valid_cleaner_count
    FROM public.cleaners c
    WHERE c.id = ANY(v_ids)
      AND c.is_active = true;

  IF v_valid_cleaner_count <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'No se puede asignar un trabajador inexistente o inactivo';
  END IF;

  -- Serializa todas las sustituciones de la lista completa de esta tarea.
  SELECT t.sede_id INTO v_task_sede
  FROM public.tasks t
  WHERE t.id = _task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT (
       (
         public.has_role(auth.uid(), 'admin')
         OR public.has_role(auth.uid(), 'manager')
         OR public.has_role(auth.uid(), 'supervisor')
       )
       AND v_task_sede = ANY(public.get_user_accessible_sedes())
     ) THEN
    RAISE EXCEPTION 'No autorizado para gestionar asignaciones de esta sede'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(cleaner_id), '{}'::uuid[])
    INTO v_current
    FROM public.task_assignments
    WHERE task_id = _task_id;

  SELECT coalesce(array_agg(x), '{}'::uuid[]) INTO v_added
    FROM (SELECT unnest(v_ids) EXCEPT SELECT unnest(v_current)) AS t(x);

  SELECT coalesce(array_agg(x), '{}'::uuid[]) INTO v_removed
    FROM (SELECT unnest(v_current) EXCEPT SELECT unnest(v_ids)) AS t(x);

  IF array_length(v_removed, 1) > 0 THEN
    DELETE FROM public.task_assignments
      WHERE task_id = _task_id AND cleaner_id = ANY(v_removed);
  END IF;

  IF array_length(v_added, 1) > 0 THEN
    INSERT INTO public.task_assignments (task_id, cleaner_id, cleaner_name, assigned_by)
      SELECT _task_id, c.id, c.name, auth.uid()
      FROM public.cleaners c
      WHERE c.id = ANY(v_added)
        AND c.is_active = true;
  END IF;

  SELECT string_agg(c.name, ', ' ORDER BY arr.ord)
    INTO v_names
    FROM unnest(v_ids) WITH ORDINALITY AS arr(id, ord)
    JOIN public.cleaners c ON c.id = arr.id;

  v_primary := v_ids[1];

  UPDATE public.tasks
    SET cleaner = NULLIF(v_names, ''),
        cleaner_id = v_primary,
        updated_at = now()
    WHERE id = _task_id;

  RETURN jsonb_build_object(
    'added', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)), '[]'::jsonb)
      FROM public.cleaners c WHERE c.id = ANY(v_added)
    ),
    'removed', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email)), '[]'::jsonb)
      FROM public.cleaners c WHERE c.id = ANY(v_removed)
    ),
    'final', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY arr.ord), '[]'::jsonb)
      FROM unnest(v_ids) WITH ORDINALITY AS arr(id, ord)
      JOIN public.cleaners c ON c.id = arr.id
    )
  );
END;
$$;


ALTER FUNCTION "public"."set_task_assignments_unlocked_15000"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "telefono" "text",
    "avatar" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer,
    "user_id" "uuid",
    "contract_hours_per_week" numeric(5,2) DEFAULT 40.00,
    "hourly_rate" numeric(8,2),
    "contract_type" character varying(50) DEFAULT 'full-time'::character varying,
    "start_date" "date",
    "emergency_contact_name" character varying(255),
    "emergency_contact_phone" character varying(50),
    "sede_id" "uuid" NOT NULL,
    "external_id" "text",
    "first_name" "text",
    "last_name" "text",
    "dni" "text",
    "pin" "text",
    "category" "text",
    "delegation_name" "text",
    "office_name" "text",
    "planning_max_daily_minutes" integer DEFAULT 480 NOT NULL,
    "planning_zone" "text",
    "planning_operational_restrictions" "text",
    "planning_can_handle_linen_load" boolean DEFAULT true NOT NULL,
    "planning_can_handle_complex_cleanings" boolean DEFAULT true NOT NULL,
    "whatsapp_phone_e164" "text",
    "whatsapp_opt_in" boolean DEFAULT false NOT NULL,
    "whatsapp_opt_in_at" timestamp with time zone,
    "whatsapp_opt_in_source" "text",
    "whatsapp_notifications_enabled" boolean DEFAULT false NOT NULL,
    "whatsapp_last_error" "text",
    "activation_cycle_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."cleaners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cleaners"."sede_id" IS 'ID de la sede a la que pertenece el limpiador';



CREATE OR REPLACE FUNCTION "public"."snapshot_notification_recipient"("_cleaner" "public"."cleaners") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  telefono_digits text;
  whatsapp_digits text;
  telefono_national text;
  whatsapp_national text;
  canonical_phone text;
BEGIN
  telefono_digits := regexp_replace(COALESCE(_cleaner.telefono, ''), '[^0-9]', '', 'g');
  whatsapp_digits := regexp_replace(COALESCE(_cleaner.whatsapp_phone_e164, ''), '[^0-9]', '', 'g');

  telefono_national := CASE
    WHEN length(telefono_digits) = 9 THEN telefono_digits
    WHEN length(telefono_digits) = 11 AND telefono_digits LIKE '34%' THEN right(telefono_digits, 9)
    WHEN length(telefono_digits) = 13 AND telefono_digits LIKE '0034%' THEN right(telefono_digits, 9)
    ELSE NULL
  END;
  whatsapp_national := CASE
    WHEN length(whatsapp_digits) = 9 THEN whatsapp_digits
    WHEN length(whatsapp_digits) = 11 AND whatsapp_digits LIKE '34%' THEN right(whatsapp_digits, 9)
    WHEN length(whatsapp_digits) = 13 AND whatsapp_digits LIKE '0034%' THEN right(whatsapp_digits, 9)
    ELSE NULL
  END;

  -- Paridad con el proveedor: solo móviles españoles 6xx/7xx. Un fijo en
  -- telefono no tapa un whatsapp_phone_e164 móvil válido y no se consulta
  -- ningún flag/opt-in para decidir qué número queda congelado.
  canonical_phone := CASE
    WHEN length(telefono_national) = 9
      AND substring(telefono_national from 1 for 1) IN ('6', '7')
      THEN '+34' || telefono_national
    WHEN length(whatsapp_national) = 9
      AND substring(whatsapp_national from 1 for 1) IN ('6', '7')
      THEN '+34' || whatsapp_national
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'name', _cleaner.name,
    'email', _cleaner.email,
    'telefono', canonical_phone,
    'whatsapp_phone_e164', canonical_phone,
    'effective_phone_e164', canonical_phone,
    'whatsapp_notifications_enabled', _cleaner.whatsapp_notifications_enabled,
    'whatsapp_opt_in', _cleaner.whatsapp_opt_in
  );
END;
$$;


ALTER FUNCTION "public"."snapshot_notification_recipient"("_cleaner" "public"."cleaners") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_building_has_sede_access"("_property_group_id" "uuid", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.property_group_assignments pga
    JOIN public.properties p ON p.id = pga.property_id
    WHERE pga.property_group_id = _property_group_id
      AND NOT public.user_has_sede_access(_user_id, p.sede_id)
  );
$$;


ALTER FUNCTION "public"."supervision_building_has_sede_access"("_property_group_id" "uuid", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_stock_warehouse_can_access"("_warehouse_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.user_is_admin_or_manager()
    OR EXISTS (
      SELECT 1
      FROM public.stock_warehouses w
      WHERE w.id = _warehouse_id
        AND w.location_type = 'building_storage'
        AND w.property_group_id IS NOT NULL
        AND public.supervision_user_has_building_assignment(w.property_group_id, auth.uid(), CURRENT_DATE)
    );
$$;


ALTER FUNCTION "public"."supervision_stock_warehouse_can_access"("_warehouse_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_storage_object_matches_review"("_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  object_sede UUID;
  object_review UUID;
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/.+$' THEN
    RETURN FALSE;
  END IF;

  object_sede := split_part(_name, '/', 1)::UUID;
  object_review := split_part(_name, '/', 2)::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = object_review AND r.sede_id = object_sede
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$_$;


ALTER FUNCTION "public"."supervision_storage_object_matches_review"("_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_user_can_access_sede"("_sede_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.user_has_role('admin'::public.app_role)
    OR (
      (public.user_has_role('manager'::public.app_role) OR public.user_has_role('supervisor'::public.app_role))
      AND public.user_has_sede_access(auth.uid(), _sede_id)
    );
$$;


ALTER FUNCTION "public"."supervision_user_can_access_sede"("_sede_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_user_can_delete_sede"("_sede_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.user_has_role('admin'::public.app_role)
    OR (
      public.user_has_role('manager'::public.app_role)
      AND public.user_has_sede_access(auth.uid(), _sede_id)
    );
$$;


ALTER FUNCTION "public"."supervision_user_can_delete_sede"("_sede_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_user_has_building_assignment"("_property_group_id" "uuid", "_user_id" "uuid", "_date" "date") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.supervision_building_supervisors a
    WHERE a.property_group_id = _property_group_id
      AND a.supervisor_user_id = _user_id
      AND a.is_active
      AND (a.starts_on IS NULL OR a.starts_on <= _date)
      AND (a.ends_on IS NULL OR a.ends_on >= _date)
  );
$$;


ALTER FUNCTION "public"."supervision_user_has_building_assignment"("_property_group_id" "uuid", "_user_id" "uuid", "_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supervision_work_item_can_access"("_property_group_id" "uuid", "_date" "date") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.user_is_admin_or_manager()
    OR public.supervision_user_has_building_assignment(_property_group_id, auth.uid(), _date);
$$;


ALTER FUNCTION "public"."supervision_work_item_can_access"("_property_group_id" "uuid", "_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  IF NEW.pin IS NOT DISTINCT FROM OLD.pin
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active = false OR NULLIF(trim(NEW.pin), '') IS NULL THEN
    UPDATE public.laundry_route_workers
    SET is_active = false,
        updated_at = now()
    WHERE cleaner_id = NEW.id;
  ELSIF NEW.pin IS DISTINCT FROM OLD.pin THEN
    UPDATE public.laundry_route_workers
    SET pin_hash = extensions.crypt(trim(NEW.pin), extensions.gen_salt('bf', 10)),
        pin_synced_at = now(),
        updated_at = now()
    WHERE cleaner_id = NEW.id;
  END IF;

  UPDATE public.laundry_route_sessions s
  SET revoked_at = now()
  FROM public.laundry_route_workers rw
  WHERE rw.cleaner_id = NEW.id
    AND s.route_worker_id = rw.id
    AND s.revoked_at IS NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_laundry_route_worker_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_laundry_route_worker_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_tourist_budget_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_tourist_budget_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_stock_between_warehouses"("product_id_param" "uuid", "from_warehouse_id_param" "uuid", "to_warehouse_id_param" "uuid", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  product_record RECORD;
  from_warehouse RECORD;
  to_warehouse RECORD;
  from_stock RECORD;
  to_stock RECORD;
BEGIN
  IF product_id_param IS NULL
    OR from_warehouse_id_param IS NULL
    OR to_warehouse_id_param IS NULL
    OR user_id_param IS NULL
    OR quantity_param IS NULL
  THEN
    RAISE EXCEPTION 'product, warehouses, quantity and user are required';
  END IF;

  IF quantity_param <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  IF from_warehouse_id_param = to_warehouse_id_param THEN
    RAISE EXCEPTION 'Source and destination warehouses must be different';
  END IF;

  IF length(trim(COALESCE(reason_param, ''))) = 0 THEN
    RAISE EXCEPTION 'Transfer reason is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to transfer stock';
  END IF;

  SELECT * INTO product_record
  FROM public.stock_products
  WHERE id = product_id_param
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active stock product not found';
  END IF;

  SELECT * INTO from_warehouse
  FROM public.stock_warehouses
  WHERE id = from_warehouse_id_param
    AND is_active = true;

  SELECT * INTO to_warehouse
  FROM public.stock_warehouses
  WHERE id = to_warehouse_id_param
    AND is_active = true;

  IF from_warehouse.id IS NULL OR to_warehouse.id IS NULL THEN
    RAISE EXCEPTION 'Both warehouses must be active';
  END IF;

  IF from_warehouse.sede_id <> to_warehouse.sede_id THEN
    RAISE EXCEPTION 'Transfers between sedes are not allowed in this phase';
  END IF;

  IF product_record.sede_id <> from_warehouse.sede_id THEN
    RAISE EXCEPTION 'Product and warehouses must belong to the same sede';
  END IF;

  INSERT INTO public.stock_levels (product_id, warehouse_id, current_quantity, minimum_quantity, target_quantity, updated_by)
  VALUES (product_id_param, to_warehouse_id_param, 0, 0, 0, user_id_param)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  SELECT * INTO from_stock
  FROM public.stock_levels
  WHERE product_id = product_id_param
    AND warehouse_id = from_warehouse_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source stock level not found';
  END IF;

  IF from_stock.current_quantity < quantity_param THEN
    RAISE EXCEPTION 'Insufficient stock in source warehouse';
  END IF;

  SELECT * INTO to_stock
  FROM public.stock_levels
  WHERE product_id = product_id_param
    AND warehouse_id = to_warehouse_id_param
  FOR UPDATE;

  UPDATE public.stock_levels
  SET
    current_quantity = current_quantity - quantity_param,
    updated_by = user_id_param
  WHERE id = from_stock.id;

  UPDATE public.stock_levels
  SET
    current_quantity = current_quantity + quantity_param,
    updated_by = user_id_param
  WHERE id = to_stock.id;

  INSERT INTO public.stock_movements (
    product_id,
    warehouse_id,
    to_warehouse_id,
    movement_type,
    quantity,
    previous_quantity,
    new_quantity,
    to_previous_quantity,
    to_new_quantity,
    reason,
    created_by
  )
  VALUES (
    product_id_param,
    from_warehouse_id_param,
    to_warehouse_id_param,
    'transferencia',
    quantity_param,
    from_stock.current_quantity,
    from_stock.current_quantity - quantity_param,
    to_stock.current_quantity,
    to_stock.current_quantity + quantity_param,
    trim(reason_param),
    user_id_param
  );

  IF from_stock.current_quantity - quantity_param <= from_stock.minimum_quantity THEN
    PERFORM public.create_stock_alert_if_needed(
      from_stock.id,
      product_id_param,
      from_warehouse_id_param,
      CASE
        WHEN from_stock.current_quantity - quantity_param = 0 THEN 'stock_critico'::public.stock_alert_type
        ELSE 'stock_bajo'::public.stock_alert_type
      END
    );
  END IF;

  RETURN jsonb_build_object(
    'product_id', product_id_param,
    'from_warehouse_id', from_warehouse_id_param,
    'to_warehouse_id', to_warehouse_id_param,
    'quantity', quantity_param,
    'from_quantity', from_stock.current_quantity - quantity_param,
    'to_quantity', to_stock.current_quantity + quantity_param
  );
END;
$$;


ALTER FUNCTION "public"."transfer_stock_between_warehouses"("product_id_param" "uuid", "from_warehouse_id_param" "uuid", "to_warehouse_id_param" "uuid", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_tourist_budget"("p_budget_id" "uuid", "p_to_status" "public"."tourist_budget_status", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_status public.tourist_budget_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar estados';
  END IF;

  SELECT status INTO current_status FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF current_status IS NULL THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;

  IF NOT (
    (current_status = 'draft' AND p_to_status IN ('review', 'sent', 'rejected', 'archived')) OR
    (current_status = 'review' AND p_to_status IN ('draft', 'sent', 'rejected', 'archived')) OR
    (current_status = 'sent' AND p_to_status IN ('accepted', 'rejected', 'expired')) OR
    (current_status = 'rejected' AND p_to_status IN ('draft', 'archived')) OR
    (current_status = 'expired' AND p_to_status IN ('draft', 'archived')) OR
    (current_status = 'accepted' AND p_to_status = 'archived') OR
    (current_status = 'archived' AND p_to_status = 'draft')
  ) THEN
    RAISE EXCEPTION 'Transición de estado no permitida: % -> %', current_status, p_to_status;
  END IF;

  UPDATE public.tourist_budgets SET
    status = p_to_status,
    accepted_by = CASE WHEN p_to_status = 'accepted' THEN auth.uid() ELSE accepted_by END,
    accepted_at = CASE WHEN p_to_status = 'accepted' THEN now() ELSE accepted_at END
  WHERE id = p_budget_id;

  INSERT INTO public.tourist_budget_status_history (budget_id, from_status, to_status, note, changed_by)
  VALUES (p_budget_id, current_status, p_to_status, p_note, auth.uid());

  RETURN jsonb_build_object('budgetId', p_budget_id, 'fromStatus', current_status, 'toStatus', p_to_status);
END;
$$;


ALTER FUNCTION "public"."transition_tourist_budget"("p_budget_id" "uuid", "p_to_status" "public"."tourist_budget_status", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cleaners_order"("cleaner_updates" "jsonb"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    update_item JSONB;
BEGIN
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Validar que el usuario tenga permisos
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para actualizar el orden de cleaners';
    END IF;

    FOREACH update_item IN ARRAY cleaner_updates
    LOOP
        UPDATE public.cleaners 
        SET sort_order = (update_item->>'sortOrder')::INTEGER
        WHERE id = (update_item->>'id')::UUID;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_cleaners_order"("cleaner_updates" "jsonb"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_hostaway_sync_schedules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_hostaway_sync_schedules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_stock_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inventory_stock_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_laundry_dirty_stock_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_laundry_dirty_stock_timestamp"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "current_quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "minimum_quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "target_quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "cost_per_unit" numeric(12,4),
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "stock_levels_non_negative" CHECK ((("current_quantity" >= (0)::numeric) AND ("minimum_quantity" >= (0)::numeric) AND ("target_quantity" >= (0)::numeric) AND (("cost_per_unit" IS NULL) OR ("cost_per_unit" >= (0)::numeric)))),
    CONSTRAINT "stock_levels_target_gte_minimum" CHECK (("target_quantity" >= "minimum_quantity"))
);


ALTER TABLE "public"."stock_levels" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_levels" IS 'Current stock by product and warehouse.';



CREATE OR REPLACE FUNCTION "public"."update_stock_level_settings"("stock_level_id_param" "uuid", "minimum_quantity_param" numeric, "target_quantity_param" numeric, "cost_per_unit_param" numeric, "user_id_param" "uuid") RETURNS "public"."stock_levels"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  updated_level public.stock_levels;
BEGIN
  IF stock_level_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'stock_level_id and user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = user_id_param
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'User not allowed to update stock settings';
  END IF;

  IF COALESCE(minimum_quantity_param, 0) < 0
    OR COALESCE(target_quantity_param, 0) < 0
    OR (cost_per_unit_param IS NOT NULL AND cost_per_unit_param < 0)
  THEN
    RAISE EXCEPTION 'Quantities and cost must be non-negative';
  END IF;

  IF COALESCE(target_quantity_param, 0) < COALESCE(minimum_quantity_param, 0) THEN
    RAISE EXCEPTION 'Target quantity must be greater than or equal to minimum quantity';
  END IF;

  UPDATE public.stock_levels
  SET
    minimum_quantity = COALESCE(minimum_quantity_param, 0),
    target_quantity = COALESCE(target_quantity_param, 0),
    cost_per_unit = cost_per_unit_param,
    updated_by = user_id_param
  WHERE id = stock_level_id_param
  RETURNING * INTO updated_level;

  IF updated_level.id IS NULL THEN
    RAISE EXCEPTION 'Stock level not found';
  END IF;

  RETURN updated_level;
END;
$$;


ALTER FUNCTION "public"."update_stock_level_settings"("stock_level_id_param" "uuid", "minimum_quantity_param" numeric, "target_quantity_param" numeric, "cost_per_unit_param" numeric, "user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_levels_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_levels_timestamp"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_work_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generation_key" "text" NOT NULL,
    "property_group_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "task_id" "uuid",
    "review_id" "uuid",
    "incident_id" "uuid",
    "assigned_supervisor_user_id" "uuid",
    "work_type" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "due_at" timestamp with time zone,
    "priority" integer DEFAULT 0 NOT NULL,
    "reasons" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "defer_reason" "text",
    "blocked_reason" "text",
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_work_items_check" CHECK ((("status" <> 'deferred'::"text") OR (NULLIF(TRIM(BOTH FROM "defer_reason"), ''::"text") IS NOT NULL))),
    CONSTRAINT "supervision_work_items_check1" CHECK ((("status" <> 'blocked'::"text") OR (NULLIF(TRIM(BOTH FROM "blocked_reason"), ''::"text") IS NOT NULL))),
    CONSTRAINT "supervision_work_items_priority_check" CHECK (("priority" >= 0)),
    CONSTRAINT "supervision_work_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'deferred'::"text", 'blocked'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "supervision_work_items_work_type_check" CHECK (("work_type" = ANY (ARRAY['apartment_quick'::"text", 'apartment_full'::"text", 'rework'::"text", 'incident'::"text", 'storage_restock'::"text", 'storage_inventory'::"text", 'equipment'::"text", 'common_area'::"text", 'warehouse_inventory'::"text", 'extraordinary'::"text"])))
);


ALTER TABLE "public"."supervision_work_items" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_supervision_work_item_status"("_work_item_id" "uuid", "_status" "text", "_reason" "text" DEFAULT NULL::"text") RETURNS "public"."supervision_work_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_item public.supervision_work_items;
  updated_item public.supervision_work_items;
BEGIN
  SELECT * INTO current_item
  FROM public.supervision_work_items
  WHERE id = _work_item_id
  FOR UPDATE;
  IF current_item.id IS NULL THEN RAISE EXCEPTION 'work item not found'; END IF;
  IF NOT public.supervision_work_item_can_access(current_item.property_group_id, current_item.scheduled_date) THEN
    RAISE EXCEPTION 'supervision building assignment required';
  END IF;
  IF _status NOT IN ('pending', 'in_progress', 'completed', 'deferred', 'blocked', 'cancelled') THEN
    RAISE EXCEPTION 'invalid work item status';
  END IF;
  IF _status = 'cancelled' AND NOT public.user_is_admin_or_manager() THEN
    RAISE EXCEPTION 'only admin or manager can cancel work items';
  END IF;
  IF _status IN ('deferred', 'blocked') AND NULLIF(trim(_reason), '') IS NULL THEN
    RAISE EXCEPTION 'reason required for deferred or blocked work item';
  END IF;

  UPDATE public.supervision_work_items
  SET status = _status,
      defer_reason = CASE WHEN _status = 'deferred' THEN NULLIF(trim(_reason), '') ELSE NULL END,
      blocked_reason = CASE WHEN _status = 'blocked' THEN NULLIF(trim(_reason), '') ELSE NULL END,
      completed_by = CASE WHEN _status = 'completed' THEN auth.uid() ELSE NULL END,
      completed_at = CASE WHEN _status = 'completed' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = _work_item_id
  RETURNING * INTO updated_item;
  RETURN updated_item;
END;
$$;


ALTER FUNCTION "public"."update_supervision_work_item_status"("_work_item_id" "uuid", "_status" "text", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_supervision_work_items"("_items" "jsonb") RETURNS SETOF "public"."supervision_work_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item JSONB;
  saved public.supervision_work_items;
  item_group UUID;
  item_date DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'work items payload must be an array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    item_group := (item->>'property_group_id')::UUID;
    item_date := (item->>'scheduled_date')::DATE;
    IF NOT public.supervision_work_item_can_access(item_group, item_date) THEN
      RAISE EXCEPTION 'supervision building assignment required';
    END IF;

    INSERT INTO public.supervision_work_items (
      generation_key, property_group_id, property_id, task_id, review_id, incident_id,
      assigned_supervisor_user_id, work_type, scheduled_date, due_at, priority, reasons, status,
      defer_reason, blocked_reason, completed_at
    ) VALUES (
      item->>'generation_key', item_group,
      NULLIF(item->>'property_id', '')::UUID,
      NULLIF(item->>'task_id', '')::UUID,
      NULLIF(item->>'review_id', '')::UUID,
      NULLIF(item->>'incident_id', '')::UUID,
      NULLIF(item->>'assigned_supervisor_user_id', '')::UUID,
      item->>'work_type', item_date,
      NULLIF(item->>'due_at', '')::TIMESTAMPTZ,
      COALESCE((item->>'priority')::INTEGER, 0),
      COALESCE(item->'reasons', '[]'::JSONB),
      COALESCE(item->>'status', 'pending'),
      NULLIF(item->>'defer_reason', ''), NULLIF(item->>'blocked_reason', ''),
      CASE WHEN item->>'status' = 'completed' THEN now() ELSE NULL END
    )
    ON CONFLICT (generation_key) DO UPDATE SET
      property_group_id = EXCLUDED.property_group_id,
      property_id = EXCLUDED.property_id,
      task_id = EXCLUDED.task_id,
      review_id = EXCLUDED.review_id,
      incident_id = EXCLUDED.incident_id,
      assigned_supervisor_user_id = EXCLUDED.assigned_supervisor_user_id,
      work_type = EXCLUDED.work_type,
      scheduled_date = EXCLUDED.scheduled_date,
      due_at = EXCLUDED.due_at,
      priority = EXCLUDED.priority,
      reasons = EXCLUDED.reasons,
      updated_at = now()
    RETURNING * INTO saved;
    RETURN NEXT saved;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."upsert_supervision_work_items"("_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_task"("task_sede_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE 
    -- Admin puede ver todas las tareas
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN true
    -- Manager puede ver todas las tareas
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'manager'::app_role
    ) THEN true
    -- Cleaner puede ver tareas de su sede (basado en su registro en cleaners)
    WHEN EXISTS (
      SELECT 1 FROM public.cleaners 
      WHERE user_id = auth.uid() AND sede_id = task_sede_id
    ) THEN true
    -- Para otros roles, verificar acceso explícito en user_sede_access
    ELSE EXISTS (
      SELECT 1 FROM public.user_sede_access 
      WHERE user_id = auth.uid() 
      AND sede_id = task_sede_id 
      AND can_access = true
    )
  END;
$$;


ALTER FUNCTION "public"."user_can_access_task"("task_sede_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role"("check_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = check_role
  )
$$;


ALTER FUNCTION "public"."user_has_role"("check_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role = 'admin'::app_role
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_sede_access 
      WHERE user_id = _user_id 
      AND sede_id = _sede_id 
      AND can_access = true
    )
  END;
$$;


ALTER FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") IS 'Verifica si un usuario tiene acceso a una sede específica (admins tienen acceso a todas)';



CREATE OR REPLACE FUNCTION "public"."user_is_admin_or_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
$$;


ALTER FUNCTION "public"."user_is_admin_or_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_notification_send_reconciliation_effect"("_action_id" "uuid", "_claim_token" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  event_id uuid;
  valid boolean;
BEGIN
  SELECT action.notification_event_id INTO event_id
  FROM public.notification_send_reconciliation_actions action
  WHERE action.id = _action_id;
  IF event_id IS NULL THEN RETURN false; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(event_id::text, 20260720)
  );

  SELECT true INTO valid
  FROM public.notification_send_reconciliation_actions action
  JOIN public.notification_deliveries delivery ON delivery.id = action.delivery_id
  WHERE action.id = _action_id
    AND action.notification_event_id = event_id
    AND action.status = 'effect_pending'
    AND action.claim_token = _claim_token
    AND action.processing_started_at >= now() - interval '10 minutes'
    AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
    AND (delivery.provider_response->>'fallback_send_started_at')::timestamptz
      > now() - interval '23 hours'
    AND action.fallback_whatsapp_delivery_id IS NOT NULL
  FOR UPDATE OF action;

  RETURN COALESCE(valid, false);
END;
$$;


ALTER FUNCTION "public"."validate_notification_send_reconciliation_effect"("_action_id" "uuid", "_claim_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_building_property_sede"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  property_sede UUID;
BEGIN
  SELECT p.sede_id INTO property_sede
  FROM public.properties p
  WHERE p.id = NEW.property_id;

  IF property_sede IS NULL THEN
    RAISE EXCEPTION 'supervision property must have a sede';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.supervision_building_supervisors a
    WHERE a.property_group_id = NEW.property_group_id
      AND a.is_active
      AND NOT public.user_has_sede_access(a.supervisor_user_id, property_sede)
  ) THEN
    RAISE EXCEPTION 'property sede is not accessible to an assigned supervision user';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_building_property_sede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_building_supervisor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.supervisor_user_id
      AND role = 'supervisor'::public.app_role
  ) THEN
    RAISE EXCEPTION 'supervision assignee must have supervisor role';
  END IF;

  IF NOT public.supervision_building_has_sede_access(NEW.property_group_id, NEW.supervisor_user_id) THEN
    RAISE EXCEPTION 'supervisor does not have access to every property sede in building';
  END IF;

  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_building_supervisor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_daily_report_sede"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervision_routes r
    WHERE r.id = NEW.route_id AND r.sede_id = NEW.sede_id
  ) THEN
    RAISE EXCEPTION 'supervision daily report sede does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_daily_report_sede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_incident_links"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  route_sede uuid;
BEGIN
  SELECT sede_id INTO route_sede FROM public.supervision_routes WHERE id = NEW.route_id;
  IF route_sede IS NULL OR route_sede IS DISTINCT FROM NEW.sede_id THEN
    RAISE EXCEPTION 'supervision incident sede does not belong to route';
  END IF;
  IF NEW.route_stop_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supervision_route_stops s
    WHERE s.id = NEW.route_stop_id AND s.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision incident stop does not belong to route';
  END IF;
  IF NEW.review_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supervision_reviews v
    WHERE v.id = NEW.review_id AND v.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision incident review does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_incident_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_incident_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_incident_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_media_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.review_id ELSE NEW.review_id END
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_media_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_media_sede"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.supervision_reviews v
    JOIN public.supervision_routes r ON r.id = v.route_id
    WHERE v.id = NEW.review_id AND r.sede_id = NEW.sede_id
  ) THEN
    RAISE EXCEPTION 'supervision media sede does not belong to review route';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_media_sede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_reservation_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.supervision_route_stops s
    JOIN public.supervision_routes r ON r.id = s.route_id
    WHERE s.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_stop_id ELSE NEW.route_stop_id END
      AND r.status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_reservation_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_review_property_vacancy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  review_at TIMESTAMP WITHOUT TIME ZONE;
  building_check_in TIME;
  building_check_out TIME;
  property_check_out TIME;
BEGIN
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;

  review_at := timezone('Europe/Madrid', COALESCE(NEW.completed_at, NEW.started_at, NEW.created_at, now()));

  SELECT
    COALESCE(pg.check_in_time, '17:00'::time),
    COALESCE(pg.check_out_time, '11:00'::time),
    p.check_out_predeterminado
  INTO building_check_in, building_check_out, property_check_out
  FROM public.property_group_assignments pga
  JOIN public.property_groups pg ON pg.id = pga.property_group_id
  JOIN public.properties p ON p.id = pga.property_id
  WHERE pga.property_id = NEW.property_id
  LIMIT 1;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT r.property_id, r.check_in_date, r.check_out_date, r.status::TEXT AS status
      FROM public.client_reservations r
      UNION ALL
      SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT
      FROM public.avantio_reservations r
      UNION ALL
      SELECT r.property_id, r.arrival_date, r.departure_date, r.status::TEXT
      FROM public.hostaway_reservations r
      UNION ALL
      SELECT r.property_id, r.check_in, r.check_out, r.status::TEXT
      FROM public.smoobu_reservations r
    ) reservations
    WHERE reservations.property_id = NEW.property_id
      AND lower(reservations.status) NOT IN ('cancelled', 'canceled')
      AND (reservations.check_in_date + COALESCE(building_check_in, '17:00'::time)) <= review_at
      AND (reservations.check_out_date + COALESCE(property_check_out, building_check_out, '11:00'::time)) > review_at
  ) THEN
    RAISE EXCEPTION 'supervision review blocked: apartment is occupied according to reservation sources';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_review_property_vacancy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_review_route"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.supervision_route_stops s
    WHERE s.id = NEW.route_stop_id AND s.route_id = NEW.route_id
  ) THEN
    RAISE EXCEPTION 'supervision review stop does not belong to route';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_review_route"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_review_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_review_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_route_building_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.property_group_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.user_is_admin_or_manager()
     AND NOT public.supervision_user_has_building_assignment(NEW.property_group_id, auth.uid(), NEW.route_date) THEN
    RAISE EXCEPTION 'supervision building assignment required for route';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_route_building_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  route_id_to_check uuid;
  old_route_id uuid;
BEGIN
  route_id_to_check := CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END;
  IF TG_OP = 'UPDATE' THEN old_route_id := OLD.route_id; END IF;

  IF EXISTS (
    SELECT 1 FROM public.supervision_routes
    WHERE id IN (route_id_to_check, old_route_id)
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_stock_warehouse_location"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  building_sede UUID;
BEGIN
  IF NEW.property_group_id IS NULL THEN
    IF NEW.location_type = 'building_storage' THEN
      RAISE EXCEPTION 'building storage requires a property group';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.location_type <> 'building_storage' THEN
    RAISE EXCEPTION 'building property group requires building_storage location type';
  END IF;
  IF NEW.is_default THEN
    RAISE EXCEPTION 'default central warehouse cannot be assigned to a building';
  END IF;

  SELECT p.sede_id INTO building_sede
  FROM public.property_group_assignments pga
  JOIN public.properties p ON p.id = pga.property_id
  WHERE pga.property_group_id = NEW.property_group_id
  LIMIT 1;
  IF building_sede IS NULL OR NEW.sede_id IS DISTINCT FROM building_sede THEN
    RAISE EXCEPTION 'stock warehouse and building must belong to the same sede';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_stock_warehouse_location"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_supervision_stop_route_is_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  route_id_to_check uuid;
BEGIN
  route_id_to_check := CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END;
  IF EXISTS (SELECT 1 FROM public.supervision_routes WHERE id = route_id_to_check AND status = 'completed') THEN
    RAISE EXCEPTION 'supervision route is completed and read-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_supervision_stop_route_is_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_invitation"("token" "text", "email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
    SELECT EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE invitation_token::text = trim($1)
        AND LOWER(TRIM(email)) = LOWER(TRIM($2))
        AND status = 'pending'
        AND expires_at > now()
    )
$_$;


ALTER FUNCTION "public"."verify_invitation"("token" "text", "email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_laundry_route_worker_pin"("_route_worker_id" "uuid", "_pin" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.laundry_route_workers rw
    WHERE rw.id = _route_worker_id
      AND rw.is_active = true
      AND rw.pin_hash = extensions.crypt(trim(_pin), rw.pin_hash)
  );
$$;


ALTER FUNCTION "public"."verify_laundry_route_worker_pin"("_route_worker_id" "uuid", "_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."writer_actor_can_access_sede"("_actor_id" "uuid", "_sede_id" "uuid", "_allowed_roles" "public"."app_role"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT _actor_id IS NOT NULL
    AND _sede_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _actor_id AND ur.role = ANY(_allowed_roles)
    )
    AND public.user_has_sede_access(_actor_id, _sede_id);
$$;


ALTER FUNCTION "public"."writer_actor_can_access_sede"("_actor_id" "uuid", "_sede_id" "uuid", "_allowed_roles" "public"."app_role"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_action_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid",
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_action_audit_logs_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'success'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."ai_action_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_action_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "title" "text" DEFAULT 'Propuesta IA'::"text" NOT NULL,
    "summary" "text" NOT NULL,
    "date_from" "date",
    "date_to" "date",
    "sede_id" "uuid",
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_action_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'discarded'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."ai_action_proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "title" "text" DEFAULT 'Nueva conversacion'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_learning_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "category" "text" DEFAULT 'operativa'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "confidence" numeric(4,3) DEFAULT 0.5 NOT NULL,
    "evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_event_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[] NOT NULL,
    "generated_by" "text" DEFAULT 'ai-learning-review'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_learning_suggestions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'edited'::"text", 'discarded'::"text"])))
);


ALTER TABLE "public"."ai_learning_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "category" "text" DEFAULT 'operativa'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "source" "text" DEFAULT 'chat'::"text" NOT NULL,
    "source_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "input_tokens" integer,
    "output_tokens" integer,
    "estimated_cost_usd" numeric(12,6),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_observed_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "sede_id" "uuid",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'app'::"text" NOT NULL,
    "summary" "text" NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_observed_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignment_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid",
    "cleaner_id" "uuid",
    "day_of_week" integer,
    "hour_of_day" integer,
    "avg_completion_time_minutes" integer,
    "success_rate" numeric(5,2),
    "preference_score" numeric(5,2),
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "sample_size" integer DEFAULT 1
);


ALTER TABLE "public"."assignment_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_assignment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "property_group_id" "uuid",
    "assigned_cleaner_id" "uuid",
    "algorithm_used" "text",
    "assignment_reason" "text",
    "confidence_score" numeric(5,2),
    "was_manual_override" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_assignment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auto_assignment_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid",
    "algorithm" "text" DEFAULT 'workload-balance'::"text" NOT NULL,
    "max_concurrent_tasks" integer DEFAULT 3,
    "buffer_time_minutes" integer DEFAULT 15,
    "consider_travel_time" boolean DEFAULT true,
    "learn_from_history" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auto_assignment_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avantio_alert_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_type" "text" NOT NULL,
    "property_id" "uuid",
    "accommodation_id" "text",
    "reference_date" "date" NOT NULL,
    "reservation_id" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."avantio_alert_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avantio_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "avantio_reservation_id" "text" NOT NULL,
    "property_id" "uuid",
    "cliente_id" "uuid",
    "guest_name" "text" NOT NULL,
    "guest_email" "text",
    "arrival_date" "date" NOT NULL,
    "departure_date" "date" NOT NULL,
    "reservation_date" timestamp with time zone,
    "cancellation_date" timestamp with time zone,
    "nights" integer,
    "adults" integer DEFAULT 0,
    "children" integer DEFAULT 0,
    "status" "text" NOT NULL,
    "task_id" "uuid",
    "accommodation_id" "text",
    "accommodation_name" "text",
    "total_amount" numeric(10,2),
    "currency" "text" DEFAULT 'EUR'::"text",
    "notes" "text",
    "last_sync_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avantio_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avantio_sync_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_log_id" "uuid",
    "schedule_id" "uuid",
    "error_type" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_details" "jsonb",
    "retry_attempt" integer DEFAULT 0,
    "resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avantio_sync_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avantio_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sync_completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "reservations_processed" integer DEFAULT 0,
    "new_reservations" integer DEFAULT 0,
    "updated_reservations" integer DEFAULT 0,
    "cancelled_reservations" integer DEFAULT 0,
    "tasks_created" integer DEFAULT 0,
    "tasks_cancelled" integer DEFAULT 0,
    "tasks_modified" integer DEFAULT 0,
    "errors" "text"[],
    "tasks_details" "jsonb",
    "tasks_cancelled_details" "jsonb",
    "tasks_modified_details" "jsonb",
    "reservations_details" "jsonb",
    "triggered_by" "text",
    "schedule_name" "text",
    "retry_attempt" integer DEFAULT 0,
    "original_sync_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avantio_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avantio_sync_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "hour" integer NOT NULL,
    "minute" integer DEFAULT 0 NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avantio_sync_schedules_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23))),
    CONSTRAINT "avantio_sync_schedules_minute_check" CHECK ((("minute" >= 0) AND ("minute" <= 59)))
);


ALTER TABLE "public"."avantio_sync_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_reservation_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "space_subtype_id" integer NOT NULL,
    "space_name" "text" NOT NULL,
    "service_kind" "text" NOT NULL,
    "task_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avirato_reservation_tasks_service_kind_check" CHECK (("service_kind" = ANY (ARRAY['checkout'::"text", 'stay'::"text"])))
);


ALTER TABLE "public"."avirato_reservation_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" "text" NOT NULL,
    "operator_booking_id" "text",
    "master_booking_id" "text",
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "space_subtype_id" integer,
    "space_name" "text" NOT NULL,
    "space_subtype_name" "text",
    "guest_name" "text",
    "adults" integer DEFAULT 0 NOT NULL,
    "children" integer DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "normalized_status" "text" NOT NULL,
    "agency" "text",
    "segment" "text",
    "total_amount" numeric(10,2),
    "sede_id" "uuid",
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_system" "text" DEFAULT 'avirato'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avirato_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_room_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "space_subtype_id" integer NOT NULL,
    "space_name" "text" NOT NULL,
    "service_kind" "text" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "propiedad_id" "uuid" NOT NULL,
    "task_type" "text" DEFAULT 'limpieza-turistica'::"text" NOT NULL,
    "default_start_time" time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    "default_duration_min" integer DEFAULT 60 NOT NULL,
    "default_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avirato_room_mapping_default_duration_min_check" CHECK (("default_duration_min" >= 1)),
    CONSTRAINT "avirato_room_mapping_service_kind_check" CHECK (("service_kind" = ANY (ARRAY['checkout'::"text", 'stay'::"text"])))
);


ALTER TABLE "public"."avirato_room_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_sync_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_log_id" "uuid",
    "reservation_id" "uuid",
    "external_id" "text",
    "space_subtype_id" integer,
    "space_name" "text",
    "error_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "details" "jsonb",
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avirato_sync_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "triggered_by" "text",
    "schedule_name" "text",
    "preview" boolean DEFAULT false NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "reservations_processed" integer DEFAULT 0 NOT NULL,
    "reservations_new" integer DEFAULT 0 NOT NULL,
    "reservations_updated" integer DEFAULT 0 NOT NULL,
    "reservations_cancelled" integer DEFAULT 0 NOT NULL,
    "blocks_detected" integer DEFAULT 0 NOT NULL,
    "stay_tasks_created" integer DEFAULT 0 NOT NULL,
    "checkout_tasks_created" integer DEFAULT 0 NOT NULL,
    "tasks_cancelled" integer DEFAULT 0 NOT NULL,
    "warnings" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "errors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."avirato_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avirato_sync_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "hour" integer NOT NULL,
    "minute" integer DEFAULT 0 NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avirato_sync_schedules_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23))),
    CONSTRAINT "avirato_sync_schedules_minute_check" CHECK ((("minute" >= 0) AND ("minute" <= 59)))
);


ALTER TABLE "public"."avirato_sync_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_task_creation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "payload_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "batch_task_creation_requests_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."batch_task_creation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_task_email_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "recipient" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_message_id" "text",
    "last_error" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "batch_task_email_deliveries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."batch_task_email_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_rate_profile_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_until" "date",
    "labor_cost_per_hour" numeric(12,2) NOT NULL,
    "route_allocation_per_hour" numeric(12,2) NOT NULL,
    "cleaning_sale_price_per_hour" numeric(12,2) NOT NULL,
    "logistics_mode" "public"."tourist_budget_logistics_mode" DEFAULT 'provisional-hourly'::"public"."tourist_budget_logistics_mode" NOT NULL,
    "target_margin_percentage" numeric(6,2),
    "minimum_margin_percentage" numeric(6,2),
    "time_template" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "logistics_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "default_lines" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "commercial_terms" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "budget_rate_profile_versions_check" CHECK ((("effective_until" IS NULL) OR ("effective_until" >= "effective_from"))),
    CONSTRAINT "budget_rate_profile_versions_cleaning_sale_price_per_hour_check" CHECK (("cleaning_sale_price_per_hour" >= (0)::numeric)),
    CONSTRAINT "budget_rate_profile_versions_labor_cost_per_hour_check" CHECK (("labor_cost_per_hour" >= (0)::numeric)),
    CONSTRAINT "budget_rate_profile_versions_minimum_margin_percentage_check" CHECK ((("minimum_margin_percentage" >= (0)::numeric) AND ("minimum_margin_percentage" <= (100)::numeric))),
    CONSTRAINT "budget_rate_profile_versions_route_allocation_per_hour_check" CHECK (("route_allocation_per_hour" >= (0)::numeric)),
    CONSTRAINT "budget_rate_profile_versions_target_margin_percentage_check" CHECK ((("target_margin_percentage" >= (0)::numeric) AND ("target_margin_percentage" <= (100)::numeric))),
    CONSTRAINT "budget_rate_profile_versions_version_number_check" CHECK (("version_number" > 0))
);


ALTER TABLE "public"."budget_rate_profile_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_rate_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."budget_rate_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "availability_time_check" CHECK ((("is_available" = false) OR (("is_available" = true) AND ("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("start_time" < "end_time")))),
    CONSTRAINT "cleaner_availability_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."cleaner_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_group_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid",
    "cleaner_id" "uuid",
    "priority" integer NOT NULL,
    "max_tasks_per_day" integer DEFAULT 8,
    "estimated_travel_time_minutes" integer DEFAULT 15,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_type" "text" DEFAULT 'primary'::"text" NOT NULL,
    "knowledge_level" integer DEFAULT 3 NOT NULL,
    "notes" "text",
    "max_daily_minutes_override" integer,
    CONSTRAINT "cleaner_group_assignments_knowledge_level_check" CHECK ((("knowledge_level" >= 1) AND ("knowledge_level" <= 5))),
    CONSTRAINT "cleaner_group_assignments_role_type_check" CHECK (("role_type" = ANY (ARRAY['primary'::"text", 'secondary'::"text", 'backup'::"text", 'excluded'::"text"])))
);


ALTER TABLE "public"."cleaner_group_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaner_work_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "scheduled_start_time" time without time zone NOT NULL,
    "scheduled_end_time" time without time zone NOT NULL,
    "is_working_day" boolean DEFAULT true,
    "schedule_type" character varying(20) DEFAULT 'regular'::character varying,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cleaner_work_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_incident_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "author_kind" "text" NOT NULL,
    "author_user_id" "uuid",
    "author_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_incident_comments_author_kind_check" CHECK (("author_kind" = ANY (ARRAY['client'::"text", 'limpatex'::"text"]))),
    CONSTRAINT "cleaning_incident_comments_body_check" CHECK (("length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."cleaning_incident_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_incident_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "public"."incident_status",
    "to_status" "public"."incident_status",
    "note" "text",
    "actor_user_id" "uuid",
    "actor_name" "text",
    "actor_role" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_incident_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'approved'::"text", 'discarded_limpatex'::"text", 'status_change'::"text", 'visibility_change'::"text", 'media_added'::"text", 'responsible_changed'::"text", 'deleted'::"text", 'client_in_progress'::"text", 'client_resolved'::"text", 'client_discarded'::"text", 'client_comment'::"text", 'limpatex_comment'::"text"])))
);


ALTER TABLE "public"."cleaning_incident_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_incident_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "kind" "text" DEFAULT 'photo'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_by_role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_incident_media_kind_check" CHECK (("kind" = ANY (ARRAY['photo'::"text", 'video'::"text", 'document'::"text"])))
);


ALTER TABLE "public"."cleaning_incident_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cleaning_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "property_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "reporter_cleaner_id" "uuid",
    "reporter_user_id" "uuid",
    "reporter_kind" "text" NOT NULL,
    "category_id" "uuid",
    "location" "text",
    "description" "text" NOT NULL,
    "status" "public"."incident_status" DEFAULT 'pending_limpatex'::"public"."incident_status" NOT NULL,
    "visibility" "public"."incident_visibility" DEFAULT 'public'::"public"."incident_visibility" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "discarded_by_limpatex_at" timestamp with time zone,
    "discarded_by_limpatex_by" "uuid",
    "discard_limpatex_reason" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_note" "text",
    "client_discard_reason" "text",
    "migrated_from_report_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaning_incidents_reporter_kind_check" CHECK (("reporter_kind" = ANY (ARRAY['cleaner'::"text", 'limpatex_admin'::"text"])))
);


ALTER TABLE "public"."cleaning_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_extraordinary_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "request_type_id" "uuid",
    "request_type_label_snapshot" "text" NOT NULL,
    "service_date" "date" NOT NULL,
    "service_time" time without time zone,
    "guest_name" "text",
    "notes" "text",
    "cost_snapshot" numeric DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "task_id" "uuid",
    "sede_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cer_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."client_extraordinary_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_portal_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "access_pin" character varying(6) NOT NULL,
    "portal_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_access_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "short_code" "text" DEFAULT "public"."generate_short_code"() NOT NULL,
    "last_admin_access_at" timestamp with time zone
);


ALTER TABLE "public"."client_portal_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_portal_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "portal_access_id" "uuid",
    "access_type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "actor_name" "text",
    "actor_email" "text",
    "user_agent" "text",
    "ip_address" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_portal_access_logs_access_type_check" CHECK (("access_type" = ANY (ARRAY['client_pin'::"text", 'admin_bypass'::"text"])))
);


ALTER TABLE "public"."client_portal_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_reservation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "action" character varying(20) NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_type" "text",
    "actor_user_id" "uuid",
    "actor_name" "text",
    "actor_email" "text",
    "property_id" "uuid",
    "property_name" "text",
    "notes" "text",
    CONSTRAINT "client_reservation_logs_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'cancelled'::character varying])::"text"[]))),
    CONSTRAINT "client_reservation_logs_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['client'::"text", 'admin'::"text", 'manager'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."client_reservation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_reservation_logs" IS 'Histórico inmutable de cambios sobre reservas del portal del cliente. Solo visible para admins/managers.';



COMMENT ON COLUMN "public"."client_reservation_logs"."actor_type" IS 'Origen del cambio: client (PIN del portal), admin / manager (panel interno) o system.';



COMMENT ON COLUMN "public"."client_reservation_logs"."actor_user_id" IS 'auth.uid() del usuario interno que realizó el cambio. NULL para acciones del cliente vía PIN.';



COMMENT ON COLUMN "public"."client_reservation_logs"."actor_name" IS 'Nombre legible del actor (cliente o usuario admin) para mostrar en el histórico.';



CREATE TABLE IF NOT EXISTS "public"."client_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "check_in_date" "date" NOT NULL,
    "check_out_date" "date" NOT NULL,
    "guest_count" integer,
    "special_requests" "text",
    "task_id" "uuid",
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_dates" CHECK (("check_out_date" > "check_in_date")),
    CONSTRAINT "client_reservations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."client_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "cif_nif" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "email" "text" NOT NULL,
    "direccion_facturacion" "text" NOT NULL,
    "codigo_postal" "text" NOT NULL,
    "ciudad" "text" NOT NULL,
    "tipo_servicio" "text" NOT NULL,
    "metodo_pago" "text" NOT NULL,
    "supervisor" "text" NOT NULL,
    "factura" boolean DEFAULT false NOT NULL,
    "fecha_creacion" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_actualizacion" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "linen_control_enabled" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "photos_visible_to_client" boolean DEFAULT false NOT NULL,
    "allow_reservation_creation" boolean DEFAULT true NOT NULL,
    "allow_extraordinary_requests" boolean DEFAULT false NOT NULL,
    "allow_incidents" boolean DEFAULT false NOT NULL,
    "operational_portal_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "clients_metodo_pago_check" CHECK (("metodo_pago" = ANY (ARRAY['transferencia'::"text", 'efectivo'::"text", 'bizum'::"text"]))),
    CONSTRAINT "clients_tipo_servicio_check" CHECK (("tipo_servicio" = ANY (ARRAY['limpieza-mantenimiento'::"text", 'mantenimiento-cristaleria'::"text", 'limpieza-turistica'::"text", 'limpieza-puesta-punto'::"text", 'limpieza-final-obra'::"text", 'check-in'::"text", 'desplazamiento'::"text", 'limpieza-especial'::"text", 'trabajo-extraordinario'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."sede_id" IS 'ID de la sede a la que pertenece el cliente';



COMMENT ON COLUMN "public"."clients"."linen_control_enabled" IS 'Whether this client uses the linen control system for all their properties';



COMMENT ON COLUMN "public"."clients"."allow_reservation_creation" IS 'Si es true, el cliente puede crear nuevas reservas desde el portal. Si es false, solo puede consultar las existentes.';



CREATE TABLE IF NOT EXISTS "public"."daily_report_export_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "export_date" "date" NOT NULL,
    "rows_exported" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "token_id" "uuid",
    "sede_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_report_export_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "triggered_by" "text" DEFAULT 'manual'::"text" NOT NULL,
    "triggered_by_user" "uuid",
    "dry_run" boolean DEFAULT true NOT NULL,
    "since_param" timestamp with time zone,
    "include_inactive" boolean DEFAULT false NOT NULL,
    "fetched" integer DEFAULT 0 NOT NULL,
    "created" integer DEFAULT 0 NOT NULL,
    "updated" integer DEFAULT 0 NOT NULL,
    "deactivated" integer DEFAULT 0 NOT NULL,
    "linked" integer DEFAULT 0 NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "duration_ms" integer,
    "success" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."employee_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extraordinary_request_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "icon" "text",
    "description" "text",
    "default_duration_minutes" integer DEFAULT 15 NOT NULL,
    "requires_time" boolean DEFAULT false NOT NULL,
    "default_cost" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "sede_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."extraordinary_request_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "alert_date" "date" NOT NULL,
    "alert_type" "text" NOT NULL,
    "deficit_hours" numeric(6,2),
    "deficit_workers" integer,
    "recipient_email" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dismissed_at" timestamp with time zone,
    "dismissed_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_alerts_log_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['red'::"text", 'yellow'::"text"])))
);


ALTER TABLE "public"."forecast_alerts_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "sede_id" "uuid",
    "daily_digest" boolean DEFAULT true NOT NULL,
    "instant_red_alerts" boolean DEFAULT true NOT NULL,
    "min_days_advance" integer DEFAULT 7 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "forecast_subscribers_min_days_advance_check" CHECK ((("min_days_advance" >= 1) AND ("min_days_advance" <= 60)))
);


ALTER TABLE "public"."forecast_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hostaway_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hostaway_reservation_id" integer NOT NULL,
    "property_id" "uuid",
    "cliente_id" "uuid",
    "arrival_date" "date" NOT NULL,
    "departure_date" "date" NOT NULL,
    "reservation_date" "date",
    "cancellation_date" "date",
    "nights" integer,
    "status" "text" NOT NULL,
    "adults" integer,
    "task_id" "uuid",
    "last_sync_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hostaway_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hostaway_sync_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_log_id" "uuid",
    "schedule_id" "uuid",
    "error_type" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_details" "jsonb" DEFAULT '{}'::"jsonb",
    "retry_attempt" integer DEFAULT 0,
    "resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hostaway_sync_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hostaway_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_started_at" timestamp with time zone NOT NULL,
    "sync_completed_at" timestamp with time zone,
    "reservations_processed" integer DEFAULT 0,
    "new_reservations" integer DEFAULT 0,
    "updated_reservations" integer DEFAULT 0,
    "cancelled_reservations" integer DEFAULT 0,
    "tasks_created" integer DEFAULT 0,
    "errors" "text"[],
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tasks_details" "jsonb" DEFAULT '[]'::"jsonb",
    "reservations_details" "jsonb" DEFAULT '[]'::"jsonb",
    "tasks_cancelled" integer DEFAULT 0,
    "tasks_modified" integer DEFAULT 0,
    "tasks_cancelled_details" "jsonb" DEFAULT '[]'::"jsonb",
    "tasks_modified_details" "jsonb" DEFAULT '[]'::"jsonb",
    "triggered_by" "text" DEFAULT 'manual'::"text",
    "schedule_name" "text",
    "retry_attempt" integer DEFAULT 0,
    "original_sync_id" "uuid"
);


ALTER TABLE "public"."hostaway_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hostaway_sync_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "hour" integer NOT NULL,
    "minute" integer NOT NULL,
    "timezone" "text" DEFAULT 'Europe/Madrid'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "hostaway_sync_schedules_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23))),
    CONSTRAINT "hostaway_sync_schedules_minute_check" CHECK ((("minute" >= 0) AND ("minute" <= 59)))
);


ALTER TABLE "public"."hostaway_sync_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."hostaway_sync_schedules" IS 'Dormant Hostaway integration. Preserved for possible future clients; schedules must remain inactive until an explicit reactivation project.';



CREATE TABLE IF NOT EXISTS "public"."incident_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."incident_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "alert_type" "public"."inventory_alert_type" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "notified_users" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."inventory_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "movement_type" "public"."inventory_movement_type" NOT NULL,
    "quantity" integer NOT NULL,
    "previous_quantity" integer NOT NULL,
    "new_quantity" integer NOT NULL,
    "reason" "text" NOT NULL,
    "task_id" "uuid",
    "property_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quantity_logic" CHECK (((("movement_type" = ANY (ARRAY['entrada'::"public"."inventory_movement_type", 'ajuste'::"public"."inventory_movement_type"])) AND ("quantity" <> 0)) OR (("movement_type" = ANY (ARRAY['salida'::"public"."inventory_movement_type", 'consumo_automatico'::"public"."inventory_movement_type"])) AND ("quantity" < 0))))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "unit_of_measure" "text" DEFAULT 'unidades'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sede_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_products"."sede_id" IS 'ID de la sede a la que pertenece el producto';



CREATE TABLE IF NOT EXISTS "public"."inventory_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "current_quantity" integer DEFAULT 0 NOT NULL,
    "minimum_stock" integer DEFAULT 0 NOT NULL,
    "maximum_stock" integer DEFAULT 0 NOT NULL,
    "cost_per_unit" numeric(10,2),
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    CONSTRAINT "min_max_stock" CHECK (("maximum_stock" >= "minimum_stock")),
    CONSTRAINT "positive_quantities" CHECK ((("current_quantity" >= 0) AND ("minimum_stock" >= 0) AND ("maximum_stock" >= 0)))
);


ALTER TABLE "public"."inventory_stock" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_stock"."sede_id" IS 'ID de la sede a la que pertenece el stock';



CREATE TABLE IF NOT EXISTS "public"."laundry_bag_preparations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "prepared_at" timestamp with time zone,
    "prepared_by_name" "text",
    "issue_at" timestamp with time zone,
    "issue_by_name" "text",
    "issue_reason" "text",
    "last_share_link_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "snapshot_locked_at" timestamp with time zone,
    "route_novelty_type" "text" DEFAULT 'normal'::"text" NOT NULL,
    "route_novelty_resolved" boolean DEFAULT true NOT NULL,
    "route_delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "route_collection_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cancelled_at" timestamp with time zone,
    "cancelled_by_name" "text",
    "undone_at" timestamp with time zone,
    "undone_by_name" "text",
    "undone_reason" "text",
    "route_last_seen_signature" "text",
    "prepared_by_worker_id" "uuid",
    "issue_by_worker_id" "uuid",
    CONSTRAINT "laundry_bag_preparations_issue_reason_check" CHECK ((("status" <> 'issue'::"text") OR ("length"(TRIM(BOTH FROM COALESCE("issue_reason", ''::"text"))) > 0))),
    CONSTRAINT "laundry_bag_preparations_route_collection_status_check" CHECK (("route_collection_status" = ANY (ARRAY['pending'::"text", 'collected'::"text"]))),
    CONSTRAINT "laundry_bag_preparations_route_delivery_status_check" CHECK (("route_delivery_status" = ANY (ARRAY['pending'::"text", 'delivered'::"text"]))),
    CONSTRAINT "laundry_bag_preparations_route_novelty_type_check" CHECK (("route_novelty_type" = ANY (ARRAY['normal'::"text", 'new'::"text", 'changed'::"text", 'carryover'::"text", 'cancelled_before'::"text", 'cancelled_after'::"text", 'undone'::"text"]))),
    CONSTRAINT "laundry_bag_preparations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'prepared'::"text", 'issue'::"text"])))
);


ALTER TABLE "public"."laundry_bag_preparations" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_bag_preparations" IS 'Global per-task laundry bag preparation status used across route links.';



CREATE TABLE IF NOT EXISTS "public"."laundry_classic_route_order" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "delivery_day" integer NOT NULL,
    "property_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_classic_route_order_delivery_day_check" CHECK ((("delivery_day" = '-1'::integer) OR (("delivery_day" >= 0) AND ("delivery_day" <= 6)))),
    CONSTRAINT "laundry_classic_route_order_position_check" CHECK (("position" >= 0))
);


ALTER TABLE "public"."laundry_classic_route_order" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_classic_route_order" IS 'Orden por sede y dia de reparto para los enlaces clasicos /lavanderia.';



COMMENT ON COLUMN "public"."laundry_classic_route_order"."delivery_day" IS '-1 es el orden base comun; 0-6 son excepciones por dia de reparto.';



CREATE TABLE IF NOT EXISTS "public"."laundry_delivery_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "day_of_week" integer NOT NULL,
    "name" "text" NOT NULL,
    "collection_days" integer[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_delivery_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."laundry_delivery_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."laundry_delivery_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "share_link_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "status" "public"."laundry_delivery_status" DEFAULT 'pending'::"public"."laundry_delivery_status" NOT NULL,
    "prepared_at" timestamp with time zone,
    "prepared_by_name" "text",
    "delivered_at" timestamp with time zone,
    "delivered_by_name" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "collection_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "collected_at" timestamp with time zone,
    "collected_by_name" "text",
    "collected_by_worker_id" "uuid",
    "delivered_by_worker_id" "uuid",
    CONSTRAINT "valid_collection_status" CHECK (("collection_status" = ANY (ARRAY['pending'::"text", 'collected'::"text"])))
);


ALTER TABLE "public"."laundry_delivery_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."laundry_dirty_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "movement_type" "text" NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "previous_quantity" numeric(12,2) NOT NULL,
    "new_quantity" numeric(12,2) NOT NULL,
    "reason" "text" NOT NULL,
    "task_id" "uuid",
    "property_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_dirty_movements_quantities_non_negative" CHECK ((("previous_quantity" >= (0)::numeric) AND ("new_quantity" >= (0)::numeric))),
    CONSTRAINT "laundry_dirty_movements_quantity_positive" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "laundry_dirty_movements_reason_not_blank" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0)),
    CONSTRAINT "laundry_dirty_movements_type_valid" CHECK (("movement_type" = ANY (ARRAY['entrada'::"text", 'salida'::"text", 'ajuste'::"text"])))
);


ALTER TABLE "public"."laundry_dirty_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_dirty_movements" IS 'Audit trail for dirty laundry additions, removals and adjustments.';



CREATE TABLE IF NOT EXISTS "public"."laundry_link_sync_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "share_link_id" "uuid",
    "delivery_date" "date" NOT NULL,
    "trigger" "text" NOT NULL,
    "actor_id" "uuid",
    "status" "text" NOT NULL,
    "task_count" integer DEFAULT 0 NOT NULL,
    "added_count" integer DEFAULT 0 NOT NULL,
    "removed_count" integer DEFAULT 0 NOT NULL,
    "excluded_count" integer DEFAULT 0 NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_link_sync_runs_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'error'::"text"]))),
    CONSTRAINT "laundry_link_sync_runs_trigger_check" CHECK (("trigger" = ANY (ARRAY['cron'::"text", 'manual'::"text", 'on_open'::"text", 'create'::"text"])))
);


ALTER TABLE "public"."laundry_link_sync_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_link_sync_runs" IS 'Auditoria de reconciliaciones automaticas de enlaces clasicos de lavanderia.';



CREATE TABLE IF NOT EXISTS "public"."laundry_route_access_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "share_link_id" "uuid",
    "route_worker_id" "uuid",
    "ip_fingerprint" "text",
    "successful" boolean DEFAULT false NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."laundry_route_access_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."laundry_route_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_worker_id" "uuid" NOT NULL,
    "share_link_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."laundry_route_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_route_sessions" IS 'Short-lived access sessions scoped to one route_v2 share link.';



CREATE TABLE IF NOT EXISTS "public"."laundry_route_v2_authorizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "share_link_id" "uuid",
    "delivery_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "affected_task_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_route_v2_authorizations_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) >= 3))
);


ALTER TABLE "public"."laundry_route_v2_authorizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_route_v2_authorizations" IS 'Autorizaciones auditadas para continuar una ruta v2 incompleta.';



CREATE TABLE IF NOT EXISTS "public"."laundry_route_v2_bag_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "share_link_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "delivery_date" "date" NOT NULL,
    "task_signature" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "snapshot_locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."laundry_route_v2_bag_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_route_v2_bag_snapshots" IS 'Contenido congelado de cada bolsa del nuevo sistema de ruta.';



CREATE TABLE IF NOT EXISTS "public"."laundry_route_v2_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "share_link_id" "uuid",
    "task_id" "uuid",
    "delivery_date" "date",
    "event_type" "text" NOT NULL,
    "novelty_type" "text",
    "property_code" "text",
    "event_key" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_route_v2_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['route_created'::"text", 'route_refreshed'::"text", 'task_added'::"text", 'task_changed'::"text", 'task_removed'::"text", 'task_cancelled'::"text", 'bag_prepared'::"text", 'bag_issue'::"text", 'bag_undo'::"text", 'bag_no_carry'::"text", 'critical_block'::"text", 'admin_authorized'::"text"]))),
    CONSTRAINT "laundry_route_v2_events_novelty_type_check" CHECK ((("novelty_type" IS NULL) OR ("novelty_type" = ANY (ARRAY['normal'::"text", 'new'::"text", 'changed'::"text", 'carryover'::"text", 'cancelled_before'::"text", 'cancelled_after'::"text", 'undone'::"text"]))))
);


ALTER TABLE "public"."laundry_route_v2_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_route_v2_events" IS 'Novedades y auditoria del nuevo sistema de ruta, separado del enlace clasico.';



CREATE TABLE IF NOT EXISTS "public"."laundry_route_worker_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "share_link_id" "uuid",
    "task_id" "uuid",
    "route_worker_id" "uuid",
    "worker_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_route_worker_events_action_check" CHECK (("action" = ANY (ARRAY['login'::"text", 'logout'::"text", 'prepare'::"text", 'issue'::"text", 'collect'::"text", 'deliver'::"text"])))
);


ALTER TABLE "public"."laundry_route_worker_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."laundry_route_workers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'repartidor'::"text" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "source" "text" DEFAULT 'registro'::"text" NOT NULL,
    "last_access_at" timestamp with time zone,
    "pin_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "laundry_route_workers_role_check" CHECK (("role" = 'repartidor'::"text")),
    CONSTRAINT "laundry_route_workers_source_check" CHECK (("source" = 'registro'::"text"))
);


ALTER TABLE "public"."laundry_route_workers" OWNER TO "postgres";


COMMENT ON TABLE "public"."laundry_route_workers" IS 'REGISTRO workers explicitly enabled as route_v2 repartidores.';



COMMENT ON COLUMN "public"."laundry_route_workers"."pin_hash" IS 'One-way hash derived from cleaners.pin. The source PIN remains REGISTRO.';



CREATE TABLE IF NOT EXISTS "public"."laundry_share_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "date_start" "date" NOT NULL,
    "date_end" "date" NOT NULL,
    "expires_at" timestamp with time zone,
    "is_permanent" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "snapshot_task_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_task_ids" "text"[],
    "sede_id" "uuid",
    "delivery_day" integer,
    "collection_dates" "date"[],
    "link_type" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "workflow_version" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "route_order_applied" boolean DEFAULT false NOT NULL,
    "delivery_date" "date",
    "auto_managed" boolean DEFAULT false NOT NULL,
    "manual_excluded_task_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "last_synced_at" timestamp with time zone,
    "sync_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sync_error" "text",
    CONSTRAINT "laundry_share_links_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['pending'::"text", 'ok'::"text", 'error'::"text"]))),
    CONSTRAINT "laundry_share_links_workflow_version_check" CHECK (("workflow_version" = ANY (ARRAY['legacy'::"text", 'route_v2'::"text"])))
);


ALTER TABLE "public"."laundry_share_links" OWNER TO "postgres";


COMMENT ON COLUMN "public"."laundry_share_links"."original_task_ids" IS 'All task IDs that existed when the link was created, used to detect truly new tasks (not just excluded ones)';



COMMENT ON COLUMN "public"."laundry_share_links"."workflow_version" IS 'Workflow renderer for public laundry links. route_v2 uses global bag preparation and sequential next-route preparation.';



COMMENT ON COLUMN "public"."laundry_share_links"."route_order_applied" IS 'Indica que snapshot_task_ids conserva el orden operativo de la ruta clasica.';



COMMENT ON COLUMN "public"."laundry_share_links"."delivery_date" IS 'Fecha real de reparto local del enlace clasico.';



COMMENT ON COLUMN "public"."laundry_share_links"."auto_managed" IS 'Indica que el enlace se reconcilia automaticamente y conserva su token.';



COMMENT ON COLUMN "public"."laundry_share_links"."manual_excluded_task_ids" IS 'Tareas excluidas manualmente que nunca debe reintroducir la sincronizacion.';



CREATE TABLE IF NOT EXISTS "public"."lh_reservation_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "service_kind" "text" NOT NULL,
    "task_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lh_room" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "lh_reservation_tasks_service_kind_check" CHECK (("service_kind" = ANY (ARRAY['checkout'::"text", 'stay'::"text"])))
);


ALTER TABLE "public"."lh_reservation_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lh_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" "text" NOT NULL,
    "uuid" "text",
    "reference" "text",
    "channel" "text",
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "room" "text" NOT NULL,
    "guest_name" "text",
    "adults" integer DEFAULT 0,
    "children" integer DEFAULT 0,
    "infants" integer DEFAULT 0,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "total" "text",
    "synced_at" timestamp with time zone,
    "sede_id" "uuid",
    "source_system" "text" DEFAULT 'little_hotelier'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rooms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "needs_room_assignment" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."lh_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lh_room_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "lh_room" "text" NOT NULL,
    "service_kind" "text" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "propiedad_id" "uuid" NOT NULL,
    "task_type" "text" DEFAULT 'limpieza-turistica'::"text" NOT NULL,
    "default_start_time" time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    "default_duration_min" integer DEFAULT 60 NOT NULL,
    "default_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lh_room_mapping_default_duration_min_check" CHECK ((("default_duration_min" >= 15) AND (("default_duration_min" % 15) = 0))),
    CONSTRAINT "lh_room_mapping_service_kind_check" CHECK (("service_kind" = ANY (ARRAY['checkout'::"text", 'stay'::"text"])))
);


ALTER TABLE "public"."lh_room_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lh_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" "text",
    "status_code" integer,
    "success" boolean DEFAULT true NOT NULL,
    "payload" "jsonb",
    "result" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lh_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logistics_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "picklist_id" "uuid",
    "status" "public"."logistics_delivery_status" DEFAULT 'planned'::"public"."logistics_delivery_status" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sede_id" "uuid" NOT NULL
);


ALTER TABLE "public"."logistics_deliveries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."logistics_deliveries"."sede_id" IS 'ID de la sede a la que pertenece la entrega';



CREATE TABLE IF NOT EXISTS "public"."logistics_delivery_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stop_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."logistics_delivery_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logistics_delivery_stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "planned_time" timestamp with time zone,
    "actual_time" timestamp with time zone,
    "status" "public"."logistics_stop_status" DEFAULT 'pending'::"public"."logistics_stop_status" NOT NULL,
    "signature_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."logistics_delivery_stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logistics_picklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "picklist_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "property_id" "uuid",
    "reserved" boolean DEFAULT false NOT NULL,
    "reserved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "products_summary" "jsonb" DEFAULT '[]'::"jsonb",
    "is_property_package" boolean DEFAULT false
);


ALTER TABLE "public"."logistics_picklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logistics_picklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "status" "public"."logistics_picklist_status" DEFAULT 'draft'::"public"."logistics_picklist_status" NOT NULL,
    "scheduled_date" "date",
    "created_by" "uuid",
    "committed_by" "uuid",
    "committed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sede_id" "uuid" NOT NULL
);


ALTER TABLE "public"."logistics_picklists" OWNER TO "postgres";


COMMENT ON COLUMN "public"."logistics_picklists"."sede_id" IS 'ID de la sede a la que pertenece la lista de picking';



CREATE TABLE IF NOT EXISTS "public"."notification_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_event_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_message_id" "text",
    "recipient" "text" NOT NULL,
    "template_name" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "provider_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provider_response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_code" "text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_deliveries_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text"]))),
    CONSTRAINT "notification_deliveries_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text", 'undeliverable'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."notification_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_delivery_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "attempt_no" smallint NOT NULL,
    "claim_token" "uuid" NOT NULL,
    "event_lease_token" "uuid" NOT NULL,
    "state" "text" NOT NULL,
    "provider_message_id" "text",
    "provider_response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "correlation_source" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finalized_at" timestamp with time zone,
    "last_status" "text",
    "status_occurred_at" timestamp with time zone,
    "error_code" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_delivery_attempts_attempt_no_check" CHECK ((("attempt_no" >= 1) AND ("attempt_no" <= 2))),
    CONSTRAINT "notification_delivery_attempts_state_check" CHECK (("state" = ANY (ARRAY['contacting_meta'::"text", 'completed_uncertain'::"text", 'accepted'::"text", 'failed'::"text", 'callback_observed'::"text", 'reconciled'::"text"])))
);


ALTER TABLE "public"."notification_delivery_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_delivery_attempts" IS 'Historial inmutable one-to-many de los dos POST Meta permitidos por delivery lógica.';



CREATE TABLE IF NOT EXISTS "public"."notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" DEFAULT 'tasks'::"text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "cleaner_id" "uuid",
    "sede_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dedupe_key" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "processing_lease_token" "uuid",
    "batch_id" "uuid",
    "snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "recipient_worker_id" "uuid",
    "recipient_name_snapshot" "text",
    "recipient_phone_snapshot" "text",
    "recipient_sequence" integer,
    "superseded_by" "uuid",
    "notification_mode" "text" DEFAULT 'live'::"text" NOT NULL,
    "processing_attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    CONSTRAINT "notification_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['task_assigned'::"text", 'task_modified'::"text", 'task_cancelled'::"text", 'task_approval_reminder'::"text", 'task_late_start_reminder'::"text", 'task_rejected_alert'::"text", 'task_approved_confirmation'::"text"]))),
    CONSTRAINT "notification_events_notification_mode_check" CHECK (("notification_mode" = ANY (ARRAY['shadow'::"text", 'test'::"text", 'live'::"text"]))),
    CONSTRAINT "notification_events_processing_attempts_check" CHECK ((("processing_attempts" >= 0) AND (("max_attempts" >= 1) AND ("max_attempts" <= 20)))),
    CONSTRAINT "notification_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text", 'dead_letter'::"text"])))
);


ALTER TABLE "public"."notification_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_send_reconciliation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "notification_event_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "resolution" "text" NOT NULL,
    "provider_message_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processing_started_at" timestamp with time zone,
    "claim_token" "uuid",
    "effect_started_at" timestamp with time zone,
    "fallback_whatsapp_delivery_id" "uuid",
    "completed_at" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "result_detail" "text",
    CONSTRAINT "notification_send_reconciliation_actions_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text"]))),
    CONSTRAINT "notification_send_reconciliation_actions_resolution_check" CHECK (("resolution" = ANY (ARRAY['confirmed_sent'::"text", 'confirmed_not_sent'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "notification_send_reconciliation_actions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'effect_pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."notification_send_reconciliation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_apply_batch_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "item_ordinal" integer NOT NULL,
    "item_key" "text" NOT NULL,
    "task_id" "uuid",
    "recurring_task_id" "uuid",
    "execution_date" "date",
    "expected_planning_version" bigint,
    "request_item" "jsonb" NOT NULL,
    "before_snapshot" "jsonb",
    "after_snapshot" "jsonb",
    "apply_status" "text" NOT NULL,
    "conflict_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_apply_batch_items_apply_status_check" CHECK (("apply_status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'conflict'::"text", 'technical_failed'::"text"])))
);


ALTER TABLE "public"."planning_apply_batch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_apply_batches" (
    "id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "source_run_id" "uuid",
    "source_run_version" bigint,
    "idempotency_key" "text" NOT NULL,
    "request_hash" "text" NOT NULL,
    "request_items" "jsonb" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "expected_task_count" integer NOT NULL,
    "expected_assignment_count" integer DEFAULT 0 NOT NULL,
    "notification_policy" "text" NOT NULL,
    "result_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "failure_code" "text",
    "failure_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "planning_apply_batches_expected_assignment_count_check" CHECK (("expected_assignment_count" >= 0)),
    CONSTRAINT "planning_apply_batches_expected_task_count_check" CHECK ((("expected_task_count" >= 1) AND ("expected_task_count" <= 500))),
    CONSTRAINT "planning_apply_batches_notification_policy_check" CHECK (("notification_policy" = ANY (ARRAY['require_all_recipients'::"text", 'best_effort'::"text"]))),
    CONSTRAINT "planning_apply_batches_request_hash_check" CHECK (("request_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "planning_apply_batches_status_check" CHECK (("status" = ANY (ARRAY['applying'::"text", 'applied'::"text", 'validation_failed'::"text", 'technical_failed'::"text"])))
);


ALTER TABLE "public"."planning_apply_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_assignment_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "batch_item_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "actor_id" "uuid" NOT NULL,
    "before_snapshot" "jsonb" NOT NULL,
    "after_snapshot" "jsonb" NOT NULL,
    "net_change" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_assignment_audit_net_change_check" CHECK (("net_change" = ANY (ARRAY['assigned'::"text", 'cancelled'::"text", 'modified'::"text", 'unchanged'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."planning_assignment_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_conflicts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."planning_conflicts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_notification_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "cleaner_email" "text",
    "cleaner_name" "text" NOT NULL,
    "task_date" "date" NOT NULL,
    "task_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "notification_key" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_notification_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."planning_notification_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_run_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "property_group_id" "uuid",
    "proposed_cleaner_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "proposed_cleaner_names" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "role_source" "text" NOT NULL,
    "explanation" "text" NOT NULL,
    "warnings" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "score" numeric(8,2) DEFAULT 0 NOT NULL,
    "proposal" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "applied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_run_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'discarded'::"text", 'applied'::"text"])))
);


ALTER TABLE "public"."planning_run_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "discarded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "applied_batch_id" "uuid",
    CONSTRAINT "planning_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'discarded'::"text"])))
);


ALTER TABLE "public"."planning_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planning_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "horizon_days" integer DEFAULT 14 NOT NULL,
    "buffer_minutes" integer DEFAULT 30 NOT NULL,
    "allow_backups" boolean DEFAULT true NOT NULL,
    "exclude_extraordinary" boolean DEFAULT true NOT NULL,
    "approval_required" boolean DEFAULT true NOT NULL,
    "fallback_daily_capacity_minutes" integer DEFAULT 480 NOT NULL,
    "weekly_tolerance_percent" numeric(5,2) DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_settings_buffer_minutes_check" CHECK ((("buffer_minutes" >= 0) AND ("buffer_minutes" <= 180))),
    CONSTRAINT "planning_settings_fallback_daily_capacity_minutes_check" CHECK ((("fallback_daily_capacity_minutes" >= 60) AND ("fallback_daily_capacity_minutes" <= 900))),
    CONSTRAINT "planning_settings_horizon_days_check" CHECK ((("horizon_days" >= 1) AND ("horizon_days" <= 30))),
    CONSTRAINT "planning_settings_weekly_tolerance_percent_check" CHECK ((("weekly_tolerance_percent" >= (0)::numeric) AND ("weekly_tolerance_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."planning_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "direccion" "text" NOT NULL,
    "numero_camas" integer DEFAULT 0 NOT NULL,
    "numero_banos" integer DEFAULT 0 NOT NULL,
    "duracion_servicio" integer DEFAULT 60 NOT NULL,
    "coste_servicio" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "check_in_predeterminado" time without time zone DEFAULT '15:00:00'::time without time zone NOT NULL,
    "check_out_predeterminado" time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    "numero_sabanas" integer DEFAULT 0 NOT NULL,
    "numero_toallas_grandes" integer DEFAULT 0 NOT NULL,
    "numero_toallas_pequenas" integer DEFAULT 0 NOT NULL,
    "numero_alfombrines" integer DEFAULT 0 NOT NULL,
    "numero_fundas_almohada" integer DEFAULT 0 NOT NULL,
    "notas" "text" DEFAULT ''::"text",
    "cliente_id" "uuid" NOT NULL,
    "fecha_creacion" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_actualizacion" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hostaway_listing_id" integer,
    "hostaway_internal_name" "text",
    "kit_alimentario" integer DEFAULT 0 NOT NULL,
    "jabon_liquido" integer DEFAULT 0 NOT NULL,
    "gel_ducha" integer DEFAULT 0 NOT NULL,
    "champu" integer DEFAULT 0 NOT NULL,
    "acondicionador" integer DEFAULT 0 NOT NULL,
    "papel_higienico" integer DEFAULT 0 NOT NULL,
    "ambientador_bano" integer DEFAULT 0 NOT NULL,
    "desinfectante_bano" integer DEFAULT 0 NOT NULL,
    "aceite" integer DEFAULT 0 NOT NULL,
    "sal" integer DEFAULT 0 NOT NULL,
    "azucar" integer DEFAULT 0 NOT NULL,
    "vinagre" integer DEFAULT 0 NOT NULL,
    "detergente_lavavajillas" integer DEFAULT 0 NOT NULL,
    "limpiacristales" integer DEFAULT 0 NOT NULL,
    "bayetas_cocina" integer DEFAULT 0 NOT NULL,
    "estropajos" integer DEFAULT 0 NOT NULL,
    "bolsas_basura" integer DEFAULT 0 NOT NULL,
    "papel_cocina" integer DEFAULT 0 NOT NULL,
    "amenities_bano" integer DEFAULT 0 NOT NULL,
    "amenities_cocina" integer DEFAULT 0 NOT NULL,
    "numero_camas_pequenas" integer DEFAULT 0 NOT NULL,
    "numero_sofas_cama" integer DEFAULT 0 NOT NULL,
    "numero_sabanas_pequenas" integer DEFAULT 0 NOT NULL,
    "cantidad_rollos_papel_higienico" integer DEFAULT 0 NOT NULL,
    "cantidad_rollos_papel_cocina" integer DEFAULT 0 NOT NULL,
    "numero_camas_suite" integer DEFAULT 0 NOT NULL,
    "numero_sabanas_suite" integer DEFAULT 0 NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "linen_control_enabled" boolean,
    "is_active" boolean,
    "avantio_accommodation_id" "text",
    "avantio_accommodation_name" "text",
    "exclude_from_export" boolean DEFAULT false NOT NULL,
    "default_stock_warehouse_id" "uuid",
    "numero_cocinas" integer DEFAULT 1 NOT NULL,
    "planning_estimated_checkout_minutes" integer,
    "planning_estimated_stay_minutes" integer,
    "planning_required_cleaners" integer DEFAULT 1 NOT NULL,
    "planning_complexity" integer DEFAULT 1 NOT NULL,
    "planning_requires_linen_load" boolean DEFAULT false NOT NULL,
    "planning_requires_amenities_load" boolean DEFAULT false NOT NULL,
    "planning_special_instructions" "text",
    CONSTRAINT "properties_numero_cocinas_non_negative" CHECK (("numero_cocinas" >= 0)),
    CONSTRAINT "properties_planning_complexity_check" CHECK ((("planning_complexity" >= 1) AND ("planning_complexity" <= 5))),
    CONSTRAINT "properties_planning_required_cleaners_check" CHECK ((("planning_required_cleaners" >= 1) AND ("planning_required_cleaners" <= 4)))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."sede_id" IS 'ID de la sede a la que pertenece la propiedad';



COMMENT ON COLUMN "public"."properties"."linen_control_enabled" IS 'Override linen control for this specific property. NULL = inherit from client, true/false = explicit override';



CREATE TABLE IF NOT EXISTS "public"."property_amenity_inventory_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "amenity_field" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_amenity_inventory_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_checklist_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "checklist_template_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_checklist_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_consumption_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity_per_cleaning" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "positive_quantity" CHECK (("quantity_per_cleaning" >= 0))
);


ALTER TABLE "public"."property_consumption_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_group_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid",
    "property_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."property_group_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "check_out_time" time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    "check_in_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "auto_assign_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "internal_code" "text",
    "display_name" "text",
    "zone" "text",
    "client_name" "text",
    "supervisor_name" "text",
    "general_instructions" "text",
    "difficulty_level" integer DEFAULT 1 NOT NULL,
    "recommended_capacity" integer DEFAULT 1 NOT NULL,
    "planning_notes" "text"
);


ALTER TABLE "public"."property_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_preferred_cleaners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."property_preferred_cleaners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_task_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recurring_task_id" "uuid" NOT NULL,
    "generated_task_id" "uuid",
    "execution_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "success" boolean DEFAULT true NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "execution_day" "date"
);


ALTER TABLE "public"."recurring_task_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "cliente_id" "uuid",
    "propiedad_id" "uuid",
    "type" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "check_out" time without time zone NOT NULL,
    "check_in" time without time zone NOT NULL,
    "duracion" integer,
    "coste" numeric(10,2),
    "metodo_pago" "text",
    "supervisor" "text",
    "cleaner" "text",
    "cleaner_id" "uuid",
    "frequency" "text" NOT NULL,
    "interval_days" integer DEFAULT 1 NOT NULL,
    "days_of_week" integer[],
    "day_of_month" integer,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "next_execution" "date" NOT NULL,
    "last_execution" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "state_revision" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "recurring_tasks_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text"])))
);


ALTER TABLE "public"."recurring_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recurring_tasks"."sede_id" IS 'ID de la sede a la que pertenece la tarea recurrente';



CREATE TABLE IF NOT EXISTS "public"."report_export_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "name" "text" DEFAULT 'Token de exportación'::"text" NOT NULL,
    "sede_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_export_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "attempt_count" integer DEFAULT 1 NOT NULL,
    "first_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_attempt_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocked_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sede_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "from_sede_id" "uuid",
    "to_sede_id" "uuid",
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sede_audit_log_event_type_check" CHECK (("event_type" = ANY (ARRAY['sede_changed'::"text", 'sede_access_granted'::"text", 'sede_access_revoked'::"text", 'sede_created'::"text", 'sede_updated'::"text", 'sede_deactivated'::"text"])))
);


ALTER TABLE "public"."sede_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."sede_audit_log" IS 'Log de auditoría para eventos relacionados con sedes';



COMMENT ON COLUMN "public"."sede_audit_log"."event_type" IS 'Tipo de evento: sede_changed, sede_access_granted, sede_access_revoked, etc.';



COMMENT ON COLUMN "public"."sede_audit_log"."from_sede_id" IS 'Sede origen (para cambios de sede)';



COMMENT ON COLUMN "public"."sede_audit_log"."to_sede_id" IS 'Sede destino (para cambios de sede)';



COMMENT ON COLUMN "public"."sede_audit_log"."event_data" IS 'Datos adicionales del evento en formato JSON';



CREATE TABLE IF NOT EXISTS "public"."sedes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "ciudad" "text" NOT NULL,
    "direccion" "text",
    "telefono" "text",
    "email" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sedes" OWNER TO "postgres";


COMMENT ON TABLE "public"."sedes" IS 'Tabla que almacena la información de las diferentes sedes de la empresa';



COMMENT ON COLUMN "public"."sedes"."codigo" IS 'Código único identificador de la sede (ej: MAD, BCN, VAL)';



CREATE TABLE IF NOT EXISTS "public"."smoobu_property_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "smoobu_property_name" "text" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smoobu_property_mappings_name_not_blank" CHECK (("btrim"("smoobu_property_name") <> ''::"text"))
);


ALTER TABLE "public"."smoobu_property_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smoobu_reservation_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "service_kind" "text" DEFAULT 'checkout'::"text" NOT NULL,
    "task_date" "date" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smoobu_reservation_tasks_kind_valid" CHECK (("service_kind" = 'checkout'::"text")),
    CONSTRAINT "smoobu_reservation_tasks_status_valid" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."smoobu_reservation_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."smoobu_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "external_id" "text" NOT NULL,
    "property_name" "text" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "guest_name" "text",
    "source_system" "text" DEFAULT 'smoobu'::"text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "smoobu_reservations_dates_valid" CHECK (("check_out" > "check_in")),
    CONSTRAINT "smoobu_reservations_status_valid" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'modified'::"text", 'cancelled'::"text", 'canceled'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."smoobu_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staffing_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid",
    "day_of_week" integer NOT NULL,
    "min_workers" integer DEFAULT 2 NOT NULL,
    "min_hours" numeric(5,2) DEFAULT 12 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staffing_targets_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "staffing_targets_min_hours_check" CHECK (("min_hours" >= (0)::numeric)),
    CONSTRAINT "staffing_targets_min_workers_check" CHECK (("min_workers" >= 0))
);


ALTER TABLE "public"."staffing_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stock_level_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "alert_type" "public"."stock_alert_type" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "notified_users" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."stock_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."stock_item_kind" DEFAULT 'other'::"public"."stock_item_kind" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_categories_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "name")) > 0))
);


ALTER TABLE "public"."stock_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_categories" IS 'New stock module categories classified as laundry, amenity or other.';



CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "to_warehouse_id" "uuid",
    "movement_type" "public"."stock_movement_type" NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "previous_quantity" numeric(12,2) NOT NULL,
    "new_quantity" numeric(12,2) NOT NULL,
    "to_previous_quantity" numeric(12,2),
    "to_new_quantity" numeric(12,2),
    "reason" "text" NOT NULL,
    "task_id" "uuid",
    "property_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_movements_quantity_positive" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "stock_movements_reason_not_blank" CHECK (("length"(TRIM(BOTH FROM "reason")) > 0)),
    CONSTRAINT "stock_movements_transfer_quantities" CHECK (((("movement_type" = 'transferencia'::"public"."stock_movement_type") AND ("to_previous_quantity" IS NOT NULL) AND ("to_new_quantity" IS NOT NULL)) OR (("movement_type" <> 'transferencia'::"public"."stock_movement_type") AND ("to_previous_quantity" IS NULL) AND ("to_new_quantity" IS NULL)))),
    CONSTRAINT "stock_movements_transfer_target" CHECK (((("movement_type" = 'transferencia'::"public"."stock_movement_type") AND ("to_warehouse_id" IS NOT NULL) AND ("warehouse_id" <> "to_warehouse_id")) OR (("movement_type" <> 'transferencia'::"public"."stock_movement_type") AND ("to_warehouse_id" IS NULL))))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_movements" IS 'Audit trail of stock movements. Quantities are always positive; movement_type defines direction.';



CREATE TABLE IF NOT EXISTS "public"."stock_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "unit_of_measure" "text" DEFAULT 'unidades'::"text" NOT NULL,
    "sku" "text",
    "is_consumable" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_products_name_not_blank" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "stock_products_unit_not_blank" CHECK (("length"(TRIM(BOTH FROM "unit_of_measure")) > 0))
);


ALTER TABLE "public"."stock_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_products" IS 'New stock module product catalog, scoped by sede.';



CREATE TABLE IF NOT EXISTS "public"."stock_property_consumption_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid",
    "quantity_per_cleaning" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_consumption_rules_quantity_non_negative" CHECK (("quantity_per_cleaning" >= (0)::numeric))
);


ALTER TABLE "public"."stock_property_consumption_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_property_consumption_rules" IS 'Property-specific stock consumption overrides.';



CREATE TABLE IF NOT EXISTS "public"."stock_property_field_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "property_field" "text" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "warehouse_id" "uuid",
    "multiplier" numeric(12,2) DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "stock_field_mappings_field_not_blank" CHECK (("length"(TRIM(BOTH FROM "property_field")) > 0)),
    CONSTRAINT "stock_field_mappings_multiplier_positive" CHECK (("multiplier" > (0)::numeric))
);


ALTER TABLE "public"."stock_property_field_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_property_field_mappings" IS 'Default mapping from property fields to stock products for automatic consumption.';



CREATE TABLE IF NOT EXISTS "public"."stock_sede_settings" (
    "sede_id" "uuid" NOT NULL,
    "auto_consumption_enabled" boolean DEFAULT false NOT NULL,
    "preparation_mode" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stock_sede_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_sede_settings" IS 'Operational switches for stock rollout by sede.';



CREATE TABLE IF NOT EXISTS "public"."supervision_building_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid" NOT NULL,
    "quick_review_every_days" integer DEFAULT 1 NOT NULL,
    "full_review_every_days" integer DEFAULT 7 NOT NULL,
    "full_review_requires_cleaning" boolean DEFAULT false NOT NULL,
    "review_open_incidents" boolean DEFAULT true NOT NULL,
    "review_returned_work" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_building_policies_full_review_every_days_check" CHECK ((("full_review_every_days" >= 1) AND ("full_review_every_days" <= 90))),
    CONSTRAINT "supervision_building_policies_quick_review_every_days_check" CHECK ((("quick_review_every_days" >= 1) AND ("quick_review_every_days" <= 31)))
);


ALTER TABLE "public"."supervision_building_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_building_supervisors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_group_id" "uuid" NOT NULL,
    "supervisor_user_id" "uuid" NOT NULL,
    "role_type" "text" DEFAULT 'primary'::"text" NOT NULL,
    "priority" integer DEFAULT 10 NOT NULL,
    "starts_on" "date",
    "ends_on" "date",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_building_supervisors_check" CHECK ((("ends_on" IS NULL) OR ("starts_on" IS NULL) OR ("ends_on" >= "starts_on"))),
    CONSTRAINT "supervision_building_supervisors_priority_check" CHECK (("priority" > 0)),
    CONSTRAINT "supervision_building_supervisors_role_type_check" CHECK (("role_type" = ANY (ARRAY['primary'::"text", 'secondary'::"text", 'backup'::"text"])))
);


ALTER TABLE "public"."supervision_building_supervisors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_daily_report_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_date" "date" NOT NULL,
    "status" "text" NOT NULL,
    "claim_token" "uuid" NOT NULL,
    "email_to" "text" NOT NULL,
    "route_count" integer DEFAULT 0 NOT NULL,
    "provider_message_id" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_daily_report_runs_route_count_check" CHECK (("route_count" >= 0)),
    CONSTRAINT "supervision_daily_report_runs_status_check" CHECK (("status" = ANY (ARRAY['sending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."supervision_daily_report_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_daily_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "report_date" "date" NOT NULL,
    "pdf_path" "text",
    "email_to" "text" DEFAULT 'dgomez@limpatex.com'::"text" NOT NULL,
    "email_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_daily_reports_email_status_check" CHECK (("email_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."supervision_daily_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_incident_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_status" "public"."supervision_incident_status",
    "to_status" "public"."supervision_incident_status",
    "note" "text",
    "actor_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_incident_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'status_change'::"text", 'priority_change'::"text", 'responsible_changed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."supervision_incident_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "route_id" "uuid" NOT NULL,
    "route_stop_id" "uuid",
    "review_id" "uuid",
    "task_id" "uuid",
    "property_id" "uuid",
    "property_group_id" "uuid",
    "category" "text" NOT NULL,
    "priority" "public"."supervision_incident_priority" DEFAULT 'medium'::"public"."supervision_incident_priority" NOT NULL,
    "status" "public"."supervision_incident_status" DEFAULT 'open'::"public"."supervision_incident_status" NOT NULL,
    "description" "text" NOT NULL,
    "responsible_user_id" "uuid",
    "target_date" "date",
    "repeat_key" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_sent_at" timestamp with time zone,
    "notification_message_id" "text"
);


ALTER TABLE "public"."supervision_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_reservation_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_stop_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "source" "text" DEFAULT 'task'::"text" NOT NULL,
    "check_in" timestamp with time zone,
    "check_out" timestamp with time zone,
    "guests" integer,
    "raw_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supervision_reservation_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_review_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "from_state" "public"."supervision_review_state",
    "to_state" "public"."supervision_review_state" NOT NULL,
    "reason" "text",
    "actor_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supervision_review_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_review_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'image/jpeg'::"text" NOT NULL,
    "original_bytes" integer,
    "compressed_bytes" integer,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supervision_review_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid" NOT NULL,
    "route_stop_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "property_id" "uuid",
    "property_group_id" "uuid",
    "reviewer_user_id" "uuid",
    "review_type" "public"."supervision_review_type" DEFAULT 'quick'::"public"."supervision_review_type" NOT NULL,
    "state" "public"."supervision_review_state" DEFAULT 'reviewed'::"public"."supervision_review_state" NOT NULL,
    "result" "public"."supervision_review_result" DEFAULT 'correct'::"public"."supervision_review_result" NOT NULL,
    "notes" "text",
    "rework_reason" "text",
    "checklist_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "inventory_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supervision_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_route_stops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "route_id" "uuid" NOT NULL,
    "sequence" integer DEFAULT 1 NOT NULL,
    "stop_type" "public"."supervision_stop_type" NOT NULL,
    "property_id" "uuid",
    "property_group_id" "uuid",
    "task_id" "uuid",
    "label" "text" NOT NULL,
    "access_note" "text",
    "status" "public"."supervision_stop_status" DEFAULT 'pending'::"public"."supervision_stop_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supervision_route_stops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "route_date" "date" NOT NULL,
    "name" "text" NOT NULL,
    "reviewer_user_id" "uuid",
    "status" "public"."supervision_route_status" DEFAULT 'planned'::"public"."supervision_route_status" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_group_id" "uuid"
);


ALTER TABLE "public"."supervision_routes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supervision_stock_check_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "check_id" "uuid" NOT NULL,
    "stock_level_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "expected_quantity" numeric(12,2) DEFAULT 0 NOT NULL,
    "observed_quantity" numeric(12,2),
    "difference" numeric(12,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supervision_stock_check_lines_expected_quantity_check" CHECK (("expected_quantity" >= (0)::numeric)),
    CONSTRAINT "supervision_stock_check_lines_observed_quantity_check" CHECK ((("observed_quantity" IS NULL) OR ("observed_quantity" >= (0)::numeric)))
);


ALTER TABLE "public"."supervision_stock_check_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_approval_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "cleaner_id" "uuid",
    "action" "text" NOT NULL,
    "source" "text" NOT NULL,
    "whatsapp_message_id" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_approval_events_action_check" CHECK (("action" = ANY (ARRAY['requested'::"text", 'approved'::"text", 'rejected'::"text", 'reminded'::"text", 'expired'::"text", 'admin_override'::"text"]))),
    CONSTRAINT "task_approval_events_source_check" CHECK (("source" = ANY (ARRAY['whatsapp'::"text", 'admin'::"text", 'system'::"text", 'worker_app'::"text"])))
);


ALTER TABLE "public"."task_approval_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "cleaner_name" "text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_checklists_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_type" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "checklist_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_kind" "text" DEFAULT 'cleaning'::"text" NOT NULL,
    "property_group_id" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "review_interval_days" integer,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."task_checklists_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_report_id" "uuid" NOT NULL,
    "media_type" "public"."media_type" NOT NULL,
    "file_url" "text" NOT NULL,
    "checklist_item_id" "text",
    "description" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_size" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "cleaner_id" "uuid",
    "checklist_template_id" "uuid",
    "checklist_completed" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "overall_status" "public"."report_status" DEFAULT 'pending'::"public"."report_status" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_reports" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."task_reports_grouped" AS
 SELECT "tr"."task_id",
    "count"("tr"."id") AS "total_reports",
    "count"(
        CASE
            WHEN ("tr"."overall_status" = 'completed'::"public"."report_status") THEN 1
            ELSE NULL::integer
        END) AS "completed_reports",
    "count"(
        CASE
            WHEN ("tr"."overall_status" = 'in_progress'::"public"."report_status") THEN 1
            ELSE NULL::integer
        END) AS "in_progress_reports",
    "count"(
        CASE
            WHEN ("tr"."overall_status" = 'pending'::"public"."report_status") THEN 1
            ELSE NULL::integer
        END) AS "pending_reports",
    "count"(
        CASE
            WHEN ("tr"."overall_status" = 'needs_review'::"public"."report_status") THEN 1
            ELSE NULL::integer
        END) AS "needs_review_reports",
    "min"("tr"."start_time") AS "earliest_start_time",
    "max"("tr"."end_time") AS "latest_end_time",
    "array_agg"("json_build_object"('id', "tr"."id", 'cleaner_id', "tr"."cleaner_id", 'cleaner_name', "c"."name", 'overall_status', "tr"."overall_status", 'start_time', "tr"."start_time", 'end_time', "tr"."end_time", 'created_at', "tr"."created_at", 'updated_at', "tr"."updated_at") ORDER BY "tr"."created_at") AS "individual_reports"
   FROM ("public"."task_reports" "tr"
     LEFT JOIN "public"."cleaners" "c" ON (("tr"."cleaner_id" = "c"."id")))
  GROUP BY "tr"."task_id";


ALTER VIEW "public"."task_reports_grouped" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property" "text" NOT NULL,
    "address" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "check_out" time without time zone NOT NULL,
    "check_in" time without time zone NOT NULL,
    "cleaner" "text",
    "background_color" "text" DEFAULT '#3B82F6'::"text",
    "date" "date" NOT NULL,
    "cliente_id" "uuid",
    "propiedad_id" "uuid",
    "cleaner_id" "uuid",
    "duracion" integer,
    "coste" numeric(10,2),
    "metodo_pago" "text",
    "supervisor" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_assigned" boolean DEFAULT false,
    "assignment_confidence" numeric(5,2),
    "notes" "text",
    "extraordinary_client_name" "text",
    "extraordinary_client_email" "text",
    "extraordinary_client_phone" "text",
    "extraordinary_billing_address" "text",
    "sede_id" "uuid" NOT NULL,
    "additional_tasks" "jsonb" DEFAULT '[]'::"jsonb",
    "approval_status" "text" DEFAULT 'not_required'::"text" NOT NULL,
    "approval_requested_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "approval_response_source" "text",
    "approval_rejection_reason" "text",
    "last_approval_reminder_at" timestamp with time zone,
    "late_start_reminder_sent_at" timestamp with time zone,
    "planning_version" bigint DEFAULT 0 NOT NULL,
    CONSTRAINT "tasks_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['not_required'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text", 'auto_approved_by_admin'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in-progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tasks"."extraordinary_client_name" IS 'Client name for extraordinary services (not linked to clients table)';



COMMENT ON COLUMN "public"."tasks"."extraordinary_client_email" IS 'Client email for extraordinary services';



COMMENT ON COLUMN "public"."tasks"."extraordinary_client_phone" IS 'Client phone for extraordinary services';



COMMENT ON COLUMN "public"."tasks"."extraordinary_billing_address" IS 'Billing address for extraordinary services';



COMMENT ON COLUMN "public"."tasks"."sede_id" IS 'ID de la sede a la que pertenece la tarea';



COMMENT ON COLUMN "public"."tasks"."additional_tasks" IS 'Array of additional subtasks added by admin/manager. Structure: [{id, text, photoRequired, completed, completedAt, completedBy, addedBy, addedAt, notes, mediaUrls}]';



CREATE TABLE IF NOT EXISTS "public"."time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "clock_in" timestamp with time zone,
    "clock_out" timestamp with time zone,
    "break_duration_minutes" integer DEFAULT 0,
    "total_hours" numeric(4,2) GENERATED ALWAYS AS (
CASE
    WHEN (("clock_in" IS NOT NULL) AND ("clock_out" IS NOT NULL)) THEN ((EXTRACT(epoch FROM ("clock_out" - "clock_in")) / 3600.0) - (("break_duration_minutes")::numeric / 60.0))
    ELSE (0)::numeric
END) STORED,
    "overtime_hours" numeric(4,2) DEFAULT 0,
    "notes" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_id" "uuid",
    "base_salary" numeric DEFAULT 0,
    "overtime_multiplier" numeric DEFAULT 1.5,
    "vacation_hours_accrued" numeric DEFAULT 0,
    "vacation_hours_used" numeric DEFAULT 0
);


ALTER TABLE "public"."time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_activation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activation_run_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "action" "text" NOT NULL,
    "before_snapshot" "jsonb",
    "after_snapshot" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tourist_budget_activation_items_action_check" CHECK (("action" = ANY (ARRAY['create'::"text", 'update'::"text"])))
);


ALTER TABLE "public"."tourist_budget_activation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_activation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "status" "public"."tourist_budget_activation_status" DEFAULT 'proposed'::"public"."tourist_budget_activation_status" NOT NULL,
    "error_message" "text",
    "created_by" "uuid" NOT NULL,
    "applied_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone
);


ALTER TABLE "public"."tourist_budget_activation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "document_type" "text" DEFAULT 'commercial_pdf'::"text" NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_path" "text",
    "content_sha256" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tourist_budget_documents_document_type_check" CHECK (("document_type" = 'commercial_pdf'::"text"))
);


ALTER TABLE "public"."tourist_budget_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_version_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "property_id" "uuid",
    "property_code" "text",
    "property_name" "text" NOT NULL,
    "property_address" "text",
    "feature_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "time_input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "logistics_input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "service_lines" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tourist_budget_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tourist_budget_quote_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tourist_budget_quote_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "from_status" "public"."tourist_budget_status",
    "to_status" "public"."tourist_budget_status" NOT NULL,
    "note" "text",
    "changed_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tourist_budget_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budget_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "source_profile_version_id" "uuid",
    "input_snapshot" "jsonb" NOT NULL,
    "totals_snapshot" "jsonb" NOT NULL,
    "change_reason" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tourist_budget_versions_version_number_check" CHECK (("version_number" > 0))
);


ALTER TABLE "public"."tourist_budget_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tourist_budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "quote_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "prospect_name" "text",
    "status" "public"."tourist_budget_status" DEFAULT 'draft'::"public"."tourist_budget_status" NOT NULL,
    "validity_date" "date",
    "currency" "text" DEFAULT 'EUR'::"text" NOT NULL,
    "current_version_number" integer DEFAULT 1 NOT NULL,
    "monthly_rotations" integer DEFAULT 1 NOT NULL,
    "total_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_revenue" numeric(12,2) DEFAULT 0 NOT NULL,
    "contribution" numeric(12,2) DEFAULT 0 NOT NULL,
    "margin_percentage" numeric(7,2) DEFAULT 0 NOT NULL,
    "monthly_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "monthly_revenue" numeric(12,2) DEFAULT 0 NOT NULL,
    "monthly_contribution" numeric(12,2) DEFAULT 0 NOT NULL,
    "commercial_notes" "text",
    "internal_notes" "text",
    "terms" "text",
    "created_by" "uuid" NOT NULL,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tourist_budgets_currency_check" CHECK (("currency" = 'EUR'::"text")),
    CONSTRAINT "tourist_budgets_current_version_number_check" CHECK (("current_version_number" > 0)),
    CONSTRAINT "tourist_budgets_monthly_cost_check" CHECK (("monthly_cost" >= (0)::numeric)),
    CONSTRAINT "tourist_budgets_monthly_revenue_check" CHECK (("monthly_revenue" >= (0)::numeric)),
    CONSTRAINT "tourist_budgets_monthly_rotations_check" CHECK (("monthly_rotations" > 0)),
    CONSTRAINT "tourist_budgets_total_cost_check" CHECK (("total_cost" >= (0)::numeric)),
    CONSTRAINT "tourist_budgets_total_revenue_check" CHECK (("total_revenue" >= (0)::numeric))
);


ALTER TABLE "public"."tourist_budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invitation_token" "uuid" DEFAULT "gen_random_uuid"(),
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "sede_id" "uuid",
    CONSTRAINT "check_email_format" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "valid_expiry" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sede_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sede_id" "uuid" NOT NULL,
    "can_access" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_sede_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_sede_access" IS 'Tabla que controla qué usuarios tienen acceso a qué sedes';



COMMENT ON COLUMN "public"."user_sede_access"."can_access" IS 'Indica si el usuario tiene acceso activo a la sede';



CREATE TABLE IF NOT EXISTS "public"."vacation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "days_requested" integer NOT NULL,
    "request_type" "text" DEFAULT 'vacation'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "reason" "text",
    "notes" "text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vacation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_absence_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_absence_audit_log_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'updated'::"text", 'deleted'::"text"]))),
    CONSTRAINT "worker_absence_audit_log_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['absence'::"text", 'fixed_day_off'::"text", 'maintenance_cleaning'::"text"])))
);


ALTER TABLE "public"."worker_absence_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "absence_type" "text" NOT NULL,
    "location_name" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "valid_time_range" CHECK (((("start_time" IS NULL) AND ("end_time" IS NULL)) OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time")))),
    CONSTRAINT "worker_absences_absence_type_check" CHECK (("absence_type" = ANY (ARRAY['vacation'::"text", 'sick'::"text", 'day_off'::"text", 'holiday'::"text", 'personal'::"text", 'external_work'::"text"])))
);


ALTER TABLE "public"."worker_absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "contract_type" "text" DEFAULT 'full-time'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "base_salary" numeric DEFAULT 0 NOT NULL,
    "hourly_rate" numeric,
    "overtime_rate" numeric DEFAULT 1.5,
    "vacation_days_per_year" integer DEFAULT 22,
    "sick_days_per_year" integer DEFAULT 10,
    "contract_hours_per_week" numeric DEFAULT 40,
    "payment_frequency" "text" DEFAULT 'monthly'::"text",
    "benefits" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "position" "text",
    "department" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "renewal_date" "date"
);


ALTER TABLE "public"."worker_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_fixed_days_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_fixed_days_off_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."worker_fixed_days_off" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_hour_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "hours" numeric(5,2) NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."worker_hour_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_maintenance_cleanings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "days_of_week" integer[] NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "location_name" "text" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_maintenance_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "public"."worker_maintenance_cleanings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_action_audit_logs"
    ADD CONSTRAINT "ai_action_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_action_proposals"
    ADD CONSTRAINT "ai_action_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_learning_suggestions"
    ADD CONSTRAINT "ai_learning_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_observed_events"
    ADD CONSTRAINT "ai_observed_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_patterns"
    ADD CONSTRAINT "assignment_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignment_patterns"
    ADD CONSTRAINT "assignment_patterns_property_group_id_cleaner_id_day_of_wee_key" UNIQUE ("property_group_id", "cleaner_id", "day_of_week", "hour_of_day");



ALTER TABLE ONLY "public"."auto_assignment_logs"
    ADD CONSTRAINT "auto_assignment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auto_assignment_rules"
    ADD CONSTRAINT "auto_assignment_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avantio_alert_log"
    ADD CONSTRAINT "avantio_alert_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avantio_reservations"
    ADD CONSTRAINT "avantio_reservations_avantio_reservation_id_key" UNIQUE ("avantio_reservation_id");



ALTER TABLE ONLY "public"."avantio_reservations"
    ADD CONSTRAINT "avantio_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avantio_sync_errors"
    ADD CONSTRAINT "avantio_sync_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avantio_sync_logs"
    ADD CONSTRAINT "avantio_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avantio_sync_schedules"
    ADD CONSTRAINT "avantio_sync_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_reservation_tasks"
    ADD CONSTRAINT "avirato_reservation_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_reservation_tasks"
    ADD CONSTRAINT "avirato_reservation_tasks_reservation_id_space_subtype_id_s_key" UNIQUE ("reservation_id", "space_subtype_id", "service_kind", "task_date");



ALTER TABLE ONLY "public"."avirato_reservations"
    ADD CONSTRAINT "avirato_reservations_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."avirato_reservations"
    ADD CONSTRAINT "avirato_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_room_mapping"
    ADD CONSTRAINT "avirato_room_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_room_mapping"
    ADD CONSTRAINT "avirato_room_mapping_space_subtype_id_service_kind_key" UNIQUE ("space_subtype_id", "service_kind");



ALTER TABLE ONLY "public"."avirato_sync_errors"
    ADD CONSTRAINT "avirato_sync_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_sync_logs"
    ADD CONSTRAINT "avirato_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avirato_sync_schedules"
    ADD CONSTRAINT "avirato_sync_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_task_creation_requests"
    ADD CONSTRAINT "batch_task_creation_requests_actor_id_idempotency_key_key" UNIQUE ("actor_id", "idempotency_key");



ALTER TABLE ONLY "public"."batch_task_creation_requests"
    ADD CONSTRAINT "batch_task_creation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_task_email_deliveries"
    ADD CONSTRAINT "batch_task_email_deliveries_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."batch_task_email_deliveries"
    ADD CONSTRAINT "batch_task_email_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_task_email_deliveries"
    ADD CONSTRAINT "batch_task_email_deliveries_request_id_cleaner_id_key" UNIQUE ("request_id", "cleaner_id");



ALTER TABLE ONLY "public"."budget_rate_profile_versions"
    ADD CONSTRAINT "budget_rate_profile_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_rate_profile_versions"
    ADD CONSTRAINT "budget_rate_profile_versions_profile_id_version_number_key" UNIQUE ("profile_id", "version_number");



ALTER TABLE ONLY "public"."budget_rate_profiles"
    ADD CONSTRAINT "budget_rate_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_availability"
    ADD CONSTRAINT "cleaner_availability_cleaner_id_day_of_week_key" UNIQUE ("cleaner_id", "day_of_week");



ALTER TABLE ONLY "public"."cleaner_availability"
    ADD CONSTRAINT "cleaner_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_group_assignments"
    ADD CONSTRAINT "cleaner_group_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaner_group_assignments"
    ADD CONSTRAINT "cleaner_group_assignments_property_group_id_cleaner_id_key" UNIQUE ("property_group_id", "cleaner_id");



ALTER TABLE ONLY "public"."cleaner_work_schedule"
    ADD CONSTRAINT "cleaner_work_schedule_cleaner_id_date_key" UNIQUE ("cleaner_id", "date");



ALTER TABLE ONLY "public"."cleaner_work_schedule"
    ADD CONSTRAINT "cleaner_work_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."cleaning_incident_comments"
    ADD CONSTRAINT "cleaning_incident_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_incident_events"
    ADD CONSTRAINT "cleaning_incident_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_incident_media"
    ADD CONSTRAINT "cleaning_incident_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_access_logs"
    ADD CONSTRAINT "client_portal_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_access"
    ADD CONSTRAINT "client_portal_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_portal_access"
    ADD CONSTRAINT "client_portal_access_portal_token_key" UNIQUE ("portal_token");



ALTER TABLE ONLY "public"."client_portal_access"
    ADD CONSTRAINT "client_portal_access_short_code_key" UNIQUE ("short_code");



ALTER TABLE ONLY "public"."client_reservation_logs"
    ADD CONSTRAINT "client_reservation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_reservations"
    ADD CONSTRAINT "client_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_report_export_logs"
    ADD CONSTRAINT "daily_report_export_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_sync_log"
    ADD CONSTRAINT "employee_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extraordinary_request_types"
    ADD CONSTRAINT "extraordinary_request_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."extraordinary_request_types"
    ADD CONSTRAINT "extraordinary_request_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_alerts_log"
    ADD CONSTRAINT "forecast_alerts_log_alert_date_alert_type_recipient_email_s_key" UNIQUE ("alert_date", "alert_type", "recipient_email", "sede_id");



ALTER TABLE ONLY "public"."forecast_alerts_log"
    ADD CONSTRAINT "forecast_alerts_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_subscribers"
    ADD CONSTRAINT "forecast_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_subscribers"
    ADD CONSTRAINT "forecast_subscribers_user_id_sede_id_key" UNIQUE ("user_id", "sede_id");



ALTER TABLE ONLY "public"."hostaway_reservations"
    ADD CONSTRAINT "hostaway_reservations_hostaway_reservation_id_key" UNIQUE ("hostaway_reservation_id");



ALTER TABLE ONLY "public"."hostaway_reservations"
    ADD CONSTRAINT "hostaway_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hostaway_sync_errors"
    ADD CONSTRAINT "hostaway_sync_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hostaway_sync_logs"
    ADD CONSTRAINT "hostaway_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hostaway_sync_schedules"
    ADD CONSTRAINT "hostaway_sync_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_categories"
    ADD CONSTRAINT "incident_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incident_categories"
    ADD CONSTRAINT "incident_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_product_id_key" UNIQUE ("product_id");



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_task_unique" UNIQUE ("task_id");



ALTER TABLE ONLY "public"."laundry_classic_route_order"
    ADD CONSTRAINT "laundry_classic_route_order_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_classic_route_order"
    ADD CONSTRAINT "laundry_classic_route_order_sede_id_delivery_day_property_i_key" UNIQUE ("sede_id", "delivery_day", "property_id");



ALTER TABLE ONLY "public"."laundry_delivery_schedule"
    ADD CONSTRAINT "laundry_delivery_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_delivery_schedule"
    ADD CONSTRAINT "laundry_delivery_schedule_sede_id_day_of_week_key" UNIQUE ("sede_id", "day_of_week");



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_share_link_id_task_id_key" UNIQUE ("share_link_id", "task_id");



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_dirty_stock"
    ADD CONSTRAINT "laundry_dirty_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_dirty_stock"
    ADD CONSTRAINT "laundry_dirty_stock_unique" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."laundry_link_sync_runs"
    ADD CONSTRAINT "laundry_link_sync_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_access_attempts"
    ADD CONSTRAINT "laundry_route_access_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_sessions"
    ADD CONSTRAINT "laundry_route_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_sessions"
    ADD CONSTRAINT "laundry_route_sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."laundry_route_v2_authorizations"
    ADD CONSTRAINT "laundry_route_v2_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_v2_bag_snapshots"
    ADD CONSTRAINT "laundry_route_v2_bag_snapshots_link_task_unique" UNIQUE ("share_link_id", "task_id");



ALTER TABLE ONLY "public"."laundry_route_v2_bag_snapshots"
    ADD CONSTRAINT "laundry_route_v2_bag_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_event_key_unique" UNIQUE ("event_key");



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_worker_events"
    ADD CONSTRAINT "laundry_route_worker_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_route_workers"
    ADD CONSTRAINT "laundry_route_workers_cleaner_id_key" UNIQUE ("cleaner_id");



ALTER TABLE ONLY "public"."laundry_route_workers"
    ADD CONSTRAINT "laundry_route_workers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_share_links"
    ADD CONSTRAINT "laundry_share_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."laundry_share_links"
    ADD CONSTRAINT "laundry_share_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."lh_reservation_tasks"
    ADD CONSTRAINT "lh_reservation_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lh_reservation_tasks"
    ADD CONSTRAINT "lh_reservation_tasks_unique_per_room" UNIQUE ("reservation_id", "lh_room", "service_kind", "task_date");



ALTER TABLE ONLY "public"."lh_reservations"
    ADD CONSTRAINT "lh_reservations_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."lh_reservations"
    ADD CONSTRAINT "lh_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lh_room_mapping"
    ADD CONSTRAINT "lh_room_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lh_room_mapping"
    ADD CONSTRAINT "lh_room_mapping_sede_id_lh_room_service_kind_key" UNIQUE ("sede_id", "lh_room", "service_kind");



ALTER TABLE ONLY "public"."lh_sync_logs"
    ADD CONSTRAINT "lh_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_deliveries"
    ADD CONSTRAINT "logistics_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_delivery_items"
    ADD CONSTRAINT "logistics_delivery_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_delivery_stops"
    ADD CONSTRAINT "logistics_delivery_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_picklist_items"
    ADD CONSTRAINT "logistics_picklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logistics_picklists"
    ADD CONSTRAINT "logistics_picklists_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."logistics_picklists"
    ADD CONSTRAINT "logistics_picklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_claim_token_key" UNIQUE ("claim_token");



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_delivery_id_attempt_no_key" UNIQUE ("delivery_id", "attempt_no");



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_send_reconciliation_actions"
    ADD CONSTRAINT "notification_send_reconciliation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_batch_id_item_key_key" UNIQUE ("batch_id", "item_key");



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_batch_id_item_ordinal_key" UNIQUE ("batch_id", "item_ordinal");



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_apply_batches"
    ADD CONSTRAINT "planning_apply_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_apply_batches"
    ADD CONSTRAINT "planning_apply_batches_sede_id_idempotency_key_key" UNIQUE ("sede_id", "idempotency_key");



ALTER TABLE ONLY "public"."planning_assignment_audit"
    ADD CONSTRAINT "planning_assignment_audit_batch_item_id_key" UNIQUE ("batch_item_id");



ALTER TABLE ONLY "public"."planning_assignment_audit"
    ADD CONSTRAINT "planning_assignment_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_notification_batches"
    ADD CONSTRAINT "planning_notification_batches_notification_key_key" UNIQUE ("notification_key");



ALTER TABLE ONLY "public"."planning_notification_batches"
    ADD CONSTRAINT "planning_notification_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_run_id_task_id_key" UNIQUE ("run_id", "task_id");



ALTER TABLE ONLY "public"."planning_runs"
    ADD CONSTRAINT "planning_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_settings"
    ADD CONSTRAINT "planning_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planning_settings"
    ADD CONSTRAINT "planning_settings_sede_id_key" UNIQUE ("sede_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_amenity_inventory_mapping"
    ADD CONSTRAINT "property_amenity_inventory_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_checklist_assignments"
    ADD CONSTRAINT "property_checklist_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_consumption_config"
    ADD CONSTRAINT "property_consumption_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_consumption_config"
    ADD CONSTRAINT "property_consumption_config_property_id_product_id_key" UNIQUE ("property_id", "product_id");



ALTER TABLE ONLY "public"."property_group_assignments"
    ADD CONSTRAINT "property_group_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_group_assignments"
    ADD CONSTRAINT "property_group_assignments_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_preferred_cleaners"
    ADD CONSTRAINT "property_preferred_cleaners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_preferred_cleaners"
    ADD CONSTRAINT "property_preferred_cleaners_property_id_cleaner_id_key" UNIQUE ("property_id", "cleaner_id");



ALTER TABLE ONLY "public"."property_storage_access"
    ADD CONSTRAINT "property_storage_access_one_per_property" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."property_storage_access"
    ADD CONSTRAINT "property_storage_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_task_executions"
    ADD CONSTRAINT "recurring_task_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_tasks"
    ADD CONSTRAINT "recurring_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_export_tokens"
    ADD CONSTRAINT "report_export_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_export_tokens"
    ADD CONSTRAINT "report_export_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limits"
    ADD CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sede_audit_log"
    ADD CONSTRAINT "sede_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sedes"
    ADD CONSTRAINT "sedes_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."sedes"
    ADD CONSTRAINT "sedes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smoobu_property_mappings"
    ADD CONSTRAINT "smoobu_property_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smoobu_reservation_tasks"
    ADD CONSTRAINT "smoobu_reservation_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."smoobu_reservation_tasks"
    ADD CONSTRAINT "smoobu_reservation_tasks_unique_kind" UNIQUE ("reservation_id", "service_kind");



ALTER TABLE ONLY "public"."smoobu_reservations"
    ADD CONSTRAINT "smoobu_reservations_external_id_key" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."smoobu_reservations"
    ADD CONSTRAINT "smoobu_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staffing_targets"
    ADD CONSTRAINT "staffing_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staffing_targets"
    ADD CONSTRAINT "staffing_targets_sede_id_day_of_week_key" UNIQUE ("sede_id", "day_of_week");



ALTER TABLE ONLY "public"."stock_alerts"
    ADD CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_categories"
    ADD CONSTRAINT "stock_categories_kind_name_unique" UNIQUE ("kind", "name");



ALTER TABLE ONLY "public"."stock_categories"
    ADD CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_property_consumption_rules"
    ADD CONSTRAINT "stock_consumption_rules_unique" UNIQUE ("property_id", "product_id");



ALTER TABLE ONLY "public"."stock_property_field_mappings"
    ADD CONSTRAINT "stock_field_mappings_unique" UNIQUE ("sede_id", "property_field", "product_id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_warehouse_unique" UNIQUE ("product_id", "warehouse_id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_products"
    ADD CONSTRAINT "stock_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_products"
    ADD CONSTRAINT "stock_products_sede_name_unique" UNIQUE ("sede_id", "name");



ALTER TABLE ONLY "public"."stock_products"
    ADD CONSTRAINT "stock_products_sede_sku_unique" UNIQUE ("sede_id", "sku");



ALTER TABLE ONLY "public"."stock_property_consumption_rules"
    ADD CONSTRAINT "stock_property_consumption_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_property_field_mappings"
    ADD CONSTRAINT "stock_property_field_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_sede_settings"
    ADD CONSTRAINT "stock_sede_settings_pkey" PRIMARY KEY ("sede_id");



ALTER TABLE ONLY "public"."stock_warehouses"
    ADD CONSTRAINT "stock_warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_warehouses"
    ADD CONSTRAINT "stock_warehouses_sede_name_unique" UNIQUE ("sede_id", "name");



ALTER TABLE ONLY "public"."supervision_building_policies"
    ADD CONSTRAINT "supervision_building_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_building_policies"
    ADD CONSTRAINT "supervision_building_policies_property_group_id_key" UNIQUE ("property_group_id");



ALTER TABLE ONLY "public"."supervision_building_supervisors"
    ADD CONSTRAINT "supervision_building_supervis_property_group_id_supervisor__key" UNIQUE ("property_group_id", "supervisor_user_id");



ALTER TABLE ONLY "public"."supervision_building_supervisors"
    ADD CONSTRAINT "supervision_building_supervisors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_daily_report_runs"
    ADD CONSTRAINT "supervision_daily_report_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_daily_report_runs"
    ADD CONSTRAINT "supervision_daily_report_runs_report_date_key" UNIQUE ("report_date");



ALTER TABLE ONLY "public"."supervision_daily_reports"
    ADD CONSTRAINT "supervision_daily_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_daily_reports"
    ADD CONSTRAINT "supervision_daily_reports_route_date_key" UNIQUE ("route_id", "report_date");



ALTER TABLE ONLY "public"."supervision_incident_events"
    ADD CONSTRAINT "supervision_incident_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_reservation_snapshots"
    ADD CONSTRAINT "supervision_reservation_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_review_events"
    ADD CONSTRAINT "supervision_review_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_review_media"
    ADD CONSTRAINT "supervision_review_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_review_media"
    ADD CONSTRAINT "supervision_review_media_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_route_id_sequence_key" UNIQUE ("route_id", "sequence");



ALTER TABLE ONLY "public"."supervision_routes"
    ADD CONSTRAINT "supervision_routes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_stock_check_lines"
    ADD CONSTRAINT "supervision_stock_check_lines_check_id_stock_level_id_key" UNIQUE ("check_id", "stock_level_id");



ALTER TABLE ONLY "public"."supervision_stock_check_lines"
    ADD CONSTRAINT "supervision_stock_check_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_stock_checks"
    ADD CONSTRAINT "supervision_stock_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supervision_stock_checks"
    ADD CONSTRAINT "supervision_stock_checks_warehouse_id_scheduled_date_check__key" UNIQUE ("warehouse_id", "scheduled_date", "check_type");



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_generation_key_key" UNIQUE ("generation_key");



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_approval_events"
    ADD CONSTRAINT "task_approval_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_task_id_cleaner_id_key" UNIQUE ("task_id", "cleaner_id");



ALTER TABLE ONLY "public"."task_checklists_templates"
    ADD CONSTRAINT "task_checklists_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_media"
    ADD CONSTRAINT "task_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_reports"
    ADD CONSTRAINT "task_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_reports"
    ADD CONSTRAINT "task_reports_task_cleaner_unique" UNIQUE ("task_id", "cleaner_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_cleaner_id_date_key" UNIQUE ("cleaner_id", "date");



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_activation_items"
    ADD CONSTRAINT "tourist_budget_activation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_activation_runs"
    ADD CONSTRAINT "tourist_budget_activation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_documents"
    ADD CONSTRAINT "tourist_budget_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_items"
    ADD CONSTRAINT "tourist_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_status_history"
    ADD CONSTRAINT "tourist_budget_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budget_versions"
    ADD CONSTRAINT "tourist_budget_versions_budget_id_version_number_key" UNIQUE ("budget_id", "version_number");



ALTER TABLE ONLY "public"."tourist_budget_versions"
    ADD CONSTRAINT "tourist_budget_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_quote_number_key" UNIQUE ("quote_number");



ALTER TABLE ONLY "public"."client_portal_access"
    ADD CONSTRAINT "unique_client_portal" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."hostaway_sync_schedules"
    ADD CONSTRAINT "unique_schedule_time" UNIQUE ("hour", "minute", "timezone");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."user_sede_access"
    ADD CONSTRAINT "user_sede_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sede_access"
    ADD CONSTRAINT "user_sede_access_user_id_sede_id_key" UNIQUE ("user_id", "sede_id");



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_webhook_inbox"
    ADD CONSTRAINT "whatsapp_webhook_inbox_callback_key_key" UNIQUE ("callback_key");



ALTER TABLE ONLY "public"."whatsapp_webhook_inbox"
    ADD CONSTRAINT "whatsapp_webhook_inbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_absence_audit_log"
    ADD CONSTRAINT "worker_absence_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_absences"
    ADD CONSTRAINT "worker_absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_contracts"
    ADD CONSTRAINT "worker_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_fixed_days_off"
    ADD CONSTRAINT "worker_fixed_days_off_cleaner_id_day_of_week_key" UNIQUE ("cleaner_id", "day_of_week");



ALTER TABLE ONLY "public"."worker_fixed_days_off"
    ADD CONSTRAINT "worker_fixed_days_off_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_hour_adjustments"
    ADD CONSTRAINT "worker_hour_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_maintenance_cleanings"
    ADD CONSTRAINT "worker_maintenance_cleanings_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "avantio_alert_log_dedup_idx" ON "public"."avantio_alert_log" USING "btree" ("alert_type", "property_id", "reference_date");



CREATE INDEX "avantio_alert_log_sent_at_idx" ON "public"."avantio_alert_log" USING "btree" ("sent_at" DESC);



CREATE INDEX "budget_rate_profiles_client_idx" ON "public"."budget_rate_profiles" USING "btree" ("client_id");



CREATE UNIQUE INDEX "budget_rate_profiles_default_name_idx" ON "public"."budget_rate_profiles" USING "btree" ("sede_id", COALESCE("client_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("name"));



CREATE INDEX "budget_rate_profiles_sede_idx" ON "public"."budget_rate_profiles" USING "btree" ("sede_id");



CREATE UNIQUE INDEX "cleaners_external_id_unique" ON "public"."cleaners" USING "btree" ("external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "employee_sync_log_run_at_idx" ON "public"."employee_sync_log" USING "btree" ("run_at" DESC);



CREATE INDEX "idx_ai_action_proposals_owner_status" ON "public"."ai_action_proposals" USING "btree" ("owner_user_id", "status", "created_at" DESC);



CREATE INDEX "idx_ai_conversations_owner_created" ON "public"."ai_conversations" USING "btree" ("owner_user_id", "created_at" DESC);



CREATE INDEX "idx_ai_learning_suggestions_owner_status" ON "public"."ai_learning_suggestions" USING "btree" ("owner_user_id", "status", "created_at" DESC);



CREATE INDEX "idx_ai_memories_owner_active" ON "public"."ai_memories" USING "btree" ("owner_user_id", "is_active", "updated_at" DESC);



CREATE INDEX "idx_ai_messages_conversation_created" ON "public"."ai_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_ai_observed_events_owner_created" ON "public"."ai_observed_events" USING "btree" ("owner_user_id", "created_at" DESC);



CREATE INDEX "idx_ai_observed_events_processed" ON "public"."ai_observed_events" USING "btree" ("owner_user_id", "processed_at", "occurred_at" DESC);



CREATE INDEX "idx_assignment_patterns_day_hour" ON "public"."assignment_patterns" USING "btree" ("day_of_week", "hour_of_day");



CREATE INDEX "idx_assignment_patterns_group_cleaner" ON "public"."assignment_patterns" USING "btree" ("property_group_id", "cleaner_id");



CREATE INDEX "idx_auto_assignment_logs_created" ON "public"."auto_assignment_logs" USING "btree" ("created_at");



CREATE INDEX "idx_auto_assignment_logs_task" ON "public"."auto_assignment_logs" USING "btree" ("task_id");



CREATE INDEX "idx_avantio_reservations_accommodation" ON "public"."avantio_reservations" USING "btree" ("accommodation_id");



CREATE INDEX "idx_avantio_reservations_departure" ON "public"."avantio_reservations" USING "btree" ("departure_date");



CREATE INDEX "idx_avantio_reservations_guest" ON "public"."avantio_reservations" USING "btree" ("guest_name");



CREATE INDEX "idx_avantio_reservations_property" ON "public"."avantio_reservations" USING "btree" ("property_id");



CREATE INDEX "idx_avantio_reservations_status" ON "public"."avantio_reservations" USING "btree" ("status");



CREATE INDEX "idx_avirato_reservations_check_in" ON "public"."avirato_reservations" USING "btree" ("check_in");



CREATE INDEX "idx_avirato_reservations_check_out" ON "public"."avirato_reservations" USING "btree" ("check_out");



CREATE INDEX "idx_avirato_reservations_sede" ON "public"."avirato_reservations" USING "btree" ("sede_id");



CREATE INDEX "idx_avirato_reservations_space" ON "public"."avirato_reservations" USING "btree" ("space_subtype_id");



CREATE INDEX "idx_avirato_reservations_status" ON "public"."avirato_reservations" USING "btree" ("normalized_status");



CREATE INDEX "idx_avirato_resv_tasks_date" ON "public"."avirato_reservation_tasks" USING "btree" ("task_date");



CREATE INDEX "idx_avirato_resv_tasks_reservation" ON "public"."avirato_reservation_tasks" USING "btree" ("reservation_id");



CREATE INDEX "idx_avirato_resv_tasks_task" ON "public"."avirato_reservation_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_avirato_room_mapping_sede" ON "public"."avirato_room_mapping" USING "btree" ("sede_id");



CREATE INDEX "idx_avirato_room_mapping_space" ON "public"."avirato_room_mapping" USING "btree" ("space_subtype_id");



CREATE INDEX "idx_avirato_sync_errors_space" ON "public"."avirato_sync_errors" USING "btree" ("space_subtype_id");



CREATE INDEX "idx_avirato_sync_errors_unresolved" ON "public"."avirato_sync_errors" USING "btree" ("created_at" DESC) WHERE ("resolved" = false);



CREATE INDEX "idx_avirato_sync_logs_created" ON "public"."avirato_sync_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_avirato_sync_logs_status" ON "public"."avirato_sync_logs" USING "btree" ("status");



CREATE INDEX "idx_cer_client" ON "public"."client_extraordinary_requests" USING "btree" ("client_id", "service_date" DESC);



CREATE INDEX "idx_cer_property" ON "public"."client_extraordinary_requests" USING "btree" ("property_id", "service_date");



CREATE INDEX "idx_cer_sede" ON "public"."client_extraordinary_requests" USING "btree" ("sede_id", "service_date");



CREATE INDEX "idx_cer_task" ON "public"."client_extraordinary_requests" USING "btree" ("task_id");



CREATE INDEX "idx_cleaner_availability_cleaner_id" ON "public"."cleaner_availability" USING "btree" ("cleaner_id");



CREATE INDEX "idx_cleaner_availability_day" ON "public"."cleaner_availability" USING "btree" ("day_of_week");



CREATE INDEX "idx_cleaner_group_assignments_cleaner" ON "public"."cleaner_group_assignments" USING "btree" ("cleaner_id");



CREATE INDEX "idx_cleaner_group_assignments_group" ON "public"."cleaner_group_assignments" USING "btree" ("property_group_id");



CREATE INDEX "idx_cleaners_is_active" ON "public"."cleaners" USING "btree" ("is_active");



CREATE INDEX "idx_cleaners_name" ON "public"."cleaners" USING "btree" ("name");



CREATE INDEX "idx_cleaners_sede_active" ON "public"."cleaners" USING "btree" ("sede_id", "is_active");



CREATE INDEX "idx_cleaners_sede_id" ON "public"."cleaners" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_cleaners_sede_id" IS 'Optimiza consultas de limpiadores filtradas por sede';



CREATE INDEX "idx_cleaners_user_id" ON "public"."cleaners" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_cleaners_whatsapp_phone_e164_unique" ON "public"."cleaners" USING "btree" ("whatsapp_phone_e164") WHERE ("whatsapp_phone_e164" IS NOT NULL);



CREATE INDEX "idx_cleaning_incident_comments_incident" ON "public"."cleaning_incident_comments" USING "btree" ("incident_id", "created_at");



CREATE INDEX "idx_cleaning_incident_events_incident" ON "public"."cleaning_incident_events" USING "btree" ("incident_id", "created_at" DESC);



CREATE INDEX "idx_cleaning_incident_media_incident" ON "public"."cleaning_incident_media" USING "btree" ("incident_id");



CREATE INDEX "idx_cleaning_incidents_client" ON "public"."cleaning_incidents" USING "btree" ("client_id");



CREATE INDEX "idx_cleaning_incidents_created" ON "public"."cleaning_incidents" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cleaning_incidents_property" ON "public"."cleaning_incidents" USING "btree" ("property_id");



CREATE INDEX "idx_cleaning_incidents_sede" ON "public"."cleaning_incidents" USING "btree" ("sede_id");



CREATE INDEX "idx_cleaning_incidents_status" ON "public"."cleaning_incidents" USING "btree" ("status");



CREATE INDEX "idx_cleaning_incidents_task" ON "public"."cleaning_incidents" USING "btree" ("task_id");



CREATE INDEX "idx_client_portal_access_client" ON "public"."client_portal_access" USING "btree" ("client_id");



CREATE INDEX "idx_client_portal_access_logs_client_id_created_at" ON "public"."client_portal_access_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_client_portal_access_short_code" ON "public"."client_portal_access" USING "btree" ("short_code");



CREATE INDEX "idx_client_portal_access_token" ON "public"."client_portal_access" USING "btree" ("portal_token");



CREATE INDEX "idx_client_reservation_logs_client" ON "public"."client_reservation_logs" USING "btree" ("client_id");



CREATE INDEX "idx_client_reservation_logs_client_created" ON "public"."client_reservation_logs" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_client_reservation_logs_created" ON "public"."client_reservation_logs" USING "btree" ("created_at");



CREATE INDEX "idx_client_reservation_logs_reservation" ON "public"."client_reservation_logs" USING "btree" ("reservation_id");



CREATE INDEX "idx_client_reservations_client" ON "public"."client_reservations" USING "btree" ("client_id");



CREATE INDEX "idx_client_reservations_dates" ON "public"."client_reservations" USING "btree" ("check_in_date", "check_out_date");



CREATE INDEX "idx_client_reservations_property" ON "public"."client_reservations" USING "btree" ("property_id");



CREATE INDEX "idx_client_reservations_status" ON "public"."client_reservations" USING "btree" ("status");



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_clients_is_active" ON "public"."clients" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_clients_nombre" ON "public"."clients" USING "btree" ("nombre");



CREATE INDEX "idx_clients_sede_active" ON "public"."clients" USING "btree" ("sede_id", "fecha_actualizacion") WHERE ("sede_id" IS NOT NULL);



CREATE INDEX "idx_clients_sede_id" ON "public"."clients" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_clients_sede_id" IS 'Optimiza consultas de clientes filtradas por sede';



CREATE INDEX "idx_clients_tipo_servicio" ON "public"."clients" USING "btree" ("tipo_servicio");



CREATE INDEX "idx_deliveries_picklist" ON "public"."logistics_deliveries" USING "btree" ("picklist_id");



CREATE INDEX "idx_delivery_items_product" ON "public"."logistics_delivery_items" USING "btree" ("product_id");



CREATE INDEX "idx_delivery_items_stop" ON "public"."logistics_delivery_items" USING "btree" ("stop_id");



CREATE INDEX "idx_ert_active_sort" ON "public"."extraordinary_request_types" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_forecast_alerts_date" ON "public"."forecast_alerts_log" USING "btree" ("alert_date");



CREATE INDEX "idx_forecast_alerts_sede" ON "public"."forecast_alerts_log" USING "btree" ("sede_id");



CREATE INDEX "idx_forecast_subscribers_sede" ON "public"."forecast_subscribers" USING "btree" ("sede_id");



CREATE INDEX "idx_forecast_subscribers_user" ON "public"."forecast_subscribers" USING "btree" ("user_id");



CREATE INDEX "idx_hostaway_reservations_departure" ON "public"."hostaway_reservations" USING "btree" ("departure_date");



CREATE INDEX "idx_hostaway_reservations_property" ON "public"."hostaway_reservations" USING "btree" ("property_id");



CREATE INDEX "idx_hostaway_reservations_status" ON "public"."hostaway_reservations" USING "btree" ("status");



CREATE INDEX "idx_hostaway_sync_errors_unresolved" ON "public"."hostaway_sync_errors" USING "btree" ("resolved", "created_at");



CREATE INDEX "idx_hostaway_sync_logs_triggered_by" ON "public"."hostaway_sync_logs" USING "btree" ("triggered_by", "created_at");



CREATE INDEX "idx_hostaway_sync_schedules_active" ON "public"."hostaway_sync_schedules" USING "btree" ("is_active", "hour", "minute");



CREATE INDEX "idx_inventory_alerts_active" ON "public"."inventory_alerts" USING "btree" ("is_active");



CREATE UNIQUE INDEX "idx_inventory_alerts_active_unique" ON "public"."inventory_alerts" USING "btree" ("product_id", "alert_type") WHERE ("is_active" = true);



CREATE INDEX "idx_inventory_alerts_product" ON "public"."inventory_alerts" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_movements_date" ON "public"."inventory_movements" USING "btree" ("created_at");



CREATE INDEX "idx_inventory_movements_product" ON "public"."inventory_movements" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_movements_task" ON "public"."inventory_movements" USING "btree" ("task_id");



CREATE INDEX "idx_inventory_products_active" ON "public"."inventory_products" USING "btree" ("is_active");



CREATE INDEX "idx_inventory_products_category" ON "public"."inventory_products" USING "btree" ("category_id");



CREATE INDEX "idx_inventory_products_sede_id" ON "public"."inventory_products" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_inventory_products_sede_id" IS 'Optimiza consultas de productos filtradas por sede';



CREATE INDEX "idx_inventory_stock_product" ON "public"."inventory_stock" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_stock_sede_id" ON "public"."inventory_stock" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_inventory_stock_sede_id" IS 'Optimiza consultas de stock filtradas por sede';



CREATE INDEX "idx_inventory_stock_sede_product" ON "public"."inventory_stock" USING "btree" ("sede_id", "product_id");



CREATE INDEX "idx_laundry_bag_preparations_last_link" ON "public"."laundry_bag_preparations" USING "btree" ("last_share_link_id");



CREATE INDEX "idx_laundry_bag_preparations_route_delivery" ON "public"."laundry_bag_preparations" USING "btree" ("route_delivery_status", "route_collection_status");



CREATE INDEX "idx_laundry_bag_preparations_route_novelty" ON "public"."laundry_bag_preparations" USING "btree" ("route_novelty_resolved", "route_novelty_type");



CREATE INDEX "idx_laundry_bag_preparations_status" ON "public"."laundry_bag_preparations" USING "btree" ("status");



CREATE INDEX "idx_laundry_bag_preparations_task" ON "public"."laundry_bag_preparations" USING "btree" ("task_id");



CREATE INDEX "idx_laundry_classic_route_order_lookup" ON "public"."laundry_classic_route_order" USING "btree" ("sede_id", "delivery_day", "position");



CREATE INDEX "idx_laundry_delivery_schedule_sede_id" ON "public"."laundry_delivery_schedule" USING "btree" ("sede_id");



CREATE INDEX "idx_laundry_delivery_tracking_link" ON "public"."laundry_delivery_tracking" USING "btree" ("share_link_id");



CREATE INDEX "idx_laundry_delivery_tracking_status" ON "public"."laundry_delivery_tracking" USING "btree" ("status");



CREATE INDEX "idx_laundry_delivery_tracking_task" ON "public"."laundry_delivery_tracking" USING "btree" ("task_id");



CREATE INDEX "idx_laundry_link_sync_runs_lookup" ON "public"."laundry_link_sync_runs" USING "btree" ("sede_id", "delivery_date", "completed_at" DESC);



CREATE INDEX "idx_laundry_route_access_attempts_rate_limit" ON "public"."laundry_route_access_attempts" USING "btree" ("share_link_id", "ip_fingerprint", "attempted_at" DESC);



CREATE INDEX "idx_laundry_route_sessions_lookup" ON "public"."laundry_route_sessions" USING "btree" ("token_hash", "share_link_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_laundry_route_sessions_worker" ON "public"."laundry_route_sessions" USING "btree" ("route_worker_id", "expires_at");



CREATE INDEX "idx_laundry_route_v2_authorizations_route" ON "public"."laundry_route_v2_authorizations" USING "btree" ("share_link_id", "delivery_date", "created_at" DESC);



CREATE INDEX "idx_laundry_route_v2_bag_snapshots_link" ON "public"."laundry_route_v2_bag_snapshots" USING "btree" ("share_link_id", "delivery_date");



CREATE INDEX "idx_laundry_route_v2_events_route" ON "public"."laundry_route_v2_events" USING "btree" ("share_link_id", "delivery_date", "created_at" DESC);



CREATE INDEX "idx_laundry_route_v2_events_unresolved" ON "public"."laundry_route_v2_events" USING "btree" ("sede_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_laundry_route_worker_events_link_created" ON "public"."laundry_route_worker_events" USING "btree" ("share_link_id", "created_at" DESC);



CREATE INDEX "idx_laundry_route_workers_sede_active" ON "public"."laundry_route_workers" USING "btree" ("sede_id", "is_active");



CREATE INDEX "idx_laundry_share_links_active" ON "public"."laundry_share_links" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_laundry_share_links_dates" ON "public"."laundry_share_links" USING "btree" ("date_start", "date_end");



CREATE INDEX "idx_laundry_share_links_delivery_day" ON "public"."laundry_share_links" USING "btree" ("delivery_day");



CREATE INDEX "idx_laundry_share_links_link_type" ON "public"."laundry_share_links" USING "btree" ("link_type");



CREATE INDEX "idx_laundry_share_links_managed_delivery" ON "public"."laundry_share_links" USING "btree" ("sede_id", "delivery_date") WHERE (("auto_managed" = true) AND ("is_active" = true) AND (COALESCE("workflow_version", 'legacy'::"text") <> 'route_v2'::"text"));



CREATE INDEX "idx_laundry_share_links_sede_id" ON "public"."laundry_share_links" USING "btree" ("sede_id");



CREATE INDEX "idx_laundry_share_links_token" ON "public"."laundry_share_links" USING "btree" ("token");



CREATE INDEX "idx_laundry_share_links_workflow_version" ON "public"."laundry_share_links" USING "btree" ("workflow_version");



CREATE INDEX "idx_lh_reservations_check_in" ON "public"."lh_reservations" USING "btree" ("check_in");



CREATE INDEX "idx_lh_reservations_check_out" ON "public"."lh_reservations" USING "btree" ("check_out");



CREATE INDEX "idx_lh_reservations_needs_assignment" ON "public"."lh_reservations" USING "btree" ("needs_room_assignment") WHERE ("needs_room_assignment" = true);



CREATE INDEX "idx_lh_reservations_room" ON "public"."lh_reservations" USING "btree" ("room");



CREATE INDEX "idx_lh_reservations_rooms" ON "public"."lh_reservations" USING "gin" ("rooms");



CREATE INDEX "idx_lh_reservations_sede" ON "public"."lh_reservations" USING "btree" ("sede_id");



CREATE INDEX "idx_lh_reservations_status" ON "public"."lh_reservations" USING "btree" ("status");



CREATE INDEX "idx_lh_resv_tasks_reservation" ON "public"."lh_reservation_tasks" USING "btree" ("reservation_id");



CREATE INDEX "idx_lh_resv_tasks_task" ON "public"."lh_reservation_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_lh_room_mapping_room" ON "public"."lh_room_mapping" USING "btree" ("lh_room");



CREATE INDEX "idx_lh_room_mapping_sede" ON "public"."lh_room_mapping" USING "btree" ("sede_id");



CREATE INDEX "idx_lh_sync_logs_created" ON "public"."lh_sync_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lh_sync_logs_external" ON "public"."lh_sync_logs" USING "btree" ("external_id");



CREATE INDEX "idx_logistics_deliveries_sede_id" ON "public"."logistics_deliveries" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_logistics_deliveries_sede_id" IS 'Optimiza consultas de entregas filtradas por sede';



CREATE INDEX "idx_logistics_picklist_items_property_package" ON "public"."logistics_picklist_items" USING "btree" ("picklist_id", "property_id", "is_property_package");



CREATE INDEX "idx_logistics_picklists_sede_id" ON "public"."logistics_picklists" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_logistics_picklists_sede_id" IS 'Optimiza consultas de picklists filtradas por sede';



CREATE INDEX "idx_notification_deliveries_event" ON "public"."notification_deliveries" USING "btree" ("notification_event_id");



CREATE UNIQUE INDEX "idx_notification_deliveries_one_active_whatsapp" ON "public"."notification_deliveries" USING "btree" ("notification_event_id") WHERE (("channel" = 'whatsapp'::"text") AND ("provider" = 'meta_cloud_api'::"text") AND ("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text"])));



CREATE INDEX "idx_notification_deliveries_provider_message" ON "public"."notification_deliveries" USING "btree" ("provider_message_id");



CREATE UNIQUE INDEX "idx_notification_deliveries_provider_message_unique" ON "public"."notification_deliveries" USING "btree" ("channel", "provider", "provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_notification_deliveries_rejected_email_once" ON "public"."notification_deliveries" USING "btree" ("notification_event_id") WHERE (("channel" = 'email'::"text") AND ("template_name" = 'task_rejected_admin_fallback_email'::"text"));



CREATE INDEX "idx_notification_deliveries_whatsapp_monitor" ON "public"."notification_deliveries" USING "btree" ("channel", "created_at" DESC, "status");



CREATE INDEX "idx_notification_delivery_attempts_delivery" ON "public"."notification_delivery_attempts" USING "btree" ("delivery_id", "attempt_no");



CREATE UNIQUE INDEX "idx_notification_delivery_attempts_provider_message_id" ON "public"."notification_delivery_attempts" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_notification_events_dedupe" ON "public"."notification_events" USING "btree" ("dedupe_key");



CREATE INDEX "idx_notification_events_task" ON "public"."notification_events" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "idx_picklist_items_picklist" ON "public"."logistics_picklist_items" USING "btree" ("picklist_id");



CREATE INDEX "idx_picklist_items_product" ON "public"."logistics_picklist_items" USING "btree" ("product_id");



CREATE INDEX "idx_picklist_items_property" ON "public"."logistics_picklist_items" USING "btree" ("property_id");



CREATE INDEX "idx_planning_conflicts_run_id" ON "public"."planning_conflicts" USING "btree" ("run_id");



CREATE INDEX "idx_planning_notification_batches_cleaner_date" ON "public"."planning_notification_batches" USING "btree" ("cleaner_id", "task_date" DESC);



CREATE INDEX "idx_planning_notification_batches_run_id" ON "public"."planning_notification_batches" USING "btree" ("run_id");



CREATE INDEX "idx_planning_run_items_run_id" ON "public"."planning_run_items" USING "btree" ("run_id");



CREATE INDEX "idx_planning_run_items_task_id" ON "public"."planning_run_items" USING "btree" ("task_id");



CREATE INDEX "idx_planning_runs_sede_status_created" ON "public"."planning_runs" USING "btree" ("sede_id", "status", "created_at" DESC);



CREATE INDEX "idx_properties_avantio" ON "public"."properties" USING "btree" ("avantio_accommodation_id");



CREATE INDEX "idx_properties_cliente_id" ON "public"."properties" USING "btree" ("cliente_id");



CREATE INDEX "idx_properties_codigo" ON "public"."properties" USING "btree" ("codigo");



CREATE INDEX "idx_properties_hostaway_name" ON "public"."properties" USING "btree" ("hostaway_internal_name");



CREATE INDEX "idx_properties_is_active" ON "public"."properties" USING "btree" ("is_active") WHERE (("is_active" = true) OR ("is_active" IS NULL));



CREATE INDEX "idx_properties_nombre" ON "public"."properties" USING "btree" ("nombre");



CREATE INDEX "idx_properties_sede_client" ON "public"."properties" USING "btree" ("sede_id", "cliente_id");



CREATE INDEX "idx_properties_sede_id" ON "public"."properties" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_properties_sede_id" IS 'Optimiza consultas de propiedades filtradas por sede';



CREATE INDEX "idx_property_checklist_assignments_active" ON "public"."property_checklist_assignments" USING "btree" ("is_active");



CREATE INDEX "idx_property_checklist_assignments_property_id" ON "public"."property_checklist_assignments" USING "btree" ("property_id");



CREATE INDEX "idx_property_checklist_assignments_template_id" ON "public"."property_checklist_assignments" USING "btree" ("checklist_template_id");



CREATE INDEX "idx_property_consumption_product" ON "public"."property_consumption_config" USING "btree" ("product_id");



CREATE INDEX "idx_property_consumption_property" ON "public"."property_consumption_config" USING "btree" ("property_id");



CREATE INDEX "idx_property_group_assignments_group" ON "public"."property_group_assignments" USING "btree" ("property_group_id");



CREATE INDEX "idx_property_group_assignments_property" ON "public"."property_group_assignments" USING "btree" ("property_id");



CREATE INDEX "idx_property_preferred_cleaners_property_id" ON "public"."property_preferred_cleaners" USING "btree" ("property_id");



CREATE INDEX "idx_recurring_task_executions_execution_date" ON "public"."recurring_task_executions" USING "btree" ("execution_date");



CREATE INDEX "idx_recurring_task_executions_recurring_task_id" ON "public"."recurring_task_executions" USING "btree" ("recurring_task_id");



CREATE INDEX "idx_recurring_tasks_is_active" ON "public"."recurring_tasks" USING "btree" ("is_active");



CREATE INDEX "idx_recurring_tasks_next_execution" ON "public"."recurring_tasks" USING "btree" ("next_execution");



CREATE INDEX "idx_recurring_tasks_sede_id" ON "public"."recurring_tasks" USING "btree" ("sede_id");



CREATE INDEX "idx_security_rate_limits_blocked_until" ON "public"."security_rate_limits" USING "btree" ("blocked_until");



CREATE INDEX "idx_security_rate_limits_identifier_action" ON "public"."security_rate_limits" USING "btree" ("identifier", "action_type");



CREATE INDEX "idx_sede_audit_log_created_at" ON "public"."sede_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sede_audit_log_event_type" ON "public"."sede_audit_log" USING "btree" ("event_type");



CREATE INDEX "idx_sede_audit_log_sede_ids" ON "public"."sede_audit_log" USING "btree" ("from_sede_id", "to_sede_id");



CREATE INDEX "idx_sede_audit_log_user_id" ON "public"."sede_audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_smoobu_property_mappings_property_id" ON "public"."smoobu_property_mappings" USING "btree" ("property_id");



CREATE INDEX "idx_smoobu_reservation_tasks_reservation" ON "public"."smoobu_reservation_tasks" USING "btree" ("reservation_id");



CREATE INDEX "idx_smoobu_reservation_tasks_task" ON "public"."smoobu_reservation_tasks" USING "btree" ("task_id");



CREATE INDEX "idx_smoobu_reservations_check_in" ON "public"."smoobu_reservations" USING "btree" ("check_in");



CREATE INDEX "idx_smoobu_reservations_check_out" ON "public"."smoobu_reservations" USING "btree" ("check_out");



CREATE INDEX "idx_smoobu_reservations_status" ON "public"."smoobu_reservations" USING "btree" ("status");



CREATE INDEX "idx_staffing_targets_sede" ON "public"."staffing_targets" USING "btree" ("sede_id");



CREATE INDEX "idx_stops_delivery" ON "public"."logistics_delivery_stops" USING "btree" ("delivery_id");



CREATE INDEX "idx_stops_property" ON "public"."logistics_delivery_stops" USING "btree" ("property_id");



CREATE INDEX "idx_supervision_building_supervisors_building" ON "public"."supervision_building_supervisors" USING "btree" ("property_group_id", "is_active", "priority");



CREATE INDEX "idx_supervision_building_supervisors_user" ON "public"."supervision_building_supervisors" USING "btree" ("supervisor_user_id", "is_active", "priority");



CREATE INDEX "idx_supervision_incidents_repeat_key" ON "public"."supervision_incidents" USING "btree" ("repeat_key", "created_at" DESC);



CREATE INDEX "idx_supervision_incidents_sede_status" ON "public"."supervision_incidents" USING "btree" ("sede_id", "status", "priority", "created_at" DESC);



CREATE INDEX "idx_supervision_media_review" ON "public"."supervision_review_media" USING "btree" ("review_id", "created_at" DESC);



CREATE INDEX "idx_supervision_media_sede" ON "public"."supervision_review_media" USING "btree" ("sede_id", "created_at" DESC);



CREATE INDEX "idx_supervision_reviews_route_stop" ON "public"."supervision_reviews" USING "btree" ("route_id", "route_stop_id", "created_at" DESC);



CREATE INDEX "idx_supervision_routes_building_date" ON "public"."supervision_routes" USING "btree" ("property_group_id", "route_date");



CREATE INDEX "idx_supervision_routes_sede_date" ON "public"."supervision_routes" USING "btree" ("sede_id", "route_date" DESC);



CREATE INDEX "idx_supervision_stops_route_sequence" ON "public"."supervision_route_stops" USING "btree" ("route_id", "sequence");



CREATE INDEX "idx_supervision_work_items_building_date" ON "public"."supervision_work_items" USING "btree" ("property_group_id", "scheduled_date", "status");



CREATE INDEX "idx_supervision_work_items_property_date" ON "public"."supervision_work_items" USING "btree" ("property_id", "scheduled_date", "work_type");



CREATE INDEX "idx_supervision_work_items_supervisor_date" ON "public"."supervision_work_items" USING "btree" ("assigned_supervisor_user_id", "scheduled_date", "status");



CREATE INDEX "idx_task_approval_events_task" ON "public"."task_approval_events" USING "btree" ("task_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_task_approval_events_whatsapp_message_unique" ON "public"."task_approval_events" USING "btree" ("whatsapp_message_id") WHERE ("whatsapp_message_id" IS NOT NULL);



CREATE INDEX "idx_task_assignments_cleaner_task" ON "public"."task_assignments" USING "btree" ("cleaner_id", "task_id");



CREATE INDEX "idx_task_media_task_report_id" ON "public"."task_media" USING "btree" ("task_report_id");



CREATE INDEX "idx_task_reports_cleaner_id" ON "public"."task_reports" USING "btree" ("cleaner_id");



CREATE INDEX "idx_task_reports_task_id" ON "public"."task_reports" USING "btree" ("task_id");



CREATE INDEX "idx_tasks_additional_tasks" ON "public"."tasks" USING "gin" ("additional_tasks");



CREATE INDEX "idx_tasks_approval_pending_today" ON "public"."tasks" USING "btree" ("date", "approval_status", "cleaner_id") WHERE ("cleaner_id" IS NOT NULL);



CREATE INDEX "idx_tasks_cleaner_date_active_time" ON "public"."tasks" USING "btree" ("cleaner_id", "date", "start_time", "end_time") WHERE (("status" <> ALL (ARRAY['completed'::"text", 'cancelled'::"text"])) AND ("cleaner_id" IS NOT NULL));



CREATE INDEX "idx_tasks_cleaner_id" ON "public"."tasks" USING "btree" ("cleaner_id");



CREATE INDEX "idx_tasks_cleaner_id_user" ON "public"."tasks" USING "btree" ("cleaner_id");



CREATE INDEX "idx_tasks_date" ON "public"."tasks" USING "btree" ("date");



CREATE INDEX "idx_tasks_date_sede_status" ON "public"."tasks" USING "btree" ("date", "sede_id", "status");



CREATE INDEX "idx_tasks_date_start_time" ON "public"."tasks" USING "btree" ("date", "start_time");



CREATE INDEX "idx_tasks_late_start_pending" ON "public"."tasks" USING "btree" ("date", "start_time", "status", "cleaner_id") WHERE (("cleaner_id" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE INDEX "idx_tasks_propiedad_id" ON "public"."tasks" USING "btree" ("propiedad_id");



CREATE INDEX "idx_tasks_sede_id" ON "public"."tasks" USING "btree" ("sede_id");



COMMENT ON INDEX "public"."idx_tasks_sede_id" IS 'Optimiza consultas de tareas filtradas por sede';



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_time_logs_cleaner_date" ON "public"."time_logs" USING "btree" ("cleaner_id", "date");



CREATE INDEX "idx_time_logs_task_id" ON "public"."time_logs" USING "btree" ("task_id");



CREATE INDEX "idx_user_roles_user_role" ON "public"."user_roles" USING "btree" ("user_id", "role");



CREATE INDEX "idx_user_sede_access_composite" ON "public"."user_sede_access" USING "btree" ("user_id", "sede_id", "can_access");



CREATE INDEX "idx_user_sede_access_sede_access" ON "public"."user_sede_access" USING "btree" ("sede_id", "can_access");



CREATE INDEX "idx_user_sede_access_user_sede" ON "public"."user_sede_access" USING "btree" ("user_id", "sede_id");



COMMENT ON INDEX "public"."idx_user_sede_access_user_sede" IS 'Optimiza verificaciones de acceso de usuario a sede';



CREATE INDEX "idx_vacation_requests_cleaner_id" ON "public"."vacation_requests" USING "btree" ("cleaner_id");



CREATE INDEX "idx_vacation_requests_dates" ON "public"."vacation_requests" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_vacation_requests_status" ON "public"."vacation_requests" USING "btree" ("status");



CREATE INDEX "idx_whatsapp_webhook_inbox_claimable" ON "public"."whatsapp_webhook_inbox" USING "btree" ("received_at") WHERE ("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_whatsapp_webhook_inbox_pending" ON "public"."whatsapp_webhook_inbox" USING "btree" ("provider_message_id", "occurred_at") WHERE ("processing_status" = 'pending'::"text");



CREATE INDEX "idx_work_schedule_cleaner_date" ON "public"."cleaner_work_schedule" USING "btree" ("cleaner_id", "date");



CREATE INDEX "idx_worker_absence_audit_log_cleaner" ON "public"."worker_absence_audit_log" USING "btree" ("cleaner_id");



CREATE INDEX "idx_worker_absence_audit_log_reference" ON "public"."worker_absence_audit_log" USING "btree" ("reference_id", "reference_type");



CREATE INDEX "idx_worker_absences_cleaner_date" ON "public"."worker_absences" USING "btree" ("cleaner_id", "start_date", "end_date");



CREATE INDEX "idx_worker_absences_type" ON "public"."worker_absences" USING "btree" ("absence_type");



CREATE INDEX "idx_worker_fixed_days_off_cleaner" ON "public"."worker_fixed_days_off" USING "btree" ("cleaner_id");



CREATE INDEX "idx_worker_hour_adjustments_cleaner_date" ON "public"."worker_hour_adjustments" USING "btree" ("cleaner_id", "date");



CREATE INDEX "idx_worker_hour_adjustments_cleaner_id" ON "public"."worker_hour_adjustments" USING "btree" ("cleaner_id");



CREATE INDEX "idx_worker_hour_adjustments_date" ON "public"."worker_hour_adjustments" USING "btree" ("date");



CREATE INDEX "idx_worker_maintenance_cleanings_cleaner" ON "public"."worker_maintenance_cleanings" USING "btree" ("cleaner_id");



CREATE UNIQUE INDEX "laundry_dirty_auto_once" ON "public"."laundry_dirty_movements" USING "btree" ("task_id", "product_id", "warehouse_id") WHERE (("task_id" IS NOT NULL) AND ("movement_type" = 'entrada'::"text"));



CREATE INDEX "laundry_dirty_movements_created_at_idx" ON "public"."laundry_dirty_movements" USING "btree" ("created_at" DESC);



CREATE INDEX "laundry_dirty_movements_task_idx" ON "public"."laundry_dirty_movements" USING "btree" ("task_id");



CREATE INDEX "laundry_dirty_stock_product_idx" ON "public"."laundry_dirty_stock" USING "btree" ("product_id");



CREATE INDEX "laundry_dirty_stock_warehouse_idx" ON "public"."laundry_dirty_stock" USING "btree" ("warehouse_id");



CREATE INDEX "notification_events_batch_idx" ON "public"."notification_events" USING "btree" ("batch_id", "created_at");



CREATE UNIQUE INDEX "notification_send_reconciliation_one_open" ON "public"."notification_send_reconciliation_actions" USING "btree" ("delivery_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'effect_pending'::"text"]));



CREATE INDEX "planning_apply_batch_items_task_idx" ON "public"."planning_apply_batch_items" USING "btree" ("task_id");



CREATE INDEX "planning_apply_batches_sede_created_idx" ON "public"."planning_apply_batches" USING "btree" ("sede_id", "created_at" DESC);



CREATE INDEX "planning_apply_batches_source_run_idx" ON "public"."planning_apply_batches" USING "btree" ("source_run_id");



CREATE INDEX "planning_assignment_audit_task_idx" ON "public"."planning_assignment_audit" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "properties_default_stock_warehouse_idx" ON "public"."properties" USING "btree" ("default_stock_warehouse_id");



CREATE INDEX "property_storage_access_group_idx" ON "public"."property_storage_access" USING "btree" ("property_group_id", "is_active");



CREATE INDEX "property_storage_access_warehouse_idx" ON "public"."property_storage_access" USING "btree" ("warehouse_id", "is_active");



CREATE UNIQUE INDEX "recurring_task_executions_success_once" ON "public"."recurring_task_executions" USING "btree" ("recurring_task_id", "execution_day") WHERE (("success" = true) AND ("execution_day" IS NOT NULL));



CREATE INDEX "stock_alerts_active_idx" ON "public"."stock_alerts" USING "btree" ("is_active");



CREATE UNIQUE INDEX "stock_alerts_one_active_per_level_type" ON "public"."stock_alerts" USING "btree" ("stock_level_id", "alert_type") WHERE ("is_active" = true);



CREATE INDEX "stock_categories_kind_idx" ON "public"."stock_categories" USING "btree" ("kind");



CREATE INDEX "stock_consumption_rules_product_idx" ON "public"."stock_property_consumption_rules" USING "btree" ("product_id");



CREATE INDEX "stock_consumption_rules_property_idx" ON "public"."stock_property_consumption_rules" USING "btree" ("property_id");



CREATE INDEX "stock_field_mappings_field_idx" ON "public"."stock_property_field_mappings" USING "btree" ("property_field");



CREATE INDEX "stock_field_mappings_sede_idx" ON "public"."stock_property_field_mappings" USING "btree" ("sede_id");



CREATE INDEX "stock_levels_product_idx" ON "public"."stock_levels" USING "btree" ("product_id");



CREATE INDEX "stock_levels_warehouse_idx" ON "public"."stock_levels" USING "btree" ("warehouse_id");



CREATE UNIQUE INDEX "stock_movements_auto_consumption_once" ON "public"."stock_movements" USING "btree" ("task_id", "product_id", "warehouse_id") WHERE ("movement_type" = 'consumo_automatico'::"public"."stock_movement_type");



CREATE INDEX "stock_movements_created_at_idx" ON "public"."stock_movements" USING "btree" ("created_at" DESC);



CREATE INDEX "stock_movements_product_idx" ON "public"."stock_movements" USING "btree" ("product_id");



CREATE INDEX "stock_movements_property_idx" ON "public"."stock_movements" USING "btree" ("property_id");



CREATE INDEX "stock_movements_task_idx" ON "public"."stock_movements" USING "btree" ("task_id");



CREATE INDEX "stock_movements_to_warehouse_idx" ON "public"."stock_movements" USING "btree" ("to_warehouse_id");



CREATE INDEX "stock_movements_warehouse_idx" ON "public"."stock_movements" USING "btree" ("warehouse_id");



CREATE INDEX "stock_products_category_idx" ON "public"."stock_products" USING "btree" ("category_id");



CREATE INDEX "stock_products_sede_idx" ON "public"."stock_products" USING "btree" ("sede_id");



CREATE UNIQUE INDEX "stock_warehouses_one_active_building_storage" ON "public"."stock_warehouses" USING "btree" ("property_group_id") WHERE (("property_group_id" IS NOT NULL) AND ("location_type" = 'building_storage'::"text") AND ("is_active" = true));



CREATE UNIQUE INDEX "stock_warehouses_one_default_per_sede" ON "public"."stock_warehouses" USING "btree" ("sede_id") WHERE ("is_default" = true);



CREATE INDEX "stock_warehouses_property_group_idx" ON "public"."stock_warehouses" USING "btree" ("property_group_id", "location_type", "is_active");



CREATE INDEX "stock_warehouses_sede_idx" ON "public"."stock_warehouses" USING "btree" ("sede_id");



CREATE UNIQUE INDEX "supervision_routes_building_date_key" ON "public"."supervision_routes" USING "btree" ("property_group_id", "route_date") WHERE ("property_group_id" IS NOT NULL);



CREATE INDEX "supervision_stock_check_lines_check_idx" ON "public"."supervision_stock_check_lines" USING "btree" ("check_id");



CREATE INDEX "supervision_stock_checks_building_date_idx" ON "public"."supervision_stock_checks" USING "btree" ("property_group_id", "scheduled_date", "status");



CREATE INDEX "tourist_budget_activation_runs_budget_idx" ON "public"."tourist_budget_activation_runs" USING "btree" ("budget_id", "created_at" DESC);



CREATE INDEX "tourist_budget_documents_budget_idx" ON "public"."tourist_budget_documents" USING "btree" ("budget_id", "created_at" DESC);



CREATE INDEX "tourist_budget_items_version_idx" ON "public"."tourist_budget_items" USING "btree" ("budget_version_id", "sort_order");



CREATE INDEX "tourist_budget_status_history_budget_idx" ON "public"."tourist_budget_status_history" USING "btree" ("budget_id", "created_at" DESC);



CREATE INDEX "tourist_budget_versions_budget_idx" ON "public"."tourist_budget_versions" USING "btree" ("budget_id", "version_number" DESC);



CREATE INDEX "tourist_budgets_client_idx" ON "public"."tourist_budgets" USING "btree" ("client_id");



CREATE INDEX "tourist_budgets_sede_status_idx" ON "public"."tourist_budgets" USING "btree" ("sede_id", "status", "updated_at" DESC);



CREATE UNIQUE INDEX "uq_laundry_route_v2_active_link" ON "public"."laundry_share_links" USING "btree" ("sede_id", "delivery_date") WHERE (("auto_managed" = true) AND ("is_active" = true) AND ("workflow_version" = 'route_v2'::"text"));



CREATE UNIQUE INDEX "uq_laundry_share_links_managed_delivery" ON "public"."laundry_share_links" USING "btree" ("sede_id", "delivery_date") WHERE (("auto_managed" = true) AND ("is_active" = true) AND (COALESCE("workflow_version", 'legacy'::"text") <> 'route_v2'::"text"));



CREATE UNIQUE INDEX "uq_smoobu_property_mappings_name" ON "public"."smoobu_property_mappings" USING "btree" ("lower"("btrim"("smoobu_property_name")));



CREATE UNIQUE INDEX "user_invitations_email_pending_unique" ON "public"."user_invitations" USING "btree" ("email") WHERE ("status" = 'pending'::"public"."invitation_status");



CREATE OR REPLACE TRIGGER "audit_worker_absences" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_absences" FOR EACH ROW EXECUTE FUNCTION "public"."log_worker_absence_changes"();



CREATE OR REPLACE TRIGGER "audit_worker_fixed_days_off" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_fixed_days_off" FOR EACH ROW EXECUTE FUNCTION "public"."log_worker_fixed_days_off_changes"();



CREATE OR REPLACE TRIGGER "audit_worker_maintenance_cleanings" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_maintenance_cleanings" FOR EACH ROW EXECUTE FUNCTION "public"."log_worker_maintenance_cleanings_changes"();



CREATE OR REPLACE TRIGGER "budget_rate_profiles_updated_at" BEFORE UPDATE ON "public"."budget_rate_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_tourist_budget_updated_at"();



CREATE OR REPLACE TRIGGER "bump_recurring_task_state_revision" BEFORE UPDATE ON "public"."recurring_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."bump_recurring_task_state_revision"();



CREATE OR REPLACE TRIGGER "cleaners_prevent_unsafe_deactivation" BEFORE UPDATE OF "is_active" ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"();



CREATE OR REPLACE TRIGGER "cleaners_rotate_activation_cycle" BEFORE UPDATE OF "is_active" ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."rotate_cleaner_activation_cycle"();



CREATE OR REPLACE TRIGGER "hash_laundry_route_worker_pin_before_write" BEFORE INSERT OR UPDATE OF "cleaner_id" ON "public"."laundry_route_workers" FOR EACH ROW EXECUTE FUNCTION "public"."hash_laundry_route_worker_pin"();



CREATE OR REPLACE TRIGGER "on_cleaner_created_set_availability" AFTER INSERT ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_availability"();



CREATE OR REPLACE TRIGGER "set_updated_at_logistics_deliveries" BEFORE UPDATE ON "public"."logistics_deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_logistics_delivery_items" BEFORE UPDATE ON "public"."logistics_delivery_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_logistics_delivery_stops" BEFORE UPDATE ON "public"."logistics_delivery_stops" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_logistics_picklist_items" BEFORE UPDATE ON "public"."logistics_picklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at_logistics_picklists" BEFORE UPDATE ON "public"."logistics_picklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "sync_laundry_route_worker_pin_after_cleaner_update" AFTER UPDATE OF "pin", "is_active" ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"();



CREATE OR REPLACE TRIGGER "touch_laundry_route_worker_updated_at_before_update" BEFORE UPDATE ON "public"."laundry_route_workers" FOR EACH ROW EXECUTE FUNCTION "public"."touch_laundry_route_worker_updated_at"();



CREATE OR REPLACE TRIGGER "tourist_budgets_updated_at" BEFORE UPDATE ON "public"."tourist_budgets" FOR EACH ROW EXECUTE FUNCTION "public"."touch_tourist_budget_updated_at"();



CREATE OR REPLACE TRIGGER "trg_avirato_reservation_tasks_updated_at" BEFORE UPDATE ON "public"."avirato_reservation_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_avirato_reservations_updated_at" BEFORE UPDATE ON "public"."avirato_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_avirato_room_mapping_updated_at" BEFORE UPDATE ON "public"."avirato_room_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_avirato_sync_schedules_updated_at" BEFORE UPDATE ON "public"."avirato_sync_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_cleaner_availability_planning_guard" AFTER INSERT OR DELETE OR UPDATE ON "public"."cleaner_availability" FOR EACH ROW EXECUTE FUNCTION "public"."guard_cleaner_availability_planning_write"();



CREATE OR REPLACE TRIGGER "trg_cleaners_enqueue_deleted_cleaner_cancellations" BEFORE DELETE ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_deleted_cleaner_cancellations"();



CREATE OR REPLACE TRIGGER "trg_cleaners_planning_deactivation_guard" AFTER UPDATE OF "is_active" ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."guard_cleaner_deactivation_planning_write"();



CREATE OR REPLACE TRIGGER "trg_cleaning_incidents_updated_at" BEFORE UPDATE ON "public"."cleaning_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_incident_categories_updated_at" BEFORE UPDATE ON "public"."incident_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_lh_reservation_tasks_updated_at" BEFORE UPDATE ON "public"."lh_reservation_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_lh_reservations_updated_at" BEFORE UPDATE ON "public"."lh_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_lh_room_mapping_updated_at" BEFORE UPDATE ON "public"."lh_room_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_notification_events_enforce_scope" BEFORE INSERT ON "public"."notification_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_notification_event_scope"();



CREATE OR REPLACE TRIGGER "trg_notification_events_prevent_non_live_claim" BEFORE INSERT OR UPDATE ON "public"."notification_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_notification_event_delivery_mode"();



CREATE OR REPLACE TRIGGER "trg_notification_events_snapshot_immutable" BEFORE UPDATE OF "snapshot" ON "public"."notification_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_notification_event_snapshot_mutation"();



CREATE OR REPLACE TRIGGER "trg_smoobu_property_mappings_updated_at" BEFORE UPDATE ON "public"."smoobu_property_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_smoobu_reservation_tasks_updated_at" BEFORE UPDATE ON "public"."smoobu_reservation_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_smoobu_reservations_updated_at" BEFORE UPDATE ON "public"."smoobu_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supervision_incident_events_actor" BEFORE INSERT ON "public"."supervision_incident_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_supervision_actor_from_auth"();



CREATE OR REPLACE TRIGGER "trg_supervision_incidents_actor" BEFORE INSERT ON "public"."supervision_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."set_supervision_actor_from_auth"();



CREATE OR REPLACE TRIGGER "trg_supervision_incidents_audit_immutable" BEFORE UPDATE OF "created_by" ON "public"."supervision_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_supervision_audit_fields"();



CREATE OR REPLACE TRIGGER "trg_supervision_incidents_open_route" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supervision_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_incident_route_is_open"();



CREATE OR REPLACE TRIGGER "trg_supervision_incidents_updated_at" BEFORE UPDATE ON "public"."supervision_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supervision_media_open_route" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supervision_review_media" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_media_route_is_open"();



CREATE OR REPLACE TRIGGER "trg_supervision_reservations_open_route" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supervision_reservation_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_reservation_route_is_open"();



CREATE OR REPLACE TRIGGER "trg_supervision_review_events_actor" BEFORE INSERT ON "public"."supervision_review_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_supervision_actor_from_auth"();



CREATE OR REPLACE TRIGGER "trg_supervision_reviews_actor" BEFORE INSERT ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_supervision_actor_from_auth"();



CREATE OR REPLACE TRIGGER "trg_supervision_reviews_audit_immutable" BEFORE UPDATE OF "reviewer_user_id" ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."preserve_supervision_audit_fields"();



CREATE OR REPLACE TRIGGER "trg_supervision_reviews_open_route" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_review_route_is_open"();



CREATE OR REPLACE TRIGGER "trg_supervision_reviews_updated_at" BEFORE UPDATE ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supervision_routes_updated_at" BEFORE UPDATE ON "public"."supervision_routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_supervision_stops_open_route" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supervision_route_stops" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_stop_route_is_open"();



CREATE OR REPLACE TRIGGER "trg_supervision_stops_updated_at" BEFORE UPDATE ON "public"."supervision_route_stops" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_task_assignments_enqueue_notification" AFTER INSERT OR DELETE ON "public"."task_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_task_assignment_notification"();



CREATE OR REPLACE TRIGGER "trg_tasks_bump_planning_version" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."bump_task_planning_version"();



CREATE OR REPLACE TRIGGER "trg_tasks_enqueue_deleted_task_cancellations" BEFORE DELETE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_deleted_task_cancellations"();



CREATE OR REPLACE TRIGGER "trg_tasks_enqueue_modified_notifications" AFTER UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_task_modified_notifications"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_building_property_sede" BEFORE INSERT OR UPDATE OF "property_group_id", "property_id" ON "public"."property_group_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_building_property_sede"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_building_supervisor" BEFORE INSERT OR UPDATE OF "property_group_id", "supervisor_user_id", "role_type", "priority", "starts_on", "ends_on", "is_active" ON "public"."supervision_building_supervisors" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_building_supervisor"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_daily_report_sede" BEFORE INSERT OR UPDATE OF "route_id", "sede_id" ON "public"."supervision_daily_reports" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_daily_report_sede"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_incident_links" BEFORE INSERT OR UPDATE OF "route_id", "route_stop_id", "review_id", "sede_id" ON "public"."supervision_incidents" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_incident_links"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_media_sede" BEFORE INSERT OR UPDATE OF "review_id", "sede_id" ON "public"."supervision_review_media" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_media_sede"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_review_property_vacancy" BEFORE INSERT OR UPDATE OF "property_id", "property_group_id", "started_at", "completed_at", "created_at" ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_review_property_vacancy"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_review_route" BEFORE INSERT OR UPDATE OF "route_id", "route_stop_id" ON "public"."supervision_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_review_route"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_route_building_assignment" BEFORE INSERT OR UPDATE OF "property_group_id", "route_date" ON "public"."supervision_routes" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_route_building_assignment"();



CREATE OR REPLACE TRIGGER "trg_validate_supervision_stock_warehouse_location" BEFORE INSERT OR UPDATE OF "property_group_id", "location_type", "is_default", "sede_id" ON "public"."stock_warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."validate_supervision_stock_warehouse_location"();



CREATE OR REPLACE TRIGGER "trg_worker_absences_planning_guard" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_absences" FOR EACH ROW EXECUTE FUNCTION "public"."guard_worker_absence_planning_write"();



CREATE OR REPLACE TRIGGER "trg_worker_fixed_days_off_planning_guard" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_fixed_days_off" FOR EACH ROW EXECUTE FUNCTION "public"."guard_worker_fixed_day_off_planning_write"();



CREATE OR REPLACE TRIGGER "trg_worker_maintenance_planning_guard" AFTER INSERT OR DELETE OR UPDATE ON "public"."worker_maintenance_cleanings" FOR EACH ROW EXECUTE FUNCTION "public"."guard_worker_maintenance_planning_write"();



CREATE OR REPLACE TRIGGER "trigger_handle_new_cleaner" AFTER INSERT OR UPDATE ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_cleaner"();



CREATE OR REPLACE TRIGGER "update_auto_assignment_rules_updated_at" BEFORE UPDATE ON "public"."auto_assignment_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_avantio_reservations_updated_at" BEFORE UPDATE ON "public"."avantio_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_avantio_sync_schedules_updated_at" BEFORE UPDATE ON "public"."avantio_sync_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cer_updated_at" BEFORE UPDATE ON "public"."client_extraordinary_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cleaner_availability_updated_at" BEFORE UPDATE ON "public"."cleaner_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cleaner_group_assignments_updated_at" BEFORE UPDATE ON "public"."cleaner_group_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_cleaners_updated_at" BEFORE UPDATE ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_portal_access_updated_at" BEFORE UPDATE ON "public"."client_portal_access" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_client_reservations_updated_at" BEFORE UPDATE ON "public"."client_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ert_updated_at" BEFORE UPDATE ON "public"."extraordinary_request_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_forecast_subscribers_updated_at" BEFORE UPDATE ON "public"."forecast_subscribers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hostaway_reservations_updated_at" BEFORE UPDATE ON "public"."hostaway_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hostaway_sync_schedules_updated_at" BEFORE UPDATE ON "public"."hostaway_sync_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."update_hostaway_sync_schedules_updated_at"();



CREATE OR REPLACE TRIGGER "update_inventory_categories_updated_at" BEFORE UPDATE ON "public"."inventory_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_products_updated_at" BEFORE UPDATE ON "public"."inventory_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_stock_timestamp" BEFORE UPDATE ON "public"."inventory_stock" FOR EACH ROW EXECUTE FUNCTION "public"."update_inventory_stock_timestamp"();



CREATE OR REPLACE TRIGGER "update_laundry_bag_preparations_updated_at" BEFORE UPDATE ON "public"."laundry_bag_preparations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laundry_classic_route_order_updated_at" BEFORE UPDATE ON "public"."laundry_classic_route_order" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laundry_delivery_schedule_updated_at" BEFORE UPDATE ON "public"."laundry_delivery_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laundry_delivery_tracking_updated_at" BEFORE UPDATE ON "public"."laundry_delivery_tracking" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laundry_dirty_stock_timestamp" BEFORE UPDATE ON "public"."laundry_dirty_stock" FOR EACH ROW EXECUTE FUNCTION "public"."update_laundry_dirty_stock_timestamp"();



CREATE OR REPLACE TRIGGER "update_laundry_route_v2_bag_snapshots_updated_at" BEFORE UPDATE ON "public"."laundry_route_v2_bag_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_laundry_share_links_updated_at" BEFORE UPDATE ON "public"."laundry_share_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_planning_notification_batches_updated_at" BEFORE UPDATE ON "public"."planning_notification_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_planning_run_items_updated_at" BEFORE UPDATE ON "public"."planning_run_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_planning_runs_updated_at" BEFORE UPDATE ON "public"."planning_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_planning_settings_updated_at" BEFORE UPDATE ON "public"."planning_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_properties_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_amenity_inventory_mapping_updated_at" BEFORE UPDATE ON "public"."property_amenity_inventory_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_checklist_assignments_updated_at" BEFORE UPDATE ON "public"."property_checklist_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_consumption_config_updated_at" BEFORE UPDATE ON "public"."property_consumption_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_property_groups_updated_at" BEFORE UPDATE ON "public"."property_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recurring_task_executions_updated_at" BEFORE UPDATE ON "public"."recurring_task_executions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recurring_tasks_updated_at" BEFORE UPDATE ON "public"."recurring_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_report_export_tokens_updated_at" BEFORE UPDATE ON "public"."report_export_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_security_rate_limits_updated_at" BEFORE UPDATE ON "public"."security_rate_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_sedes_updated_at" BEFORE UPDATE ON "public"."sedes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_staffing_targets_updated_at" BEFORE UPDATE ON "public"."staffing_targets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_categories_updated_at" BEFORE UPDATE ON "public"."stock_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_consumption_rules_updated_at" BEFORE UPDATE ON "public"."stock_property_consumption_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_field_mappings_updated_at" BEFORE UPDATE ON "public"."stock_property_field_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_levels_timestamp" BEFORE UPDATE ON "public"."stock_levels" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_levels_timestamp"();



CREATE OR REPLACE TRIGGER "update_stock_products_updated_at" BEFORE UPDATE ON "public"."stock_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_sede_settings_updated_at" BEFORE UPDATE ON "public"."stock_sede_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_warehouses_updated_at" BEFORE UPDATE ON "public"."stock_warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_assignments_updated_at" BEFORE UPDATE ON "public"."task_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_checklists_templates_updated_at" BEFORE UPDATE ON "public"."task_checklists_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_reports_updated_at" BEFORE UPDATE ON "public"."task_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_logs_updated_at" BEFORE UPDATE ON "public"."time_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_sede_access_updated_at" BEFORE UPDATE ON "public"."user_sede_access" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vacation_requests_updated_at" BEFORE UPDATE ON "public"."vacation_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_schedule_updated_at" BEFORE UPDATE ON "public"."cleaner_work_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_absences_updated_at" BEFORE UPDATE ON "public"."worker_absences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_contracts_updated_at" BEFORE UPDATE ON "public"."worker_contracts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_fixed_days_off_updated_at" BEFORE UPDATE ON "public"."worker_fixed_days_off" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_hour_adjustments_updated_at" BEFORE UPDATE ON "public"."worker_hour_adjustments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_worker_maintenance_cleanings_updated_at" BEFORE UPDATE ON "public"."worker_maintenance_cleanings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ai_action_audit_logs"
    ADD CONSTRAINT "ai_action_audit_logs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_action_audit_logs"
    ADD CONSTRAINT "ai_action_audit_logs_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."ai_action_proposals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_action_proposals"
    ADD CONSTRAINT "ai_action_proposals_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_action_proposals"
    ADD CONSTRAINT "ai_action_proposals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_action_proposals"
    ADD CONSTRAINT "ai_action_proposals_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_learning_suggestions"
    ADD CONSTRAINT "ai_learning_suggestions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_memories"
    ADD CONSTRAINT "ai_memories_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "public"."ai_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_observed_events"
    ADD CONSTRAINT "ai_observed_events_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_observed_events"
    ADD CONSTRAINT "ai_observed_events_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignment_patterns"
    ADD CONSTRAINT "assignment_patterns_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_patterns"
    ADD CONSTRAINT "assignment_patterns_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_assignment_logs"
    ADD CONSTRAINT "auto_assignment_logs_assigned_cleaner_id_fkey" FOREIGN KEY ("assigned_cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_assignment_logs"
    ADD CONSTRAINT "auto_assignment_logs_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id");



ALTER TABLE ONLY "public"."auto_assignment_logs"
    ADD CONSTRAINT "auto_assignment_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auto_assignment_rules"
    ADD CONSTRAINT "auto_assignment_rules_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avantio_alert_log"
    ADD CONSTRAINT "avantio_alert_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avantio_reservations"
    ADD CONSTRAINT "avantio_reservations_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."avantio_reservations"
    ADD CONSTRAINT "avantio_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."avantio_reservations"
    ADD CONSTRAINT "avantio_reservations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avantio_sync_errors"
    ADD CONSTRAINT "avantio_sync_errors_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."avantio_sync_schedules"("id");



ALTER TABLE ONLY "public"."avantio_sync_errors"
    ADD CONSTRAINT "avantio_sync_errors_sync_log_id_fkey" FOREIGN KEY ("sync_log_id") REFERENCES "public"."avantio_sync_logs"("id");



ALTER TABLE ONLY "public"."avantio_sync_logs"
    ADD CONSTRAINT "avantio_sync_logs_original_sync_id_fkey" FOREIGN KEY ("original_sync_id") REFERENCES "public"."avantio_sync_logs"("id");



ALTER TABLE ONLY "public"."avirato_reservation_tasks"
    ADD CONSTRAINT "avirato_reservation_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."avirato_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avirato_reservation_tasks"
    ADD CONSTRAINT "avirato_reservation_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avirato_reservations"
    ADD CONSTRAINT "avirato_reservations_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avirato_room_mapping"
    ADD CONSTRAINT "avirato_room_mapping_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."avirato_room_mapping"
    ADD CONSTRAINT "avirato_room_mapping_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "public"."properties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."avirato_room_mapping"
    ADD CONSTRAINT "avirato_room_mapping_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avirato_sync_errors"
    ADD CONSTRAINT "avirato_sync_errors_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."avirato_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avirato_sync_errors"
    ADD CONSTRAINT "avirato_sync_errors_sync_log_id_fkey" FOREIGN KEY ("sync_log_id") REFERENCES "public"."avirato_sync_logs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_task_email_deliveries"
    ADD CONSTRAINT "batch_task_email_deliveries_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."batch_task_creation_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_rate_profile_versions"
    ADD CONSTRAINT "budget_rate_profile_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budget_rate_profile_versions"
    ADD CONSTRAINT "budget_rate_profile_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."budget_rate_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_rate_profiles"
    ADD CONSTRAINT "budget_rate_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_rate_profiles"
    ADD CONSTRAINT "budget_rate_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budget_rate_profiles"
    ADD CONSTRAINT "budget_rate_profiles_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_availability"
    ADD CONSTRAINT "cleaner_availability_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_group_assignments"
    ADD CONSTRAINT "cleaner_group_assignments_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_group_assignments"
    ADD CONSTRAINT "cleaner_group_assignments_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaner_work_schedule"
    ADD CONSTRAINT "cleaner_work_schedule_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_incident_comments"
    ADD CONSTRAINT "cleaning_incident_comments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."cleaning_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_incident_events"
    ADD CONSTRAINT "cleaning_incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."cleaning_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_incident_media"
    ADD CONSTRAINT "cleaning_incident_media_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."cleaning_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."incident_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_reporter_cleaner_id_fkey" FOREIGN KEY ("reporter_cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cleaning_incidents"
    ADD CONSTRAINT "cleaning_incidents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "public"."extraordinary_request_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."client_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_extraordinary_requests"
    ADD CONSTRAINT "client_extraordinary_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_portal_access"
    ADD CONSTRAINT "client_portal_access_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_portal_access_logs"
    ADD CONSTRAINT "client_portal_access_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_portal_access_logs"
    ADD CONSTRAINT "client_portal_access_logs_portal_access_id_fkey" FOREIGN KEY ("portal_access_id") REFERENCES "public"."client_portal_access"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_reservation_logs"
    ADD CONSTRAINT "client_reservation_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_reservation_logs"
    ADD CONSTRAINT "client_reservation_logs_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."client_reservations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_reservations"
    ADD CONSTRAINT "client_reservations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_reservations"
    ADD CONSTRAINT "client_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_reservations"
    ADD CONSTRAINT "client_reservations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."daily_report_export_logs"
    ADD CONSTRAINT "daily_report_export_logs_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."daily_report_export_logs"
    ADD CONSTRAINT "daily_report_export_logs_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."report_export_tokens"("id");



ALTER TABLE ONLY "public"."extraordinary_request_types"
    ADD CONSTRAINT "extraordinary_request_types_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_task_executions"
    ADD CONSTRAINT "fk_recurring_task_executions_generated_task" FOREIGN KEY ("generated_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_task_executions"
    ADD CONSTRAINT "fk_recurring_task_executions_recurring_task" FOREIGN KEY ("recurring_task_id") REFERENCES "public"."recurring_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_alerts_log"
    ADD CONSTRAINT "forecast_alerts_log_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forecast_subscribers"
    ADD CONSTRAINT "forecast_subscribers_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hostaway_reservations"
    ADD CONSTRAINT "hostaway_reservations_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."hostaway_reservations"
    ADD CONSTRAINT "hostaway_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."hostaway_reservations"
    ADD CONSTRAINT "hostaway_reservations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hostaway_sync_errors"
    ADD CONSTRAINT "hostaway_sync_errors_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."hostaway_sync_schedules"("id");



ALTER TABLE ONLY "public"."hostaway_sync_errors"
    ADD CONSTRAINT "hostaway_sync_errors_sync_log_id_fkey" FOREIGN KEY ("sync_log_id") REFERENCES "public"."hostaway_sync_logs"("id");



ALTER TABLE ONLY "public"."hostaway_sync_logs"
    ADD CONSTRAINT "hostaway_sync_logs_original_sync_id_fkey" FOREIGN KEY ("original_sync_id") REFERENCES "public"."hostaway_sync_logs"("id");



ALTER TABLE ONLY "public"."hostaway_sync_schedules"
    ADD CONSTRAINT "hostaway_sync_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_products"
    ADD CONSTRAINT "inventory_products_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_stock"
    ADD CONSTRAINT "inventory_stock_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_issue_by_worker_id_fkey" FOREIGN KEY ("issue_by_worker_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_last_share_link_id_fkey" FOREIGN KEY ("last_share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_prepared_by_worker_id_fkey" FOREIGN KEY ("prepared_by_worker_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_bag_preparations"
    ADD CONSTRAINT "laundry_bag_preparations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_classic_route_order"
    ADD CONSTRAINT "laundry_classic_route_order_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_classic_route_order"
    ADD CONSTRAINT "laundry_classic_route_order_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_delivery_schedule"
    ADD CONSTRAINT "laundry_delivery_schedule_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_collected_by_worker_id_fkey" FOREIGN KEY ("collected_by_worker_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_delivered_by_worker_id_fkey" FOREIGN KEY ("delivered_by_worker_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_delivery_tracking"
    ADD CONSTRAINT "laundry_delivery_tracking_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_dirty_movements"
    ADD CONSTRAINT "laundry_dirty_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."laundry_dirty_stock"
    ADD CONSTRAINT "laundry_dirty_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_dirty_stock"
    ADD CONSTRAINT "laundry_dirty_stock_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_dirty_stock"
    ADD CONSTRAINT "laundry_dirty_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_link_sync_runs"
    ADD CONSTRAINT "laundry_link_sync_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_link_sync_runs"
    ADD CONSTRAINT "laundry_link_sync_runs_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_link_sync_runs"
    ADD CONSTRAINT "laundry_link_sync_runs_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_access_attempts"
    ADD CONSTRAINT "laundry_route_access_attempts_route_worker_id_fkey" FOREIGN KEY ("route_worker_id") REFERENCES "public"."laundry_route_workers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_access_attempts"
    ADD CONSTRAINT "laundry_route_access_attempts_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_sessions"
    ADD CONSTRAINT "laundry_route_sessions_route_worker_id_fkey" FOREIGN KEY ("route_worker_id") REFERENCES "public"."laundry_route_workers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_route_sessions"
    ADD CONSTRAINT "laundry_route_sessions_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_route_v2_authorizations"
    ADD CONSTRAINT "laundry_route_v2_authorizations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_authorizations"
    ADD CONSTRAINT "laundry_route_v2_authorizations_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_authorizations"
    ADD CONSTRAINT "laundry_route_v2_authorizations_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_bag_snapshots"
    ADD CONSTRAINT "laundry_route_v2_bag_snapshots_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_route_v2_bag_snapshots"
    ADD CONSTRAINT "laundry_route_v2_bag_snapshots_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_v2_events"
    ADD CONSTRAINT "laundry_route_v2_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_worker_events"
    ADD CONSTRAINT "laundry_route_worker_events_route_worker_id_fkey" FOREIGN KEY ("route_worker_id") REFERENCES "public"."laundry_route_workers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_worker_events"
    ADD CONSTRAINT "laundry_route_worker_events_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "public"."laundry_share_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_worker_events"
    ADD CONSTRAINT "laundry_route_worker_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_workers"
    ADD CONSTRAINT "laundry_route_workers_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_route_workers"
    ADD CONSTRAINT "laundry_route_workers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."laundry_route_workers"
    ADD CONSTRAINT "laundry_route_workers_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."laundry_share_links"
    ADD CONSTRAINT "laundry_share_links_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."lh_reservation_tasks"
    ADD CONSTRAINT "lh_reservation_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."lh_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lh_reservation_tasks"
    ADD CONSTRAINT "lh_reservation_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lh_reservations"
    ADD CONSTRAINT "lh_reservations_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lh_room_mapping"
    ADD CONSTRAINT "lh_room_mapping_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lh_room_mapping"
    ADD CONSTRAINT "lh_room_mapping_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "public"."properties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lh_room_mapping"
    ADD CONSTRAINT "lh_room_mapping_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_deliveries"
    ADD CONSTRAINT "logistics_deliveries_picklist_id_fkey" FOREIGN KEY ("picklist_id") REFERENCES "public"."logistics_picklists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logistics_deliveries"
    ADD CONSTRAINT "logistics_deliveries_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."logistics_delivery_items"
    ADD CONSTRAINT "logistics_delivery_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id");



ALTER TABLE ONLY "public"."logistics_delivery_items"
    ADD CONSTRAINT "logistics_delivery_items_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "public"."logistics_delivery_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_delivery_stops"
    ADD CONSTRAINT "logistics_delivery_stops_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."logistics_deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_delivery_stops"
    ADD CONSTRAINT "logistics_delivery_stops_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."logistics_picklist_items"
    ADD CONSTRAINT "logistics_picklist_items_picklist_id_fkey" FOREIGN KEY ("picklist_id") REFERENCES "public"."logistics_picklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."logistics_picklist_items"
    ADD CONSTRAINT "logistics_picklist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id");



ALTER TABLE ONLY "public"."logistics_picklist_items"
    ADD CONSTRAINT "logistics_picklist_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."logistics_picklists"
    ADD CONSTRAINT "logistics_picklists_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."notification_deliveries"
    ADD CONSTRAINT "notification_deliveries_notification_event_id_fkey" FOREIGN KEY ("notification_event_id") REFERENCES "public"."notification_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_delivery_attempts"
    ADD CONSTRAINT "notification_delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."planning_apply_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."notification_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_events"
    ADD CONSTRAINT "notification_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_send_reconciliation_actions"
    ADD CONSTRAINT "notification_send_reconciliat_fallback_whatsapp_delivery_i_fkey" FOREIGN KEY ("fallback_whatsapp_delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_send_reconciliation_actions"
    ADD CONSTRAINT "notification_send_reconciliation_act_notification_event_id_fkey" FOREIGN KEY ("notification_event_id") REFERENCES "public"."notification_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_send_reconciliation_actions"
    ADD CONSTRAINT "notification_send_reconciliation_actions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."planning_apply_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_recurring_task_id_fkey" FOREIGN KEY ("recurring_task_id") REFERENCES "public"."recurring_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_apply_batch_items"
    ADD CONSTRAINT "planning_apply_batch_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_apply_batches"
    ADD CONSTRAINT "planning_apply_batches_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."planning_apply_batches"
    ADD CONSTRAINT "planning_apply_batches_source_run_id_fkey" FOREIGN KEY ("source_run_id") REFERENCES "public"."planning_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_assignment_audit"
    ADD CONSTRAINT "planning_assignment_audit_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."planning_apply_batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."planning_assignment_audit"
    ADD CONSTRAINT "planning_assignment_audit_batch_item_id_fkey" FOREIGN KEY ("batch_item_id") REFERENCES "public"."planning_apply_batch_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."planning_assignment_audit"
    ADD CONSTRAINT "planning_assignment_audit_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."planning_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_conflicts"
    ADD CONSTRAINT "planning_conflicts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_notification_batches"
    ADD CONSTRAINT "planning_notification_batches_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_notification_batches"
    ADD CONSTRAINT "planning_notification_batches_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."planning_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."planning_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_run_items"
    ADD CONSTRAINT "planning_run_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_runs"
    ADD CONSTRAINT "planning_runs_applied_batch_id_fkey" FOREIGN KEY ("applied_batch_id") REFERENCES "public"."planning_apply_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."planning_runs"
    ADD CONSTRAINT "planning_runs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."planning_runs"
    ADD CONSTRAINT "planning_runs_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."planning_runs"
    ADD CONSTRAINT "planning_runs_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."planning_settings"
    ADD CONSTRAINT "planning_settings_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_default_stock_warehouse_id_fkey" FOREIGN KEY ("default_stock_warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."property_amenity_inventory_mapping"
    ADD CONSTRAINT "property_amenity_inventory_mapping_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id");



ALTER TABLE ONLY "public"."property_checklist_assignments"
    ADD CONSTRAINT "property_checklist_assignments_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."task_checklists_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_checklist_assignments"
    ADD CONSTRAINT "property_checklist_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_consumption_config"
    ADD CONSTRAINT "property_consumption_config_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."inventory_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_consumption_config"
    ADD CONSTRAINT "property_consumption_config_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_group_assignments"
    ADD CONSTRAINT "property_group_assignments_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_group_assignments"
    ADD CONSTRAINT "property_group_assignments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_preferred_cleaners"
    ADD CONSTRAINT "property_preferred_cleaners_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_preferred_cleaners"
    ADD CONSTRAINT "property_preferred_cleaners_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_storage_access"
    ADD CONSTRAINT "property_storage_access_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_storage_access"
    ADD CONSTRAINT "property_storage_access_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_storage_access"
    ADD CONSTRAINT "property_storage_access_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recurring_tasks"
    ADD CONSTRAINT "recurring_tasks_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_tasks"
    ADD CONSTRAINT "recurring_tasks_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_tasks"
    ADD CONSTRAINT "recurring_tasks_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recurring_tasks"
    ADD CONSTRAINT "recurring_tasks_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."report_export_tokens"
    ADD CONSTRAINT "report_export_tokens_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sede_audit_log"
    ADD CONSTRAINT "sede_audit_log_from_sede_id_fkey" FOREIGN KEY ("from_sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sede_audit_log"
    ADD CONSTRAINT "sede_audit_log_to_sede_id_fkey" FOREIGN KEY ("to_sede_id") REFERENCES "public"."sedes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sede_audit_log"
    ADD CONSTRAINT "sede_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."smoobu_property_mappings"
    ADD CONSTRAINT "smoobu_property_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."smoobu_property_mappings"
    ADD CONSTRAINT "smoobu_property_mappings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."smoobu_property_mappings"
    ADD CONSTRAINT "smoobu_property_mappings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."smoobu_reservation_tasks"
    ADD CONSTRAINT "smoobu_reservation_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."smoobu_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."smoobu_reservation_tasks"
    ADD CONSTRAINT "smoobu_reservation_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."smoobu_reservations"
    ADD CONSTRAINT "smoobu_reservations_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."smoobu_reservations"
    ADD CONSTRAINT "smoobu_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staffing_targets"
    ADD CONSTRAINT "staffing_targets_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_alerts"
    ADD CONSTRAINT "stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_alerts"
    ADD CONSTRAINT "stock_alerts_stock_level_id_fkey" FOREIGN KEY ("stock_level_id") REFERENCES "public"."stock_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_alerts"
    ADD CONSTRAINT "stock_alerts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_levels"
    ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_products"
    ADD CONSTRAINT "stock_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."stock_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_products"
    ADD CONSTRAINT "stock_products_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_property_consumption_rules"
    ADD CONSTRAINT "stock_property_consumption_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_property_consumption_rules"
    ADD CONSTRAINT "stock_property_consumption_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_property_consumption_rules"
    ADD CONSTRAINT "stock_property_consumption_rules_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_property_field_mappings"
    ADD CONSTRAINT "stock_property_field_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_property_field_mappings"
    ADD CONSTRAINT "stock_property_field_mappings_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_property_field_mappings"
    ADD CONSTRAINT "stock_property_field_mappings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_sede_settings"
    ADD CONSTRAINT "stock_sede_settings_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_sede_settings"
    ADD CONSTRAINT "stock_sede_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_warehouses"
    ADD CONSTRAINT "stock_warehouses_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_warehouses"
    ADD CONSTRAINT "stock_warehouses_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_building_policies"
    ADD CONSTRAINT "supervision_building_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_building_policies"
    ADD CONSTRAINT "supervision_building_policies_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_building_supervisors"
    ADD CONSTRAINT "supervision_building_supervisors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_building_supervisors"
    ADD CONSTRAINT "supervision_building_supervisors_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_building_supervisors"
    ADD CONSTRAINT "supervision_building_supervisors_supervisor_user_id_fkey" FOREIGN KEY ("supervisor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_daily_reports"
    ADD CONSTRAINT "supervision_daily_reports_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."supervision_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_daily_reports"
    ADD CONSTRAINT "supervision_daily_reports_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_incident_events"
    ADD CONSTRAINT "supervision_incident_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incident_events"
    ADD CONSTRAINT "supervision_incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."supervision_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."supervision_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."supervision_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_route_stop_id_fkey" FOREIGN KEY ("route_stop_id") REFERENCES "public"."supervision_route_stops"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_incidents"
    ADD CONSTRAINT "supervision_incidents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_reservation_snapshots"
    ADD CONSTRAINT "supervision_reservation_snapshots_route_stop_id_fkey" FOREIGN KEY ("route_stop_id") REFERENCES "public"."supervision_route_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_reservation_snapshots"
    ADD CONSTRAINT "supervision_reservation_snapshots_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_review_events"
    ADD CONSTRAINT "supervision_review_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_review_events"
    ADD CONSTRAINT "supervision_review_events_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."supervision_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_review_media"
    ADD CONSTRAINT "supervision_review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."supervision_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_review_media"
    ADD CONSTRAINT "supervision_review_media_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."supervision_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_route_stop_id_fkey" FOREIGN KEY ("route_stop_id") REFERENCES "public"."supervision_route_stops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_reviews"
    ADD CONSTRAINT "supervision_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "public"."supervision_routes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_route_stops"
    ADD CONSTRAINT "supervision_route_stops_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_routes"
    ADD CONSTRAINT "supervision_routes_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_routes"
    ADD CONSTRAINT "supervision_routes_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_routes"
    ADD CONSTRAINT "supervision_routes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_stock_check_lines"
    ADD CONSTRAINT "supervision_stock_check_lines_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."supervision_stock_checks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_stock_check_lines"
    ADD CONSTRAINT "supervision_stock_check_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."stock_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_stock_check_lines"
    ADD CONSTRAINT "supervision_stock_check_lines_stock_level_id_fkey" FOREIGN KEY ("stock_level_id") REFERENCES "public"."stock_levels"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_stock_checks"
    ADD CONSTRAINT "supervision_stock_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_stock_checks"
    ADD CONSTRAINT "supervision_stock_checks_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_stock_checks"
    ADD CONSTRAINT "supervision_stock_checks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."stock_warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_assigned_supervisor_user_id_fkey" FOREIGN KEY ("assigned_supervisor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."supervision_incidents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."supervision_reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supervision_work_items"
    ADD CONSTRAINT "supervision_work_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_approval_events"
    ADD CONSTRAINT "task_approval_events_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_approval_events"
    ADD CONSTRAINT "task_approval_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_checklists_templates"
    ADD CONSTRAINT "task_checklists_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_checklists_templates"
    ADD CONSTRAINT "task_checklists_templates_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_media"
    ADD CONSTRAINT "task_media_task_report_id_fkey" FOREIGN KEY ("task_report_id") REFERENCES "public"."task_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_reports"
    ADD CONSTRAINT "task_reports_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."task_checklists_templates"("id");



ALTER TABLE ONLY "public"."task_reports"
    ADD CONSTRAINT "task_reports_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_reports"
    ADD CONSTRAINT "task_reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."tourist_budget_activation_items"
    ADD CONSTRAINT "tourist_budget_activation_items_activation_run_id_fkey" FOREIGN KEY ("activation_run_id") REFERENCES "public"."tourist_budget_activation_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_activation_items"
    ADD CONSTRAINT "tourist_budget_activation_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tourist_budget_activation_runs"
    ADD CONSTRAINT "tourist_budget_activation_runs_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budget_activation_runs"
    ADD CONSTRAINT "tourist_budget_activation_runs_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."tourist_budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_activation_runs"
    ADD CONSTRAINT "tourist_budget_activation_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budget_activation_runs"
    ADD CONSTRAINT "tourist_budget_activation_runs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."tourist_budget_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tourist_budget_documents"
    ADD CONSTRAINT "tourist_budget_documents_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."tourist_budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_documents"
    ADD CONSTRAINT "tourist_budget_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budget_documents"
    ADD CONSTRAINT "tourist_budget_documents_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."tourist_budget_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_items"
    ADD CONSTRAINT "tourist_budget_items_budget_version_id_fkey" FOREIGN KEY ("budget_version_id") REFERENCES "public"."tourist_budget_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_items"
    ADD CONSTRAINT "tourist_budget_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tourist_budget_status_history"
    ADD CONSTRAINT "tourist_budget_status_history_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."tourist_budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_status_history"
    ADD CONSTRAINT "tourist_budget_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budget_versions"
    ADD CONSTRAINT "tourist_budget_versions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."tourist_budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tourist_budget_versions"
    ADD CONSTRAINT "tourist_budget_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budget_versions"
    ADD CONSTRAINT "tourist_budget_versions_source_profile_version_id_fkey" FOREIGN KEY ("source_profile_version_id") REFERENCES "public"."budget_rate_profile_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tourist_budgets"
    ADD CONSTRAINT "tourist_budgets_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sede_access"
    ADD CONSTRAINT "user_sede_access_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "public"."sedes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sede_access"
    ADD CONSTRAINT "user_sede_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_requests"
    ADD CONSTRAINT "vacation_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."worker_absence_audit_log"
    ADD CONSTRAINT "worker_absence_audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."worker_absences"
    ADD CONSTRAINT "worker_absences_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_absences"
    ADD CONSTRAINT "worker_absences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."worker_contracts"
    ADD CONSTRAINT "worker_contracts_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_fixed_days_off"
    ADD CONSTRAINT "worker_fixed_days_off_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_fixed_days_off"
    ADD CONSTRAINT "worker_fixed_days_off_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."worker_hour_adjustments"
    ADD CONSTRAINT "worker_hour_adjustments_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_maintenance_cleanings"
    ADD CONSTRAINT "worker_maintenance_cleanings_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."worker_maintenance_cleanings"
    ADD CONSTRAINT "worker_maintenance_cleanings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admin and manager can delete staffing targets" ON "public"."staffing_targets" FOR DELETE TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager can insert into alert log" ON "public"."forecast_alerts_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager can insert staffing targets" ON "public"."staffing_targets" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager can update alert log" ON "public"."forecast_alerts_log" FOR UPDATE TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager can update staffing targets" ON "public"."staffing_targets" FOR UPDATE TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager can view alert log" ON "public"."forecast_alerts_log" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and manager full access on property_preferred_cleaners" ON "public"."property_preferred_cleaners" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin and managers can manage assignment patterns" ON "public"."assignment_patterns" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage assignment rules" ON "public"."auto_assignment_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage cleaner group assignments" ON "public"."cleaner_group_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage delivery items" ON "public"."logistics_delivery_items" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admin and managers can manage delivery stops" ON "public"."logistics_delivery_stops" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admin and managers can manage fixed days off" ON "public"."worker_fixed_days_off" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage maintenance cleanings" ON "public"."worker_maintenance_cleanings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage picklist items" ON "public"."logistics_picklist_items" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admin and managers can manage property group assignments" ON "public"."property_group_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage property groups" ON "public"."property_groups" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage recurring tasks" ON "public"."recurring_tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can manage worker absences" ON "public"."worker_absences" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can view all tracking" ON "public"."laundry_delivery_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can view assignment logs" ON "public"."auto_assignment_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can view audit log" ON "public"."worker_absence_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin and managers can view sync logs" ON "public"."hostaway_sync_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden actualizar plantillas" ON "public"."task_checklists_templates" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden crear plantillas" ON "public"."task_checklists_templates" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar alertas" ON "public"."inventory_alerts" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar categorías" ON "public"."inventory_categories" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar configuración de consumo" ON "public"."property_consumption_config" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar mapeo de amenities" ON "public"."property_amenity_inventory_mapping" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar movimientos" ON "public"."inventory_movements" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden gestionar schedules" ON "public"."hostaway_sync_schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden ver errores de sync" ON "public"."hostaway_sync_errors" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admin y managers pueden ver plantillas" ON "public"."task_checklists_templates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role", 'cleaner'::"public"."app_role"]))))));



CREATE POLICY "Admin, manager, supervisor can view hostaway reservations" ON "public"."hostaway_reservations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))));



CREATE POLICY "Admin/manager can view alert log" ON "public"."avantio_alert_log" FOR SELECT USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager can view sync log" ON "public"."employee_sync_log" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan errores Avirato" ON "public"."avirato_sync_errors" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan horarios Avirato" ON "public"."avirato_sync_schedules" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan logs Avirato" ON "public"."avirato_sync_logs" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan mapeo Avirato" ON "public"."avirato_room_mapping" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan mapeo LH" ON "public"."lh_room_mapping" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan reservas Avirato" ON "public"."avirato_reservations" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager gestionan vinculos Avirato" ON "public"."avirato_reservation_tasks" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen errores Avirato" ON "public"."avirato_sync_errors" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen logs Avirato" ON "public"."avirato_sync_logs" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen logs LH" ON "public"."lh_sync_logs" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen mapeo Avirato" ON "public"."avirato_room_mapping" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen mapeo LH" ON "public"."lh_room_mapping" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen reservas Avirato" ON "public"."avirato_reservations" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen reservas Smoobu" ON "public"."smoobu_reservations" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen vinculos Avirato" ON "public"."avirato_reservation_tasks" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen vínculos LH" ON "public"."lh_reservation_tasks" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager leen vínculos Smoobu" ON "public"."smoobu_reservation_tasks" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager manage extraordinary types" ON "public"."extraordinary_request_types" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admin/manager pueden leer reservas LH" ON "public"."lh_reservations" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can create adjustments" ON "public"."worker_hour_adjustments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can create tokens" ON "public"."report_export_tokens" FOR INSERT WITH CHECK (("public"."user_is_admin_or_manager"() AND ("auth"."uid"() = "created_by")));



CREATE POLICY "Admins and managers can delete adjustments" ON "public"."worker_hour_adjustments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can delete tokens" ON "public"."report_export_tokens" FOR DELETE USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage all cleaner availability" ON "public"."cleaner_availability" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can manage avantio_reservations" ON "public"."avantio_reservations" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage avantio_sync_errors" ON "public"."avantio_sync_errors" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage avantio_sync_logs" ON "public"."avantio_sync_logs" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage avantio_sync_schedules" ON "public"."avantio_sync_schedules" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage invitations" ON "public"."user_invitations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can manage laundry bag preparations" ON "public"."laundry_bag_preparations" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can manage manual share links" ON "public"."laundry_share_links" TO "authenticated" USING (("public"."is_laundry_route_owner"() OR (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")) AND ("auto_managed" = false)))) WITH CHECK (("public"."is_laundry_route_owner"() OR (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")) AND ("auto_managed" = false))));



CREATE POLICY "Admins and managers can update adjustments" ON "public"."worker_hour_adjustments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can update tokens" ON "public"."report_export_tokens" FOR UPDATE USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can view all adjustments" ON "public"."worker_hour_adjustments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins and managers can view all profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Admins and managers can view classic laundry route order" ON "public"."laundry_classic_route_order" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND "public"."user_has_sede_access"("auth"."uid"(), "sede_id"))));



CREATE POLICY "Admins and managers can view export logs" ON "public"."daily_report_export_logs" FOR SELECT USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can view laundry link sync runs" ON "public"."laundry_link_sync_runs" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND (("sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "sede_id")))));



CREATE POLICY "Admins and managers can view reservation logs" ON "public"."client_reservation_logs" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can view route v2 authorizations" ON "public"."laundry_route_v2_authorizations" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND (("sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "sede_id")))));



CREATE POLICY "Admins and managers can view route v2 bag snapshots" ON "public"."laundry_route_v2_bag_snapshots" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "link"
  WHERE (("link"."id" = "laundry_route_v2_bag_snapshots"."share_link_id") AND (("link"."sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "link"."sede_id"))))))));



CREATE POLICY "Admins and managers can view route v2 events" ON "public"."laundry_route_v2_events" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND (("sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "sede_id")))));



CREATE POLICY "Admins and managers can view route worker events" ON "public"."laundry_route_worker_events" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers can view share links" ON "public"."laundry_share_links" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND (("sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "sede_id")))));



CREATE POLICY "Admins and managers can view tokens" ON "public"."report_export_tokens" FOR SELECT USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers insert incidents" ON "public"."cleaning_incidents" FOR INSERT WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers manage Smoobu property mappings" ON "public"."smoobu_property_mappings" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "Admins and managers manage planning conflicts" ON "public"."planning_conflicts" TO "authenticated" USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role"))) WITH CHECK (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role")));



CREATE POLICY "Admins and managers manage planning notification batches" ON "public"."planning_notification_batches" TO "authenticated" USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role"))) WITH CHECK (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role")));



CREATE POLICY "Admins and managers manage planning run items" ON "public"."planning_run_items" TO "authenticated" USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role"))) WITH CHECK (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role")));



CREATE POLICY "Admins and managers manage planning runs" ON "public"."planning_runs" TO "authenticated" USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role"))) WITH CHECK (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role")));



CREATE POLICY "Admins and managers manage planning settings" ON "public"."planning_settings" TO "authenticated" USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role"))) WITH CHECK (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_has_role"('manager'::"public"."app_role")));



CREATE POLICY "Admins can manage all roles" ON "public"."user_roles" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins delete incident media" ON "public"."cleaning_incident_media" FOR DELETE USING ("public"."user_has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins delete incidents" ON "public"."cleaning_incidents" FOR DELETE USING ("public"."user_has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins manage incident categories" ON "public"."incident_categories" USING ("public"."user_has_role"('admin'::"public"."app_role")) WITH CHECK ("public"."user_has_role"('admin'::"public"."app_role"));



CREATE POLICY "Admins managers supervisors pueden actualizar media" ON "public"."task_media" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))));



CREATE POLICY "Admins managers supervisors pueden subir media" ON "public"."task_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))));



CREATE POLICY "Admins pueden gestionar accesos de sedes" ON "public"."user_sede_access" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins pueden gestionar todas las sedes" ON "public"."sedes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins y managers pueden eliminar media" ON "public"."task_media" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))));



CREATE POLICY "Admins/managers can view portal access logs" ON "public"."client_portal_access_logs" FOR SELECT TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "Anonymous can create logs via portal" ON "public"."client_reservation_logs" FOR INSERT TO "anon" WITH CHECK ("public"."has_active_portal_access"("client_id"));



CREATE POLICY "Anonymous can create reservations via portal" ON "public"."client_reservations" FOR INSERT TO "anon" WITH CHECK ("public"."has_active_portal_access"("client_id"));



CREATE POLICY "Anonymous can update reservations via portal" ON "public"."client_reservations" FOR UPDATE TO "anon" USING ("public"."has_active_portal_access"("client_id")) WITH CHECK ("public"."has_active_portal_access"("client_id"));



CREATE POLICY "Anonymous can view properties via client portal" ON "public"."properties" FOR SELECT TO "anon" USING ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id")));



CREATE POLICY "Anonymous can view reservations via portal" ON "public"."client_reservations" FOR SELECT TO "anon" USING ("public"."has_active_portal_access"("client_id"));



CREATE POLICY "Anonymous can view tasks via client portal" ON "public"."tasks" FOR SELECT TO "anon" USING (((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"())) AND ("tasks"."date" >= "lsl"."date_start") AND ("tasks"."date" <= "lsl"."date_end")))) OR (("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id"))));



CREATE POLICY "Authenticated users can view staffing targets" ON "public"."staffing_targets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Cleaners can insert their own time logs" ON "public"."time_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "time_logs"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cleaners can manage their own availability" ON "public"."cleaner_availability" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_availability"."cleaner_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_availability"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cleaners can manage their own data" ON "public"."cleaners" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Cleaners can update their own time logs" ON "public"."time_logs" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "time_logs"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Cleaners can view properties for their tasks" ON "public"."properties" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."cleaners" "c"
     JOIN "public"."tasks" "t" ON (("t"."cleaner_id" = "c"."id")))
  WHERE (("t"."propiedad_id" = "properties"."id") AND ((("c"."user_id" IS NOT NULL) AND ("c"."user_id" = "auth"."uid"())) OR ("c"."user_id" IS NULL))))));



CREATE POLICY "Cleaners can view their own absences" ON "public"."worker_absences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_absences"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cleaners can view their own fixed days off" ON "public"."worker_fixed_days_off" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_fixed_days_off"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cleaners can view their own maintenance cleanings" ON "public"."worker_maintenance_cleanings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_maintenance_cleanings"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Cleaners can view their own time logs" ON "public"."time_logs" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "time_logs"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Cleaners insert own incidents" ON "public"."cleaning_incidents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "cleaning_incidents"."reporter_cleaner_id")))));



CREATE POLICY "Client portal can view completed task reports" ON "public"."task_reports" FOR SELECT USING ((("overall_status" = 'completed'::"public"."report_status") AND "public"."is_task_visible_to_client_portal"("task_id")));



CREATE POLICY "Client portal can view task media of completed reports" ON "public"."task_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."task_reports" "tr"
  WHERE (("tr"."id" = "task_media"."task_report_id") AND ("tr"."overall_status" = 'completed'::"public"."report_status") AND "public"."is_task_visible_to_client_portal"("tr"."task_id")))));



CREATE POLICY "Client portal can view their tasks" ON "public"."tasks" FOR SELECT TO "authenticated", "anon" USING ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id")));



CREATE POLICY "Incident categories readable by all" ON "public"."incident_categories" FOR SELECT USING (true);



CREATE POLICY "Limpiadoras pueden subir media a sus reportes" ON "public"."task_media" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."task_reports" "tr"
     JOIN "public"."cleaners" "c" ON (("tr"."cleaner_id" = "c"."id")))
     JOIN "public"."user_roles" "ur" ON (("c"."user_id" = "ur"."user_id")))
  WHERE (("tr"."id" = "task_media"."task_report_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'cleaner'::"public"."app_role")))));



CREATE POLICY "Logistics can manage delivery items" ON "public"."logistics_delivery_items" USING ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role"));



CREATE POLICY "Logistics can manage delivery stops" ON "public"."logistics_delivery_stops" USING ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role"));



CREATE POLICY "Logistics can manage picklist items" ON "public"."logistics_picklist_items" USING ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role"));



CREATE POLICY "Logistics can view properties from assigned sedes" ON "public"."properties" FOR SELECT TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND "public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")));



CREATE POLICY "Managers can manage vacation requests from their sedes" ON "public"."vacation_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "vacation_requests"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "vacation_requests"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))))));



CREATE POLICY "Managers can view all roles" ON "public"."user_roles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")));



CREATE POLICY "Managers pueden actualizar sedes" ON "public"."sedes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'manager'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'manager'::"public"."app_role")))));



CREATE POLICY "Managers pueden gestionar accesos de sedes" ON "public"."user_sede_access" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'manager'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'manager'::"public"."app_role")))));



CREATE POLICY "Managers pueden ver y actualizar sedes" ON "public"."sedes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['manager'::"public"."app_role", 'supervisor'::"public"."app_role", 'cleaner'::"public"."app_role", 'client'::"public"."app_role", 'logistics'::"public"."app_role"]))))));



CREATE POLICY "Only admin/manager/supervisor can create tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Only admin/manager/supervisor can delete tasks" ON "public"."tasks" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Only admin/manager/supervisor can manage task assignments" ON "public"."task_assignments" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Only admins can view audit logs" ON "public"."security_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Only admins can view sede audit logs" ON "public"."sede_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Operational roles can view client reservations" ON "public"."client_reservations" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Portal anon read public incident comments" ON "public"."cleaning_incident_comments" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."cleaning_incidents" "i"
     JOIN "public"."client_portal_access" "cpa" ON (("cpa"."client_id" = "i"."client_id")))
  WHERE (("i"."id" = "cleaning_incident_comments"."incident_id") AND ("i"."visibility" = 'public'::"public"."incident_visibility") AND ("i"."status" = ANY (ARRAY['open'::"public"."incident_status", 'in_progress'::"public"."incident_status", 'resolved'::"public"."incident_status", 'discarded'::"public"."incident_status"])) AND ("cpa"."is_active" = true)))));



CREATE POLICY "Portal anon read public incident events" ON "public"."cleaning_incident_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."cleaning_incidents" "i"
     JOIN "public"."client_portal_access" "cpa" ON (("cpa"."client_id" = "i"."client_id")))
  WHERE (("i"."id" = "cleaning_incident_events"."incident_id") AND ("i"."visibility" = 'public'::"public"."incident_visibility") AND ("i"."status" = ANY (ARRAY['open'::"public"."incident_status", 'in_progress'::"public"."incident_status", 'resolved'::"public"."incident_status", 'discarded'::"public"."incident_status"])) AND ("cpa"."is_active" = true)))));



CREATE POLICY "Portal anon read public incident media" ON "public"."cleaning_incident_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."cleaning_incidents" "i"
     JOIN "public"."client_portal_access" "cpa" ON (("cpa"."client_id" = "i"."client_id")))
  WHERE (("i"."id" = "cleaning_incident_media"."incident_id") AND ("i"."visibility" = 'public'::"public"."incident_visibility") AND ("i"."status" = ANY (ARRAY['open'::"public"."incident_status", 'in_progress'::"public"."incident_status", 'resolved'::"public"."incident_status", 'discarded'::"public"."incident_status"])) AND ("cpa"."is_active" = true)))));



CREATE POLICY "Portal anon read public incidents" ON "public"."cleaning_incidents" FOR SELECT USING ((("visibility" = 'public'::"public"."incident_visibility") AND ("status" = ANY (ARRAY['open'::"public"."incident_status", 'in_progress'::"public"."incident_status", 'resolved'::"public"."incident_status", 'discarded'::"public"."incident_status"])) AND (EXISTS ( SELECT 1
   FROM "public"."client_portal_access" "cpa"
  WHERE (("cpa"."client_id" = "cleaning_incidents"."client_id") AND ("cpa"."is_active" = true))))));



CREATE POLICY "Portal users can create tasks via client portal" ON "public"."tasks" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id")));



CREATE POLICY "Portal users can delete tasks via client portal" ON "public"."tasks" FOR DELETE TO "authenticated", "anon" USING ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id")));



CREATE POLICY "Portal users can update tasks via client portal" ON "public"."tasks" FOR UPDATE TO "authenticated", "anon" USING ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id"))) WITH CHECK ((("cliente_id" IS NOT NULL) AND "public"."has_active_portal_access"("cliente_id")));



CREATE POLICY "Prevent role escalation during insertion" ON "public"."user_roles" FOR INSERT WITH CHECK (((("role" = 'admin'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role"))))) OR (("role" = 'manager'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) OR (("role" = 'supervisor'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))) OR (("role" = 'cleaner'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))));



CREATE POLICY "Public can insert tracking for active links" ON "public"."laundry_delivery_tracking" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."id" = "laundry_delivery_tracking"."share_link_id") AND ("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"()))))));



CREATE POLICY "Public can read active extraordinary types" ON "public"."extraordinary_request_types" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can read active links by token" ON "public"."laundry_share_links" FOR SELECT USING ((("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"()))));



CREATE POLICY "Public can read properties via active share links" ON "public"."properties" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."tasks" "t"
     JOIN "public"."laundry_share_links" "lsl" ON ((("t"."date" >= "lsl"."date_start") AND ("t"."date" <= "lsl"."date_end"))))
  WHERE (("t"."propiedad_id" = "properties"."id") AND ("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"()))))));



CREATE POLICY "Public can read tasks via active share links" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"())) AND ("tasks"."date" >= "lsl"."date_start") AND ("tasks"."date" <= "lsl"."date_end")))));



CREATE POLICY "Public can read tracking for active links" ON "public"."laundry_delivery_tracking" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."id" = "laundry_delivery_tracking"."share_link_id") AND ("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"()))))));



CREATE POLICY "Public can update tracking for active links" ON "public"."laundry_delivery_tracking" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."id" = "laundry_delivery_tracking"."share_link_id") AND ("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."laundry_share_links" "lsl"
  WHERE (("lsl"."id" = "laundry_delivery_tracking"."share_link_id") AND ("lsl"."is_active" = true) AND (("lsl"."expires_at" IS NULL) OR ("lsl"."expires_at" > "now"()))))));



CREATE POLICY "Public read of own client extraordinary requests" ON "public"."client_extraordinary_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."client_portal_access" "cpa"
  WHERE (("cpa"."client_id" = "client_extraordinary_requests"."client_id") AND ("cpa"."is_active" = true)))));



CREATE POLICY "Reservation logs are immutable (no deletes)" ON "public"."client_reservation_logs" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "Reservation logs are immutable (no updates)" ON "public"."client_reservation_logs" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "Route owner can manage classic laundry route order" ON "public"."laundry_classic_route_order" TO "authenticated" USING ("public"."is_laundry_route_owner"()) WITH CHECK ("public"."is_laundry_route_owner"());



CREATE POLICY "Route owner can manage delivery schedule" ON "public"."laundry_delivery_schedule" TO "authenticated" USING ("public"."is_laundry_route_owner"()) WITH CHECK ("public"."is_laundry_route_owner"());



CREATE POLICY "Service role can insert alert log" ON "public"."avantio_alert_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert portal access logs" ON "public"."client_portal_access_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Sistema puede insertar errores de sync" ON "public"."hostaway_sync_errors" FOR INSERT WITH CHECK (true);



CREATE POLICY "Solo owner IA gestiona conversaciones" ON "public"."ai_conversations" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA gestiona eventos observados" ON "public"."ai_observed_events" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA gestiona memoria" ON "public"."ai_memories" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA gestiona mensajes" ON "public"."ai_messages" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA gestiona propuestas" ON "public"."ai_action_proposals" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA gestiona sugerencias" ON "public"."ai_learning_suggestions" USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id"))) WITH CHECK (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Solo owner IA lee auditoria" ON "public"."ai_action_audit_logs" FOR SELECT USING (("public"."ai_is_allowed_user"() AND ("auth"."uid"() = "owner_user_id")));



CREATE POLICY "Staff insert incident comments" ON "public"."cleaning_incident_comments" FOR INSERT TO "authenticated" WITH CHECK ((("author_kind" = 'limpatex'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_comments"."incident_id") AND "public"."user_is_admin_or_manager"() AND ("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("i"."sede_id")))))));



CREATE POLICY "Staff insert incident events" ON "public"."cleaning_incident_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_events"."incident_id") AND ("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("i"."sede_id"))))));



CREATE POLICY "Staff insert incident media" ON "public"."cleaning_incident_media" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_media"."incident_id") AND ("public"."user_is_admin_or_manager"() OR (("i"."status" = 'pending_limpatex'::"public"."incident_status") AND (EXISTS ( SELECT 1
           FROM "public"."cleaners" "c"
          WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "i"."reporter_cleaner_id"))))))))));



CREATE POLICY "Staff manage extraordinary requests by sede" ON "public"."client_extraordinary_requests" USING (("public"."user_is_admin_or_manager"() OR "public"."user_can_access_task"("sede_id"))) WITH CHECK (("public"."user_is_admin_or_manager"() OR "public"."user_can_access_task"("sede_id")));



CREATE POLICY "Staff read incident comments" ON "public"."cleaning_incident_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_comments"."incident_id") AND ("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("i"."sede_id"))))));



CREATE POLICY "Staff read incident events" ON "public"."cleaning_incident_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_events"."incident_id") AND ("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("i"."sede_id"))))));



CREATE POLICY "Staff read incident media" ON "public"."cleaning_incident_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaning_incidents" "i"
  WHERE (("i"."id" = "cleaning_incident_media"."incident_id") AND ("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("i"."sede_id"))))));



CREATE POLICY "Staff read incidents in accessible sede" ON "public"."cleaning_incidents" FOR SELECT USING (("public"."user_has_role"('admin'::"public"."app_role") OR "public"."user_can_access_task"("sede_id")));



CREATE POLICY "Staff update incidents" ON "public"."cleaning_incidents" FOR UPDATE USING (("public"."user_is_admin_or_manager"() OR (("status" = 'pending_limpatex'::"public"."incident_status") AND (EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "cleaning_incidents"."reporter_cleaner_id"))))))) WITH CHECK (("public"."user_is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "cleaning_incidents"."reporter_cleaner_id"))))));



CREATE POLICY "Supervisores pueden ver alertas" ON "public"."inventory_alerts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisores pueden ver mapeo de amenities" ON "public"."property_amenity_inventory_mapping" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisores pueden ver movimientos" ON "public"."inventory_movements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisors can read property_preferred_cleaners" ON "public"."property_preferred_cleaners" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role"));



CREATE POLICY "Supervisors can view all cleaner availability" ON "public"."cleaner_availability" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisors can view cleaners from assigned sedes" ON "public"."cleaners" FOR SELECT TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role"))))));



CREATE POLICY "Supervisors can view contracts" ON "public"."worker_contracts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_contracts"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role"))))))));



CREATE POLICY "Supervisors can view deliveries from assigned sedes" ON "public"."logistics_deliveries" FOR SELECT TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Supervisors can view delivery items" ON "public"."logistics_delivery_items" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role"));



CREATE POLICY "Supervisors can view delivery stops" ON "public"."logistics_delivery_stops" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role"));



CREATE POLICY "Supervisors can view fixed days off" ON "public"."worker_fixed_days_off" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisors can view maintenance cleanings" ON "public"."worker_maintenance_cleanings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisors can view picklist items" ON "public"."logistics_picklist_items" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role"));



CREATE POLICY "Supervisors can view picklists from assigned sedes" ON "public"."logistics_picklists" FOR SELECT TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")));



CREATE POLICY "Supervisors can view recurring tasks" ON "public"."recurring_tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "Supervisors can view stock from assigned sedes" ON "public"."inventory_stock" FOR SELECT TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role"))))));



CREATE POLICY "Supervisors can view vacation requests" ON "public"."vacation_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "vacation_requests"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role"))))))));



CREATE POLICY "Supervisors can view worker absences" ON "public"."worker_absences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'supervisor'::"public"."app_role")))));



CREATE POLICY "System can delete hostaway reservations" ON "public"."hostaway_reservations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "System can insert assignment logs" ON "public"."auto_assignment_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert audit log" ON "public"."worker_absence_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert audit logs" ON "public"."security_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert hostaway reservations" ON "public"."hostaway_reservations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert invitations" ON "public"."user_invitations" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "System can insert sede audit logs" ON "public"."sede_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert sync logs" ON "public"."hostaway_sync_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can manage rate limits" ON "public"."security_rate_limits" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "System can update hostaway reservations" ON "public"."hostaway_reservations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can access clients from their assigned sedes" ON "public"."clients" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Users can access properties from their assigned sedes" ON "public"."properties" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Users can create client portal access" ON "public"."client_portal_access" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create logs" ON "public"."client_reservation_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create reservations" ON "public"."client_reservations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can create their own subscription" ON "public"."forecast_subscribers" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."user_is_admin_or_manager"()));



CREATE POLICY "Users can delete client portal access" ON "public"."client_portal_access" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete executions for their accessible sedes" ON "public"."recurring_task_executions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_tasks" "rt"
  WHERE (("rt"."id" = "recurring_task_executions"."recurring_task_id") AND ("rt"."sede_id" = ANY ("public"."get_user_accessible_sedes"()))))));



CREATE POLICY "Users can delete reservations" ON "public"."client_reservations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Users can delete their own subscription" ON "public"."forecast_subscribers" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_admin_or_manager"()));



CREATE POLICY "Users can insert executions for their accessible sedes" ON "public"."recurring_task_executions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."recurring_tasks" "rt"
  WHERE (("rt"."id" = "recurring_task_executions"."recurring_task_id") AND ("rt"."sede_id" = ANY ("public"."get_user_accessible_sedes"()))))));



CREATE POLICY "Users can manage cleaners from their assigned sedes" ON "public"."cleaners" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))));



CREATE POLICY "Users can manage contracts from their assigned sedes" ON "public"."worker_contracts" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_contracts"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "worker_contracts"."cleaner_id") AND ("c"."sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))))));



CREATE POLICY "Users can manage deliveries from their assigned sedes" ON "public"."logistics_deliveries" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role"))));



CREATE POLICY "Users can manage picklists from their assigned sedes" ON "public"."logistics_picklists" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role")))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'logistics'::"public"."app_role"))));



CREATE POLICY "Users can manage products from their assigned sedes" ON "public"."inventory_products" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))));



CREATE POLICY "Users can manage stock from their assigned sedes" ON "public"."inventory_stock" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))));



CREATE POLICY "Users can manage tasks from their assigned sedes" ON "public"."tasks" TO "authenticated" USING ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))))) WITH CHECK ((("sede_id" = ANY ("public"."get_user_accessible_sedes"())) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Users can manage work schedules based on role" ON "public"."cleaner_work_schedule" USING (((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_work_schedule"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_work_schedule"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])))))));



CREATE POLICY "Users can update client portal access" ON "public"."client_portal_access" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update executions for their accessible sedes" ON "public"."recurring_task_executions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_tasks" "rt"
  WHERE (("rt"."id" = "recurring_task_executions"."recurring_task_id") AND ("rt"."sede_id" = ANY ("public"."get_user_accessible_sedes"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."recurring_tasks" "rt"
  WHERE (("rt"."id" = "recurring_task_executions"."recurring_task_id") AND ("rt"."sede_id" = ANY ("public"."get_user_accessible_sedes"()))))));



CREATE POLICY "Users can update reservations" ON "public"."client_reservations" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Users can update tasks based on role" ON "public"."tasks" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'cleaner'::"public"."app_role") AND (("cleaner_id" IN ( SELECT "cleaners"."id"
   FROM "public"."cleaners"
  WHERE ("cleaners"."user_id" = "auth"."uid"()))) OR ("id" IN ( SELECT "ta"."task_id"
   FROM ("public"."task_assignments" "ta"
     JOIN "public"."cleaners" "c" ON (("ta"."cleaner_id" = "c"."id")))
  WHERE ("c"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own subscription" ON "public"."forecast_subscribers" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_admin_or_manager"()));



CREATE POLICY "Users can view client portal access" ON "public"."client_portal_access" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view delivery schedule for their sede" ON "public"."laundry_delivery_schedule" FOR SELECT USING ((("sede_id" IS NULL) OR "public"."user_has_sede_access"("auth"."uid"(), "sede_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role"])))))));



CREATE POLICY "Users can view executions for their accessible sedes" ON "public"."recurring_task_executions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_tasks" "rt"
  WHERE (("rt"."id" = "recurring_task_executions"."recurring_task_id") AND ("rt"."sede_id" = ANY ("public"."get_user_accessible_sedes"()))))));



CREATE POLICY "Users can view task assignments based on role" ON "public"."task_assignments" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'cleaner'::"public"."app_role") AND ("cleaner_id" IN ( SELECT "cleaners"."id"
   FROM "public"."cleaners"
  WHERE ("cleaners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view tasks based on role" ON "public"."tasks" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'cleaner'::"public"."app_role") AND (("cleaner_id" IN ( SELECT "cleaners"."id"
   FROM "public"."cleaners"
  WHERE ("cleaners"."user_id" = "auth"."uid"()))) OR ("id" IN ( SELECT "ta"."task_id"
   FROM ("public"."task_assignments" "ta"
     JOIN "public"."cleaners" "c" ON (("ta"."cleaner_id" = "c"."id")))
  WHERE ("c"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own subscription" ON "public"."forecast_subscribers" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."user_is_admin_or_manager"()));



CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones de checkli" ON "public"."property_checklist_assignments" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Usuarios autenticados pueden crear asignaciones de checklist" ON "public"."property_checklist_assignments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden ver asignaciones de checklist" ON "public"."property_checklist_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios autorizados pueden actualizar reportes" ON "public"."task_reports" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "task_reports"."cleaner_id"))))));



CREATE POLICY "Usuarios autorizados pueden crear reportes" ON "public"."task_reports" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."id" = "task_reports"."cleaner_id"))))));



CREATE POLICY "Usuarios pueden ver media de reportes accesibles" ON "public"."task_media" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."task_reports" "tr"
     JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "auth"."uid"())))
  WHERE (("tr"."id" = "task_media"."task_report_id") AND (("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])) OR (("ur"."role" = 'cleaner'::"public"."app_role") AND ("tr"."cleaner_id" IN ( SELECT "cleaners"."id"
           FROM "public"."cleaners"
          WHERE ("cleaners"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Usuarios pueden ver reportes relacionados" ON "public"."task_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = ANY (ARRAY['admin'::"public"."app_role", 'manager'::"public"."app_role", 'supervisor'::"public"."app_role"])) OR (("ur"."role" = 'cleaner'::"public"."app_role") AND ("task_reports"."cleaner_id" IN ( SELECT "cleaners"."id"
           FROM "public"."cleaners"
          WHERE ("cleaners"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Usuarios pueden ver sus propios accesos" ON "public"."user_sede_access" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Workers can manage their own vacation requests" ON "public"."vacation_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "vacation_requests"."cleaner_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "vacation_requests"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_action_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_action_proposals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_learning_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_observed_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignment_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auto_assignment_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auto_assignment_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avantio_alert_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avantio_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avantio_sync_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avantio_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avantio_sync_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_reservation_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_room_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_sync_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avirato_sync_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_task_creation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."batch_task_email_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_rate_profile_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_rate_profile_versions_admin_all" ON "public"."budget_rate_profile_versions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."budget_rate_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_rate_profiles_admin_all" ON "public"."budget_rate_profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."cleaner_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaner_group_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaner_work_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_incident_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_incident_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_incident_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cleaning_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_extraordinary_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_portal_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_portal_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_reservation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_report_export_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."extraordinary_request_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forecast_alerts_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forecast_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hostaway_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hostaway_sync_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hostaway_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hostaway_sync_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incident_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_bag_preparations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_classic_route_order" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_delivery_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_delivery_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_dirty_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "laundry_dirty_movements_admin_manager_read" ON "public"."laundry_dirty_movements" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



ALTER TABLE "public"."laundry_dirty_stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "laundry_dirty_stock_admin_manager_all" ON "public"."laundry_dirty_stock" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



ALTER TABLE "public"."laundry_link_sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_access_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_v2_authorizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_v2_bag_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_v2_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_worker_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_route_workers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."laundry_share_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lh_reservation_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lh_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lh_room_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lh_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_delivery_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_delivery_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_picklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logistics_picklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_delivery_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_events_admin_manager_insert" ON "public"."notification_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND ("sede_id" IS NOT NULL) AND "public"."user_has_sede_access"("auth"."uid"(), "sede_id") AND (EXISTS ( SELECT 1
   FROM "public"."tasks" "task"
  WHERE (("task"."id" = "notification_events"."task_id") AND ("task"."sede_id" = "notification_events"."sede_id")))) AND (("cleaner_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."cleaners" "cleaner"
  WHERE (("cleaner"."id" = "notification_events"."cleaner_id") AND ("cleaner"."sede_id" = "notification_events"."sede_id"))))))));



CREATE POLICY "notification_events_admin_manager_read" ON "public"."notification_events" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR ("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AND ("sede_id" IS NOT NULL) AND "public"."user_has_sede_access"("auth"."uid"(), "sede_id") AND (EXISTS ( SELECT 1
   FROM "public"."tasks" "task"
  WHERE (("task"."id" = "notification_events"."task_id") AND ("task"."sede_id" = "notification_events"."sede_id")))) AND (("cleaner_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."cleaners" "cleaner"
  WHERE (("cleaner"."id" = "notification_events"."cleaner_id") AND ("cleaner"."sede_id" = "notification_events"."sede_id"))))))));



ALTER TABLE "public"."notification_send_reconciliation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_apply_batch_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planning_apply_batch_items_read_scope" ON "public"."planning_apply_batch_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."planning_apply_batches" "b"
  WHERE (("b"."id" = "planning_apply_batch_items"."batch_id") AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")) AND "public"."user_has_sede_access"("auth"."uid"(), "b"."sede_id")))));



ALTER TABLE "public"."planning_apply_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planning_apply_batches_read_scope" ON "public"."planning_apply_batches" FOR SELECT TO "authenticated" USING ((("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")) AND "public"."user_has_sede_access"("auth"."uid"(), "sede_id")));



ALTER TABLE "public"."planning_assignment_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planning_assignment_audit_read_scope" ON "public"."planning_assignment_audit" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."planning_apply_batches" "b"
  WHERE (("b"."id" = "planning_assignment_audit"."batch_id") AND ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role")) AND "public"."user_has_sede_access"("auth"."uid"(), "b"."sede_id")))));



ALTER TABLE "public"."planning_conflicts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_notification_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_run_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planning_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_amenity_inventory_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_checklist_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_consumption_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_group_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_preferred_cleaners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_storage_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_storage_access_select_scoped" ON "public"."property_storage_access" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR "public"."supervision_user_has_building_assignment"("property_group_id", "auth"."uid"(), CURRENT_DATE)));



ALTER TABLE "public"."recurring_task_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_export_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sede_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sedes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smoobu_property_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smoobu_reservation_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."smoobu_reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staffing_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_alerts_admin_manager_all" ON "public"."stock_alerts" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_alerts_supervisor_read" ON "public"."stock_alerts" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") AS "has_role"));



ALTER TABLE "public"."stock_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_categories_admin_manager_all" ON "public"."stock_categories" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_categories_supervisor_read_scoped" ON "public"."stock_categories" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM ("public"."stock_products" "p"
     JOIN "public"."stock_levels" "l" ON (("l"."product_id" = "p"."id")))
  WHERE (("p"."category_id" = "stock_categories"."id") AND "public"."supervision_stock_warehouse_can_access"("l"."warehouse_id"))))));



CREATE POLICY "stock_consumption_rules_admin_manager_all" ON "public"."stock_property_consumption_rules" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_consumption_rules_supervisor_read" ON "public"."stock_property_consumption_rules" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") AS "has_role"));



CREATE POLICY "stock_field_mappings_admin_manager_all" ON "public"."stock_property_field_mappings" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_field_mappings_supervisor_read" ON "public"."stock_property_field_mappings" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") AS "has_role"));



ALTER TABLE "public"."stock_levels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_levels_admin_manager_all" ON "public"."stock_levels" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_levels_supervisor_read_scoped" ON "public"."stock_levels" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR "public"."supervision_stock_warehouse_can_access"("warehouse_id")));



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_movements_admin_manager_all" ON "public"."stock_movements" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_movements_supervisor_read" ON "public"."stock_movements" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") AS "has_role"));



ALTER TABLE "public"."stock_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_products_admin_manager_all" ON "public"."stock_products" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_products_supervisor_read_scoped" ON "public"."stock_products" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."stock_levels" "l"
  WHERE (("l"."product_id" = "stock_products"."id") AND "public"."supervision_stock_warehouse_can_access"("l"."warehouse_id"))))));



ALTER TABLE "public"."stock_property_consumption_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_property_field_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_sede_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_sede_settings_admin_manager_all" ON "public"."stock_sede_settings" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_sede_settings_supervisor_read" ON "public"."stock_sede_settings" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role") AS "has_role"));



ALTER TABLE "public"."stock_warehouses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_warehouses_admin_manager_all" ON "public"."stock_warehouses" TO "authenticated" USING ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role"))) WITH CHECK ((( SELECT "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") AS "has_role") OR ( SELECT "public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") AS "has_role")));



CREATE POLICY "stock_warehouses_supervisor_read_scoped" ON "public"."stock_warehouses" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR "public"."supervision_stock_warehouse_can_access"("id")));



ALTER TABLE "public"."supervision_building_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_building_policies_select" ON "public"."supervision_building_policies" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR "public"."supervision_user_has_building_assignment"("property_group_id", "auth"."uid"(), CURRENT_DATE)));



CREATE POLICY "supervision_building_policies_write" ON "public"."supervision_building_policies" TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



ALTER TABLE "public"."supervision_building_supervisors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_building_supervisors_delete" ON "public"."supervision_building_supervisors" FOR DELETE TO "authenticated" USING ("public"."user_is_admin_or_manager"());



CREATE POLICY "supervision_building_supervisors_insert" ON "public"."supervision_building_supervisors" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_is_admin_or_manager"());



CREATE POLICY "supervision_building_supervisors_select" ON "public"."supervision_building_supervisors" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR (("supervisor_user_id" = "auth"."uid"()) AND "is_active" AND (("starts_on" IS NULL) OR ("starts_on" <= CURRENT_DATE)) AND (("ends_on" IS NULL) OR ("ends_on" >= CURRENT_DATE)))));



CREATE POLICY "supervision_building_supervisors_update" ON "public"."supervision_building_supervisors" FOR UPDATE TO "authenticated" USING ("public"."user_is_admin_or_manager"()) WITH CHECK ("public"."user_is_admin_or_manager"());



ALTER TABLE "public"."supervision_daily_report_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supervision_daily_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_daily_reports_select" ON "public"."supervision_daily_reports" FOR SELECT TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id"));



ALTER TABLE "public"."supervision_incident_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_incident_events_insert" ON "public"."supervision_incident_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_incidents" "i"
  WHERE (("i"."id" = "supervision_incident_events"."incident_id") AND "public"."supervision_user_can_access_sede"("i"."sede_id")))));



CREATE POLICY "supervision_incident_events_select" ON "public"."supervision_incident_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_incidents" "i"
  WHERE (("i"."id" = "supervision_incident_events"."incident_id") AND "public"."supervision_user_can_access_sede"("i"."sede_id")))));



ALTER TABLE "public"."supervision_incidents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_incidents_delete" ON "public"."supervision_incidents" FOR DELETE TO "authenticated" USING ("public"."supervision_user_can_delete_sede"("sede_id"));



CREATE POLICY "supervision_incidents_insert" ON "public"."supervision_incidents" FOR INSERT TO "authenticated" WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_incidents_select" ON "public"."supervision_incidents" FOR SELECT TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_incidents_update" ON "public"."supervision_incidents" FOR UPDATE TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id")) WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_property_group_assignments_select_assigned" ON "public"."property_group_assignments" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."supervision_building_supervisors" "a"
  WHERE (("a"."property_group_id" = "property_group_assignments"."property_group_id") AND ("a"."supervisor_user_id" = "auth"."uid"()) AND "a"."is_active" AND (("a"."starts_on" IS NULL) OR ("a"."starts_on" <= CURRENT_DATE)) AND (("a"."ends_on" IS NULL) OR ("a"."ends_on" >= CURRENT_DATE)))))));



CREATE POLICY "supervision_property_groups_select_assigned" ON "public"."property_groups" FOR SELECT TO "authenticated" USING (("public"."user_is_admin_or_manager"() OR ("is_active" AND (EXISTS ( SELECT 1
   FROM "public"."supervision_building_supervisors" "a"
  WHERE (("a"."property_group_id" = "property_groups"."id") AND ("a"."supervisor_user_id" = "auth"."uid"()) AND "a"."is_active" AND (("a"."starts_on" IS NULL) OR ("a"."starts_on" <= CURRENT_DATE)) AND (("a"."ends_on" IS NULL) OR ("a"."ends_on" >= CURRENT_DATE))))))));



ALTER TABLE "public"."supervision_reservation_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_reservations_insert" ON "public"."supervision_reservation_snapshots" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supervision_route_stops" "s"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."id" = "supervision_reservation_snapshots"."route_stop_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_reservations_select" ON "public"."supervision_reservation_snapshots" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supervision_route_stops" "s"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."id" = "supervision_reservation_snapshots"."route_stop_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_reservations_update" ON "public"."supervision_reservation_snapshots" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supervision_route_stops" "s"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."id" = "supervision_reservation_snapshots"."route_stop_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supervision_route_stops" "s"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "s"."route_id")))
  WHERE (("s"."id" = "supervision_reservation_snapshots"."route_stop_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



ALTER TABLE "public"."supervision_review_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_review_events_insert" ON "public"."supervision_review_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."supervision_reviews" "v"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "v"."route_id")))
  WHERE (("v"."id" = "supervision_review_events"."review_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_review_events_select" ON "public"."supervision_review_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."supervision_reviews" "v"
     JOIN "public"."supervision_routes" "r" ON (("r"."id" = "v"."route_id")))
  WHERE (("v"."id" = "supervision_review_events"."review_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



ALTER TABLE "public"."supervision_review_media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_review_media_insert" ON "public"."supervision_review_media" FOR INSERT TO "authenticated" WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_review_media_select" ON "public"."supervision_review_media" FOR SELECT TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_review_media_update" ON "public"."supervision_review_media" FOR UPDATE TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id")) WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



ALTER TABLE "public"."supervision_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_reviews_delete" ON "public"."supervision_reviews" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_reviews"."route_id") AND "public"."supervision_user_can_delete_sede"("r"."sede_id")))));



CREATE POLICY "supervision_reviews_insert" ON "public"."supervision_reviews" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_reviews"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_reviews_select" ON "public"."supervision_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_reviews"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_reviews_update" ON "public"."supervision_reviews" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_reviews"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_reviews"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



ALTER TABLE "public"."supervision_route_stops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supervision_routes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_routes_delete" ON "public"."supervision_routes" FOR DELETE TO "authenticated" USING ("public"."supervision_user_can_delete_sede"("sede_id"));



CREATE POLICY "supervision_routes_insert" ON "public"."supervision_routes" FOR INSERT TO "authenticated" WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_routes_select" ON "public"."supervision_routes" FOR SELECT TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id"));



CREATE POLICY "supervision_routes_update" ON "public"."supervision_routes" FOR UPDATE TO "authenticated" USING ("public"."supervision_user_can_access_sede"("sede_id")) WITH CHECK ("public"."supervision_user_can_access_sede"("sede_id"));



ALTER TABLE "public"."supervision_stock_check_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_stock_check_lines_insert" ON "public"."supervision_stock_check_lines" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_stock_checks" "c"
  WHERE (("c"."id" = "supervision_stock_check_lines"."check_id") AND "public"."supervision_stock_warehouse_can_access"("c"."warehouse_id")))));



CREATE POLICY "supervision_stock_check_lines_select" ON "public"."supervision_stock_check_lines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_stock_checks" "c"
  WHERE (("c"."id" = "supervision_stock_check_lines"."check_id") AND "public"."supervision_stock_warehouse_can_access"("c"."warehouse_id")))));



CREATE POLICY "supervision_stock_check_lines_update" ON "public"."supervision_stock_check_lines" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_stock_checks" "c"
  WHERE (("c"."id" = "supervision_stock_check_lines"."check_id") AND "public"."supervision_stock_warehouse_can_access"("c"."warehouse_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_stock_checks" "c"
  WHERE (("c"."id" = "supervision_stock_check_lines"."check_id") AND "public"."supervision_stock_warehouse_can_access"("c"."warehouse_id")))));



ALTER TABLE "public"."supervision_stock_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_stock_checks_insert" ON "public"."supervision_stock_checks" FOR INSERT TO "authenticated" WITH CHECK ("public"."supervision_stock_warehouse_can_access"("warehouse_id"));



CREATE POLICY "supervision_stock_checks_select" ON "public"."supervision_stock_checks" FOR SELECT TO "authenticated" USING ("public"."supervision_stock_warehouse_can_access"("warehouse_id"));



CREATE POLICY "supervision_stock_checks_update" ON "public"."supervision_stock_checks" FOR UPDATE TO "authenticated" USING ("public"."supervision_stock_warehouse_can_access"("warehouse_id")) WITH CHECK ("public"."supervision_stock_warehouse_can_access"("warehouse_id"));



CREATE POLICY "supervision_stops_delete" ON "public"."supervision_route_stops" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_route_stops"."route_id") AND "public"."supervision_user_can_delete_sede"("r"."sede_id")))));



CREATE POLICY "supervision_stops_insert" ON "public"."supervision_route_stops" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_route_stops"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_stops_select" ON "public"."supervision_route_stops" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_route_stops"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



CREATE POLICY "supervision_stops_update" ON "public"."supervision_route_stops" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_route_stops"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."supervision_routes" "r"
  WHERE (("r"."id" = "supervision_route_stops"."route_id") AND "public"."supervision_user_can_access_sede"("r"."sede_id")))));



ALTER TABLE "public"."supervision_work_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supervision_work_items_select" ON "public"."supervision_work_items" FOR SELECT TO "authenticated" USING ("public"."supervision_work_item_can_access"("property_group_id", "scheduled_date"));



ALTER TABLE "public"."task_approval_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_approval_events_admin_read" ON "public"."task_approval_events" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "task_approval_events_sede_read" ON "public"."task_approval_events" FOR SELECT TO "authenticated" USING ((("public"."has_role"("auth"."uid"(), 'manager'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'supervisor'::"public"."app_role")) AND (EXISTS ( SELECT 1
   FROM "public"."tasks" "task"
  WHERE (("task"."id" = "task_approval_events"."task_id") AND ("task"."sede_id" IS NOT NULL) AND "public"."user_has_sede_access"("auth"."uid"(), "task"."sede_id"))))));



ALTER TABLE "public"."task_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_checklists_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tourist_budget_activation_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_activation_items_admin_all" ON "public"."tourist_budget_activation_items" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budget_activation_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_activation_runs_admin_all" ON "public"."tourist_budget_activation_runs" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budget_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_documents_admin_all" ON "public"."tourist_budget_documents" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budget_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_items_admin_all" ON "public"."tourist_budget_items" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budget_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_status_history_admin_all" ON "public"."tourist_budget_status_history" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budget_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budget_versions_admin_all" ON "public"."tourist_budget_versions" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."tourist_budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tourist_budgets_admin_all" ON "public"."tourist_budgets" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sede_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vacation_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_webhook_inbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_absence_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_absences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_fixed_days_off" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_hour_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_maintenance_cleanings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON TYPE "public"."stock_alert_type" TO "anon";
GRANT ALL ON TYPE "public"."stock_alert_type" TO "authenticated";
GRANT ALL ON TYPE "public"."stock_alert_type" TO "service_role";



GRANT ALL ON TYPE "public"."stock_item_kind" TO "anon";
GRANT ALL ON TYPE "public"."stock_item_kind" TO "authenticated";
GRANT ALL ON TYPE "public"."stock_item_kind" TO "service_role";



GRANT ALL ON TYPE "public"."stock_movement_type" TO "anon";
GRANT ALL ON TYPE "public"."stock_movement_type" TO "authenticated";
GRANT ALL ON TYPE "public"."stock_movement_type" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text", "input_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text", "input_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text", "input_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."activate_tourist_budget"("p_budget_id" "uuid", "p_version_id" "uuid", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_tourist_budget"("p_budget_id" "uuid", "p_version_id" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_tourist_budget"("p_budget_id" "uuid", "p_version_id" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."laundry_dirty_stock" TO "anon";
GRANT ALL ON TABLE "public"."laundry_dirty_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_dirty_stock" TO "service_role";



REVOKE ALL ON FUNCTION "public"."adjust_laundry_dirty_stock"("product_id_param" "uuid", "warehouse_id_param" "uuid", "movement_type_param" "text", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adjust_laundry_dirty_stock"("product_id_param" "uuid", "warehouse_id_param" "uuid", "movement_type_param" "text", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adjust_laundry_dirty_stock"("product_id_param" "uuid", "warehouse_id_param" "uuid", "movement_type_param" "text", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_is_allowed_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."ai_is_allowed_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_is_allowed_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_ai_actions_transactional"("_proposal_id" "uuid", "_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_ai_actions_transactional"("_proposal_id" "uuid", "_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_planning_batch"("_batch_id" "uuid", "_idempotency_key" "text", "_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_request_hash" "text", "_notification_policy" "text", "_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_smoobu_reservation"("_external_id" "text", "_property_name" "text", "_property_id" "uuid", "_cliente_id" "uuid", "_check_in" "date", "_check_out" "date", "_status" "text", "_guest_name" "text", "_synced_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_smoobu_reservation"("_external_id" "text", "_property_name" "text", "_property_id" "uuid", "_cliente_id" "uuid", "_check_in" "date", "_check_out" "date", "_status" "text", "_guest_name" "text", "_synced_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_whatsapp_approval_response"("_whatsapp_message_id" "text", "_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_occurred_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_whatsapp_approval_response"("_whatsapp_message_id" "text", "_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_occurred_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_whatsapp_delivery_status"("_provider_message_id" "text", "_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_whatsapp_delivery_status"("_provider_message_id" "text", "_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_assign_task_transactional"("_task_id" "uuid", "_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."batch_create_tasks_transactional"("_actor_id" "uuid", "_sede_id" "uuid", "_tasks" "jsonb", "_idempotency_key" "text", "_payload_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."batch_create_tasks_transactional"("_actor_id" "uuid", "_sede_id" "uuid", "_tasks" "jsonb", "_idempotency_key" "text", "_payload_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_supervision_stock_check"("_warehouse_id" "uuid", "_property_group_id" "uuid", "_scheduled_date" "date", "_check_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_supervision_stock_check"("_warehouse_id" "uuid", "_property_group_id" "uuid", "_scheduled_date" "date", "_check_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."begin_supervision_stock_check"("_warehouse_id" "uuid", "_property_group_id" "uuid", "_scheduled_date" "date", "_check_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_whatsapp_send_attempt"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_attempt_token" "uuid", "_provider_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_whatsapp_send_attempt"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_attempt_token" "uuid", "_provider_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."begin_whatsapp_send_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_provider_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."begin_whatsapp_send_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_provider_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bind_whatsapp_delivery_from_button"("_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_whatsapp_delivery_from_button"("_source_provider_message_id" "text", "_sender" "text", "_button_payload" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bind_whatsapp_delivery_from_status"("_provider_message_id" "text", "_recipient" "text", "_occurred_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_whatsapp_delivery_from_status"("_provider_message_id" "text", "_recipient" "text", "_occurred_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_recurring_task_state_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_recurring_task_state_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_recurring_task_state_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_task_planning_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_task_planning_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_task_planning_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("check_identifier" "text", "check_action_type" "text", "max_attempts" integer, "window_minutes" integer, "block_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("check_identifier" "text", "check_action_type" "text", "max_attempts" integer, "window_minutes" integer, "block_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("check_identifier" "text", "check_action_type" "text", "max_attempts" integer, "window_minutes" integer, "block_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_bounded_whatsapp_retry"("_event_id" "uuid", "_lease_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_bounded_whatsapp_retry"("_event_id" "uuid", "_lease_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_notification_send_reconciliation_actions"("_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_notification_send_reconciliation_actions"("_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_supervision_daily_report"("_report_date" "date", "_email_to" "text", "_route_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_supervision_daily_report"("_report_date" "date", "_email_to" "text", "_route_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_whatsapp_admin_fallback"("_notification_event_id" "uuid", "_recipient" "text", "_trigger_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_whatsapp_admin_fallback"("_notification_event_id" "uuid", "_recipient" "text", "_trigger_error" "text") TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_webhook_inbox" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_whatsapp_webhook_callbacks"("_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_whatsapp_webhook_callbacks"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."client_add_incident_comment"("_incident_id" "uuid", "_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."client_add_incident_comment"("_incident_id" "uuid", "_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."client_add_incident_comment"("_incident_id" "uuid", "_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."client_update_incident_status"("_incident_id" "uuid", "_to_status" "text", "_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."client_update_incident_status"("_incident_id" "uuid", "_to_status" "text", "_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."client_update_incident_status"("_incident_id" "uuid", "_to_status" "text", "_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_stale_avantio_syncs"() TO "anon";
GRANT ALL ON FUNCTION "public"."close_stale_avantio_syncs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_stale_avantio_syncs"() TO "service_role";



GRANT ALL ON TABLE "public"."supervision_stock_checks" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."supervision_stock_checks" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."complete_supervision_stock_check"("_check_id" "uuid", "_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_supervision_stock_check"("_check_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_supervision_stock_check"("_check_id" "uuid", "_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."configure_laundry_classic_cron"("p_service_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."configure_laundry_classic_cron"("p_service_role_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."configure_laundry_route_v2_cron"("p_service_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."configure_laundry_route_v2_cron"("p_service_role_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."configure_supervision_report_cron"("p_service_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."configure_supervision_report_cron"("p_service_role_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."configure_whatsapp_notification_cron"("p_service_role_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."configure_whatsapp_notification_cron"("p_service_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_stock_alert_if_needed"("stock_level_id_param" "uuid", "product_id_param" "uuid", "warehouse_id_param" "uuid", "alert_type_param" "public"."stock_alert_type") TO "anon";
GRANT ALL ON FUNCTION "public"."create_stock_alert_if_needed"("stock_level_id_param" "uuid", "product_id_param" "uuid", "warehouse_id_param" "uuid", "alert_type_param" "public"."stock_alert_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_stock_alert_if_needed"("stock_level_id_param" "uuid", "product_id_param" "uuid", "warehouse_id_param" "uuid", "alert_type_param" "public"."stock_alert_type") TO "service_role";



GRANT ALL ON TABLE "public"."stock_warehouses" TO "anon";
GRANT ALL ON TABLE "public"."stock_warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_warehouses" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_stock_warehouse"("sede_id_param" "uuid", "name_param" "text", "address_param" "text", "is_default_param" boolean, "sort_order_param" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_stock_warehouse"("sede_id_param" "uuid", "name_param" "text", "address_param" "text", "is_default_param" boolean, "sort_order_param" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_stock_warehouse"("sede_id_param" "uuid", "name_param" "text", "address_param" "text", "is_default_param" boolean, "sort_order_param" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_tourist_budget"("p_sede_id" "uuid", "p_client_id" "uuid", "p_title" "text", "p_prospect_name" "text", "p_validity_date" "date", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_commercial_notes" "text", "p_internal_notes" "text", "p_terms" "text", "p_source_profile_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tourist_budget"("p_sede_id" "uuid", "p_client_id" "uuid", "p_title" "text", "p_prospect_name" "text", "p_validity_date" "date", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_commercial_notes" "text", "p_internal_notes" "text", "p_terms" "text", "p_source_profile_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tourist_budget"("p_sede_id" "uuid", "p_client_id" "uuid", "p_title" "text", "p_prospect_name" "text", "p_validity_date" "date", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_commercial_notes" "text", "p_internal_notes" "text", "p_terms" "text", "p_source_profile_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "expires_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "expires_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "expires_hours" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "invite_sede_id" "uuid", "expires_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "invite_sede_id" "uuid", "expires_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_invitation_secure"("invite_email" "text", "invite_role" "text", "invite_sede_id" "uuid", "expires_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_planning_batch_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_planning_batch_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_cleaner_with_future_assignments"("_cleaner_id" "uuid", "_unassign_future_tasks" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_avantio_cron_job"("job_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_avantio_cron_job"("job_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_avantio_cron_job"("job_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_avirato_cron_job"("job_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_avirato_cron_job"("job_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_avirato_cron_job"("job_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_hostaway_cron_job"("job_name" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."dismiss_notification_send_reconciliation"("_delivery_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dismiss_notification_send_reconciliation"("_delivery_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dismiss_notification_send_reconciliation"("_delivery_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_notification_event_delivery_mode"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_notification_event_delivery_mode"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_notification_event_delivery_mode"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_notification_event_scope"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_notification_event_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_notification_event_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_notification_event_scope"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_deleted_cleaner_cancellations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_deleted_cleaner_cancellations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_deleted_task_cancellations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_deleted_task_cancellations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_task_assignment_notification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_task_assignment_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_task_modified_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_task_modified_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_uncertain_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_uncertain_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid", "_provider_message_id" "text", "_uncertain" boolean, "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_admin_fallback_send"("_delivery_id" "uuid", "_notification_event_id" "uuid", "_claim_token" "uuid", "_provider_message_id" "text", "_uncertain" boolean, "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_non_delivery_result"("_delivery_id" "uuid", "_lease_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_non_delivery_result"("_delivery_id" "uuid", "_lease_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_notification_event"("_delivery_id" "uuid", "_fallback_ok" boolean, "_fallback_error" "text", "_send_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_notification_event"("_delivery_id" "uuid", "_fallback_ok" boolean, "_fallback_error" "text", "_send_error" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_pre_delivery_failure"("_event_id" "uuid", "_lease_token" "uuid", "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_pre_delivery_failure"("_event_id" "uuid", "_lease_token" "uuid", "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt_non_delivery"("_attempt_id" "uuid", "_attempt_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt_non_delivery"("_attempt_id" "uuid", "_attempt_token" "uuid", "_result_status" "text", "_provider_response" "jsonb", "_error_code" "text", "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt_uncertain"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_send_attempt_uncertain"("_attempt_id" "uuid", "_attempt_token" "uuid", "_provider_response" "jsonb", "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_send_delivery"("_delivery_id" "uuid", "_lease_token" "uuid", "_provider_message_id" "text", "_provider_response" "jsonb", "_sent_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_whatsapp_unavailable_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_whatsapp_unavailable_delivery"("_delivery_id" "uuid", "_event_id" "uuid", "_lease_token" "uuid", "_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid", "_completed" boolean, "_detail" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_notification_send_reconciliation_action"("_action_id" "uuid", "_claim_token" "uuid", "_completed" boolean, "_detail" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_random_pin"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_random_pin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_random_pin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_short_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_short_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_short_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_next_client_entry"("_property_id" "uuid", "_from_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_next_client_entry"("_property_id" "uuid", "_from_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_next_client_entry"("_property_id" "uuid", "_from_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_bounded_whatsapp_retry_event_ids"("_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_bounded_whatsapp_retry_event_ids"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_photos_visibility"("_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_photos_visibility"("_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_photos_visibility"("_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_portal_access_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_portal_access_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_portal_access_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_portal_operational_statuses"("_client_id" "uuid", "_task_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_portal_settings"("_client_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_client_reservation_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_client_reservation_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_reservation_history"("_client_id" "uuid", "_limit" integer, "_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_future_pending_tasks_for_cleaner"("_cleaner_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_notification_send_reconciliation_queue"("_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_notification_send_reconciliation_queue"("_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notification_send_reconciliation_queue"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_portal_reservation_dates_by_task_ids"("_task_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_portal_reservation_dates_by_task_ids"("_task_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_portal_reservation_dates_by_task_ids"("_task_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_laundry_stock_consumptions"("token_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_laundry_stock_consumptions"("token_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_laundry_stock_consumptions"("token_param" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_supervision_property_reservations"("_property_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_supervision_property_reservations"("_property_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_supervision_property_reservations"("_property_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_task_assignment_counts"("_task_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_task_assignment_counts"("_task_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_task_assignment_counts"("_task_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_sedes"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_sedes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_sedes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor"("_days" integer, "_status" "text", "_search" "text", "_limit" integer, "_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor"("_days" integer, "_status" "text", "_search" "text", "_limit" integer, "_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor"("_days" integer, "_status" "text", "_search" "text", "_limit" integer, "_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor_stats"("_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor_stats"("_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_whatsapp_delivery_monitor_stats"("_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_whatsapp_notification_cron_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_whatsapp_notification_cron_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_whatsapp_webhook_pending_count"("_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_whatsapp_webhook_pending_count"("_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_whatsapp_webhook_pending_count"("_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_whatsapp_webhook_reconciliation_queue"("_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_whatsapp_webhook_reconciliation_queue"("_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_whatsapp_webhook_reconciliation_queue"("_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_cleaner_availability_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_cleaner_availability_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_cleaner_availability_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_cleaner_deactivation_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_cleaner_deactivation_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_cleaner_deactivation_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_task_assignment_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_task_assignment_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_task_assignment_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_task_schedule_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_task_schedule_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_task_schedule_planning_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_worker_absence_planning_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_worker_absence_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_worker_fixed_day_off_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_worker_fixed_day_off_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_worker_fixed_day_off_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_worker_maintenance_planning_write"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_worker_maintenance_planning_write"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_worker_maintenance_planning_write"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_cleaner"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_cleaner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_cleaner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_portal_access"("_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_portal_access"("_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_portal_access"("_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_laundry_route_worker_pin"() TO "anon";
GRANT ALL ON FUNCTION "public"."hash_laundry_route_worker_pin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_laundry_route_worker_pin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_laundry_route_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_laundry_route_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_laundry_route_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_laundry_route_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_task_visible_to_client_portal"("_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_task_visible_to_client_portal"("_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_task_visible_to_client_portal"("_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_avantio_cron_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_avantio_cron_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_avantio_cron_jobs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_avirato_cron_jobs"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_avirato_cron_jobs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_avirato_cron_jobs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_hostaway_cron_jobs"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."log_client_portal_access"("_client_id" "uuid", "_portal_access_id" "uuid", "_access_type" "text", "_actor_user_id" "uuid", "_actor_name" "text", "_actor_email" "text", "_user_agent" "text", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_client_portal_access"("_client_id" "uuid", "_portal_access_id" "uuid", "_access_type" "text", "_actor_user_id" "uuid", "_actor_name" "text", "_actor_email" "text", "_user_agent" "text", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_client_portal_access"("_client_id" "uuid", "_portal_access_id" "uuid", "_access_type" "text", "_actor_user_id" "uuid", "_actor_name" "text", "_actor_email" "text", "_user_agent" "text", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_data" "jsonb", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_data" "jsonb", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_security_event"("event_type" "text", "event_data" "jsonb", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_sede_event"("event_type_param" "text", "from_sede_id_param" "uuid", "to_sede_id_param" "uuid", "event_data_param" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_sede_event"("event_type_param" "text", "from_sede_id_param" "uuid", "to_sede_id_param" "uuid", "event_data_param" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_sede_event"("event_type_param" "text", "from_sede_id_param" "uuid", "to_sede_id_param" "uuid", "event_data_param" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_worker_absence_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_worker_absence_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_worker_absence_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_worker_fixed_days_off_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_worker_fixed_days_off_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_worker_fixed_days_off_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_worker_maintenance_cleanings_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_worker_maintenance_cleanings_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_worker_maintenance_cleanings_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_avantio_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_avirato_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."manage_avirato_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_avirato_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text", "job_timezone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."manage_hostaway_cron_job"("job_name" "text", "cron_schedule" "text", "function_url" "text", "auth_header" "text", "request_body" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."mark_whatsapp_webhook_callback"("_callback_id" "uuid", "_outcome" "text", "_processed" boolean, "_last_error" "text", "_claim_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_whatsapp_webhook_callback"("_callback_id" "uuid", "_outcome" "text", "_processed" boolean, "_last_error" "text", "_claim_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."materialize_recurring_task"("p_recurring_task_id" "uuid", "p_execution_date" "date", "p_next_execution" "date", "p_schedule_snapshot" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."materialize_recurring_task"("p_recurring_task_id" "uuid", "p_execution_date" "date", "p_next_execution" "date", "p_schedule_snapshot" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_spanish_phone_e164"("_raw" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_spanish_phone_e164"("_raw" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_spanish_phone_e164"("_raw" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notification_event_is_live_send_allowed"("_mode" "text", "_batch_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notification_event_is_live_send_allowed"("_mode" "text", "_batch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."planning_assert_worker_task_valid"("_cleaner_id" "uuid", "_task_id" "uuid", "_date" "date", "_start" time without time zone, "_end" time without time zone, "_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."planning_assert_worker_task_valid"("_cleaner_id" "uuid", "_task_id" "uuid", "_date" "date", "_start" time without time zone, "_end" time without time zone, "_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."planning_batch_request_hash"("_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_notification_policy" "text", "_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."planning_batch_request_hash"("_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_notification_policy" "text", "_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."planning_batch_request_hash"("_sede_id" "uuid", "_source_run_id" "uuid", "_source_run_version" bigint, "_notification_policy" "text", "_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."planning_effective_task_assignments"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."planning_effective_task_assignments"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."planning_lock_worker_dates"("_pairs" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."planning_lock_worker_dates"("_pairs" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_authenticate_with_pin"("_identifier" "text", "_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_authenticate_with_pin"("_identifier" "text", "_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_authenticate_with_pin"("_identifier" "text", "_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_lookup_by_short_code"("_short_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_lookup_by_short_code"("_short_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_lookup_by_short_code"("_short_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_lookup_by_token"("_portal_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."portal_lookup_by_token"("_portal_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_lookup_by_token"("_portal_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prepare_whatsapp_send_delivery"("_event_id" "uuid", "_lease_token" "uuid", "_recipient" "text", "_template_name" "text", "_provider_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prepare_whatsapp_send_delivery"("_event_id" "uuid", "_lease_token" "uuid", "_recipient" "text", "_template_name" "text", "_provider_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."preserve_supervision_audit_fields"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preserve_supervision_audit_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_cleaner_deactivation_with_future_tasks"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_notification_event_snapshot_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_notification_event_snapshot_mutation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_automatic_inventory_consumption"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_automatic_inventory_consumption"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_automatic_inventory_consumption"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_laundry_dirty_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_laundry_dirty_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_laundry_dirty_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_stock_consumption_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."process_stock_consumption_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_stock_consumption_for_task"("task_id_param" "uuid", "property_id_param" "uuid", "user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_whatsapp_webhook_inbox"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_whatsapp_webhook_inbox"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_whatsapp_webhook_callback"("_callback_key" "text", "_callback_kind" "text", "_provider_message_id" "text", "_whatsapp_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_delivery_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_whatsapp_webhook_callback"("_callback_key" "text", "_callback_kind" "text", "_provider_message_id" "text", "_whatsapp_message_id" "text", "_sender" "text", "_button_payload" "text", "_action" "text", "_task_id" "uuid", "_delivery_status" "text", "_occurred_at" timestamp with time zone, "_error_message" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_whatsapp_webhook_quarantine"("_callback_key" "text", "_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_whatsapp_webhook_quarantine"("_callback_key" "text", "_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_supervision_stop"("_stop_id" "uuid", "_neighbor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_supervision_stop"("_stop_id" "uuid", "_neighbor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_supervision_stop"("_stop_id" "uuid", "_neighbor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replay_whatsapp_status_callbacks"("_provider_message_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replay_whatsapp_status_callbacks"("_provider_message_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_cleaning_incident"("_task_id" "uuid", "_category_id" "uuid", "_description" "text", "_media_urls" "text"[], "_location" "text", "_visibility" "public"."incident_visibility", "_create_as_open" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."report_cleaning_incident"("_task_id" "uuid", "_category_id" "uuid", "_description" "text", "_media_urls" "text"[], "_location" "text", "_visibility" "public"."incident_visibility", "_create_as_open" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_cleaning_incident"("_task_id" "uuid", "_category_id" "uuid", "_description" "text", "_media_urls" "text"[], "_location" "text", "_visibility" "public"."incident_visibility", "_create_as_open" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_notification_send_reconciliation"("_delivery_id" "uuid", "_resolution" "text", "_provider_message_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_notification_send_reconciliation"("_delivery_id" "uuid", "_resolution" "text", "_provider_message_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_notification_send_reconciliation"("_delivery_id" "uuid", "_resolution" "text", "_provider_message_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_rate_limit"("reset_identifier" "text", "reset_action_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_rate_limit"("reset_identifier" "text", "reset_action_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_rate_limit"("reset_identifier" "text", "reset_action_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_cleaner_activation_cycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."rotate_cleaner_activation_cycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rotate_cleaner_activation_cycle"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_tourist_budget_version"("p_budget_id" "uuid", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_change_reason" "text", "p_source_profile_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_tourist_budget_version"("p_budget_id" "uuid", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_change_reason" "text", "p_source_profile_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_tourist_budget_version"("p_budget_id" "uuid", "p_snapshot" "jsonb", "p_totals" "jsonb", "p_items" "jsonb", "p_change_reason" "text", "p_source_profile_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_stock_warehouse"("warehouse_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_stock_warehouse"("warehouse_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_stock_warehouse"("warehouse_id_param" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."property_storage_access" TO "authenticated";
GRANT ALL ON TABLE "public"."property_storage_access" TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_property_storage_access"("_property_id" "uuid", "_property_group_id" "uuid", "_access_type" "text", "_warehouse_id" "uuid", "_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_property_storage_access"("_property_id" "uuid", "_property_group_id" "uuid", "_access_type" "text", "_warehouse_id" "uuid", "_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_property_storage_access"("_property_id" "uuid", "_property_group_id" "uuid", "_access_type" "text", "_warehouse_id" "uuid", "_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_supervision_actor_from_auth"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_supervision_actor_from_auth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_supervision_actor_from_auth"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_task_assignments"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_task_assignments"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_task_assignments"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_task_assignments_unlocked_15000"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_task_assignments_unlocked_15000"("_task_id" "uuid", "_cleaner_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."cleaners" TO "anon";
GRANT ALL ON TABLE "public"."cleaners" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaners" TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_notification_recipient"("_cleaner" "public"."cleaners") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_notification_recipient"("_cleaner" "public"."cleaners") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_building_has_sede_access"("_property_group_id" "uuid", "_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_building_has_sede_access"("_property_group_id" "uuid", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_building_has_sede_access"("_property_group_id" "uuid", "_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_stock_warehouse_can_access"("_warehouse_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_stock_warehouse_can_access"("_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_stock_warehouse_can_access"("_warehouse_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_storage_object_matches_review"("_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_storage_object_matches_review"("_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_storage_object_matches_review"("_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_user_can_access_sede"("_sede_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_user_can_access_sede"("_sede_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_user_can_access_sede"("_sede_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_user_can_delete_sede"("_sede_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_user_can_delete_sede"("_sede_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_user_can_delete_sede"("_sede_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_user_has_building_assignment"("_property_group_id" "uuid", "_user_id" "uuid", "_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_user_has_building_assignment"("_property_group_id" "uuid", "_user_id" "uuid", "_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_user_has_building_assignment"("_property_group_id" "uuid", "_user_id" "uuid", "_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."supervision_work_item_can_access"("_property_group_id" "uuid", "_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."supervision_work_item_can_access"("_property_group_id" "uuid", "_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supervision_work_item_can_access"("_property_group_id" "uuid", "_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_laundry_route_worker_pin_from_cleaner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_laundry_route_worker_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_laundry_route_worker_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_laundry_route_worker_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_tourist_budget_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_tourist_budget_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_tourist_budget_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_stock_between_warehouses"("product_id_param" "uuid", "from_warehouse_id_param" "uuid", "to_warehouse_id_param" "uuid", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_stock_between_warehouses"("product_id_param" "uuid", "from_warehouse_id_param" "uuid", "to_warehouse_id_param" "uuid", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_stock_between_warehouses"("product_id_param" "uuid", "from_warehouse_id_param" "uuid", "to_warehouse_id_param" "uuid", "quantity_param" numeric, "reason_param" "text", "user_id_param" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_tourist_budget"("p_budget_id" "uuid", "p_to_status" "public"."tourist_budget_status", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_tourist_budget"("p_budget_id" "uuid", "p_to_status" "public"."tourist_budget_status", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transition_tourist_budget"("p_budget_id" "uuid", "p_to_status" "public"."tourist_budget_status", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cleaners_order"("cleaner_updates" "jsonb"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_cleaners_order"("cleaner_updates" "jsonb"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cleaners_order"("cleaner_updates" "jsonb"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_hostaway_sync_schedules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hostaway_sync_schedules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hostaway_sync_schedules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_inventory_stock_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_inventory_stock_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_inventory_stock_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_laundry_dirty_stock_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_laundry_dirty_stock_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_laundry_dirty_stock_timestamp"() TO "service_role";



GRANT ALL ON TABLE "public"."stock_levels" TO "anon";
GRANT ALL ON TABLE "public"."stock_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_levels" TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_level_settings"("stock_level_id_param" "uuid", "minimum_quantity_param" numeric, "target_quantity_param" numeric, "cost_per_unit_param" numeric, "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_level_settings"("stock_level_id_param" "uuid", "minimum_quantity_param" numeric, "target_quantity_param" numeric, "cost_per_unit_param" numeric, "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_level_settings"("stock_level_id_param" "uuid", "minimum_quantity_param" numeric, "target_quantity_param" numeric, "cost_per_unit_param" numeric, "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_levels_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_levels_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_levels_timestamp"() TO "service_role";



GRANT ALL ON TABLE "public"."supervision_work_items" TO "service_role";
GRANT SELECT ON TABLE "public"."supervision_work_items" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_supervision_work_item_status"("_work_item_id" "uuid", "_status" "text", "_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_supervision_work_item_status"("_work_item_id" "uuid", "_status" "text", "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supervision_work_item_status"("_work_item_id" "uuid", "_status" "text", "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_supervision_work_items"("_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_supervision_work_items"("_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_supervision_work_items"("_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_task"("task_sede_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_task"("task_sede_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_task"("task_sede_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_role"("check_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("check_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_role"("check_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_sede_access"("_user_id" "uuid", "_sede_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_admin_or_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_admin_or_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_admin_or_manager"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_notification_send_reconciliation_effect"("_action_id" "uuid", "_claim_token" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_notification_send_reconciliation_effect"("_action_id" "uuid", "_claim_token" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_supervision_building_property_sede"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_supervision_building_property_sede"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_supervision_building_supervisor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_supervision_building_supervisor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_daily_report_sede"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_daily_report_sede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_daily_report_sede"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_incident_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_incident_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_incident_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_incident_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_incident_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_incident_route_is_open"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_media_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_media_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_media_route_is_open"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_media_sede"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_media_sede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_media_sede"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_reservation_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_reservation_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_reservation_route_is_open"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_supervision_review_property_vacancy"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_supervision_review_property_vacancy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_review_route"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_review_route"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_review_route"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_review_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_review_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_review_route_is_open"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_supervision_route_building_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_supervision_route_building_assignment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_route_is_open"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_supervision_stock_warehouse_location"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_supervision_stock_warehouse_location"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supervision_stop_route_is_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supervision_stop_route_is_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supervision_stop_route_is_open"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_invitation"("token" "text", "email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_invitation"("token" "text", "email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_invitation"("token" "text", "email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_laundry_route_worker_pin"("_route_worker_id" "uuid", "_pin" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_laundry_route_worker_pin"("_route_worker_id" "uuid", "_pin" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."writer_actor_can_access_sede"("_actor_id" "uuid", "_sede_id" "uuid", "_allowed_roles" "public"."app_role"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."writer_actor_can_access_sede"("_actor_id" "uuid", "_sede_id" "uuid", "_allowed_roles" "public"."app_role"[]) TO "service_role";
























GRANT ALL ON TABLE "public"."ai_action_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_action_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_action_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ai_action_proposals" TO "anon";
GRANT ALL ON TABLE "public"."ai_action_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_action_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_learning_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."ai_learning_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_learning_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_memories" TO "anon";
GRANT ALL ON TABLE "public"."ai_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_memories" TO "service_role";



GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_observed_events" TO "anon";
GRANT ALL ON TABLE "public"."ai_observed_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_observed_events" TO "service_role";



GRANT ALL ON TABLE "public"."assignment_patterns" TO "anon";
GRANT ALL ON TABLE "public"."assignment_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."auto_assignment_logs" TO "anon";
GRANT ALL ON TABLE "public"."auto_assignment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_assignment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."auto_assignment_rules" TO "anon";
GRANT ALL ON TABLE "public"."auto_assignment_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."auto_assignment_rules" TO "service_role";



GRANT ALL ON TABLE "public"."avantio_alert_log" TO "anon";
GRANT ALL ON TABLE "public"."avantio_alert_log" TO "authenticated";
GRANT ALL ON TABLE "public"."avantio_alert_log" TO "service_role";



GRANT ALL ON TABLE "public"."avantio_reservations" TO "anon";
GRANT ALL ON TABLE "public"."avantio_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."avantio_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."avantio_sync_errors" TO "anon";
GRANT ALL ON TABLE "public"."avantio_sync_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."avantio_sync_errors" TO "service_role";



GRANT ALL ON TABLE "public"."avantio_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."avantio_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."avantio_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."avantio_sync_schedules" TO "anon";
GRANT ALL ON TABLE "public"."avantio_sync_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."avantio_sync_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_reservation_tasks" TO "anon";
GRANT ALL ON TABLE "public"."avirato_reservation_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_reservation_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_reservations" TO "anon";
GRANT ALL ON TABLE "public"."avirato_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_room_mapping" TO "anon";
GRANT ALL ON TABLE "public"."avirato_room_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_room_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_sync_errors" TO "anon";
GRANT ALL ON TABLE "public"."avirato_sync_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_sync_errors" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."avirato_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."avirato_sync_schedules" TO "anon";
GRANT ALL ON TABLE "public"."avirato_sync_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."avirato_sync_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."batch_task_creation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."batch_task_email_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."budget_rate_profile_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_rate_profile_versions" TO "service_role";



GRANT ALL ON TABLE "public"."budget_rate_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_rate_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."cleaner_availability" TO "anon";
GRANT ALL ON TABLE "public"."cleaner_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_availability" TO "service_role";



GRANT ALL ON TABLE "public"."cleaner_group_assignments" TO "anon";
GRANT ALL ON TABLE "public"."cleaner_group_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_group_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."cleaner_work_schedule" TO "anon";
GRANT ALL ON TABLE "public"."cleaner_work_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaner_work_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."cleaning_incident_comments" TO "anon";
GRANT ALL ON TABLE "public"."cleaning_incident_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_incident_comments" TO "service_role";



GRANT ALL ON TABLE "public"."cleaning_incident_events" TO "anon";
GRANT ALL ON TABLE "public"."cleaning_incident_events" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_incident_events" TO "service_role";



GRANT ALL ON TABLE "public"."cleaning_incident_media" TO "anon";
GRANT ALL ON TABLE "public"."cleaning_incident_media" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_incident_media" TO "service_role";



GRANT ALL ON TABLE "public"."cleaning_incidents" TO "anon";
GRANT ALL ON TABLE "public"."cleaning_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."cleaning_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."client_extraordinary_requests" TO "anon";
GRANT ALL ON TABLE "public"."client_extraordinary_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."client_extraordinary_requests" TO "service_role";



GRANT ALL ON TABLE "public"."client_portal_access" TO "anon";
GRANT ALL ON TABLE "public"."client_portal_access" TO "authenticated";
GRANT ALL ON TABLE "public"."client_portal_access" TO "service_role";



GRANT ALL ON TABLE "public"."client_portal_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."client_portal_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_portal_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."client_reservation_logs" TO "anon";
GRANT ALL ON TABLE "public"."client_reservation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."client_reservation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."client_reservations" TO "anon";
GRANT ALL ON TABLE "public"."client_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."client_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."daily_report_export_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_report_export_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_report_export_logs" TO "service_role";



GRANT ALL ON TABLE "public"."employee_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."employee_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."extraordinary_request_types" TO "anon";
GRANT ALL ON TABLE "public"."extraordinary_request_types" TO "authenticated";
GRANT ALL ON TABLE "public"."extraordinary_request_types" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."forecast_alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_alerts_log" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."forecast_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."forecast_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."hostaway_reservations" TO "anon";
GRANT ALL ON TABLE "public"."hostaway_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."hostaway_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."hostaway_sync_errors" TO "anon";
GRANT ALL ON TABLE "public"."hostaway_sync_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."hostaway_sync_errors" TO "service_role";



GRANT ALL ON TABLE "public"."hostaway_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."hostaway_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hostaway_sync_logs" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."hostaway_sync_schedules" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."hostaway_sync_schedules" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."hostaway_sync_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."incident_categories" TO "anon";
GRANT ALL ON TABLE "public"."incident_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."incident_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_alerts" TO "anon";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_categories" TO "anon";
GRANT ALL ON TABLE "public"."inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_products" TO "anon";
GRANT ALL ON TABLE "public"."inventory_products" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_products" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_stock" TO "anon";
GRANT ALL ON TABLE "public"."inventory_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_stock" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_bag_preparations" TO "anon";
GRANT ALL ON TABLE "public"."laundry_bag_preparations" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_bag_preparations" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_classic_route_order" TO "anon";
GRANT ALL ON TABLE "public"."laundry_classic_route_order" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_classic_route_order" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_delivery_schedule" TO "anon";
GRANT ALL ON TABLE "public"."laundry_delivery_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_delivery_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_delivery_tracking" TO "anon";
GRANT ALL ON TABLE "public"."laundry_delivery_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_delivery_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_dirty_movements" TO "anon";
GRANT ALL ON TABLE "public"."laundry_dirty_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_dirty_movements" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_link_sync_runs" TO "anon";
GRANT ALL ON TABLE "public"."laundry_link_sync_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_link_sync_runs" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_access_attempts" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_access_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_access_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_sessions" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_v2_authorizations" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_v2_authorizations" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_v2_authorizations" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_v2_bag_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_v2_bag_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_v2_bag_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_v2_events" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_v2_events" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_v2_events" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_worker_events" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_worker_events" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_worker_events" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_route_workers" TO "anon";
GRANT ALL ON TABLE "public"."laundry_route_workers" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_route_workers" TO "service_role";



GRANT ALL ON TABLE "public"."laundry_share_links" TO "anon";
GRANT ALL ON TABLE "public"."laundry_share_links" TO "authenticated";
GRANT ALL ON TABLE "public"."laundry_share_links" TO "service_role";



GRANT ALL ON TABLE "public"."lh_reservation_tasks" TO "anon";
GRANT ALL ON TABLE "public"."lh_reservation_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."lh_reservation_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."lh_reservations" TO "anon";
GRANT ALL ON TABLE "public"."lh_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."lh_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."lh_room_mapping" TO "anon";
GRANT ALL ON TABLE "public"."lh_room_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."lh_room_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."lh_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."lh_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."lh_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."logistics_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_delivery_items" TO "anon";
GRANT ALL ON TABLE "public"."logistics_delivery_items" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_delivery_items" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_delivery_stops" TO "anon";
GRANT ALL ON TABLE "public"."logistics_delivery_stops" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_delivery_stops" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_picklist_items" TO "anon";
GRANT ALL ON TABLE "public"."logistics_picklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_picklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."logistics_picklists" TO "anon";
GRANT ALL ON TABLE "public"."logistics_picklists" TO "authenticated";
GRANT ALL ON TABLE "public"."logistics_picklists" TO "service_role";



GRANT ALL ON TABLE "public"."notification_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."notification_delivery_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."notification_events" TO "anon";
GRANT ALL ON TABLE "public"."notification_events" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_events" TO "service_role";



GRANT ALL ON TABLE "public"."notification_send_reconciliation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."planning_apply_batch_items" TO "service_role";
GRANT SELECT ON TABLE "public"."planning_apply_batch_items" TO "authenticated";



GRANT ALL ON TABLE "public"."planning_apply_batches" TO "service_role";
GRANT SELECT ON TABLE "public"."planning_apply_batches" TO "authenticated";



GRANT ALL ON TABLE "public"."planning_assignment_audit" TO "service_role";
GRANT SELECT ON TABLE "public"."planning_assignment_audit" TO "authenticated";



GRANT ALL ON TABLE "public"."planning_conflicts" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_conflicts" TO "service_role";



GRANT ALL ON TABLE "public"."planning_notification_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_notification_batches" TO "service_role";



GRANT ALL ON TABLE "public"."planning_run_items" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_run_items" TO "service_role";



GRANT ALL ON TABLE "public"."planning_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_runs" TO "service_role";



GRANT ALL ON TABLE "public"."planning_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."planning_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_amenity_inventory_mapping" TO "anon";
GRANT ALL ON TABLE "public"."property_amenity_inventory_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."property_amenity_inventory_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."property_checklist_assignments" TO "anon";
GRANT ALL ON TABLE "public"."property_checklist_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."property_checklist_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."property_consumption_config" TO "anon";
GRANT ALL ON TABLE "public"."property_consumption_config" TO "authenticated";
GRANT ALL ON TABLE "public"."property_consumption_config" TO "service_role";



GRANT ALL ON TABLE "public"."property_group_assignments" TO "anon";
GRANT ALL ON TABLE "public"."property_group_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."property_group_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."property_groups" TO "anon";
GRANT ALL ON TABLE "public"."property_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."property_groups" TO "service_role";



GRANT ALL ON TABLE "public"."property_preferred_cleaners" TO "anon";
GRANT ALL ON TABLE "public"."property_preferred_cleaners" TO "authenticated";
GRANT ALL ON TABLE "public"."property_preferred_cleaners" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_task_executions" TO "anon";
GRANT ALL ON TABLE "public"."recurring_task_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_task_executions" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_tasks" TO "anon";
GRANT ALL ON TABLE "public"."recurring_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."report_export_tokens" TO "anon";
GRANT ALL ON TABLE "public"."report_export_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."report_export_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."security_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."security_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."security_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."sede_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."sede_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sede_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."sedes" TO "anon";
GRANT ALL ON TABLE "public"."sedes" TO "authenticated";
GRANT ALL ON TABLE "public"."sedes" TO "service_role";



GRANT ALL ON TABLE "public"."smoobu_property_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."smoobu_property_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."smoobu_reservation_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."smoobu_reservation_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."smoobu_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."smoobu_reservations" TO "service_role";



GRANT ALL ON TABLE "public"."staffing_targets" TO "anon";
GRANT ALL ON TABLE "public"."staffing_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."staffing_targets" TO "service_role";



GRANT ALL ON TABLE "public"."stock_alerts" TO "anon";
GRANT ALL ON TABLE "public"."stock_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."stock_categories" TO "anon";
GRANT ALL ON TABLE "public"."stock_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_categories" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."stock_products" TO "anon";
GRANT ALL ON TABLE "public"."stock_products" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_products" TO "service_role";



GRANT ALL ON TABLE "public"."stock_property_consumption_rules" TO "anon";
GRANT ALL ON TABLE "public"."stock_property_consumption_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_property_consumption_rules" TO "service_role";



GRANT ALL ON TABLE "public"."stock_property_field_mappings" TO "anon";
GRANT ALL ON TABLE "public"."stock_property_field_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_property_field_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."stock_sede_settings" TO "anon";
GRANT ALL ON TABLE "public"."stock_sede_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_sede_settings" TO "service_role";



GRANT ALL ON TABLE "public"."supervision_building_policies" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_building_policies" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_building_supervisors" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_building_supervisors" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_daily_report_runs" TO "service_role";



GRANT ALL ON TABLE "public"."supervision_daily_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."supervision_daily_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_incident_events" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."supervision_incident_events" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_incidents" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_incidents" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_reservation_snapshots" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."supervision_reservation_snapshots" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_review_events" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."supervision_review_events" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_review_media" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."supervision_review_media" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_reviews" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_route_stops" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_route_stops" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_routes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supervision_routes" TO "authenticated";



GRANT ALL ON TABLE "public"."supervision_stock_check_lines" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."supervision_stock_check_lines" TO "authenticated";



GRANT ALL ON TABLE "public"."task_approval_events" TO "service_role";
GRANT SELECT ON TABLE "public"."task_approval_events" TO "authenticated";



GRANT ALL ON TABLE "public"."task_assignments" TO "anon";
GRANT ALL ON TABLE "public"."task_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."task_checklists_templates" TO "anon";
GRANT ALL ON TABLE "public"."task_checklists_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_checklists_templates" TO "service_role";



GRANT ALL ON TABLE "public"."task_media" TO "anon";
GRANT ALL ON TABLE "public"."task_media" TO "authenticated";
GRANT ALL ON TABLE "public"."task_media" TO "service_role";



GRANT ALL ON TABLE "public"."task_reports" TO "anon";
GRANT ALL ON TABLE "public"."task_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."task_reports" TO "service_role";



GRANT ALL ON TABLE "public"."task_reports_grouped" TO "anon";
GRANT ALL ON TABLE "public"."task_reports_grouped" TO "authenticated";
GRANT ALL ON TABLE "public"."task_reports_grouped" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."time_logs" TO "anon";
GRANT ALL ON TABLE "public"."time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_activation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_activation_items" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_activation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_activation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_documents" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tourist_budget_quote_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tourist_budget_quote_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tourist_budget_quote_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budget_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budget_versions" TO "service_role";



GRANT ALL ON TABLE "public"."tourist_budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."tourist_budgets" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sede_access" TO "anon";
GRANT ALL ON TABLE "public"."user_sede_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sede_access" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_requests" TO "anon";
GRANT ALL ON TABLE "public"."vacation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."worker_absence_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."worker_absence_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_absence_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."worker_absences" TO "anon";
GRANT ALL ON TABLE "public"."worker_absences" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_absences" TO "service_role";



GRANT ALL ON TABLE "public"."worker_contracts" TO "anon";
GRANT ALL ON TABLE "public"."worker_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."worker_fixed_days_off" TO "anon";
GRANT ALL ON TABLE "public"."worker_fixed_days_off" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_fixed_days_off" TO "service_role";



GRANT ALL ON TABLE "public"."worker_hour_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."worker_hour_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_hour_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."worker_maintenance_cleanings" TO "anon";
GRANT ALL ON TABLE "public"."worker_maintenance_cleanings" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_maintenance_cleanings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop policy "Client portal can view their tasks" on "public"."tasks";

drop policy "Portal users can create tasks via client portal" on "public"."tasks";

drop policy "Portal users can delete tasks via client portal" on "public"."tasks";

drop policy "Portal users can update tasks via client portal" on "public"."tasks";

revoke delete on table "public"."batch_task_creation_requests" from "anon";

revoke insert on table "public"."batch_task_creation_requests" from "anon";

revoke references on table "public"."batch_task_creation_requests" from "anon";

revoke select on table "public"."batch_task_creation_requests" from "anon";

revoke trigger on table "public"."batch_task_creation_requests" from "anon";

revoke truncate on table "public"."batch_task_creation_requests" from "anon";

revoke update on table "public"."batch_task_creation_requests" from "anon";

revoke delete on table "public"."batch_task_creation_requests" from "authenticated";

revoke insert on table "public"."batch_task_creation_requests" from "authenticated";

revoke references on table "public"."batch_task_creation_requests" from "authenticated";

revoke select on table "public"."batch_task_creation_requests" from "authenticated";

revoke trigger on table "public"."batch_task_creation_requests" from "authenticated";

revoke truncate on table "public"."batch_task_creation_requests" from "authenticated";

revoke update on table "public"."batch_task_creation_requests" from "authenticated";

revoke delete on table "public"."batch_task_email_deliveries" from "anon";

revoke insert on table "public"."batch_task_email_deliveries" from "anon";

revoke references on table "public"."batch_task_email_deliveries" from "anon";

revoke select on table "public"."batch_task_email_deliveries" from "anon";

revoke trigger on table "public"."batch_task_email_deliveries" from "anon";

revoke truncate on table "public"."batch_task_email_deliveries" from "anon";

revoke update on table "public"."batch_task_email_deliveries" from "anon";

revoke delete on table "public"."batch_task_email_deliveries" from "authenticated";

revoke insert on table "public"."batch_task_email_deliveries" from "authenticated";

revoke references on table "public"."batch_task_email_deliveries" from "authenticated";

revoke select on table "public"."batch_task_email_deliveries" from "authenticated";

revoke trigger on table "public"."batch_task_email_deliveries" from "authenticated";

revoke truncate on table "public"."batch_task_email_deliveries" from "authenticated";

revoke update on table "public"."batch_task_email_deliveries" from "authenticated";

revoke delete on table "public"."budget_rate_profile_versions" from "anon";

revoke insert on table "public"."budget_rate_profile_versions" from "anon";

revoke references on table "public"."budget_rate_profile_versions" from "anon";

revoke select on table "public"."budget_rate_profile_versions" from "anon";

revoke trigger on table "public"."budget_rate_profile_versions" from "anon";

revoke truncate on table "public"."budget_rate_profile_versions" from "anon";

revoke update on table "public"."budget_rate_profile_versions" from "anon";

revoke delete on table "public"."budget_rate_profiles" from "anon";

revoke insert on table "public"."budget_rate_profiles" from "anon";

revoke references on table "public"."budget_rate_profiles" from "anon";

revoke select on table "public"."budget_rate_profiles" from "anon";

revoke trigger on table "public"."budget_rate_profiles" from "anon";

revoke truncate on table "public"."budget_rate_profiles" from "anon";

revoke update on table "public"."budget_rate_profiles" from "anon";

revoke delete on table "public"."hostaway_sync_schedules" from "anon";

revoke insert on table "public"."hostaway_sync_schedules" from "anon";

revoke references on table "public"."hostaway_sync_schedules" from "anon";

revoke trigger on table "public"."hostaway_sync_schedules" from "anon";

revoke truncate on table "public"."hostaway_sync_schedules" from "anon";

revoke update on table "public"."hostaway_sync_schedules" from "anon";

revoke delete on table "public"."hostaway_sync_schedules" from "authenticated";

revoke insert on table "public"."hostaway_sync_schedules" from "authenticated";

revoke references on table "public"."hostaway_sync_schedules" from "authenticated";

revoke trigger on table "public"."hostaway_sync_schedules" from "authenticated";

revoke truncate on table "public"."hostaway_sync_schedules" from "authenticated";

revoke update on table "public"."hostaway_sync_schedules" from "authenticated";

revoke delete on table "public"."hostaway_sync_schedules" from "service_role";

revoke insert on table "public"."hostaway_sync_schedules" from "service_role";

revoke references on table "public"."hostaway_sync_schedules" from "service_role";

revoke trigger on table "public"."hostaway_sync_schedules" from "service_role";

revoke truncate on table "public"."hostaway_sync_schedules" from "service_role";

revoke update on table "public"."hostaway_sync_schedules" from "service_role";

revoke delete on table "public"."notification_delivery_attempts" from "anon";

revoke insert on table "public"."notification_delivery_attempts" from "anon";

revoke references on table "public"."notification_delivery_attempts" from "anon";

revoke select on table "public"."notification_delivery_attempts" from "anon";

revoke trigger on table "public"."notification_delivery_attempts" from "anon";

revoke truncate on table "public"."notification_delivery_attempts" from "anon";

revoke update on table "public"."notification_delivery_attempts" from "anon";

revoke delete on table "public"."notification_delivery_attempts" from "authenticated";

revoke insert on table "public"."notification_delivery_attempts" from "authenticated";

revoke references on table "public"."notification_delivery_attempts" from "authenticated";

revoke select on table "public"."notification_delivery_attempts" from "authenticated";

revoke trigger on table "public"."notification_delivery_attempts" from "authenticated";

revoke truncate on table "public"."notification_delivery_attempts" from "authenticated";

revoke update on table "public"."notification_delivery_attempts" from "authenticated";

revoke delete on table "public"."notification_send_reconciliation_actions" from "anon";

revoke insert on table "public"."notification_send_reconciliation_actions" from "anon";

revoke references on table "public"."notification_send_reconciliation_actions" from "anon";

revoke select on table "public"."notification_send_reconciliation_actions" from "anon";

revoke trigger on table "public"."notification_send_reconciliation_actions" from "anon";

revoke truncate on table "public"."notification_send_reconciliation_actions" from "anon";

revoke update on table "public"."notification_send_reconciliation_actions" from "anon";

revoke delete on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke insert on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke references on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke select on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke trigger on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke truncate on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke update on table "public"."notification_send_reconciliation_actions" from "authenticated";

revoke delete on table "public"."planning_apply_batch_items" from "anon";

revoke insert on table "public"."planning_apply_batch_items" from "anon";

revoke references on table "public"."planning_apply_batch_items" from "anon";

revoke select on table "public"."planning_apply_batch_items" from "anon";

revoke trigger on table "public"."planning_apply_batch_items" from "anon";

revoke truncate on table "public"."planning_apply_batch_items" from "anon";

revoke update on table "public"."planning_apply_batch_items" from "anon";

revoke delete on table "public"."planning_apply_batch_items" from "authenticated";

revoke insert on table "public"."planning_apply_batch_items" from "authenticated";

revoke references on table "public"."planning_apply_batch_items" from "authenticated";

revoke trigger on table "public"."planning_apply_batch_items" from "authenticated";

revoke truncate on table "public"."planning_apply_batch_items" from "authenticated";

revoke update on table "public"."planning_apply_batch_items" from "authenticated";

revoke delete on table "public"."planning_apply_batches" from "anon";

revoke insert on table "public"."planning_apply_batches" from "anon";

revoke references on table "public"."planning_apply_batches" from "anon";

revoke select on table "public"."planning_apply_batches" from "anon";

revoke trigger on table "public"."planning_apply_batches" from "anon";

revoke truncate on table "public"."planning_apply_batches" from "anon";

revoke update on table "public"."planning_apply_batches" from "anon";

revoke delete on table "public"."planning_apply_batches" from "authenticated";

revoke insert on table "public"."planning_apply_batches" from "authenticated";

revoke references on table "public"."planning_apply_batches" from "authenticated";

revoke trigger on table "public"."planning_apply_batches" from "authenticated";

revoke truncate on table "public"."planning_apply_batches" from "authenticated";

revoke update on table "public"."planning_apply_batches" from "authenticated";

revoke delete on table "public"."planning_assignment_audit" from "anon";

revoke insert on table "public"."planning_assignment_audit" from "anon";

revoke references on table "public"."planning_assignment_audit" from "anon";

revoke select on table "public"."planning_assignment_audit" from "anon";

revoke trigger on table "public"."planning_assignment_audit" from "anon";

revoke truncate on table "public"."planning_assignment_audit" from "anon";

revoke update on table "public"."planning_assignment_audit" from "anon";

revoke delete on table "public"."planning_assignment_audit" from "authenticated";

revoke insert on table "public"."planning_assignment_audit" from "authenticated";

revoke references on table "public"."planning_assignment_audit" from "authenticated";

revoke trigger on table "public"."planning_assignment_audit" from "authenticated";

revoke truncate on table "public"."planning_assignment_audit" from "authenticated";

revoke update on table "public"."planning_assignment_audit" from "authenticated";

revoke delete on table "public"."planning_conflicts" from "anon";

revoke insert on table "public"."planning_conflicts" from "anon";

revoke references on table "public"."planning_conflicts" from "anon";

revoke select on table "public"."planning_conflicts" from "anon";

revoke trigger on table "public"."planning_conflicts" from "anon";

revoke truncate on table "public"."planning_conflicts" from "anon";

revoke update on table "public"."planning_conflicts" from "anon";

revoke delete on table "public"."planning_notification_batches" from "anon";

revoke insert on table "public"."planning_notification_batches" from "anon";

revoke references on table "public"."planning_notification_batches" from "anon";

revoke select on table "public"."planning_notification_batches" from "anon";

revoke trigger on table "public"."planning_notification_batches" from "anon";

revoke truncate on table "public"."planning_notification_batches" from "anon";

revoke update on table "public"."planning_notification_batches" from "anon";

revoke delete on table "public"."planning_run_items" from "anon";

revoke insert on table "public"."planning_run_items" from "anon";

revoke references on table "public"."planning_run_items" from "anon";

revoke select on table "public"."planning_run_items" from "anon";

revoke trigger on table "public"."planning_run_items" from "anon";

revoke truncate on table "public"."planning_run_items" from "anon";

revoke update on table "public"."planning_run_items" from "anon";

revoke delete on table "public"."planning_runs" from "anon";

revoke insert on table "public"."planning_runs" from "anon";

revoke references on table "public"."planning_runs" from "anon";

revoke select on table "public"."planning_runs" from "anon";

revoke trigger on table "public"."planning_runs" from "anon";

revoke truncate on table "public"."planning_runs" from "anon";

revoke update on table "public"."planning_runs" from "anon";

revoke delete on table "public"."planning_settings" from "anon";

revoke insert on table "public"."planning_settings" from "anon";

revoke references on table "public"."planning_settings" from "anon";

revoke select on table "public"."planning_settings" from "anon";

revoke trigger on table "public"."planning_settings" from "anon";

revoke truncate on table "public"."planning_settings" from "anon";

revoke update on table "public"."planning_settings" from "anon";

revoke delete on table "public"."property_storage_access" from "anon";

revoke insert on table "public"."property_storage_access" from "anon";

revoke references on table "public"."property_storage_access" from "anon";

revoke select on table "public"."property_storage_access" from "anon";

revoke trigger on table "public"."property_storage_access" from "anon";

revoke truncate on table "public"."property_storage_access" from "anon";

revoke update on table "public"."property_storage_access" from "anon";

revoke delete on table "public"."smoobu_property_mappings" from "anon";

revoke insert on table "public"."smoobu_property_mappings" from "anon";

revoke references on table "public"."smoobu_property_mappings" from "anon";

revoke select on table "public"."smoobu_property_mappings" from "anon";

revoke trigger on table "public"."smoobu_property_mappings" from "anon";

revoke truncate on table "public"."smoobu_property_mappings" from "anon";

revoke update on table "public"."smoobu_property_mappings" from "anon";

revoke delete on table "public"."smoobu_reservation_tasks" from "anon";

revoke insert on table "public"."smoobu_reservation_tasks" from "anon";

revoke references on table "public"."smoobu_reservation_tasks" from "anon";

revoke select on table "public"."smoobu_reservation_tasks" from "anon";

revoke trigger on table "public"."smoobu_reservation_tasks" from "anon";

revoke truncate on table "public"."smoobu_reservation_tasks" from "anon";

revoke update on table "public"."smoobu_reservation_tasks" from "anon";

revoke delete on table "public"."smoobu_reservations" from "anon";

revoke insert on table "public"."smoobu_reservations" from "anon";

revoke references on table "public"."smoobu_reservations" from "anon";

revoke select on table "public"."smoobu_reservations" from "anon";

revoke trigger on table "public"."smoobu_reservations" from "anon";

revoke truncate on table "public"."smoobu_reservations" from "anon";

revoke update on table "public"."smoobu_reservations" from "anon";

revoke delete on table "public"."supervision_building_policies" from "anon";

revoke insert on table "public"."supervision_building_policies" from "anon";

revoke references on table "public"."supervision_building_policies" from "anon";

revoke select on table "public"."supervision_building_policies" from "anon";

revoke trigger on table "public"."supervision_building_policies" from "anon";

revoke truncate on table "public"."supervision_building_policies" from "anon";

revoke update on table "public"."supervision_building_policies" from "anon";

revoke references on table "public"."supervision_building_policies" from "authenticated";

revoke trigger on table "public"."supervision_building_policies" from "authenticated";

revoke truncate on table "public"."supervision_building_policies" from "authenticated";

revoke delete on table "public"."supervision_building_supervisors" from "anon";

revoke insert on table "public"."supervision_building_supervisors" from "anon";

revoke references on table "public"."supervision_building_supervisors" from "anon";

revoke select on table "public"."supervision_building_supervisors" from "anon";

revoke trigger on table "public"."supervision_building_supervisors" from "anon";

revoke truncate on table "public"."supervision_building_supervisors" from "anon";

revoke update on table "public"."supervision_building_supervisors" from "anon";

revoke references on table "public"."supervision_building_supervisors" from "authenticated";

revoke trigger on table "public"."supervision_building_supervisors" from "authenticated";

revoke truncate on table "public"."supervision_building_supervisors" from "authenticated";

revoke delete on table "public"."supervision_daily_report_runs" from "anon";

revoke insert on table "public"."supervision_daily_report_runs" from "anon";

revoke references on table "public"."supervision_daily_report_runs" from "anon";

revoke select on table "public"."supervision_daily_report_runs" from "anon";

revoke trigger on table "public"."supervision_daily_report_runs" from "anon";

revoke truncate on table "public"."supervision_daily_report_runs" from "anon";

revoke update on table "public"."supervision_daily_report_runs" from "anon";

revoke delete on table "public"."supervision_daily_report_runs" from "authenticated";

revoke insert on table "public"."supervision_daily_report_runs" from "authenticated";

revoke references on table "public"."supervision_daily_report_runs" from "authenticated";

revoke select on table "public"."supervision_daily_report_runs" from "authenticated";

revoke trigger on table "public"."supervision_daily_report_runs" from "authenticated";

revoke truncate on table "public"."supervision_daily_report_runs" from "authenticated";

revoke update on table "public"."supervision_daily_report_runs" from "authenticated";

revoke delete on table "public"."supervision_daily_reports" from "anon";

revoke insert on table "public"."supervision_daily_reports" from "anon";

revoke references on table "public"."supervision_daily_reports" from "anon";

revoke select on table "public"."supervision_daily_reports" from "anon";

revoke trigger on table "public"."supervision_daily_reports" from "anon";

revoke truncate on table "public"."supervision_daily_reports" from "anon";

revoke update on table "public"."supervision_daily_reports" from "anon";

revoke delete on table "public"."supervision_daily_reports" from "authenticated";

revoke insert on table "public"."supervision_daily_reports" from "authenticated";

revoke references on table "public"."supervision_daily_reports" from "authenticated";

revoke trigger on table "public"."supervision_daily_reports" from "authenticated";

revoke truncate on table "public"."supervision_daily_reports" from "authenticated";

revoke update on table "public"."supervision_daily_reports" from "authenticated";

revoke delete on table "public"."supervision_incident_events" from "anon";

revoke insert on table "public"."supervision_incident_events" from "anon";

revoke references on table "public"."supervision_incident_events" from "anon";

revoke select on table "public"."supervision_incident_events" from "anon";

revoke trigger on table "public"."supervision_incident_events" from "anon";

revoke truncate on table "public"."supervision_incident_events" from "anon";

revoke update on table "public"."supervision_incident_events" from "anon";

revoke delete on table "public"."supervision_incident_events" from "authenticated";

revoke references on table "public"."supervision_incident_events" from "authenticated";

revoke trigger on table "public"."supervision_incident_events" from "authenticated";

revoke truncate on table "public"."supervision_incident_events" from "authenticated";

revoke update on table "public"."supervision_incident_events" from "authenticated";

revoke delete on table "public"."supervision_incidents" from "anon";

revoke insert on table "public"."supervision_incidents" from "anon";

revoke references on table "public"."supervision_incidents" from "anon";

revoke select on table "public"."supervision_incidents" from "anon";

revoke trigger on table "public"."supervision_incidents" from "anon";

revoke truncate on table "public"."supervision_incidents" from "anon";

revoke update on table "public"."supervision_incidents" from "anon";

revoke references on table "public"."supervision_incidents" from "authenticated";

revoke trigger on table "public"."supervision_incidents" from "authenticated";

revoke truncate on table "public"."supervision_incidents" from "authenticated";

revoke delete on table "public"."supervision_reservation_snapshots" from "anon";

revoke insert on table "public"."supervision_reservation_snapshots" from "anon";

revoke references on table "public"."supervision_reservation_snapshots" from "anon";

revoke select on table "public"."supervision_reservation_snapshots" from "anon";

revoke trigger on table "public"."supervision_reservation_snapshots" from "anon";

revoke truncate on table "public"."supervision_reservation_snapshots" from "anon";

revoke update on table "public"."supervision_reservation_snapshots" from "anon";

revoke delete on table "public"."supervision_reservation_snapshots" from "authenticated";

revoke references on table "public"."supervision_reservation_snapshots" from "authenticated";

revoke trigger on table "public"."supervision_reservation_snapshots" from "authenticated";

revoke truncate on table "public"."supervision_reservation_snapshots" from "authenticated";

revoke delete on table "public"."supervision_review_events" from "anon";

revoke insert on table "public"."supervision_review_events" from "anon";

revoke references on table "public"."supervision_review_events" from "anon";

revoke select on table "public"."supervision_review_events" from "anon";

revoke trigger on table "public"."supervision_review_events" from "anon";

revoke truncate on table "public"."supervision_review_events" from "anon";

revoke update on table "public"."supervision_review_events" from "anon";

revoke delete on table "public"."supervision_review_events" from "authenticated";

revoke references on table "public"."supervision_review_events" from "authenticated";

revoke trigger on table "public"."supervision_review_events" from "authenticated";

revoke truncate on table "public"."supervision_review_events" from "authenticated";

revoke update on table "public"."supervision_review_events" from "authenticated";

revoke delete on table "public"."supervision_review_media" from "anon";

revoke insert on table "public"."supervision_review_media" from "anon";

revoke references on table "public"."supervision_review_media" from "anon";

revoke select on table "public"."supervision_review_media" from "anon";

revoke trigger on table "public"."supervision_review_media" from "anon";

revoke truncate on table "public"."supervision_review_media" from "anon";

revoke update on table "public"."supervision_review_media" from "anon";

revoke delete on table "public"."supervision_review_media" from "authenticated";

revoke references on table "public"."supervision_review_media" from "authenticated";

revoke trigger on table "public"."supervision_review_media" from "authenticated";

revoke truncate on table "public"."supervision_review_media" from "authenticated";

revoke delete on table "public"."supervision_reviews" from "anon";

revoke insert on table "public"."supervision_reviews" from "anon";

revoke references on table "public"."supervision_reviews" from "anon";

revoke select on table "public"."supervision_reviews" from "anon";

revoke trigger on table "public"."supervision_reviews" from "anon";

revoke truncate on table "public"."supervision_reviews" from "anon";

revoke update on table "public"."supervision_reviews" from "anon";

revoke references on table "public"."supervision_reviews" from "authenticated";

revoke trigger on table "public"."supervision_reviews" from "authenticated";

revoke truncate on table "public"."supervision_reviews" from "authenticated";

revoke delete on table "public"."supervision_route_stops" from "anon";

revoke insert on table "public"."supervision_route_stops" from "anon";

revoke references on table "public"."supervision_route_stops" from "anon";

revoke select on table "public"."supervision_route_stops" from "anon";

revoke trigger on table "public"."supervision_route_stops" from "anon";

revoke truncate on table "public"."supervision_route_stops" from "anon";

revoke update on table "public"."supervision_route_stops" from "anon";

revoke references on table "public"."supervision_route_stops" from "authenticated";

revoke trigger on table "public"."supervision_route_stops" from "authenticated";

revoke truncate on table "public"."supervision_route_stops" from "authenticated";

revoke delete on table "public"."supervision_routes" from "anon";

revoke insert on table "public"."supervision_routes" from "anon";

revoke references on table "public"."supervision_routes" from "anon";

revoke select on table "public"."supervision_routes" from "anon";

revoke trigger on table "public"."supervision_routes" from "anon";

revoke truncate on table "public"."supervision_routes" from "anon";

revoke update on table "public"."supervision_routes" from "anon";

revoke references on table "public"."supervision_routes" from "authenticated";

revoke trigger on table "public"."supervision_routes" from "authenticated";

revoke truncate on table "public"."supervision_routes" from "authenticated";

revoke delete on table "public"."supervision_stock_check_lines" from "anon";

revoke insert on table "public"."supervision_stock_check_lines" from "anon";

revoke references on table "public"."supervision_stock_check_lines" from "anon";

revoke select on table "public"."supervision_stock_check_lines" from "anon";

revoke trigger on table "public"."supervision_stock_check_lines" from "anon";

revoke truncate on table "public"."supervision_stock_check_lines" from "anon";

revoke update on table "public"."supervision_stock_check_lines" from "anon";

revoke delete on table "public"."supervision_stock_check_lines" from "authenticated";

revoke references on table "public"."supervision_stock_check_lines" from "authenticated";

revoke trigger on table "public"."supervision_stock_check_lines" from "authenticated";

revoke truncate on table "public"."supervision_stock_check_lines" from "authenticated";

revoke delete on table "public"."supervision_stock_checks" from "anon";

revoke insert on table "public"."supervision_stock_checks" from "anon";

revoke references on table "public"."supervision_stock_checks" from "anon";

revoke select on table "public"."supervision_stock_checks" from "anon";

revoke trigger on table "public"."supervision_stock_checks" from "anon";

revoke truncate on table "public"."supervision_stock_checks" from "anon";

revoke update on table "public"."supervision_stock_checks" from "anon";

revoke delete on table "public"."supervision_stock_checks" from "authenticated";

revoke references on table "public"."supervision_stock_checks" from "authenticated";

revoke trigger on table "public"."supervision_stock_checks" from "authenticated";

revoke truncate on table "public"."supervision_stock_checks" from "authenticated";

revoke delete on table "public"."supervision_work_items" from "anon";

revoke insert on table "public"."supervision_work_items" from "anon";

revoke references on table "public"."supervision_work_items" from "anon";

revoke select on table "public"."supervision_work_items" from "anon";

revoke trigger on table "public"."supervision_work_items" from "anon";

revoke truncate on table "public"."supervision_work_items" from "anon";

revoke update on table "public"."supervision_work_items" from "anon";

revoke delete on table "public"."supervision_work_items" from "authenticated";

revoke insert on table "public"."supervision_work_items" from "authenticated";

revoke references on table "public"."supervision_work_items" from "authenticated";

revoke trigger on table "public"."supervision_work_items" from "authenticated";

revoke truncate on table "public"."supervision_work_items" from "authenticated";

revoke update on table "public"."supervision_work_items" from "authenticated";

revoke delete on table "public"."task_approval_events" from "anon";

revoke insert on table "public"."task_approval_events" from "anon";

revoke references on table "public"."task_approval_events" from "anon";

revoke select on table "public"."task_approval_events" from "anon";

revoke trigger on table "public"."task_approval_events" from "anon";

revoke truncate on table "public"."task_approval_events" from "anon";

revoke update on table "public"."task_approval_events" from "anon";

revoke delete on table "public"."task_approval_events" from "authenticated";

revoke insert on table "public"."task_approval_events" from "authenticated";

revoke references on table "public"."task_approval_events" from "authenticated";

revoke trigger on table "public"."task_approval_events" from "authenticated";

revoke truncate on table "public"."task_approval_events" from "authenticated";

revoke update on table "public"."task_approval_events" from "authenticated";

revoke delete on table "public"."tourist_budget_activation_items" from "anon";

revoke insert on table "public"."tourist_budget_activation_items" from "anon";

revoke references on table "public"."tourist_budget_activation_items" from "anon";

revoke select on table "public"."tourist_budget_activation_items" from "anon";

revoke trigger on table "public"."tourist_budget_activation_items" from "anon";

revoke truncate on table "public"."tourist_budget_activation_items" from "anon";

revoke update on table "public"."tourist_budget_activation_items" from "anon";

revoke delete on table "public"."tourist_budget_activation_runs" from "anon";

revoke insert on table "public"."tourist_budget_activation_runs" from "anon";

revoke references on table "public"."tourist_budget_activation_runs" from "anon";

revoke select on table "public"."tourist_budget_activation_runs" from "anon";

revoke trigger on table "public"."tourist_budget_activation_runs" from "anon";

revoke truncate on table "public"."tourist_budget_activation_runs" from "anon";

revoke update on table "public"."tourist_budget_activation_runs" from "anon";

revoke delete on table "public"."tourist_budget_documents" from "anon";

revoke insert on table "public"."tourist_budget_documents" from "anon";

revoke references on table "public"."tourist_budget_documents" from "anon";

revoke select on table "public"."tourist_budget_documents" from "anon";

revoke trigger on table "public"."tourist_budget_documents" from "anon";

revoke truncate on table "public"."tourist_budget_documents" from "anon";

revoke update on table "public"."tourist_budget_documents" from "anon";

revoke delete on table "public"."tourist_budget_items" from "anon";

revoke insert on table "public"."tourist_budget_items" from "anon";

revoke references on table "public"."tourist_budget_items" from "anon";

revoke select on table "public"."tourist_budget_items" from "anon";

revoke trigger on table "public"."tourist_budget_items" from "anon";

revoke truncate on table "public"."tourist_budget_items" from "anon";

revoke update on table "public"."tourist_budget_items" from "anon";

revoke delete on table "public"."tourist_budget_status_history" from "anon";

revoke insert on table "public"."tourist_budget_status_history" from "anon";

revoke references on table "public"."tourist_budget_status_history" from "anon";

revoke select on table "public"."tourist_budget_status_history" from "anon";

revoke trigger on table "public"."tourist_budget_status_history" from "anon";

revoke truncate on table "public"."tourist_budget_status_history" from "anon";

revoke update on table "public"."tourist_budget_status_history" from "anon";

revoke delete on table "public"."tourist_budget_versions" from "anon";

revoke insert on table "public"."tourist_budget_versions" from "anon";

revoke references on table "public"."tourist_budget_versions" from "anon";

revoke select on table "public"."tourist_budget_versions" from "anon";

revoke trigger on table "public"."tourist_budget_versions" from "anon";

revoke truncate on table "public"."tourist_budget_versions" from "anon";

revoke update on table "public"."tourist_budget_versions" from "anon";

revoke delete on table "public"."tourist_budgets" from "anon";

revoke insert on table "public"."tourist_budgets" from "anon";

revoke references on table "public"."tourist_budgets" from "anon";

revoke select on table "public"."tourist_budgets" from "anon";

revoke trigger on table "public"."tourist_budgets" from "anon";

revoke truncate on table "public"."tourist_budgets" from "anon";

revoke update on table "public"."tourist_budgets" from "anon";

revoke delete on table "public"."whatsapp_webhook_inbox" from "anon";

revoke insert on table "public"."whatsapp_webhook_inbox" from "anon";

revoke references on table "public"."whatsapp_webhook_inbox" from "anon";

revoke select on table "public"."whatsapp_webhook_inbox" from "anon";

revoke trigger on table "public"."whatsapp_webhook_inbox" from "anon";

revoke truncate on table "public"."whatsapp_webhook_inbox" from "anon";

revoke update on table "public"."whatsapp_webhook_inbox" from "anon";

revoke delete on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke insert on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke references on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke select on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke trigger on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke truncate on table "public"."whatsapp_webhook_inbox" from "authenticated";

revoke update on table "public"."whatsapp_webhook_inbox" from "authenticated";

alter table "public"."client_reservation_logs" drop constraint "client_reservation_logs_action_check";

alter table "public"."client_reservations" drop constraint "client_reservations_status_check";

alter table "public"."client_reservation_logs" add constraint "client_reservation_logs_action_check" CHECK (((action)::text = ANY ((ARRAY['created'::character varying, 'updated'::character varying, 'cancelled'::character varying])::text[]))) not valid;

alter table "public"."client_reservation_logs" validate constraint "client_reservation_logs_action_check";

alter table "public"."client_reservations" add constraint "client_reservations_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying, 'completed'::character varying])::text[]))) not valid;

alter table "public"."client_reservations" validate constraint "client_reservations_status_check";


  create policy "Client portal can view their tasks"
  on "public"."tasks"
  as permissive
  for select
  to anon, authenticated
using (((cliente_id IS NOT NULL) AND public.has_active_portal_access(cliente_id)));



  create policy "Portal users can create tasks via client portal"
  on "public"."tasks"
  as permissive
  for insert
  to anon, authenticated
with check (((cliente_id IS NOT NULL) AND public.has_active_portal_access(cliente_id)));



  create policy "Portal users can delete tasks via client portal"
  on "public"."tasks"
  as permissive
  for delete
  to anon, authenticated
using (((cliente_id IS NOT NULL) AND public.has_active_portal_access(cliente_id)));



  create policy "Portal users can update tasks via client portal"
  on "public"."tasks"
  as permissive
  for update
  to anon, authenticated
using (((cliente_id IS NOT NULL) AND public.has_active_portal_access(cliente_id)))
with check (((cliente_id IS NOT NULL) AND public.has_active_portal_access(cliente_id)));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Authenticated users can upload media"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'task-reports-media'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can delete their media"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'task-reports-media'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can update their media"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'task-reports-media'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can view media"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'task-reports-media'::text));



  create policy "supervision_evidence_read"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'supervision-evidence'::text) AND public.supervision_storage_object_matches_review(name) AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid)));



  create policy "supervision_evidence_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'supervision-evidence'::text) AND public.supervision_storage_object_matches_review(name) AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid)))
with check (((bucket_id = 'supervision-evidence'::text) AND public.supervision_storage_object_matches_review(name) AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid)));



  create policy "supervision_evidence_write"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'supervision-evidence'::text) AND public.supervision_storage_object_matches_review(name) AND public.supervision_user_can_access_sede(((storage.foldername(name))[1])::uuid)));



  create policy "tourist_budget_documents_admin_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'tourist-budget-documents'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "tourist_budget_documents_admin_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'tourist-budget-documents'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "tourist_budget_documents_admin_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'tourist-budget-documents'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



  create policy "tourist_budget_documents_admin_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'tourist-budget-documents'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)))
with check (((bucket_id = 'tourist-budget-documents'::text) AND public.has_role(auth.uid(), 'admin'::public.app_role)));



