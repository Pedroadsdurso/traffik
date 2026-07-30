import { secretsMatch } from "@/lib/crypto/secrets";

import { isObj, pick, type Json } from "./campos";
import type { EstrategiaAuth, FonteDoSegredo, GatewayDef } from "./contrato";

/**
 * Autenticação de webhook, **plugável por plataforma**.
 *
 * Cada gateway prova a identidade de um jeito: a Kirvano manda um token de
 * segurança no header, a Cakto manda um `secret` dentro do corpo, a Stripe
 * assina o corpo com HMAC. Isso é **dado do registro**, não `if` na rota.
 *
 * ## ⛔ FALHA FECHADA, sempre
 *
 * Ausência de configuração nunca vira permissão — mesma regra do `cronAuth` e
 * dos webhooks. O motivo aqui é concreto: uma venda falsa não é só um número
 * errado no painel. Ela dispara `Purchase` na CAPI do Facebook e envenena a
 * otimização da campanha, com dinheiro real em jogo.
 *
 * ## ⚠️ Ao mexer nisto, procure as OUTRAS portas que aceitam a mesma credencial
 *
 * As rotas `/api/webhook/kirvano?id=X` e `/api/webhook/sale/X` aceitam o **mesmo**
 * `Webhook.token`. Endurecer uma e deixar a outra aberta é teatro: bastava trocar
 * o caminho para pular a checagem — e foi exatamente o bypass que existiu aqui
 * até 29/07/2026. Hoje as duas passam por esta função, o que torna o bypass
 * estruturalmente impossível em vez de depender de lembrar.
 */

export interface ResultadoAuth {
  ok: boolean;
  /** Motivo da recusa, já em linguagem de usuário. */
  mensagem?: string;
  status?: number;
}

const OK: ResultadoAuth = { ok: true };

/** Lê o segredo enviado, na ordem declarada pela estratégia. */
function segredoEnviado(
  onde: FonteDoSegredo[],
  headers: Headers,
  payload: Json | null,
): string | null {
  for (const fonte of onde) {
    if ("header" in fonte) {
      const v = headers.get(fonte.header);
      if (v?.trim()) return v.trim();
    } else if (payload) {
      const v = pick(payload, [fonte.corpo]);
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

/**
 * Valida a requisição contra a estratégia do gateway.
 *
 * @param esperado O `Webhook.secret` cadastrado, ou `null` se não houver.
 */
export function autenticar(
  def: GatewayDef,
  { headers, payload, esperado }: { headers: Headers; payload: unknown; esperado: string | null },
): ResultadoAuth {
  const auth: EstrategiaAuth = def.auth;
  const corpo = isObj(payload) ? payload : null;

  if (auth.tipo === "hmac") {
    // Ainda não há gateway com HMAC. Recusar é a única resposta segura: um
    // `return OK` aqui viraria uma porta aberta no dia em que alguém cadastrasse
    // a estratégia sem implementar a verificação.
    return { ok: false, mensagem: "Verificação de assinatura ainda não implementada.", status: 501 };
  }

  if (!esperado) {
    if (auth.exigir) {
      return {
        ok: false,
        status: 401,
        mensagem: `Webhook sem chave de segurança configurada. Edite o webhook na aba Integrações › Webhooks e informe a chave da ${def.nome}.`,
      };
    }
    // CUSTOM sem segredo: a própria URL é o segredo. É o desenho documentado.
    return OK;
  }

  const enviado = segredoEnviado(auth.onde, headers, corpo);
  // ⚠️ Comparação em TEMPO CONSTANTE: o segredo viaja em toda requisição do
  // gateway, então dá para sondá-lo com muitas tentativas se a comparação vazar,
  // pelo tempo de resposta, quantos caracteres iniciais bateram.
  if (!enviado || !secretsMatch(enviado, esperado)) {
    return { ok: false, mensagem: "Chave de segurança inválida.", status: 401 };
  }
  return OK;
}
