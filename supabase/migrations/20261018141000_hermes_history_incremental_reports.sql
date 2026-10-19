-- Authorized read-only history extension. No business DML, triggers or write RPC.
grant select (additional_tasks) on public.tasks to limpatex_bot_reader;
grant select (updated_at) on public.task_assignments to limpatex_bot_reader;
grant select (id,task_id,cleaner_id,checklist_template_id,checklist_completed,overall_status,start_time,end_time,created_at,updated_at) on public.task_reports to limpatex_bot_reader;
grant select (id,checklist_items,updated_at) on public.task_checklists_templates to limpatex_bot_reader;
grant select (id,task_report_id,checklist_item_id,media_type,file_url,created_at) on public.task_media to limpatex_bot_reader;
create policy assistant_history_reader on public.task_reports for select to limpatex_bot_reader using (true);
create policy assistant_history_reader on public.task_checklists_templates for select to limpatex_bot_reader using (true);
create policy assistant_history_reader on public.task_media for select to limpatex_bot_reader using (true);

create view limpatex_assistant_private.reportes_historial with (security_invoker=true) as
select r.id,r.task_id,r.updated_at,
 greatest(r.updated_at,c.updated_at,(select max(m.created_at) from public.task_media m where m.task_report_id=r.id)) as modificado,
 jsonb_build_object('id',r.id,'trabajador_id',r.cleaner_id,'estado',r.overall_status,
 'inicio',r.start_time,'fin',r.end_time,'creado',r.created_at,'actualizado',r.updated_at,
 'plantilla_id',r.checklist_template_id,'plantilla_actualizada',c.updated_at,
 'plantilla_valida',c.id is not null and jsonb_typeof(c.checklist_items)='array',
 'requisitos',coalesce((select jsonb_agg(jsonb_build_object('clave',(cat->>'id')||'.'||(item->>'id'),
   'obligatorio',item->'required'='true'::jsonb,'foto',item->'photo_required'='true'::jsonb) order by cat->>'id',item->>'id')
   from jsonb_array_elements(case when jsonb_typeof(c.checklist_items)='array' then c.checklist_items else '[]'::jsonb end) cat
   cross join lateral jsonb_array_elements(case when jsonb_typeof(cat->'items')='array' then cat->'items' else '[]'::jsonb end) item),'[]'::jsonb),
 'checklist_valido',jsonb_typeof(r.checklist_completed)='object',
 'puntos',coalesce((select jsonb_object_agg(e.key,jsonb_build_object('completado',e.value->'completed'='true'::jsonb,
   'adjuntos',(select count(*) from public.task_media m where m.task_report_id=r.id and m.media_type::text in ('photo','video') and nullif(m.file_url,'') is not null
     and (m.checklist_item_id=e.key or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(e.value->'media_urls')='array' then e.value->'media_urls' else '[]'::jsonb end) u where u=m.file_url)))))
   from jsonb_each(case when jsonb_typeof(r.checklist_completed)='object' then r.checklist_completed else '{}'::jsonb end) e),'{}'::jsonb)) as contenido
from public.task_reports r left join public.task_checklists_templates c on c.id=r.checklist_template_id;
revoke all on limpatex_assistant_private.reportes_historial from public,anon,authenticated;
grant select on limpatex_assistant_private.reportes_historial to limpatex_bot_reader;

create view limpatex_assistant_private.paquetes_historial with (security_invoker=true) as
select t.id,t.fecha,
 greatest(t.actualizado,(select max(a.updated_at) from public.task_assignments a where a.task_id=t.id),
 (select max(r.modificado) from limpatex_assistant_private.reportes_historial r where r.task_id=t.id)) as modificado,
 to_jsonb(t) || jsonb_build_object(
 'adicionales_validos',raw.additional_tasks is null or jsonb_typeof(raw.additional_tasks)='array',
 'adicionales',coalesce((select jsonb_agg(jsonb_build_object('clave','additional.'||(a->>'id'),'completado',a->'completed'='true'::jsonb,'foto',a->'photoRequired'='true'::jsonb) order by a->>'id')
 from jsonb_array_elements(case when jsonb_typeof(raw.additional_tasks)='array' then raw.additional_tasks else '[]'::jsonb end) a),'[]'::jsonb),
 'reportes',coalesce((select jsonb_agg(r.contenido order by r.id) from limpatex_assistant_private.reportes_historial r where r.task_id=t.id),'[]'::jsonb)) as contenido
from limpatex_assistant_private.tareas t join public.tasks raw on raw.id=t.id;
revoke all on limpatex_assistant_private.paquetes_historial from public,anon,authenticated;
grant select on limpatex_assistant_private.paquetes_historial to limpatex_bot_reader;

grant limpatex_bot_reader to postgres with set true;
grant create on schema public to limpatex_bot_reader;
set local role limpatex_bot_reader;
create function public.limpatex_assistant_history(p_token text,p_mode text default 'manifest',p_to date default null,
 p_since timestamptz default null,p_recent_from date default null,p_after uuid default null,p_ids uuid[] default null)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='20s' as $$
declare v_profile text; v_to date; v_rows jsonb;
begin
 if p_token is null or length(p_token)<40 or length(p_token)>100 then raise exception using errcode='28000',message='Identidad no valida'; end if;
 select profile into v_profile from limpatex_assistant_private.identities where active and expires_at>now() and token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if v_profile is null then raise exception using errcode='28000',message='Identidad no valida'; end if;
 if v_profile not in ('limpatexconsultor','limpatexoperaciones') then raise exception using errcode='42501',message='Historico detallado no autorizado'; end if;
 v_to:=coalesce(p_to,(now() at time zone 'Europe/Madrid')::date+14);
 if p_mode is null or p_mode not in ('manifest','rows') or v_to<date '2026-06-01' or v_to>(now() at time zone 'Europe/Madrid')::date+14
 or (p_ids is not null and (cardinality(p_ids)>100 or cardinality(p_ids)=0)) then raise exception using errcode='22023',message='Consulta no valida'; end if;
 if p_mode='rows' then
  if p_ids is null then raise exception using errcode='22023',message='Identificadores obligatorios'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',md5(contenido::text),'contenido',contenido) order by id),'[]'::jsonb) into v_rows from limpatex_assistant_private.paquetes_historial
   where id=any(p_ids) and fecha between date '2026-06-01' and v_to;
 else
  if p_ids is not null then raise exception using errcode='22023',message='Identificadores no admitidos'; end if;
  select coalesce(jsonb_agg(j order by id),'[]'::jsonb) into v_rows from
  (select id,jsonb_build_object('id',id,'fecha',fecha,'version',md5(contenido::text),'contenido_hash',encode(extensions.digest(contenido::text,'sha256'),'hex')) j
   from limpatex_assistant_private.paquetes_historial
   where (p_after is null or id>p_after) and
   ((fecha between date '2026-06-01' and v_to and (p_since is null or modificado>=p_since or fecha>=p_recent_from))
    or (p_since is not null and modificado>=p_since)) order by id limit 500) page;
 end if;
 return jsonb_build_object('profile',v_profile,'read_only',true,'mode',p_mode,'server_time',now(),'rows',v_rows);
end $$;
revoke all on function public.limpatex_assistant_history(text,text,date,timestamptz,date,uuid,uuid[]) from public;
grant execute on function public.limpatex_assistant_history(text,text,date,timestamptz,date,uuid,uuid[]) to anon,authenticated;
reset role;
revoke create on schema public from limpatex_bot_reader;
grant limpatex_bot_reader to postgres with set false;
notify pgrst,'reload schema';
