-- =============================================================================
-- 010 - Máquina parada fica sem molde
-- Ao marcar PARADA o molde atual é removido; ao voltar para operação o
-- operador informa de novo qual molde está na máquina. Manutenção mantém o
-- molde. Mesma função da 005, só muda o molde gravado quando PARADA.
-- Requer 004/005. Idempotente.
-- =============================================================================

begin;

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
  v_user  uuid := auth.uid();
  v_obs   text := nullif(btrim(p_observacao), '');
  v_molde bigint := case when p_status = 'PARADA' then null else p_molde_id end;
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
  if p_status = 'EM_OPERACAO' and v_molde is null then
    raise exception 'Selecione o molde que está na máquina';
  end if;

  update machines
     set status            = p_status,
         current_molde_id  = v_molde,
         status_observacao = case when p_status = 'EM_OPERACAO' then null else v_obs end,
         status_updated_at = now(),
         status_updated_by = v_user
   where id = p_machine_id;
  if not found then
    raise exception 'Máquina não encontrada';
  end if;

  insert into machine_status_log (machine_id, status, molde_id, observacao, user_id)
  values (p_machine_id, p_status, v_molde, v_obs, v_user);
end;
$$;

revoke all on function public.set_machine_state(bigint, text, bigint, text) from public, anon;
grant execute on function public.set_machine_state(bigint, text, bigint, text) to authenticated;

commit;
