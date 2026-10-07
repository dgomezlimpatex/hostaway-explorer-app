-- Only finance configuration. No changes to tasks, properties, stock or existing permissions.
create table public.financial_settings (
  sede_id uuid primary key references public.sedes(id) on delete restrict,
  document jsonb not null check (coalesce(jsonb_typeof(document) = 'object' and document->>'version' = '1'
    and jsonb_typeof(document->'rates') = 'array' and jsonb_typeof(document->'expenses') = 'array'
    and jsonb_typeof(document->'adjustments') = 'object', false) and octet_length(document::text) <= 5000000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.financial_settings enable row level security;
revoke all on public.financial_settings from public, anon, authenticated;
grant select, insert, update on public.financial_settings to authenticated;
grant all on public.financial_settings to service_role;
create policy financial_settings_read on public.financial_settings for select to authenticated
  using (sede_id = any(public.get_user_accessible_sedes()) and
    (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)));
create policy financial_settings_insert on public.financial_settings for insert to authenticated
  with check (sede_id = any(public.get_user_accessible_sedes()) and
    (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)));
create policy financial_settings_update on public.financial_settings for update to authenticated
  using (sede_id = any(public.get_user_accessible_sedes()) and
    (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)))
  with check (sede_id = any(public.get_user_accessible_sedes()) and
    (public.has_role(auth.uid(), 'admin'::public.app_role) or public.has_role(auth.uid(), 'manager'::public.app_role)));
create function public.stamp_financial_settings() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and (new.sede_id <> old.sede_id or new.revision <> old.revision + 1) then
    raise exception 'Invalid financial revision';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function public.stamp_financial_settings() from public, anon, authenticated;
create trigger stamp_financial_settings before insert or update on public.financial_settings
  for each row execute function public.stamp_financial_settings();
