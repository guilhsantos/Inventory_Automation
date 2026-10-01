-- =============================================================================
-- 003 - Excluir usuário mantendo o histórico
-- * O login (auth.users) é apagado: a pessoa não consegue mais entrar.
-- * O perfil (profiles) fica como registro histórico (excluido_em preenchido),
--   para que produção, defeitos, movimentações e reservas continuem mostrando
--   quem fez cada lançamento.
-- * Remove a delete_user_entirely, que podia ser chamada por qualquer um
--   (inclusive sem login) e apagava qualquer usuário.
-- Idempotente: pode ser executado mais de uma vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Perfil passa a sobreviver à exclusão do login
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists excluido_em    timestamptz;
alter table public.profiles add column if not exists email_excluido text;

-- Garante perfil para todo login existente (necessário para as FKs abaixo)
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', '')
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

-- profiles.id não pode mais ser apagado em cascata junto com auth.users
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- -----------------------------------------------------------------------------
-- Tabelas de histórico passam a apontar para profiles (e não para auth.users)
-- -----------------------------------------------------------------------------
alter table public.daily_production drop constraint if exists daily_production_usuario_id_fkey;
alter table public.daily_production add constraint daily_production_usuario_id_fkey
  foreign key (usuario_id) references public.profiles (id);

alter table public.order_item_reservations drop constraint if exists order_item_reservations_created_by_fkey;
alter table public.order_item_reservations add constraint order_item_reservations_created_by_fkey
  foreign key (created_by) references public.profiles (id);

alter table public.order_item_reservations drop constraint if exists order_item_reservations_consumed_by_fkey;
alter table public.order_item_reservations add constraint order_item_reservations_consumed_by_fkey
  foreign key (consumed_by) references public.profiles (id);

alter table public.order_item_reservations drop constraint if exists order_item_reservations_reversed_by_fkey;
alter table public.order_item_reservations add constraint order_item_reservations_reversed_by_fkey
  foreign key (reversed_by) references public.profiles (id);

-- -----------------------------------------------------------------------------
-- delete_user_keep_history: somente ADMIN, nunca a si mesmo
-- -----------------------------------------------------------------------------
create or replace function public.delete_user_keep_history(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not exists (
    select 1 from public.profiles
     where id = v_caller and role::text = 'ADMIN' and excluido_em is null
  ) then
    raise exception 'Apenas administradores podem excluir usuários';
  end if;
  if p_user_id = v_caller then
    raise exception 'Você não pode excluir o seu próprio usuário';
  end if;

  update public.profiles
     set excluido_em    = now(),
         email_excluido = coalesce(email_excluido, email),
         email          = null   -- libera o e-mail para um novo cadastro
   where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_keep_history(uuid) from public, anon;
grant execute on function public.delete_user_keep_history(uuid) to authenticated;

drop function if exists public.delete_user_entirely(uuid);

commit;
