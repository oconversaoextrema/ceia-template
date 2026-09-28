import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/**
 * Acesso a dados da feature de exemplo. Toda feature nova segue este molde:
 * uma chave de query por recurso, leitura pelo cliente com RLS, mutações que
 * invalidam a chave e erros já em português para o toast.
 */

export type Anotacao = Tables<"anotacoes">;
export type AnotacaoComAutor = Anotacao & { autor: { nome: string } | null };

/** Raiz das chaves desta feature: invalidar ela recarrega lista e métricas. */
export const CHAVE_ANOTACOES = ["anotacoes"] as const;

export const esquemaAnotacao = z.object({
  titulo: z
    .string()
    .trim()
    .min(2, "Informe um título com pelo menos 2 caracteres.")
    .max(200, "O título pode ter no máximo 200 caracteres."),
  conteudo: z.string().trim().max(10_000, "O texto pode ter no máximo 10.000 caracteres."),
  /** true: grava com a organização de quem cria; false: registro pessoal. */
  compartilhada: z.boolean(),
});

export type DadosAnotacao = z.infer<typeof esquemaAnotacao>;

/** Quem cria: o id do perfil e a organização atual (nula para quem foi removido). */
export interface Autoria {
  userId: string;
  organizacaoId: string | null;
}

function validar(dados: DadosAnotacao): DadosAnotacao {
  const r = esquemaAnotacao.safeParse(dados);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados inválidos.");
  return r.data;
}

// A RLS devolve "new row violates row-level security policy" quando o insert
// ou update sai do que a policy permite.
function erroLegivel(mensagem: string): Error {
  if (/row-level security/i.test(mensagem)) {
    return new Error("Você não tem permissão para alterar esta anotação.");
  }
  return new Error(mensagem);
}

export function useAnotacoes() {
  return useQuery({
    queryKey: [...CHAVE_ANOTACOES, "lista"],
    queryFn: async (): Promise<AnotacaoComAutor[]> => {
      const { data, error } = await supabase
        .from("anotacoes")
        .select("*, autor:perfis(nome)")
        .order("updated_at", { ascending: false });
      if (error) throw erroLegivel(error.message);
      return data ?? [];
    },
  });
}

export interface MetricasAnotacoes {
  total: number;
  minhas: number;
  estaSemana: number;
}

/** Segunda-feira 00:00 da semana corrente, no fuso do navegador. */
function inicioDaSemana(): Date {
  const d = new Date();
  const diasDesdeSegunda = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diasDesdeSegunda);
  return d;
}

/** Contagens com `head: true`: o banco devolve só o número, sem linhas. */
export function useMetricasAnotacoes(userId: string | undefined) {
  return useQuery({
    queryKey: [...CHAVE_ANOTACOES, "metricas", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MetricasAnotacoes> => {
      const contar = () => supabase.from("anotacoes").select("id", { count: "exact", head: true });
      const [total, minhas, semana] = await Promise.all([
        contar(),
        contar().eq("user_id", userId ?? ""),
        contar().gte("created_at", inicioDaSemana().toISOString()),
      ]);
      for (const r of [total, minhas, semana]) {
        if (r.error) throw erroLegivel(r.error.message);
      }
      return {
        total: total.count ?? 0,
        minhas: minhas.count ?? 0,
        estaSemana: semana.count ?? 0,
      };
    },
  });
}

export function useCriarAnotacao(autoria: Autoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: DadosAnotacao) => {
      const { titulo, conteudo, compartilhada } = validar(dados);
      const { error } = await supabase.from("anotacoes").insert({
        user_id: autoria.userId,
        organizacao_id: compartilhada ? autoria.organizacaoId : null,
        titulo,
        conteudo,
      });
      if (error) throw erroLegivel(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_ANOTACOES }),
  });
}

export function useAtualizarAnotacao(autoria: Autoria) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosAnotacao }) => {
      const { titulo, conteudo, compartilhada } = validar(dados);
      const { data, error } = await supabase
        .from("anotacoes")
        .update({
          titulo,
          conteudo,
          organizacao_id: compartilhada ? autoria.organizacaoId : null,
        })
        .eq("id", id)
        .select("id");
      if (error) throw erroLegivel(error.message);
      // Fora da policy o update não afeta linha nenhuma, sem erro.
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para alterar esta anotação.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_ANOTACOES }),
  });
}

export function useExcluirAnotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("anotacoes").delete().eq("id", id).select("id");
      if (error) throw erroLegivel(error.message);
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para excluir esta anotação.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAVE_ANOTACOES }),
  });
}
