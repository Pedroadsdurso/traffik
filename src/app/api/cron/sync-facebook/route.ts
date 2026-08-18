import type { NextRequest } from "next/server";

import { autoSyncSeNecessario } from "@/lib/facebook/autoSync";
import { syncUser } from "@/lib/facebook/sync";
import { cronAutorizado, naoAutorizado } from "@/lib/cronAuth";
import { registrarExecucao } from "@/lib/cronBatimento";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * Quando parar de COMEÇAR um usuário novo.
 *
 * 🔴 O contador de "entraram × completaram" sozinho não resolveria o problema:
 * se a função for morta por estourar o `maxDuration`, **não há resposta
 * nenhuma** — nenhum log, nenhum contador, nenhum sinal. O último da fila
 * simplesmente não sincroniza, e ninguém fica sabendo.
 *
 * A margem existe para o laço parar sozinho e **conseguir responder**, dizendo
 * quem ficou de fora. Um corte que devolve `interrompido: true` é diagnóstico;
 * um processo morto é silêncio.
 *
 * 15s de folga: é o tempo de fechar a resposta mais a cauda do último usuário
 * que já começou (o corte só impede COMEÇAR outro, não interrompe quem corre).
 */
const ORCAMENTO_MS = (maxDuration - 15) * 1000;

/**
 * Chamado pelo cron do GitHub Actions. Sincroniza todos os usuários que têm ao
 * menos um perfil do Facebook conectado. Protegido por CRON_SECRET.
 *
 * ## ⚠️ Processamento em SÉRIE, com ordem rotativa
 *
 * Os usuários são processados um a um, e a ordem é **do mais desatualizado para
 * o mais recente** (`lastSyncedAt` ascendente, nunca sincronizado primeiro).
 *
 * Isso não aumenta a vazão — resolve a INJUSTIÇA. Com ordem fixa, se o
 * orçamento acabar é sempre o mesmo usuário que fica de fora, e para ele a
 * ferramenta parece simplesmente não funcionar. Com ordem por idade, quem
 * ficou de fora numa execução é o primeiro da próxima.
 */
async function executar(req: NextRequest) {
  if (!cronAutorizado(req)) return naoAutorizado();
  const comecou = Date.now();

  // `?full=1` força a janela LONGA (30 dias) para todo mundo, ignorando os
  // intervalos. Use no máximo 1×/dia: são ~4 chamadas por conta e serve só para
  // recuperar dias antigos que a Meta reconsolidou.
  const full = req.nextUrl.searchParams.get("full") === "1";

  /**
   * Ordem ROTATIVA: o mais desatualizado primeiro.
   *
   * `lastSyncedAt` ascendente com **nulos na frente** — quem nunca sincronizou
   * tem prioridade máxima, que é o caso de todo convidado no primeiro dia.
   *
   * Assim o usuário que ficou de fora por orçamento numa execução é o
   * **primeiro** da seguinte: a fila gira sozinha, sem estado extra e sem
   * sorteio. Não aumenta a vazão — resolve a INJUSTIÇA de ser sempre o mesmo a
   * ficar de fora, que é o que faz a ferramenta parecer quebrada para ele.
   *
   * ⚠️ `distinct` DEPOIS do `orderBy`: um usuário com dois perfis entra uma vez
   * só, pelo perfil mais antigo — que é justamente a prioridade certa.
   */
  const perfis = await prisma.adProfile.findMany({
    orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }],
    distinct: ["userId"],
    select: { userId: true, lastSyncedAt: true },
  });
  const users = perfis;

  let totalMetrics = 0;
  const results: Record<string, unknown>[] = [];
  // `entraram` × `results.length` é o sinal: se divergirem, alguém não terminou.
  let entraram = 0;
  let interrompido = false;

  for (const u of users) {
    // 🔴 O corte acontece ANTES de começar mais um. Estourar o `maxDuration`
    // mata a função sem resposta — e é exatamente o modo de falha invisível que
    // este bloco existe para transformar em `interrompido: true`.
    if (Date.now() - comecou > ORCAMENTO_MS) {
      interrompido = true;
      break;
    }
    entraram++;
    const t0 = Date.now();
    try {
      if (full) {
        /* 🔴 `"exigir"`: este é o ciclo mais caro que existe (30 dias) e
           roda às 04:00, junto da `manutencao`. Até 17/08/2026 ele passava
           POR FORA do lock — podia sincronizar as mesmas contas ao mesmo
           tempo que o chamador de minuto, dobrando quota da Graph no minuto
           mais carregado do dia. */
        const s = await syncUser(u.userId, 30, "exigir");
        totalMetrics += s.metrics;
        results.push({ userId: u.userId, ms: Date.now() - t0, accounts: s.accounts, metrics: s.metrics, errors: s.errors.length });
      } else {
        // Delega ao MESMO auto-sync que o painel usa. Ele já decide sozinho se
        // toca só as métricas (20s, 1 chamada por conta) ou o ciclo completo
        // (3 min), e a reserva no banco impede execução concorrente.
        //
        // É o que torna esta rota **segura de chamar a cada 1 minuto**: a
        // frequência da chamada deixa de determinar a carga na Graph API — os
        // intervalos internos determinam. Chamar mais vezes só faz a maioria
        // sair sem tocar na Meta.
        // O resultado vem do auto-sync — antes eram zeros LITERAIS aqui, e a
        // resposta dizia "accounts: 0" mesmo quando a sincronização tinha
        // corrido bem. Um cron que mente sobre o próprio resultado esconde o
        // erro justamente onde se olha para diagnosticar.
        const r = await autoSyncSeNecessario(u.userId);
        // Quantas contas o filtro do sync considera elegíveis — é a resposta
        // para "por que nenhuma conta apareceu?" sem ter que abrir o banco.
        const elegiveis = await prisma.adAccount.count({
          where: { userId: u.userId, trackingEnabled: true, adProfile: { isNot: null } },
        });
        const total = await prisma.adAccount.count({ where: { userId: u.userId } });
        totalMetrics += r.modo === "metricas" || r.modo === "completo" ? r.summary.metrics : 0;
        results.push({
          userId: u.userId,
          ms: Date.now() - t0,
          modo: r.modo,
          ...(r.modo === "pulado" ? { motivo: r.motivo } : {}),
          ...(r.modo === "erro" ? { erro: r.erro } : {}),
          ...(r.modo === "metricas" || r.modo === "completo"
            ? { accounts: r.summary.accounts, metrics: r.summary.metrics, errors: r.summary.errors.length, detalheErros: r.summary.errors }
            : {}),
          contasElegiveis: elegiveis,
          contasTotais: total,
          ...(elegiveis === 0 && total > 0
            ? { aviso: "Nenhuma conta com rastreamento ligado. Ative em Integrações › Anúncios." }
            : {}),
        });
      }
    } catch (e) {
      // A mensagem entra no resultado: um `errors: 1` mudo não diz o que houve,
      // e é justamente aqui que se olha quando um usuário não sincroniza.
      results.push({
        userId: u.userId,
        ms: Date.now() - t0,
        accounts: 0,
        metrics: 0,
        errors: 1,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const ms = Date.now() - comecou;
  const naoAlcancados = users.slice(entraram).map((u) => u.userId);

  /**
   * ⚠️ Leia `entraram` contra `completaram` ANTES de qualquer outro número.
   *
   * | Sinal | Significa |
   * |---|---|
   * | `entraram === completaram` e `interrompido: false` | todos rodaram |
   * | `interrompido: true` | 🔴 **o orçamento acabou** — `naoAlcancados` diz quem ficou. Eles são os PRIMEIROS da próxima execução (ordem por idade) |
   * | `entraram > completaram` | 🔴 alguém não terminou nem caiu no `catch`: investigue |
   *
   * `msPorUsuario` é o que responde "quantos cabem no limite": divida
   * `ORCAMENTO_MS` pela média e você tem o teto real de usuários por execução.
   */
  return Response.json({
    ok: true,
    modo: full ? "completo-30d" : "auto",
    usuarios: users.length,
    entraram,
    completaram: results.length,
    interrompido,
    ...(naoAlcancados.length ? { naoAlcancados } : {}),
    ms,
    msPorUsuario: entraram > 0 ? Math.round(ms / entraram) : 0,
    orcamentoMs: ORCAMENTO_MS,
    totalMetrics,
    results,
  });
}

/**
 * Envolve a rotina para registrar o BATIMENTO.
 *
 * Agendador externo avisa quando a execucao falha; nenhum avisa quando ele
 * proprio para. Quem detecta a ausencia e o servidor — ver `lib/cronBatimento.ts`.
 *
 * ⚠️ Registra nos DOIS caminhos, e com `ok` diferente: silencio (nunca rodou) e
 * falha (rodou e quebrou) sao sinais distintos, e a tela os separa. Registrar so
 * o sucesso faria uma rotina que falha sempre parecer uma rotina que parou.
 *
 * ⚠️ 401 NAO conta como execucao: chamada sem o segredo nao e o agendador
 * trabalhando, e marcar batimento ali esconderia justamente o caso em que o
 * `CRON_SECRET` foi trocado e o agendador parou de ser aceito.
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const res = await executar(req);
    if (res.status !== 401) {
      await registrarExecucao("sync-facebook", { ok: res.ok, duracaoMs: Date.now() - t0 });
    }
    return res;
  } catch (e) {
    await registrarExecucao("sync-facebook", {
      ok: false,
      duracaoMs: Date.now() - t0,
      erro: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
