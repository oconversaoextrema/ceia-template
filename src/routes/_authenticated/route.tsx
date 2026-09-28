import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { EstadoVazio } from "@/components/PageHeader";
import { SkeletonPagina } from "@/components/Skeletons";
import { CHAVE_PERFIL, usePerfil } from "@/features/perfil/api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Roda a cada navegação dentro da área logada, então precisa ser barato:
  // getSession lê a sessão persistida (sem ir ao servidor, salvo token vencido).
  // O RLS do banco continua sendo a barreira real; aqui é só o redirecionamento.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  // O layout (sidebar + header) nunca é trocado por esqueleto durante a
  // navegação entre páginas internas; o esqueleto aparece só no Outlet.
  pendingMs: 1000,
  pendingMinMs: 0,
  component: LayoutAutenticado,
});

function LayoutAutenticado() {
  const { user } = Route.useRouteContext();
  return (
    <AppLayout email={user.email ?? ""}>
      <GarantirPerfil>
        <Outlet />
      </GarantirPerfil>
    </AppLayout>
  );
}

/**
 * O perfil existe sempre: o trigger `handle_new_user` cria um por conta. Se
 * mesmo assim não vier, mostra o erro em vez de ficar em laço de carregamento.
 *
 * Aqui também roda o reparo da organização única (`garantir_organizacao`): o
 * trigger já vincula toda conta nova, e a RPC só cria a organização quando ainda
 * não existe nenhuma. Quem foi removido pelo dono continua fora — ela não readmite.
 */
function GarantirPerfil({ children }: { children: ReactNode }) {
  const { data, isPending, isError, error } = usePerfil();
  const qc = useQueryClient();
  const [garantindoOrganizacao, setGarantindoOrganizacao] = useState(true);

  useEffect(() => {
    let vivo = true;
    async function garantir() {
      try {
        const { data: passouATerVinculo, error: erro } = await supabase.rpc("garantir_organizacao");
        if (erro) throw new Error(erro.message);
        if (vivo && passouATerVinculo === true) {
          void qc.invalidateQueries({ queryKey: CHAVE_PERFIL });
        }
      } catch (e: unknown) {
        const motivo = e instanceof Error ? e.message : "erro desconhecido";
        toast.error(`Não foi possível verificar a organização: ${motivo}`);
      } finally {
        if (vivo) setGarantindoOrganizacao(false);
      }
    }
    void garantir();
    return () => {
      vivo = false;
    };
  }, [qc]);

  if (isPending || garantindoOrganizacao) return <SkeletonPagina />;

  if (isError || !data.perfil) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <EstadoVazio
          titulo="Não foi possível carregar o seu perfil"
          descricao={
            error instanceof Error
              ? error.message
              : "Recarregue a página. Se continuar assim, saia e entre de novo."
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
