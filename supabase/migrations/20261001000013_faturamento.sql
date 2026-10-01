-- =============================================================================
-- 013 - Data de faturamento do pedido
-- Informada (obrigatória) ao marcar o pedido como Entregue, junto com a NF.
-- É uma data própria, sempre anterior ou igual ao dia da entrega.
-- Pedidos entregues antes desta migração ficam sem data (null).
-- Idempotente.
-- =============================================================================

begin;

alter table public.orders add column if not exists faturado_em date;

alter table public.orders drop constraint if exists orders_faturado_antes_entrega;
alter table public.orders add constraint orders_faturado_antes_entrega
  check (
    faturado_em is null
    or entregue_em is null
    or faturado_em <= (entregue_em at time zone 'America/Sao_Paulo')::date
  );

create index if not exists orders_faturado_em_idx on public.orders (faturado_em);

commit;
