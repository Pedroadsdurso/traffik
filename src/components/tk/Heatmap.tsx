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
      <table style={{ borderCollapse: "separate", borderSpacing: 2, minWidth: 560 }}>
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => (
              /* Rótulo a cada 3 horas: 24 números de 11px lado a lado viram uma
                 régua ilegível, e a leitura do mapa não precisa da hora exata —
                 quem precisa do número tem o tooltip. */
              <th key={h} className="text-caption text-text-muted" style={{ fontWeight: 400, padding: 0, width: 18 }}>
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
    <td
      title={titulo}
      aria-label={titulo}
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
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
  );
}
