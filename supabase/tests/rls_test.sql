-- Testes de RLS. Rodar no SQL editor do Supabase (ou `psql` com o role postgres).
-- Tudo dentro de uma transação com ROLLBACK: não deixa dados no banco.
-- Sucesso = retorna uma linha "RLS OK". Falha = exceção "RLS FALHOU: <caso>".
--
-- Simula usuários trocando o role para `authenticated` e injetando o JWT via
-- request.jwt.claims (é o que o PostgREST faz). Os perfis nascem de inserts em
-- auth.users com o role `postgres`, para exercitar o trigger handle_new_user.
-- Sem tabelas/funções auxiliares: o role authenticated não acessa tabelas
-- temporárias, e set_config('role') feito dentro de uma função é desfeito na saída.
--
-- Modelo: 1 instalação = 1 organização. A primeira conta criada vira dona de
-- "Minha organização"; as seguintes entram como membros enquanto o cadastro
-- estiver aberto. Com `cadastro_aberto = false`, handle_new_user levanta
-- 'Cadastro fechado…': o trigger é AFTER INSERT, então a exceção desfaz o
-- insert em auth.users (e o perfil) e o cliente recebe erro no `signUp`.
--
-- Ao criar uma tabela de feature, acrescente aqui os casos dela no mesmo molde
-- dos de `anotacoes` (membro vê o da organização, removido só vê o seu,
-- ninguém cria em nome de outro).

begin;

do $$
declare
  u_dono     uuid := gen_random_uuid();
  u_membro   uuid := gen_random_uuid();
  u_terceiro uuid := gen_random_uuid();
  org_id uuid;
  an_dono uuid;
  papel_atual public.papel_organizacao;
  aberto boolean;
  n int;
  txt text;
  ok boolean;
begin
  -- Base vazia só dentro desta transação: sem nenhuma organização, o primeiro
  -- cadastro tem de virar dono. O `rollback` do fim devolve tudo (o cascade
  -- tira os vínculos e o `on delete set null` desmarca o conteúdo, só aqui).
  delete from public.organizacoes;

  -- ── cadastro ────────────────────────────────────────────────────────────
  -- 0. 1º cadastro: perfil com o nome do metadata + organização criada + dono
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_dono, 'dono@exemplo.test', jsonb_build_object('nome', 'Ana Dona'));

  select count(*) into n from public.perfis
   where id = u_dono and nome = 'Ana Dona' and email = 'dono@exemplo.test';
  if n <> 1 then raise exception 'RLS FALHOU: handle_new_user não copiou nome/e-mail'; end if;

  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: 1º cadastro deixou % organizações, esperado 1', n; end if;
  select o.id, o.nome, o.cadastro_aberto into org_id, txt, aberto from public.organizacoes o;
  if txt <> 'Minha organização' then raise exception 'RLS FALHOU: organização nasceu com nome %', txt; end if;
  if not aberto then raise exception 'RLS FALHOU: organização nasceu com o cadastro fechado'; end if;
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_dono and organizacao_id = org_id;
  if papel_atual is distinct from 'dono' then
    raise exception 'RLS FALHOU: 1º cadastro não virou dono (papel %)', papel_atual;
  end if;

  -- 1. 2º cadastro: entra como membro da mesma organização, sem criar outra
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_membro, 'membro@exemplo.test', '{}'::jsonb);
  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: 2º cadastro criou outra organização (% no total)', n; end if;
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_membro and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'RLS FALHOU: 2º cadastro não entrou como membro (papel %)', papel_atual;
  end if;
  select nome into txt from public.perfis where id = u_membro;
  if txt <> 'membro' then raise exception 'RLS FALHOU: nome sem metadata deveria ser a parte local do e-mail, veio %', txt; end if;

  -- ── dono ────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.anotacoes (user_id, organizacao_id, titulo, conteudo)
  values (u_dono, org_id, 'Anotação da organização', 'conteúdo')
  returning id into an_dono;

  -- 2. insert direto em organizacoes/organizacao_membros é negado
  begin
    insert into public.organizacoes (nome) values ('Direta');
    raise exception 'RLS FALHOU: insert direto em organizacoes permitido';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organizacao_membros (user_id, organizacao_id, papel)
    values (u_dono, org_id, 'membro');
    raise exception 'RLS FALHOU: insert direto em organizacao_membros permitido';
  exception when insufficient_privilege then null;
  end;

  -- 3. o perfil muda o nome, não o e-mail
  update public.perfis set nome = 'Ana Dona Silva' where id = u_dono;
  if not found then raise exception 'RLS FALHOU: dono não edita o próprio perfil'; end if;
  begin
    update public.perfis set email = 'outro@exemplo.test' where id = u_dono;
    raise exception 'RLS FALHOU: perfil trocou o e-mail pelo cliente';
  exception when insufficient_privilege then null;
  end;

  -- 4. dono edita o nome da organização
  update public.organizacoes set nome = 'Organização Exemplo' where id = org_id;
  if not found then raise exception 'RLS FALHOU: dono não editou o nome da organização'; end if;

  -- 5. garantir_organizacao não mexe em quem já tem vínculo
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao devolveu true para o dono já vinculado';
  end if;

  -- 6. ninguém fora ainda; o dono não remove a si mesmo
  select count(*) into n from public.contas_fora_da_organizacao() c where c.user_id in (u_dono, u_membro);
  if n <> 0 then raise exception 'RLS FALHOU: contas_fora_da_organizacao listou % contas vinculadas', n; end if;
  begin
    perform public.remover_membro(u_dono);
    raise exception 'RLS FALHOU: o dono removeu a si mesmo';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  -- 7. dono fecha o cadastro
  if public.definir_cadastro_aberto(false) then
    raise exception 'RLS FALHOU: definir_cadastro_aberto(false) devolveu true';
  end if;

  -- ── cadastro fechado ────────────────────────────────────────────────────
  perform set_config('role', 'none', true);

  -- 8. o 3º cadastro é recusado e não deixa perfil nem vínculo
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (u_terceiro, 'terceiro@exemplo.test', jsonb_build_object('nome', 'Caio Terceiro'));
    raise exception 'RLS FALHOU: cadastro fechado aceitou conta nova';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
    if sqlerrm not like 'Cadastro fechado%' then
      raise exception 'RLS FALHOU: cadastro fechado falhou com outra mensagem: %', sqlerrm;
    end if;
  end;
  select count(*) into n from auth.users where id = u_terceiro;
  if n <> 0 then raise exception 'RLS FALHOU: cadastro fechado deixou a conta em auth.users'; end if;
  select count(*) into n from public.perfis where id = u_terceiro;
  if n <> 0 then raise exception 'RLS FALHOU: cadastro fechado deixou o perfil'; end if;

  -- 9. o dono reabre e o 3º entra como membro
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if not public.definir_cadastro_aberto(true) then
    raise exception 'RLS FALHOU: definir_cadastro_aberto(true) devolveu false';
  end if;

  perform set_config('role', 'none', true);
  insert into auth.users (id, email, raw_user_meta_data) values
    (u_terceiro, 'terceiro@exemplo.test', jsonb_build_object('nome', 'Caio Terceiro'));
  select papel into papel_atual from public.organizacao_membros
   where user_id = u_terceiro and organizacao_id = org_id;
  if papel_atual is distinct from 'membro' then
    raise exception 'RLS FALHOU: 3º cadastro com o cadastro reaberto não entrou (papel %)', papel_atual;
  end if;

  -- ── membro ──────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  insert into public.anotacoes (user_id, titulo, conteudo)
  values (u_membro, 'Anotação pessoal', 'conteúdo');

  -- 10. membro enxerga o que é da organização, os colegas e o próprio
  select count(*) into n from public.anotacoes;
  if n <> 2 then raise exception 'RLS FALHOU: membro enxerga % anotações, esperado 2', n; end if;
  select count(*) into n from public.perfis;
  if n <> 3 then raise exception 'RLS FALHOU: membro enxerga % perfis, esperado 3', n; end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 3 then raise exception 'RLS FALHOU: membro enxerga % vínculos, esperado 3', n; end if;

  -- 11. membro edita o que é da organização (regra da policy padrão)
  update public.anotacoes set conteudo = 'editado pelo membro' where id = an_dono;
  if not found then raise exception 'RLS FALHOU: membro não editou anotação da organização'; end if;

  -- 12. membro não cria em nome de outro nem escreve em organizacao_membros
  begin
    insert into public.anotacoes (user_id, organizacao_id, titulo)
    values (u_dono, org_id, 'Forjada');
    raise exception 'RLS FALHOU: membro criou anotação em nome do dono';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.organizacao_membros (user_id, organizacao_id, papel)
    values (u_membro, org_id, 'dono');
    raise exception 'RLS FALHOU: membro inseriu em organizacao_membros';
  exception when insufficient_privilege then null;
  end;

  -- 13. membro não edita o perfil de outro nem a organização
  update public.perfis set nome = 'Renomeado' where id = u_dono;
  if found then raise exception 'RLS FALHOU: membro renomeou o perfil do dono'; end if;
  update public.organizacoes set nome = 'Renomeada pelo membro' where id = org_id;
  if found then raise exception 'RLS FALHOU: membro renomeou a organização'; end if;
  update public.organizacoes set cadastro_aberto = false where id = org_id;
  if found then raise exception 'RLS FALHOU: membro fechou o cadastro pela tabela'; end if;

  -- 14. só o dono chama as funções de gestão
  begin
    perform public.remover_membro(u_terceiro);
    raise exception 'RLS FALHOU: membro removeu outro membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.readmitir_membro(u_membro);
    raise exception 'RLS FALHOU: membro chamou readmitir_membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    select count(*) into n from public.contas_fora_da_organizacao();
    raise exception 'RLS FALHOU: membro listou as contas fora da organização';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  begin
    perform public.definir_cadastro_aberto(false);
    raise exception 'RLS FALHOU: membro fechou o cadastro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;

  -- ── dono remove o membro ────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.remover_membro(u_membro);
  select count(*) into n from public.organizacao_membros;
  if n <> 2 then raise exception 'RLS FALHOU: remover_membro deixou % vínculos, esperado 2', n; end if;

  -- 15. o removido aparece em contas_fora_da_organizacao
  select count(*) into n from public.contas_fora_da_organizacao() c
   where c.user_id = u_membro and c.nome = 'membro' and c.email = 'membro@exemplo.test';
  if n <> 1 then raise exception 'RLS FALHOU: contas_fora_da_organizacao não listou o removido'; end if;

  -- ── removido ────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 16. deixa de ver a organização, mas mantém o que é dele
  select count(*) into n from public.anotacoes;
  if n <> 1 then raise exception 'RLS FALHOU: removido enxerga % anotações, esperado 1 (a dele)', n; end if;
  select count(*) into n from public.organizacoes;
  if n <> 0 then raise exception 'RLS FALHOU: removido enxerga % organizações', n; end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 0 then raise exception 'RLS FALHOU: removido enxerga % vínculos', n; end if;
  select count(*) into n from public.perfis;
  if n <> 1 then raise exception 'RLS FALHOU: removido enxerga % perfis, esperado 1 (o dele)', n; end if;

  -- 17. não marca registro como sendo da organização nem em nome de outro
  begin
    insert into public.anotacoes (user_id, organizacao_id, titulo)
    values (u_membro, org_id, 'Infiltrada');
    raise exception 'RLS FALHOU: removido inseriu anotação na organização';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.anotacoes (user_id, titulo) values (u_dono, 'Forjada');
    raise exception 'RLS FALHOU: removido inseriu anotação em nome do dono';
  exception when insufficient_privilege then null;
  end;
  update public.anotacoes set conteudo = 'x' where id = an_dono;
  if found then raise exception 'RLS FALHOU: removido editou anotação da organização'; end if;

  -- 18. garantir_organizacao não reentra sozinho
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao readmitiu o removido';
  end if;
  select count(*) into n from public.organizacao_membros;
  if n <> 0 then raise exception 'RLS FALHOU: removido voltou à organização sem o dono'; end if;

  -- ── dono readmite ───────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  perform public.readmitir_membro(u_membro);
  begin
    perform public.readmitir_membro(u_membro);
    raise exception 'RLS FALHOU: readmitiu quem já é membro';
  exception when others then
    if sqlerrm like 'RLS FALHOU%' then raise; end if;
  end;
  select count(*) into n from public.contas_fora_da_organizacao() c where c.user_id = u_membro;
  if n <> 0 then raise exception 'RLS FALHOU: readmitido continua em contas_fora_da_organizacao'; end if;

  -- 19. o readmitido volta a ver a organização, como membro
  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.anotacoes;
  if n <> 2 then raise exception 'RLS FALHOU: readmitido enxerga % anotações, esperado 2', n; end if;
  if public.meu_papel() is distinct from 'membro' then
    raise exception 'RLS FALHOU: readmitido voltou com papel %', public.meu_papel();
  end if;

  -- ── reparo na instalação vazia ──────────────────────────────────────────
  -- 20. sem organização nenhuma, garantir_organizacao cria e faz dono
  perform set_config('role', 'none', true);
  delete from public.organizacoes;

  perform set_config('request.jwt.claims', json_build_object('sub', u_membro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ok := public.garantir_organizacao();
  if not ok then raise exception 'RLS FALHOU: garantir_organizacao não criou a organização na base vazia'; end if;
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'RLS FALHOU: garantir_organizacao não fez dono (papel %)', public.meu_papel();
  end if;

  -- e uma segunda conta não reentra por ele: a organização já existe
  perform set_config('request.jwt.claims', json_build_object('sub', u_terceiro, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  if public.garantir_organizacao() then
    raise exception 'RLS FALHOU: garantir_organizacao criou uma segunda organização';
  end if;

  perform set_config('role', 'none', true);
  select count(*) into n from public.organizacoes;
  if n <> 1 then raise exception 'RLS FALHOU: base terminou com % organizações, esperado 1', n; end if;

  create temp table rls_resultado as select 'RLS OK'::text as resultado;
end $$;

select * from rls_resultado;

rollback;
