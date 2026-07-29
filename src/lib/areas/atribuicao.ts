import { prisma } from "@/lib/prisma";

import { construirMapa, type MapaDeAreas } from "./precedencia";

/**
 * Casca de acesso a dados da atribuição por área.
 *
 * A **regra de precedência inteira** vive em `./precedencia.ts`, que é puro e
 * não importa nada de banco — é o que permite ao teste de regressão
 * (`scripts/teste-atribuicao-areas.mjs`) alimentá-lo com o backup REAL de
 * produção sem abrir conexão nenhuma. Leia lá a documentação da precedência.
 *
 * ⚠️ Nenhum destes módulos é `"use server"`, de propósito: eles rodam em rota
 * de API, em cron e no motor de regras — contextos sem request. Pô-los em
 * `actions/` arrastaria o NextAuth para dentro deles, mesmo motivo pelo qual
 * `userTimezone.ts` não vive em `actions/profile.ts`.
 */
export * from "./precedencia";

/**
 * Carrega tudo o que a precedência precisa, em UMA rodada de consultas.
 *
 * ⚠️ Não recebe `workspaceId`: o mapa é do USUÁRIO inteiro, porque decidir de
 * quem é uma linha exige saber o que **todas** as áreas reivindicam. Quem sabe
 * qual área está ativa é quem chama.
 */
export async function carregarMapaDeAreas(userId: string): Promise<MapaDeAreas> {
  const [areas, contas, webhooks, pixels, credenciais, campanhas] = await Promise.all([
    prisma.workspace.findMany({
      where: { userId },
      select: { id: true, name: true, isDefault: true, archived: true, produtosDesempate: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.adAccount.findMany({ where: { userId }, select: { id: true, workspaceId: true } }),
    prisma.webhook.findMany({ where: { userId }, select: { id: true, workspaceId: true } }),
    prisma.pixelConfig.findMany({ where: { userId }, select: { id: true, workspaceId: true } }),
    prisma.apiCredential.findMany({ where: { userId }, select: { id: true, workspaceId: true } }),
    prisma.campaign.findMany({
      where: { adAccount: { userId } },
      select: { fbCampaignId: true, name: true, adAccountId: true },
    }),
  ]);

  return construirMapa({ areas, contas, webhooks, pixels, credenciais, campanhas });
}
