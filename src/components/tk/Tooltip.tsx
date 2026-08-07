"use client";

import * as React from "react";
import { Popover } from "./Popover";

/**
 * Tooltip — texto curto de apoio, ancorado a um gatilho.
 *
 * ⚠️ TOOLTIP NÃO É ONDE SE GUARDA INFORMAÇÃO NECESSÁRIA. Ela não existe no
 * toque, some ao mover o mouse e não é encontrável. Se o dado for preciso para
 * decidir, ele vai na tela — em `text-caption text-text-secondary`. A tooltip
 * serve para o que é dispensável: a fórmula por trás de um KPI, a unidade, o que
 * uma sigla quer dizer.
 *
 * ⚠️ E CONFIRA O `lib/explicacoes.ts` ANTES de escrever texto novo: ele é mais
 * completo do que parece, e a regra do projeto é simplificar jargão de
 * PROGRAMAÇÃO, nunca de tráfego. ROAS, CPA, CTR, CBO e criativo são o vocabulário
 * nativo de quem usa — explicá-los soa condescendente.
 *
 * Abre no hover E no foco: só no hover ela não existe para quem navega por
 * teclado, que é o critério 1.4.13 do WCAG. O atraso na entrada evita que a
 * tooltip pisque ao atravessar a tela com o mouse; a saída é imediata.
 */

const ATRASO_ENTRADA = 350;

export function Tooltip({
  texto,
  children,
  lado = "cima",
  larguraCheia = false,
}: {
  texto: React.ReactNode;
  /** O gatilho. Precisa aceitar ref e eventos — um elemento, não um fragmento. */
  children: React.ReactElement;
  lado?: "cima" | "baixo";
  /**
   * 🐛 O EMBRULHO ENCOLHE O GATILHO, e isso já quebrou o rail recolhido.
   *
   * O `<span>` abaixo é `inline-flex`, então ele mede o CONTEÚDO — e o gatilho
   * dentro dele perde a largura que tinha no pai. No rail colapsado os sete itens
   * de menu eram links de 43px com `justify-center`; embrulhados, viraram links de
   * **17px** (o tamanho do ícone) grudados na borda esquerda. Duas consequências,
   * e a segunda é pior que a estética: os ícones ficaram 13px fora do eixo
   * vertical de todo o resto, e a **área de clique caiu de 43px para 17px**.
   *
   * Com `larguraCheia`, o embrulho vira `block` e devolve a largura ao gatilho.
   * É opt-in porque o caso comum — tooltip num botão de ícone solto — quer mesmo
   * o embrulho do tamanho do conteúdo.
   */
  larguraCheia?: boolean;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = React.useId();

  const agendar = React.useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAberto(true), ATRASO_ENTRADA);
  }, []);
  const cancelar = React.useCallback(() => {
    clearTimeout(timer.current);
    setAberto(false);
  }, []);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      {/* `<span>` de embrulho em vez de cloneElement: clonar exige que TODO
          gatilho encaminhe ref e handlers, e o dia em que alguém passar um
          componente que não encaminha, a tooltip simplesmente não abre — sem
          erro nenhum. O span custa um nó e nunca falha em silêncio. */}
      <span
        ref={setGatilho}
        aria-describedby={aberto ? id : undefined}
        onPointerEnter={agendar}
        onPointerLeave={cancelar}
        onFocusCapture={() => setAberto(true)}
        onBlurCapture={cancelar}
        style={{ display: larguraCheia ? "block" : "inline-flex" }}
      >
        {children}
      </span>

      <Popover
        aberto={aberto}
        aoFechar={cancelar}
        gatilho={gatilho}
        lado={lado}
        alinhamento="centro"
        larguraDoGatilho={false}
        papel="tooltip"
        inerte
        id={id}
      >
        <span className="text-caption text-text" style={{ display: "block", padding: "4px 8px", maxWidth: 260 }}>
          {texto}
        </span>
      </Popover>
    </>
  );
}
