\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.app_role AS ENUM ('admin','manager','supervisor','cleaner','client','logistics');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE TABLE public.sedes(id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.user_roles(user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE(user_id,role));
CREATE TABLE public.user_sede_access(user_id uuid NOT NULL, sede_id uuid NOT NULL, can_access boolean NOT NULL DEFAULT true);
CREATE TABLE public.profiles(id uuid PRIMARY KEY, email text);
CREATE TABLE public.clients(id uuid PRIMARY KEY, sede_id uuid);
CREATE TABLE public.properties(
 id uuid PRIMARY KEY, nombre text NOT NULL, direccion text NOT NULL, cliente_id uuid,
 sede_id uuid, duracion_servicio integer DEFAULT 60, coste_servicio numeric DEFAULT 0,
 check_in_predeterminado time DEFAULT '15:00', check_out_predeterminado time DEFAULT '11:00',
 is_active boolean DEFAULT true
);
CREATE TABLE public.cleaners(
 id uuid PRIMARY KEY, name text NOT NULL, email text, sede_id uuid, is_active boolean DEFAULT true,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property text NOT NULL, address text NOT NULL,
 date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL, type text NOT NULL,
 status text NOT NULL DEFAULT 'pending', check_in time NOT NULL, check_out time NOT NULL,
 cliente_id uuid, propiedad_id uuid, duracion integer, coste numeric, metodo_pago text,
 supervisor text, sede_id uuid, cleaner_id uuid, cleaner text, auto_assigned boolean DEFAULT false,
 assignment_confidence numeric, updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now()
);
CREATE TABLE public.task_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 cleaner_id uuid NOT NULL REFERENCES public.cleaners(id), cleaner_name text NOT NULL,
 assigned_by uuid, assigned_at timestamptz DEFAULT now(), UNIQUE(task_id,cleaner_id)
);
CREATE TABLE public.notification_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, cleaner_id uuid, status text DEFAULT 'pending', payload jsonb DEFAULT '{}'
);
CREATE FUNCTION public.qa_assignment_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO public.notification_events(task_id,cleaner_id,payload) VALUES(NEW.task_id,NEW.cleaner_id,jsonb_build_object('source','qa'));
 RETURN NEW; END $$;
CREATE TRIGGER qa_assignment_outbox AFTER INSERT ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.qa_assignment_outbox();
CREATE TABLE public.property_groups(
 id uuid PRIMARY KEY, name text, is_active boolean DEFAULT true, auto_assign_enabled boolean DEFAULT true,
 description text, check_out_time time, check_in_time time, created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.property_group_assignments(property_group_id uuid, property_id uuid UNIQUE);
CREATE TABLE public.cleaner_group_assignments(
 property_group_id uuid, cleaner_id uuid, priority integer, max_tasks_per_day integer DEFAULT 8,
 estimated_travel_time_minutes integer DEFAULT 0, is_active boolean DEFAULT true
);
CREATE TABLE public.cleaner_availability(cleaner_id uuid, day_of_week integer, is_available boolean, start_time time, end_time time);
CREATE TABLE public.worker_absences(cleaner_id uuid, start_date date, end_date date, start_time time, end_time time);
CREATE TABLE public.worker_fixed_days_off(cleaner_id uuid, day_of_week integer, is_active boolean);
CREATE TABLE public.worker_maintenance_cleanings(cleaner_id uuid, days_of_week integer[], start_time time, end_time time, is_active boolean);
CREATE TABLE public.auto_assignment_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, property_group_id uuid, assigned_cleaner_id uuid,
 algorithm_used text, assignment_reason text, confidence_score numeric, was_manual_override boolean, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.ai_action_proposals(
 id uuid PRIMARY KEY, owner_user_id uuid, owner_email text, status text, sede_id uuid, actions jsonb,
 result jsonb, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.ai_action_audit_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id uuid, owner_user_id uuid, owner_email text,
 action_type text, status text, payload jsonb, result jsonb
);
CREATE FUNCTION public.user_has_sede_access(_user_id uuid,_sede_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='admin')
 OR EXISTS(SELECT 1 FROM public.user_sede_access WHERE user_id=_user_id AND sede_id=_sede_id AND can_access)
$$;
CREATE FUNCTION public.ai_is_allowed_user() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.set_task_assignments(_task_id uuid,_cleaner_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE names text; primary_id uuid;
BEGIN
 DELETE FROM public.task_assignments WHERE task_id=_task_id AND cleaner_id <> ALL(coalesce(_cleaner_ids,'{}'));
 INSERT INTO public.task_assignments(task_id,cleaner_id,cleaner_name,assigned_by)
 SELECT _task_id,c.id,c.name,auth.uid() FROM public.cleaners c WHERE c.id=ANY(coalesce(_cleaner_ids,'{}'))
 ON CONFLICT DO NOTHING;
 SELECT string_agg(c.name,', ' ORDER BY ids.ord),(array_agg(c.id ORDER BY ids.ord))[1]
 INTO names,primary_id FROM unnest(coalesce(_cleaner_ids,'{}')) WITH ORDINALITY ids(id,ord) JOIN public.cleaners c ON c.id=ids.id;
 UPDATE public.tasks SET cleaner=names,cleaner_id=primary_id WHERE id=_task_id;
 RETURN jsonb_build_object('final',coalesce(to_jsonb(_cleaner_ids),'[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.set_task_assignments(uuid,uuid[]) TO service_role,authenticated;

INSERT INTO public.sedes VALUES
 ('10000000-0000-0000-0000-000000000001',true),('10000000-0000-0000-0000-000000000002',true);
INSERT INTO auth.users VALUES
 ('20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com'),
 ('20000000-0000-0000-0000-000000000002','manager@example.test'),
 ('20000000-0000-0000-0000-000000000003','cleaner@example.test');
INSERT INTO public.profiles VALUES
 ('20000000-0000-0000-0000-000000000001','dgomezlimpatex@gmail.com'),
 ('20000000-0000-0000-0000-000000000002','manager@example.test');
INSERT INTO public.user_roles VALUES
 ('20000000-0000-0000-0000-000000000001','admin'),
 ('20000000-0000-0000-0000-000000000002','manager'),
 ('20000000-0000-0000-0000-000000000003','cleaner');
INSERT INTO public.user_sede_access VALUES ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',true);
INSERT INTO public.clients VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
INSERT INTO public.properties VALUES
 ('40000000-0000-0000-0000-000000000001','DB Property','DB Address','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',60,25,'15:00','11:00',true),
 ('40000000-0000-0000-0000-000000000002','Other Sede','Other Address','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',60,25,'15:00','11:00',true);
INSERT INTO public.cleaners VALUES
 ('50000000-0000-0000-0000-000000000001','DB Cleaner','db-cleaner@example.test','10000000-0000-0000-0000-000000000001',true,now(),now()),
 ('50000000-0000-0000-0000-000000000002','Other Cleaner','other@example.test','10000000-0000-0000-0000-000000000002',true,now(),now());
INSERT INTO public.property_groups VALUES ('60000000-0000-0000-0000-000000000001','Group',true,true,null,null,null,now(),now());
INSERT INTO public.property_group_assignments VALUES ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001');
INSERT INTO public.cleaner_group_assignments VALUES ('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',1,1,0,true);
