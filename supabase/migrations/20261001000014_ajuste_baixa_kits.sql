-- =============================================================================
-- 014 - Baixa manual de kits (ajuste de estoque, temporário)
-- Só ADMIN. Tira kits do estoque SEM devolver as peças (moldes) ao estoque:
-- serve para acertar o saldo de kits. Fica registrado em stock_movements
-- (OUT / movement_kind = 'ajuste') para histórico.
-- Idempotente.
-- =============================================================================

begin;

create or replace function public.remove_kit_stock(
  p_kit_id     bigint,
  p_quantidade integer,
  p_motivo     text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_nome    text;
  v_estoque integer;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir kits do estoque';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero';
  end if;

  select nome_kit, estoque_atual into v_nome, v_estoque from kits where id = p_kit_id for update;
  if not found then
    raise exception 'Kit não encontrado';
  end if;
  if p_quantidade > v_estoque then
    raise exception 'O kit % tem só % unidade(s) em estoque', v_nome, v_estoque;
  end if;

  update kits set estoque_atual = estoque_atual - p_quantidade where id = p_kit_id;

  insert into stock_movements (kit_id, user_id, type, quantity, notes, movement_kind)
  values (p_kit_id, v_user, 'OUT', p_quantidade,
          'Ajuste manual: exclusão de kits sem devolver peças'
            || coalesce(' - ' || nullif(btrim(p_motivo), ''), ''),
          'ajuste');

  return v_estoque - p_quantidade;
end;
$$;

revoke all on function public.remove_kit_stock(bigint, integer, text) from public, anon;
grant execute on function public.remove_kit_stock(bigint, integer, text) to authenticated;

commit;
