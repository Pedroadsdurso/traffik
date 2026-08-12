import { getUserTimezone } from "@/lib/userTimezone";
import { carregarMapaDeAreas } from "@/lib/areas/atribuicao";
import { prisma } from "@/lib/prisma";
import { janelaDoPeriodo, type PeriodoNome } from "@/lib/periodo";
import { dayEnd, dayKeyInTz, dayStart, keyToDateColumn } from "@/lib/timezone";
import { chaveDoPedido } from "@/lib/pedidos";
// A regra de denominador zero e UMA so nesta base. Ver o comentario do `div`.
import { div } from "@/lib/ads/metrics";
import { splitPipe } from "@/lib/utm/parse";
import { CAMPOS_UTM, utmsDaVenda } from "@/lib/vendas/utmsDaVenda";

/** ⚠️ Alias de `PeriodoNome` — mesma união do Dashboard e do Gerenciador. */
export type CreativePeriod = PeriodoNome;
export type CreativeSort = "roas" | "ctr" | "spend" | "sales";

/**
 * Metade de janela, para a aba `Em queda`.
 *
 * ⚠️ `ctr`/`roas` sao `null` quando o denominador nao existe, e isso NAO e o
 * mesmo que queda: metade sem gasto nao caiu, ela nao foi medida. Quem decide
 * o que fazer com o nulo e `lib/ads/criativos.ts`.
 */
export interface MetadeDaJanela {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  /** Dias com linha de metrica NESTA metade. `0` = metade inteira sem observacao. */
  dias: number;
}

export interface CreativeRow {
  id: string;
  name: string;
  campaign: string;
  thumbnailUrl: string | null;
  format: string;
  /** `null` = sem impressao. Indefinido, nao zero. */
  ctr: number | null;
  /** `null` = sem gasto. Indefinido, nao zero. */
  roas: number | null;
  spend: number;
  sales: number;
  revenue: number;
  best: boolean;

  /* ── Acrescentado em 12/08/2026, na reescrita da tela ─────────────────────
     ADITIVO: nenhum campo acima mudou de valor nem de contrato. Mesma jogada
     do `overview.ts` no Gerenciador (08/08) — a regra do congelamento proibe
     alterar o que a `main` calculava, nao proibe acrescentar ao lado. */

  /** `effective_status` cru da Meta, herdado do anuncio. `null` = nunca sincronizado. */
  effectiveStatus: string | null;
  /** O que o usuario CONFIGUROU. ⛔ Decisao ("esta entregando?") le o efetivo. */
  status: string;
  impressions: number;
  clicks: number;
  /** `null` = sem clique. Custo por clique nao existe sem clique. */
  cpc: number | null;
  /**
   * `null` = sem clique. Vendas por clique — a "taxa de conversao" do `04`.
   *
   * ⚠️ Os dois lados vem de INSTRUMENTOS diferentes: `clicks` e da Meta e
   * `sales` e do gateway. A razao herda a discordancia, como o ROAS. Ver a
   * secao "DOIS INSTRUMENTOS NAO SE COMPARAM" no `CLAUDE.md`.
   */
  conversao: number | null;
  /** Metade ANTIGA da janela. Ver `MetadeDaJanela`. */
  anterior: MetadeDaJanela;
  /** Metade RECENTE da janela. */
  recente: MetadeDaJanela;
}

/**
 * Janela dos Criativos, da fonte ÚNICA (`lib/periodo.ts`).
 *
 * ⚠️ Isto era uma cópia do `rangeStart` do `overview.ts`, com o comentário
 * "mesma janela do gerenciador" — que é a confissão de que eram duas cópias da
 * mesma regra. As duas herdavam o mesmo defeito: sem ponta final.
 */
function janela(opts: { period: CreativePeriod; from?: string; to?: string }, tz: string) {
  const agora = new Date();
  const j = janelaDoPeriodo(opts.period, tz, { from: opts.from, to: opts.to }, agora);
  return {
    start: dayStart(j.startKey, tz),
    end: j.endKey === dayKeyInTz(agora, tz) ? agora : dayEnd(j.endKey, tz),
    startKey: j.startKey,
    endKey: j.endKey,
  };
}


function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export async function computeCreatives(
  userId: string,
  opts: {
    period: CreativePeriod;
    /** Apenas para `period: "custom"`. */
    from?: string;
    to?: string;
    sort: CreativeSort;
    /** Área de Trabalho ATIVA — só o id. Ver `lib/areas/precedencia.ts`. */
    workspaceId?: string | null;
  },
): Promise<CreativeRow[]> {
  const tz = await getUserTimezone(userId);
  const { start, end, startKey, endKey } = janela(opts, tz);

  // Sem filtro de tela aqui: a área é a única fonte de recorte da aba Criativos.
  const mapa = await carregarMapaDeAreas(userId);
  const areaAtiva = mapa.areaValida(opts.workspaceId);
  const contaWhere = { id: { in: mapa.contasDaArea(areaAtiva) } };

  const [ads, metrics, sales] = await Promise.all([
    prisma.ad.findMany({
      where: { adAccount: { userId, ...contaWhere }, creative: { isNot: null } },
      select: {
        id: true,
        fbAdId: true,
        name: true,
        status: true,
        effectiveStatus: true,
        campaign: { select: { name: true } },
        creative: { select: { name: true, title: true, thumbnailUrl: true, imageUrl: true, videoId: true } },
      },
    }),
    prisma.dailyAdMetric.findMany({
      where: {
        date: { gte: keyToDateColumn(startKey), lte: keyToDateColumn(endKey) },
        ad: { adAccount: { userId, ...contaWhere } },
      },
      // `date` entrou em 12/08 para partir a janela ao meio (aba `Em queda`).
      // Os totais continuam somando TODAS as linhas — nada mudou de valor.
      select: { adId: true, date: true, spend: true, impressions: true, clicks: true },
    }),
    // Vendas aprovadas no período; atribuídas ao anúncio por utm_content → nome.
    prisma.sale.findMany({
      where: {
        userId,
        status: "APROVADA",
        timestamp: { gte: start, lte: end },
      },
      // `CAMPOS_UTM` nas duas pontas: `click` é a fonte, as colunas na venda são
      // a cópia para quando o clique some (`clickId` é `SetNull`).
      select: { id: true, pedidoId: true, value: true, product: true, webhookId: true, apiCredentialId: true, ...CAMPOS_UTM, click: { select: { ...CAMPOS_UTM, workspaceId: true } } },
    }),
  ]);

  // Pertinência de área: a venda chega pela atribuição, não por FK de conta.
  const vendasDaArea = sales.filter((v) => mapa.areaDaVenda(v).areaId === areaAtiva);

  const metByAd = new Map<string, { spend: number; impressions: number; clicks: number }>();
  for (const m of metrics) {
    const cur = metByAd.get(m.adId) ?? { spend: 0, impressions: 0, clicks: 0 };
    cur.spend += num(m.spend);
    cur.impressions += m.impressions;
    cur.clicks += m.clicks;
    metByAd.set(m.adId, cur);
  }

  /* ── As duas metades da janela ────────────────────────────────────────────
     O corte sai das CHAVES de dia (`startKey`/`endKey`), nunca de `Date.now()`
     nem do dia do processo: as duas pontas ja vieram do fuso do usuario, e
     recalcular aqui reintroduziria a janela das 21h.

     ⚠️ Janela de 1 dia da metades de 0 e 1 dia. Isso NAO e defeito — e o
     estado "nao ha o que comparar", e quem o transforma em decisao e
     `tendenciaDoCriativo`, que exige observacao dos DOIS lados. */
  const cru = (k: string) => Number(k.replace(/-/g, ""));
  const diasDaJanela = metrics.length ? [...new Set(metrics.map((m) => dayKeyInTz(m.date, "UTC")))].sort() : [];
  // A coluna e `@db.Date`: o valor chega a meia-noite UTC, entao a chave sai em
  // UTC de proposito — converter para o fuso do usuario deslocaria o dia.
  const corte = diasDaJanela.length ? cru(diasDaJanela[Math.floor(diasDaJanela.length / 2)]) : Infinity;

  const vazia = (): MetadeDaJanela => ({ spend: 0, impressions: 0, clicks: 0, ctr: null, dias: 0 });
  const metadesByAd = new Map<string, { anterior: MetadeDaJanela; recente: MetadeDaJanela }>();
  for (const m of metrics) {
    const par = metadesByAd.get(m.adId) ?? { anterior: vazia(), recente: vazia() };
    const lado = cru(dayKeyInTz(m.date, "UTC")) >= corte ? par.recente : par.anterior;
    lado.spend += num(m.spend);
    lado.impressions += m.impressions;
    lado.clicks += m.clicks;
    lado.dias += 1;
    metadesByAd.set(m.adId, par);
  }
  for (const par of metadesByAd.values()) {
    for (const lado of [par.anterior, par.recente]) {
      const b = div(lado.clicks, lado.impressions);
      lado.ctr = b === null ? null : b * 100;
    }
  }

  // Atribuição venda→anúncio: preferimos casar pelo id do Facebook extraído do
  // utm_content (`nome|id`, Bloco 11); caímos no nome para cliques antigos.
  const salesByAdId = new Map<string, { sales: number; revenue: number }>();
  const salesByName = new Map<string, { sales: number; revenue: number }>();
  // ⚠️ `sales` conta CONVERSÕES (pedidos distintos), `revenue` soma as linhas.
  // Ver a mesma decisão em `ads/overview.ts` e `lib/pedidos.ts`.
  const pedidosPorChave = new Map<string, Set<string>>();
  for (const s of vendasDaArea) {
    const { name, id } = splitPipe(utmsDaVenda(s).utms.utmContent);
    const bump = (map: Map<string, { sales: number; revenue: number }>, key: string, prefixo: string) => {
      const cur = map.get(key) ?? { sales: 0, revenue: 0 };
      const destino = `${prefixo}:${key}`;
      let vistos = pedidosPorChave.get(destino);
      if (!vistos) pedidosPorChave.set(destino, (vistos = new Set()));
      const chave = chaveDoPedido(s);
      if (!vistos.has(chave)) {
        vistos.add(chave);
        cur.sales += 1;
      }
      cur.revenue += num(s.value);
      map.set(key, cur);
    };
    if (id) bump(salesByAdId, id, "id");
    else if (name) bump(salesByName, name.toLowerCase(), "nome");
  }

  const rows: CreativeRow[] = ads.map((a) => {
    const met = metByAd.get(a.id) ?? { spend: 0, impressions: 0, clicks: 0 };
    // Cada venda cai em exatamente um mapa (por id se tiver, senão por nome),
    // então somamos os dois sem risco de contar a mesma venda duas vezes.
    const byId = salesByAdId.get(a.fbAdId);
    const byName = salesByName.get(a.name.toLowerCase());
    const attr = {
      sales: (byId?.sales ?? 0) + (byName?.sales ?? 0),
      revenue: (byId?.revenue ?? 0) + (byName?.revenue ?? 0),
    };
    /* Denominador zero é INDEFINIDO, não zero — mesmo contrato do resto da
       base. Sem impressão não existe CTR; sem gasto não existe ROAS. */
    const ctrBruto = div(met.clicks, met.impressions);
    const ctr = ctrBruto === null ? null : ctrBruto * 100;
    const roas = div(attr.revenue, met.spend);
    const metades = metadesByAd.get(a.id);
    return {
      id: a.id,
      name: a.creative?.title || a.creative?.name || a.name,
      campaign: a.campaign?.name ?? "—",
      thumbnailUrl: a.creative?.thumbnailUrl ?? a.creative?.imageUrl ?? null,
      format: a.creative?.videoId ? "Vídeo" : "Imagem",
      ctr,
      roas,
      spend: met.spend,
      sales: attr.sales,
      revenue: attr.revenue,
      best: false,
      effectiveStatus: a.effectiveStatus,
      status: a.status,
      impressions: met.impressions,
      clicks: met.clicks,
      cpc: div(met.spend, met.clicks),
      conversao: div(attr.sales, met.clicks),
      anterior: metades?.anterior ?? vazia(),
      recente: metades?.recente ?? vazia(),
    };
  });

  // "Melhor do dia" = maior ROAS entre os que tiveram gasto.
  // ⚠️ `roas === null` é justamente "não teve gasto", então o `spend > 0` que já
  // estava aqui e a checagem de nulo cobrem o mesmo caso — mantidos os dois: o
  // primeiro é a intenção declarada, o segundo é o que o tipo exige.
  let bestId: string | null = null;
  let bestRoas = 0;
  for (const r of rows) {
    if (r.spend > 0 && r.roas !== null && r.roas > bestRoas) {
      bestRoas = r.roas;
      bestId = r.id;
    }
  }
  if (bestId) rows.find((r) => r.id === bestId)!.best = true;

  /* ⛔ INDEFINIDO VAI PARA O FIM, sempre — nas duas direções que a lista
     oferece. Um `null` tratado como 0 pela subtração colocaria o criativo SEM
     GASTO no meio do ranking de ROAS, entre os que renderam pouco. Ele não
     rendeu pouco: ele não foi medido, e comparar com quem foi é a mesma
     confusão que este mapa inteiro existe para desfazer. */
  const sortKey = opts.sort;
  rows.sort((a, b) => {
    const x = a[sortKey];
    const y = b[sortKey];
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });

  return rows;
}
