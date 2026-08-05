import type { NextRequest } from "next/server";
import { ipDaRequisicao } from "@/lib/geo/clientIp";

import { decryptSecretSafe } from "@/lib/crypto/secrets";
import { sendServerEvent, type CapiEventName } from "@/lib/facebook/capi";
import { prisma } from "@/lib/prisma";
import { ambienteDaUrl, ambientePorPadraoAprovado, lerPadroes } from "@/lib/pixel/ambiente";
import { traffikEnvia } from "@/lib/pixel/donos";
import { marcarCheckoutDaJornada } from "@/lib/funil/checkoutDaJornada";
import { matchClick } from "@/lib/webhook/matchClick";
import type { PixelEventType } from "@/generated/prisma/enums";

// Chamado a partir do script instalado em sites de terceiros → CORS liberado.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Eventos que dependem de uma regra habilitada na aba Pixel. `PageView` NÃO
 * entra aqui de propósito: é o evento base do pixel, sempre ativo, e não existe
 * `PAGE_VIEW` no enum `PixelEventType` — tratá-lo como regra exigiria migration
 * para nada, já que não há o que configurar.
 */
const EVENT_MAP: Record<string, { capi: CapiEventName; rule: PixelEventType }> = {
  Lead: { capi: "Lead", rule: "LEAD" },
  AddToCart: { capi: "AddToCart", rule: "ADD_TO_CART" },
  InitiateCheckout: { capi: "InitiateCheckout", rule: "INITIATE_CHECKOUT" },
};

/**
 * Estados do espelho no pixel nativo que o script sabe reportar. Valor fora
 * desta lista vira `null` — a rota é pública, então nada que chega por ela pode
 * ir cru para uma coluna.
 */
const ESPELHOS: readonly string[] = [
  "ok",
  "adiado",
  "adiado-ok",
  "sem-fbq",
  "erro",
  "alheio",
  // "não há pixel nativo nesta página" — configuração legítima, não falha.
  // Separado de `sem-fbq`, que é erro de ordem de instalação.
  "sem-nativo",
];
const lerEspelho = (v: unknown): string | null =>
  typeof v === "string" && ESPELHOS.includes(v) ? v : null;

/**
 * Assinatura dos detectores do script instalado (`lib/pixel/detectores.ts`).
 *
 * Aceita qualquer string curta, de propósito: a assinatura tem versão embutida,
 * e um formato que esta rota não reconhece é EXATAMENTE o caso que a gaveta
 * precisa exibir ("script de uma versão anterior"). Validar contra o formato
 * atual aqui transformaria snippet velho em snippet invisível — o contrário do
 * que esta coluna existe para fazer. O teto de 120 caracteres é só para a rota
 * pública não escrever texto arbitrário sem limite numa coluna.
 */
const lerDetectores = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 && v.length <= 120 ? v : null;


/**
 * Recebe um evento do script de pixel próprio (Lead/AddToCart/InitiateCheckout)
 * e repassa para a Conversions API de cada pixel da Meta do config, se a regra
 * do evento estiver habilitada. Purchase NÃO passa aqui (é server-side no webhook).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const t = await req.text();
    body = t ? JSON.parse(t) : {};
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const configId = typeof body.pixelConfigId === "string" ? body.pixelConfigId : null;
  const eventKey = typeof body.event === "string" ? body.event : "";
  const mapped = EVENT_MAP[eventKey];
  const isPageView = eventKey === "PageView";
  if (!configId || (!mapped && !isPageView)) return json({ error: "Parâmetros inválidos." }, 400);

  const idDoEvento = typeof body.eventId === "string" ? body.eventId : null;
  const espelho = lerEspelho(body.espelho);

  /**
   * Relato TARDIO do espelho: o evento já foi gravado numa chamada anterior, e
   * o script só agora sabe se o `fbq` apareceu. Atualiza a coluna de
   * diagnóstico e para.
   *
   * ⛔ Não grava linha nova e **não reenvia para a CAPI** — o envio server-side
   * já aconteceu na primeira chamada. Sem este desvio, todo evento que
   * esperasse pelo `fbq` mandaria o Purchase/Lead duas vezes para a Meta, que é
   * exatamente o problema que este trabalho existe para resolver.
   *
   * Superfície: a rota é pública por desenho (roda no site do cliente), e o
   * pior uso indevido daqui é escrever um dos seis rótulos de `ESPELHOS` numa
   * linha cujo `eventId` o autor já conhece. É coluna de diagnóstico, não de
   * negócio — nenhuma métrica, nenhum envio e nenhum valor dependem dela.
   */
  if (body.somenteEspelho === true) {
    if (!espelho || !idDoEvento) return json({ error: "Parâmetros inválidos." }, 400);
    const r = await prisma.pixelEvent.updateMany({
      where: { pixelConfigId: configId, event: eventKey, eventId: idDoEvento },
      data: { espelho },
    });
    return json({ ok: true, espelho, atualizados: r.count });
  }

  const config = await prisma.pixelConfig.findUnique({
    where: { id: configId },
    include: {
      // Os padrões aprovados viajam no MESMO `include` — nenhuma ida extra ao
      // banco neste caminho, que é público e quente.
      user: { select: { testHostPatterns: true } },
      metaPixels: true,
      eventRules: mapped ? { where: { eventType: mapped.rule } } : false,
    },
  });
  if (!config || !config.enabled) return json({ error: "Pixel não encontrado." }, 404);

  if (mapped) {
    const rule = config.eventRules[0];
    if (!rule?.enabled) return json({ ok: true, skipped: "regra desabilitada" });
  }

  const capiEvent: CapiEventName = mapped ? mapped.capi : "PageView";

  // Persiste o evento (Bloco 5): sem isto o funil não tem como contar o
  // "Initiate Checkout" — antes o evento só era repassado à CAPI e descartado.
  // Falhar aqui não pode impedir o envio, que é o que o usuário realmente quer.
  //
  // ⚠️ `createMany({ skipDuplicates: true })` e não `create`: com o `eventId`
  // determinístico, duas cópias do script na mesma página (ou um reenvio)
  // mandam o MESMO id, e o índice único parcial recusa a segunda. O
  // `ON CONFLICT DO NOTHING` resolve isso no banco, sem `try/catch` engolindo
  // erro de verdade — mesmo padrão do upsert monotônico de vendas e da trava do
  // auto-sync: quem decide o vencedor é o banco.
  const urlDoEvento = typeof body.url === "string" ? body.url.slice(0, 500) : null;
  /**
   * 🔴 Ambiente de origem, derivado da URL — o usuário não configura nada.
   *
   * Ele cola o snippet e pronto: deploy preview, localhost e túnel de
   * desenvolvimento se identificam pelo **formato reservado do host**
   * (`<hash>--<site>.netlify.app`, `-git-…vercel.app`, `localhost`), não por
   * palpite sobre o hospedeiro. Ver `lib/pixel/ambiente.ts`.
   */
  const porFormato = ambienteDaUrl(urlDoEvento);
  // Depois do contrato de plataforma vem a lista que o usuário APROVOU. Nesta
  // ordem de propósito: `FORMATOS` é contrato, a lista é escolha — se um dia
  // discordarem, quem manda é o contrato.
  //
  // ⚠️ Casar o molde não basta: `ambientePorPadraoAprovado` ainda exige que o
  // segmento variável pareça hash. Aprovar amplia o alcance da regra, nunca
  // afrouxa o teste que a torna confiável — bloquear é irreversível.
  const { ambiente } =
    porFormato.ambiente !== null
      ? porFormato
      : ambientePorPadraoAprovado(urlDoEvento, lerPadroes(config.user?.testHostPatterns));

  /**
   * A JORNADA deste evento, pela MESMA precedência das vendas.
   *
   * > ### 🔴 `fbclid` era a chave errada, e é a causa raiz do checkout duplicado
   * > Ele **só existe para tráfego de anúncio do Facebook**. Em tráfego direto o
   * > evento do navegador ficava sem chave nenhuma, a dedup contra o evento do
   * > gateway era pulada, e a MESMA jornada aparecia duas vezes no funil.
   * >
   * > `matchClick` resolve por `click_id` (o id que o NOSSO `t.js` guarda no
   * > cookie) → `fbclid` → IP. Reusar a função das vendas, em vez de escrever uma
   * > segunda resolução aqui, é o que impede as duas de divergirem.
   *
   * ⚠️ **O `click_id` sempre esteve disponível e era jogado no lixo:** o `px.js`
   * lê o cookie `traffik_track` para pegar o `fbclid` e descartava o `click_id`
   * que estava do lado. Agora ele manda — e o caminho por IP cobre quem ainda não
   * recolou o snippet.
   */
  const jornada = await matchClick(
    config.userId,
    typeof body.click_id === "string" ? body.click_id : null,
    ipDaRequisicao(req),
    typeof body.fbclid === "string" ? `fb.1.0.${body.fbclid}` : null,
  );

  try {
    await prisma.pixelEvent.createMany({
      data: [
        {
          userId: config.userId,
          pixelConfigId: config.id,
          event: eventKey,
          eventId: idDoEvento,
          url: urlDoEvento,
          fbclid: typeof body.fbclid === "string" ? body.fbclid : null,
          // A jornada vai na LINHA. Derivá-la por `fbclid` na leitura era o
          // defeito: sem `fbclid` não havia como ligar o evento a nada.
          clickId: jornada.clickId,
          espelho,
          detectores: lerDetectores(body.det),
          ambiente,
        },
      ],
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("[pixel/event] falha ao persistir evento:", e);
  }

  /**
   * ⛔ AQUI o pixel para de ser dono do funil.
   *
   * O `PixelEvent` acima é o registro do que foi **despachado** (com `espelho`,
   * `detectores`, `ambiente`) — é disso que o diagnóstico da gaveta vive. A etapa
   * do FUNIL é marcada na jornada, que é território do rastreamento.
   *
   * ⚠️ **Ambiente efêmero não marca o funil**, pela mesma razão que não vai para a
   * Meta: um checkout de `localhost` não é checkout de cliente. O evento fica
   * gravado e contável; só não entra no relatório.
   *
   * ⚠️ Sem jornada resolvida não há o que marcar. O evento continua gravado, e o
   * funil tem um caminho separado para checkout não atribuível — ver
   * `lib/funil/checkoutDaJornada.ts`.
   */
  if (eventKey === "InitiateCheckout" && jornada.clickId && !ambiente) {
    await marcarCheckoutDaJornada(jornada.clickId, new Date(), "navegador");
  }

  /**
   * ⛔ Ambiente efêmero NÃO vai para a Meta.
   *
   * Um Purchase de `localhost` ensina a otimização a procurar ninguém, e é a
   * metade cara do problema — o número na tela se conserta relendo o banco, o
   * sinal já entregue à Meta não. É o único ponto em que a detecção tem efeito
   * irreversível, e é justamente onde os formatos são mais inequívocos:
   * nenhuma loja atende em `localhost`.
   *
   * O evento **fica gravado** (linha acima), marcado e contável. Se a detecção
   * errar, aparece na contagem da tela e um `UPDATE` desfaz.
   */
  if (ambiente) {
    return json({ ok: true, registrado: true, enviado: false, motivo: "ambiente de teste", ambiente });
  }

  // 🔴 O evento JÁ FOI GRAVADO acima — o funil e o Dashboard contam do nosso
  // banco. O dono decide só quem fala com a Meta: com o pixel do gateway
  // mandando o mesmo evento, os dois chegariam com `event_id` diferentes e
  // ela contaria em dobro. Ver `lib/pixel/donos.ts`.
  if (!traffikEnvia(config.eventOwners, eventKey)) {
    return json({ ok: true, registrado: true, enviado: false, motivo: "outro dono" });
  }

  const targets =
    config.metaPixels.length > 0
      ? config.metaPixels
      : config.pixelId
        ? [{ pixelId: config.pixelId, accessToken: config.accessToken }]
        : [];

  // 🔴 É ESTE valor que a Meta usa para casar o evento do navegador com o
  // nosso. O script manda o mesmo id para o `fbq` e para cá — se as duas pontas
  // divergirem, a Meta conta o evento DUAS VEZES e otimiza com sinal inflado.
  // O fallback só existe para um `traffikPixel.track()` manual sem id.
  const eventId = idDoEvento ?? `${eventKey}-${Date.now()}`;
  let sent = 0;
  for (const mp of targets) {
    // O token fica encriptado no banco; decripta só aqui, para a chamada.
    const accessToken = decryptSecretSafe(mp.accessToken);
    if (!accessToken) continue;
    const r = await sendServerEvent({
      eventName: capiEvent,
      pixelId: mp.pixelId,
      accessToken,
      eventId,
      value: typeof body.value === "number" ? body.value : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      fbclid: typeof body.fbclid === "string" ? body.fbclid : undefined,
      eventSourceUrl: typeof body.url === "string" ? body.url : undefined,
      clientIp: ipDaRequisicao(req),
      clientUserAgent: req.headers.get("user-agent"),
    });
    if (r.ok) sent++;
    else console.error(`[CAPI] evento ${eventKey} pixel ${mp.pixelId}: ${r.error}`);
  }

  return json({ ok: true, event: eventKey, sent });
}
