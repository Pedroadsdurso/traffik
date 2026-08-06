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
 * ### 🔴 A RECUSA ENTRE ZONAS APARECE DURANTE O ARRASTO
 *
 * Quando um item de outra zona passa por cima, a zona inteira se marca como
 * recusada — contorno de perigo e a frase do porquê. **Não é decoração de
 * `onDrop`:** recusar depois de soltar obriga o usuário a executar um gesto
 * inteiro para descobrir que ele não era possível, e não diz o que fazer.
 *
 * ⚠️ O cursor de proibido é do NAVEGADOR, e vem de não chamar `preventDefault`
 * no `dragover` do alvo estrangeiro — é o que faz o `dropEffect` virar `none`.
 * Só o contorno seria metade do sinal: quem arrasta olha para o cursor.
 */

export function ZonaEdicao({
  titulo,
  regra,
  contador,
  recusaSe = false,
  children,
}: {
  titulo: string;
  /** A REGRA da zona, em uma linha. Vai junto do título, não numa tooltip. */
  regra: string;
  /** `"6 de 8"`. Só onde há teto. */
  contador?: string;
  /**
   * `true` quando há um arrasto em curso vindo de OUTRA zona.
   *
   * ⚠️ Isto sozinho não pinta nada: a recusa aparece quando o ponteiro está
   * SOBRE esta zona. Marcar todas as outras assim que o arrasto começa
   * transforma o gesto inteiro num campo minado vermelho, e o sinal deixa de
   * apontar para onde o usuário está.
   */
  recusaSe?: boolean;
  children: React.ReactNode;
}) {
  const [sobreMim, setSobreMim] = React.useState(false);
  const recusando = recusaSe && sobreMim;

  /* ⚠️ Sem o `contains`, o `dragleave` de cada filho subiria até aqui e o
     contorno piscaria a cada item atravessado. `relatedTarget` é para onde o
     ponteiro FOI — se ainda está dentro da zona, não saiu de nada. */
  const saiu = React.useCallback((e: React.DragEvent) => {
    const indo = e.relatedTarget;
    if (indo instanceof Node && e.currentTarget.contains(indo)) return;
    setSobreMim(false);
  }, []);

  return (
    <section
      aria-label={`${titulo} — ${regra}`}
      /* ⛔ NÃO HÁ `preventDefault` AQUI, e é isso que produz o cursor de
         proibido: sem ele o `dropEffect` do navegador vira `none` enquanto o
         ponteiro está sobre uma zona estrangeira. Quem permite a soltura é o
         item, e só quando a origem é da mesma zona. */
      onDragOver={() => setSobreMim(true)}
      onDragLeave={saiu}
      onDrop={() => setSobreMim(false)}
      onDragEnd={() => setSobreMim(false)}
      style={{
        border: `1px dashed ${recusando ? "var(--tk-danger)" : "var(--tk-border)"}`,
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        background: recusando ? "var(--tk-tint-danger)" : "transparent",
        transition: "border-color 120ms, background-color 120ms",
        display: "flex",
        flexDirection: "column",
        gap: "var(--tk-gap-grid)",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span className="text-label text-text">{titulo}</span>
        <span className="text-caption text-text-secondary">— {regra}</span>
        {contador && (
          <span className="text-caption text-text-muted" style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {contador}
          </span>
        )}
      </header>

      {recusando && (
        /* A frase nomeia a zona de destino, não a de origem: quem arrasta já
           sabe de onde veio. O que ele não sabe é por que ESTA não aceita. */
        <p className="text-caption text-danger" style={{ margin: 0 }}>
          {titulo} não recebe blocos de outra zona. Solte de volta na zona de origem.
        </p>
      )}

      {children}
    </section>
  );
}
