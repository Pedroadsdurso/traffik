"use client";

import * as React from "react";

/**
 * ZONA DE EDIÇÃO — o contorno que aparece só no modo de edição.
 *
 * 🔴 O RÓTULO DIZ A REGRA, NÃO O NOME. "Principais" sozinho não informa nada
 * acionável; **"Principais — sempre 4"** responde antes da pergunta por que o ✕
 * não aparece, por que adicionar virou trocar, e por que a fileira não muda de
 * tamanho. A regra é a única coisa que o usuário não consegue descobrir olhando.
 *
 * ⚠️ O contador (`6 de 8`) fica ao lado da regra, e só onde existe teto. Numa
 * zona sem limite ele seria um número que não informa decisão nenhuma.
 *
 * ### 🔴 O DESTINO VÁLIDO ACENDE; O INCOMPATÍVEL APAGA — durante o gesto
 *
 * Substituiu o contorno de perigo da entrega C, e a diferença não é estética. O
 * vermelho respondia *"aqui não"* depois de o ponteiro já ter ido até lá; o par
 * acender/apagar responde **"lá sim"** no instante em que o arrasto começa, com
 * a tela inteira à vista. É a diferença entre corrigir um gesto e guiá-lo.
 *
 * ⚠️ A zona apagada continua legível — `opacity` de 0,4, não 0,15. Ela não
 * desapareceu do produto; ela só não é destino DESTE item, e o usuário precisa
 * continuar entendendo o que está vendo enquanto arrasta por cima.
 *
 * ⛔ E o cursor de proibido não vem daqui: vem de o destino incompatível **não
 * chamar `preventDefault`** no `dragover`. A opacidade sozinha seria metade do
 * sinal — quem arrasta olha para o ponteiro.
 */

export function ZonaEdicao({
  titulo,
  regra,
  contador,
  arrastando = false,
  aceita = false,
  destino,
  children,
}: {
  titulo: string;
  /** A REGRA da zona, em uma linha. Vai junto do título, não numa tooltip. */
  regra: string;
  /** `"6 de 8"`. Só onde há teto. */
  contador?: string;
  /** Há um arrasto em curso na tela. */
  arrastando?: boolean;
  /** Esta zona aceita a carga que está sendo arrastada. */
  aceita?: boolean;
  /** Handlers para soltar no FIM da zona (área vazia). `null` = não aceita. */
  destino?: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void } | null;
  children: React.ReactNode;
}) {
  const acesa = arrastando && aceita;
  const apagada = arrastando && !aceita;

  return (
    <section
      aria-label={`${titulo} — ${regra}`}
      {...(destino ?? {})}
      style={{
        border: `1px dashed ${acesa ? "var(--tk-primary)" : "var(--tk-border)"}`,
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        background: acesa ? "var(--tk-tint-primary)" : "transparent",
        opacity: apagada ? 0.4 : 1,
        transition: "border-color 120ms, background-color 120ms, opacity 120ms",
        display: "flex",
        flexDirection: "column",
        gap: "var(--tk-gap-grid)",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="text-label text-text">{titulo}</span>
        <span className="text-caption text-text-secondary">— {regra}</span>
        {contador && (
          <span
            className="text-caption text-text-muted"
            style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}
          >
            {contador}
          </span>
        )}
      </header>

      {children}
    </section>
  );
}
