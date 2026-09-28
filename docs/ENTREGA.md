# Antes de entregar a solução

Checklist do último commit antes da entrega. Tudo o que não é do cliente sai do repositório.

## Remover

- [ ] `.claude/` (manual de engenharia, configuração local)
- [ ] `CLAUDE.md`
- [ ] `docs/ENTREGA.md` (este arquivo) e qualquer outro documento de trabalho em `docs/`
- [ ] `docs/README_CLIENTE.md`, depois de virar o `README.md` (ver abaixo)
- [ ] Feature de exemplo `anotacoes`, se a solução não a usa: `src/features/anotacoes/`,
      `src/routes/_authenticated/anotacoes.tsx`, a entrada em `src/lib/navegacao.ts`, as métricas
      do `dashboard.tsx`, a tabela em `types.ts` e uma migration nova com `drop table` (a de
      fundação não é editada)
- [ ] Contas e dados de teste no banco de produção
- [ ] `.env` local (não é versionado; conferir que não entrou em nenhum commit)

## Conferir

- [ ] `npm run build` sem erro
- [ ] `npm run lint` com 0 erros
- [ ] `supabase/tests/rls_test.sql` devolve `RLS OK` no banco de produção
- [ ] Busca por termos internos vazia, por exemplo:
      `git grep -i -E "template|ceia|anotac|TODO|FIXME"`, revisando cada ocorrência
- [ ] `README.md` reescrito para o cliente a partir de `docs/README_CLIENTE.md`
- [ ] `src/config/brand.ts` com o nome e a tagline finais
