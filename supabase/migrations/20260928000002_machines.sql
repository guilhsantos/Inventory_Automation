-- =============================================================================
-- 002 - Máquinas: molde atual + status (Em operação / Parada / Manutenção)
-- Requer a 001. Idempotente: pode ser executado mais de uma vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Colunas novas e padronização do status
-- -----------------------------------------------------------------------------
alter table public.machines add column if not exists current_molde_id  bigint references public.moldes (id) on delete set null;
alter table public.machines add column if not exists status_observacao text;
alter table public.machines add column if not exists status_updated_at timestamptz;
alter table public.machines add column if not exists status_updated_by uuid references public.profiles (id);

update public.machines
   set status = 'EM_OPERACAO'
 where status is null or status not in ('EM_OPERACAO', 'PARADA', 'MANUTENCAO');

alter table public.machines alter column status set default 'EM_OPERACAO';
alter table public.machines alter column status set not null;

alter table public.machines drop constraint if exists machines_status_check;
alter table public.machines add constraint machines_status_check
  check (status in ('EM_OPERACAO', 'PARADA', 'MANUTENCAO'));

-- -----------------------------------------------------------------------------
-- Histórico de mudanças de status / molde
-- -----------------------------------------------------------------------------
create table if not exists public.machine_status_log (
  id          bigserial primary key,
  machine_id  bigint      not null references public.machines (id) on delete cascade,
  status      text        not null,
  molde_id    bigint      references public.moldes (id) on delete set null,
  observacao  text,
  user_id     uuid        references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index if not exists machine_status_log_machine_created_idx
  on public.machine_status_log (machine_id, created_at desc);

create index if not exists daily_production_machine_created_idx
  on public.daily_production (machine_id, created_at desc);

-- -----------------------------------------------------------------------------
-- set_machine_state: operador define o molde e/ou o status da máquina
-- -----------------------------------------------------------------------------
create or replace function public.set_machine_state(
  p_machine_id bigint,
  p_status     text,
  p_molde_id   bigint,
  p_observacao text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_obs  text := nullif(btrim(p_observacao), '');
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
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
-- register_production: agora exige máquina em operação e usa o molde dela
-- (mesma assinatura da 001, só acrescenta as validações da máquina)
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
  v_machine record;
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

revoke all on function public.set_machine_state(bigint, text, bigint, text) from public, anon;
grant execute on function public.set_machine_state(bigint, text, bigint, text) to authenticated;

commit;
