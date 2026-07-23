import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/appUrl";
import { buildAuthUrl, facebookConfigured } from "@/lib/facebook/graph";

export async function GET() {
  const appUrl = getAppUrl();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl}/login`);

  if (!facebookConfigured()) {
    return NextResponse.redirect(`${appUrl}/dashboard?fb=not_configured`);
  }

  // State anti-CSRF, guardado em cookie httpOnly e conferido no callback.
  const state = randomUUID();
  const store = await cookies();
  store.set("fb_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl.startsWith("https"),
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
