-- =============================================================================
-- Testes de estoque e permissões (banco LOCAL com o seed carregado)
--
--   docker exec -i supabase_db_Inventory_Automation psql -U postgres -d postgres < supabase/tests/estoque_e_permissoes.sql
--
-- Tudo roda numa transação desfeita no final: nenhum dado é alterado.
-- Cada caso imprime "PASSOU ..."; qualquer falha interrompe com "FALHOU ...".
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
begin;

-- Simula um usuário logado (mesmo efeito do JWT enviado pelo app)
create function pg_temp.como(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.ok(p_nome text) returns void language plpgsql as $$
begin raise notice 'PASSOU  %', p_nome; end $$;

create temp table ref as
select
  (select id from machines where nome = 'Injetora 03') as maq,
  (select id from moldes where nome = 'Tapete Dianteiro Esquerdo') as molde_a,
  (select id from moldes where nome = 'Tapete Traseiro') as molde_b,
  (select id from materials where nome = 'PVC Preto') as mat,
  (select id from kits where codigo_unico = 'KIT-ONIX') as kit,
  (select id from orders where codigo_unico = 'PED-001') as pedido,
  '00000000-0000-4000-a000-000000000001'::uuid as admin,
  '00000000-0000-4000-a000-000000000002'::uuid as estoque,
  '00000000-0000-4000-a000-000000000003'::uuid as producao;
grant select on ref to authenticated, anon;

-- Garante saldo suficiente para os testes, independente do uso manual do banco local
update moldes set estoque_atual = greatest(estoque_atual, 100);
update materials set estoque_kg = greatest(estoque_kg, 500);

-- =============================================================== MÁQUINAS
select pg_temp.como(producao) from ref \gset
do $$
declare r ref%rowtype;
begin
  select * into r from ref;

  begin
    perform set_machine_state(r.maq, 'PARADA', r.molde_a, null);
    raise exception 'FALHOU parada sem observação foi aceita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Parada sem observação é bloqueada');
  end;

  perform set_machine_state(r.maq, 'EM_OPERACAO', r.molde_a, null);
  perform set_machine_state(r.maq, 'MANUTENCAO', r.molde_a, null);
  if (select current_molde_id from machines where id = r.maq) is distinct from r.molde_a then
    raise exception 'FALHOU manutenção perdeu o molde';
  end if;
  perform pg_temp.ok('Manutenção mantém o molde');

  perform set_machine_state(r.maq, 'PARADA', r.molde_a, 'teste');
  if (select current_molde_id from machines where id = r.maq) is not null then
    raise exception 'FALHOU parada manteve o molde';
  end if;
  perform pg_temp.ok('Parada remove o molde da máquina');

  begin
    perform register_production(r.maq, r.molde_a, r.mat, 5, 1, null, gen_random_uuid());
    raise exception 'FALHOU produção em máquina parada foi aceita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Máquina parada não aceita produção');
  end;

  begin
    perform set_machine_state(r.maq, 'EM_OPERACAO', null, null);
    raise exception 'FALHOU operação sem molde foi aceita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Voltar para operação exige molde');
  end;

  perform set_machine_state(r.maq, 'EM_OPERACAO', r.molde_a, null);
  if (select count(*) from machine_status_log where machine_id = r.maq) < 4 then
    raise exception 'FALHOU histórico de status não gravado';
  end if;
  perform pg_temp.ok('Mudanças de status ficam no histórico');
end $$;

-- =============================================================== PRODUÇÃO
do $$
declare
  r ref%rowtype;
  v_req uuid := gen_random_uuid();
  p0 int; m0 numeric; p1 int; m1 numeric; n int;
begin
  select * into r from ref;
  select estoque_atual into p0 from moldes where id = r.molde_a;
  select estoque_kg into m0 from materials where id = r.mat;

  perform register_production(r.maq, r.molde_a, r.mat, 7, 2, 'teste', v_req);
  perform register_production(r.maq, r.molde_a, r.mat, 7, 2, 'teste', v_req); -- reenvio
  select estoque_atual into p1 from moldes where id = r.molde_a;
  select estoque_kg into m1 from materials where id = r.mat;
  select count(*) into n from daily_production where request_id = v_req;
  if p1 <> p0 + 7 or m1 <> m0 - 50 or n <> 1 then
    raise exception 'FALHOU produção: peça % -> %, material % -> %, registros %', p0, p1, m0, m1, n;
  end if;
  perform pg_temp.ok('Produção soma a peça, desconta o material e o reenvio não duplica');

  begin
    perform register_production(r.maq, r.molde_b, r.mat, 3, 0, null, gen_random_uuid());
    raise exception 'FALHOU molde diferente do da máquina foi aceito';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Molde diferente do da máquina é recusado');
  end;

  begin
    perform register_production(r.maq, r.molde_a, r.mat, 3, 100000, null, gen_random_uuid());
    raise exception 'FALHOU material insuficiente foi aceito';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if (select estoque_atual from moldes where id = r.molde_a) <> p1 then
      raise exception 'FALHOU material insuficiente alterou a peça';
    end if;
    perform pg_temp.ok('Material insuficiente: erro e nada é gravado');
  end;
end $$;

-- =============================================================== DEFEITOS
do $$
declare r ref%rowtype; p0 int;
begin
  select * into r from ref;
  select estoque_atual into p0 from moldes where id = r.molde_a;
  begin
    perform register_defect(r.molde_a, r.maq, p0 + 1, 'teste');
    raise exception 'FALHOU defeito maior que o estoque foi aceito';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Defeito maior que o estoque é recusado');
  end;
  perform register_defect(r.molde_a, r.maq, 2, 'teste');
  if (select estoque_atual from moldes where id = r.molde_a) <> p0 - 2 then
    raise exception 'FALHOU defeito não descontou a peça';
  end if;
  perform pg_temp.ok('Defeito desconta a peça');
end $$;

-- =============================================================== KITS
select pg_temp.como(estoque) from ref \gset
do $$
declare r ref%rowtype; k0 int; k1 int; pecas0 int; pecas1 int;
begin
  select * into r from ref;
  select estoque_atual into k0 from kits where id = r.kit;
  select sum(m.estoque_atual) into pecas0 from kit_items ki join moldes m on m.id = ki.molde_id where ki.kit_id = r.kit;

  begin
    perform assemble_kit(r.kit, 100000, gen_random_uuid());
    raise exception 'FALHOU montagem sem peças suficientes foi aceita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Montar kit sem peças suficientes é recusado');
  end;

  perform assemble_kit(r.kit, 1, gen_random_uuid());
  select estoque_atual into k1 from kits where id = r.kit;
  select sum(m.estoque_atual) into pecas1 from kit_items ki join moldes m on m.id = ki.molde_id where ki.kit_id = r.kit;
  if k1 <> k0 + 1 or pecas1 <> pecas0 - (select sum(quantidade) from kit_items where kit_id = r.kit) then
    raise exception 'FALHOU montagem: kit % -> %, peças % -> %', k0, k1, pecas0, pecas1;
  end if;
  perform pg_temp.ok('Montar kit soma o kit e desconta as peças');

  perform adjust_kit_stock(r.kit, -1);
  if (select estoque_atual from kits where id = r.kit) <> k1 - 1 then
    raise exception 'FALHOU ajuste de kit';
  end if;
  perform pg_temp.ok('Reserva/baixa de kit ajusta o estoque relativo');
end $$;

-- =============================================================== PERMISSÕES (operador)
do $$
declare r ref%rowtype; n int;
begin
  select * into r from ref;

  update moldes set estoque_atual = 99999 where id = r.molde_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU operador alterou estoque direto'; end if;
  perform pg_temp.ok('Operador não altera estoque direto na tabela');

  update profiles set role = 'ADMIN' where id = r.estoque;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU operador virou ADMIN'; end if;
  perform pg_temp.ok('Operador não muda o próprio papel');

  if (select count(*) from profiles) <> 1 then raise exception 'FALHOU operador vê outros perfis'; end if;
  perform pg_temp.ok('Operador só vê o próprio perfil');

  begin
    insert into orders (codigo_unico, cliente, status) values ('X', 'X', 'Pendente');
    raise exception 'FALHOU operador criou pedido';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Operador não cria pedido');
  end;

  begin
    update orders set cliente = 'hack' where id = r.pedido;
    get diagnostics n = row_count;
    if n > 0 then raise exception 'FALHOU operador editou cliente do pedido'; end if;
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
  end;
  perform pg_temp.ok('Operador não edita dados do pedido (só conclui)');

  begin
    insert into order_photos (order_id, url) values (r.pedido, 'https://site-externo.com/x.jpg');
    raise exception 'FALHOU foto com link externo aceita';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Foto de pedido só aceita arquivo do bucket do app');
  end;

  delete from order_photos where order_id = r.pedido;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHOU operador apagou fotos'; end if;
  perform pg_temp.ok('Operador não apaga fotos de pedido');

  begin
    perform register_material_entry(r.mat, 10, current_date);
    raise exception 'FALHOU operador registrou entrada de material';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Entrada de material é só do admin');
  end;

  begin
    perform delete_user_keep_history(r.producao);
    raise exception 'FALHOU operador excluiu usuário';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Operador não exclui usuários');
  end;
end $$;

-- =============================================================== ADMIN
select pg_temp.como(admin) from ref \gset
do $$
declare r ref%rowtype; m0 numeric; hist int;
begin
  select * into r from ref;
  select estoque_kg into m0 from materials where id = r.mat;
  perform register_material_entry(r.mat, 10, current_date);
  if (select estoque_kg from materials where id = r.mat) <> m0 + 10 then
    raise exception 'FALHOU entrada de material';
  end if;
  perform pg_temp.ok('Admin registra entrada de material');

  if (select count(*) from profiles) < 3 then raise exception 'FALHOU admin não vê todos os perfis'; end if;
  perform pg_temp.ok('Admin vê todos os perfis');

  select count(*) into hist from daily_production where usuario_id = r.producao;
  perform delete_user_keep_history(r.producao);
  if (select excluido_em from profiles where id = r.producao) is null
     or (select count(*) from daily_production where usuario_id = r.producao) <> hist then
    raise exception 'FALHOU exclusão de usuário';
  end if;
  perform pg_temp.ok('Excluir usuário mantém perfil e histórico (' || hist || ' produções)');

  begin
    perform delete_user_keep_history(r.admin);
    raise exception 'FALHOU admin excluiu a si mesmo';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Admin não exclui a si mesmo');
  end;
end $$;

reset role;
do $$
begin
  if exists (select 1 from auth.users where id = '00000000-0000-4000-a000-000000000003') then
    raise exception 'FALHOU login do usuário excluído continua existindo';
  end if;
  perform pg_temp.ok('Login do usuário excluído foi apagado');
end $$;

-- Usuário excluído com token ainda válido
select pg_temp.como(producao) from ref \gset
do $$
declare r ref%rowtype;
begin
  select * into r from ref;
  begin
    perform register_production(r.maq, r.molde_a, r.mat, 1, 0, null, gen_random_uuid());
    raise exception 'FALHOU usuário excluído lançou produção';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Usuário excluído (token ainda válido) não mexe no estoque');
  end;
end $$;

-- =============================================================== CADASTRO PÚBLICO
reset role;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-0000000000ff', 'authenticated', 'authenticated',
        'cadastro-publico@teste.local', '', '{}', '{"role":"ADMIN"}', now(), now());
select pg_temp.como('00000000-0000-4000-a000-0000000000ff') \gset
do $$
declare r ref%rowtype;
begin
  select * into r from ref;
  if (select role::text from profiles where id = '00000000-0000-4000-a000-0000000000ff') <> 'PENDENTE' then
    raise exception 'FALHOU cadastro público não nasceu PENDENTE';
  end if;
  perform pg_temp.ok('Cadastro público nasce PENDENTE (mesmo pedindo ADMIN)');
  if exists (select 1 from orders) then raise exception 'FALHOU pendente vê pedidos'; end if;
  perform pg_temp.ok('Conta pendente não vê pedidos');
  begin
    perform adjust_kit_stock(r.kit, 50);
    raise exception 'FALHOU pendente mexeu no estoque';
  exception when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    perform pg_temp.ok('Conta pendente não mexe no estoque');
  end;
end $$;

-- =============================================================== ANÔNIMO
reset role;
select set_config('request.jwt.claims', '', true) \gset
set local role anon;
do $$
begin
  begin
    perform 1 from orders limit 1;
    raise exception 'FALHOU anônimo leu pedidos';
  exception when insufficient_privilege then
    perform pg_temp.ok('Anônimo não lê tabelas');
  end;
  begin
    perform adjust_kit_stock(1, 5);
    raise exception 'FALHOU anônimo chamou RPC';
  exception when insufficient_privilege then
    perform pg_temp.ok('Anônimo não chama funções de estoque');
  end;
end $$;

rollback;
\echo 'Fim: transação desfeita, nenhum dado alterado.'
