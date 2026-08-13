"use client";

import * as React from "react";
import { Sparkline } from "./Sparkline";

/**
 * 🔴 C7 — O NÚMERO ENCOLHE ATÉ CABER, E NUNCA É CORTADO.
 *
 * O corpo do número vem de `--tk-b-kpi`, um DEGRAU por largura de contêiner. O
 * degrau não pode saber o comprimento do texto: `R$ 47` e `R$ 7.058,65` recebem
 * o mesmo tamanho, e o segundo estoura. Medido em 13/08/2026, no modo de
 * edição: card de 182px, número a 30px pedindo **166px de 132**.
 *
 * ⛔ **`ellipsis` não é opção.** Um `R$ 7.05…` não é um número menor; é um
 * número errado, e a ordem de sacrifício do KPI (número → rótulo → variação →
 * sparkline → base) põe o número em primeiro exatamente por isso.
 *
 * ### O piso NÃO é inventado
 *
 * É `--tk-b-metrica-sm / --tk-b-metrica` — a razão entre os dois degraus que o
 * sistema JÁ tem: 17/30 na densidade padrão. O degrau pequeno é o corpo da
 * leitura compacta, que este projeto já usa e já validou em contraste e
 * legibilidade. Abaixo dele não há tamanho aprovado, então abaixo dele não
 * descemos: o número passa a caber por outro caminho (o usuário alarga o bloco).
 *
 * ⚠️ **Uma medição, sem laço.** A razão `clientWidth / scrollWidth` diz de
 * quanto precisa em UMA leitura — reduzir de degrau em degrau remediria a cada
 * passo e faria N reflows por render.
 */
const PISO_ESCALA_NUMERO = 17 / 30;

function useCouberNumero(valor: string) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [escala, setEscala] = React.useState(1);

  React.useLayoutEffect(() => {
    const no = ref.current;
    if (!no) return;
    const medir = () => {
      /* ⚠️ MEDE SEMPRE A PARTIR DO CORPO CHEIO. Sem restaurar, a segunda leitura
         mediria o texto JÁ reduzido, a razão sairia perto de 1 e a escala
         encolheria em cascata a cada resize — o número derretendo sozinho ao
         arrastar a alça. O `fontSize` inline é o que manda aqui, então é ele que
         precisa voltar ao valor cheio durante a leitura. */
      const anterior = no.style.fontSize;
      no.style.fontSize = "var(--tk-b-kpi, var(--tk-b-metrica, 30px))";
      const cabe = no.clientWidth;
      const pede = no.scrollWidth;
      no.style.fontSize = anterior;
      if (pede <= 0 || cabe <= 0) return;
      setEscala(pede <= cabe ? 1 : Math.max(PISO_ESCALA_NUMERO, cabe / pede));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(no);
    return () => ro.disconnect();
  }, [valor]);

  return { ref, escala };
}

/**
 * BlocoMetrica — UM número da tela, nos dois pesos que ele sabe ter.
 *
 * ### 🔴 ERAM DOIS COMPONENTES, E A F5 OS FUNDIU (12/08/2026)
 *
 * `KpiHero` (card com sparkline) e `MetricStrip` (faixa sem card) existiam
 * porque o layout tinha ZONAS: quatro heros numa fileira fixa, até oito
 * compactas numa faixa. As zonas caíram, e com elas o motivo de os dois serem
 * componentes diferentes — **um KPI hero e uma métrica compacta são a mesma
 * coisa em slots de alturas diferentes.**
 *
 * ⛔ **A hierarquia não morreu, ela mudou de dono.** O argumento antigo continua
 * inteiro: doze números do mesmo tamanho não respondem pergunta nenhuma, porque
 * nada diz qual olhar primeiro. O que decide o peso agora é a ALTURA DO SLOT —
 * o layout padrão dá 2 células aos quatro principais e 1 ao resto, e o usuário
 * pode mudar. A hierarquia deixou de ser uma regra do componente para virar uma
 * propriedade do arranjo, que é onde ela é visível e editável.
 *
 * ⚠️ **`MetricStrip` foi DELETADO**, não deixado sem consumidor. Ele era
 * apresentação pura — nenhum efeito colateral a desalojar (a pergunta que a
 * regra dos órfãos manda fazer) — e mantê-lo daria duas aparências para o mesmo
 * dado, com a segunda alcançável só por quem lembrasse dela.
 *
 * ### Quem decide qual leitura aparece
 *
 * Uma container query de ALTURA, em `globals.css` (`.tk-kpi`). Abaixo de ~130px
 * somem sparkline, legenda e base, e o número cai para o degrau menor. Não há
 * prop `variante` e não deve haver: uma prop seria uma segunda verdade sobre o
 * mesmo retângulo, e ela divergiria do slot no primeiro arrasto.
 *
 * ⛔ A query só responde dentro de um contêiner com `container-type: size` — a
 * célula da grade do Dashboard. Fora dela (o Gerenciador, que usa `.tk-medida`,
 * de `inline-size`) a query nunca casa e o bloco desenha a leitura completa, que
 * é o que aquela tela quer.
 */

export type DadosKpi = {
  chave: string;
  rotulo: string;
  valor: string;
  /** Variação percentual vs. período anterior. `null` = a métrica não compara. */
  delta: number | null;
  /** Métrica em que CAIR é bom (CPA, reembolso). Inverte a cor, não o sinal. */
  invertido?: boolean;
  /** Texto quando não há delta — "12 vendas aguardando", não "vs. período". */
  trendLabel?: string;
  /**
   * 🔴 QUAL POPULAÇÃO ESTÁ EM CIMA E QUAL ESTÁ EMBAIXO.
   *
   * Uma linha pequena e neutra sob o número, quando ele é uma RAZÃO entre duas
   * medições que não cobrem a mesma coisa. O caso que criou o campo: o ROAS do
   * Dashboard divide receita de **todos os canais** pelo gasto **só da Meta**.
   *
   * ⛔ **NÃO é alerta.** Sem cor, sem ícone, sem juízo — declarar a base não é
   * dizer que o número está errado, é dizer o que ele mede. Tingir isto de
   * atenção transformaria uma nota de rodapé honesta numa acusação, e ela
   * apareceria em toda conta, sempre.
   *
   * É a mesma solução da faixa de cobertura do funil, e pelo mesmo motivo: o
   * usuário não pode ler um número sem saber o que ele cobre.
   */
  base?: string;
  /** Cor do número quando a métrica é financeira e está negativa. */
  cor?: string | null;
  /** `null` num bucket = sem denominador. O `Sparkline` interrompe a linha ali. */
  serie?: (number | null)[];
};

/** Verde/vermelho pelo que o número SIGNIFICA, não pelo sinal aritmético. */
function tomDoDelta(delta: number, invertido?: boolean): "success" | "danger" | "muted" {
  if (delta === 0) return "muted";
  const bom = invertido ? delta < 0 : delta > 0;
  return bom ? "success" : "danger";
}

/* ⛔ `COR_TOM` (a cor PURA do tom) saiu com o `MetricStrip` — era ele o único
   consumidor, e ele pintava a variação como texto colorido solto. O que
   sobreviveu é o par `TINTA_TOM` / `COR_SOBRE_TINTA`, que é a pílula: a cor pura
   sobre o fundo do card dá 3,55:1, e os tokens `on-tint-*` existem exatamente
   para essa combinação não voltar. Reintroduzi-la seria reabrir o par reprovado. */

/**
 * O `trendLabel` só vale a linha se ele AFIRMA alguma coisa. "vs. período
 * anterior" e "no período" são legendas de comparação — sem número ao lado, são
 * moldura vazia ocupando a última linha dos quatro cards.
 */
function apoioUtil(texto?: string): boolean {
  if (!texto) return false;
  return !/^(vs\.?\s|no per[ií]odo$|sem compara)/i.test(texto.trim());
}

/** Fundo tingido do tom, a 12% — o `06` §2. `muted` usa o texto de apoio. */
const TINTA_TOM = {
  success: "var(--tk-tint-success)",
  danger: "var(--tk-tint-danger)",
  muted: "var(--tk-tint-neutral)",
} as const;

/** Texto sobre o tingimento. ⛔ Nunca a cor pura: é o par de 3.55:1 que os
 *  tokens `on-tint-*` existem para não deixar acontecer. */
const COR_SOBRE_TINTA = {
  success: "var(--tk-on-tint-success)",
  danger: "var(--tk-on-tint-danger)",
  muted: "var(--tk-on-tint-neutral)",
} as const;

/**
 * PílulaDelta — a cápsula de variação, AO LADO do número.
 *
 * 🎨 Ela era texto solto embaixo do valor, e trocá-la de lugar é o item 1 da
 * ordem de aplicação do `06` — "maior mudança de percepção, menor custo". O
 * motivo é que texto solto se lê como legenda e cápsula se lê como OBJETO: a
 * variação deixa de ser uma nota de rodapé do número e passa a ser um dado ao
 * lado dele.
 *
 * ⛔ A SETA SEGUE O SINAL E A COR SEGUE O SIGNIFICADO, e são coisas separadas.
 * Um CPA que cai tem seta para BAIXO e cor VERDE — as duas certas ao mesmo
 * tempo. Amarrar a seta à cor faria "o CPA caiu" aparecer com seta para cima.
 */
export function PilulaVariacao({
  texto,
  tom,
  seta,
}: {
  /** Já formatado — "18,6%". O componente não calcula nada. */
  texto: string;
  tom: "success" | "danger" | "muted";
  /** `null` some com a seta — para variação que não tem direção. */
  seta?: "cima" | "baixo" | null;
}) {
  return (
    <span
      className="text-caption"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        flex: "none",
        height: 22,
        padding: "0 8px",
        borderRadius: "var(--tk-radius-pill)",
        background: TINTA_TOM[tom],
        color: COR_SOBRE_TINTA[tom],
        fontWeight: 600,
        // Sem isto a pílula muda de largura a cada atualização do tempo real e
        // o número ao lado dela balança junto.
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}
    >
      {seta !== null && (
        <span aria-hidden="true" style={{ fontSize: 12 }}>
          {seta === "cima" ? "↑" : seta === "baixo" ? "↓" : "—"}
        </span>
      )}
      {texto}
    </span>
  );
}

/**
 * A pílula a partir de um DELTA numérico. Ela decide tom e seta; quem só tem o
 * texto pronto usa a `PilulaVariacao` direto.
 *
 * ⛔ UMA implementação de pílula, e não duas. O `CardMetrica` tinha a variação
 * como texto colorido solto e ia ganhar a sua — duas pílulas com o mesmo papel
 * divergem no primeiro ajuste de padding, e o usuário vê as duas lado a lado
 * sem saber qual está certa.
 */
function PilulaDelta({ delta, invertido }: { delta: number; invertido?: boolean }) {
  return (
    <PilulaVariacao
      tom={tomDoDelta(delta, invertido)}
      seta={delta === 0 ? undefined : delta > 0 ? "cima" : "baixo"}
      texto={`${Math.abs(delta).toFixed(1).replace(".", ",")}%`}
    />
  );
}

export function BlocoMetrica({ dados, carregando = false }: { dados: DadosKpi; carregando?: boolean }) {
  const corNumero = dados.cor ?? "var(--tk-text)";
  const { ref: refNumero, escala: escalaNumero } = useCouberNumero(dados.valor);

  /* 🔄 A LINHA SEGUIA O TOM DO DELTA, e parou em 07/08/2026. Um sparkline verde
     porque a variação foi positiva pinta de "lucro" uma série que é de
     FATURAMENTO — e o `06` §10 reserva verde/vermelho para a pílula de variação,
     o valor de lucro e o alerta. A pílula ao lado já diz o tom; a linha dizendo
     de novo é a mesma informação ocupando a cor que dá significado.

     A exceção é o `dados.cor`, e ela é a regra e não um furo: quando ele vem
     preenchido é porque o VALOR é negativo (Lucro em prejuízo), que é
     literalmente o "valor de lucro" que o §10 permite colorir. Aí a linha
     acompanha o número, e as duas coisas na tela dizem a mesma verdade. */
  const corLinha = dados.cor ?? "var(--tk-primary)";

  return (
    /* 🎨 `tk-escala` — o número e o sparkline crescem com a largura DESTE card.
       ⛔ Ele depende de estar dentro de um `.tk-medida`, que é quem carrega o
       `container-type`. Sem o ancestral, a consulta cai na raiz e responde
       sobre a janela: ver o ⛔ da prop `escala` no `Card`. */
    <div
      /* 🔑 `tk-kpi` é o que liga a leitura por ALTURA; `tk-escala` é a escala por
         LARGURA que todos os blocos já tinham. As duas consultam o MESMO
         contêiner (a célula da grade), e por isso vivem no mesmo elemento: o
         `--tk-b-kpi` que o padding e o número leem é derivado do `--tk-b-metrica`
         que a escala publica aqui. */
      className="bg-surface border border-border tk-escala tk-kpi"
      style={{
        borderRadius: "var(--tk-radius-card)",
        /* ⚠️ Padding e gap vêm de variável, não de literal: em um slot de uma
           célula (80px) os 24px de `--tk-pad-hero` dos dois lados não deixam
           altura para o rótulo E o número. Quem troca o valor é a container
           query, no mesmo lugar que decide o resto da leitura compacta. */
        padding: "var(--tk-pad-kpi, var(--tk-pad-hero))",
        boxShadow: "var(--tk-shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--tk-gap-kpi, 6px)",
        justifyContent: "center",
        minWidth: 0,
        flex: 1,
        /* ⛔ `height: 100%` além do `flex: 1`: na grade o bloco é filho direto da
           célula (que é `container-type: size`, ou seja, `contain: size`), e ali
           não há contexto flexível para o `flex` valer. Sem isto o card ficaria
           com a altura do conteúdo dentro de um slot maior — a F1 pelo avesso. */
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* 🔴 `flex: none` NO RÓTULO E NA LINHA DO NÚMERO — achado na passada
          visual da F5. Numa coluna flex sob pressão, todo filho encolhe: medido
          no card de ROAS dentro da moldura de edição, o rótulo foi de 17px para
          **4px** — legível como um risco.

          ⛔ E o que encolhe primeiro tem de ser o APOIO, nunca a resposta. Sem
          isto, o único card com uma linha a mais (o ROAS, que declara a base)
          sacrificava justamente o texto que diz QUAL métrica é aquela. É a mesma
          ordem de sacrifício das colunas de tabela, na vertical. */}
      <span className="text-label text-text-secondary" style={{ flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {dados.rotulo}
      </span>

      {/* Número e pílula na MESMA linha. O `baseline` alinha a cápsula pela
          linha do texto do valor, não pelo topo da caixa dele — com `center` ela
          flutua alto, porque a caixa do número é bem mais alta que a glifa.

          `flexWrap` porque a fileira tem 4 cards e a largura de cada um depende
          do arranjo que o usuário salvou: no card mais estreito a pílula desce
          para a linha de baixo em vez de espremer o número. */}
      <div style={{ display: "flex", flex: "none", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
        {/* 🎨 O NÚMERO ESCALA EM DEGRAUS com a largura do card (`--tk-b-metrica`,
            4 faixas). `text-metric-xl` continua definindo peso, tracking e
            `font-variant-numeric`; só o TAMANHO passa a vir da escala — senão
            um hero de 12 colunas teria o mesmo número de um de 3, perdido no
            meio do quadro.

            ⛔ Degrau e não interpolação: em tamanho intermediário o dígito perde
            hinting e pesa diferente do card vizinho. */}
        {/* 🔑 A BASE DA RAZÃO VIVE AQUI TAMBÉM, e não só na linha de baixo.
            Num slot de 2 células a linha de base é ESCONDIDA INTEIRA (ver
            `.tk-kpi-base` no `globals.css`), e este `title` é o que a mantém
            alcançável — o número é o que ela qualifica, então é dele que ela
            deve pender.

            ⛔ Não é redundância quando a linha está visível: é a mesma
            declaração presa à coisa que ela descreve. E é o contrário de
            truncar — o texto sai INTEIRO, nunca com reticências. */}
        {/* 🔴 C7 — O NÚMERO NUNCA TRUNCA. Ele ENCOLHE até caber.
            ⛔ `textOverflow: ellipsis` SAIU daqui, e a remoção é o conserto: um
            `R$ 7.05…` não é um número menor, é um número ERRADO — e a ordem de
            sacrifício do KPI põe o número em primeiro justamente porque ele é a
            resposta. Medido em 13/08/2026 no modo de edição: card de 182px, o
            número a 30px pedia 166px de 132 e saía cortado em 34. */}
        <span
          ref={refNumero}
          className="text-metric-xl"
          title={dados.base || undefined}
          style={{
            /* `escalaNumero` é 1 enquanto couber; abaixo disso é a razão medida,
               com piso. Ver `useCouberNumero`. */
            fontSize: `calc(var(--tk-b-kpi, var(--tk-b-metrica, 30px)) * ${escalaNumero})`,
            lineHeight: 1.05, color: corNumero, whiteSpace: "nowrap", minWidth: 0,
          }}
        >
          {carregando ? "—" : dados.valor}
        </span>

        {/* ⛔ Some durante o carregamento junto com o número. Uma cápsula verde
            de "+18,6%" ao lado de um "—" afirma uma comparação que a tela acabou
            de dizer que não tem. */}
        {!carregando && dados.delta != null && (
          <PilulaDelta delta={dados.delta} invertido={dados.invertido} />
        )}
      </div>

      {/* ══ O QUE SÓ EXISTE COM ALTURA ═══════════════════════════════════════
          🔴 `.tk-kpi-alto` some abaixo de ~130px de slot, e a escolha do que
          entra aqui não é de conforto: o que fica é o que RESPONDE (rótulo,
          número, variação); o que sai é o que CONTEXTUALIZA (a série, contra o
          que se compara, qual população o número cobre).

          ⛔ É a mesma ordem de sacrifício das colunas de tabela deste projeto —
          sai o apoio, nunca a resposta. Um bloco de uma célula que mostrasse o
          sparkline e cortasse o número seria o inverso exato.

          ⚠️ E a `base` sai junto, apesar de ela ser uma declaração honesta que
          o produto quer fazer. Ela cabe em duas linhas de texto e o slot tem
          80px: mantê-la ali produziria um número espremido com uma nota de
          rodapé — a informação que o usuário não pode deixar de ver é o próprio
          valor. Quem quer a base estica o bloco, e é uma alça de distância. */}
      {/* O sparkline vem ANTES do delta e depois do número: ele é o contexto do
          número, e o delta é a conclusão. Lido de cima para baixo dá
          "quanto → como veio → o que isso quer dizer".

          A área tem altura FIXA dentro de cada faixa, com ou sem série — senão
          um card sem dado fica mais baixo e a fileira desalinha. */}
      {/* 🔴 `flex: 0 1 …` — ELE PODE ENCOLHER, e não pode crescer. Medido na
          passada visual: o card de ROAS é o único com uma linha a mais (a base
          da razão), e no slot de 2 células ele pedia **5px** além do que tinha.
          Com `height` cravado, esses 5px viravam corte silencioso.

          ⛔ O que cede é o sparkline, e a escolha não é de conveniência: entre
          rótulo, número, variação, legenda e SÉRIE, a série é a única que
          continua dizendo o mesmo com menos pixel. É a ordem de sacrifício de
          sempre — cede o apoio, nunca a resposta.

          ⚠️ E ele NÃO cresce (`flex-grow: 0`): num slot alto ele viraria a maior
          coisa do card, e um bloco de métrica não é um bloco de gráfico. Quem
          quer a série grande tem `Receita vs. gasto`. */}
      <div
        className="tk-spark tk-kpi-alto"
        /* ⚠️ `overflow: hidden` porque encolher a CAIXA não encolhe o que está
           dentro dela. Visto na tela, na moldura de edição: com a caixa em 12px,
           a frase "sem histórico para a tendência" (que fica centrada nela)
           passava por cima de "sem período anterior para comparar" — duas linhas
           de texto sobrepostas.

           ⛔ Texto sobreposto é pior que texto cortado: o primeiro é ilegível e
           parece defeito de renderização; o segundo se lê como falta de espaço,
           que é o que é. Aqui o corte só acontece na PRÉVIA da edição, onde a
           moldura come ~37px do slot — na tela de verdade a caixa é inteira. */
        style={{ margin: "2px -4px 0", flex: "0 1 var(--tk-b-spark, 32px)", minHeight: 0, overflow: "hidden" }}
      >
        {/* ⚠️ `100%`, e não 38: quem decide a altura é a caixa de cima, que encolhe
            quando o card precisa. Um número aqui faria o desenho ignorar o
            encolhimento e ser cortado — a §7.8 dentro do próprio componente. */}
        <Sparkline valores={dados.serie ?? []} cor={corLinha} altura="100%" />
      </div>

      {/* 🔴 RÓTULO DE COMPARAÇÃO SEM VALOR É PIOR QUE NADA. Sem delta, o hook
          devolve "vs. período anterior" como `trendLabel` — uma legenda de
          comparação para um card que não compara coisa nenhuma. Ela some. O que
          fica é `trendLabel` que DIZ algo ("12 vendas aguardando pagamento"). */}
      {dados.delta != null ? (
        /* A pílula subiu para junto do número; o que sobra aqui é a LEGENDA dela
           — contra o que a variação está sendo medida. Ela é neutra de propósito:
           a cor já foi dita uma vez, e dizê-la duas vezes na mesma coluna faz o
           card inteiro parecer vermelho num dia ruim. */
        <span className="text-caption text-text-muted tk-kpi-alto" style={{ flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          vs. período anterior
        </span>
      ) : apoioUtil(dados.trendLabel) ? (
        <span className="text-caption text-text-muted tk-kpi-alto" style={{ flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {dados.trendLabel}
        </span>
      ) : (
        /* Sem delta, o motivo é sempre o mesmo: não há período anterior com
           dado para comparar. Dizer isso é diferente de repetir a legenda "vs.
           período anterior" sem número — aquilo prometia uma comparação que não
           existia; isto explica a ausência dela. */
        <span className="text-caption text-text-muted tk-kpi-alto" style={{ flex: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          sem período anterior para comparar
        </span>
      )}

      {/* ── A BASE DA RAZÃO ─────────────────────────────────────────────────
          Ver `DadosKpi.base`. Fica ABAIXO da legenda de comparação porque
          responde outra pergunta: aquela diz contra o que a variação foi
          medida, esta diz o que o número cobre.

          ⛔ `--tk-text-muted` e nada mais. Sem cor de atenção — declarar a base
          não é acusar o número. */}
      {dados.base && (
        <span
          className="text-caption text-text-muted tk-kpi-alto tk-kpi-base"
          /* ⚠️ `flex: none` — senão ELA é que encolhe. Medido: a linha de base
             do ROAS ficava 8px curta e a segunda linha do texto era cortada.
             Numa coluna flex, "quem cede" não é escolha do desenho: é quem
             esqueceu de dizer que não cede.

             🔑 `tk-kpi-base` é o que a esconde INTEIRA no slot de 2 células —
             ver a ordem de sacrifício no `globals.css`. Escondê-la não é
             cortá-la: o texto continua completo no `title` do número. */
          /* 🔴 O `opacity: 0.85` SAIU — medido em 12/08/2026, na passada da F5:
             ele levava a linha de base a **3,70:1** no tema claro e **4,15:1** no
             escuro, abaixo do piso de 4,5. Sem ele: 4,97 e 5,20.
             `--tk-text-muted` já é o token mais silencioso da paleta; abaixar
             mais era pintar a declaração da base num tom que parte das pessoas
             não lê — e ela existe justamente para ser lida.

             ⚠️ **O `test:contraste` não pegava e não pegaria**: ele mede PARES DE
             TOKEN no `globals.css`, e a opacidade é aplicada no componente, em
             cima do par. Só medir a cor PINTADA acha isto — é o mesmo buraco que
             o `06` §CSS já documenta, agora com um caso. */
          style={{ flex: "none", marginTop: 2, lineHeight: 1.35 }}
        >
          {dados.base}
        </span>
      )}
    </div>
  );
}

/* ⛔ `MetricStrip` FOI DELETADO AQUI — F5, 12/08/2026.

   Ele era a faixa dos sete restantes: uma linha sem card e sem sparkline, com
   `.tk-medida` por item. Ele existia porque existia uma ZONA "Resumo" com teto
   de oito, e as zonas acabaram.

   ⚠️ A pergunta que a regra dos órfãos manda fazer antes de apagar — *"o que
   este símbolo FAZIA?"* — tem resposta curta aqui: **desenhava**. Nenhum efeito
   colateral, nenhuma gravação, nenhum segredo gerado no caminho. Era o caso em
   que `grep` basta, e por isso ele saiu inteiro em vez de virar mais um
   componente que existe e ninguém alcança.

   🔑 O que dele ficou está no `BlocoMetrica`: a leitura compacta é a mesma
   (rótulo pequeno, número em `--tk-b-metrica-sm`, variação), e o `carregando`
   continua chegando — foi ele que consertou a faixa que imprimia os números do
   período anterior enquanto o filtro trocava. */
