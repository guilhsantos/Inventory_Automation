-- =============================================================================
-- 006 - Novo papel PENDENTE (parte 1 de 2)
-- Fica em arquivo separado porque o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado. Rode este ANTES do 007.
-- =============================================================================

alter type public.user_role add value if not exists 'PENDENTE';
