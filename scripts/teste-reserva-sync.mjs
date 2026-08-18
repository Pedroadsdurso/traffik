/**
 * A RESERVA DE SINCRONIZAÇÃO — toda chamada DECIDE, e o compilador cobra.
 *
 * ## 🔴 O DEFEITO QUE ISTO FECHA
 *
 * Medido em 17/08/2026: `syncUser` / `syncUserMetrics` / `syncSingleAccount`
 * tinham **6 chamadas e apenas 2 reservavam** o lock — e as duas eram do
 * `autoSync`, o único arquivo onde o lock morava.
 *
 * > ## O lock não protegia `syncUser`: protegia o `autoSync`. Quem chamasse a função direto passava por fora, e nada acusava.
 *
 * O pior deles era `api/sync/facebook`: `syncUser(id)` sem o segundo argumento
 * caía no **default de 30 dias** — a mesma janela do sync profundo diário, cujo
 * cabeçalho diz *"use no máximo 1×/dia"* — e ia a cada clique, sem reserva.
 *
 * ## ✅ O CONSERTO É O TIPO, NÃO A DISCIPLINA
 *
 * O terceiro parâmetro é **obrigatório e sem default**. Chamador novo não passa
 * no `tsc` sem decidir. É a regra registrada deste projeto: *quando uma regra
 * depende de alguém lembrar, procure a forma de o COMPILADOR cobrar.*
 *
 * ⚠️ **Então por que este arquivo existe, se o `tsc` já cobra?** Porque o `tsc`
 * garante que ALGO foi passado — não que a escolha faz sentido. As asserções
 * abaixo congelam **qual** política cada caminho usa, e o motivo de cada uma.
 *
 *   npm run test:reserva-sync
 */

import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";

let n = 0;
const falhas = [];
const ok = (nome, cond, extra) => {
  try {
    assert.ok(cond, nome + (extra ? " — " + extra : ""));
    console.log("  \x1b[32m✓\x1b[0m " + nome + (extra ? " — " + extra : ""));
    n++;
  } catch (e) {
    falhas.push(nome);
    console.log("  \x1b[31m✗\x1b[0m " + nome + "\n      " + e.message);
  }
};
const secao = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/** Apaga comentário PRESERVANDO quebras — os arquivos CITAM as chamadas na prosa. */
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

console.log("\n\x1b[1mA reserva de sincronização — toda chamada decide\x1b[0m");

/* ═══ 1 · A ASSINATURA NÃO TEM DEFAULT ════════════════════════════════════

   ⛔ Um `reserva: Reserva = "exigir"` passaria em toda asserção de call site
   abaixo e desfaria a correção inteira: o chamador novo voltaria a não decidir.
   Esta é a asserção que protege o mecanismo, não o uso.                      */
secao("1 · O parâmetro é obrigatório — um default desfaz tudo em silêncio");
{
  const SYNC = semCom(ler("src/lib/facebook/sync.ts"));
  ok("1 · linha de base: o módulo foi lido", SYNC.length > 5000, SYNC.length + " chars");

  const assinaturas = [...SYNC.matchAll(/export async function (syncUser|syncUserMetrics|syncSingleAccount)\s*\(([^)]*)\)/gs)];
  ok("1 · linha de base: as TRÊS assinaturas públicas foram achadas", assinaturas.length === 3, assinaturas.map((m) => m[1]).join(" · "));

  for (const [, nome, args] of assinaturas) {
    ok(`1 · \`${nome}\` exige \`reserva\``, /reserva:\s*Reserva/.test(args), args.replace(/\s+/g, " ").trim());
    ok(
      `1 · ⛔ …e SEM valor padrão`,
      !/reserva:\s*Reserva\s*=/.test(args),
      "um default faria o chamador novo voltar a não decidir",
    );
  }
}

/* ═══ 2 · CADA CHAMADA PASSA A POLÍTICA — e o denominador vai na saída ═══ */
secao("2 · As chamadas, uma a uma, com a política que cada caminho escolheu");
{
  const ARQUIVOS = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated/") && !f.endsWith("lib/facebook/sync.ts"));

  const chamadas = [];
  for (const f of ARQUIVOS) {
    const txt = semCom(ler(f));
    for (const m of txt.matchAll(/\b(syncUser|syncUserMetrics|syncSingleAccount)\s*\(([^;]*?)\)/gs)) {
      chamadas.push({ arquivo: f.split("/").slice(-2).join("/"), fn: m[1], args: m[2].replace(/\s+/g, " ").trim() });
    }
  }

  /* ⛔ O DENOMINADOR: sem ele, "todas passam" passaria com zero chamadas —
     e zero é exatamente o que um `glob` quebrado devolve. */
  ok("2 · linha de base: há chamadas de sync fora do módulo", chamadas.length >= 6, chamadas.length + " chamadas");

  const semPolitica = chamadas.filter((c) => !/"exigir"|"ignorar"/.test(c.args));
  ok(
    "2 · 🔑 TODA chamada passa `\"exigir\"` ou `\"ignorar\"`",
    semPolitica.length === 0,
    semPolitica.map((c) => `${c.arquivo}:${c.fn}(${c.args})`).join(" | ") || `${chamadas.length} de ${chamadas.length}`,
  );

  for (const c of chamadas) {
    const pol = /"exigir"/.test(c.args) ? "exigir" : "ignorar";
    console.log(`      \x1b[2m${c.arquivo.padEnd(28)} ${c.fn.padEnd(18)} ${pol}\x1b[0m`);
  }
}

/* ═══ 3 · AS DUAS POLÍTICAS ESTÃO NOS LUGARES CERTOS ═════════════════════

   O `tsc` garante que ALGO foi passado. Estas asserções congelam QUAL — e um
   `"ignorar"` no lugar errado é exatamente o defeito que a sessão corrigiu.  */
secao("3 · Onde cada política está — e `\"ignorar\"` só com motivo");
{
  const alvo = (f) => semCom(ler(f));

  /* 🔴 Os caminhos que DISPUTAM: cron pesado e ação do usuário. */
  ok(
    "3 · o `?full=1` do cron EXIGE reserva",
    /syncUser\(u\.userId,\s*30,\s*"exigir"\)/.test(alvo("src/app/api/cron/sync-facebook/route.ts")),
    "30 dias às 04:00, junto da manutenção — era o mais pesado sem lock",
  );
  ok(
    "3 · o botão do painel EXIGE, nos dois ramos",
    (alvo("src/app/api/sync/facebook/route.ts").match(/"exigir"/g) ?? []).length === 2,
    "`syncUser` e `syncSingleAccount` — era o pior dos seis",
  );
  ok(
    "3 · …e a janela do painel ficou EXPLÍCITA (30), não no default",
    /syncUser\(session\.user\.id,\s*30,/.test(alvo("src/app/api/sync/facebook/route.ts")),
    "o default escondia a janela de quem lia a chamada",
  );

  /* ⚠️ Os que IGNORAM, e os dois motivos são diferentes. */
  ok(
    "3 · o `autoSync` IGNORA — ele já reservou por fora",
    (alvo("src/lib/facebook/autoSync.ts").match(/"ignorar"/g) ?? []).length === 2,
    "pedir de novo falharia contra o próprio lock",
  );
  ok(
    "3 · o callback do OAuth IGNORA — primeira conexão, nada a disputar",
    /syncUser\(userId,\s*30,\s*"ignorar"\)/.test(alvo("src/app/api/auth/facebook/callback/route.ts")),
    "o perfil acabou de nascer neste request",
  );
}

/* ═══ 4 · O CAS É UM SÓ — a duplicata não pode voltar ════════════════════

   O compare-and-swap morava no `autoSync`, e é por isso que só ele reservava.
   Extraí-lo e deixar a cópia lá recriaria o problema no commit que o desfaz.  */
secao("4 · O compare-and-swap tem UMA implementação");
{
  const AUTO = semCom(ler("src/lib/facebook/autoSync.ts"));
  const RES = semCom(ler("src/lib/facebook/reserva.ts"));

  ok("4 · linha de base: os dois arquivos foram lidos", AUTO.length > 1500 && RES.length > 800, `${AUTO.length} · ${RES.length}`);
  ok(
    "4 · 🔑 o CAS vive em `reserva.ts`",
    /updateMany\([\s\S]*?syncLockedAt:\s*agora/.test(RES),
    "é ele que faz o banco decidir o vencedor",
  );
  ok(
    "4 · ⛔ e o `autoSync` NÃO tem uma cópia — ele delega",
    !/updateMany\([\s\S]{0,200}?syncLockedAt:\s*agora/.test(AUTO) && /tentarReservar\(/.test(AUTO),
    "duas fontes concordando hoje é o que faz a duplicata sobreviver",
  );
  ok(
    "4 · …e o limiar de abandono também é importado, não repetido",
    /LOCK_EXPIRA_MS as LOCK_RESERVA_MS/.test(AUTO),
    "ele decide o mesmo `where` que o `tentarReservar` usa",
  );
}

/* ═══ 5 · `reservaNegada` NÃO É ERRO — e a tela precisa distinguir ═══════ */
secao("5 · Reserva negada é informação, não falha");
{
  const PAINEL = semCom(ler("src/app/api/sync/facebook/route.ts"));
  ok(
    "5 · o painel distingue `reservaNegada` de sucesso vazio",
    /reservaNegada/.test(PAINEL) && /jaSincronizando/.test(PAINEL),
    "sem isto, o 2º clique parece um sync que não achou nada",
  );
  ok(
    "5 · ⛔ e NÃO devolve erro — 'já está sincronizando' é verdade, não falha",
    !/reservaNegada[\s\S]{0,160}status:\s*(4|5)\d\d/.test(PAINEL),
    "tratar como erro ensinaria o usuário a desconfiar de um estado normal",
  );
}

/* ═══ 6 · 🔴 O CAMPO DO CONTRATO TEM LEITOR — a metade que faltava ══════

   ## Contrato novo com consumidor que não leu o campo é a forma mais barata de nascer inerte.

   A §5 prova que o SERVIDOR devolve `jaSincronizando`. Isso não prova que
   alguém usa — e por um dia não usou: os dois consumidores em
   `useTraffikState` ignoravam o campo, e o segundo dizia
   **"Sincronizado: 0 campanhas, 0 anúncios, 0 dias de métricas"** para um
   ciclo que não rodou. O produto afirmando resultado sobre medição que não
   houve, que é a distinção central deste projeto.

   ✅ **E dá para cobrir por asserção**, o que não era óbvio: o par
   *rota que devolve* × *quem faz `fetch` daquela rota* é estático. A guarda
   acha os consumidores pelo CAMINHO e exige que citem o campo.

   ⚠️ **O limite vai escrito:** ela prova que o campo é LIDO, não que a
   mensagem mostrada faz sentido. "Como ficou" segue sendo pergunta de tela —
   e é a mesma fronteira de todo o resto deste arquivo.
   ═════════════════════════════════════════════════════════════════════ */
secao("6 · O campo `jaSincronizando` tem LEITOR — não basta o servidor devolver");
{
  const ROTA = "/api/sync/facebook";
  const consumidores = globSync("src/**/*.{ts,tsx}")
    .map((f) => f.replaceAll(String.fromCharCode(92), "/"))  /* barra invertida sem literal: o escape se perdeu duas vezes ao gerar este arquivo */
    .filter((f) => !f.includes("generated/") && !f.startsWith("src/app/api/"))
    .filter((f) => semCom(ler(f)).includes(`"${ROTA}"`));

  ok(
    "6 · linha de base: há quem faça `fetch` da rota",
    consumidores.length >= 1,
    consumidores.map((f) => f.split("/").pop()).join(" · ") || "⛔ ninguém chama — a asserção abaixo não mediria nada",
  );

  const semLeitura = consumidores.filter((f) => !/jaSincronizando/.test(semCom(ler(f))));
  ok(
    "6 · 🔑 TODO consumidor da rota LÊ `jaSincronizando`",
    semLeitura.length === 0,
    semLeitura.map((f) => f.split("/").pop()).join(" · ") || `${consumidores.length} de ${consumidores.length}`,
  );

  /* ⛔ E o ramo tem de vir ANTES do caminho de sucesso, senão ele é código
     morto: o resumo zerado casaria primeiro e a frase nunca apareceria. */
  for (const f of consumidores) {
    const txt = semCom(ler(f));
    const iCampo = txt.indexOf("jaSincronizando");
    const iSucesso = txt.indexOf("Sincronizado:");
    ok(
      `6 · …e em \`${f.split("/").pop()}\` o ramo vem ANTES do sucesso`,
      iCampo > 0 && (iSucesso === -1 || iCampo < iSucesso),
      iSucesso === -1 ? "não há ramo de sucesso neste arquivo" : `campo em ${iCampo}, sucesso em ${iSucesso}`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: as 3 assinaturas públicas + toda chamada delas em `src/`\n");
