import { COPYRIGHT } from "@/lib/auth/conteudo";
import type { AuthFormState } from "@/app/(auth)/actions";
import { FormularioAuth, TrocaDeModo } from "./FormularioAuth";
import { PainelMarca } from "./PainelMarca";

/**
 * TelaAuth — a moldura de `/login` e `/signup`.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 A CLASSE `tk-tema` NA RAIZ NÃO É DECORAÇÃO. É O QUE IMPEDE O ANEL ROXO.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Esta é a ÚNICA tela do produto fora do shell: não há `AppShell`, e é o
 * `AppShell` que aplica `.tk-tema` nas outras vinte e uma rotas. Sem a classe
 * aqui, três regras GLOBAIS do `globals.css` continuam resolvendo tokens do
 * sistema LEGADO, porque elas leem `--color-accent` — que no `:root` vale
 * `#9184d9` (roxo), e só vira azul dentro da ponte:
 *
 *   `a { color: var(--color-accent) }`                 → todo link, roxo
 *   `:focus-visible { outline: … var(--color-accent) }` → anel de foco, roxo
 *   `::selection { … var(--color-accent) … }`           → seleção de texto, roxa
 *
 * É exatamente o defeito medido em 11/08/2026 no `RuleDrawer` legado, cujo anel
 * de foco saía roxo por portar para o `<body>`, fora da ponte. Numa tela de
 * FORMULÁRIO o alcance é maior: o anel de foco é o principal sinal de navegação
 * por teclado, e ele está em todo campo.
 *
 * A ponte também traz `font-family: var(--tk-font-sans)` e o fundo — o `body`
 * ainda pinta com `--font-body` (Inter) e `--color-bg`, que são os do legado.
 *
 * ⛔ NÃO substitua isto por redeclarar `--color-accent` e `--font-body` num
 * `style` inline aqui. Seria uma SEGUNDA implementação da ponte, e duas
 * implementações da mesma conta divergem sempre — a primeira vez que alguém
 * mexer no `.tk-tema`, esta tela fica para trás em silêncio.
 *
 * ⚠️ Quando a ponte morrer (depois das doze telas), ela morre para as duas de
 * uma vez, porque é a MESMA classe. Não há nada aqui para migrar em separado.
 *
 * ── Estrutura ────────────────────────────────────────────────────────────────
 * Duas colunas acima de 1024px, uma abaixo. O painel de marca some no estreito:
 * ele não tem controle nenhum, só prova. O que nunca some é o formulário.
 */
export function TelaAuth({
  modo,
  acao,
}: {
  modo: "login" | "signup";
  acao: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  return (
    <div className="tk-tema tk-auth" style={{ minHeight: "100dvh" }}>
      {/* ⚠️ `tk-auth-marca` some abaixo de 1024px por CSS, não por JS: media
          query em componente exigiria medir a janela no cliente, e aí o HTML do
          servidor sairia com o painel e o cliente o removeria — mudança de
          layout depois da hidratação, em cima da tela de entrada. */}
      <div className="tk-auth-marca">
        <PainelMarca />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "40px clamp(20px, 4vw, 56px)",
          minWidth: 0,
        }}
      >
        <FormularioAuth modo={modo} acao={acao} />
        <TrocaDeModo modo={modo} />

        <p className="text-text-muted" style={{ margin: "12px 0 0", fontSize: 12, textAlign: "center" }}>
          {COPYRIGHT}
        </p>
      </div>
    </div>
  );
}
