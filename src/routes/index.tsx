import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Loader2, Lock, Mail, ShieldCheck, User, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoSimbolo } from "@/components/ui/logo-simbolo";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Entrar | ${BRAND.name}` },
      { name: "description", content: BRAND.tagline },
      { property: "og:title", content: `Entrar | ${BRAND.name}` },
      { property: "og:description", content: BRAND.tagline },
    ],
  }),
  component: PaginaLogin,
});

// Três destaques do painel de marca: troque pelos da solução.
const DESTAQUES = [
  { icone: LayoutDashboard, texto: "O trabalho da equipe reunido num só painel" },
  { icone: Users, texto: "Cada pessoa com a sua conta, dentro da mesma organização" },
  { icone: ShieldCheck, texto: "Dados protegidos por conta e por organização" },
];

/** Mensagens do Supabase Auth (e do trigger de cadastro) em português. */
function traduzirErro(msg: string): string {
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  // O trigger `handle_new_user` recusa a conta com o cadastro fechado; o Auth
  // costuma devolver só o erro genérico de banco.
  if (msg.includes("Cadastro fechado") || /database error saving new user/i.test(msg))
    return "Cadastro fechado. Peça ao responsável para liberar.";
  if (/signup.*disabled|signups? not allowed/i.test(msg))
    return "Cadastro desativado neste projeto. Fale com o responsável.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar. O link foi enviado no cadastro.";
  if (/weak|pwned/i.test(msg))
    return "Senha fraca ou já vazada em outros sites. Escolha uma senha mais forte.";
  if (/password should be at least/i.test(msg))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("already registered")) return "Este e-mail já tem conta. Entre.";
  if (/invalid.*email|unable to validate email/i.test(msg)) return "E-mail inválido.";
  if (/rate limit|too many/i.test(msg))
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  return msg;
}

function PaginaLogin() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Logado que abre a tela de entrada vai direto para o painel.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        if (nome.trim().length < 2) {
          toast.error("Informe o seu nome.");
          return;
        }
        // A primeira conta da instalação vira dona da organização; as
        // seguintes entram como membros (trigger `handle_new_user`).
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nome: nome.trim() },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          toast.success("Conta criada! Confirme seu e-mail para entrar.");
          setSenha("");
          setModo("entrar");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível continuar.";
      toast.error(traduzirErro(msg));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* ── Painel de marca (deliberadamente escuro nos dois temas) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-neutral-50 lg:flex">
        <div className="relative flex items-center gap-3">
          <LogoSimbolo className="size-10" title="" />
          <span className="text-base font-semibold tracking-tight">{BRAND.name}</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <div>
            <h1 className="text-[34px] font-semibold leading-tight tracking-tight">
              {BRAND.tagline}
            </h1>
            <p className="mt-3 text-[15px] text-neutral-400">
              Entre com a sua conta para acessar o painel da equipe.
            </p>
          </div>
          <div className="space-y-4">
            {DESTAQUES.map((d) => (
              <div key={d.texto} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-neutral-800">
                  <d.icone size={16} strokeWidth={1.75} className="text-neutral-200" />
                </div>
                <span className="text-[13px] text-neutral-300">{d.texto}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative font-mono text-[11px] text-neutral-500">
          Powered by {BRAND.company}
        </p>
      </div>

      {/* ── Formulário ── */}
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <LogoSimbolo className="size-12 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight">
              {modo === "entrar" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h2>
            <p className="text-center text-sm text-muted-foreground lg:text-left">
              {modo === "entrar"
                ? `Entre na sua conta do ${BRAND.name}`
                : "A primeira conta criada vira dona da organização; as seguintes entram como membros."}
            </p>
          </div>

          <Card className="border-border">
            <Tabs value={modo} onValueChange={(v) => setModo(v as "entrar" | "cadastrar")}>
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="entrar">Entrar</TabsTrigger>
                  <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="space-y-4">
                <form onSubmit={enviar} className="space-y-4">
                  {modo === "cadastrar" && (
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input
                        icone={<User />}
                        id="nome"
                        name="name"
                        required
                        autoComplete="name"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      icone={<Mail />}
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@empresa.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input
                      icone={<Lock />}
                      id="senha"
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={carregando}>
                    {carregando && <Loader2 className="size-4 animate-spin" />}
                    {modo === "entrar" ? "Entrar" : "Criar conta"}
                  </Button>
                </form>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
