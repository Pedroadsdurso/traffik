/**
 * As derivações da tela de Criativos: KPIs de topo, abas e a tendência.
 *
 * ⛔ **Puro.** Nada aqui importa o `prisma`, e é de propósito: `escopoDeConfig`
 * ensinou a lição em 11/08 — um módulo que importa o cliente do banco **lança só
 * de ser importado** quando não há `DATABASE_URL`, e aí nenhum teste puro
 * alcança a regra. O que decide o que aparece na tela precisa ser testável sem
 * banco.
 */
import { div } from "@/lib/ads/metrics";
import type { CreativeRow, MetadeDaJanela } from "@/lib/ads/creatives";

/* ═══════════════════════════════════════════════════════════════════════════
   TENDÊNCIA — a aba `Em queda` é o que justifica a tela existir
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Quanto o CTR precisa cair, entre as duas metades da janela, para o criativo
 * ser chamado de **em queda**.
 *
 * ## Por que CTR e não ROAS
 *
 * O ROAS aqui é um par de **instrumentos diferentes** — gasto da Meta sobre
 * receita do gateway — e depende da atribuição venda→anúncio, que é
 * "best-effort" por `utm_content` (dívida técnica nº 3). Um criativo perde ROAS
 * porque o UTM parou de casar, e isso não é saturação de criativo.
 *
 * O CTR tem as duas pontas no MESMO instrumento (cliques e impressões, ambos da
 * Meta) e é exatamente a medida de desgaste: o mesmo público vendo o mesmo
 * anúncio para de clicar. É a pergunta que a aba faz.
 *
 * ## Por que 20%
 *
 * Abaixo disso a metade curta de uma janela pequena oscila sozinha e a aba vira
 * ruído. ⚠️ **É um limiar escolhido, não medido** — não há histórico de
 * criativo nesta base para calibrá-lo. Se a aba listar criativo saudável, é aqui
 * que se mexe, e o número novo vem de olhar casos reais, não de intuição.
 */
export const QUEDA_MINIMA = 0.2;

export type Tendencia = "queda" | "alta" | "estavel" | "sem-comparacao";

/**
 * ⛔ **Ausência de observação não é queda.** Uma metade sem impressão nenhuma
 * devolve `sem-comparacao`, nunca `queda` — é a distinção central deste projeto
 * (`—` × `0`) na camada de aba.
 *
 * Sem a guarda, um criativo pausado no meio da janela (metade recente vazia,
 * CTR `null`) seria lido como "despencou 100%" e lideraria a aba que existe para
 * apontar desgaste. Ele não desgastou: ele parou.
 */
export function tendenciaDoCriativo(c: { anterior: MetadeDaJanela; recente: MetadeDaJanela }): {
  tendencia: Tendencia;
  /** Variação relativa do CTR. `null` quando não há comparação possível. */
  variacao: number | null;
} {
  const { anterior, recente } = c;
  /* ⚠️ As cinco condições em `if` separados, e não num booleano nomeado: o
     TypeScript não propaga o estreitamento através de uma variável, e com o
     booleano ele continuava vendo `ctr` como `number | null` na conta abaixo.
     Mais verboso, e é o compilador cobrando a guarda em vez de confiar nela. */
  if (anterior.dias === 0 || recente.dias === 0) return { tendencia: "sem-comparacao", variacao: null };
  if (anterior.ctr === null || recente.ctr === null) return { tendencia: "sem-comparacao", variacao: null };
  /* CTR anterior zerado: houve impressão e nenhum clique. Não dá para dizer que
     "caiu 100%" nem que "subiu infinito" — é o denominador zero de novo. */
  if (anterior.ctr === 0) return { tendencia: "sem-comparacao", variacao: null };

  const variacao = (recente.ctr - anterior.ctr) / anterior.ctr;
  if (variacao <= -QUEDA_MINIMA) return { tendencia: "queda", variacao };
  if (variacao >= QUEDA_MINIMA) return { tendencia: "alta", variacao };
  return { tendencia: "estavel", variacao };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VEICULAÇÃO — decisão lê o EFETIVO, exibição lê o configurado
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ⛔ Lê `effectiveStatus`, e a regra é a do `CLAUDE.md`: **decisão** (contar,
 * ranquear, recomendar) pergunta "está entregando?", e quem responde isso é o
 * que a Meta faz, não o que o usuário configurou. Um criativo `ACTIVE` dentro de
 * campanha pausada (`CAMPAIGN_PAUSED`) não entrega nada.
 *
 * `null` = nunca sincronizado. Não é ativo nem inativo — é **não medido**, e por
 * isso ele fica de fora das duas contagens.
 */
export function veiculando(c: { effectiveStatus: string | null }): boolean | null {
  if (c.effectiveStatus === null) return null;
  return c.effectiveStatus === "ACTIVE";
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS SEIS KPIs DO TOPO
   ═══════════════════════════════════════════════════════════════════════════ */

export interface KpisCriativos {
  total: number;
  /** `null` = nenhuma impressão na janela. */
  ctrMedio: number | null;
  /** `null` = nenhum clique. */
  cpcMedio: number | null;
  /** `null` = nenhum clique. Vendas por clique. */
  conversao: number | null;
  /** `null` = nenhum gasto. */
  roasMedio: number | null;
  /** Quantos ESTÃO ENTREGANDO — pelo efetivo. */
  veiculando: number;
  /** Quantos nunca foram sincronizados: fora do numerador E do denominador. */
  semVeiculacaoConhecida: number;
}

/**
 * ⛔ **Médias PONDERADAS, nunca média de médias.**
 *
 * `média dos CTR de cada criativo` dá o mesmo peso a um criativo com 10
 * impressões e a outro com 100.000 — e o número resultante não é o CTR de nada.
 * O CTR médio da conta é `Σ cliques / Σ impressões`, que é o que a Meta mostra e
 * o que o gestor compara.
 *
 * ⚠️ A diferença não é sutil: com um criativo de teste parado em 50 impressões e
 * 0,2% de CTR ao lado de um em escala com 3%, a média simples devolve 1,6% para
 * uma conta cujo CTR real é ~3%.
 */
export function kpisDosCriativos(rows: CreativeRow[]): KpisCriativos {
  let impressions = 0;
  let clicks = 0;
  let spend = 0;
  let revenue = 0;
  let sales = 0;
  let entregando = 0;
  let desconhecido = 0;

  for (const c of rows) {
    impressions += c.impressions;
    clicks += c.clicks;
    spend += c.spend;
    revenue += c.revenue;
    sales += c.sales;
    const v = veiculando(c);
    if (v === null) desconhecido += 1;
    else if (v) entregando += 1;
  }

  const ctr = div(clicks, impressions);
  return {
    total: rows.length,
    ctrMedio: ctr === null ? null : ctr * 100,
    cpcMedio: div(spend, clicks),
    conversao: div(sales, clicks),
    roasMedio: div(revenue, spend),
    veiculando: entregando,
    semVeiculacaoConhecida: desconhecido,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   AS ABAS — perguntas de gestor, não filtros genéricos
   ═══════════════════════════════════════════════════════════════════════════ */

export type IdAba = "todos" | "top" | "queda" | "inativos";

/**
 * ⛔ **`Testes A/B`, `Pastas` e `Análise` da imagem 9 NÃO estão aqui**, por
 * decisão do dono de 12/08/2026 — e o motivo não é preguiça:
 *
 * | | |
 * |---|---|
 * | `Testes A/B` · `Pastas` | **não existem no schema.** Medido: `grep -niE "folder\|pasta\|abtest\|experiment\|split.?test"` no `schema.prisma` devolve **zero** |
 * | `Análise` (badge `Novo`) | nem o `03` nem o `04` dizem o que ela mostraria |
 *
 * Aba com contador que abre vazia é a mesma classe do controle inerte: o produto
 * afirma ter algo que não tem. A regra que matou a interação do globo e a prop
 * `aoVerTodos` vale aqui igual.
 *
 * ⚠️ O `04` se contradizia sobre isto — mandava "construir com estado vazio" num
 * parágrafo e listava as duas como "backend novo, sem prazo" cinquenta linhas
 * depois. A contradição foi resolvida no mesmo commit desta tela.
 */
export const ABAS: { id: IdAba; rotulo: string; ajuda: string }[] = [
  { id: "todos", rotulo: "Todos", ajuda: "Todo criativo com anúncio na área ativa." },
  {
    id: "top",
    rotulo: "Top performers",
    ajuda: "Entregando e com ROAS acima de 1 — o anúncio se paga. Quem não gastou fica de fora: sem gasto não há ROAS.",
  },
  {
    id: "queda",
    rotulo: "Em queda",
    ajuda: "O CTR caiu 20% ou mais entre a primeira e a segunda metade do período. Criativo saturando é o que custa dinheiro.",
  },
  {
    id: "inativos",
    rotulo: "Inativos",
    ajuda: "Não estão entregando — pausados, arquivados, reprovados ou barrados por cobrança.",
  },
];

/**
 * ⚠️ **A contagem da aba é a contagem do que ela MOSTRA.** As quatro somam mais
 * que o total, e isso é correto: um criativo em queda pode estar entregando e
 * aparecer em `Todos`, `Top performers` e `Em queda` ao mesmo tempo. São
 * perguntas, não uma partição.
 */
export function filtrarPorAba(rows: CreativeRow[], aba: IdAba): CreativeRow[] {
  switch (aba) {
    case "todos":
      return rows;
    case "top":
      /* `roas !== null` não é redundante com `> 1`: o `null` do denominador zero
         é o que não pode entrar. Sem a checagem, o tipo nem compila — que é a
         proteção que o contrato de `div` existe para dar. */
      return rows.filter((c) => veiculando(c) === true && c.roas !== null && c.roas > 1);
    case "queda":
      return rows.filter((c) => tendenciaDoCriativo(c).tendencia === "queda");
    case "inativos":
      /* ⛔ `=== false`, nunca `!veiculando(c)`: o `null` (nunca sincronizado) é
         falsy e cairia aqui, chamando de inativo o criativo que ninguém mediu. */
      return rows.filter((c) => veiculando(c) === false);
  }
}

export function contarAbas(rows: CreativeRow[]): Record<IdAba, number> {
  return {
    todos: rows.length,
    top: filtrarPorAba(rows, "top").length,
    queda: filtrarPorAba(rows, "queda").length,
    inativos: filtrarPorAba(rows, "inativos").length,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   A MINIATURA — medida, não presumida
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * O que a tela pode prometer sobre a imagem de um criativo.
 *
 * > ### 🔴 A URL DA META EXPIRA EM ~4 DIAS, E É 64×64
 * >
 * > Medido em 12/08/2026 no backup de produção de 01/08, nos **13 de 13**
 * > criativos reais:
 * >
 * > | | |
 * > |---|---|
 * > | resolução | **`_p64x64` em 13 de 13** — ícone, não miniatura de card |
 * > | expiração (`oe=`) | de **34h** a **4,5 dias** após o sync |
 * > | `imageUrl` (a imagem grande) | existe em **1 de 13**; os outros 12 são vídeo |
 * >
 * > Ou seja: o estado NORMAL desta tela em produção é a imagem **não carregar**.
 * > Não é caso de borda.
 *
 * ⛔ Por isso a tela nunca reserva um retângulo vazio esperando imagem: ela
 * desenha o bloco tipográfico e **declara** que a pré-visualização não veio. Um
 * quadrado cinza afirma que a imagem está carregando; ela não está.
 *
 * 🔜 Resolver de verdade exige copiar a imagem para armazenamento nosso no
 * sync — **backend novo**, fora do escopo do redesign, e registrado como tal.
 */
export function temPreVisualizacao(c: { thumbnailUrl: string | null }): boolean {
  return typeof c.thumbnailUrl === "string" && c.thumbnailUrl.length > 0;
}
