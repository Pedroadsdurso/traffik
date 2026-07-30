"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Mede o tamanho real de um elemento, em pixels de CSS.
 *
 * ## Por que existe
 *
 * Os gráficos do Dashboard vivem em blocos **redimensionáveis** — o usuário
 * arrasta o canto e o mesmo gráfico vai de 300px a 2000px de largura. Sem saber
 * a largura de verdade, um gráfico só tem duas saídas, e as duas são ruins:
 *
 * 1. **Esticar um `viewBox` com `preserveAspectRatio="none"`.** A geometria
 *    acompanha, mas o **texto distorce**: era por isso que "R$ 100" e "01/07"
 *    apareciam achatados no bloco pequeno e absurdamente largos no bloco grande.
 * 2. **Rotular tudo sempre.** Em 30 dias os rótulos se atropelam.
 *
 * Com a largura em estado, o gráfico decide **quantos** rótulos cabem e desenha
 * o texto em escala 1:1. É o mesmo dado que resolve os dois problemas.
 *
 * ## ⛔ `ref` é CALLBACK, e o nó vive em ESTADO. Não troque por `useRef`.
 *
 * A primeira versão usava `useRef` + `useEffect(…, [])`. Parecia certo e estava
 * **silenciosamente quebrado**: o efeito roda uma vez, na montagem, e nesse
 * instante o elemento pode **não existir** — todo gráfico deste projeto faz
 * `return <ChartEmpty/>` antes do markup quando ainda não há dado, e o Dashboard
 * abre justamente sem dado. O `ref.current` era `null`, o observer nunca era
 * anexado, e como as dependências eram `[]` **nunca havia segunda tentativa**.
 * Resultado: quando o dado chegava e as barras finalmente montavam, a largura
 * continuava 0 para sempre — e o raleamento dos rótulos nunca acontecia.
 *
 * Com o nó em estado, montar o elemento **é** uma mudança de dependência, então
 * o observer se anexa na hora em que o elemento passa a existir.
 *
 * ## Detalhes que importam
 *
 * - **`ResizeObserver`, não `window.resize`.** O bloco muda de tamanho por
 *   arraste do usuário e por refluxo do grid, sem a janela mudar de tamanho.
 * - **Guarda só quando muda de verdade.** O observer dispara com valores
 *   fracionários idênticos, e um `setState` por notificação viraria laço de
 *   render. Arredondar e comparar antes de gravar é o que evita isso.
 * - **Devolve `0` antes da primeira medida.** Quem consome trata `0` como "ainda
 *   não sei" e cai num padrão — nunca divide por ele.
 * - **`no` é o próprio elemento**, para quem precisa do DOM (por exemplo
 *   `getBoundingClientRect()` num evento). Use `no`, não um `ref.current`.
 */
export function useTamanho<T extends HTMLElement = HTMLDivElement>() {
  const [no, setNo] = useState<T | null>(null);
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });

  // `useCallback` para a identidade do ref não mudar a cada render — sem isso o
  // React o chamaria com `null` e com o nó em toda passada.
  const ref = useCallback((el: T | null) => setNo(el), []);

  useEffect(() => {
    if (!no) return;

    const medir = (largura: number, altura: number) => {
      setTamanho((atual) =>
        atual.largura === largura && atual.altura === altura ? atual : { largura, altura },
      );
    };

    // Primeira medida imediata: o observer só entrega no próximo frame, e sem
    // isto o gráfico renderiza uma vez inteira com largura 0.
    const r = no.getBoundingClientRect();
    medir(Math.round(r.width), Math.round(r.height));

    const obs = new ResizeObserver((entradas) => {
      const e = entradas[0];
      if (!e) return;
      medir(Math.round(e.contentRect.width), Math.round(e.contentRect.height));
    });
    obs.observe(no);
    return () => obs.disconnect();
  }, [no]);

  return { ref, no, ...tamanho };
}
