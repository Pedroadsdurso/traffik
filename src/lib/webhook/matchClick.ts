import { prisma } from "@/lib/prisma";
import { candidatosDeIp } from "@/lib/geo/anonimizarIp";
import { fbclidDoFbc } from "@/lib/gateways/campos";

export interface ClickMatch {
  clickId: string | null; // Click.id (cuid) para o FK, não o uuid público
  method: "direct" | "fbclid" | "ip" | "none";
  /**
   * País do clique casado, quando houver.
   *
   * O clique é o ÚNICO ponto do fluxo em que o visitante fala direto conosco —
   * é o IP dele que chega ali. No webhook quem conecta é o gateway, então esta
   * é a melhor evidência de país que a venda tem quando o payload não traz uma.
   */
  country: string | null;
}

/** Janela de fallback por IP: cliques nas últimas 12h contam como origem. */
const IP_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Encontra o clique de origem de uma venda.
 *
 * | # | Via | O que prova |
 * |---|---|---|
 * | 1 | `click_id` público | o NOSSO script propagou o id até o checkout. Identifica a SESSÃO, sem janela de tempo |
 * | 2 | **`fbc` → `fbclid`** | identifica o CLIQUE NO ANÚNCIO. Igualmente exato; só não prova que o checkout propagou o nosso id |
 * | 3 | IP do payload | inferência frouxa, dentro de 12h |
 *
 * > ### ⚠️ Por que o `click_id` continua vencendo o `fbc`
 * > Os dois identificam a mesma pessoa, mas o `click_id` é emitido por nós e
 * > sobrevive a um visitante que voltou pelo anúncio duas vezes — mesmo
 * > `fbclid`, sessões diferentes.
 * >
 * > ### 🔴 Para a Cakto, o `fbc` é a via PRINCIPAL
 * > Ela **não manda o IP do comprador**, então sem esta via a venda dela
 * > dependeria só do `click_id` — e cairia no nada quando o checkout não o
 * > propagasse.
 */
export async function matchClick(
  userId: string,
  publicClickId: string | null,
  ip: string | null,
  fbc?: string | null,
): Promise<ClickMatch> {
  if (publicClickId) {
    const click = await prisma.click.findFirst({
      where: { userId, clickId: publicClickId },
      select: { id: true, country: true },
    });
    if (click) return { clickId: click.id, method: "direct", country: click.country };
  }

  // 2) Pelo `_fbc` que o gateway devolveu: o último segmento é o `fbclid`.
  const fbclid = fbclidDoFbc(fbc ?? null);
  if (fbclid) {
    const click = await prisma.click.findFirst({
      // ⚠️ `bot: false` pelo mesmo motivo do match por IP: robô não compra, e a
      // venda herdaria o país do datacenter dele.
      where: { userId, fbclid, bot: false },
      orderBy: { timestamp: "desc" },
      select: { id: true, country: true },
    });
    if (click) return { clickId: click.id, method: "fbclid", country: click.country };
  }

  if (ip) {
    const click = await prisma.click.findFirst({
      // ⚠️ Robô não compra. Casar uma venda com um clique de crawler faria a
      // venda herdar o país do datacenter dele — e o match por IP é justamente
      // o caminho mais frouxo, onde isso aconteceria em silêncio.
      //
      // ⚠️ `in` com os DOIS valores possíveis (em claro e anonimizado): o
      // clique pode já ter passado pela purga progressiva. Hoje isso é redundante
      // — a janela de 12h está muito dentro da retenção de 7 dias —, mas se
      // alguém baixar a retenção ou ampliar a janela, o match para de casar SEM
      // erro nenhum. É exatamente o modo de falha que esta linha existe para evitar.
      where: {
        userId,
        ip: { in: candidatosDeIp(ip) },
        bot: false,
        timestamp: { gte: new Date(Date.now() - IP_WINDOW_MS) },
      },
      orderBy: { timestamp: "desc" },
      select: { id: true, country: true },
    });
    if (click) return { clickId: click.id, method: "ip", country: click.country };
  }

  return { clickId: null, method: "none", country: null };
}
