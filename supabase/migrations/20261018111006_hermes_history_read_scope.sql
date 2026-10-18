-- Read-only extension for the requested historical learning. No business writes.
-- Only Operations and Consultant receive the three current-building resources.
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('property_groups','property_group_assignments','cleaner_group_assignments') and not c.relrowsecurity) then
  raise exception 'Expected existing RLS protection';
 end if;
end $$;
grant select (id,name,display_name,internal_code,is_active,zone,updated_at) on public.property_groups to limpatex_bot_reader;
grant select (id,property_group_id,property_id,created_at) on public.property_group_assignments to limpatex_bot_reader;
grant select (id,property_group_id,cleaner_id,priority,role_type,knowledge_level,max_tasks_per_day,max_daily_minutes_override,estimated_travel_time_minutes,is_active,updated_at) on public.cleaner_group_assignments to limpatex_bot_reader;
create policy assistant_scoped_reader on public.property_groups for select to limpatex_bot_reader using(true);
create policy assistant_scoped_reader on public.property_group_assignments for select to limpatex_bot_reader using(true);
create policy assistant_scoped_reader on public.cleaner_group_assignments for select to limpatex_bot_reader using(true);
create view limpatex_assistant_private.edificios with (security_invoker=true) as select id,coalesce(nullif(display_name,''),name) as nombre,internal_code as codigo,is_active as activo,zone as zona,updated_at as actualizado from public.property_groups;
create view limpatex_assistant_private.vinculos_edificios with (security_invoker=true) as select id,property_group_id as edificio_id,property_id as propiedad_id,created_at as creado from public.property_group_assignments;
create view limpatex_assistant_private.equipos_edificios with (security_invoker=true) as select id,property_group_id as edificio_id,cleaner_id,priority as prioridad,role_type as rol,knowledge_level as conocimiento_configurado,max_tasks_per_day as max_tareas_dia,max_daily_minutes_override as max_minutos_dia,estimated_travel_time_minutes as traslado_minutos,is_active as activo,updated_at as actualizado from public.cleaner_group_assignments;
revoke all on limpatex_assistant_private.edificios,limpatex_assistant_private.vinculos_edificios,limpatex_assistant_private.equipos_edificios from public,anon,authenticated;
grant select on limpatex_assistant_private.edificios,limpatex_assistant_private.vinculos_edificios,limpatex_assistant_private.equipos_edificios to limpatex_bot_reader;
-- Replace as the existing limited owner; administrator SET permission is temporary.
grant limpatex_bot_reader to postgres with set true;
grant create on schema public to limpatex_bot_reader;
set local role limpatex_bot_reader;
create or replace function public.limpatex_assistant_read(
 p_token text, p_resource text default 'permisos', p_from date default null,
 p_to date default null, p_search text default '', p_id uuid default null,
 p_limit integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='8s' as $$
declare v_profile text; v_allowed text[]; v_rows jsonb; v_total integer; v_start date; v_end date; v_query text;
begin
 if p_token is null or length(p_token)<40 or length(p_token)>100 then raise exception using errcode='28000',message='Acceso de asistente no válido'; end if;
 select profile into v_profile from limpatex_assistant_private.identities
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and active and expires_at>now();
 if v_profile is null then raise exception using errcode='28000',message='Acceso de asistente no válido o caducado'; end if;
 case v_profile
 when 'limpatexconsultor' then v_allowed:=array['clientes','propiedades','tareas','equipo','ausencias','inventario','lavanderia','incidencias','tarifas','importes_servicios','costes_personal','ajustes_financieros','edificios','vinculos_edificios','equipos_edificios'];
 when 'limpatexoperaciones' then v_allowed:=array['clientes','propiedades','tareas','equipo','ausencias','inventario','lavanderia','incidencias','edificios','vinculos_edificios','equipos_edificios'];
 when 'limpatexrentabilidad' then v_allowed:=array['clientes','propiedades','tareas','tarifas','importes_servicios','costes_personal','ajustes_financieros'];
 when 'limpatexcomercial' then v_allowed:=array['clientes','propiedades','tarifas'];
 else raise exception using errcode='42501',message='Perfil no autorizado'; end case;
 if p_resource='permisos' then return jsonb_build_object('profile',v_profile,'read_only',true,'resources',to_jsonb(v_allowed),'as_of',now(),'timezone','Europe/Madrid'); end if;
 if p_resource is null or not(p_resource=any(v_allowed)) then raise exception using errcode='42501',message='Consulta no autorizada para este perfil'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 or p_offset>100000 or p_search is null or length(p_search)>120 then raise exception using errcode='22023',message='Filtro o paginación no válido'; end if;
 v_start:=coalesce(p_from,(now() at time zone 'Europe/Madrid')::date-7);
 v_end:=coalesce(p_to,v_start+30);
 if v_end<v_start or v_end-v_start>366 then raise exception using errcode='22023',message='Consultar periodos de hasta 366 días'; end if;
 -- Identifier comes exclusively from the finite server-owned allowlist above.
 -- All client filter values are bound parameters; no arbitrary joins, SQL or columns.
 v_query:=format('select to_jsonb(r) j from limpatex_assistant_private.%I r',p_resource);
 v_query:='with allowed as ('||v_query||'), filtered as (select j from allowed where ($1::uuid is null or j->>''id''=$1::text) and ($2='''' or concat_ws('' '',j->>''nombre'',j->>''codigo'',j->>''propiedad'',j->>''cliente'',j->>''almacen'') ilike ''%%''||$2||''%%'') and (not(j ? ''fecha'') or ((j->>''fecha'')::date<=$4 and coalesce((j->>''hasta'')::date,(j->>''fecha'')::date)>=$3))) select coalesce((select jsonb_agg(j order by j->>''fecha'',j->>''id'') from (select j from filtered order by j->>''fecha'',j->>''id'' limit $5 offset $6) page),''[]''::jsonb), (select count(*)::integer from filtered)';
 execute v_query into v_rows,v_total using p_id,p_search,v_start,v_end,p_limit,p_offset;
 return jsonb_build_object('profile',v_profile,'read_only',true,'resource',p_resource,'as_of',now(),'timezone','Europe/Madrid','from',v_start,'to',v_end,'total',v_total,'offset',p_offset,'has_more',p_offset+jsonb_array_length(v_rows)<v_total,'rows',v_rows,'source','APP GESTIÓN LIMPATEX / '||p_resource,'notice','Datos de consulta. Importes registrados no equivalen a margen ni contabilidad cerrada. Stock conserva su base de cálculo y fecha de recuento.');
end $$;
reset role;
revoke create on schema public from limpatex_bot_reader;
grant limpatex_bot_reader to postgres with set false;
notify pgrst,'reload schema';
