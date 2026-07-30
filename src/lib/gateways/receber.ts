import type { NextRequest } from "next/server";

import { secretLookupHash } from "@/lib/crypto/secrets";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, ingestSale } from "@/lib/webhook/ingestSale";
import { finishWebhookLog, startWebhookLog } from "@/lib/webhook/logWebhook";

import { autenticar } from "./autenticar";
import type { GatewayDef } from "./contrato";
import { gatewayDoWebhook, REGISTRO } from "./registro";

/**
 * # O RECEPTOR UNIVERSAL
 *
 * Uma única função recebe evento de **qualquer** gateway. Ela não sabe o nome de
 * nenhum: pega o dono pelo token, pergunta ao registro qual é o gateway, e o
 * resto é dado.
 *
 * ## O que ela garante, para todo gateway presente e futuro
 *
 * 1. **O payload é gravado ANTES de qualquer validação.** Os recusados são
 *    justamente os que se precisa depurar — se o log viesse depois da
 *    autenticação, "meu gateway manda e não chega" ficaria sem nenhuma pista.
 *    JSON quebrado é guardado como `{"raw": "..."}` em vez de se perder.
 * 2. **Autenticação falha fechada**, pela estratégia declarada no registro.
 * 3. **Um payload pode virar N vendas** (order bump, upsell).
 * 4. **Nada lança para fora.** Uma exceção no meio do processamento vira 500
 *    com log, nunca um 500 mudo.
 *
 * ## ⏱️ Orçamento de tempo
 *
 * A Cakto considera falha de entrega se não respondermos em **5 segundos**. O
 * caminho até o 200 são ~6 idas ao banco (~99 ms cada em us-east-1): log, busca
 * do webhook, match do clique, upsert, contador, fecha log — folga larga.
 *
 * ⚠️ **O que não pode voltar para dentro do request:** a CAPI do Facebook e as
 * notificações já rodam no `after()` do Next 16, por isso não contam para esses
 * 5 s. Eles saíram dali justamente por segurar conexão do pool e alongar a
 * janela de disputa entre eventos concorrentes. Quem colocar chamada HTTP nova
 * no caminho síncrono devolve os dois problemas de uma vez.
 */

/** Dono resolvido de um evento — webhook do gateway ou chave de API. */
interface Dono {
  userId: string;
  webhookId?: string | null;
  apiCredentialId?: string | null;
  /** Segredo cadastrado, quando houver. */
  secret: string | null;
  def: GatewayDef;
  /** String gravada em `WebhookLog.gateway`. */
  rotuloLog: string;
}

interface Recusa {
  mensagem: string;
  status: number;
}

/** Lê o corpo uma vez só, tolerando JSON quebrado. */
async function lerCorpo(req: NextRequest): Promise<{ payload: Record<string, unknown> | null; texto: string }> {
  const texto = await req.text();
  try {
    return { payload: texto ? (JSON.parse(texto) as Record<string, unknown>) : {}, texto };
  } catch {
    return { payload: null, texto };
  }
}

/**
 * O miolo compartilhado: log → autenticação → parse → ingestão.
 *
 * `resolver` roda antes do corpo ser lido e devolve o dono ou a recusa. É o
 * único ponto que difere entre webhook por token e chave de API — e é por isso
 * que gateway novo não toca nesta função.
 */
async function processar(
  req: NextRequest,
  opts: {
    resolver: () => Promise<{ dono?: Dono; recusa?: Recusa }>;
    /** Usado no log quando nem deu para identificar o dono. */
    rotuloLogPadrao: string;
    aoConcluir?: (dono: Dono) => Promise<void>;
  },
): Promise<Response> {
  const { dono, recusa } = await opts.resolver();
  const { payload, texto } = await lerCorpo(req);

  const logId = await startWebhookLog({
    gateway: dono?.rotuloLog ?? opts.rotuloLogPadrao,
    payload: payload ?? texto,
    userId: dono?.userId ?? null,
    webhookId: dono?.webhookId ?? null,
  });

  const rejeitar = async (mensagem: string, httpStatus: number) => {
    await finishWebhookLog(logId, { status: "REJEITADO", message: mensagem, httpStatus });
    return Response.json({ error: mensagem }, { status: httpStatus });
  };

  if (!dono) return rejeitar(recusa?.mensagem ?? "Não autorizado.", recusa?.status ?? 401);
  if (payload === null) return rejeitar("JSON inválido.", 400);

  const auth = autenticar(dono.def, {
    headers: req.headers,
    payload,
    esperado: dono.secret,
  });
  if (!auth.ok) return rejeitar(auth.mensagem ?? "Não autorizado.", auth.status ?? 401);

  try {
    const resultado = dono.def.parse(payload);

    // ⚠️ Nada é descartado em silêncio. Um gateway que passe a mandar um evento
    // que não sabemos ler tem de virar uma linha VISÍVEL na aba Testes — não um
    // 200 vazio que parece sucesso dos dois lados.
    if (resultado.vendas.length === 0) {
      const motivo = resultado.ignorado ?? "Nenhuma venda reconhecida neste payload.";
      await finishWebhookLog(logId, { status: "REJEITADO", message: motivo, httpStatus: 200 });
      return Response.json({ ok: true, ignorado: motivo });
    }

    const ip = clientIpFrom(req.headers);
    const ingeridas = [];
    for (const venda of resultado.vendas) {
      ingeridas.push(
        await ingestSale(
          { userId: dono.userId, webhookId: dono.webhookId ?? null },
          venda,
          payload,
          ip,
        ),
      );
    }

    await opts.aoConcluir?.(dono);

    const primeira = ingeridas[0];
    await finishWebhookLog(logId, {
      status: "PROCESSADO",
      // Com mais de uma venda o log aponta para a primeira. O payload cru está
      // guardado inteiro, e cada venda tem o próprio `rawPayload`.
      saleId: primeira.id,
      httpStatus: 200,
      message: ingeridas.length > 1 ? `${ingeridas.length} itens no mesmo pedido` : undefined,
    });

    return Response.json({
      ok: true,
      sale_id: primeira.id,
      status: primeira.status,
      match: primeira.match,
      ...(ingeridas.length > 1 ? { itens: ingeridas } : {}),
    });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao processar o evento.";
    await finishWebhookLog(logId, { status: "ERRO", message: mensagem, httpStatus: 500 });
    console.error(`[gateways/receber:${dono.rotuloLog}]`, e);
    return Response.json({ error: mensagem }, { status: 500 });
  }
}

/**
 * Recebe de um webhook identificado por token na URL.
 *
 * @param exigirPlataforma Só a rota LEGADA da Kirvano usa: ela responde 404 para
 *   um token que não seja daquela plataforma, e mudar isso alteraria a resposta
 *   de uma URL que já está em produção.
 */
export function receberDeWebhook(
  req: NextRequest,
  token: string | null,
  exigirPlataforma?: string,
): Promise<Response> {
  return processar(req, {
    rotuloLogPadrao: exigirPlataforma ?? "CUSTOM",
    resolver: async () => {
      if (!token) return { recusa: { mensagem: "Parâmetro id ausente.", status: 400 } };

      const webhook = await prisma.webhook.findUnique({
        where: { token },
        select: { id: true, userId: true, active: true, secret: true, platform: true },
      });

      if (!webhook) return { recusa: { mensagem: "Webhook não encontrado.", status: 404 } };
      if (exigirPlataforma && webhook.platform !== exigirPlataforma) {
        return { recusa: { mensagem: "Webhook não encontrado.", status: 404 } };
      }
      if (!webhook.active) return { recusa: { mensagem: "Webhook inativo.", status: 403 } };

      return {
        dono: {
          userId: webhook.userId,
          webhookId: webhook.id,
          secret: webhook.secret,
          def: gatewayDoWebhook(webhook.platform),
          rotuloLog: webhook.platform,
        },
      };
    },
    aoConcluir: async (dono) => {
      if (!dono.webhookId) return;
      await prisma.webhook.update({
        where: { id: dono.webhookId },
        data: { eventCount: { increment: 1 }, lastEventAt: new Date() },
      });
    },
  });
}

/**
 * Recebe pela chave de API da Traffik (sistema próprio do usuário).
 *
 * Usa o parser genérico: aqui não há gateway do outro lado, e é justamente por
 * isso que a tolerância a apelidos de campo faz sentido.
 */
export function receberDeCredencial(req: NextRequest): Promise<Response> {
  return processar(req, {
    rotuloLogPadrao: "API",
    resolver: async () => {
      const cabecalho = req.headers.get("authorization") ?? "";
      const chave = cabecalho.toLowerCase().startsWith("bearer ")
        ? cabecalho.slice(7).trim()
        : (req.headers.get("x-api-key")?.trim() ?? "");
      if (!chave) return { recusa: { mensagem: "Chave de API ausente.", status: 401 } };

      // A chave é guardada encriptada (IV aleatório), então a busca é pelo hash
      // determinístico da chave em texto puro — nunca pela coluna `key`.
      const cred = await prisma.apiCredential.findUnique({
        where: { keyHash: secretLookupHash(chave) },
        select: { id: true, userId: true, revoked: true },
      });
      if (!cred || cred.revoked) {
        return { recusa: { mensagem: "Chave de API inválida ou revogada.", status: 401 } };
      }

      return {
        dono: {
          userId: cred.userId,
          apiCredentialId: cred.id,
          // A chave JÁ autenticou a requisição. `CUSTOM` tem `exigir: false`,
          // então a etapa de segredo passa sem exigir um segundo fator.
          secret: null,
          def: REGISTRO.CUSTOM,
          rotuloLog: "API",
        },
      };
    },
    aoConcluir: async (dono) => {
      if (!dono.apiCredentialId) return;
      await prisma.apiCredential.update({
        where: { id: dono.apiCredentialId },
        data: { lastUsedAt: new Date() },
      });
    },
  });
}
