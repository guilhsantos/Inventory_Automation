-- =============================================================================
-- 012 - Defeito usa a última máquina que produziu o molde
-- O operador escolhe só o molde; a máquina é a da produção mais recente
-- daquele molde. p_machine_id continua na assinatura (compatibilidade com o
-- app antigo) mas é ignorado. Molde sem produção registrada é recusado.
-- Mesma função da 005 (is_staff, SECURITY DEFINER). Idempotente.
-- =============================================================================

begin;

create index if not exists daily_production_molde_created_idx
  on public.daily_production (molde_id, created_at desc);

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
  v_machine bigint;
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

  select machine_id into v_machine
    from daily_production
   where molde_id = p_molde_id and machine_id is not null
   order by created_at desc
   limit 1;
  if v_machine is null then
    raise exception 'Este molde ainda não teve produção registrada';
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
  values (p_molde_id, v_machine, v_user, p_quantidade, p_motivo)
  returning id into v_id;

  insert into molde_movements (molde_id, delta, saldo_apos, kind, ref_table, ref_id, user_id)
  values (p_molde_id, -p_quantidade, v_estoque - p_quantidade, 'DEFEITO', 'defects', v_id, v_user);

  return v_id;
end;
$$;

revoke all on function public.register_defect(bigint, bigint, integer, text) from public, anon;
grant execute on function public.register_defect(bigint, bigint, integer, text) to authenticated;

commit;
