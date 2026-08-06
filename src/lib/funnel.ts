/**
 * Cálculos do Funil de Conversão.
 *
 * Módulo puro e sem dependências para ser testável: a regra de percentual mudou
 * uma vez (era "vs. etapa anterior", virou "vs. maior etapa") e a de gargalo é
 * fácil de errar em silêncio.
 */

export interface EtapaEntrada {
  label: string;
  /** Rótulo curto para o cabeçalho da coluna. */
  curto: string;
  value: number;
  /** De onde sai a contagem — aparece no tooltip. */
  fonte?: string;
  /** Chave em `lib/explicacoes.ts` para o InfoTip da etapa. */
  chaveInfo?: string;
}

export interface EtapaCalculada extends EtapaEntrada {
  /** Percentual da MAIOR etapa. A maior é sempre 100. Nunca passa de 100. */
  pct: number;
  /** Conversão real em relação à etapa anterior. `null` na primeira. */
  taxaVsAnterior: number | null;
  /** Pessoas perdidas na transição para a PRÓXIMA etapa. `null` na última. */
  perdaAbs: number | null;
  /** A mesma perda em %, sobre esta etapa. Negativo = a próxima cresceu. */
  perdaPct: number | null;
  /** Faturamento estimado que ficou na mesa. `null` quando não é honesto estimar. */
  perdaValor: number | null;
  /** Esta transição (esta etapa → a próxima) é o maior gargalo do funil. */
  gargalo: boolean;
}

export interface ResumoFunil {
  etapas: EtapaCalculada[];
  /** A pior transição, para o resumo do rodapé. `null` se não há perda alguma. */
  gargalo: { de: string; para: string; perdaPct: number; perdaAbs: number; indice: number } | null;
}

/**
 * A partir de qual índice faz sentido converter perda em dinheiro.
 *
 * Só depois do checkout iniciado: quem chegou ao checkout e não comprou é
 * receita que estava ao alcance, e o ticket médio é uma estimativa defensável.
 * Multiplicar visitante perdido por ticket médio produziria um número enorme e
 * fictício — a maioria dos visitantes nunca compraria de todo jeito.
 */
const INDICE_MIN_FINANCEIRO = 2;

export function calcularFunil(entradas: EtapaEntrada[], ticketMedio = 0): ResumoFunil {
  const maior = Math.max(0, ...entradas.map((e) => e.value));

  // 1ª passada: percentuais e transições.
  const parciais = entradas.map((e, i) => {
    const anterior = i > 0 ? entradas[i - 1]!.value : null;
    const proxima = i < entradas.length - 1 ? entradas[i + 1]!.value : null;

    // Percentual da MAIOR etapa (método Utmify). Com o maior no denominador,
    // nenhuma etapa passa de 100% — era o que acontecia no método antigo, em
    // que "Visita na página" (220) sobre "Cliques" (98) dava 224,49%.
    /* ⚠️ Aqui o 0 e CORRETO e fica: `pct` e a LARGURA da barra, nao uma metrica.
       Sem etapa nenhuma com valor, a barra tem largura zero — que e o desenho
       certo, nao uma afirmacao sobre conversao. A razao de verdade e a
       `taxaVsAnterior` logo abaixo, e essa ja devolvia `null`. */
    const pct = maior > 0 ? (e.value / maior) * 100 : 0;

    // A taxa vs. anterior continua calculada: deixou de ser o número em
    // destaque, mas é a informação analítica de verdade (ela SIM pode passar de
    // 100% quando as fontes são independentes, e isso é um sinal legítimo).
    const taxaVsAnterior = anterior !== null && anterior > 0 ? (e.value / anterior) * 100 : null;

    const perdaAbs = proxima !== null ? e.value - proxima : null;
    const perdaPct = proxima !== null && e.value > 0 ? ((e.value - proxima) / e.value) * 100 : null;

    return { ...e, pct, taxaVsAnterior, perdaAbs, perdaPct, indice: i };
  });

  // 2ª passada: o gargalo é a transição com a MAIOR queda percentual. Só entram
  // quedas de verdade — uma etapa que cresce (fontes independentes) não é
  // gargalo, e sem esse filtro o "maior" cairia numa transição saudável quando
  // o funil inteiro estivesse crescendo.
  let gargaloIdx = -1;
  let piorQueda = 0;
  for (const p of parciais) {
    if (p.perdaPct !== null && p.perdaPct > piorQueda) {
      piorQueda = p.perdaPct;
      gargaloIdx = p.indice;
    }
  }

  const etapas: EtapaCalculada[] = parciais.map((p) => ({
    label: p.label,
    curto: p.curto,
    value: p.value,
    fonte: p.fonte,
    chaveInfo: p.chaveInfo,
    pct: p.pct,
    taxaVsAnterior: p.taxaVsAnterior,
    perdaAbs: p.perdaAbs,
    perdaPct: p.perdaPct,
    perdaValor:
      p.indice >= INDICE_MIN_FINANCEIRO && p.perdaAbs !== null && p.perdaAbs > 0 && ticketMedio > 0
        ? p.perdaAbs * ticketMedio
        : null,
    gargalo: p.indice === gargaloIdx,
  }));

  const g = gargaloIdx >= 0 ? parciais[gargaloIdx]! : null;
  return {
    etapas,
    gargalo: g
      ? {
          de: g.curto,
          para: parciais[gargaloIdx + 1]!.curto,
          perdaPct: g.perdaPct!,
          perdaAbs: g.perdaAbs!,
          indice: gargaloIdx,
        }
      : null,
  };
}
