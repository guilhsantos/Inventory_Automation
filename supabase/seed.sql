-- =============================================================================
-- Seed do ambiente LOCAL (supabase start / supabase db reset)
-- Roda depois de todas as migrações. Nunca é aplicado em produção.
--
-- Usuários de teste (senha de todos: BfosTZ_w32KU — só existe no banco local):
--   admin@reauto.local      ADMIN
--   estoque@reauto.local    OP_ESTOQUE
--   producao@reauto.local   OP_PRODUCAO
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usuários (auth.users + auth.identities); o trigger on_auth_user_created
-- cria o profiles de cada um
-- -----------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@reauto.local',    'Admin Teste',    'ADMIN'),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'estoque@reauto.local',  'Estoque Teste',  'OP_ESTOQUE'),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'producao@reauto.local', 'Produção Teste', 'OP_PRODUCAO')
    ) as t(id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('BfosTZ_w32KU', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.nome),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    -- Garante o perfil mesmo se o trigger de cadastro não existir no baseline;
    -- o papel vem por UPDATE (o trigger da 004 força OP_ESTOQUE no INSERT)
    insert into public.profiles (id, email, full_name)
    values (u.id, u.email, u.nome)
    on conflict (id) do nothing;

    update public.profiles
       set role = u.papel::public.user_role, full_name = u.nome
     where id = u.id;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastros
-- -----------------------------------------------------------------------------
insert into public.materials (nome, estoque_kg) values
  ('PVC Preto', 500),
  ('PVC Cinza', 120),
  ('Borracha Reciclada', 40);

insert into public.moldes (nome, estoque_atual) values
  ('Tapete Dianteiro Esquerdo', 50),
  ('Tapete Dianteiro Direito', 50),
  ('Tapete Traseiro', 30),
  ('Tapete Porta-Malas', 10);

insert into public.machines (nome) values
  ('Injetora 01'),
  ('Injetora 02'),
  ('Injetora 03');

insert into public.kits (codigo_unico, nome_kit, estoque_atual) values
  ('KIT-GOL-G5', 'Kit Gol G5 (4 peças)', 5),
  ('KIT-ONIX', 'Kit Onix (3 peças)', 2);

insert into public.kit_items (kit_id, molde_id, quantidade)
select k.id, m.id, 1
  from public.kits k
  join public.moldes m on m.nome in ('Tapete Dianteiro Esquerdo', 'Tapete Dianteiro Direito', 'Tapete Traseiro')
 where k.codigo_unico in ('KIT-GOL-G5', 'KIT-ONIX');

insert into public.kit_items (kit_id, molde_id, quantidade)
select k.id, m.id, 1
  from public.kits k
  join public.moldes m on m.nome = 'Tapete Porta-Malas'
 where k.codigo_unico = 'KIT-GOL-G5';

-- -----------------------------------------------------------------------------
-- Pedidos pendentes (para testar reserva e baixa)
-- -----------------------------------------------------------------------------
with novo as (
  insert into public.orders (codigo_unico, cliente, status, data_entrega)
  values ('PED-001', 'Cliente Teste A', 'Pendente', current_date + 3)
  returning id
)
insert into public.order_items (order_id, kit_id, quantidade)
select novo.id, k.id, 3 from novo, public.kits k where k.codigo_unico = 'KIT-GOL-G5';

with novo as (
  insert into public.orders (codigo_unico, cliente, status, data_entrega)
  values ('PED-002', 'Cliente Teste B', 'Pendente', current_date + 7)
  returning id
)
insert into public.order_items (order_id, kit_id, quantidade)
select novo.id, k.id, 4 from novo, public.kits k where k.codigo_unico = 'KIT-ONIX';
