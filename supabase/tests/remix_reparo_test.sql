-- Teste do auto-reparo (`garantir_instalacao`). Rodar no SQL editor do Supabase
-- (ou `psql` com o role postgres), depois das migrations.
-- Tudo dentro de uma transação com ROLLBACK: não deixa nada no banco.
-- Sucesso = retorna uma linha "REPARO OK". Falha = exceção "REPARO FALHOU: <caso>".
--
-- Simula o banco copiado sem o que a cópia deixa para trás: apaga o trigger
-- `on_auth_user_created`, devolve ALL/EXECUTE a anon e authenticated em tudo de
-- `public` e cria contas em auth.users sem trigger (sem perfil). Depois chama
-- `garantir_instalacao()` e confere trigger, contas e privilégios.

begin;

do $$
declare
  u_antiga uuid := gen_random_uuid();
  u_nova   uuid := gen_random_uuid();
  u_depois uuid := gen_random_uuid();
  org_id uuid;
  papel_atual public.papel_organizacao;
  n int;
  txt text;
begin
  -- Base vazia só dentro desta transação (como no rls_test.sql).
  delete from public.organizacoes;
  -- Modelo (o template não tem linha inicial): o remix copia a estrutura, não os dados.
  -- Solução com linha única (ex.: configurações com id = 1) apaga-a aqui, antes do reparo:
  --   delete from public.<tabela>;

  -- ── simula a cópia ──────────────────────────────────────────────────────
  drop trigger if exists on_auth_user_created on auth.users;
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
  grant execute on all functions in schema public to anon, authenticated;

  -- Contas criadas enquanto o trigger faltava. `created_at` bem antigo: a
  -- primeira tem de ser a mais antiga do banco para virar dona.
  insert into auth.users (id, email, raw_user_meta_data, created_at) values
    (u_antiga, 'antiga@exemplo.test', jsonb_build_object('nome', 'Ana Antiga'), '2000-01-01'),
    (u_nova, 'nova@exemplo.test', '{}'::jsonb, '2000-01-02');

  select count(*) into n from public.perfis where id in (u_antiga, u_nova);
  if n <> 0 then raise exception 'REPARO FALHOU: a simulação não tirou o trigger (% perfis)', n; end if;
  if not has_table_privilege('anon', 'public.perfis', 'SELECT') then
    raise exception 'REPARO FALHOU: a simulação não abriu os privilégios';
  end if;

  -- ── reparo ──────────────────────────────────────────────────────────────
  if not public.garantir_instalacao() then
    raise exception 'REPARO FALHOU: garantir_instalacao devolveu false com tudo quebrado';
  end if;

  -- 0. linhas iniciais (modelo; o template não tem nenhuma). Solução com linha única
  --    confere que a seção 0 a recriou:
  --   select count(*) into n from public.<tabela> where id = 1;
  --   if n <> 1 then raise exception 'REPARO FALHOU: linha de <tabela> não voltou'; end if;

  -- 1. trigger recriado
  select count(*) into n from pg_trigger
   where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
  if n <> 1 then raise exception 'REPARO FALHOU: trigger on_auth_user_created não voltou'; end if;

  -- 2. contas órfãs: a mais antiga vira dona, a seguinte membro
  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'REPARO FALHOU: % organizações depois do reparo, esperado 1', n; end if;
  select id into org_id from public.organizacoes;

  select nome into txt from public.perfis where id = u_antiga;
  if txt is distinct from 'Ana Antiga' then raise exception 'REPARO FALHOU: perfil da conta antiga com nome %', txt; end if;
  select papel into papel_atual from public.organizacao_membros where user_id = u_antiga and organizacao_id = org_id;
  if papel_atual is distinct from 'dono' then
    raise exception 'REPARO FALHOU: conta mais antiga não virou dona (papel %)', papel_atual;
  end if;

  select nome into txt from public.perfis where id = u_nova;
  if txt is distinct from 'nova' then raise exception 'REPARO FALHOU: nome sem metadata veio %', txt; end if;
  select papel into papel_atual from public.organizacao_membros where user_id = u_nova and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'REPARO FALHOU: segunda conta não entrou como membro (papel %)', papel_atual;
  end if;

  -- 3. privilégios de volta à lista da fundação
  if has_table_privilege('anon', 'public.perfis', 'SELECT')
     or has_table_privilege('anon', 'public.anotacoes', 'SELECT')
     or has_table_privilege('anon', 'public.organizacoes', 'SELECT') then
    raise exception 'REPARO FALHOU: anon continua lendo tabelas';
  end if;
  if has_table_privilege('authenticated', 'public.organizacao_membros', 'INSERT')
     or has_table_privilege('authenticated', 'public.organizacoes', 'INSERT')
     or has_table_privilege('authenticated', 'public.perfis', 'DELETE') then
    raise exception 'REPARO FALHOU: authenticated continua escrevendo onde não deve';
  end if;
  if has_column_privilege('authenticated', 'public.perfis', 'email', 'UPDATE') then
    raise exception 'REPARO FALHOU: authenticated edita o e-mail do perfil';
  end if;
  if not has_column_privilege('authenticated', 'public.perfis', 'nome', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.organizacoes', 'cadastro_aberto', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.perfis', 'SELECT')
     or not has_table_privilege('authenticated', 'public.organizacao_membros', 'SELECT') then
    raise exception 'REPARO FALHOU: authenticated perdeu privilégio da fundação em perfis/organizacoes';
  end if;
  if not (has_table_privilege('authenticated', 'public.anotacoes', 'SELECT')
          and has_table_privilege('authenticated', 'public.anotacoes', 'INSERT')
          and has_table_privilege('authenticated', 'public.anotacoes', 'UPDATE')
          and has_table_privilege('authenticated', 'public.anotacoes', 'DELETE')) then
    raise exception 'REPARO FALHOU: authenticated perdeu privilégio em anotacoes';
  end if;
  if not has_table_privilege('service_role', 'public.organizacao_membros', 'INSERT') then
    raise exception 'REPARO FALHOU: service_role perdeu privilégio';
  end if;

  if has_function_privilege('anon', 'public.remover_membro(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.minha_organizacao()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.set_updated_at()', 'EXECUTE') then
    raise exception 'REPARO FALHOU: função interna continua executável pelo cliente';
  end if;
  if not (has_function_privilege('authenticated', 'public.minha_organizacao()', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.garantir_organizacao()', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.definir_cadastro_aberto(boolean)', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.contas_fora_da_organizacao()', 'EXECUTE')) then
    raise exception 'REPARO FALHOU: authenticated perdeu EXECUTE nas funções do app';
  end if;
  if not (has_function_privilege('anon', 'public.garantir_instalacao()', 'EXECUTE')
          and has_function_privilege('authenticated', 'public.garantir_instalacao()', 'EXECUTE')) then
    raise exception 'REPARO FALHOU: garantir_instalacao fechada para o app';
  end if;

  -- 4. segunda chamada não tem o que fazer
  if public.garantir_instalacao() then
    raise exception 'REPARO FALHOU: segunda chamada ainda consertou algo';
  end if;

  -- 5. com o trigger de volta, conta nova segue o fluxo normal (entra como membro)
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_depois, 'depois@exemplo.test', jsonb_build_object('nome', 'Duda Depois'));
  select papel into papel_atual from public.organizacao_membros where user_id = u_depois and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'REPARO FALHOU: conta criada depois do reparo não entrou (papel %)', papel_atual;
  end if;

  -- 6. o reparo roda como visitante (a tela de entrada chama sem sessão)
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
  if public.garantir_instalacao() then
    raise exception 'REPARO FALHOU: chamada como visitante consertou algo com tudo certo';
  end if;
  perform set_config('role', 'none', true);

  create temp table reparo_resultado as select 'REPARO OK'::text as resultado;
end $$;

select * from reparo_resultado;

rollback;
