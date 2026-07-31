import type { NextRequest } from "next/server";
import { ipDaRequisicao } from "@/lib/geo/clientIp";
import { normalizarPais, resolverPais } from "@/lib/geo/pais";
import { classificarUserAgent } from "@/lib/bots/classificar";
import { resolverPaisDoClique } from "@/lib/geo/desempate";
import { splitPipe } from "@/lib/utm/parse";

import { prisma } from "@/lib/prisma";

// O pixel roda em sites de terceiros, então o endpoint precisa liberar CORS.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}


function str(v: unknown, max = 2048): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Países da segmentação da campanha do clique, pela união dos conjuntos dela.
 *
 * ⚠️ **União, não interseção.** Se um conjunto roda BR e outro roda MX, a
 * campanha alcança os dois — e um visitante de qualquer um deles é legítimo.
 * Interseção devolveria vazio e o desempate nunca dispararia.
 *
 * Casa por **id do Facebook** primeiro (formato `Nome|id` do Bloco 11) e cai no
 * nome quando o clique é antigo. Devolve `[]` quando nada casa: sem segmentação
 * conhecida, não há contradição possível.
 */
async function segmentacaoDaCampanha(userId: string, utmCampaign: string): Promise<string[]> {
  const { name, id } = splitPipe(utmCampaign);
  const where = id
    ? { fbCampaignId: id, adAccount: { userId } }
    : name
      ? { name, adAccount: { userId } }
      : null;
  if (!where) return [];

  const conjuntos = await prisma.adSet.findMany({
    where: { campaign: { is: where } },
    select: { geoCountries: true },
  });
  return [...new Set(conjuntos.flatMap((c) => c.geoCountries))];
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    // Aceita application/json e text/plain (sendBeacon envia como texto,
    // evitando o preflight de CORS).
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  // `account` é o ID público de rastreamento — usamos o próprio userId.
  const account = str(body.account ?? body.account_id, 191);
  if (!account) return json({ error: "account ausente." }, 400);

  const user = await prisma.user.findUnique({
    where: { id: account },
    select: { id: true },
  });
  if (!user) return json({ error: "Conta não encontrada." }, 404);

  // Área declarada pelo script instalado na página. **A posse é validada aqui**
  // — o `ws` chega do navegador do visitante e não é confiável. Área que não é
  // deste usuário, ou arquivada, é descartada em silêncio (o clique continua
  // sendo gravado; ele só cai na regra normal de atribuição).
  //
  // ⚠️ Script antigo não manda `ws` → fica NULO → comportamento idêntico ao de
  // antes. É o que torna a mudança aditiva.
  const wsBruto = str(body.ws ?? body.workspace, 191);
  const ws = wsBruto
    ? await prisma.workspace.findFirst({
        where: { id: wsBruto, userId: user.id, archived: false },
        select: { id: true },
      })
    : null;

  // Aqui quem faz a requisição É o visitante: o script roda no navegador dele.
  // Por isso o header da plataforma e o IP da conexão são dele — o oposto do
  // webhook, onde quem conecta é o servidor do gateway.
  const ip = ipDaRequisicao(req);
  const acceptLanguage = str(req.headers.get("accept-language"), 191);
  const utmCampaign = str(body.utm_campaign, 191);

  // ⚠️ O servidor vence o `country` do corpo: o corpo vem do navegador e é
  // forjável. Hoje nenhum script envia esse campo, mas a ordem tem de estar
  // certa antes de algum passar a enviar.
  const doHeaderOuIp = resolverPais((n) => req.headers.get(n), ip) ?? normalizarPais(str(body.country, 8));

  // Segmentação geográfica da campanha que trouxe este clique. É o que o
  // ANUNCIANTE configurou — a única fonte aqui que não é inferência nossa.
  //
  // ⚠️ Só consulta quando há campanha E há país do IP: sem os dois não existe
  // contradição possível, e esta é uma rota de escrita no caminho quente.
  const paisesDaCampanha =
    utmCampaign && doHeaderOuIp ? await segmentacaoDaCampanha(user.id, utmCampaign) : [];

  // Fuso do navegador (`Intl…timeZone`). Sinal geográfico direto e, desde a
  // ativação do desempate, o 3º da ordem — antes do idioma, porque diz onde a
  // pessoa está em vez de que língua ela fala.
  const timezone = str(body.tz ?? body.timezone, 64);

  const { pais: country, fonte: countrySource } = resolverPaisDoClique({
    paisDoIp: doHeaderOuIp,
    paisesDaCampanha,
    userAgent: req.headers.get("user-agent"),
    acceptLanguage,
    timezone,
  });

  // ⚠️ MARCA, não bloqueia: a linha é gravada de qualquer forma e as métricas é
  // que excluem `bot: true`. Recusar aqui apagaria um cliente sem rastro se a
  // classificação errasse — e a lista de padrões é heurística, não certeza.
  const userAgent = str(req.headers.get("user-agent"), 512);
  const robo = classificarUserAgent(userAgent);

  const click = await prisma.click.create({
    data: {
      userId: user.id,
      bot: robo.bot,
      botMotivo: robo.motivo,
      workspaceId: ws?.id ?? null,
      utmSource: str(body.utm_source, 191),
      utmMedium: str(body.utm_medium, 191),
      utmCampaign: str(body.utm_campaign, 191),
      utmContent: str(body.utm_content, 191),
      utmTerm: str(body.utm_term, 191),
      fbclid: str(body.fbclid, 512),
      gclid: str(body.gclid, 512),
      ttclid: str(body.ttclid, 512),
      url: str(body.url),
      referrer: str(body.referrer),
      country,
      countrySource,
      acceptLanguage,
      // ⚠️ Só chega de quem REINSTALOU o script — clique antigo tem a coluna
      // nula, e aí o desempate simplesmente pula este sinal.
      timezone,
      ip,
      userAgent,
    },
    select: { clickId: true },
  });

  return json({ ok: true, click_id: click.clickId });
}
