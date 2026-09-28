import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabela, type ColunaTabela } from "@/components/Tabela";
import { dataHoraBR } from "@/lib/format";
import type { AnotacaoComAutor } from "./api";

export function TabelaAnotacoes({
  anotacoes,
  meuId,
  aoEditar,
  aoExcluir,
}: {
  anotacoes: AnotacaoComAutor[];
  meuId: string;
  aoEditar: (anotacao: AnotacaoComAutor) => void;
  aoExcluir: (anotacao: AnotacaoComAutor) => void;
}) {
  const colunas: ColunaTabela<AnotacaoComAutor>[] = [
    {
      chave: "titulo",
      titulo: "Título",
      ordenavel: true,
      classe: "max-w-[16rem] sm:max-w-md",
      renderizar: (a) => (
        <>
          <p className="truncate">{a.titulo}</p>
          {a.conteudo && (
            <p className="truncate text-caption font-normal text-muted-foreground">{a.conteudo}</p>
          )}
        </>
      ),
    },
    {
      chave: "autor",
      titulo: "Autor",
      classe: "hidden text-muted-foreground md:table-cell",
      renderizar: (a) =>
        a.user_id === meuId ? "Você" : (a.autor?.nome ?? <span className="text-faint">–</span>),
    },
    {
      chave: "visibilidade",
      titulo: "Visibilidade",
      renderizar: (a) => (
        <Badge variant={a.organizacao_id ? "info" : "secondary"}>
          {a.organizacao_id ? "Organização" : "Pessoal"}
        </Badge>
      ),
    },
    {
      chave: "updated_at",
      titulo: "Atualizada em",
      ordenavel: true,
      // A célula mostra "dd/mm/aaaa hh:mm"; a ordem sai do instante.
      valorOrdenacao: (a) => new Date(a.updated_at).getTime(),
      classe: "hidden whitespace-nowrap text-muted-foreground sm:table-cell",
      renderizar: (a) => dataHoraBR(a.updated_at),
    },
    {
      chave: "acoes",
      titulo: <span className="sr-only">Ações</span>,
      alinhar: "direita",
      renderizar: (a) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Editar ${a.titulo}`}
            onClick={() => aoEditar(a)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label={`Excluir ${a.titulo}`}
            onClick={() => aoExcluir(a)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <Tabela
        colunas={colunas}
        linhas={anotacoes}
        chaveLinha={(a) => a.id}
        ordenacaoInicial={{ chave: "updated_at", direcao: "desc" }}
        vazio="Nenhuma anotação neste filtro."
      />
    </Card>
  );
}
