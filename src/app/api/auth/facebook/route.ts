import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/appUrl";
import { buildAuthUrl, facebookConfigured } from "@/lib/facebook/graph";

export async function GET(req: Request) {
  const appUrl = getAppUrl();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl}/login`);

  if (!facebookConfigured()) {
    return NextResponse.redirect(`${appUrl}/dashboard?fb=not_configured`);
  }

  // State anti-CSRF, guardado em cookie httpOnly e conferido no callback.
  const state = randomUUID();
  const store = await cookies();

  // Área em que o usuário clicou "Conectar perfil". As contas descobertas
  // nascem vinculadas a ela — sem isto o passo termina e a vitrine da área
  // continua vazia, porque conta nova nasce sem dono.
  //
  // ⚠️ Viaja em COOKIE httpOnly, não no `state` da URL: o `state` volta do
  // Facebook e é atacável, e ele já tem a função de anti-CSRF. A posse da área
  // ainda é validada no callback pelo `userId`.
  const ws = new URL(req.url).searchParams.get("ws");
  if (ws) {
    store.set("fb_oauth_ws", ws, {
      httpOnly: true, sameSite: "lax", secure: appUrl.startsWith("https"), maxAge: 600, path: "/",
    });
  }

  store.set("fb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https"),
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
