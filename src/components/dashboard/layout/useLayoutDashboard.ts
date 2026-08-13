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
  MAX_FAIXA,
  layoutPadrao,
  migrarAlturas,
  migrarLayout,
  precisaMigrarAltura,
  type LayoutZonas,
} from "./migrar";
import { CATALOGO_META, encaixarAltura, encaixarColunas, metaDoBloco } from "../catalogo";

/**
 * O que vai para o banco.
 *
 * 🔴 **`linhasLegado` ENTRA, como `linhas`.** Este comentário dizia o contrário
 * — que regravá-lo faria o v4 carregar duas unidades de altura ao mesmo tempo, e
 * que a versão do envelope existe para matar essa ambiguidade.
 *
 * A ambiguidade que o `v` mata é sobre **qual campo desenha**, e ela continua
 * morta: quem desenha é `h`, sempre; `linhas` não é lido por nada de layout. O
 * que a versão anterior fazia era outra coisa — jogar fora a única cópia do que
 * o usuário tinha escolhido, numa conversão que **não tem volta** (`h` é o
 * `max()` da conta com a medição F0b) e que roda **sozinha, em produção**.
 *
 * ⚠️ Ele é preservado inclusive quando o usuário redimensiona à mão: a rede não
 * fica menos útil por ele ter mexido no bloco depois. Uma regra, não duas.
 */
function paraSalvar(l: LayoutZonas): LayoutSalvo {
  return {
    hero: l.hero,
    faixa: l.faixa,
    paineis: l.paineis.map((p) => ({ id: p.id, col: p.col, h: p.h, linhas: p.linhasLegado })),
  };
}

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
     contrato do envelope mudou (`linhas` de 44px → `h` em células de 96), e o
     campo antigo não é regravado. Deixá-la para o próximo Salvar faria o layout
     do usuário depender de ele voltar ao modo de edição — e até lá cada abertura
     reinterpretaria o salvo, que é como arranjo gravado vira arranjo diferente.

     ⚠️ Decisão do dono, 12/08/2026: o contrato muda e está declarado. */
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
         tentativa — o bloco pode ganhar dado na próxima troca de período, e aí a
         migração acontece. É o que faz "bloco que nunca tem dado" ficar em
         `auto` por tempo indeterminado em vez de travar a migração dos outros
         num estado meio-gravado. */
      const r = migrarAlturas(layout, temDado);
      if (!r.completo) return;

      tentouMigrar.current = true;
      const migrado = { ...layout, paineis: r.paineis };
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
      /* ⚠️ Bloco arrastado agora nasce com `hPadrao` — ele nunca teve altura
         salva, então não há migração pendente para esperar. */
      const novo = { id, col: meta.colPadrao, h: meta.hPadrao };
      const lista = [...l.paineis];
      lista.splice(indice ?? lista.length, 0, novo);
      return { ...l, paineis: lista };
    });
  }, []);

  /**
   * Tira um painel da zona. **Estrutural não sai** — e a guarda mora aqui.
   *
   * 🔴 A AUSÊNCIA DO ✕ NÃO É A REGRA, É A APRESENTAÇÃO DELA. O outro caminho de
   * remoção é arrastar o bloco de volta para o catálogo, e ele não passa por
   * botão nenhum: sem esta linha, o `Alertas` sairia do painel por arrasto
   * enquanto a tela afirma que ele não pode sair. É o "endurecer uma porta com a
   * outra aberta" do CLAUDE.md, na camada de layout.
   *
   * ⚠️ Recusa em silêncio de propósito: quem chega aqui já não tem ✕ e já viu o
   * cursor de proibido no gesto. Um aviso depois da recusa explicaria uma coisa
   * que a interface diz antes.
   */
  const removerPainel = useCallback((id: string) => {
    if (metaDoBloco(id)?.estrutural) return;
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
  const redimensionar = useCallback((id: string, colBruta: number, alturaBruta: number | undefined) => {
    setLayout((l) => {
      const meta = metaDoBloco(id);
      if (!meta) return l;
      const col = encaixarColunas(colBruta, meta);
      /* 🔴 A ALÇA REDIMENSIONA NOS DOIS EIXOS AGORA, e para TODO bloco. Antes,
         `encaixarLinhas` devolvia `undefined` para quem não fosse
         `alturaAjustavel`, e a alça vertical daqueles blocos era um controle
         inerte — arrastava e nada acontecia. */
      const h = encaixarAltura(alturaBruta, meta);
      const atual = l.paineis.find((p) => p.id === id);
      if (!atual || (atual.col === col && atual.h === h)) return l; // nada mudou
      /* ⚠️ O `linhasLegado` SOBREVIVE ao redimensionamento — o `...p` o carrega.
         Aqui dizia que ele "tem de ser descartado", e o argumento (duas alturas
         em unidades diferentes) confundia CARREGAR com DESENHAR: quem desenha é
         `h`, e só. Descartar era perder a rede da conversão irreversível no
         primeiro arrasto. */
      return { ...l, paineis: l.paineis.map((p) => (p.id === id ? { ...p, col, h } : p)) };
    });
  }, []);

  return {
    layout,
    carregando,
    editando,
    salvando,
    faixaCheia,
    abrirEdicao,
    migrarAltura,
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
