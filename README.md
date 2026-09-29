# ceia-template

Ponto de partida das soluções Conversão Extrema. Traz a stack configurada, o design system, a tela
de entrada, a casca da área logada (sidebar, header, trilha, tema claro/escuro), a fundação de
contas no banco com RLS testada e uma feature de exemplo (`anotacoes`) para ser copiada. Não traz
regra de negócio: cada solução nasce daqui com "Use this template".

O manual de engenharia fica em [`.claude/skills/ceia-desenvolver/SKILL.md`](./.claude/skills/ceia-desenvolver/SKILL.md);
este README é o resumo.

## Stack

TanStack Start + TanStack Router (rotas por arquivo), React 19, TypeScript estrito
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Tailwind v4, shadcn/ui, React Query e
Supabase (Postgres, Auth e RLS) no plano gratuito. O build gera um Worker (Cloudflare): nenhum
código de servidor usa API exclusiva do Node. Versão do template em `STARTER_VERSION`.

O design system aplicado (`src/styles.css` e `src/components`) corresponde à versão 2.1.0 do
design system Conversão Extrema, registrada em `DS_VERSION`.

## Como começar

1. Troque `name` e `tagline` em `src/config/brand.ts`.
2. Crie um projeto gratuito no Supabase e copie URL, _publishable key_ e _secret key_
   (_Project Settings → API Keys_).
3. `cp .env.example .env` e preencha: as duas `*_URL` com a URL, as duas `*_PUBLISHABLE_KEY` com a
   publishable key e `SUPABASE_SERVICE_ROLE_KEY` com a secret key.
4. Aplique o schema:
   ```bash
   npx supabase init        # cria supabase/config.toml
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   Ou cole cada arquivo de `supabase/migrations/`, em ordem, no _SQL Editor_ do painel. Depois rode
   no SQL Editor `supabase/tests/rls_test.sql` (esperado: `RLS OK`) e
   `supabase/tests/remix_reparo_test.sql` (esperado: `REPARO OK`).
5. Em _Authentication → URL Configuration_ ponha `http://localhost:8080` em _Site URL_ e
   `http://localhost:8080/**` em _Redirect URLs_ (magic link e nova senha); em _Sign In / Providers
   → Email_ decida se a confirmação de e-mail fica ligada.
6. `npm install` e `npm run dev` → `http://localhost:8080`.
7. Na aba "Cadastrar", crie a primeira conta: ela vira dona da organização. As seguintes entram como
   membros enquanto o cadastro estiver aberto (Equipe → Cadastro de contas novas).

## Estrutura

```
.claude/skills/ceia-desenvolver/   manual de engenharia
docs/                              ENTREGA.md (checklist) e README_CLIENTE.md (modelo)
public/                            favicons e robots.txt
src/
  config/brand.ts                  único ponto de marca no código
  components/ui/                   42 componentes shadcn adaptados ao DS
  components/layout/               AppLayout, AppSidebar, AppHeader, DotGrid, LayoutEntrada
  components/                      PageHeader/EstadoVazio, Skeletons, CartaoMetrica, Campo,
                                   Tabela, ControleSegmentado, CampoData/IntervaloDatas
  contexts/ThemeContext.tsx        tema claro/escuro/sistema e cor de destaque
  features/<feature>/              api.ts (React Query) e componentes da feature
  integrations/supabase/           clientes (navegador, servidor, service role), middleware, types.ts
  lib/navegacao.ts                 menu lateral e trilha
  lib/auth-errors.ts               erros do Supabase Auth em português
  lib/instalacao.ts                chamada do auto-reparo (garantir_instalacao)
  routes/                          rotas por arquivo; _authenticated/ = área logada
  styles.css                       tokens, tipografia, radius, animações
supabase/
  migrations/                      schema versionado
  tests/rls_test.sql               teste de RLS (transação com rollback)
  tests/remix_reparo_test.sql      teste do auto-reparo (transação com rollback)
```

## Scripts

| Comando             | O que faz                                 |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | servidor de desenvolvimento na porta 8080 |
| `npm run build`     | `tsc --noEmit` e build de produção        |
| `npm run typecheck` | só a checagem de tipos                    |
| `npm run lint`      | ESLint (o esperado é 0 erros)             |
| `npm run format`    | Prettier em todo o repositório            |
| `npm run preview`   | serve o build de produção localmente      |

## Telas que vêm prontas

- `/` abas Entrar | Cadastrar | Magic Link e "Esqueceu a senha?", sempre no tema claro. O magic
  link só serve para quem já tem conta; os dois links por e-mail respondem de forma neutra.
- `/redefinir-senha` nova senha pelo link do e-mail (sem link válido, aviso de link expirado),
  também sempre clara.
- `/dashboard` início com três métricas de exemplo.
- `/anotacoes` a feature-modelo: tabela ordenável por título e data, filtro "Todas | Minhas | Da
  organização", formulário em Dialog, exclusão com confirmação, anotação pessoal ou da
  organização.
- `/equipe` nome da organização, cadastro aberto/fechado, membros, remover e readmitir (ações só
  para o dono).
- `/perfil` nome; o e-mail é só leitura.

## Criar uma feature

Copie `anotacoes`: migration nova com a tabela, a policy padrão e os grants dela também no
`garantir_instalacao()`, casos novos no `rls_test.sql`,
tipos em `types.ts`, `src/features/<feature>/api.ts`, componentes, rota em
`src/routes/_authenticated/` e entrada em `src/lib/navegacao.ts`. O passo a passo está na seção 3
do manual.

## Banco e RLS

1 instalação = 1 organização. A primeira conta vira `dono`; as seguintes, `membro`. Com
`organizacoes.cadastro_aberto = false` o trigger de cadastro recusa contas novas. O conteúdo segue
a policy padrão: o autor vê o que é dele, e todo membro vê o que é da organização. Quem o dono
remove continua entrando, mas só vê o que é seu, até ser readmitido. Migrations nunca são editadas
depois de aplicadas; toda mudança é um arquivo novo, idempotente.

`garantir_instalacao()` conserta sozinho um banco copiado sem os triggers de `auth.users` ou com
os privilégios padrão (remix): recria o trigger de cadastro, cria perfil e vínculo das contas que
nasceram sem ele e reaplica a lista exata de grants. A tela de entrada e a área logada a chamam
sem ninguém precisar rodar nada. Todo objeto novo (tabela, view, função) entra nos grants dela.

## Versões

A versão do template fica em `STARTER_VERSION` (e em `package.json`).

- **0.2.0**: tela de entrada com Magic Link e "Esqueceu a senha?", rota `/redefinir-senha`, erros
  do Auth em português (`src/lib/auth-errors.ts`) e auto-reparo da instalação
  (`garantir_instalacao()`, migration `20260929180000_auto_reparo_remix.sql`).
- **0.1.0**: base (stack, design system, tela de entrada, casca da área logada, fundação de contas
  e a feature de exemplo `anotacoes`).

## Marca

O nome e a tagline vêm só de `src/config/brand.ts` (sidebar, login, título e descrição da aba). Os
outros pontos de identidade são `public/favicon*`, as meta tags em `src/routes/__root.tsx` e os
tokens de cor em `src/styles.css`.
