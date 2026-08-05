import { cookies } from "next/headers";
import { NextResponse, after, type NextRequest } from "next/server";

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
import { syncUser } from "@/lib/facebook/sync";

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl();
  let areaDestino: string | null = null;
  // Volta para a MESMA área de onde o usuário saiu. Sem isto ele cairia na
  // área lembrada, que pode não ser a que ele estava configurando.
  const dash = (status: string) =>
    NextResponse.redirect(
      `${appUrl}/dashboard/integracoes/anuncios?fb=${status}${areaDestino ? `&ws=${encodeURIComponent(areaDestino)}` : ""}`,
    );

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl}/login`);
  const userId = session.user.id;

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oauthError = sp.get("error");

  const store = await cookies();
  const stored = store.get("fb_oauth_state")?.value;
  const wsCookie = store.get("fb_oauth_ws")?.value ?? null;
  store.delete("fb_oauth_state");
  store.delete("fb_oauth_ws");

  // Valida a POSSE da área antes de vincular qualquer conta a ela: o cookie é
  // httpOnly, mas a área ainda tem de ser deste usuário e não estar arquivada.
  if (wsCookie) {
    const area = await prisma.workspace.findFirst({
      where: { id: wsCookie, userId, archived: false },
      select: { id: true },
    });
    areaDestino = area?.id ?? null;
  }

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

    // Contas que JÁ existem não mudam de área aqui — reconectar um perfil não
    // pode arrastar em silêncio uma conta que já pertence a outra área. Só as
    // criadas agora nascem na área de onde o usuário clicou.
    const jaExistiam = new Set(
      (
        await prisma.adAccount.findMany({
          where: { userId, fbAccountId: { in: accounts.map((a) => a.account_id) } },
          select: { fbAccountId: true },
        })
      ).map((a) => a.fbAccountId),
    );

    for (const a of accounts) {
      await prisma.adAccount.upsert({
        where: { userId_fbAccountId: { userId, fbAccountId: a.account_id } },
        update: {
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          status: mapAccountStatus(a.account_status),
            // Codigo CRU da Meta, ao lado do enum reduzido. E ele que diz
            // DESABILITADA vs PAUSADA -- o enum colapsa os dois.
            accountStatus: a.account_status ?? null,
          adProfileId: profile.id,
        },
        create: {
          userId,
          fbAccountId: a.account_id,
          name: a.name,
          currency: a.currency,
          timezone: a.timezone_name ?? null,
          status: mapAccountStatus(a.account_status),
            // Codigo CRU da Meta, ao lado do enum reduzido. E ele que diz
            // DESABILITADA vs PAUSADA -- o enum colapsa os dois.
            accountStatus: a.account_status ?? null,
          adProfileId: profile.id,
          trackingEnabled: true,
          workspaceId: jaExistiam.has(a.account_id) ? null : areaDestino,
        },
      });
    }

    /**
     * ⛔ Reconectar ZERA o backoff das contas deste perfil.
     *
     * Sem isto, quem acabou de arrumar a permissão ficaria até 2h esperando a
     * próxima tentativa — e concluiria que reconectar não resolveu, indo mexer
     * de novo no que já estava certo. O ato de reconectar é a evidência de que
     * a causa mudou; o contador antigo deixa de valer.
     */
    await prisma.adAccount.updateMany({
      where: { userId, adProfileId: profile.id },
      data: { lastSyncError: null, lastSyncErrorAt: null, syncErrorCount: 0 },
    });
    await prisma.adProfile.updateMany({
      where: { id: profile.id },
      data: { lastDiscoveryError: null, lastDiscoveryErrorAt: null },
    });

    /**
     * Dispara o primeiro ciclo completo AGORA, sem esperar o polling.
     *
     * Conectar é exatamente o momento em que a pessoa está olhando a tela — e
     * o auto-sync só roda quando há requisição do painel. Sem isto, quem
     * conecta e fecha a aba fica dependendo do cron (15 min, best-effort).
     *
     * ⚠️ Vai no `after()`: são 4 chamadas à Graph por conta e o usuário não
     * pode esperar isso no redirect.
     *
     * ⚠️ Se estourar o tempo e morrer aqui, **nada se perde**:
     * `backfillFeitoEm` continua nulo e o próximo ciclo (painel ou cron) refaz.
     * É o que torna esta chamada uma otimização, não uma dependência.
     */
    after(async () => {
      try {
        await syncUser(userId, 30);
      } catch (e) {
        console.error("[facebook/callback] primeira sincronização:", e);
      }
    });

    return dash("connected");
  } catch (e) {
    console.error("[facebook/callback]", e);
    return dash("error");
  }
}
