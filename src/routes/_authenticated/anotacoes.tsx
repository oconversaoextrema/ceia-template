import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EstadoVazio, PageHeader } from "@/components/PageHeader";
import { SkeletonTabela } from "@/components/Skeletons";
import { usePerfil } from "@/features/perfil/api";
import {
  useAnotacoes,
  useExcluirAnotacao,
  type AnotacaoComAutor,
  type Autoria,
} from "@/features/anotacoes/api";
import { FormularioAnotacao } from "@/features/anotacoes/FormularioAnotacao";
import { TabelaAnotacoes } from "@/features/anotacoes/TabelaAnotacoes";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/_authenticated/anotacoes")({
  head: () => ({ meta: [{ title: `Anotações | ${BRAND.name}` }] }),
  component: PaginaAnotacoes,
});

/** Estado do Dialog: fechado, criando (null) ou editando um registro. */
type Edicao =
  { aberto: false } | { aberto: true; anotacao: AnotacaoComAutor | null; chave: number };

function PaginaAnotacoes() {
  const { data: ctx } = usePerfil();
  const lista = useAnotacoes();
  const excluir = useExcluirAnotacao();
  const [edicao, setEdicao] = useState<Edicao>({ aberto: false });
  const [paraExcluir, setParaExcluir] = useState<AnotacaoComAutor | null>(null);

  // O layout (`GarantirPerfil`) só renderiza a página com o perfil carregado.
  const autoria: Autoria = {
    userId: ctx?.perfil?.id ?? "",
    organizacaoId: ctx?.organizacao?.id ?? null,
  };

  const abrir = (anotacao: AnotacaoComAutor | null) =>
    setEdicao({ aberto: true, anotacao, chave: Date.now() });

  function confirmarExclusao() {
    if (!paraExcluir) return;
    excluir.mutate(paraExcluir.id, {
      onSuccess: () => {
        toast.success("Anotação excluída.");
        setParaExcluir(null);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  }

  const botaoNova = (
    <Button onClick={() => abrir(null)}>
      <Plus className="size-4" />
      Nova anotação
    </Button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <PageHeader
        titulo="Anotações"
        descricao="Registros da equipe e pessoais. Exemplo de feature: lista, formulário, exclusão e permissões por organização."
        acoes={botaoNova}
      />

      {lista.isPending ? (
        <SkeletonTabela linhas={4} colunas={4} />
      ) : lista.isError ? (
        <EstadoVazio
          titulo="Não foi possível carregar as anotações"
          descricao={lista.error.message}
          acao={
            <Button variant="outline" onClick={() => void lista.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : lista.data.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma anotação ainda"
          descricao="Crie a primeira. Compartilhada, ela aparece para toda a organização."
          acao={botaoNova}
        />
      ) : (
        <TabelaAnotacoes
          anotacoes={lista.data}
          meuId={autoria.userId}
          aoEditar={abrir}
          aoExcluir={setParaExcluir}
        />
      )}

      {edicao.aberto && (
        <FormularioAnotacao
          key={edicao.chave}
          aberto
          aoMudarAberto={(v) => !v && setEdicao({ aberto: false })}
          anotacao={edicao.anotacao}
          autoria={autoria}
        />
      )}

      <AlertDialog
        open={paraExcluir !== null}
        onOpenChange={(v) => !v && !excluir.isPending && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${paraExcluir?.titulo ?? ""}" será apagada para todos que a veem. Não há como desfazer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={excluir.isPending} onClick={confirmarExclusao}>
              {excluir.isPending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
