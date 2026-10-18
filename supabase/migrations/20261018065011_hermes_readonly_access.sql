-- Dedicated credential boundary. No existing user, role or policy is broadened.
-- Credentials are random 256-bit secrets; only their SHA-256 hashes are stored.
-- The exposed function is STABLE, uses a NOLOGIN non-bypass reader owner,
-- validates identity before access and has no arbitrary SQL or write action.
create schema if not exists limpatex_assistant_private;
revoke all on schema limpatex_assistant_private from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='limpatex_bot_reader') then
  create role limpatex_bot_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
 end if;
end $$;
grant usage on schema public,extensions,limpatex_assistant_private to limpatex_bot_reader;
create table limpatex_assistant_private.identities (
 profile text primary key check(profile in ('limpatexconsultor','limpatexoperaciones','limpatexrentabilidad','limpatexcomercial')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 active boolean not null default true,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table limpatex_assistant_private.identities enable row level security;
revoke all on limpatex_assistant_private.identities from public,anon,authenticated;
grant select on limpatex_assistant_private.identities to limpatex_bot_reader;
create policy assistant_identity_reader on limpatex_assistant_private.identities for select to limpatex_bot_reader using(true);
grant select (id,nombre,ciudad,tipo_servicio,is_active,sede_id,updated_at) on public.clients to limpatex_bot_reader;
create policy assistant_scoped_reader on public.clients for select to limpatex_bot_reader using(true);
grant select (id,codigo,nombre,direccion,cliente_id,numero_camas,numero_banos,duracion_servicio,coste_servicio,is_active,sede_id,updated_at) on public.properties to limpatex_bot_reader;
create policy assistant_scoped_reader on public.properties for select to limpatex_bot_reader using(true);
grant select (id,property,date,start_time,end_time,type,status,propiedad_id,cliente_id,cleaner_id,cleaner,duracion,coste,sede_id,updated_at) on public.tasks to limpatex_bot_reader;
create policy assistant_scoped_reader on public.tasks for select to limpatex_bot_reader using(true);
grant select (id,task_id,cleaner_id,cleaner_name) on public.task_assignments to limpatex_bot_reader;
create policy assistant_scoped_reader on public.task_assignments for select to limpatex_bot_reader using(true);
grant select (id,name,is_active,contract_hours_per_week,hourly_rate,sede_id) on public.cleaners to limpatex_bot_reader;
create policy assistant_scoped_reader on public.cleaners for select to limpatex_bot_reader using(true);
grant select (id,cleaner_id,day_of_week,is_available,start_time,end_time) on public.cleaner_availability to limpatex_bot_reader;
create policy assistant_scoped_reader on public.cleaner_availability for select to limpatex_bot_reader using(true);
grant select (id,cleaner_id,start_date,end_date,start_time,end_time) on public.worker_absences to limpatex_bot_reader;
create policy assistant_scoped_reader on public.worker_absences for select to limpatex_bot_reader using(true);
grant select (id,product_id,warehouse_id,current_quantity,minimum_quantity,target_quantity,last_updated,quantity_basis,counted_at) on public.stock_levels to limpatex_bot_reader;
create policy assistant_scoped_reader on public.stock_levels for select to limpatex_bot_reader using(true);
grant select (id,name,unit_of_measure) on public.stock_products to limpatex_bot_reader;
create policy assistant_scoped_reader on public.stock_products for select to limpatex_bot_reader using(true);
grant select (id,name,sede_id,location_type) on public.stock_warehouses to limpatex_bot_reader;
create policy assistant_scoped_reader on public.stock_warehouses for select to limpatex_bot_reader using(true);
grant select (id,receipt_date,counts,discarded_counts,revision,updated_at) on public.laundry_receipts to limpatex_bot_reader;
create policy assistant_scoped_reader on public.laundry_receipts for select to limpatex_bot_reader using(true);
grant select (id,property_id,task_id,status,description,created_at,updated_at,sede_id) on public.cleaning_incidents to limpatex_bot_reader;
create policy assistant_scoped_reader on public.cleaning_incidents for select to limpatex_bot_reader using(true);
grant select (sede_id,document,revision,updated_at) on public.financial_settings to limpatex_bot_reader;
create policy assistant_scoped_reader on public.financial_settings for select to limpatex_bot_reader using(true);
create view limpatex_assistant_private.clientes with (security_invoker=true) as select id,nombre,ciudad,tipo_servicio as servicio,is_active as activo,sede_id,updated_at as actualizado from public.clients;
revoke all on limpatex_assistant_private.clientes from public,anon,authenticated;
grant select on limpatex_assistant_private.clientes to limpatex_bot_reader;
create view limpatex_assistant_private.propiedades with (security_invoker=true) as select p.id,p.codigo,p.nombre,p.direccion,p.cliente_id,c.nombre as cliente,p.numero_camas,p.numero_banos,p.duracion_servicio as minutos_servicio,p.is_active as activo,p.sede_id,p.updated_at as actualizado from public.properties p left join public.clients c on c.id=p.cliente_id;
revoke all on limpatex_assistant_private.propiedades from public,anon,authenticated;
grant select on limpatex_assistant_private.propiedades to limpatex_bot_reader;
create view limpatex_assistant_private.tareas with (security_invoker=true) as select t.id,t.property as propiedad,t.date::date as fecha,t.start_time as inicio,t.end_time as fin,t.type as tipo,t.status as estado,t.propiedad_id,t.cliente_id,t.cleaner_id,t.cleaner as responsable,t.duracion as duracion_registrada,t.sede_id,t.updated_at as actualizado,coalesce((select jsonb_agg(jsonb_build_object('id',a.cleaner_id,'nombre',a.cleaner_name) order by a.cleaner_id) from public.task_assignments a where a.task_id=t.id),'[]'::jsonb) as asignaciones from public.tasks t;
revoke all on limpatex_assistant_private.tareas from public,anon,authenticated;
grant select on limpatex_assistant_private.tareas to limpatex_bot_reader;
create view limpatex_assistant_private.equipo with (security_invoker=true) as select c.id,c.name as nombre,c.is_active as activo,c.contract_hours_per_week as horas_contrato_semanal,c.sede_id,coalesce((select jsonb_agg(jsonb_build_object('dia_semana',a.day_of_week,'disponible',a.is_available,'inicio',a.start_time,'fin',a.end_time) order by a.day_of_week) from public.cleaner_availability a where a.cleaner_id=c.id),'[]'::jsonb) as disponibilidad from public.cleaners c;
revoke all on limpatex_assistant_private.equipo from public,anon,authenticated;
grant select on limpatex_assistant_private.equipo to limpatex_bot_reader;
create view limpatex_assistant_private.ausencias with (security_invoker=true) as select a.id,a.cleaner_id,c.name as nombre,a.start_date as fecha,a.end_date as hasta,a.start_time as inicio,a.end_time as fin,c.sede_id from public.worker_absences a join public.cleaners c on c.id=a.cleaner_id;
revoke all on limpatex_assistant_private.ausencias from public,anon,authenticated;
grant select on limpatex_assistant_private.ausencias to limpatex_bot_reader;
create view limpatex_assistant_private.inventario with (security_invoker=true) as select s.id,p.name as nombre,p.unit_of_measure as unidad,w.name as almacen,w.location_type as tipo_ubicacion,w.sede_id,s.product_id,s.warehouse_id,s.current_quantity as cantidad,s.minimum_quantity as minimo,s.target_quantity as objetivo,s.quantity_basis as base_cantidad,s.counted_at as recuento_fisico,s.last_updated as actualizado from public.stock_levels s join public.stock_products p on p.id=s.product_id join public.stock_warehouses w on w.id=s.warehouse_id;
revoke all on limpatex_assistant_private.inventario from public,anon,authenticated;
grant select on limpatex_assistant_private.inventario to limpatex_bot_reader;
create view limpatex_assistant_private.lavanderia with (security_invoker=true) as select id,receipt_date as fecha,counts as recibido,discarded_counts as descartado,revision,updated_at as actualizado from public.laundry_receipts;
revoke all on limpatex_assistant_private.lavanderia from public,anon,authenticated;
grant select on limpatex_assistant_private.lavanderia to limpatex_bot_reader;
create view limpatex_assistant_private.incidencias with (security_invoker=true) as select i.id,i.property_id as propiedad_id,p.nombre as propiedad,i.task_id,i.status as estado,i.description as descripcion,i.created_at::date as fecha,i.sede_id,i.updated_at as actualizado from public.cleaning_incidents i left join public.properties p on p.id=i.property_id;
revoke all on limpatex_assistant_private.incidencias from public,anon,authenticated;
grant select on limpatex_assistant_private.incidencias to limpatex_bot_reader;
create view limpatex_assistant_private.tarifas with (security_invoker=true) as select p.id,p.codigo,p.nombre,p.cliente_id,c.nombre as cliente,p.coste_servicio as importe_servicio_registrado,p.duracion_servicio as minutos_servicio,p.sede_id,p.updated_at as actualizado from public.properties p left join public.clients c on c.id=p.cliente_id;
revoke all on limpatex_assistant_private.tarifas from public,anon,authenticated;
grant select on limpatex_assistant_private.tarifas to limpatex_bot_reader;
create view limpatex_assistant_private.importes_servicios with (security_invoker=true) as select id,property as propiedad,date::date as fecha,type as tipo,status as estado,propiedad_id,cliente_id,coste as importe_registrado,duracion as duracion_registrada,sede_id,updated_at as actualizado from public.tasks;
revoke all on limpatex_assistant_private.importes_servicios from public,anon,authenticated;
grant select on limpatex_assistant_private.importes_servicios to limpatex_bot_reader;
create view limpatex_assistant_private.costes_personal with (security_invoker=true) as select id,name as nombre,hourly_rate as tarifa_hora_registrada,contract_hours_per_week as horas_contrato_semanal,is_active as activo,sede_id from public.cleaners;
revoke all on limpatex_assistant_private.costes_personal from public,anon,authenticated;
grant select on limpatex_assistant_private.costes_personal to limpatex_bot_reader;
create view limpatex_assistant_private.ajustes_financieros with (security_invoker=true) as select sede_id as id,sede_id,jsonb_build_object('version',document->'version','rates',document->'rates','adjustments',document->'adjustments','expenses',document->'expenses','incomes',document->'incomes','policies',document->'policies') as configuracion,revision,updated_at as actualizado from public.financial_settings;
revoke all on limpatex_assistant_private.ajustes_financieros from public,anon,authenticated;
grant select on limpatex_assistant_private.ajustes_financieros to limpatex_bot_reader;

create function public.limpatex_assistant_read(
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
 when 'limpatexconsultor' then v_allowed:=array['clientes','propiedades','tareas','equipo','ausencias','inventario','lavanderia','incidencias','tarifas','importes_servicios','costes_personal','ajustes_financieros'];
 when 'limpatexoperaciones' then v_allowed:=array['clientes','propiedades','tareas','equipo','ausencias','inventario','lavanderia','incidencias'];
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
grant create on schema public to limpatex_bot_reader;
alter function public.limpatex_assistant_read(text,text,date,date,text,uuid,integer,integer) owner to limpatex_bot_reader;
revoke create on schema public from limpatex_bot_reader;
revoke all on function public.limpatex_assistant_read(text,text,date,date,text,uuid,integer,integer) from public;
grant execute on function public.limpatex_assistant_read(text,text,date,date,text,uuid,integer,integer) to anon,authenticated;
comment on function public.limpatex_assistant_read(text,text,date,date,text,uuid,integer,integer) is 'Authenticated by dedicated revocable assistant secret, not a Supabase user session. Read-only scoped interface; no write counterpart.';
notify pgrst,'reload schema';
