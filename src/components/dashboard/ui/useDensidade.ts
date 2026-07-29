"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Densidade do conteúdo conforme o tamanho REAL do bloco.
 *
 * O grid é redimensionável, então nenhum breakpoint de janela descreve o espaço
 * que um bloco tem: dois blocos lado a lado na mesma tela podem ter larguras
 * muito diferentes. Quem responde isso é o `ResizeObserver` no próprio bloco.
 *
 * Existe para o conteúdo **reduzir densidade em vez de ser cortado** — fonte
 * menor, elementos secundários escondidos, gráfico simplificado. Cortar é o
 * comportamento que aparece quando ninguém decide o que sacrificar.
 */
export type Densidade = "xs" | "sm" | "md";

export function useDensidade<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [d, setD] = useState<Densidade>("md");
  const [caixa, setCaixa] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entrada]) => {
      const r = entrada?.contentRect;
      if (!r) return;
      setCaixa({ w: r.width, h: r.height });
      // Largura E altura entram: um bloco largo e baixo (2 linhas do grid)
      // sufoca tanto quanto um estreito, e só a largura não perceberia.
      const apertado = r.width < 170 || r.height < 92;
      const medio = r.width < 260 || r.height < 130;
      setD(apertado ? "xs" : medio ? "sm" : "md");
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, densidade: d, largura: caixa.w, altura: caixa.h };
}
