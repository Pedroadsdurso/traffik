"use client";

import { useEffect, useState } from "react";
import { loadDashboardLayouts } from "@/lib/actions/dashboardLayout";
import { layoutPadrao, migrarLayout, type LayoutZonas } from "./migrar";

/**
 * Lê o layout salvo e o entrega já MIGRADO para as três zonas.
 *
 * 🔴 SUBSTITUI `useDashboardLayout.ts`, que ficou órfão na reescrita do
 * Dashboard e falava a língua do grid antigo (`react-grid-layout`, 12 colunas,
 * `x`/`y`/`w`/`h`). Aquele hook não some agora: ele ainda tem a lógica de
 * SALVAR, que a entrega C vai reaproveitar. O que este faz é a metade que o
 * produto precisa hoje — **respeitar** o layout de quem já tinha um.
 *
 * ⛔ ESTE HOOK NÃO EDITA NADA, e é intencional. O estado do produto depois desta
 * entrega é: **o layout salvo é respeitado, mas não é editável.** Ninguém fica
 * pior que antes — quem customizou vê o dele, quem não customizou vê o padrão —
 * e o modo de edição é a entrega seguinte.
 *
 * ### Por que carrega no cliente e não vem do layout do servidor
 *
 * ⚠️ Se o layout viesse como prop inicial do servidor, o Dashboard renderizaria
 * as zonas na passagem do servidor — e aí todo `elapsed()` de dentro dos blocos
 * (o feed, por exemplo) voltaria a produzir mismatch de hidratação, que é o
 * defeito que já derrubou a navegação de Integrações. Carregando no cliente, a
 * primeira passagem desenha o padrão e a troca acontece depois da hidratação.
 *
 * ⛔ Se um dia isso mudar, os `elapsed()` marcados como "SEGURO POR TIMING" no
 * `useTraffikState` passam a precisar de `<Desde>`. Está anotado lá, no ponto
 * exato que quebraria.
 */
export function useLayoutDashboard(workspaceId?: string | null): {
  layout: LayoutZonas;
  /** `true` até a primeira leitura terminar. A tela desenha o padrão enquanto isso. */
  carregando: boolean;
} {
  const [layout, setLayout] = useState<LayoutZonas>(layoutPadrao);
  const [carregando, setCarregando] = useState(true);

  /* ⚠️ O `vivo` não é ritual: trocar de área de trabalho dispara uma segunda
     leitura antes de a primeira voltar, e sem ele a resposta ANTIGA chegaria
     depois e sobrescreveria a nova. O layout da área errada ficaria na tela até
     o próximo recarregamento — e o usuário não teria como saber por quê. */
  useEffect(() => {
    let vivo = true;
    loadDashboardLayouts(workspaceId)
      .then((dto) => {
        /* ⚠️ `desktop` só. O layout `mobile` do grid antigo existia porque o
           grid tinha breakpoints; as três zonas são responsivas por CSS. Migrar
           os dois produziria duas verdades para a mesma pergunta — e a de
           `mobile` nunca seria editável. */
        if (vivo) setLayout(migrarLayout(dto.desktop));
      })
      .catch(() => {
        /* Falha na leitura NÃO pode deixar o Dashboard sem layout. O padrão é
           sempre uma resposta válida — a mesma decisão do `try` da migração. */
        if (vivo) setLayout(layoutPadrao());
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [workspaceId]);

  return { layout, carregando };
}
