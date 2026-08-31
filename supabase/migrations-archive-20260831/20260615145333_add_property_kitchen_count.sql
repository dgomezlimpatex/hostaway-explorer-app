alter table public.properties
add column if not exists numero_cocinas integer not null default 1;

alter table public.properties
add constraint properties_numero_cocinas_non_negative
check (numero_cocinas >= 0);
