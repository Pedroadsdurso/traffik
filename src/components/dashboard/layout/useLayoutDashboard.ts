"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLayoutZonas, resetDashboardLayout, saveLayoutZonas } from "@/lib/actions/dashboardLayout";
import { MAX_FAIXA, layoutPadrao, migrarLayout, type LayoutZonas } from "./migrar";
import { CATALOGO_META, encaixarColunas, encaixarLinhas, metaDoBloco } from "../catalogo";

/**
 * Lê o layout salvo e o entrega já MIGRADO para as três zonas.
 *
 * ⛔ SUBSTITUIU E DELETOU `useDashboardLayout.ts` (06/08/2026), que falava a
 * língua do grid antigo (`react-grid-layout`, 12 colunas, `x`/`y`/`w`/`h`).
 * Ele sobreviveu à reescrita do Dashboard porque tinha a lógica de SALVAR que
 * faltava aqui; com o modo de edição pronto, essa lógica virou o `salvar`/
 * `redefinir` abaixo e não havia mais nada dele para absorver.
 *
 * ⚠️ Foram com ele `components/dashboard/blocks.ts`, `loadDashboardLayouts` e
 * `saveDashboardLayout`. **A compatibilidade com o layout antigo NÃO se perdeu
 * nisso** — quem lê o grid salvo é `migrarLayout`, sobre o Json cru.
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
export function useLayoutDashboard(workspaceId?: string | null) {
  const [layout, setLayout] = useState<LayoutZonas>(layoutPadrao);
  const [carregando, setCarregando] = useState(true);

  /**
   * 🔴 O SNAPSHOT É O QUE FAZ O CANCELAR DESCARTAR DE VERDADE.
   *
   * Ele é tirado ao ENTRAR em edição, e o Cancelar restaura a partir dele — não
   * recarrega do servidor. Recarregar pareceria funcionar e teria um buraco: se
   * o usuário salvou uma vez, cancelou depois de mudar mais, o "recarregar"
   * traria o SALVO, não o estado de quando ele entrou. Cancelar tem de desfazer
   * a sessão de edição inteira.
   *
   * ⛔ E nada é gravado até o Salvar. Enquanto `editando` é `true`, tudo vive
   * aqui — o layout do banco não é tocado. Estado de edição que vaza para o
   * salvo é pior que não ter Cancelar: a pessoa confia no botão.
   */
  const [snapshot, setSnapshot] = useState<LayoutZonas | null>(null);
  const [salvando, setSalvando] = useState(false);
  const editando = snapshot !== null;

  /* ⚠️ O `vivo` não é ritual: trocar de área de trabalho dispara uma segunda
     leitura antes de a primeira voltar, e sem ele a resposta ANTIGA chegaria
     depois e sobrescreveria a nova. O layout da área errada ficaria na tela até
     o próximo recarregamento — e o usuário não teria como saber por quê. */
  useEffect(() => {
    let vivo = true;
    /* 🔴 `loadLayoutZonas`, NÃO `loadDashboardLayouts`. A segunda passa o valor
       por `sanitizeLayout`, que recusa tudo que não é array — e o envelope v2 é
       um objeto. O layout salvo voltava `null` e caía no padrão: **salvar
       parecia funcionar e o arranjo sumia no recarregamento seguinte.** O caso
       está escrito por extenso na action.

       ⚠️ `desktop` só. O layout `mobile` do grid antigo existia porque o grid
       tinha breakpoints; as três zonas são responsivas por CSS. Migrar os dois
       produziria duas verdades para a mesma pergunta — e a de `mobile` nunca
       seria editável. */
    loadLayoutZonas(workspaceId)
      .then((cru) => {
        if (vivo) setLayout(migrarLayout(cru));
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

  /* ── Entrar e sair ─────────────────────────────────────────────────────── */
  const abrirEdicao = useCallback(() => {
    /* Cópia PROFUNDA: `paineis` é array de objetos, e um spread raso deixaria o
       snapshot compartilhando as mesmas referências — mudar a largura de um
       painel alteraria os dois, e o Cancelar restauraria o estado já sujo. */
    setSnapshot(JSON.parse(JSON.stringify(layout)) as LayoutZonas);
  }, [layout]);

  const cancelar = useCallback(() => {
    if (snapshot) setLayout(snapshot);
    setSnapshot(null);
  }, [snapshot]);

  const salvar = useCallback(async () => {
    setSalvando(true);
    try {
      await saveLayoutZonas(layout, workspaceId);
      setSnapshot(null);
    } finally {
      setSalvando(false);
    }
  }, [layout, workspaceId]);

  const redefinir = useCallback(async () => {
    setSalvando(true);
    try {
      await resetDashboardLayout("desktop", workspaceId);
      setLayout(layoutPadrao());
      setSnapshot(null);
    } finally {
      setSalvando(false);
    }
  }, [workspaceId]);

  /* ── As operações das três zonas ───────────────────────────────────────────
     ⛔ Cada uma aplica a REGRA DA ZONA, e é por isso que elas moram aqui e não
     na tela: a tela desenha três listas parecidas, e se as regras estivessem lá
     a terceira acabaria sem a validação da primeira. */

  /** Troca a posição de duas métricas DENTRO da mesma zona. Nunca entre zonas. */
  const moverMetrica = useCallback((zona: "hero" | "faixa", de: number, para: number) => {
    setLayout((l) => {
      const lista = [...l[zona]];
      if (de < 0 || para < 0 || de >= lista.length || para >= lista.length) return l;
      const [x] = lista.splice(de, 1);
      lista.splice(para, 0, x!);
      return { ...l, [zona]: lista };
    });
  }, []);

  const moverPainel = useCallback((de: number, para: number) => {
    setLayout((l) => {
      const lista = [...l.paineis];
      if (de < 0 || para < 0 || de >= lista.length || para >= lista.length) return l;
      const [x] = lista.splice(de, 1);
      lista.splice(para, 0, x!);
      return { ...l, paineis: lista };
    });
  }, []);

  /**
   * Põe uma métrica no HERO. `substituir` é o índice de quem sai.
   *
   * ⛔ O HERO TEM EXATAMENTE 4, SEMPRE. Não há "adicionar" quando está cheio —
   * há TROCAR. É por isso que a tela pergunta qual substituir em vez de recusar
   * calado: recusar não diz o que fazer, e deixar em 3 quebra a fileira.
   */
  const trocarHero = useCallback((metrica: string, substituir: number) => {
    setLayout((l) => {
      if (substituir < 0 || substituir >= l.hero.length) return l;
      const hero = [...l.hero];
      const antigo = hero[substituir]!;
      hero[substituir] = metrica;
      /* Quem saiu do hero vai para a FAIXA, se couber. Sumir com a métrica que
         o usuário tinha escolhido seria perder a escolha dele sem avisar. */
      const faixa = l.faixa.filter((m) => m !== metrica);
      if (!faixa.includes(antigo) && faixa.length < MAX_FAIXA) faixa.push(antigo);
      return { ...l, hero, faixa };
    });
  }, []);

  /** `true` quando a faixa está no teto — a tela usa para bloquear COM AVISO. */
  const faixaCheia = layout.faixa.length >= MAX_FAIXA;

  const inserirFaixa = useCallback((metrica: string, indice?: number) => {
    setLayout((l) => {
      if (l.faixa.length >= MAX_FAIXA) return l; // guarda; a tela avisa antes
      if (l.faixa.includes(metrica) || l.hero.includes(metrica)) return l;
      const lista = [...l.faixa];
      lista.splice(indice ?? lista.length, 0, metrica);
      return { ...l, faixa: lista };
    });
  }, []);

  const removerFaixa = useCallback((metrica: string) => {
    setLayout((l) => ({ ...l, faixa: l.faixa.filter((m) => m !== metrica) }));
  }, []);

  /**
   * Põe um painel na zona, NUMA POSIÇÃO.
   *
   * ⚠️ `indice` existe porque o arrasto solta em algum lugar, não no fim. Um
   * `addPainel` que sempre empilha embaixo obrigaria o usuário a soltar e depois
   * reordenar — dois gestos para o que ele acabou de expressar com um.
   */
  const inserirPainel = useCallback((id: string, indice?: number) => {
    setLayout((l) => {
      const meta = CATALOGO_META.find((b) => b.id === id);
      if (!meta || l.paineis.some((p) => p.id === id)) return l;
      const novo = { id, col: meta.colPadrao, linhas: meta.linhasPadrao };
      const lista = [...l.paineis];
      lista.splice(indice ?? lista.length, 0, novo);
      return { ...l, paineis: lista };
    });
  }, []);

  const removerPainel = useCallback((id: string) => {
    setLayout((l) => ({ ...l, paineis: l.paineis.filter((p) => p.id !== id) }));
  }, []);

  /**
   * Redimensiona um painel. Recebe as medidas CRUAS do arrasto e encaixa.
   *
   * ⛔ O ENCAIXE E O PISO FICAM AQUI, não na alça. A alça sabe quantos pixels o
   * ponteiro andou; ela não sabe o mínimo de nenhum bloco, e não deve saber —
   * duas validações da mesma regra divergem, e a de lá não teria como avisar.
   *
   * ⚠️ Isto roda a cada quadro do arrasto, de propósito: o bloco encaixa DEBAIXO
   * do ponteiro. Encaixar só ao soltar faria o usuário arrastar às cegas e
   * descobrir o resultado depois — o mesmo defeito da rejeição pós-soltura.
   */
  const redimensionar = useCallback((id: string, colBruta: number, linhasBrutas: number) => {
    setLayout((l) => {
      const meta = metaDoBloco(id);
      if (!meta) return l;
      const col = encaixarColunas(colBruta, meta);
      const linhas = encaixarLinhas(linhasBrutas, meta);
      const atual = l.paineis.find((p) => p.id === id);
      if (!atual || (atual.col === col && atual.linhas === linhas)) return l; // nada mudou
      return { ...l, paineis: l.paineis.map((p) => (p.id === id ? { ...p, col, linhas } : p)) };
    });
  }, []);

  return {
    layout,
    carregando,
    editando,
    salvando,
    faixaCheia,
    abrirEdicao,
    cancelar,
    salvar,
    redefinir,
    moverMetrica,
    moverPainel,
    trocarHero,
    inserirFaixa,
    removerFaixa,
    inserirPainel,
    removerPainel,
    redimensionar,
  };
}

export type EstadoLayout = ReturnType<typeof useLayoutDashboard>;
