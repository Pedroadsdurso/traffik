import { decryptSecretSafe } from "@/lib/crypto/secrets";
import { sendPurchaseEvent } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";
import { traffikEnvia } from "@/lib/pixel/donos";
import {
  CAPI_ENVIADO,
  CAPI_ERRO,
  CAPI_OUTRO_DONO,
  CAPI_REGRA,
  CAPI_SEM_PIXEL,
  CAPI_SEM_TOKEN,
  mensagemCurta,
} from "@/lib/webhook/efeitos";
import { marcarEfeito } from "@/lib/webhook/marcarEfeito";

/**
 * Força dos desfechos, do mais benigno ao mais grave.
 *
 * 🔴 Uma venda passa por N pixels × M pixels da Meta, e cada um pode terminar
 * diferente. A coluna guarda UM valor, então **o pior vence** — se um pixel
 * enviou e outro foi recusado, a venda não está resolvida, e um `enviado` ali
 * esconderia justamente a metade que precisa de ação.
 *
 * ⚠️ Errar para o lado do alarme aqui é barato (o usuário confere e vê que um
 * dos pixels foi); errar para o lado do silêncio é o bug que estamos matando.
 */
const FORCA: Record<string, number> = {
  [CAPI_OUTRO_DONO]: 0,
  [CAPI_REGRA]: 1,
  [CAPI_SEM_PIXEL]: 2,
  [CAPI_ENVIADO]: 3,
  [CAPI_SEM_TOKEN]: 4,
  [CAPI_ERRO]: 5,
};

/**
 * Após uma venda ser salva pelo webhook, dispara o evento Purchase para a
 * Conversions API de cada pixel configurado do usuário (respeitando as regras).
 * Nunca lança — falhas são registradas mas não quebram o webhook.
 *
 * 🔴 Toda saída aqui era muda, e a mais cara é `sem_token`: o pixel existe, a
 * regra está ligada, a tela diz "Ativo" — e `decryptSecretSafe` devolve vazio,
 * o `continue` roda, e **nenhuma venda chega ao Facebook**. Sem erro, sem log
 * que alguém leia. Agora o desfecho vai para `Sale.capiStatus`; ver `efeitos.ts`.
 */
export async function dispatchPurchaseEvents(saleId: string): Promise<void> {
  /**
   * ⚠️ Só é gravado no fim, uma vez. Marcar dentro do laço faria a última
   * iteração apagar o veredicto das anteriores.
   *
   * ⚠️ Começa em `null`, não em `sem_pixel`: `outro_dono` é o desfecho mais
   * fraco da escala, e partir de um valor com força 2 o descartaria em silêncio
   * — a venda de quem configurou a partição corretamente apareceria como
   * "nenhum pixel configurado". `null` significa "nenhum pixel foi sequer
   * considerado", que é a única situação em que `sem_pixel` é verdade.
   */
  let pior: string | null = null;
  let erro: string | null = null;
  const registrar = (status: string, detalhe?: string | null) => {
    if (pior === null || FORCA[status] > FORCA[pior]) {
      pior = status;
      erro = detalhe ?? null;
    }
  };
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        userId: true,
        value: true,
        currency: true,
        product: true,
        status: true,
        buyerEmail: true,
        buyerPhone: true,
        country: true,
        fbc: true,
        fbp: true,
        click: { select: { fbclid: true, ip: true, userAgent: true, url: true, timestamp: true } },
      },
    });
    if (!sale) return;

    const pixels = await prisma.pixelConfig.findMany({
      where: {
        userId: sale.userId,
        enabled: true,
        eventRules: { some: { eventType: "PURCHASE", enabled: true } },
      },
      include: { eventRules: { where: { eventType: "PURCHASE" } }, metaPixels: true },
    });

    for (const px of pixels) {
      // Purchase é o caso que mais dói: com o pixel do gateway disparando na
      // página de obrigado E a nossa CAPI disparando pelo webhook, a Meta
      // conta a conversão duas vezes e otimiza a campanha com sinal inflado.
      if (!traffikEnvia(px.eventOwners, "Purchase")) {
        registrar(CAPI_OUTRO_DONO);
        continue;
      }
      const rule = px.eventRules[0];
      if (!rule || !rule.enabled) {
        registrar(CAPI_REGRA);
        continue;
      }
      if (rule.sendMode === "APENAS_APROVADAS" && sale.status !== "APROVADA") {
        registrar(CAPI_REGRA);
        continue;
      }
      if (rule.targetProduct && rule.targetProduct.trim() && rule.targetProduct.toLowerCase() !== sale.product.toLowerCase()) {
        registrar(CAPI_REGRA);
        continue;
      }
      const value = rule.valueMode === "VALOR_FIXO" ? Number(rule.fixedValue ?? 0) : Number(sale.value);

      // Dispara para cada pixel da Meta com token (fallback ao legado da Fase 10).
      const targets =
        px.metaPixels.length > 0
          ? px.metaPixels
          : px.pixelId
            ? [{ pixelId: px.pixelId, accessToken: px.accessToken }]
            : [];

      // Pixel da Trackhub cadastrado, regra ligada, e NENHUM pixel da Meta
      // dentro dele: nada para onde enviar. A tela mostra "0 pixels da Meta",
      // mas nada ligava isso à venda que não foi.
      if (targets.length === 0) registrar(CAPI_SEM_TOKEN);

      for (const mp of targets) {
        // O token fica encriptado no banco; decripta só aqui, para a chamada.
        const accessToken = decryptSecretSafe(mp.accessToken);
        if (!accessToken) {
          // 🔴 O `continue` mais caro do arquivo: o pixel aparece "Ativo" na
          // tela e nenhuma venda sai, para sempre.
          registrar(CAPI_SEM_TOKEN);
          continue;
        }
        const result = await sendPurchaseEvent({
          pixelId: mp.pixelId,
          accessToken,
          value,
          currency: sale.currency,
          /**
           * 🔴 Isto NÃO deduplica com o pixel do navegador — e o comentário que
           * estava aqui afirmava que sim, desde o primeiro commit do pixel
           * (`f62d2db`, Fase 10).
           *
           * `sale.id` é um cuid do NOSSO banco. Nenhum pixel de navegador — nem
           * o do usuário, nem o do gateway — consegue gerar esse id, e o nosso
           * script nunca dispara `Purchase` (a rota `/api/pixel/event` o recusa).
           * Então nunca houve par para a Meta juntar: **a dedup do Purchase
           * jamais funcionou.** Não é regressão, é defeito de origem.
           *
           * O `event_id` continua sendo enviado porque serve para outra coisa,
           * essa sim real: a **idempotência do nosso lado**. Reentrega do mesmo
           * webhook reenvia o mesmo id, e a Meta descarta a repetição.
           *
           * Quem resolve a contagem dobrada é a PARTIÇÃO — `traffikEnvia` acima,
           * alimentada pela pergunta do preset. Ver `lib/pixel/preset.ts`.
           */
          eventId: sale.id,
          email: sale.buyerEmail,
          phone: sale.buyerPhone,
          country: sale.country,
          fbclid: sale.click?.fbclid,
          // O cookie REAL que o gateway mandou, quando houver.
          fbc: sale.fbc,
          fbp: sale.fbp,
          // Instante do CLIQUE, para reconstruir o `_fbc` com o timestamp certo
          // quando o gateway não manda o cookie.
          fbclidEm: sale.click ? Math.floor(sale.click.timestamp.getTime() / 1000) : null,
          clientIp: sale.click?.ip,
          clientUserAgent: sale.click?.userAgent,
          eventSourceUrl: sale.click?.url,
        });
        if (result.ok) {
          registrar(CAPI_ENVIADO);
        } else {
          console.error(`[CAPI] pixel ${mp.pixelId}: ${result.error}`);
          // O texto vai CRU para a coluna, com o pixel na frente: a mensagem da
          // Meta sozinha não diz de qual pixel ela é, e o usuário pode ter
          // vários. A tradução para linguagem de tela é da view.
          registrar(CAPI_ERRO, mensagemCurta(`pixel ${mp.pixelId}: ${result.error ?? "sem mensagem"}`));
        }
      }
    }
    await marcarEfeito(saleId, "capi", pior ?? CAPI_SEM_PIXEL, erro);
  } catch (e) {
    console.error("[dispatchPurchaseEvents]", e);
    await marcarEfeito(saleId, "capi", CAPI_ERRO, mensagemCurta(e));
  }
}
