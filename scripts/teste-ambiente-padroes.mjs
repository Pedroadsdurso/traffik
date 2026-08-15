/**
 * `lerPadroes` / `pareceHashUnico` — OS DOIS EXPORTS DE `pixel/ambiente.ts` SEM
 * ASSERÇÃO.
 *
 * `test:ambiente` (58 asserções) cobre `ambienteDaUrl`, `casaPadrao`,
 * `familiasDePreview` e `ambientePorPadraoAprovado` — conferido citação por
 * citação, não pelo nome do módulo. Estes dois ficaram de fora.
 *
 * ### ⚠️ CORREÇÃO DE PREMISSA — `pareceHashUnico` NÃO é guarda de privacidade
 *
 * Ela entrou na fila assim. **Medido: não é.** Ela decide se um segmento de
 * host parece hash gerado, e o efeito de dizer SIM é o host ser tratado como
 * ambiente de teste — ou seja, **o evento não vai para a CAPI**.
 *
 * O cabeçalho do módulo escreve o custo:
 *
 * > o custo do falso positivo é um evento real fora do funil e fora da CAPI […]
 * > bloquear é irreversível (o evento não vai para a CAPI e não volta)
 *
 * ⛔ Então ela é uma guarda contra **PERDER CONVERSÃO**, não contra vazar dado.
 *
 * ✅ **Mas a direção que a fila pediu está certa, e por acidente feliz:** o que
 * "passa" nesta função é o que fica BLOQUEADO depois. `pareceHashUnico(v) ===
 * true` para um segmento legítimo = host real barrado. O par negativo é mesmo
 * o que importa — só que o dano é conversão perdida, e não privacidade.
 *
 * ### 🔴 E O PAR NEGATIVO ACHOU DUAS COISAS — §2 e §3
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { lerPadroes, pareceHashUnico, casaPadrao, familiasDePreview } =
  await import("@/lib/pixel/ambiente");

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `pareceHashUnico` — o lado que ela ACERTA
 *
 * ⛔ Linha de base obrigatória: uma função que devolvesse sempre `false`
 * satisfaria todo o §2 (o par negativo) com nota máxima — e desligaria o
 * bloqueio inteiro.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · o que ela reconhece como hash");

  const HASHES = ["ahuhuv5fb", "ralhb1gzf", "ppxn74d34", "4i5mg0sx2", "a1b2c3"];
  const naoReconhecidos = HASHES.filter((h) => !pareceHashUnico(h));
  ok(
    "linha de base: os " + HASHES.length + " hashes reais são reconhecidos",
    naoReconhecidos.length === 0,
    naoReconhecidos.join(", ") || "sem isto, o §2 passaria com a função desligada",
  );

  /* O que ela recusa, e cada recusa protege um host real. */
  ok("palavra sem dígito NÃO é hash", pareceHashUnico("producao") === false);
  ok("…nem `staging`", pareceHashUnico("staging") === false);
  ok("curto demais não é hash", pareceHashUnico("a1b2c") === false, "5 caracteres");
  ok("longo demais também não", pareceHashUnico("a1b2c3d4e5f6g7h") === false, "15 caracteres");
  ok("com hífen não é (o hífen já é separador)", pareceHashUnico("a1b2-c3d4") === false);
  ok("com maiúscula não casa", pareceHashUnico("A1B2C3") === false, "o chamador minúscula antes");
  ok("vazio não é hash", pareceHashUnico("") === false);
  ok("só dígitos É hash", pareceHashUnico("123456") === true, "6 dígitos entram no formato");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · ✅ O PAR NEGATIVO — o que passava indevidamente, e o que ainda passa
 *
 * ⛔ Esta seção congelava o DEFEITO até 14/08/2026: ela afirmava que 6 de 6
 * segmentos legítimos passavam como hash. O discriminador de `palavra+número`
 * fechou 5 deles, e o que fica é UM — registrado, não escondido.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · ✅ o que deixou de passar, e o que ainda passa");

  const LEGITIMOS = ["loja2024", "verao2026", "black2024", "promo2025", "cliente1", "producao2"];
  const passam = LEGITIMOS.filter(pareceHashUnico);

  ok(
    "✅ nenhum `palavra+ano` passa mais como hash",
    passam.length === 0,
    passam.length ? "AINDA PASSAM: " + passam.join(", ") : LEGITIMOS.join(", ") + " — todos recusados",
  );
  ok(
    "e o discriminador é o DÍGITO NO FIM, não o comprimento",
    pareceHashUnico("loja2024") === false && pareceHashUnico("a1b2c3") === true,
    "`loja2024` e `a1b2c3` cabem os dois no formato; o que separa é onde os dígitos estão",
  );

  /* ⚠️ O QUE AINDA PASSA, e por quê. Dígito no MEIO é indistinguível de hash
     sem palpite sobre o hospedeiro — que é o que este módulo recusa. */
  ok(
    "⚠️ `v2loja` AINDA passa — o dígito está no meio",
    pareceHashUnico("v2loja") === true,
    "registrado, não fechado: separá-lo de um hash exigiria heurística",
  );

  /* ⛔ E a linha de base do outro lado: os hashes de verdade continuam
     reconhecidos. Sem isto, endurecer o teste até desligá-lo passaria. */
  const HASHES = ["ahuhuv5fb", "ralhb1gzf", "ppxn74d34", "4i5mg0sx2", "a1b2c3", "x1y2z3a4b5"];
  const perdidos = HASHES.filter((h) => !pareceHashUnico(h));
  ok(
    "🔑 ZERO hashes reais foram perdidos no endurecimento",
    perdidos.length === 0,
    perdidos.join(", ") || HASHES.length + " de " + HASHES.length + " continuam reconhecidos",
  );

  /* ⚠️ E o custo do endurecimento, medido e nomeado: um preview de verdade cujo
     hash termine em dígitos deixa de ser bloqueado. É o lado SEGURO — poluir um
     número é reversível com um `UPDATE`; bloquear não é. */
  ok(
    "⚠️ o custo: um hash terminado em dígitos deixa de bloquear",
    pareceHashUnico("abcdef12") === false,
    "o evento vai para a CAPI — erro para o lado reversível, que é a escolha",
  );

  /* O alcance continua sendo o padrão aprovado, e não o mundo. */
  {
    const APROVADO = "moldes-*-noahvivaryder3s-projects.vercel.app";
    ok(
      "linha de base: o padrão aprovado casa um hash de verdade",
      casaPadrao("moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app", APROVADO) === true,
    );
    ok(
      "✅ e NÃO casa mais o deploy legítimo com ano",
      casaPadrao("moldes-verao2026-noahvivaryder3s-projects.vercel.app", APROVADO) === false,
      "antes de 14/08 este evento ficava fora da CAPI, irreversivelmente",
    );
    ok(
      "…e segue não casando host de outro projeto",
      casaPadrao("loja-ahuhuv5fb-noahvivaryder3s-projects.vercel.app", APROVADO) === false,
    );
    ok(
      "…nem com contagem de segmentos diferente",
      casaPadrao("moldes-ahuhuv5fb-extra-noahvivaryder3s-projects.vercel.app", APROVADO) === false,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · ✅ A ASSIMETRIA — o caso que só o teste de PREFIXO pegava agora é pego
 *     pelos DOIS caminhos
 *
 * O módulo tem dois testes de "isto é hash?", e o de sugestão sempre teve uma
 * exigência a mais (prefixo comum entre os irmãos). Essa exigência é
 * IRREDUTÍVEL a um valor só — ela fala de um conjunto.
 *
 * ⛔ O que era o defeito não é a assimetria em si: era o caso que ela deixava
 * passar. `cliente1..3` — multi-tenant legítimo — a SUGESTÃO recusava e o
 * BLOQUEIO aceitava. Agora o discriminador de `palavra+número` o pega no
 * caminho de valor único também.
 *
 * ✅ E as duas funções passaram a compartilhar a fonte: `pareceHashes` chama
 * `pareceHashUnico` em vez de repetir o regex. Endurecer um lado só faria a
 * sugestão propor famílias que o bloqueio ignoraria.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · ✅ os dois caminhos concordam sobre o multi-tenant");

  const MULTITENANT = [
    "app-cliente1-escopo.vercel.app",
    "app-cliente2-escopo.vercel.app",
    "app-cliente3-escopo.vercel.app",
  ];
  const FAMILIA = [
    "moldes-ahuhuv5fb-escopo.vercel.app",
    "moldes-ralhb1gzf-escopo.vercel.app",
    "moldes-ppxn74d34-escopo.vercel.app",
  ];

  ok(
    "linha de base: a detecção automática ACHA famílias de verdade",
    familiasDePreview(FAMILIA).length === 1,
    "senão as asserções seguintes passariam com o detector desligado",
  );
  ok(
    "linha de base: e o padrão aprovado bloqueia essa família",
    FAMILIA.every((h) => casaPadrao(h, "moldes-*-escopo.vercel.app")),
    "senão o bloqueio estaria desligado, não corrigido",
  );

  ok(
    "a SUGESTÃO segue protegendo o multi-tenant",
    familiasDePreview(MULTITENANT).length === 0,
    "aqui quem barra é o prefixo comum — `cliente` é começo compartilhado",
  );
  ok(
    "✅ e o BLOQUEIO passou a proteger também",
    MULTITENANT.every((h) => !casaPadrao(h, "app-*-escopo.vercel.app")),
    "antes de 14/08 o mesmo trio que a detecção recusava, a ingestão barrava",
  );
  ok(
    "…pelo discriminador de valor único, não pelo prefixo",
    MULTITENANT.every((h) => !pareceHashUnico(h.split("-")[1])),
    "`cliente1` sozinho já é recusado — o prefixo não precisou entrar aqui",
  );

  /* ⚠️ A assimetria RESTANTE é irredutível, e a asserção a nomeia para não
     parecer esquecimento: o teste de prefixo fala de um CONJUNTO, e a ingestão
     recebe um host de cada vez. */
  ok(
    "⚠️ o teste de prefixo continua sendo só do caminho de conjunto",
    familiasDePreview(["a-aaaaaa1-z.app", "a-aaaaaa2-z.app", "a-aaaaaa3-z.app"]).length === 0 &&
      pareceHashUnico("aaaaaa1") === false,
    "irredutível: prefixo comum exige irmãos, e a ingestão vê um host por vez",
  );

  /* ✅ E a fonte é UMA: `pareceHashes` chama `pareceHashUnico`. */
  {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("src/lib/pixel/ambiente.ts", "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\/[^\n]*/g, "");
    ok("linha de base: sobrou código depois de apagar comentário", /function pareceHashes/.test(fonte));
    /* ⚠️ A âncora mede o CORPO da função, recortado entre a declaração e a
       chave de fechamento. A primeira versão usava uma janela de 200
       caracteres e reprovou: o apagador de comentário substitui a prosa por
       ESPAÇOS, preservando as quebras — então o comentário de seis linhas
       continua ocupando distância. Janela fixa mede o comprimento do
       comentário, não a chamada. */
    const corpo = fonte.slice(fonte.indexOf("function pareceHashes"));
    const soPareceHashes = corpo.slice(0, corpo.indexOf("\n}"));
    ok("linha de base: o corpo de `pareceHashes` foi recortado", soPareceHashes.includes("prefixoComum"));
    ok(
      "✅ `pareceHashes` CHAMA `pareceHashUnico`",
      soPareceHashes.includes("pareceHashUnico(v)"),
      "e não uma cópia do regex — endurecer um lado só as separaria",
    );
    ok(
      "⛔ e o regex de formato existe UMA vez no arquivo",
      (fonte.match(/\[a-z0-9\]\{6,14\}/g) ?? []).length === 1,
      "duas cópias concordariam hoje, e é a concordância que faz a duplicata sobreviver",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `lerPadroes` — o Json cru, e ele vem do BANCO
 *
 * `User.testHostPatterns` é `Json`. Nada garante a forma: uma escrita antiga,
 * uma migração, um `UPDATE` à mão. Um padrão malformado que atravessasse viraria
 * regra de BLOQUEIO na ingestão.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · lerPadroes");

  ok("linha de base: um padrão válido atravessa", lerPadroes([{ padrao: "a-*-b" }]).length === 1);
  ok("…com o `criadoEm` quando ele é string", lerPadroes([{ padrao: "a-*-b", criadoEm: "2026-08-14" }])[0].criadoEm === "2026-08-14");
  ok("…e sem ele quando não é", lerPadroes([{ padrao: "a-*-b", criadoEm: 42 }])[0].criadoEm === undefined);

  const LIXO = [null, undefined, 0, "", "texto", { padrao: 42 }, { padrao: "sem-curinga" }, { outro: "x" }, []];
  ok(
    "as " + LIXO.length + " formas de lixo são descartadas",
    lerPadroes(LIXO).length === 0,
    JSON.stringify(lerPadroes(LIXO)),
  );
  ok("não-array vira lista vazia", lerPadroes({ padrao: "a-*-b" }).length === 0 && lerPadroes(null).length === 0);
  ok(
    "e o lixo NÃO contamina o válido ao lado",
    lerPadroes([null, { padrao: "a-*-b" }, { padrao: 42 }]).length === 1,
    "descarta o item, não a lista — a família `entrada ruim preserva os válidos`",
  );

  /* ⛔ O `lerPadroes` aceita padrões que sozinhos seriam perigosos, e quem os
     recusa é o `casaPadrao`. As duas camadas juntas é que fecham — asserção
     sobre o PAR, porque testar só uma daria falsa garantia. */
  {
    const PERIGOSOS = ["*", "*-*-*", "-*-", "*.vercel.app"];
    const lidos = lerPadroes(PERIGOSOS.map((padrao) => ({ padrao })));
    ok(
      "⚠️ `lerPadroes` ACEITA " + lidos.length + " padrões perigosos — ele só exige o `*`",
      lidos.length === PERIGOSOS.length,
      "a validação de forma não mora aqui",
    );
    const HOSTS = ["loja.com", "a-b-c", "moldes-ahuhuv5fb-escopo.vercel.app", "x-y1z2a3-z"];
    const bloqueados = [];
    for (const p of lidos) for (const h of HOSTS) if (casaPadrao(h, p.padrao)) bloqueados.push(h + " ← " + p.padrao);
    ok(
      "✅ mas o `casaPadrao` recusa TODOS eles",
      bloqueados.length === 0,
      bloqueados.join(" · ") || "curinga único, no meio, com contagem igual — as três exigências",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
