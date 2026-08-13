"use client";

import * as React from "react";

import { useTamanho } from "@/components/dashboard/ui/useTamanho";
import { caminhoSuave, fecharArea } from "@/lib/grafico/curva";

/**
 * LineChart — duas séries com pontos e a LINHA DE BREAK-EVEN.
 *
 * 🔴 A linha tracejada é a razão de este componente existir, e não é enfeite: o
 * break-even vem de Taxas e Despesas (gateway, imposto, coprodução, custo de
 * produto, despesa fixa) e é o único jeito de olhar "receita vs. gasto" e saber
 * se o dia foi LUCRO. Sem ela, duas linhas subindo juntas parecem boa notícia e
 * podem ser prejuízo.
 *
 * ⚠️ Quando o break-even não estiver configurado, a linha NÃO É DESENHADA e o
 * gráfico diz isso na legenda. Desenhar uma linha em zero seria pior que
 * omiti-la: pareceria que qualquer receita acima de zero é lucro, que é
 * exatamente a conta errada que a ferramenta existe para corrigir.
 */

export type PontoSerie = { rotulo: string; a: number; b: number };

const AVISO_ESTIMATIVA =
  "A taxa efetiva (gateway, coprodução, imposto e custo de produto) é medida sobre as vendas " +
  "deste período, então o break-even se move com o mix de produtos vendidos. Ele é uma " +
  "estimativa do período, não um valor fixo.";

export function LineChart({
  pontos,
  rotuloA = "Receita",
  rotuloB = "Gasto",
  /** Linha tracejada. `null` = não configurado; não inventamos zero. */
  breakEven = null,
  semBreakEven = null,
  unicasFora = 0,
  formatar,
  altura = 260,
}: {
  pontos: PontoSerie[];
  rotuloA?: string;
  rotuloB?: string;
  breakEven?: number | null;
  /** Por que não há break-even, quando há um motivo melhor que "não configurado". */
  semBreakEven?: string | null;
  /** Quantas despesas ÚNICAS ativas ficaram fora do cálculo. */
  unicasFora?: number;
  formatar: (n: number) => string;
  altura?: number;
}) {
  /**
   * 🐛 `px` É MEDIDO, NÃO CALCULADO — e a primeira versão estava errada.
   *
   * A pílula é HTML sobre um SVG com `viewBox`, e a tentação é posicioná-la em
   * porcentagem (`x(i) / L`). Não funciona: com o `preserveAspectRatio` padrão
   * (`meet`) o desenho é escalado E CENTRADO dentro do viewport, então sobra
   * uma tarja em uma das direções e a coordenada do viewBox não corresponde à
   * porcentagem do elemento. A pílula ficaria deslocada, e o deslocamento
   * MUDARIA com a largura do card — que é justamente o que o modo de edição
   * deixa o usuário alterar.
   *
   * O pixel real do cursor não tem esse problema e não precisa saber a escala.
   */
  const [alvo, setAlvo] = React.useState<{ i: number; px: number } | null>(null);
  /**
   * 🔴 F3 — A ÁREA DE PLOTAGEM É MEDIDA, E O `viewBox` É ELA EM PIXELS.
   *
   * Antes: `viewBox="0 0 760 260"` fixo, `width="100%"` e
   * `height: var(--tk-b-plot, 260px)`. As duas metades estavam erradas pelo mesmo
   * motivo, e é o mesmo do `DonutChart`: **`--tk-b-plot` é derivado da LARGURA**
   * (190 → 350px por faixa de `cqw`), então num bloco largo o gráfico pedia 350px
   * de altura dentro de um slot de 272 — medido, `receita-gasto` estourava
   * **+186px** a 2260 e +126 a 1280, o maior vazamento da tela.
   *
   * ⛔ E "esticar o viewBox" (`preserveAspectRatio="none"`) não é a saída: o SVG
   * tem `<text>` de eixo, e esticar DISTORCE a tipografia — era o que este
   * arquivo já avisava. A saída é o viewBox VALER a caixa: com `0 0 cw ch`, uma
   * unidade de SVG é um pixel, o texto sai em 11px de verdade em qualquer
   * tamanho, e os ticks passam a poder ser derivados de `cw`/`ch` (§4 do `07`).
   */
  const { ref: plotRef, no: plotNo, largura: cw, altura: ch } = useTamanho<HTMLDivElement>();
  const id = React.useId();

  const mirar = React.useCallback(
    (i: number, clientX: number) => {
      const r = plotNo?.getBoundingClientRect();
      if (!r) return;
      // Grampeada para a pílula não vazar pela borda do card. Nos extremos ela
      // desencosta do ponto, e não há ambiguidade: quem marca a posição é a alça.
      const meia = 78;
      setAlvo({ i, px: Math.min(r.width - meia, Math.max(meia, clientX - r.left)) });
    },
    [plotNo],
  );

  /* Antes da primeira medida, os números antigos — a passagem do servidor não
     tem caixa, e um viewBox de zero produziria `NaN` em toda coordenada. */
  const L = cw > 0 ? cw : 760;
  const A = ch > 0 ? ch : altura;
  const PAD = { t: 14, r: 12, b: 26, l: 56 };
  const larg = L - PAD.l - PAD.r;
  const alt = A - PAD.t - PAD.b;

  const maxBruto = Math.max(...pontos.flatMap((p) => [p.a, p.b]), breakEven ?? 0, 1);
  // Teto "redondo" para a régua não sair com 37.412 no topo.
  const passo = Math.pow(10, Math.floor(Math.log10(maxBruto))) / 2;
  const max = Math.ceil(maxBruto / passo) * passo;

  const x = (i: number) => PAD.l + (pontos.length === 1 ? larg / 2 : (i / (pontos.length - 1)) * larg);
  const y = (v: number) => PAD.t + alt - (v / max) * alt;

  const caminho = (chave: "a" | "b") =>
    caminhoSuave(pontos.map((p, i) => [x(i), y(p[chave])] as const));

  /* As DUAS séries têm área, e elas não viram lama porque não competem no mesmo
     canal: a Receita preenche com COR (gradiente que morre para baixo), o Gasto
     com TEXTURA (listra neutra, transparente por baixo). É a resposta do `06` §3
     para "duas séries, um matiz só". */
  const base = PAD.t + alt;
  const area = fecharArea(caminho("a"), x(0), x(pontos.length - 1), base);
  const areaGasto = fecharArea(caminho("b"), x(0), x(pontos.length - 1), base);

  /**
   * §4 do `07` — OS TICKS SÃO DERIVADOS DA CAIXA, não uma lista de cinco frações.
   *
   * ```
   * ticks em y = floor(ch / 56), mínimo 2 quando ch ≥ 160
   * ticks em x = floor(cw / 110), mínimo 2
   * ```
   *
   * Era `[0, 0.25, 0.5, 0.75, 1]` — cinco linhas de grade e cinco rótulos de
   * valor, sempre. Num slot de 3 células (168px úteis) cinco rótulos de eixo se
   * tocam e a grade vira listra; num de 6, cinco é pouco.
   *
   * ⚠️ O `mínimo 2` não é folga: com um tick só não há ESCALA — uma linha
   * horizontal sozinha não diz o intervalo, e o gráfico passa a mostrar forma sem
   * grandeza. Abaixo de 160px de altura ficam **só os extremos**, que é o mínimo
   * que ainda informa.
   */
  const nY = ch >= 160 ? Math.max(2, Math.floor(alt / 56)) : 2;
  const linhas = Array.from({ length: nY + 1 }, (_, i) => (max * i) / nY);

  /* Quantos rótulos de data cabem. 110px é a largura de `dd/MM` com folga para
     não encostar no vizinho — abaixo disso eles se tocam, que é o C2 do `07`. */
  const nX = Math.max(2, Math.floor(larg / 110));
  /* O passo em ÍNDICES. O `-1` porque N rótulos precisam de N-1 intervalos. */
  const passoX = Math.max(1, Math.ceil((pontos.length - 1) / Math.max(1, nX - 1)));

  /** `06` §3 — acima disto o ponto vira ruído e a linha já mostra a densidade. */
  const mostrarPontos = pontos.length <= 15;

  const p0 = alvo ? pontos[alvo.i] : undefined;
  /* "O ponto está no terço de cima?" — decide o lado da pílula. Ver o comentário
     dela: é booleano de propósito, para não depender da escala do SVG. */
  const pontoNoAlto = !!p0 && Math.min(y(p0.a), y(p0.b)) / A < 0.3;

  return (
    /* `relative` é o que ancora a pílula flutuante. Sem ele ela se posicionaria
       contra o primeiro ancestral posicionado — que é o shell — e apareceria no
       canto da janela em vez de sobre o ponto. */
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 🔄 A RECEITA ERA VERDE, E MUDOU EM 07/08/2026. Aqui dizia que `primary`
            é "cor de interface" e que a receita devia usar a cor de valor
            positivo. O `06` §10 inverte, e a razão é mais forte que a anterior:

            **verde/vermelho significam LUCRO E PREJUÍZO nesta ferramenta.** Uma
            linha de faturamento verde afirma que faturar é lucrar — e no dia em
            que o ROAS está em 0,4 a linha continua verde, dizendo o contrário do
            que o card de Lucro logo acima diz em vermelho.

            A regra que fica: destaque (azul de marca) é a série PRINCIPAL;
            lucro/prejuízo/atenção existem EXCLUSIVAMENTE na pílula de variação,
            no valor de lucro e no alerta. O medo antigo — "dois azuis quase
            iguais" — não se aplica: o gasto é neutro, não um segundo azul, e a
            partir do item 5 ele também é hachurado. */}
        <Legenda cor="var(--tk-primary)" texto={rotuloA} />
        <Legenda cor="var(--tk-text-muted)" texto={rotuloB} hachurada />
        {breakEven != null ? (
          /* ⚠️ "(estimado pelo período)" NÃO é modéstia: a taxa efetiva é medida
             sobre as vendas DESTE período, então a linha se move com o mix de
             produtos. Sem o aviso ela vira promessa — e uma linha de equilíbrio
             que promete precisão é pior que uma que admite ser estimativa. A
             explicação inteira está no `title`, que é onde cabe. */
          <span title={AVISO_ESTIMATIVA} style={{ cursor: "help" }}>
            <Legenda cor="var(--tk-warning)" texto={`Break-even ${formatar(breakEven)} (estimado pelo período)`} tracejada />
          </span>
        ) : (
          <span className="text-caption text-text-muted" title={semBreakEven ?? undefined}>
            {semBreakEven ?? (
              <>
                Break-even não configurado —{" "}
                <a className="text-primary" href="/dashboard/taxas">defina em Taxas e Despesas</a>
              </>
            )}
          </span>
        )}
        {unicasFora > 0 && (
          /* 🔴 O CUSTO QUE SUMIU PRECISA APARECER ONDE O NÚMERO SERIA DIFERENTE
             POR CAUSA DELE. Despesa única fica fora do cálculo porque o schema
             não guarda quando ela ocorreu — mas some no gráfico, no card de
             Lucro e na linha de Taxas, nunca em silêncio. */
          <a
            className="text-caption"
            href="/dashboard/taxas"
            style={{ color: "var(--tk-warning)" }}
            title="Despesa única não tem data de ocorrência, então não dá para saber em que período ela entra. Ela não é somada ao custo."
          >
            {unicasFora === 1 ? "1 despesa única fora do cálculo" : `${unicasFora} despesas únicas fora do cálculo`}
          </a>
        )}
      </div>

      {/* A área de plotagem é o bloco de referência da pílula — e é ela, não o
          componente inteiro, senão a medida incluiria a faixa de legendas acima
          e a pílula subiria proporcionalmente ao número de legendas. */}
      <div
        ref={plotRef}
        style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}
        onMouseLeave={() => setAlvo(null)}
      >
      {/* 🎨 F3 — A ALTURA VEM DO SLOT. `100%` dos dois lados, e o `viewBox` vale a
          caixa medida (ver a nota de `plotRef`).

          ⛔ Este comentário dizia o oposto — que a altura vinha de `--tk-b-plot`,
          "4 faixas", e que `height="100%"` faria a altura seguir a LARGURA. A
          segunda metade era o erro: `100%` de um pai com altura definida segue a
          ALTURA, e é o degrau por `cqw` que seguia a largura. Com o slot mandando
          (F1), o pai tem altura definida e o problema que a nota temia não existe.

          ⚠️ `--tk-b-plot` deixou de ter consumidor por causa disto. Ele saiu do
          `globals.css` no mesmo commit — token derivado de largura para decidir
          ALTURA é a família inteira que a F3 está fechando. */}
      <svg
        viewBox={`0 0 ${L} ${A}`}
        width="100%"
        height="100%"
        role="img"
        aria-label={`${rotuloA} contra ${rotuloB} ao longo do período`}
        style={{ display: "block", flex: 1, minHeight: 0 }}
      >
        <defs>
          {/* 18% no topo → 0 na base (`06` §3). O gradiente é o que faz a área
              "morrer para baixo" em vez de ser um bloco chapado — sem ele o
              preenchimento compete com a grade e com a linha de break-even. */}
          <linearGradient id={`areaA${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tk-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--tk-primary)" stopOpacity="0" />
          </linearGradient>

          {/* ♿ A HACHURA NÃO É ENFEITE — ela é o que separa as duas séries SEM COR.
              Medido no teste do cinza de 07/08/2026: dessaturadas, Receita e Gasto
              só se distinguiam pelo preenchimento de área, e "por pouco". Isso é
              WCAG 1.4.1, não estética: quem não distingue azul de cinza ficava com
              duas linhas escuras quase iguais num gráfico de duas séries.

              Com a listra, o Gasto tem TEXTURA: sobrevive ao cinza, à impressão em
              preto e branco e a qualquer daltonismo. E resolve Receita × Gasto sem
              inventar um segundo matiz, que é a regra de cor do `06` §10.

              ⚠️ `patternUnits="userSpaceOnUse"` é obrigatório: em `objectBounding`
              o passo da listra ESCALA com o tamanho da área, então a textura muda
              de densidade conforme o dado — e a mesma listra significaria coisas
              diferentes em dois dias. */}
          <pattern
            id={`hachuraB${id}`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--tk-text-muted)" strokeWidth="1.6" opacity="0.34" />
          </pattern>
        </defs>

        {linhas.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={L - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--tk-border)" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fill="var(--tk-text-muted)" style={{ fontSize: 11 }}>
              {formatar(v)}
            </text>
          </g>
        ))}

        {breakEven != null && breakEven <= max && (
          <line
            x1={PAD.l} x2={L - PAD.r} y1={y(breakEven)} y2={y(breakEven)}
            stroke="var(--tk-warning)" strokeWidth="1.5" strokeDasharray="6 4"
          />
        )}

        {/* ⛔ A ORDEM DAS QUATRO CAMADAS NÃO É ARBITRÁRIA:
              1. hachura do Gasto — embaixo, é a mais fraca das duas texturas;
              2. gradiente da Receita — semitransparente, deixa a listra aparecer
                 na sobreposição em vez de apagá-la;
              3. linha do Gasto;
              4. linha da Receita — por último, é a série que se lê primeiro.
            Trocar 1 e 2 faz o gradiente sumir sob a listra; trocar 3 e 4 faz o
            traço do Gasto cortar a Receita nos cruzamentos. */}
        <path d={areaGasto} fill={`url(#hachuraB${id})`} />
        <path d={area} fill={`url(#areaA${id})`} />
        <path d={caminho("b")} fill="none" stroke="var(--tk-text-muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={caminho("a")} fill="none" stroke="var(--tk-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {pontos.map((p, i) => (
          <g key={i}>
            {/* 📍 O PONTO DIZ "HOUVE MEDIÇÃO AQUI" — por isso ele depende da
                densidade, e não é meio-termo entre sempre e nunca (`06` §3).

                Com 3 pontos, que é o dado real de hoje, a linha lisa parece
                medição contínua e esconde que só existem três dias medidos. Com
                30, os pontos viram ruído e a própria linha mostra a densidade.

                ⛔ Não confunda com o marcador de hover: o ponto responde "houve
                medição?", o marcador responde "você está olhando para qual?".
                Perguntas diferentes — por isso o marcador aparece nas duas
                faixas e o ponto não. */}
            {mostrarPontos && (
              <>
                <circle cx={x(i)} cy={y(p.b)} r={3} fill="var(--tk-text-muted)" />
                <circle cx={x(i)} cy={y(p.a)} r={3} fill="var(--tk-primary)" />
              </>
            )}
            {/* Faixa invisível de captura: mirar num ponto de 3px é o que faz
                gráfico custom parecer quebrado no mouse.

                `onMouseMove` além do `enter`: dentro de uma faixa larga o cursor
                anda bastante, e sem o `move` a pílula ficava parada na borda em
                que se entrou — o oposto do "segue o cursor" do `06` §3. */}
            {/* ⚠️ A FAIXA É GRAMPEADA À ÁREA DE PLOTAGEM. Sem o clamp, a do
                último ponto passava meia faixa (12px) do eixo direito. O SVG
                recorta no `viewBox`, então nada aparecia — mas o retângulo EXISTE
                com aquela geometria, e a varredura de vazamento horizontal da
                §7.3 o contava como fuga. Um medidor que aponta defeito onde não
                há custa tanto quanto um que não aponta onde há. */}
            <rect
              x={Math.max(PAD.l, x(i) - larg / Math.max(pontos.length, 1) / 2)}
              y={PAD.t}
              width={Math.min(
                larg / Math.max(pontos.length, 1),
                L - PAD.r - Math.max(PAD.l, x(i) - larg / Math.max(pontos.length, 1) / 2),
              )}
              height={alt}
              fill="transparent"
              onMouseEnter={(e) => mirar(i, e.clientX)}
              onMouseMove={(e) => mirar(i, e.clientX)}
            />
            {/* §4 — a densidade de rótulos sai de `cw`, não de um `/7` fixo. O
                primeiro e o último sempre ficam: são eles que dizem o INTERVALO
                do período, e sem um deles o eixo mostra ordem sem âncora. */}
            {(i === 0 || i === pontos.length - 1 || i % passoX === 0) && (
              <text x={x(i)} y={A - 8} textAnchor="middle" fill="var(--tk-text-muted)" style={{ fontSize: 11 }}>
                {p.rotulo}
              </text>
            )}
          </g>
        ))}

        {/* ── O marcador de hover (`06` §3) ────────────────────────────────
            Três peças, e cada uma faz uma coisa que as outras não fazem:

            • a ALÇA — cápsula de 8px em `primary` tingido — é a que se vê de
              relance e a que dá a sensação de peça física sob o cursor;
            • a LINHA fina é a que permite MIRAR: a alça é larga demais para
              dizer exatamente qual dia está sob o cursor;
            • os anéis nos dois pontos amarram o marcador aos VALORES, senão a
              faixa parece flutuar sobre o gráfico sem tocar o dado.

            A alça é `rx` total e não um retângulo: canto vivo aqui é o mesmo
            "aspecto cru" que o `06` §3 mira ao pedir raio em tudo. */}
        {p0 && (
          <g pointerEvents="none">
            <rect
              x={x(alvo!.i) - 4}
              y={PAD.t}
              width={8}
              height={alt}
              rx={4}
              /* 🔍 CONFERIDO CONTRA AS REFERÊNCIAS 3 E 4 (07/08/2026), e a
                 primeira versão reprovou: eu usei `tint-primary` (14%) e a alça
                 quase não existia sobre a área preenchida. Nas duas referências
                 ela é uma cápsula SÓLIDA — laranja cheia na Veselty, cinza
                 cheia na Insighta —, e é isso que a faz parecer uma peça sob o
                 cursor em vez de um brilho.

                 45% é o meio-termo desta base: peça de verdade, e ainda deixa a
                 curva passar por dentro. Opaca de vez esconderia o cruzamento
                 das duas séries, que é o momento em que se olha o gráfico. */
              fill="color-mix(in oklch, var(--tk-primary) 45%, transparent)"
            />
            <line
              x1={x(alvo!.i)} x2={x(alvo!.i)} y1={PAD.t} y2={base}
              stroke="var(--tk-primary)" strokeWidth="1" opacity="0.55"
            />
            {/* Anel de fundo na cor da SUPERFÍCIE: sem ele o ponto destacado se
                perde quando cai em cima da própria área preenchida. */}
            <circle cx={x(alvo!.i)} cy={y(p0.b)} r={5} fill="var(--tk-surface)" stroke="var(--tk-text-muted)" strokeWidth="2" />
            <circle cx={x(alvo!.i)} cy={y(p0.a)} r={5} fill="var(--tk-surface)" stroke="var(--tk-primary)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* ── A pílula flutuante ────────────────────────────────────────────────
          ⛔ ELA É HTML, NÃO `<text>` DE SVG, e a diferença é de manutenção: o
          valor já vem formatado por `formatar()` em português (R$, milhar com
          ponto), e reproduzir fundo sólido, raio, sombra e quebra de linha em
          SVG seria reimplementar o que o CSS faz numa linha.

          ⚠️ ELA VIRA PARA BAIXO quando o pico está no alto. Presa em cima, a
          pílula tapava exatamente o ponto que se foi consultar — e o melhor dia
          do período é justamente o que fica lá. A decisão usa o DADO
          (`y(a) / A < 0.3`), não pixel medido: é um booleano, então não depende
          da escala do SVG e não erra quando o card muda de largura. */}
      {p0 && (
        <div
          role="status"
          className="text-caption bg-surface border border-border"
          style={{
            position: "absolute",
            left: alvo!.px,
            // Virada para baixo, a folga é maior: abaixo da base do desenho ainda
            // existe a faixa de rótulos do eixo, e a pílula tapava a data.
            [pontoNoAlto ? "bottom" : "top"]: pontoNoAlto ? 34 : 14,
            transform: "translateX(-50%)",
            // 120ms é o `06` §3: rápido o bastante para colar no cursor, lento o
            // bastante para o olho ver que é o MESMO objeto se movendo.
            transition: "left 120ms var(--tk-ease-padrao)",
            padding: "7px 10px",
            borderRadius: 8,
            boxShadow: "var(--tk-shadow-overlay)",
            display: "grid",
            gap: 3,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <span className="text-text-secondary">{p0.rotulo}</span>
          <ValorNaPilula cor="var(--tk-primary)" rotulo={rotuloA} valor={formatar(p0.a)} />
          <ValorNaPilula cor="var(--tk-text-muted)" rotulo={rotuloB} valor={formatar(p0.b)} hachurado />
        </div>
      )}
      </div>
    </div>
  );
}

/** Linha da pílula. O selo repete o mesmo sinal da legenda — cor E textura. */
function ValorNaPilula({
  cor,
  rotulo,
  valor,
  hachurado,
}: {
  cor: string;
  rotulo: string;
  valor: string;
  hachurado?: boolean;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <SeloSerie cor={cor} hachurado={hachurado} />
      <span className="text-text-secondary">{rotulo}</span>
      <span className="text-text" style={{ marginLeft: "auto", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </span>
    </span>
  );
}

/**
 * Selo da série. **O selo do Gasto é listrado, e isso não é decoração.**
 *
 * ♿ Se a legenda distinguisse as séries só por cor enquanto o gráfico as
 * distingue por cor E textura, a legenda seria o elo fraco: quem depende da
 * textura no desenho não teria como saber QUAL das duas é a listrada. O sinal
 * tem de ser o mesmo nos dois lugares.
 */
function SeloSerie({ cor, hachurado }: { cor: string; hachurado?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 9,
        height: 9,
        flex: "none",
        borderRadius: 2,
        background: hachurado
          ? `repeating-linear-gradient(45deg, ${cor} 0 1.5px, transparent 1.5px 4px)`
          : cor,
        // Sem o contorno a listra vira três riscos soltos: o selo perde a forma
        // e deixa de parecer o par do selo sólido ao lado.
        outline: hachurado ? `1px solid color-mix(in oklch, ${cor} 55%, transparent)` : undefined,
        outlineOffset: -1,
      }}
    />
  );
}

function Legenda({ cor, texto, tracejada, hachurada }: { cor: string; texto: string; tracejada?: boolean; hachurada?: boolean }) {
  return (
    <span className="text-caption text-text-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {tracejada ? (
        <span aria-hidden="true" style={{ width: 14, height: 0, borderTop: `2px dashed ${cor}` }} />
      ) : (
        <SeloSerie cor={cor} hachurado={hachurada} />
      )}
      {texto}
    </span>
  );
}
