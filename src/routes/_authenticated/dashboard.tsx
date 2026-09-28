import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { CartaoMetrica, SkeletonMetricas } from "@/components/CartaoMetrica";
import { primeiroNome, usePerfil } from "@/features/perfil/api";
import { useMetricasAnotacoes } from "@/features/anotacoes/api";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: `Início | ${BRAND.name}` }] }),
  component: PaginaDashboard,
});

function PaginaDashboard() {
  const { data: ctx } = usePerfil();
  const metricas = useMetricasAnotacoes(ctx?.perfil?.id);

  const nome = primeiroNome(ctx?.perfil?.nome);
  const organizacao = ctx?.organizacao ?? null;
  const descricao = organizacao
    ? `Painel de ${organizacao.nome}. Todos os membros enxergam os mesmos dados compartilhados.`
    : "Você não faz parte da organização no momento: aqui aparece só o que é seu.";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader titulo={nome ? `Olá, ${nome}` : "Início"} descricao={descricao} />

      {metricas.isPending ? (
        <SkeletonMetricas quantidade={3} />
      ) : metricas.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar os números"
          descricao={metricas.error.message}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <CartaoMetrica rotulo="Anotações visíveis" valor={metricas.data.total} />
          <CartaoMetrica rotulo="Criadas por você" valor={metricas.data.minhas} />
          <CartaoMetrica rotulo="Criadas nesta semana" valor={metricas.data.estaSemana} />
        </div>
      )}

      <EstadoVazio
        titulo="Tela inicial da solução"
        descricao="Troque estes cartões pelos números que importam para quem usa. A tela de Anotações mostra o padrão de uma feature: lista, formulário, exclusão e permissões por organização."
        acao={
          <Button asChild variant="outline">
            <Link to="/anotacoes">Abrir anotações</Link>
          </Button>
        }
      />
    </div>
  );
}
