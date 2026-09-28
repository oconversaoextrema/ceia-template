import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead className="hidden md:table-cell">Autor</TableHead>
            <TableHead>Visibilidade</TableHead>
            <TableHead className="hidden sm:table-cell">Atualizada em</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anotacoes.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="max-w-[16rem] sm:max-w-md">
                <p className="truncate font-medium">{a.titulo}</p>
                {a.conteudo && (
                  <p className="truncate text-caption text-muted-foreground">{a.conteudo}</p>
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {a.user_id === meuId ? "Você" : (a.autor?.nome ?? "—")}
              </TableCell>
              <TableCell>
                <Badge variant={a.organizacao_id ? "info" : "secondary"}>
                  {a.organizacao_id ? "Organização" : "Pessoal"}
                </Badge>
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                {dataHoraBR(a.updated_at)}
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
