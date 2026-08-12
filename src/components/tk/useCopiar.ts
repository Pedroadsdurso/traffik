"use client";

import * as React from "react";

/**
 * Copiar para a área de transferência, com a confirmação que some sozinha.
 *
 * ⚠️ **É um MOVE**: nasceu dentro da `UtmSnippetsScreen` e virou `tk/` quando a
 * tela de Webhooks passou a precisar do mesmo comportamento. Duas cópias não
 * produziriam número errado — produziriam duas telas que confirmam a cópia de
 * jeitos diferentes, que é o tipo de divergência que ninguém nota e ninguém
 * conserta.
 *
 * O `id` existe porque uma tela tem VÁRIOS campos copiáveis e só o que foi
 * clicado pode dizer "copiado". Um booleano só faria os quatro piscarem juntos.
 *
 * ⚠️ `navigator.clipboard?` com o opcional não é ritual: em contexto não seguro
 * (HTTP puro) a API não existe, e um `TypeError` aqui derrubaria o handler
 * inteiro do clique.
 */
export function useCopiar(): [(texto: string, id: string) => void, string | null] {
  const [copiado, setCopiado] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copiar = React.useCallback((texto: string, id: string) => {
    if (!texto) return;
    void navigator.clipboard?.writeText(texto);
    setCopiado(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 1600);
  }, []);

  return [copiar, copiado];
}
