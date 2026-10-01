-- =============================================================================
-- 001 - Estoque atômico
-- Corrige o bug de produção que "às vezes não atualiza o estoque":
--   * telas liam o estoque e gravavam um valor ABSOLUTO (lost update);
--   * a produção eram 3 gravações separadas, sem transação e sem checar erro.
-- Todas as mudanças de estoque passam a ser feitas por funções que rodam numa
-- única transação e atualizam RELATIVO ao valor atual (estoque = estoque + delta).
-- Idempotente: pode ser executado mais de uma vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Saldos nunca nulos (NULL + n = NULL, o que "some" com o incremento)
-- -----------------------------------------------------------------------------
update public.moldes    set estoque_atual = 0 where estoque_atual is null;
update public.kits      set estoque_atual = 0 where estoque_atual is null;
update public.materials set estoque_kg    = 0 where estoque_kg    is null;

alter table public.moldes    alter column estoque_atual set default 0, alter column estoque_atual set not null;
alter table public.kits      alter column estoque_atual set default 0, alter column estoque_atual set not null;
alter table public.materials alter column estoque_kg    set default 0, alter column estoque_kg    set not null;

-- -----------------------------------------------------------------------------
-- Novas colunas
-- -----------------------------------------------------------------------------
alter table public.daily_production add column if not exists observacao text;
alter table public.daily_production add column if not exists request_id uuid;
create unique index if not exists daily_production_request_id_key
  on public.daily_production (request_id);

alter table public.stock_movements add column if not exists request_id uuid;
create unique index if not exists stock_movements_request_id_key
  on public.stock_movements (request_id);

-- -----------------------------------------------------------------------------
-- Livro-razão de peças avulsas: toda mudança de moldes.estoque_atual fica
-- registrada, com o saldo resultante. Permite auditar o estoque de peças.
-- -----------------------------------------------------------------------------
create table if not exists public.molde_movements (
  id          bigserial primary key,
  molde_id    bigint      not null references public.moldes (id) on delete cascade,
  delta       integer     not null,
  saldo_apos  integer     not null,
  kind        text        not null check (kind in ('PRODUCAO', 'DEFEITO', 'MONTAGEM_KIT', 'AJUSTE')),
  ref_table   text,
  ref_id      bigint,
  user_id     uuid        references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index if not exists molde_movements_molde_created_idx
  on public.molde_movements (molde_id, created_at desc);

-- -----------------------------------------------------------------------------
-- register_production: produção de peças avulsas numa única transação
-- -----------------------------------------------------------------------------
create or replace function public.register_production(
  p_machine_id  bigint,
  p_molde_id    bigint,
  p_material_id bigint,
  p_quantidade  integer,
  p_sacos       integer,
  p_observacao  text default null,
  p_request_id  uuid default null
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_kg      numeric;
  v_estoque numeric;
  v_saldo   integer;
  v_id      bigint;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade produzida deve ser maior que zero';
  end if;
  if coalesce(p_sacos, 0) < 0 then
    raise exception 'A quantidade de sacos não pode ser negativa';
  end if;

  -- Idempotência: o mesmo envio (duplo clique / reenvio) não conta duas vezes
  if p_request_id is not null then
    select id into v_id from daily_production where request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;

  v_kg := coalesce(p_sacos, 0) * 25;

  select estoque_kg into v_estoque from materials where id = p_material_id for update;
  if not found then
    raise exception 'Material não encontrado';
  end if;
  if v_estoque < v_kg then
    raise exception 'Material insuficiente: disponível % kg, necessário % kg', v_estoque, v_kg;
  end if;

  update moldes
     set estoque_atual = estoque_atual + p_quantidade
   where id = p_molde_id
  returning estoque_atual into v_saldo;
  if not found then
    raise exception 'Peça (molde) não encontrada';
  end if;

  update materials
     set estoque_kg = estoque_kg - v_kg,
         updated_at = now()
   where id = p_material_id;

  insert into daily_production
    (molde_id, machine_id, material_id, usuario_id, quantidade_boa, sacos_usados, observacao, request_id)
  values
    (p_molde_id, p_machine_id, p_material_id, v_user, p_quantidade, coalesce(p_sacos, 0),
     nullif(btrim(p_observacao), ''), p_request_id)
  returning id into v_id;

  insert into molde_movements (molde_id, delta, saldo_apos, kind, ref_table, ref_id, user_id)
  values (p_molde_id, p_quantidade, v_saldo, 'PRODUCAO', 'daily_production', v_id, v_user);

  return v_id;
exception
  when unique_violation then
    -- Dois envios simultâneos com o mesmo request_id: devolve o que já foi gravado
    if p_request_id is not null then
      select id into v_id from daily_production where request_id = p_request_id;
      if found then
        return v_id;
      end if;
    end if;
    raise;
end;
$$;

-- -----------------------------------------------------------------------------
-- register_defect: registra defeito e desconta a peça numa única transação
-- -----------------------------------------------------------------------------
create or replace function public.register_defect(
  p_molde_id   bigint,
  p_machine_id bigint,
  p_quantidade integer,
  p_motivo     text default null
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_nome    text;
  v_estoque integer;
  v_id      bigint;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;

  select nome, estoque_atual into v_nome, v_estoque from moldes where id = p_molde_id for update;
  if not found then
    raise exception 'Peça (molde) não encontrada';
  end if;
  if v_estoque < p_quantidade then
    raise exception 'Estoque insuficiente de %: disponível %, faltam % unidade(s)',
      v_nome, v_estoque, p_quantidade - v_estoque;
  end if;

  update moldes set estoque_atual = estoque_atual - p_quantidade where id = p_molde_id;

  insert into defects (molde_id, machine_id, user_id, quantity, reason)
  values (p_molde_id, p_machine_id, v_user, p_quantidade, p_motivo)
  returning id into v_id;

  insert into molde_movements (molde_id, delta, saldo_apos, kind, ref_table, ref_id, user_id)
  values (p_molde_id, -p_quantidade, v_estoque - p_quantidade, 'DEFEITO', 'defects', v_id, v_user);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- assemble_kit: monta N kits (scanner) descontando as peças numa transação
-- Retorna o novo estoque do kit.
-- -----------------------------------------------------------------------------
create or replace function public.assemble_kit(
  p_kit_id     bigint,
  p_quantidade integer,
  p_request_id uuid default null
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_item     record;
  v_faltando text := '';
  v_saldo    integer;
  v_mov_id   bigint;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade de kits deve ser maior que zero';
  end if;

  if p_request_id is not null and exists (select 1 from stock_movements where request_id = p_request_id) then
    select estoque_atual into v_saldo from kits where id = p_kit_id;
    return v_saldo;
  end if;

  -- Trava as peças do kit (ordem fixa por id evita deadlock) e valida o saldo
  for v_item in
    select m.id, m.nome, m.estoque_atual, sum(ki.quantidade)::integer * p_quantidade as necessario
      from kit_items ki
      join moldes m on m.id = ki.molde_id
     where ki.kit_id = p_kit_id
     group by m.id, m.nome, m.estoque_atual
     order by m.id
  loop
    perform 1 from moldes where id = v_item.id for update;
  end loop;

  for v_item in
    select m.id, m.nome, m.estoque_atual, sum(ki.quantidade)::integer * p_quantidade as necessario
      from kit_items ki
      join moldes m on m.id = ki.molde_id
     where ki.kit_id = p_kit_id
     group by m.id, m.nome, m.estoque_atual
     order by m.id
  loop
    if v_item.estoque_atual < v_item.necessario then
      v_faltando := v_faltando || E'\n' || v_item.nome || ' - faltam ' ||
                    (v_item.necessario - v_item.estoque_atual) || ' unidade(s)';
    end if;
  end loop;

  if v_faltando <> '' then
    raise exception 'Não há peças avulsas suficientes para % kit(s):%', p_quantidade, v_faltando;
  end if;

  update kits
     set estoque_atual = estoque_atual + p_quantidade
   where id = p_kit_id
  returning estoque_atual into v_saldo;
  if not found then
    raise exception 'Kit não encontrado';
  end if;

  insert into stock_movements (kit_id, user_id, type, quantity, notes, request_id)
  values (p_kit_id, v_user, 'IN', p_quantidade,
          'Entrada via scanner (' || p_quantidade || ' kit(s))', p_request_id)
  returning id into v_mov_id;

  for v_item in
    select m.id, sum(ki.quantidade)::integer * p_quantidade as necessario
      from kit_items ki
      join moldes m on m.id = ki.molde_id
     where ki.kit_id = p_kit_id
     group by m.id
     order by m.id
  loop
    with upd as (
      update moldes set estoque_atual = estoque_atual - v_item.necessario
       where id = v_item.id
      returning estoque_atual
    )
    insert into molde_movements (molde_id, delta, saldo_apos, kind, ref_table, ref_id, user_id)
    select v_item.id, -v_item.necessario, upd.estoque_atual, 'MONTAGEM_KIT', 'stock_movements', v_mov_id, v_user
      from upd;
  end loop;

  return v_saldo;
end;
$$;

-- -----------------------------------------------------------------------------
-- adjust_kit_stock: ajuste relativo do estoque de kits (reserva, baixa, estorno)
-- p_clamp_zero = true mantém o comportamento antigo de nunca ficar negativo.
-- Retorna o novo estoque.
-- -----------------------------------------------------------------------------
create or replace function public.adjust_kit_stock(
  p_kit_id     bigint,
  p_delta      integer,
  p_clamp_zero boolean default true
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_saldo integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  update kits
     set estoque_atual = case when p_clamp_zero
                              then greatest(0, estoque_atual + p_delta)
                              else estoque_atual + p_delta end
   where id = p_kit_id
  returning estoque_atual into v_saldo;
  if not found then
    raise exception 'Kit não encontrado';
  end if;

  return v_saldo;
end;
$$;

-- -----------------------------------------------------------------------------
-- register_material_entry: entrada de material (kg) numa única transação
-- Retorna o novo saldo em kg.
-- -----------------------------------------------------------------------------
create or replace function public.register_material_entry(
  p_material_id  bigint,
  p_kg           numeric,
  p_data_chegada date
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
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

-- -----------------------------------------------------------------------------
-- Permissões: somente usuários logados executam as novas funções
-- -----------------------------------------------------------------------------
revoke all on function public.register_production(bigint, bigint, bigint, integer, integer, text, uuid) from public, anon;
revoke all on function public.register_defect(bigint, bigint, integer, text)                            from public, anon;
revoke all on function public.assemble_kit(bigint, integer, uuid)                                       from public, anon;
revoke all on function public.adjust_kit_stock(bigint, integer, boolean)                                from public, anon;
revoke all on function public.register_material_entry(bigint, numeric, date)                            from public, anon;

grant execute on function public.register_production(bigint, bigint, bigint, integer, integer, text, uuid) to authenticated;
grant execute on function public.register_defect(bigint, bigint, integer, text)                            to authenticated;
grant execute on function public.assemble_kit(bigint, integer, uuid)                                       to authenticated;
grant execute on function public.adjust_kit_stock(bigint, integer, boolean)                                to authenticated;
grant execute on function public.register_material_entry(bigint, numeric, date)                            to authenticated;

-- Funções antigas que ninguém deveria chamar anonimamente
-- (a 007 remove a função; o if mantém este script reexecutável)
do $$
begin
  if to_regprocedure('public.increment_molde_stock(bigint, integer)') is not null then
    revoke execute on function public.increment_molde_stock(bigint, integer) from public, anon;
  end if;
end;
$$;

commit;
