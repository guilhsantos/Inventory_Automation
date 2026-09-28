-- =============================================================================
-- 004 - Row Level Security em todas as tabelas públicas
-- Antes: RLS desligado em quase tudo e o papel "anon" com permissão total, ou
-- seja, qualquer pessoa com a chave anon (que está no navegador) lia e alterava
-- o banco inteiro sem fazer login.
--
-- Regras:
--   * anon: nenhum acesso (sem GRANT e sem policy).
--   * Leitura: qualquer usuário ativo (ADMIN, OP_ESTOQUE, OP_PRODUCAO).
--     profiles: cada um lê o próprio perfil; ADMIN lê todos.
--   * Cadastros (machines, moldes, kits, kit_items, materials, profiles): só ADMIN.
--   * Pedidos: ADMIN cria/edita/exclui; operador só conclui (checkout) e reserva.
--   * Estoque (saldos, produção, defeitos, entradas de material, status de
--     máquina): somente pelas funções (RPC), que passam a ser SECURITY DEFINER.
--
-- Requer 001, 002 e 003. Idempotente: pode ser executado mais de uma vez.
-- Checklist de testes por papel: 20260928000004_rls_CHECKLIST.md
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Funções auxiliares usadas nas policies
-- SECURITY DEFINER para ler profiles sem cair na própria policy de profiles.
-- -----------------------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
    from profiles
   where id = auth.uid()
     and excluido_em is null
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() = 'ADMIN', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() in ('ADMIN', 'OP_ESTOQUE', 'OP_PRODUCAO'), false)
$$;

-- -----------------------------------------------------------------------------
-- anon: sem acesso a tabelas, sequências e funções do schema public
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Funções: tira de PUBLIC/anon e mantém para authenticated/service_role
-- (o que antes vinha via PUBLIC continua funcionando para quem está logado).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prokind in ('f', 'p')
       and not exists (  -- ignora funções instaladas por extensões
         select 1 from pg_depend d
          where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
       )
  loop
    execute format('revoke execute on routine %s from public, anon', r.sig);
    execute format('grant execute on routine %s to authenticated, service_role', r.sig);
  end loop;
end;
$$;

-- Função antiga (não atômica) que a UI não usa mais: ninguém logado chama
do $$
begin
  if to_regprocedure('public.increment_molde_stock(bigint, integer)') is not null then
    revoke execute on function public.increment_molde_stock(bigint, integer) from authenticated;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPCs de estoque: SECURITY DEFINER
-- Com as tabelas travadas para escrita, as funções precisam gravar como o dono
-- (postgres). Todas já exigem auth.uid() e fixam search_path = public.
-- -----------------------------------------------------------------------------
alter function public.register_production(bigint, bigint, bigint, integer, integer, text, uuid) security definer;
alter function public.register_defect(bigint, bigint, integer, text)                            security definer;
alter function public.assemble_kit(bigint, integer, uuid)                                       security definer;
alter function public.adjust_kit_stock(bigint, integer, boolean)                                security definer;
alter function public.set_machine_state(bigint, text, bigint, text)                             security definer;

-- register_material_entry: só a tela de Material (ADMIN) chama; passa a exigir ADMIN
create or replace function public.register_material_entry(
  p_material_id  bigint,
  p_kg           numeric,
  p_data_chegada date
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_admin() then
    raise exception 'Apenas administradores podem registrar entrada de material';
  end if;
  if p_kg is null or p_kg <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;

  update materials
     set estoque_kg = estoque_kg + p_kg,
         updated_at = now()
   where id = p_material_id
  returning estoque_kg into v_saldo;
  if not found then
    raise exception 'Material não encontrado';
  end if;

  insert into material_entries (material_id, quantidade_kg, data_chegada)
  values (p_material_id, p_kg, p_data_chegada);

  return v_saldo;
end;
$$;

revoke all on function public.register_material_entry(bigint, numeric, date) from public, anon;
grant execute on function public.register_material_entry(bigint, numeric, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Cadastro de usuário: o papel NÃO vem mais do metadata do signUp
-- O signUp é público (chave anon), então qualquer um podia se cadastrar com
-- data.role = 'ADMIN'. Agora todo perfil nasce OP_ESTOQUE; a tela de Usuários
-- (ADMIN) grava o papel escolhido logo depois do signUp.
-- -----------------------------------------------------------------------------
create or replace function public.profiles_force_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := 'OP_ESTOQUE';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_force_default_role on public.profiles;
create trigger profiles_force_default_role
  before insert on public.profiles
  for each row execute function public.profiles_force_default_role();

-- -----------------------------------------------------------------------------
-- Operadores só alteram as colunas que as telas deles alteram
-- (RLS não enxerga OLD, por isso trigger). ADMIN e chamadas sem JWT
-- (SQL Editor / service_role) passam direto.
-- -----------------------------------------------------------------------------
create or replace function public.guard_orders_operator_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_livres text[] := array['status', 'photo_url', 'concluido_em', 'updated_at'];
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres) then
    raise exception 'Operadores só podem concluir o pedido (status, foto e data de conclusão)';
  end if;
  if new.status is distinct from old.status and new.status <> 'Concluído' then
    raise exception 'Operadores só podem mudar o pedido para Concluído';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_orders_operator_update on public.orders;
create trigger guard_orders_operator_update
  before update on public.orders
  for each row execute function public.guard_orders_operator_update();

create or replace function public.guard_order_items_operator_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_livres text[] := array['qty_reserved_total', 'qty_consumed_total', 'updated_at'];
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres) then
    raise exception 'Operadores só podem alterar as quantidades reservadas/baixadas do item';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_order_items_operator_update on public.order_items;
create trigger guard_order_items_operator_update
  before update on public.order_items
  for each row execute function public.guard_order_items_operator_update();

-- As funções criadas acima também não ficam executáveis por anon
revoke all on function public.app_role()                          from public, anon;
revoke all on function public.is_admin()                          from public, anon;
revoke all on function public.is_staff()                          from public, anon;
revoke all on function public.profiles_force_default_role()       from public, anon;
revoke all on function public.guard_orders_operator_update()      from public, anon;
revoke all on function public.guard_order_items_operator_update() from public, anon;
grant execute on function public.app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- -----------------------------------------------------------------------------
-- Liga RLS em TODAS as tabelas do schema public (inclusive as que não estão
-- listadas abaixo: sem policy = só postgres/service_role acessam)
-- e apaga as policies antigas das tabelas do app para recriar do zero.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;

  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'orders', 'order_items', 'order_item_reservations', 'stock_movements',
         'kits', 'kit_items', 'moldes', 'machines', 'materials', 'profiles',
         'daily_production', 'defects', 'material_entries',
         'molde_movements', 'machine_status_log'
       )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Leitura: qualquer usuário ativo
-- (select public.is_staff()) é avaliado uma vez por consulta, não por linha.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_items', 'order_item_reservations', 'stock_movements',
    'kits', 'kit_items', 'moldes', 'machines', 'materials',
    'daily_production', 'defects', 'material_entries',
    'molde_movements', 'machine_status_log'
  ] loop
    execute format(
      'create policy staff_select on public.%I for select to authenticated using ((select public.is_staff()))',
      t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastros: CRUD só ADMIN
-- (saldos de moldes/kits/materials e status de machines mudam pelas RPCs)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['kits', 'kit_items', 'moldes', 'machines', 'materials'] loop
    execute format(
      'create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format(
      'create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format(
      'create policy admin_delete on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy own_or_admin_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy admin_update on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy admin_insert on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));

-- Trigger de cadastro (auth.users -> profiles) caso ela NÃO seja security
-- definer: nesse caso ela roda como supabase_auth_admin e precisa de policy.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create policy auth_admin_insert on public.profiles
      for insert to supabase_auth_admin
      with check (true);
  end if;
end;
$$;

-- Sem policy de DELETE: exclusão de usuário só via delete_user_keep_history.

-- -----------------------------------------------------------------------------
-- Pedidos
-- orders:      ADMIN cria/exclui; ADMIN e operador atualizam (operador limitado
--              pela trigger guard_orders_operator_update ao checkout).
-- order_items: ADMIN cria/exclui; operador atualiza só as quantidades.
-- -----------------------------------------------------------------------------
create policy admin_insert on public.orders
  for insert to authenticated with check ((select public.is_admin()));
create policy staff_update on public.orders
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy admin_delete on public.orders
  for delete to authenticated using ((select public.is_admin()));

create policy admin_insert on public.order_items
  for insert to authenticated with check ((select public.is_admin()));
create policy staff_update on public.order_items
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy admin_delete on public.order_items
  for delete to authenticated using ((select public.is_admin()));

-- Reservas: operador e ADMIN reservam, consomem e revertem (sem DELETE)
create policy staff_insert on public.order_item_reservations
  for insert to authenticated
  with check ((select public.is_staff()) and (created_by is null or created_by = (select auth.uid())));
create policy staff_update on public.order_item_reservations
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Movimentações de kit: a UI registra reserva/baixa/estorno; sem UPDATE/DELETE
create policy staff_insert on public.stock_movements
  for insert to authenticated
  with check ((select public.is_staff()) and (user_id is null or user_id = (select auth.uid())));

-- daily_production, defects, material_entries, molde_movements,
-- machine_status_log: somente leitura para o app; escrita apenas pelas RPCs.

-- -----------------------------------------------------------------------------
-- Aviso: tabelas com RLS ligado e nenhuma policy (ficam inacessíveis ao app)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind = 'r'
       and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  loop
    raise notice 'Tabela public.% está com RLS e SEM policy: só postgres/service_role acessam', r.relname;
  end loop;
end;
$$;

commit;
