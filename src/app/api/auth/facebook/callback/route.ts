import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/appUrl";
import {
  exchangeCodeForToken,
  getAdAccounts,
  getLongLivedToken,
  getMe,
  mapAccountStatus,
} from "@/lib/facebook/graph";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl();
  const dash = (status: string) => NextResponse.redirect(`${appUrl}/dashboard?fb=${status}`);

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl}/login`);
  const userId = session.user.id;

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");

  const store = await cookies();
  const stored = store.get("fb_oauth_state")?.value;
  store.delete("fb_oauth_state");

  if (oauthError) return dash("denied");
  if (!code || !state || !stored || state !== stored) return dash("state_error");

  try {
    const shortToken = await exchangeCodeForToken(code);
    const { token, expiresAt } = await getLongLivedToken(shortToken);
    const [me, accounts] = await Promise.all([getMe(token), getAdAccounts(token)]);

    const pictureUrl = me.picture?.data?.url ?? null;

    const profile = await prisma.adProfile.upsert({
      where: { userId_fbUserId: { userId, fbUserId: me.id } },
      update: { name: me.name, email: me.email ?? null, pictureUrl, accessToken: token, tokenExpiresAt: expiresAt },
      create: {
        userId,
        fbUserId: me.id,
        name: me.name,
        email: me.email ?? null,
        pictureUrl,
        accessToken: token,
        tokenExpiresAt: expiresAt,
      },
    });

    for (const a of accounts) {
      await prisma.adAccount.upsert({
        where: { userId_fbAccountId: { userId, fbAccountId: a.account_id } },
        update: {
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          status: mapAccountStatus(a.account_status),
          adProfileId: profile.id,
        },
        create: {
          userId,
          fbAccountId: a.account_id,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          status: mapAccountStatus(a.account_status),
          adProfileId: profile.id,
          trackingEnabled: true,
        },
      });
    }

    return dash("connected");
  } catch (e) {
    console.error("[facebook/callback]", e);
    return dash("error");
  }
}
