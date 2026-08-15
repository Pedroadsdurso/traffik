/**
 * `mapAccountStatus` — A PROJEÇÃO GROSSA DO `account_status` DA META.
 *
 * Quatro pontos de escrita (`auth/facebook/callback` ×2, `facebook/sync` ×2),
 * e ela decide o `AdAccount.status` que vai para o banco. **Zero asserções até
 * 14/08/2026** — e ela não é citada por `test:conta-meta`, que cobre
 * `contaStatus.ts` e `erroMeta.ts`, conferido na lista de import daquele
 * arquivo.
 *
 * ### 🔑 A RELAÇÃO QUE IMPORTA É COM O MÓDULO JÁ TESTADO
 *
 * `estadoDaConta` (coberto) lê o **código CRU** e conhece dez estados:
 * `ACTIVE`, `DISABLED`, `UNSETTLED`, `PENDING_RISK_REVIEW`, `CLOSED`… A
 * `mapAccountStatus` colapsa o mesmo código em **três**. Os dois valores
 * convivem no banco (`status` e `accountStatus Int?`), então nada se perde —
 * mas eles podem se CONTRADIZER.
 *
 * > ## A invariante: nada que a Meta diz que não pode rodar (`sincroniza: false`) pode virar `ACTIVE`.
 *
 * Ela não conhece código nenhum: a lista de códigos é **derivada** do
 * `estadoDaConta`, sondando o intervalo. Copiar a tabela mediria a cópia.
 *
 * ### ⚠️ E A PROJEÇÃO PERDE INFORMAÇÃO EM TRÊS PONTOS — medidos, não corrigidos
 *
 * Congelados na §3 porque são o que alguém tentaria "arrumar" sem saber que a
 * tela já não depende deles.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { mapAccountStatus } = await import("@/lib/facebook/graph");
const { estadoDaConta, podeRastrear } = await import("@/lib/facebook/contaStatus");

/** Os códigos que o `estadoDaConta` NOMEIA — derivados, não copiados. */
const NOMEADOS = [];
for (let c = 0; c <= 400; c++) if (!estadoDaConta(c).chave.startsWith("DESCONHECIDO")) NOMEADOS.push(c);

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — há hierarquia dos dois lados
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base");

  ok(
    "o `estadoDaConta` nomeia " + NOMEADOS.length + " códigos",
    NOMEADOS.length >= 8,
    NOMEADOS.map((c) => c + "=" + estadoDaConta(c).chave).join(" · "),
  );
  ok(
    "e entre eles há quem sincroniza E quem não",
    NOMEADOS.some((c) => estadoDaConta(c).sincroniza) && NOMEADOS.some((c) => !estadoDaConta(c).sincroniza),
    NOMEADOS.filter((c) => !estadoDaConta(c).sincroniza).join(", ") + " não sincronizam",
  );

  const saidas = new Set(NOMEADOS.map(mapAccountStatus));
  ok(
    "a projeção produz mais de um valor",
    saidas.size >= 3,
    [...saidas].join(", ") + " — senão ela não projetaria nada",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · TOTALIDADE, E A DÚVIDA NÃO VIRA `ACTIVE`
 *
 * ⛔ A direção importa: um código novo da Meta (ela acrescenta sem avisar) tem
 * de cair em `UNKNOWN`, nunca em `ACTIVE`. Aqui a dúvida vira "não sei", que é
 * o oposto do `podeRastrear` — e o contraste é deliberado: lá o risco é
 * impedir alguém de rastrear conta que funciona; aqui, afirmar que uma conta
 * está ativa sem saber.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · totalidade e a direção do desconhecido");

  const VALIDOS = ["ACTIVE", "PAUSED", "UNKNOWN"];
  const amostra = [];
  for (let c = -5; c <= 400; c++) amostra.push(c);
  amostra.push(999, 100000, -100000, 1.5, Number.MAX_SAFE_INTEGER);

  const foraDaLista = amostra.filter((c) => !VALIDOS.includes(mapAccountStatus(c)));
  ok("os " + amostra.length + " códigos caem num dos três", foraDaLista.length === 0, foraDaLista.join(", "));

  const ativos = amostra.filter((c) => mapAccountStatus(c) === "ACTIVE");
  ok(
    "🔴 SÓ UM código vira `ACTIVE`",
    ativos.length === 1 && ativos[0] === 1,
    "é o " + ativos.join(", ") + " — todo código novo da Meta cai em `UNKNOWN`",
  );
  ok("e `1` é o que o `estadoDaConta` também chama de ACTIVE", estadoDaConta(1).chave === "ACTIVE");
  ok("um código fracionário não vira ACTIVE", mapAccountStatus(1.5) === "UNKNOWN");
  ok("nem um negativo", mapAccountStatus(-1) === "UNKNOWN");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · A INVARIANTE CRUZADA — o módulo testado é a referência
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · nada que não sincroniza vira ACTIVE");

  const naoSincronizam = NOMEADOS.filter((c) => !estadoDaConta(c).sincroniza);
  ok(
    "linha de base: " + naoSincronizam.length + " códigos NÃO sincronizam",
    naoSincronizam.length >= 3,
    naoSincronizam.map((c) => c + "=" + estadoDaConta(c).chave).join(" · "),
  );

  const violam = naoSincronizam.filter((c) => mapAccountStatus(c) === "ACTIVE");
  ok("nenhum deles vira `ACTIVE`", violam.length === 0, violam.join(", "));

  /* E a outra ponta do par: `podeRastrear` e a projeção não podem se contradizer
     no sentido perigoso — conta que não pode rastrear não pode sair ACTIVE. */
  const contradizem = NOMEADOS.filter((c) => !podeRastrear(c) && mapAccountStatus(c) === "ACTIVE");
  ok("nem nenhum que `podeRastrear` recusa", contradizem.length === 0, contradizem.join(", "));

  /* ── PLANTIO A: `UNKNOWN` virando `ACTIVE` ("na dúvida, deixa ativa"). */
  {
    const plantio = (s) => (s === 2 || s === 3 ? "PAUSED" : "ACTIVE");
    const quebra = naoSincronizam.filter((c) => plantio(c) === "ACTIVE");
    ok(
      "PLANTIO A (padrão ACTIVE): conta ENCERRADA sairia ativa",
      quebra.length > 0,
      quebra.map((c) => c + "=" + estadoDaConta(c).chave).join(" · "),
    );
    ok("PLANTIO A: a invariante DERRUBA", quebra.length > 0);
  }

  /* ── PLANTIO B: `2` e `3` virando `ACTIVE` — o "conserto" de quem nota que
     conta desabilitada some do filtro de ativas. */
  {
    const plantio = (s) => (s === 1 || s === 2 || s === 3 ? "ACTIVE" : "UNKNOWN");
    ok(
      "PLANTIO B: a conta DESABILITADA pela Meta sairia ativa",
      plantio(2) === "ACTIVE" && !estadoDaConta(2).sincroniza,
      "`" + estadoDaConta(2).chave + "`, tom " + estadoDaConta(2).tom,
    );
    ok("PLANTIO B: a invariante DERRUBA", plantio(2) === "ACTIVE" && mapAccountStatus(2) !== "ACTIVE");
    /* PAR NEGATIVO: sobre o código 1 — o caso comum, e o único que alguém
       testaria com uma conta real — as duas versões concordam. */
    ok(
      "PAR NEGATIVO: no código 1 as duas versões concordam",
      plantio(1) === mapAccountStatus(1),
      "uma conta saudável não denuncia nenhum dos dois plantios",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · ⚠️ ONDE A PROJEÇÃO PERDE INFORMAÇÃO — medido, NÃO corrigido
 *
 * As três divergências abaixo não são defeito hoje **porque a tela não usa
 * `status`**: ela deriva rótulo, tom e ação de `accountStatus` (o código cru),
 * em `useTraffikState`. A §4 congela isso — é o que torna a perda inofensiva.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · ⚠️ o que a projeção perde");

  ok(
    "⚠️ `2` é DESABILITADA pela Meta e sai como `PAUSED`",
    estadoDaConta(2).tom === "erro" && mapAccountStatus(2) === "PAUSED",
    "`PAUSED` na tela se lê como escolha do usuário, e não foi",
  );
  ok(
    "⚠️ `3` PODE sincronizar e também sai como `PAUSED`",
    estadoDaConta(3).sincroniza === true && mapAccountStatus(3) === "PAUSED",
    "`" + estadoDaConta(3).chave + "` — a conta roda, e a projeção diz que não",
  );

  const ativosPelaTabela = NOMEADOS.filter((c) => estadoDaConta(c).tom === "ok");
  const perdidos = ativosPelaTabela.filter((c) => mapAccountStatus(c) !== "ACTIVE");
  ok(
    "linha de base: " + ativosPelaTabela.length + " códigos são `ok` na tabela rica",
    ativosPelaTabela.length >= 2,
    ativosPelaTabela.map((c) => c + "=" + estadoDaConta(c).chave).join(" · "),
  );
  ok(
    "⚠️ e nem todo `ok` vira `ACTIVE` na projeção",
    perdidos.length > 0,
    perdidos.map((c) => c + "=" + estadoDaConta(c).chave + " → " + mapAccountStatus(c)).join(" · "),
  );

  /* O encerramento não tem valor próprio na projeção. */
  const encerrados = NOMEADOS.filter((c) => estadoDaConta(c).chave.includes("CLOSURE") || estadoDaConta(c).chave.includes("CLOSED"));
  ok(
    "⚠️ conta ENCERRADA é indistinguível de código desconhecido",
    encerrados.length > 0 && encerrados.every((c) => mapAccountStatus(c) === "UNKNOWN"),
    encerrados.map((c) => c + "=" + estadoDaConta(c).chave).join(" · ") + " — todos `UNKNOWN`",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · O QUE TORNA A PERDA INOFENSIVA — a tela usa o código CRU
 *
 * ⛔ Esta é a asserção que sustenta a §3. Se a tela voltasse a derivar o rótulo
 * de `status`, as três perdas viriam junto — e apareceriam como conta
 * "pausada" que a Meta desabilitou.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · a tela deriva do código CRU");

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
  const hook = semCom(readFileSync("src/components/dashboard/useTraffikState.ts", "utf8"));

  ok("linha de base: o hook chama `estadoDaConta` no CÓDIGO", /estadoDaConta\(/.test(hook));
  ok(
    "e passa o `accountStatus` CRU, não o `status`",
    /estadoDaConta\(ac\.accountStatus\)/.test(hook) && !/estadoDaConta\(ac\.status\)/.test(hook),
    "é o que dá à tela os dez estados em vez dos três",
  );

  /* E os quatro pontos de escrita continuam sendo os quatro. Um quinto é
     informação: alguém passou a gravar `status` por outro caminho. */
  {
    const { globSync } = await import("node:fs");
    const escritores = globSync("src/**/*.{ts,tsx}")
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("generated") && !f.endsWith("lib/facebook/graph.ts"))
      .filter((f) => /mapAccountStatus\(/.test(semCom(readFileSync(f, "utf8"))));
    ok(
      "os pontos de escrita continuam sendo 2 arquivos",
      escritores.length === 2,
      escritores.join(" · "),
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log(
  "   denominador: " + NOMEADOS.length + " códigos nomeados pela tabela rica · 3 valores na projeção\n",
);
