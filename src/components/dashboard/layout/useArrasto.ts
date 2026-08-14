"use client";

import { useCallback, useState } from "react";
import { metaDoBloco } from "../catalogo";

/**
 * O ARRASTO DO MODO DE EDIÇÃO — uma fonte de verdade para a grade e o catálogo
 * lateral.
 *
 * ### 🔴 A COMPATIBILIDADE DE ZONA SUMIU — F5, 12/08/2026
 *
 * Este arquivo tinha uma `zonaAceita(zona, carga)` e um tipo `Carga` com duas
 * variantes (`metrica` | `painel`), porque métrica só podia cair em `hero`/
 * `faixa` e painel só em `paineis`. **As três zonas acabaram**, e com elas a
 * pergunta: hoje todo bloco cabe no único destino que existe.
 *
 * ⛔ O tipo não foi mantido com uma variante só "por segurança". Enquanto ele
 * existisse, o `destino()` teria uma regra para aplicar e a próxima pessoa a ler
 * o arquivo encontraria descrita uma categoria que o produto não tem mais — a
 * família da proibição que envelhece e vira ordem de reverter.
 *
 * ### 🔴 O QUE NÃO MUDOU: a recusa aparece ANTES da soltura
 *
 * O requisito do produto é *"o destino válido se ACENDE durante o arrasto; o que
 * não aceita fica apagado"*. Sobrou UM destino que ainda recusa — o catálogo
 * lateral, que é a lixeira —, e a mecânica é a mesma: o `dragover` de um destino
 * incompatível **não chama `preventDefault`**, e é isso que faz o navegador
 * desenhar o cursor de proibido no meio do gesto. A opacidade sozinha seria
 * metade do sinal: quem arrasta olha para o ponteiro.
 */

export type Carga = {
  id: string;
  rotulo: string;
  /** De onde saiu. `catalogo` = ainda não está na grade. */
  origem: "grade" | "catalogo";
  /** Posição na grade. `-1` quando vem do catálogo. */
  indice: number;
};

/** Onde o ponteiro está agora. `catalogo` é o alvo que REMOVE. */
export type Alvo = { tipo: "grade"; indice: number } | { tipo: "catalogo" };

/**
 * O catálogo só aceita o que JÁ ESTÁ na grade — soltar ali é remover.
 *
 * ⚠️ Item que veio do próprio catálogo é recusado de propósito: aceitar
 * produziria um gesto que percorre a tela inteira e não muda nada, e o usuário
 * ficaria procurando o que ele fez de errado.
 *
 * ⛔ E o ESTRUTURAL também é recusado. A guarda de verdade está no hook
 * (`removerBloco`), e esta aqui é o que faz o painel ficar APAGADO enquanto se
 * arrasta um `Alertas` — a regra aparece no gesto em vez de virar uma soltura
 * que não fez nada.
 *
 * ⚠️ **Antes eram os HEROS que ele recusava**, porque remover um deixaria
 * Principais com 3. Aquela regra morreu com a zona: hoje uma métrica pode sair
 * da grade como qualquer outro bloco, e volta pelo catálogo.
 */
export function catalogoAceita(carga: Carga | null): boolean {
  if (!carga || carga.origem === "catalogo") return false;
  return !metaDoBloco(carga.id)?.estrutural;
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
      /* A grade aceita qualquer bloco: é o único destino, e o catálogo lateral é
         quem tem regra. */
      const aceita = alvoDoDestino.tipo === "catalogo" ? catalogoAceita(carga) : carga !== null;
      if (!aceita) return null;
      return {
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
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
      (a.tipo === "catalogo" || (alvo.tipo === "grade" && alvo.indice === a.indice)),
    [alvo],
  );

  return { carga, alvo, comecar, terminar, destino, ehAlvo, arrastando: carga !== null };
}

export type EstadoArrasto = ReturnType<typeof useArrasto>;
