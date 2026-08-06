"use client";

import * as React from "react";

/**
 * Badge — o selo tingido. É o padrão mais repetido das telas de referência
 * (Pixel, CAPI, Ativo, Pausado, Analytics) e era o que mais reprovava em AA.
 *
 * 🔴 O QUE ESTE COMPONENTE EXISTE PARA IMPEDIR
 *
 * O desenho óbvio é "texto na cor X sobre um tingimento da cor X". Medido, ele
 * reprova quase todo par — e a causa é estrutural, não de calibragem: quando o
 * texto e o fundo são a mesma cor, mexer na porcentagem do tingimento não separa
 * os dois. A 10% dava 4.05:1 e a 18% dava 3.62:1; o pior caso era `accent` no
 * tema claro, a 1.97:1.
 *
 * Por isso o tom é UM nome (`tom="danger"`) e o componente escolhe o par —
 * `bg-tint-danger` com `text-on-tint-danger`. Não existe prop para trocar a cor
 * do texto: é justamente a liberdade que produzia o defeito.
 *
 * ⛔ NÃO existe tom de CANAL aqui, e a ausência é a regra, não um esquecimento.
 * Meta/TikTok/Google só podem colorir DENTRO da área de plotagem e da legenda de
 * um gráfico. Um selo é lido como controle/estado, e ali a cor do canal apagaria
 * a fronteira entre "onde eu clico" (azul) e "o que está acontecendo" (ciano).
 * Canal em selo se identifica por NOME ou por logotipo — ver a fronteira escrita
 * junto do token em `globals.css`.
 */

export type TomSelo =
  | "primary"   // em curso, selecionado
  | "accent"    // ao vivo, sincronizando agora
  | "success"   // ativo, aprovado, lucro
  | "warning"   // pausado, pendente, no limite
  | "danger"    // erro, recusado, prejuízo
  | "neutral"   // rascunho, arquivado, sem estado
  | "category"; // TIPO de coisa (Analytics, Pixel, CAPI) — nunca estado

type Props = {
  tom?: TomSelo;
  /** Ponto sólido à esquerda — para estado (Ativo/Pausado), não para categoria. */
  ponto?: boolean;
  /** Pulso do dado ao vivo. Só com `tom="accent"`: a lista do glow é FECHADA. */
  aoVivo?: boolean;
  children: React.ReactNode;
  title?: string;
};

/* Escrito por extenso, e não montado com `bg-tint-${tom}`: o Tailwind varre o
   código-fonte como TEXTO, e uma classe interpolada simplesmente não é gerada —
   o selo sairia sem fundo nenhum, sem erro de build. */
const PELO_TOM: Record<TomSelo, string> = {
  primary: "bg-tint-primary text-on-tint-primary",
  accent: "bg-tint-accent text-on-tint-accent",
  success: "bg-tint-success text-on-tint-success",
  warning: "bg-tint-warning text-on-tint-warning",
  danger: "bg-tint-danger text-on-tint-danger",
  neutral: "bg-tint-neutral text-on-tint-neutral",
  category: "bg-tint-category text-on-tint-category",
};

export function Badge({ tom = "neutral", ponto = false, aoVivo = false, children, title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-caption font-medium ${PELO_TOM[tom]} ${
        aoVivo ? "tk-live-pulso" : ""
      }`}
      style={{ padding: "2px 8px", borderRadius: "var(--tk-radius-pill)", lineHeight: 1.5 }}
    >
      {(ponto || aoVivo) && (
        /* `currentColor` — o ponto acompanha o `on-tint` do tom, que é a cor que
           já foi medida contra este fundo. Uma cor própria aqui seria um terceiro
           valor que ninguém aferiu. */
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: "var(--tk-radius-pill)", background: "currentColor", flex: "none" }}
        />
      )}
      {children}
    </span>
  );
}
