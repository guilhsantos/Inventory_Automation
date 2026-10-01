-- =============================================================================
-- Baseline (complemento): trigger de cadastro auth.users -> profiles
-- O dump do schema public (20260101000000_baseline.sql) não inclui triggers
-- que ficam em tabelas do schema auth. Em produção a trigger já existe; este
-- script apenas a recria igual (idempotente).
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
