---
name: ceia-desenvolver
description: Manual de engenharia deste repositório (TanStack Start + Supabase). Use ao configurar uma solução nova a partir do template, criar feature, tabela, migration, policy de RLS, rota ou server function, mexer em tela seguindo o design system, ou antes de commitar.
---

# Desenvolver uma solução a partir do template

Stack: TanStack Start + TanStack Router (rotas por arquivo), React 19, TypeScript estrito,
Tailwind v4, shadcn/ui, React Query, Supabase (Postgres, Auth, RLS) no plano gratuito. O build
gera um Worker (Cloudflare), então o código de servidor roda sem APIs do Node.

## 1. Começar uma solução

1. **Marca**: edite `src/config/brand.ts` (`name`, `tagline`; `company` fica). É o único ponto de
   marca no código; título e descrição da aba saem dele. Favicon (`public/favicon*`) e paleta
   (tokens em `src/styles.css`) são opcionais.
2. **Projeto Supabase**: crie um projeto gratuito em supabase.com. Em _Project Settings → API
   Keys_ copie a URL, a _publishable key_ (`sb_publishable_…`) e a _secret key_ (`sb_secret_…`).
3. **`.env`**: `cp .env.example .env` e preencha:
   - `VITE_SUPABASE_URL` e `SUPABASE_URL` = URL do projeto;
   - `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` = publishable key;
   - `SUPABASE_SERVICE_ROLE_KEY` = secret key (só servidor; nunca com prefixo `VITE_`).
     O `.env` está no `.gitignore`.
4. **Schema**: aplique `supabase/migrations/*` em ordem, por um dos caminhos:
   - CLI: `npx supabase init` (cria `supabase/config.toml`; não mexe nas migrations),
     `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`;
   - ou cole cada arquivo, em ordem de timestamp, no _SQL Editor_ do painel.
     Depois rode `supabase/tests/rls_test.sql` no SQL Editor: o esperado é uma linha `RLS OK`.
5. **Auth**: em _Authentication → Sign In / Providers → Email_, decida sobre _Confirm email_
   (ligado, a conta só entra depois do link recebido). Em _URL Configuration_, ponha a URL do dev
   (`http://localhost:8080`) e, depois, a de produção.
6. `npm install` e `npm run dev` (sobe em `http://localhost:8080`).
7. **Primeira conta**: aba "Cadastrar" em `/`. Ela vira `dono` de "Minha organização" (renomeie
   em Equipe). As contas seguintes entram como `membro` enquanto o cadastro estiver aberto; o
   dono fecha e reabre em Equipe.

## 2. Modelo de dados e permissões

- 1 instalação = 1 organização. `perfis` (um por conta, criado pelo trigger `handle_new_user`),
  `organizacoes` (com `cadastro_aberto`), `organizacao_membros` (`user_id` é chave: no máximo uma
  organização por conta; sem linha = removido pelo dono).
- Funções: `minha_organizacao()`, `meu_papel()`, `mesma_organizacao(uuid)`,
  `garantir_organizacao()` (reparo chamado pelo layout logado; só cria organização se não existir
  nenhuma), `remover_membro`, `readmitir_membro`, `contas_fora_da_organizacao`,
  `definir_cadastro_aberto` (as quatro últimas só para o dono).
- Cadastro fechado: o trigger levanta `Cadastro fechado…` e o insert em `auth.users` é desfeito.
  O Auth devolve ao cliente o erro genérico `Database error saving new user`; a tela de entrada
  traduz os dois para "Cadastro fechado. Peça ao responsável para liberar.".
- **Policy padrão de conteúdo** (a de `anotacoes`): select/update/delete quando
  `user_id = auth.uid()` **ou** `organizacao_id = minha_organizacao()`; insert só com
  `user_id = auth.uid()` e `organizacao_id` nulo ou igual à minha. `organizacao_id` nulo =
  registro pessoal. Quem é removido continua vendo só o que é dele.
- Privilégios explícitos: cada tabela começa com `revoke all … from anon, authenticated` e recebe
  só o que o cliente usa. Colunas editáveis de `perfis`/`organizacoes` estão em grant de coluna
  (`update (nome)`): campo novo editável pelo cliente entra no grant.

## 3. Criar uma feature (copiando `anotacoes`)

1. **Migration nova** em `supabase/migrations/AAAAMMDDHHMMSS_<assunto>.sql`. Nunca edite uma
   migration já aplicada: correção é outra migration. Idempotente, no estilo da fundação:
   `create table if not exists`, `create index if not exists`, `create or replace function`,
   `drop policy if exists` + `create policy`, `drop trigger if exists` + `create trigger`, enum em
   `do $$ … exception when duplicate_object`.
2. **Tabela** com `id uuid default gen_random_uuid()`, `user_id → perfis on delete cascade`,
   `organizacao_id → organizacoes on delete set null`, `created_at`/`updated_at` e o trigger
   `set_updated_at`. Índices em `user_id` e `organizacao_id`.
3. **Privilégios e RLS**: `revoke all on public.<t> from anon, authenticated;`,
   `grant select, insert, update, delete on public.<t> to authenticated;`,
   `grant all on public.<t> to service_role;`, `enable row level security` e as quatro policies
   copiadas de `anotacoes` (troque o nome da tabela). Função nova: `security definer` só quando
   precisar ler o que a RLS esconde, sempre com `set search_path = public`,
   `revoke execute … from anon, public` e `grant execute … to authenticated`.
4. **Teste**: acrescente os casos da tabela em `supabase/tests/rls_test.sql` (membro vê o da
   organização, removido só vê o seu, ninguém cria em nome de outro) e rode até dar `RLS OK`.
5. **Tipos**: atualize `src/integrations/supabase/types.ts` à mão (Row/Insert/Update,
   Relationships, Functions, Enums, `Constants`). Ele é a fonte dos tipos do cliente Supabase.
6. **Dados**: `src/features/<feature>/api.ts` no molde de `features/anotacoes/api.ts`: uma raiz
   de `queryKey` por recurso (`["<feature>"]`), `useQuery` para leitura, `useMutation` que
   invalida a raiz, validação com zod e mensagens de erro em português.
7. **Tela**: componentes em `src/features/<feature>/` e a rota em
   `src/routes/_authenticated/<feature>.tsx`. Estados: `SkeletonTabela`/`SkeletonLista` ao
   carregar, `EstadoVazio` para vazio e erro, toast de sucesso/erro, `Dialog` para formulário,
   `AlertDialog` para excluir.
8. **Menu**: uma entrada em `NAV` de `src/lib/navegacao.ts` e o href em `RotaNavEstatica`.
   Menu lateral e trilha saem dali.

## 4. Regras da stack

- **Rotas por arquivo** em `src/routes` (`index.tsx` = `/`, `$id` = parâmetro, `_authenticated/`
  = área logada). `src/routeTree.gen.ts` é gerado pelo plugin do router: não editar à mão.
- **Área logada** (`_authenticated/route.tsx`): `ssr: false`, `beforeLoad` com
  `supabase.auth.getSession()` e redirect para `/`. A barreira real é a RLS.
- **Leitura e escrita comuns vão direto do cliente** (`@/integrations/supabase/client`) com RLS.
  Server function só para o que precisa de segredo ou service role.
- **Server function**: arquivo `serverFns.ts` da feature,
  `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(zod).handler(…)`.
  `context.supabase` consulta em nome do usuário (com RLS) e `context.userId` identifica quem
  chamou. Service role só com `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")`
  dentro do handler, e só depois de conferir a permissão pelo `context.supabase`.
- **Sem API do Node no servidor** (`fs`, `path`, `child_process`, `Buffer` de Node, `node:*`): o
  build é para Workers. Módulo só de servidor termina em `.server.ts`.
- **Arquivos**: extração de texto e geração de PDF/planilha acontecem no navegador.
- **React Query**: `queryKey` com a raiz do recurso; toda mutação invalida a raiz; o contexto do
  usuário vem só de `usePerfil()` (`["perfil"]`).
- **TypeScript estrito** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`): nada de
  `any`, nada de `// @ts-ignore`.
- Código, comentários, UI e docs em português do Brasil. Comentário só quando explica o porquê
  de uma regra.

## 5. Regras do design system

- **Tokens, nunca cor fixa**: `bg-background`, `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`… Nada de
  `bg-white`, `text-gray-500`, hex ou `dark:` com cor fixa: os tokens já trocam no tema escuro.
- **Escala tipográfica**: `text-heading-{xl,lg,md,sm}`, `text-body-{xl,lg,md,sm}`,
  `text-label-{lg,md}`, `text-caption`, `text-eyebrow`. Dentro de `.ds-app` (área logada) a
  escala é um degrau menor.
- **Feedback soft/deep**: fundo suave + texto forte (`bg-success-soft text-success`,
  `bg-warning-soft text-warning`, `bg-destructive-soft text-destructive`,
  `bg-info-soft text-info`) ou as variantes de `Badge` (`success`, `warning`, `danger`, `info`).
- **Componentes**: `src/components/ui/*` (shadcn adaptado; 42 componentes) antes de criar
  qualquer coisa. Página começa com `PageHeader`; vazio e erro com `EstadoVazio`; carregamento
  com `Skeletons`/`SkeletonMetricas`; campo rotulado com `Campo`; número com `CartaoMetrica`.
- **Layout de página**: `<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">` (largura
  `max-w-xl` a `max-w-6xl` conforme a tela). O padding é de cada página, não do layout.
- **Login sempre claro**: `/` não acompanha o tema (script anti-FOUC no `__root.tsx` e
  `forcarClaro` no `ThemeProvider`). Tela pública nova entra na mesma regra.
- Teste cada tela nova em claro, escuro e 375 px de largura.

## 6. Antes de cada commit

```bash
npm run build    # tsc --noEmit + vite build
npm run lint     # 0 erros
npm run format   # Prettier
```

Mexeu em migration ou policy: rode `supabase/tests/rls_test.sql` e confira `RLS OK`.
Commits pequenos, mensagem em português dizendo o que muda.

## 7. Pronto para entregar

- [ ] `brand.ts` com nome e tagline da solução; meta tags coerentes.
- [ ] Todas as migrations aplicadas no projeto de produção e `rls_test.sql` com `RLS OK`.
- [ ] `types.ts` igual ao schema; `npm run build` e `npm run lint` sem erro.
- [ ] Cada tela testada em claro, escuro e 375 px; estados de carregamento, vazio e erro.
- [ ] Primeira conta criada vira dona; cadastro fecha e reabre em Equipe.
- [ ] Checklist de `docs/ENTREGA.md` cumprido.
