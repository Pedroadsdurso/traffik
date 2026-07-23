import type { NextRequest } from "next/server";

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

function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

function str(v: unknown, max = 2048): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
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

  const click = await prisma.click.create({
    data: {
      userId: user.id,
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
      country: str(body.country, 8),
      ip: clientIp(req),
      userAgent: str(req.headers.get("user-agent"), 512),
    },
    select: { clickId: true },
  });

  return json({ ok: true, click_id: click.clickId });
}
