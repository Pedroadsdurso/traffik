"use client";

import { useCallback, useState } from "react";
import type { Zona } from "../catalogo";

/**
 * O ARRASTO DO MODO DE EDIÇÃO — uma fonte de verdade para as três zonas e o
 * catálogo lateral.
 *
 * 🔴 POR QUE O ESTADO É COMPARTILHADO, E NÃO LOCAL DE CADA ZONA
 *
 * O requisito do produto é *"o destino válido se ACENDE durante o arrasto; o que
 * não aceita fica apagado"*. Isso não é uma decisão de quem recebe — é uma
 * decisão sobre **todas** as zonas ao mesmo tempo, tomada no instante em que o
 * gesto começa. Com estado por zona, cada uma descobriria sozinha, e a que
 * esquecesse ficaria acesa recusando na soltura — que é exatamente o que o dono
 * mandou nunca acontecer.
 *
 * ⛔ E a recusa nunca é pós-soltura. O `dragover` de um destino incompatível
 * **não chama `preventDefault`**, e é isso que faz o navegador desenhar o cursor
 * de proibido no meio do gesto. A opacidade sozinha seria metade do sinal: quem
 * arrasta olha para o ponteiro.
 */

export type Carga =
  | {
      tipo: "metrica";
      chave: string;
      rotulo: string;
      /** De onde saiu. `catalogo` = ainda não está no painel. */
      origem: "hero" | "faixa" | "catalogo";
      /** Posição na zona de origem. `-1` quando vem do catálogo. */
      indice: number;
    }
  | { tipo: "painel"; id: string; rotulo: string; origem: "paineis" | "catalogo"; indice: number };

/** Onde o ponteiro está agora. `catalogo` é o alvo que REMOVE. */
export type Alvo = { tipo: "zona"; zona: Zona; indice: number } | { tipo: "catalogo" };

/**
 * ⛔ A COMPATIBILIDADE MORA AQUI, e não em cada zona.
 *
 * Métrica vive em `hero` ou `faixa`; painel, em `paineis`. Duas cópias desta
 * regra divergiriam no dia em que aparecesse uma quarta zona — e a divergência
 * apareceria como "a zona aceitou e não fez nada", que não tem sintoma.
 */
export function zonaAceita(zona: Zona, carga: Carga | null): boolean {
  if (!carga) return false;
  return carga.tipo === "metrica" ? zona === "hero" || zona === "faixa" : zona === "paineis";
}

/**
 * O catálogo só aceita o que JÁ ESTÁ no painel — soltar ali é remover.
 *
 * ⚠️ Item que veio do próprio catálogo é recusado de propósito: aceitar
 * produziria um gesto que percorre a tela inteira e não muda nada, e o usuário
 * ficaria procurando o que ele fez de errado.
 *
 * ⛔ E o HERO também é recusado, pela regra da zona: remover de lá deixaria
 * Principais com 3, que é o estado que o produto não admite. Recusar aqui é o
 * que faz o painel ficar APAGADO enquanto se arrasta um hero — a regra aparece
 * no gesto, em vez de virar um erro depois da soltura.
 */
export function catalogoAceita(carga: Carga | null): boolean {
  return !!carga && carga.origem !== "catalogo" && carga.origem !== "hero";
}

export function useArrasto() {
  const [carga, setCarga] = useState<Carga | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);

  const comecar = useCallback((c: Carga) => setCarga(c), []);
  const terminar = useCallback(() => {
    setCarga(null);
    setAlvo(null);
  }, []);

  /**
   * Os handlers de um destino. Devolve `null` quando o destino não aceita a
   * carga atual — e **`null` é o que produz o cursor de proibido**, porque sem
   * `onDragOver` não há `preventDefault`.
   */
  const destino = useCallback(
    (
      alvoDoDestino: Alvo,
      aoSoltar: (c: Carga) => void,
    ): { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void } | null => {
      const aceita = alvoDoDestino.tipo === "catalogo" ? catalogoAceita(carga) : zonaAceita(alvoDoDestino.zona, carga);
      if (!aceita) return null;
      return {
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = alvoDoDestino.tipo === "catalogo" ? "move" : "move";
          setAlvo(alvoDoDestino);
        },
        onDrop: (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (carga) aoSoltar(carga);
          terminar();
        },
      };
    },
    [carga, terminar],
  );

  /** `true` quando ESTE alvo é o que está sob o ponteiro agora. */
  const ehAlvo = useCallback(
    (a: Alvo) =>
      !!alvo &&
      alvo.tipo === a.tipo &&
      (a.tipo === "catalogo" || (alvo.tipo === "zona" && alvo.zona === a.zona && alvo.indice === a.indice)),
    [alvo],
  );

  return { carga, alvo, comecar, terminar, destino, ehAlvo, arrastando: carga !== null };
}

export type EstadoArrasto = ReturnType<typeof useArrasto>;
