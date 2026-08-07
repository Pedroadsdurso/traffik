"use client";

import * as React from "react";

/**
 * Heatmap dia-da-semana × hora — 7 linhas, 24 colunas.
 *
 * 🔴 A DISTINÇÃO QUE O COMPONENTE INTEIRO EXISTE PARA FAZER
 *
 * **Célula VAZIA não é célula ZERO.** Quarta às 3h sem nenhuma observação — a
 * janela do filtro não incluiu nenhuma quarta — é diferente de quarta às 3h com
 * zero venda. A primeira é ausência de medição, a segunda é uma medição.
 *
 * Pintar as duas igual faz o gráfico afirmar "ninguém compra nesse horário" onde
 * a resposta certa é "não olhamos". É a mesma doença de tratar denominador zero
 * como zero, e aqui ela custaria decisão de mídia: pausar anúncio numa faixa que
 * nunca foi observada.
 *
 * ⛔ Por isso a vazia não recebe TOM NENHUM — recebe hachura. Cor mais fraca
 * seria "quase nada vendeu"; a hachura não é intensidade, é outra categoria.
 *
 * ### A escala é RAIZ QUADRADA, não linear nem log
 *
 * Linear achata: um pico muito acima do resto deixa o mapa escuro com uma célula
 * acesa — foi o que aconteceu no globo. Log quebraria no zero, e **zero é valor
 * legítimo aqui**, distinto de vazio — a própria distinção principal do bloco.
 * A raiz comprime o pico sem tratar zero como caso especial.
 */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * A hachura da célula NÃO OBSERVADA.
 *
 * 🐛 ERA UM `<pattern>` DE SVG referenciado por `background: url(#id)`, e **CSS
 * não resolve fragmento de SVG em `background-image`**. Medido na tela: a
 * célula saía `rgba(0, 0, 0, 0)` — completamente transparente, exatamente o
 * modo de falha que a hachura existia para evitar. `tsc`, `lint` e `build`
 * passaram os três.
 *
 * `repeating-linear-gradient` é nativo de CSS e funciona em `background`. E a
 * diagonal continua sendo TEXTURA, não intensidade: ela não pode ser lida como
 * "vendeu pouco".
 */
const HACHURA =
  "repeating-linear-gradient(45deg, var(--tk-border) 0 1px, transparent 1px 5px)";

export interface CelulaHeat {
  valor: number;
  observacoes: number;
}

export function Heatmap({
  celulas,
  formatar,
  rotuloMetrica,
}: {
  /** `[diaDaSemana][hora]` — 7 × 24. */
  celulas: CelulaHeat[][];
  formatar: (n: number) => string;
  /** "Receita", "Vendas"… entra no tooltip. */
  rotuloMetrica: string;
}) {
  /* A escala normaliza pela MAIOR MÉDIA da janela, não pelo maior total: é a
     média que está pintada, e usar o total deixaria tudo pálido. */
  const maxMedia = React.useMemo(() => {
    let m = 0;
    for (const linha of celulas)
      for (const c of linha) if (c.observacoes > 0) m = Math.max(m, c.valor / c.observacoes);
    return m;
  }, [celulas]);

  return (
    <div style={{ overflowX: "auto" }}>
      {/* 3px de folga (`06` §7). ⚠️ CONFERIDO CONTRA AS REFERÊNCIAS, e elas
          DISCORDAM entre si: na imagem 1 as células são coladas, num bloco
          contínuo; na referência 4 (Insighta) elas têm folga e raio. O `06`
          codifica a referência 4, e a precedência do acabamento é dele. Grade
          colada é o que mais faz o nosso parecer cru. */}
      {/* 🔴 A CÉLULA DEIXOU DE SER 18px FIXOS (07/08/2026) — e é isso que faz o
          mínimo do bloco cair de "largura cheia" para 5 colunas.

          Com `18px` cravados, a tabela tinha uma largura só: 560px. Num bloco
          mais estreito ela estourava e virava barra de rolagem horizontal; num
          bloco de 12 colunas ficava encolhida num canto, com 600px de vazio ao
          lado — o "conteúdo perdido no meio do quadro" que o dono descreveu.

          Hoje é `width: 100%` + `tableLayout: fixed`: a coluna se divide pelo
          espaço, e a célula é um quadrado por `aspectRatio`. É a regra do `06`
          sobre medida que precisa PARECER a mesma em tamanhos diferentes — ela
          sai de uma fração do contêiner, nunca de um px.

          ⚠️ Os dois limites são px de propósito, porque são limites de LEITURA e
          não de proporção:

          | Limite | Valor | Por quê |
          |---|---|---|
          | piso | `minWidth: 372` (célula ~11px) | abaixo disso a folga de 3px é um quarto do passo e a grade lê como listra, não como mapa. Estourou → rolagem horizontal, que é honesto |
          | teto | `maxWidth: 828` (célula ~30px) | acima disso a célula vira azulejo e o mapa perde a leitura de bloco. O que sobra de largura fica como respiro, não como célula gigante | */}
      <table
        style={{
          borderCollapse: "separate",
          borderSpacing: 3,
          tableLayout: "fixed",
          width: "100%",
          minWidth: 372,
          maxWidth: 828,
        }}
      >
        {/* O rótulo do dia é a única coluna de largura fixa: "Sex" não encolhe. */}
        <colgroup>
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => (
              /* Rótulo a cada 3 horas: 24 números de 11px lado a lado viram uma
                 régua ilegível, e a leitura do mapa não precisa da hora exata —
                 quem precisa do número tem o tooltip. */
              <th key={h} className="text-caption text-text-muted" style={{ fontWeight: 400, padding: 0 }}>
                {h % 3 === 0 ? h : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {celulas.map((linha, d) => (
            <tr key={d}>
              <th
                className="text-caption text-text-muted"
                style={{ fontWeight: 400, textAlign: "right", paddingRight: 6, whiteSpace: "nowrap" }}
              >
                {DIAS[d]}
              </th>
              {linha.map((c, h) => (
                <Celula key={h} c={c} dia={DIAS[d]!} hora={h} max={maxMedia} formatar={formatar} rotulo={rotuloMetrica} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

function Celula({
  c, dia, hora, max, formatar, rotulo,
}: {
  c: CelulaHeat; dia: string; hora: number; max: number;
  formatar: (n: number) => string; rotulo: string;
}) {
  const vazia = c.observacoes === 0;
  const media = vazia ? 0 : c.valor / c.observacoes;

  /* RAIZ QUADRADA — ver a nota do componente. `max || 1` evita dividir por zero
     quando a janela inteira está zerada; nesse caso toda célula observada fica
     no piso, que é a leitura certa ("observamos, não vendeu"). */
  const intensidade = max > 0 ? Math.sqrt(media / max) : 0;

  const titulo = vazia
    ? `${dia}, ${hora}h — sem observação nesta janela`
    : `${dia}, ${hora}h\n${rotulo}: ${formatar(c.valor)} em ${c.observacoes} ${c.observacoes === 1 ? "ocorrência" : "ocorrências"}\nMédia: ${formatar(media)}`;

  return (
    /* ⚠️ O QUADRADO É O `div`, NÃO O `td`. `aspect-ratio` numa célula de tabela
       não é honrado de forma confiável — o algoritmo de tabela decide a altura
       da LINHA, e o `td` obedece a ela. Com o filho carregando a proporção, a
       linha passa a ter a altura dele, e a célula fica quadrada em qualquer
       largura de bloco. */
    <td title={titulo} aria-label={titulo} style={{ padding: 0 }}>
      <div
        style={{
          aspectRatio: "1",
          borderRadius: 4,
          /* ⛔ Vazia recebe HACHURA, não um tom fraco. Ver a nota do componente. */
          background: vazia
            ? HACHURA
            : `color-mix(in oklch, var(--tk-primary) ${Math.round(intensidade * 100)}%, var(--tk-surface-hover))`,
          /* A moldura fica em TODAS, inclusive na vazia: sem ela a célula sem
             pintura desaparece no tema claro e vira buraco na grade em vez de
             categoria. Foi conferido nos dois temas. */
          outline: "1px solid var(--tk-border)",
          outlineOffset: -1,
        }}
      />
    </td>
  );
}
