/**
 * OS TRÊS EFEITOS PÓS-VENDA, NA LINHA DA VENDA — a leitura que faltava.
 *
 * ## 🔴 O PAR ESCRITOR-SEM-LEITOR QUE ISTO DESFAZ
 *
 * `marcarEfeito.ts` grava `capiStatus`, `checkoutStatus` e `notifStatus` em
 * toda venda desde a Família 1 — as três colunas existem porque os efeitos
 * falhavam com `console.error` e mais nada.
 *
 * O único leitor era `resumoEfeitos`, server action da tela de
 * `Integrações › Testes`. A tela foi deletada em 12/08, a action ficou órfã, e
 * em 17/08 foi podada. **As três colunas ficaram só com escritor**: gravadas em
 * toda venda, lidas por ninguém.
 *
 * É a imagem espelhada do `Sale.apiCredentialId` (6 leitores, 0 escritores).
 *
 * ## ⛔ A DECISÃO: RELIGAR A LEITURA, NÃO PARAR DE ESCREVER
 *
 * As duas saídas fechavam o par. A segunda desfaria a Família 1: as colunas
 * guardam **por que** um efeito falhou, e essa era exatamente a informação que
 * se perdia antes de elas existirem. Apagar a escrita seria reverter o
 * conserto para fechar a contabilidade de leitores.
 *
 * ## 🎯 E A LEITURA VOLTOU NA LINHA, NÃO NUM RESUMO
 *
 * O que a coluna guarda é *por que ESTA venda não produziu o efeito* — um fato
 * da linha. Um resumo ("3 falharam") obriga quem lê a ir procurar QUAIS, e era
 * essa fricção que fazia ninguém abrir a tela.
 *
 *   npm run test:efeitos-na-linha
 */

import assert from "node:assert/strict";
import { readFileSync, globSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  problemasDaVenda,
  CAPI_ENVIADO, CAPI_SEM_TOKEN, CAPI_OUTRO_DONO, CAPI_ERRO,
  CHECKOUT_CRIADO, CHECKOUT_DUPLICADO, CHECKOUT_ERRO,
  NOTIF_CRIADA, NOTIF_SEM_CONFIG, NOTIF_DESLIGADA,
  STATUS_PROBLEMA, EFEITOS,
} from "@/lib/webhook/efeitos";

const { FeedVendas } = await import("../src/components/tk/FeedVendas.tsx");

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
const semCom = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

console.log("\n\x1b[1mOs três efeitos pós-venda, na linha da venda\x1b[0m");

/* ═══ 1 · A FUNÇÃO PURA — só o que pede AÇÃO entra ════════════════════════ */
secao("1 · `problemasDaVenda` — só `tom: problema`, e nulo NÃO é alarme");
{
  /* ⛔ LINHA DE BASE: o vocabulário tem problemas para achar. Sem ela, todo
     `length === 0` abaixo passaria com um `STATUS_PROBLEMA` vazio. */
  ok(
    "1 · linha de base: o vocabulário declara status de problema nos TRÊS efeitos",
    STATUS_PROBLEMA.capi.length > 0 && STATUS_PROBLEMA.checkout.length > 0 && STATUS_PROBLEMA.notif.length > 0,
    `capi ${STATUS_PROBLEMA.capi.length} · checkout ${STATUS_PROBLEMA.checkout.length} · notif ${STATUS_PROBLEMA.notif.length}`,
  );

  /* ⚠️ NULO é venda anterior às colunas — ausência de informação, nunca alarme.
     Se nulo pintasse, todo o histórico apareceria quebrado no dia do deploy. */
  ok(
    "1 · ⚠️ os três NULOS não produzem problema nenhum",
    problemasDaVenda({}).length === 0 && problemasDaVenda({ capiStatus: null, checkoutStatus: null, notifStatus: null }).length === 0,
    "venda anterior às colunas — a tela não afirma nada sobre ela",
  );

  ok(
    "1 · o desfecho BOM dos três não produz problema",
    problemasDaVenda({ capiStatus: CAPI_ENVIADO, checkoutStatus: CHECKOUT_CRIADO, notifStatus: NOTIF_CRIADA }).length === 0,
    "uma linha que anuncia sucesso em toda venda é ruído que se aprende a ignorar",
  );

  /* ⛔ O PAR QUE MAIS IMPORTA: `neutro` NÃO é falha. `outro_dono` é o desfecho
     CORRETO quando a partição diz que outro pixel envia o Purchase; contá-lo
     como problema faria a tela pedir para consertar o que está certo. */
  ok(
    "1 · ⛔ `neutro` NÃO é problema — `outro_dono` é o desfecho CERTO",
    problemasDaVenda({ capiStatus: CAPI_OUTRO_DONO, checkoutStatus: CHECKOUT_DUPLICADO, notifStatus: NOTIF_DESLIGADA }).length === 0,
    "os três são configuração, não falha",
  );

  /* …e o par: os MESMOS três campos, com valores de problema, produzem três. */
  const tres = problemasDaVenda({ capiStatus: CAPI_SEM_TOKEN, checkoutStatus: CHECKOUT_ERRO, notifStatus: NOTIF_SEM_CONFIG });
  ok(
    "1 · …e os mesmos três campos, com falha, produzem TRÊS",
    tres.length === 3,
    tres.map((p) => p.chave).join(" · "),
  );
  ok(
    "1 · cada um traz `rotulo` em linguagem de consequência",
    tres.every((p) => p.rotulo.length > 8) && tres.some((p) => /Facebook/i.test(p.rotulo)),
    tres.map((p) => p.rotulo).join(" | "),
  );
  ok(
    "1 · …e a AÇÃO, quando existe",
    tres.filter((p) => p.acao).length >= 2,
    tres.map((p) => (p.acao ? "com ação" : "sem")).join(" · "),
  );

  /* Um por vez, para o filtro não passar por acidente com os três juntos. */
  for (const [chave, campo, valor] of [
    ["capi", "capiStatus", CAPI_ERRO],
    ["checkout", "checkoutStatus", CHECKOUT_ERRO],
    ["notif", "notifStatus", NOTIF_SEM_CONFIG],
  ]) {
    const r = problemasDaVenda({ [campo]: valor });
    ok(`1 · \`${chave}\` sozinho produz UM problema`, r.length === 1 && r[0].chave === chave, r.map((p) => p.chave).join());
  }

  /* ⛔ Status DESCONHECIDO vira problema, nunca "ok" por omissão: vocabulário
     novo gravado por código novo e não cadastrado é bug nosso, e é assim que
     ele se denuncia. */
  ok(
    "1 · ⛔ status DESCONHECIDO vira problema — nunca `ok` por omissão",
    problemasDaVenda({ capiStatus: "status_que_ninguem_cadastrou" }).length === 1,
    "uma lacuna tem de pedir correção em vez de passar batida",
  );

  /* 🔑 A FONTE É UMA. Se alguém escrever a lista de status à mão em vez de
     derivar do `tom`, esta asserção não muda — mas a próxima muda. */
  ok(
    "1 · 🔑 o filtro concorda com `STATUS_PROBLEMA`, que é derivado das tabelas",
    EFEITOS.every((e) => {
      const campo = { capi: "capiStatus", checkout: "checkoutStatus", notif: "notifStatus" }[e.chave];
      return STATUS_PROBLEMA[e.chave].every((st) => problemasDaVenda({ [campo]: st }).length === 1);
    }),
    "duas listas para a mesma pergunta divergem no primeiro status novo",
  );
}

/* ═══ 2 · A COLUNA CHEGA À CONTA — o `select` do `metrics.ts` ═════════════

   ⛔ Fora do `select`, os três campos chegam `undefined`, `problemasDaVenda`
   devolve `[]`, e a linha fica MUDA com ar de saudável. É a armadilha do
   `pedidoId`, que esta base já pagou quatro vezes: `tsc`, `lint` e `build`
   passam, e o resultado sai plausível.                                      */
secao("2 · As três colunas estão no `select` — senão a linha fica muda");
{
  const M = semCom(ler("src/lib/dashboard/metrics.ts"));
  const i = M.indexOf("prisma.sale.findMany");
  ok("2 · linha de base: a consulta de vendas foi encontrada", i > 0, "índice " + i);
  const sel = M.slice(i, M.indexOf("orderBy", i));
  ok("2 · linha de base: o `select` foi recortado", /select:\s*\{/.test(sel) && sel.includes("pedidoId"), sel.length + " chars");

  for (const c of ["capiStatus", "checkoutStatus", "notifStatus"]) {
    ok(`2 · \`${c}\` está no \`select\``, new RegExp("\\b" + c + ":\\s*true").test(sel), "fora dele chega `undefined` e nada acusa");
  }
  ok(
    "2 · …e `buildActivity` chama a função PURA, não uma lista própria",
    /problemas:\s*problemasDaVenda\(s\)/.test(M),
    "reescrever a lista aqui seria a segunda fonte da mesma pergunta",
  );
}

/* ═══ 3 · A LINHA DESENHA O PROBLEMA — e o par ════════════════════════════

   ⚠️ `FeedVendas` NÃO porta para o `<body>`, então `renderToStaticMarkup` o
   alcança. A negação da §3 é medível porque o lado sem problema desenha a
   CAMPANHA — markup de verdade, não string vazia.                           */
secao("3 · A linha da venda desenha o problema — no lugar da campanha");
{
  const base = {
    id: "s-1",
    typeLabel: "Venda aprovada",
    cor: "#34d399",
    valueLabel: "R$ 197,00",
    timeLabel: "há 2 min",
    campaign: "Black Friday — Conversão",
  };
  const desenhar = (props) => renderToStaticMarkup(React.createElement(FeedVendas, { itens: [{ ...base, ...props }] }));
  const texto = (h) => h.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

  /* ── SEM problema: a campanha aparece, e é esta a linha de base do NÃO ── */
  const semProblema = desenhar({});
  ok(
    "3 · linha de base: sem problema, a linha desenha a CAMPANHA",
    texto(semProblema).includes("Black Friday") && semProblema.length > 300,
    `${semProblema.length} chars — é isto que torna a negação abaixo medível`,
  );
  ok("3 · …e não desenha marcador nenhum", !texto(semProblema).includes("⚠"), "o alarme é a presença, nunca a ausência");

  /* ── COM problema ────────────────────────────────────────────────────── */
  const p = problemasDaVenda({ capiStatus: CAPI_SEM_TOKEN });
  ok("3 · linha de base: o construtor produziu UM problema", p.length === 1, p[0]?.rotulo);
  const comProblema = desenhar({ problemas: p });
  const t = texto(comProblema);

  ok("3 · 🔑 o RÓTULO do problema é desenhado na linha", t.includes(p[0].rotulo), p[0].rotulo);
  ok(
    "3 · ⛔ …e ele DESALOJA a campanha — a informação vale mais que o nome dela",
    !t.includes("Black Friday"),
    "a troca não custa largura e inverte a prioridade certa",
  );
  ok(
    "3 · ⚠️ a campanha e a AÇÃO continuam alcançáveis no `title`",
    /title="[^"]*Black Friday/.test(comProblema) && /title="[^"]*Conversions API/.test(comProblema),
    "o `title` é COMPLEMENTO — o problema já está visível",
  );

  /* ⛔ WCAG 1.4.1: cor e glifo sozinhos não comunicam gravidade. O texto é o
     sinal; o ⚠ acompanha. Esta base já pagou por informação só no `title` (o
     resumo do gargalo do funil, invisível no DOM por uma sessão). */
  ok(
    "3 · ⛔ o sinal é TEXTO — o glifo só acompanha (WCAG 1.4.1)",
    t.includes("⚠") && t.includes(p[0].rotulo),
    "no toque não há hover: informação só no `title` não existe",
  );
  ok(
    "3 · …e o problema é pintado com a cor de ATENÇÃO",
    /var\(--tk-warning\)/.test(comProblema),
    "cor semântica para grandeza semântica — isto É alerta, não volume",
  );

  /* Dois problemas não cabem; sumir com o segundo seria a tela afirmando que
     só há um. O `+N` diz que há mais. */
  const dois = problemasDaVenda({ capiStatus: CAPI_SEM_TOKEN, notifStatus: NOTIF_SEM_CONFIG });
  ok("3 · linha de base: dois problemas construídos", dois.length === 2, dois.map((x) => x.chave).join(" · "));
  ok(
    "3 · com DOIS, a linha mostra o primeiro e declara o resto com `+N`",
    texto(desenhar({ problemas: dois })).includes("+1"),
    "sumir com o segundo seria a tela afirmando que só há um",
  );
}

/* ═══ 4 · O PAR ESCRITOR-LEITOR ESTÁ FECHADO ══════════════════════════════

   🔑 A asserção que dá sentido ao arquivo inteiro. Ela mede as DUAS pontas:
   quem escreve continua escrevendo, e agora existe quem leia.                */
secao("4 · 🔑 O par escritor-leitor, medido nas duas pontas");
{
  const arquivosCom = (re) =>
    globSync("src/**/*.{ts,tsx}")
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("generated/"))
      .filter((f) => re.test(semCom(ler(f))));

  const COLUNAS = /capiStatus|checkoutStatus|notifStatus/;
  const todos = arquivosCom(COLUNAS);
  ok("4 · linha de base: as colunas aparecem em `src/`", todos.length >= 2, todos.join(" · "));

  const escreve = todos.filter((f) => /data:[\s\S]{0,200}?(capiStatus|checkoutStatus|notifStatus):\s*status/.test(semCom(ler(f))));
  ok(
    "4 · o ESCRITOR continua escrevendo",
    escreve.length === 1 && escreve[0].endsWith("webhook/marcarEfeito.ts"),
    escreve.join(" · ") || "⛔ ninguém escreve — a Família 1 foi desfeita",
  );

  const le = todos.filter((f) => new RegExp("(capiStatus|checkoutStatus|notifStatus):\\s*true").test(semCom(ler(f))));
  ok(
    "4 · 🔑 …e AGORA existe quem leia",
    le.length >= 1 && le.some((f) => f.endsWith("dashboard/metrics.ts")),
    le.join(" · ") || "⛔ SÓ COM ESCRITOR — o par voltou a abrir",
  );

  /* ⛔ E a leitura tem de CHEGAR À TELA. Um `select` sem consumidor seria o
     mesmo par, um passo adiante. */
  ok(
    "4 · …e a leitura chega à TELA, não morre no DTO",
    /problemas:\s*f\.problemas/.test(semCom(ler("src/components/dashboard/useTraffikState.ts"))) &&
      /f\.problemas/.test(semCom(ler("src/components/tk/FeedVendas.tsx"))),
    "select sem consumidor seria o mesmo par, um passo adiante",
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
if (falhas.length) {
  console.log("\n\x1b[31m" + falhas.length + " falha(s):\x1b[0m\n  - " + falhas.join("\n  - "));
  process.exit(1);
}
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 3 efeitos × (bom · neutro · problema · nulo) + o par escritor-leitor nas duas pontas\n");
