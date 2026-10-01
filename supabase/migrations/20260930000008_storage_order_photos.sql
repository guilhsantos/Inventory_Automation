-- =============================================================================
-- 008 - Bucket de fotos do checkout (order-photos)
-- * Só imagens, até 10 MB (evita subir HTML/scripts no bucket público)
-- * Envio só por usuário ativo (is_staff); ninguém altera/apaga pelo app
-- Requer 004 (is_staff). Idempotente.
-- =============================================================================

begin;

-- Em produção o bucket já existe; localmente o config.toml cria
update storage.buckets
   set file_size_limit    = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'order-photos';

drop policy if exists "staff_insert_order_photos" on storage.objects;
create policy "staff_insert_order_photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'order-photos' and (select public.is_staff()));

commit;

-- -----------------------------------------------------------------------------
-- Depois de rodar em produção, confira se ficou alguma policy antiga mais
-- permissiva no bucket (ex.: insert para "public"/anon, update ou delete):
--
--   select policyname, cmd, roles, qual, with_check
--     from pg_policies
--    where schemaname = 'storage' and tablename = 'objects';
--
-- Policies que liberem order-photos para anon/public devem ser removidas.
-- -----------------------------------------------------------------------------
