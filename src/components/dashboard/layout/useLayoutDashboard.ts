"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadLayoutZonas,
  migrarAlturaDoLayout,
  resetDashboardLayout,
  saveLayoutZonas,
  type LayoutSalvo,
} from "@/lib/actions/dashboardLayout";
import {
  layoutPadrao,
  migrarAlturas,
  migrarLayout,
  precisaMigrarAltura,
  type LayoutGrade,
} from "./migrar";
import { CATALOGO_META, encaixarAltura, encaixarColunas, metaDoBloco } from "../catalogo";

/**
 * O que vai para o banco.
 *
 * 🔴 **AS DUAS REDES ENTRAM.** Este envelope carrega dois campos que nada lê
 * para desenhar, e os dois estão aqui pelo mesmo motivo:
 *
 * | campo | a conversão que ele desfaz |
 * |---|---|
 * | `linhas` (por bloco) | `linhas` de 44px → `h` de 96px (F1) |
 * | `hero` / `faixa` | as três zonas → a grade única (F5) |
 *
 * As duas conversões são **destrutivas, irreversíveis e automáticas**: rodam
 * sozinhas ao abrir o Dashboard, em produção, sobre um arranjo que o usuário
 * montou. `h` é o `max()` da conta com a medição F0b, e da lista única não se
 * recupera qual métrica era hero — a altura diz isso no instante da conversão e
 * deixa de dizer no primeiro arrasto.
 *
 * ⚠️ A versão anterior deste comentário defendia DESCARTAR o `linhas`, com o
 * argumento de que a marca de versão existe para matar a ambiguidade de unidade.
 * A ambiguidade que o `v` mata é sobre **qual campo desenha**, e ela continua
 * morta: quem desenha é `h` e a ordem de `blocos`, sempre. O que aquela versão
 * fazia era outra coisa — jogar fora a única cópia do que o usuário escolheu.
 *
 * ⚠️ Os três são preservados inclusive depois de o usuário editar à mão: a rede
 * não fica menos útil por ele ter mexido no bloco depois. Uma regra, não duas.
 */
function paraSalvar(l: LayoutGrade): LayoutSalvo {
  return {
    blocos: l.blocos.map((b) => ({ id: b.id, col: b.col, h: b.h, linhas: b.linhasLegado })),
    hero: l.heroLegado,
    faixa: l.faixaLegado,
  };
}

/**
 * Lê o layout salvo e o entrega já MIGRADO para a grade única.
 *
 * ⛔ SUBSTITUIU E DELETOU `useDashboardLayout.ts` (06/08/2026), que falava a
 * língua do grid antigo (`react-grid-layout`, 12 colunas, `x`/`y`/`w`/`h`).
 *
 * ### 🔴 AS OPERAÇÕES DE ZONA SUMIRAM — F5, 12/08/2026
 *
 * Saíram `moverMetrica`, `trocarHero`, `inserirFaixa`, `removerFaixa` e
 * `faixaCheia`. **Elas não foram renomeadas nem generalizadas**: cada uma
 * existia para aplicar um teto (sempre 4, até 8), e os tetos caíram. Uma
 * `trocarHero` sobrevivendo como "trocar bloco" manteria legível uma mecânica —
 * *adicionar quando cheio é TROCAR* — que deixou de fazer sentido no instante em
 * que a zona parou de ter vagas.
 *
 * O que ficou é o conjunto que sempre valeu para painel e agora vale para tudo:
 * **mover, inserir, remover, redimensionar.**
 *
 * ### Por que carrega no cliente e não vem do layout do servidor
 *
 * ⚠️ Se o layout viesse como prop inicial do servidor, o Dashboard renderizaria
 * a grade na passagem do servidor — e aí todo `elapsed()` de dentro dos blocos
 * (o feed, por exemplo) voltaria a produzir mismatch de hidratação, que é o
 * defeito que já derrubou a navegação de Integrações. Carregando no cliente, a
 * primeira passagem desenha o padrão e a troca acontece depois da hidratação.
 *
 * ⛔ Se um dia isso mudar, os `elapsed()` marcados como "SEGURO POR TIMING" no
 * `useTraffikState` passam a precisar de `<Desde>`. Está anotado lá, no ponto
 * exato que quebraria.
 */
export function useLayoutDashboard(workspaceId?: string | null) {
  const [layout, setLayout] = useState<LayoutGrade>(layoutPadrao);
  const [carregando, setCarregando] = useState(true);

  /**
   * 🔴 O SNAPSHOT É O QUE FAZ O CANCELAR DESCARTAR DE VERDADE.
   *
   * Ele é tirado ao ENTRAR em edição, e o Cancelar restaura a partir dele — não
   * recarrega do servidor. Recarregar pareceria funcionar e teria um buraco: se
   * o usuário salvou uma vez, cancelou depois de mudar mais, o "recarregar"
   * traria o SALVO, não o estado de quando ele entrou.
   *
   * ⛔ E nada é gravado até o Salvar. Enquanto `editando` é `true`, tudo vive
   * aqui — o layout do banco não é tocado.
   */
  const [snapshot, setSnapshot] = useState<LayoutGrade | null>(null);
  const [salvando, setSalvando] = useState(false);
  const editando = snapshot !== null;

  /* ⚠️ O `vivo` não é ritual: trocar de área de trabalho dispara uma segunda
     leitura antes de a primeira voltar, e sem ele a resposta ANTIGA chegaria
     depois e sobrescreveria a nova. */
  useEffect(() => {
    let vivo = true;
    /* 🔴 `loadLayoutZonas`, NÃO `loadDashboardLayouts`. A segunda passa o valor
       por `sanitizeLayout`, que recusa tudo que não é array — e o envelope é um
       objeto. O layout salvo voltava `null` e caía no padrão: **salvar parecia
       funcionar e o arranjo sumia no recarregamento seguinte.**

       ⚠️ `desktop` só. O layout `mobile` do grid antigo existia porque o grid
       tinha breakpoints; hoje quem responde por tela estreita é a DERIVAÇÃO
       (`layout/derivar.ts`), que é uma transformação do layout de 12 e não um
       segundo salvo. Migrar os dois produziria duas verdades para a mesma
       pergunta — e a de `mobile` nunca seria editável. */
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
    /* Cópia PROFUNDA: `blocos` é array de objetos, e um spread raso deixaria o
       snapshot compartilhando as mesmas referências — mudar a largura de um
       bloco alteraria os dois, e o Cancelar restauraria o estado já sujo. */
    setSnapshot(JSON.parse(JSON.stringify(layout)) as LayoutGrade);
  }, [layout]);

  const cancelar = useCallback(() => {
    if (snapshot) setLayout(snapshot);
    setSnapshot(null);
  }, [snapshot]);

  const salvar = useCallback(async () => {
    setSalvando(true);
    try {
      await saveLayoutZonas(paraSalvar(layout), workspaceId);
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

  /* ── A MIGRAÇÃO DE ALTURA — as três camadas, na ordem ─────────────────────
     🔴 ELA GRAVA AO ABRIR O DASHBOARD, UMA VEZ, SEM CLIQUE. É migração: o
     contrato do envelope mudou, e deixá-la para o próximo Salvar faria o layout
     do usuário depender de ele voltar ao modo de edição.

     ⚠️ Decisão do dono, 12/08/2026: o contrato muda e está declarado.

     ⚠️ **A conversão de ZONAS (F5) não tem gatilho próprio**, e é deliberado:
     ela é determinística e sem perda (as zonas de origem viajam como legado),
     então re-derivá-la a cada abertura dá sempre o mesmo resultado. Quem grava o
     v5 é esta migração de altura, quando ela roda, ou o primeiro Salvar. Um
     gatilho a mais seria uma escrita automática a mais num campo que o usuário
     configura — a família que apagou o `linhas`. */
  /* Uma tentativa por montagem. ⛔ `ref` e não estado: ele não desenha nada, e
     como estado provocaria um render a mais no caminho crítico da tela. */
  const tentouMigrar = useRef(false);

  const migrarAltura = useCallback(
    async (temDado: (id: string) => boolean) => {
      /* Não migrar durante a edição: o `layout` daqui é o estado sujo, e gravá-lo
         sem o Salvar quebraria a promessa do Cancelar. */
      if (tentouMigrar.current || carregando || snapshot !== null) return;
      if (!precisaMigrarAltura(layout)) return;

      /* Camadas 1 e 2, puras. `completo: false` sai em silêncio e SEM marcar a
         tentativa — o bloco pode ganhar dado na próxima troca de período. */
      const r = migrarAlturas(layout, temDado);
      if (!r.completo) return;

      tentouMigrar.current = true;
      const migrado = { ...layout, blocos: r.blocos };
      /* A tela adota o resultado mesmo se a RESERVA perder: a conversão é
         determinística (só depende de `linhasLegado` e do `hMin` do catálogo),
         então quem venceu gravou exatamente isto. */
      setLayout(migrado);
      /* Camada 3, no banco. Perder aqui não é erro — é outra instância ter
         gravado o mesmo. */
      await migrarAlturaDoLayout(paraSalvar(migrado), workspaceId).catch(() => {});
    },
    [carregando, layout, snapshot, workspaceId],
  );

  /* ── As operações da grade ─────────────────────────────────────────────────
     ⛔ Elas moram aqui e não na tela porque carregam as REGRAS que sobraram: o
     mínimo de cada bloco, o teto de altura, e a recusa de remover um estrutural.
     Na tela, uma delas acabaria sem a validação da outra. */

  /** Troca a posição de dois blocos na lista. A ordem é o que a grade empacota. */
  const moverBloco = useCallback((de: number, para: number) => {
    setLayout((l) => {
      const lista = [...l.blocos];
      if (de < 0 || para < 0 || de >= lista.length || para >= lista.length) return l;
      const [x] = lista.splice(de, 1);
      lista.splice(para, 0, x!);
      return { ...l, blocos: lista };
    });
  }, []);

  /**
   * Põe um bloco na grade, NUMA POSIÇÃO.
   *
   * ⚠️ `indice` existe porque o arrasto solta em algum lugar, não no fim. Um
   * `inserir` que sempre empilha embaixo obrigaria o usuário a soltar e depois
   * reordenar — dois gestos para o que ele acabou de expressar com um.
   */
  const inserirBloco = useCallback((id: string, indice?: number) => {
    setLayout((l) => {
      const meta = CATALOGO_META.find((b) => b.id === id);
      if (!meta || l.blocos.some((p) => p.id === id)) return l;
      /* ⚠️ Bloco arrastado agora nasce com o padrão do catálogo — ele nunca teve
         altura salva, então não há migração pendente para esperar. Para uma
         métrica de destaque isso é `3×2`; para as outras, `3×1`. */
      const novo = { id, col: meta.colPadrao, h: meta.hPadrao };
      const lista = [...l.blocos];
      lista.splice(indice ?? lista.length, 0, novo);
      return { ...l, blocos: lista };
    });
  }, []);

  /**
   * Tira um bloco da grade. **Estrutural não sai** — e a guarda mora aqui.
   *
   * 🔴 A AUSÊNCIA DO ✕ NÃO É A REGRA, É A APRESENTAÇÃO DELA. O outro caminho de
   * remoção é arrastar o bloco de volta para o catálogo, e ele não passa por
   * botão nenhum: sem esta linha, o `Alertas` sairia da grade por arrasto
   * enquanto a tela afirma que ele não pode sair. É o "endurecer uma porta com a
   * outra aberta" do CLAUDE.md, na camada de layout.
   *
   * ⚠️ Recusa em silêncio de propósito: quem chega aqui já não tem ✕ e já viu o
   * cursor de proibido no gesto.
   *
   * ⚠️ **Métrica não é estrutural**, e agora ela pode ser removida — antes, o
   * hero recusava remoção porque a zona não podia ficar com 3. Com a grade única
   * não há fileira para quebrar: tirar `Faturamento` do painel é uma escolha
   * legítima, e ela volta pelo catálogo lateral.
   */
  const removerBloco = useCallback((id: string) => {
    if (metaDoBloco(id)?.estrutural) return;
    setLayout((l) => ({ ...l, blocos: l.blocos.filter((p) => p.id !== id) }));
  }, []);

  /**
   * Redimensiona um bloco. Recebe as medidas CRUAS do arrasto e encaixa.
   *
   * ⛔ O ENCAIXE E O PISO FICAM AQUI, não na alça. A alça sabe quantos pixels o
   * ponteiro andou; ela não sabe o mínimo de nenhum bloco, e não deve saber —
   * duas validações da mesma regra divergem, e a de lá não teria como avisar.
   *
   * ⚠️ Isto roda a cada quadro do arrasto, de propósito: o bloco encaixa DEBAIXO
   * do ponteiro. Encaixar só ao soltar faria o usuário arrastar às cegas.
   */
  const redimensionar = useCallback((id: string, colBruta: number, alturaBruta: number | undefined) => {
    setLayout((l) => {
      const meta = metaDoBloco(id);
      if (!meta) return l;
      const col = encaixarColunas(colBruta, meta);
      const h = encaixarAltura(alturaBruta, meta);
      const atual = l.blocos.find((p) => p.id === id);
      if (!atual || (atual.col === col && atual.h === h)) return l; // nada mudou
      /* ⚠️ O `linhasLegado` SOBREVIVE ao redimensionamento — o `...p` o carrega.
         Descartá-lo aqui era perder a rede da conversão irreversível no primeiro
         arrasto. */
      return { ...l, blocos: l.blocos.map((p) => (p.id === id ? { ...p, col, h } : p)) };
    });
  }, []);

  return {
    layout,
    carregando,
    editando,
    salvando,
    abrirEdicao,
    migrarAltura,
    cancelar,
    salvar,
    redefinir,
    moverBloco,
    inserirBloco,
    removerBloco,
    redimensionar,
  };
}

export type EstadoLayout = ReturnType<typeof useLayoutDashboard>;
