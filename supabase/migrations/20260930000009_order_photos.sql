-- =============================================================================
-- 009 - Várias fotos por pedido
-- orders.photo_url continua existindo como "capa" (primeira foto), para as
-- telas que já usam esse campo; todas as fotos ficam em order_photos.
-- Requer 004 (is_staff / is_admin). Idempotente.
-- =============================================================================

begin;

create table if not exists public.order_photos (
  id           bigserial primary key,
  order_id     bigint      not null references public.orders (id) on delete cascade,
  url          text        not null,
  storage_path text,
  position     smallint    not null default 0,
  created_by   uuid        references public.profiles (id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists order_photos_order_idx on public.order_photos (order_id, position);

-- Fotos já existentes passam a constar na tabela nova
insert into public.order_photos (order_id, url, position, created_by, created_at)
select o.id, o.photo_url, 0, null, coalesce(o.concluido_em, o.created_at)
  from public.orders o
 where o.photo_url is not null
   and not exists (select 1 from public.order_photos p where p.order_id = o.id);

alter table public.order_photos enable row level security;

drop policy if exists staff_select on public.order_photos;
create policy staff_select on public.order_photos
  for select to authenticated
  using ((select public.is_staff()));

-- Operador anexa fotos em nome próprio, só no bucket do app
drop policy if exists staff_insert on public.order_photos;
create policy staff_insert on public.order_photos
  for insert to authenticated
  with check (
    (select public.is_staff())
    and created_by = (select auth.uid())
    and url like '%/storage/v1/object/public/order-photos/%'
  );

-- Remover fotos só o ADMIN (ex.: voltar pedido para Pendente)
drop policy if exists admin_delete on public.order_photos;
create policy admin_delete on public.order_photos
  for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.order_photos from anon;
grant select, insert, delete on public.order_photos to authenticated;
grant usage, select on sequence public.order_photos_id_seq to authenticated;

commit;
