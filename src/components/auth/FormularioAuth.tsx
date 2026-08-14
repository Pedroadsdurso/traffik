"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock, Mail, User } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/tk/Button";
import { Checkbox } from "@/components/tk/Controles";
import { Input } from "@/components/tk/Input";
import type { AuthFormState } from "@/app/(auth)/actions";

/**
 * FormularioAuth — o cartão da direita, nos dois modos.
 *
 * A ação vem por prop e é a MESMA de antes (`loginAction` / `signupAction`, em
 * `app/(auth)/actions.ts`). Nada do que este formulário faz mudou: ele troca a
 * apresentação, e só.
 *
 * ⛔ NÃO EXISTE LOGIN SOCIAL NESTA TELA, e a ausência é decisão medida do dono
 * em 12/08/2026 — não esquecimento e não pendência de layout.
 *
 * `src/auth.ts` tem UM provider: `Credentials`. Não há Google, não há Facebook
 * Login, não há Apple — nem no NextAuth nem no `package.json`. (O
 * `/api/auth/facebook` que existe é OAuth da Marketing API, para conectar conta
 * de anúncio DEPOIS de entrar; não autentica ninguém.)
 *
 * Três botões que não fazem nada na tela de ENTRADA é o pior caso do controle
 * inerte desta base: quem clica em "Google" e não vê nada acontecer conclui que
 * o produto está quebrado antes de conhecer o produto. O divisor
 * "ou continue com" saiu junto — ele só existe para separar o que não existe.
 *
 * ⛔ Não "complete a tela" repondo os três. Repor exige três providers OAuth,
 * credenciais e vínculo de conta — backend novo, fora do redesign.
 */

type Modo = "login" | "signup";

/**
 * O aviso de credencial recusada.
 *
 * 🔴 EXTRAÍDO EM 14/08/2026, e o motivo é COBERTURA — não estética.
 *
 * Ele vivia inline, atrás de `estado.error`, e `estado` vem de
 * `useActionState`. **A ação não roda no SSR**: o estado inicial é `{}`, então
 * `renderToStaticMarkup` nunca alcançava este ramo. O `test:login` passava uma
 * ação falsa e mesmo assim media só o formulário limpo.
 *
 * ⛔ O `CLAUDE.md` já registrava que este é **o único caminho que o usuário
 * percorre quando algo dá errado**: quem acerta a senha vê a tela por dois
 * segundos e vai embora; quem erra fica ali, lendo. Era o caminho sem
 * asserção.
 *
 * ⚠️ A alternativa era uma prop `estadoInicial` que só o teste passasse — e
 * isso é literalmente o sinal barato da família *"helper com parâmetro que
 * ninguém mais passa"*. Um componente com consumidor de verdade não tem esse
 * problema.
 *
 * `role="alert"` para o erro ser anunciado sozinho: ele aparece DEPOIS do
 * envio, e sem isto quem usa leitor de tela só descobriria voltando ao campo.
 */
export function AvisoDeErro({ mensagem }: { mensagem: string }) {
  return (
    <p
      role="alert"
      className="text-danger bg-tint-danger"
      style={{
        margin: 0,
        fontSize: 13,
        borderRadius: "var(--tk-radius-controle)",
        border: "1px solid color-mix(in oklch, var(--tk-danger) 35%, transparent)",
        padding: "9px 11px",
      }}
    >
      {mensagem}
    </p>
  );
}

const COPIA: Record<Modo, { titulo: string; subtitulo: string; acao: string; ocupado: string }> = {
  login: {
    titulo: "Bem-vindo de volta",
    subtitulo: "Faça login para acessar sua conta",
    acao: "Entrar",
    ocupado: "Entrando…",
  },
  signup: {
    titulo: "Crie sua conta",
    /* ⚠️ ESTA FRASE VEIO DA TELA ANTIGA DE PROPÓSITO, e ela é VERDADE medida:
       `signupAction` cria um `Webhook` "Webhook principal" junto da conta
       (`app/(auth)/actions.ts`). Substituí-la por uma genérica teria jogado fora
       a única promessa concreta que a tela de cadastro fazia — e é a regra do
       CLAUDE.md pelo avesso: ao reescrever uma tela, procure as constantes de
       texto dela e pergunte se alguma descreve comportamento que CONTINUA
       valendo. */
    subtitulo: "Leva menos de um minuto — seu webhook de vendas já sai configurado",
    acao: "Criar conta",
    ocupado: "Criando…",
  },
};

export function FormularioAuth({
  modo,
  acao,
}: {
  modo: Modo;
  acao: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [estado, enviar] = useActionState<AuthFormState, FormData>(acao, {});
  const copia = COPIA[modo];

  return (
    <div
      className="bg-surface"
      style={{
        width: "min(440px, 100%)",
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius-painel)",
        boxShadow: "var(--tk-shadow-card)",
        padding: "clamp(24px, 3vw, 36px)",
      }}
    >
      <h2 className="text-text" style={{ margin: 0, fontSize: 24, lineHeight: 1.2, textAlign: "center", fontWeight: 600, letterSpacing: "-0.02em" }}>
        {copia.titulo}
      </h2>
      <p className="text-text-muted" style={{ margin: "8px 0 0", fontSize: 13.5, textAlign: "center" }}>
        {copia.subtitulo}
      </p>

      <form action={enviar} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
        {modo === "signup" && (
          <Input
            rotulo="Nome"
            name="name"
            autoComplete="name"
            required
            placeholder="Como devemos te chamar"
            iconeInicio={<User size={16} strokeWidth={1.75} />}
          />
        )}

        <Input
          rotulo="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="seu@email.com"
          iconeInicio={<Mail size={16} strokeWidth={1.75} />}
        />

        <Input
          rotulo="Senha"
          name="password"
          revelavel
          autoComplete={modo === "signup" ? "new-password" : "current-password"}
          required
          placeholder={modo === "signup" ? "Mínimo de 8 caracteres" : "Sua senha"}
          iconeInicio={<Lock size={16} strokeWidth={1.75} />}
        />

        {modo === "login" && <LinhaDeApoio />}

        {estado.error && <AvisoDeErro mensagem={estado.error} />}

        <BotaoEnviar rotulo={copia.acao} ocupado={copia.ocupado} />
      </form>
    </div>
  );
}

/**
 * `Lembrar de mim` e `Esqueci minha senha`.
 *
 * 🔴 OS DOIS SÃO INERTES, E ISSO FOI MEDIDO E DECIDIDO — não é bug.
 *
 * | Controle | O que existe no backend |
 * |---|---|
 * | Lembrar de mim | nada. `src/auth.ts` usa `session: { strategy: "jwt" }` **sem `maxAge`**, ou seja o padrão do NextAuth vale para todo mundo, marcado ou não |
 * | Esqueci minha senha | nada. Nenhuma rota, nenhuma tabela de token, nenhum envio de e-mail |
 *
 * Ligar o primeiro exigiria mexer no `auth.ts`, que é anterior a `4e6aa9e` e
 * portanto CONGELADO: mudança de comportamento em produção se aprova item a
 * item, nunca de passagem num commit de tela.
 *
 * ⚠️ O "Esqueci minha senha" NÃO É UM LINK MORTO. Um link que não vai a lugar
 * nenhum é procurado exatamente por quem está trancado do lado de fora, e o
 * silêncio dele é o pior desfecho possível. Ele diz o que é verdade. Isso não o
 * torna funcional — torna o fracasso legível.
 */
function LinhaDeApoio() {
  const [lembrar, setLembrar] = React.useState(false);
  const [avisou, setAvisou] = React.useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* ⚠️ `flexWrap` é conserto de tela, medido a 390px: sem ele "Lembrar de
          mim" quebrava em duas linhas e encostava no "Esqueci minha senha" ao
          lado. Com quebra, os dois empilham em vez de se espremerem. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Checkbox marcado={lembrar} aoMudar={setLembrar} rotulo="Lembrar de mim" />
        <button
          type="button"
          onClick={() => setAvisou((v) => !v)}
          aria-expanded={avisou}
          className="text-primary text-label cursor-pointer focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-controle"
          style={{ background: "none", border: 0, padding: 0, whiteSpace: "nowrap" }}
        >
          Esqueci minha senha
        </button>
      </div>

      {avisou && (
        <p role="status" className="text-text-muted text-caption" style={{ margin: 0 }}>
          A redefinição de senha por e-mail ainda não está disponível.
        </p>
      )}
    </div>
  );
}

/**
 * ⚠️ `useFormStatus` só enxerga o `<form>` de um ANCESTRAL — por isso o botão é
 * um componente separado, e não um `pending` lido no corpo acima. Lido lá, ele
 * seria `false` para sempre e o botão nunca mostraria a espera: inerte com build
 * verde.
 *
 * ⛔ VARIANTE `cta`, e o gradiente é um ANEL — não o preenchimento do mockup.
 * Medido no cabeçalho de `tk/Button`: nenhuma cor de rótulo atravessa o
 * gradiente inteiro (o rótulo claro cai a 1,73:1 no ciano). É o mockup que não
 * passa em AA, não o componente.
 */
function BotaoEnviar({ rotulo, ocupado }: { rotulo: string; ocupado: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variante="cta"
      blocoInteiro
      carregando={pending}
      iconeFim={<ArrowRight size={16} strokeWidth={2} />}
      style={{ marginTop: 4 }}
    >
      {pending ? ocupado : rotulo}
    </Button>
  );
}

/** O rodapé do cartão — a ponte entre os dois modos. */
export function TrocaDeModo({ modo }: { modo: Modo }) {
  const login = modo === "login";
  return (
    <p className="text-text-muted" style={{ margin: 0, fontSize: 13.5, textAlign: "center" }}>
      {login ? "Ainda não tem uma conta? " : "Já tem uma conta? "}
      <Link href={login ? "/signup" : "/login"} className="text-primary" style={{ fontWeight: 500 }}>
        {login ? "Criar conta" : "Entrar"}
      </Link>
    </p>
  );
}
