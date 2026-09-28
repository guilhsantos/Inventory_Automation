-- =============================================================================
-- 005 - Checagem de papel nas RPCs de estoque
-- A 004 tornou estas funções SECURITY DEFINER (elas ignoram o RLS), mas elas só
-- conferiam auth.uid(). Um usuário excluído com token ainda válido (≈1 h), ou
-- sem perfil ativo, conseguia alterar o estoque. Agora todas exigem
-- public.is_staff() (ADMIN, OP_ESTOQUE ou OP_PRODUCAO com perfil ativo).
--
-- Só acrescenta a checagem: a lógica é a mesma da 001/002.
-- Requer 001, 002, 003 e 004. Idempotente: pode ser executado mais de uma vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- register_production (versão da 002 + checagem de papel)
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
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_machine record;
  v_kg      numeric;
  v_estoque numeric;
  v_saldo   integer;
  v_id      bigint;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_staff() then
    raise exception 'Usuário sem permissão para lançar produção';
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

  select status, current_molde_id into v_machine from machines where id = p_machine_id;
  if not found then
    raise exception 'Máquina não encontrada';
  end if;
  if v_machine.status <> 'EM_OPERACAO' then
    raise exception 'A máquina está % e não pode receber produção',
      case v_machine.status when 'PARADA' then 'parada' else 'em manutenção' end;
  end if;
  if v_machine.current_molde_id is null then
    raise exception 'Defina o molde desta máquina na tela de Operação antes de lançar a produção';
  end if;
  if v_machine.current_molde_id <> p_molde_id then
    raise exception 'O molde informado não é o molde atual da máquina. Atualize a tela e tente novamente';
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
-- register_defect
-- -----------------------------------------------------------------------------
create or replace function public.register_defect(
  p_molde_id   bigint,
  p_machine_id bigint,
  p_quantidade integer,
  p_motivo     text default null
)
returns bigint
language plpgsql
security definer
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
  if not public.is_staff() then
    raise exception 'Usuário sem permissão para registrar defeito';
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
-- assemble_kit
-- -----------------------------------------------------------------------------
create or replace function public.assemble_kit(
  p_kit_id     bigint,
  p_quantidade integer,
  p_request_id uuid default null
)
returns integer
language plpgsql
security definer
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
  if not public.is_staff() then
    raise exception 'Usuário sem permissão para montar kits';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade de kits deve ser maior que zero';
  end if;

  if p_request_id is not null and exists (select 1 from stock_movements where request_id = p_request_id) then
    select estoque_atual into v_saldo from kits where id = p_kit_id;
    return v_saldo;
  end if;

  -- Trava as peças do kit (ordem fixa por id evita deadlock)
  for v_item in
    select m.id
      from kit_items ki
      join moldes m on m.id = ki.molde_id
     where ki.kit_id = p_kit_id
     group by m.id
     order by m.id
  loop
    perform 1 from moldes where id = v_item.id for update;
  end loop;

  -- Valida o saldo já com as linhas travadas
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
-- adjust_kit_stock
-- -----------------------------------------------------------------------------
create or replace function public.adjust_kit_stock(
  p_kit_id     bigint,
  p_delta      integer,
  p_clamp_zero boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_staff() then
    raise exception 'Usuário sem permissão para ajustar o estoque de kits';
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
-- set_machine_state
-- -----------------------------------------------------------------------------
create or replace function public.set_machine_state(
  p_machine_id bigint,
  p_status     text,
  p_molde_id   bigint,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_obs  text := nullif(btrim(p_observacao), '');
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_staff() then
    raise exception 'Usuário sem permissão para alterar máquinas';
  end if;
  if p_status not in ('EM_OPERACAO', 'PARADA', 'MANUTENCAO') then
    raise exception 'Status inválido: %', p_status;
  end if;
  if p_status = 'PARADA' and v_obs is null then
    raise exception 'Informe o motivo da máquina parada';
  end if;
  if p_status = 'EM_OPERACAO' and p_molde_id is null then
    raise exception 'Selecione o molde que está na máquina';
  end if;

  update machines
     set status            = p_status,
         current_molde_id  = p_molde_id,
         status_observacao = case when p_status = 'EM_OPERACAO' then null else v_obs end,
         status_updated_at = now(),
         status_updated_by = v_user
   where id = p_machine_id;
  if not found then
    raise exception 'Máquina não encontrada';
  end if;

  insert into machine_status_log (machine_id, status, molde_id, observacao, user_id)
  values (p_machine_id, p_status, p_molde_id, v_obs, v_user);
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões (create or replace mantém os grants; reforçado por segurança)
-- -----------------------------------------------------------------------------
revoke all on function public.register_production(bigint, bigint, bigint, integer, integer, text, uuid) from public, anon;
revoke all on function public.register_defect(bigint, bigint, integer, text)                            from public, anon;
revoke all on function public.assemble_kit(bigint, integer, uuid)                                       from public, anon;
revoke all on function public.adjust_kit_stock(bigint, integer, boolean)                                from public, anon;
revoke all on function public.set_machine_state(bigint, text, bigint, text)                             from public, anon;

grant execute on function public.register_production(bigint, bigint, bigint, integer, integer, text, uuid) to authenticated;
grant execute on function public.register_defect(bigint, bigint, integer, text)                            to authenticated;
grant execute on function public.assemble_kit(bigint, integer, uuid)                                       to authenticated;
grant execute on function public.adjust_kit_stock(bigint, integer, boolean)                                to authenticated;
grant execute on function public.set_machine_state(bigint, text, bigint, text)                             to authenticated;

commit;
