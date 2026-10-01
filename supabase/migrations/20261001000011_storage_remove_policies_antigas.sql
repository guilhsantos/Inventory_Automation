-- =============================================================================
-- 011 - Remove policies antigas do bucket order-photos (encontradas em produção)
-- * "Users can upload order photos": qualquer logado (inclusive PENDENTE)
--   enviava arquivos; como policies se somam (OR), anulava a regra da 008.
-- * "Public can view order photos": permitia LISTAR todas as fotos. O bucket é
--   público, então o link /object/public/... funciona sem policy de SELECT.
-- Fica valendo só staff_insert_order_photos (008). Idempotente.
-- =============================================================================

begin;

drop policy if exists "Users can upload order photos" on storage.objects;
drop policy if exists "Public can view order photos" on storage.objects;

commit;
