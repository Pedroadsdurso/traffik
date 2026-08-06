"use client";

import * as React from "react";
import { elapsed } from "@/lib/format";

/**
 * "há 4 minutos" — o carimbo de tempo relativo, com a proteção de hidratação.
 *
 * 🔴 POR QUE ISTO É UM COMPONENTE, E NÃO UMA CHAMADA A `elapsed()`
 *
 * `elapsed()` lê `Date.now()`. Num componente que renderiza no SERVIDOR, o HTML
 * sai com "há 4 minutos", o cliente hidrata alguns instantes depois e calcula
 * "há 5 minutos" — os dois textos divergem, **o React aborta a hidratação da
 * árvore inteira**, e o efeito visível não é o texto errado: é a página não
 * funcionar.
 *
 * Medido em 06/08/2026, na Visão geral de Integrações: a rota abria por URL
 * direta e **voltava para `/dashboard` ao ser aberta pelo menu**. `tsc`, `lint`
 * e `build` passaram os três. Só o log do servidor de desenvolvimento acusou, e
 * só depois de abrir a página.
 *
 * ⛔ **REGRA: nenhum `elapsed()`, "há N minutos" ou `Date.now()` renderizado
 * direto em componente que passa pelo servidor.** Use este componente.
 *
 * ⚠️ Por que `suppressHydrationWarning` e não um `useEffect` de "montado": o
 * efeito trocaria o texto por um placeholder no primeiro quadro, e uma coluna
 * inteira piscando em toda carga é pior que um texto que se corrige sozinho.
 * Esta é a saída que o React documenta para exatamente este caso.
 *
 * ⛔ E ela vale **só para texto de tempo**. Não espalhe para conteúdo que possa
 * divergir por outro motivo — ali a divergência é bug, e o silenciador esconde
 * o bug em vez de resolvê-lo.
 */
export function Desde({
  quando,
  vazio = "nunca",
}: {
  quando: Date | string | number | null | undefined;
  /**
   * O que dizer quando não há data.
   *
   * ⚠️ O padrão é "nunca", e ele é uma AFIRMAÇÃO: um webhook que nunca recebeu
   * evento não é o mesmo que um que acabou de receber. "há 0 minutos" seria o
   * oposto da verdade.
   */
  vazio?: string;
}) {
  if (quando == null) return <>{vazio}</>;
  const ts = typeof quando === "number" ? quando : new Date(quando).getTime();
  if (Number.isNaN(ts)) return <>{vazio}</>;
  return <span suppressHydrationWarning>{elapsed(ts)}</span>;
}
