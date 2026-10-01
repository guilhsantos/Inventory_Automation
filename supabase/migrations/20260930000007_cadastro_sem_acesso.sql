-- =============================================================================
-- 007 - Cadastro público não dá mais acesso (parte 2 de 2; requer a 006)
--
-- Falha corrigida: o signUp é público (chave anon fica no navegador). Qualquer
-- pessoa criava uma conta, ganhava OP_ESTOQUE e passava a ler pedidos/clientes
-- e mexer no estoque. Agora todo perfil novo nasce PENDENTE, que não está em
-- is_staff() e por isso não lê nem grava nada. A tela de Usuários (ADMIN)
-- grava o papel escolhido logo após o cadastro.
--
-- Também: fixa search_path da handle_new_user (SECURITY DEFINER) e remove
-- funções antigas que gravavam estoque sem transação e que o app não usa mais.
-- Idempotente: pode ser executado mais de uma vez.
-- =============================================================================

begin;

alter table public.profiles alter column role set default 'PENDENTE';

create or replace function public.profiles_force_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := 'PENDENTE';
  end if;
  return new;
end;
$$;

-- Função de cadastro roda como dono: search_path fixo evita sequestro de objetos
alter function public.handle_new_user() set search_path = public;

-- Funções antigas e não usadas pelo app
drop function if exists public.increment_molde_stock(bigint, integer);
drop function if exists public.decrement_material_stock(numeric);
drop function if exists public.baixar_estoque_kit(text, uuid);

commit;

-- -----------------------------------------------------------------------------
-- Depois de rodar: confira se alguém de fora já se cadastrou sozinho.
-- Contas desconhecidas devem ser excluídas pela tela de Usuários.
--
--   select email, full_name, role, created_at
--     from public.profiles
--    where excluido_em is null
--    order by created_at desc;
-- -----------------------------------------------------------------------------
