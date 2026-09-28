import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "@/components/Campo";
import {
  useAtualizarAnotacao,
  useCriarAnotacao,
  type Anotacao,
  type Autoria,
  type DadosAnotacao,
} from "./api";

/**
 * Criar e editar no mesmo Dialog. `anotacao` nulo = criação. O pai monta o
 * componente com `key` diferente a cada abertura, então o estado inicial do
 * formulário sempre parte do registro certo.
 */
export function FormularioAnotacao({
  aberto,
  aoMudarAberto,
  anotacao,
  autoria,
}: {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  anotacao: Anotacao | null;
  autoria: Autoria;
}) {
  const [dados, setDados] = useState<DadosAnotacao>(() => ({
    titulo: anotacao?.titulo ?? "",
    conteudo: anotacao?.conteudo ?? "",
    compartilhada: anotacao ? anotacao.organizacao_id !== null : autoria.organizacaoId !== null,
  }));

  const criar = useCriarAnotacao(autoria);
  const atualizar = useAtualizarAnotacao(autoria);
  const salvando = criar.isPending || atualizar.isPending;

  // Só quem criou decide se o registro é pessoal ou da organização; sem
  // organização (conta removida) não há o que compartilhar.
  const podeCompartilhar =
    autoria.organizacaoId !== null && (!anotacao || anotacao.user_id === autoria.userId);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const aoTerminar = {
      onSuccess: () => {
        toast.success(anotacao ? "Anotação atualizada." : "Anotação criada.");
        aoMudarAberto(false);
      },
      onError: (erro: Error) => toast.error(erro.message),
    };
    if (anotacao) atualizar.mutate({ id: anotacao.id, dados }, aoTerminar);
    else criar.mutate(dados, aoTerminar);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !salvando && aoMudarAberto(v)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={salvar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{anotacao ? "Editar anotação" : "Nova anotação"}</DialogTitle>
            <DialogDescription>
              Anotações da organização aparecem para toda a equipe; as pessoais, só para você.
            </DialogDescription>
          </DialogHeader>

          <Campo rotulo="Título" htmlFor="titulo-anotacao">
            <Input
              id="titulo-anotacao"
              required
              minLength={2}
              maxLength={200}
              autoFocus
              value={dados.titulo}
              onChange={(e) => setDados((d) => ({ ...d, titulo: e.target.value }))}
            />
          </Campo>

          <Campo rotulo="Texto" htmlFor="conteudo-anotacao">
            <Textarea
              id="conteudo-anotacao"
              rows={6}
              maxLength={10_000}
              value={dados.conteudo}
              onChange={(e) => setDados((d) => ({ ...d, conteudo: e.target.value }))}
            />
          </Campo>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <label htmlFor="compartilhada-anotacao" className="text-label-md text-foreground">
                Compartilhar com a organização
              </label>
              <p className="text-caption text-muted-foreground">
                {podeCompartilhar
                  ? "Desligado, a anotação fica visível só para você."
                  : "Só quem criou a anotação muda a visibilidade."}
              </p>
            </div>
            <Switch
              id="compartilhada-anotacao"
              checked={dados.compartilhada}
              disabled={!podeCompartilhar}
              onCheckedChange={(v) => setDados((d) => ({ ...d, compartilhada: v }))}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => aoMudarAberto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="size-4 animate-spin" />}
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
