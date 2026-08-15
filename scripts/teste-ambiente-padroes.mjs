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
 * 2 · 🔴 O PAR NEGATIVO — segmento LEGÍTIMO que passa como hash
 *
 * O critério é `[a-z0-9]{6,14}` **com ao menos um dígito**. Nome de campanha
 * com ano cabe nele inteiro.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · 🔴 o que passa indevidamente");

  const LEGITIMOS = ["loja2024", "verao2026", "black2024", "promo2025", "cliente1", "v2loja"];
  const passam = LEGITIMOS.filter(pareceHashUnico);

  ok(
    "🔴 " + passam.length + " de " + LEGITIMOS.length + " segmentos legítimos passam como hash",
    passam.length >= 5,
    passam.join(", ") + " — nome de campanha com ano cabe no formato inteiro",
  );
  ok(
    "e `producao` só escapa por não ter DÍGITO",
    pareceHashUnico("producao") === false && pareceHashUnico("producao2") === true,
    "o exemplo do cabeçalho do módulo é seguro por um caractere",
  );

  /* ⚠️ O alcance NÃO é o mundo: o host precisa casar um padrão APROVADO pelo
     usuário, com a mesma contagem de segmentos e todos os fixos idênticos.
     Sem isso a §2 seria alarme falso — e alarme falso desacredita a lista. */
  {
    const APROVADO = "moldes-*-noahvivaryder3s-projects.vercel.app";
    ok(
      "linha de base: o padrão aprovado casa um hash de verdade",
      casaPadrao("moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app", APROVADO) === true,
    );
    ok(
      "🔴 e casa TAMBÉM um segmento legítimo com ano",
      casaPadrao("moldes-verao2026-noahvivaryder3s-projects.vercel.app", APROVADO) === true,
      "um deploy real com esse nome ficaria fora da CAPI, irreversivelmente",
    );
    ok(
      "…mas não casa host de outro projeto",
      casaPadrao("loja-verao2026-noahvivaryder3s-projects.vercel.app", APROVADO) === false,
      "o alcance é o padrão aprovado, não o mundo",
    );
    ok(
      "…nem com contagem de segmentos diferente",
      casaPadrao("moldes-verao2026-extra-noahvivaryder3s-projects.vercel.app", APROVADO) === false,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · 🔴 A ASSIMETRIA — o caminho IRREVERSÍVEL usa a guarda MAIS FRACA
 *
 * O módulo tem dois testes de "isto é hash?":
 *
 * | | onde | testa |
 * |---|---|---|
 * | `pareceHashes` (privado) | `familiasDePreview` — SUGERE, e espera aprovação | formato **+ prefixo comum** |
 * | `pareceHashUnico` (export) | `casaPadrao` — BLOQUEIA na ingestão | só o formato |
 *
 * ⛔ O de sugestão é o mais rigoroso; o que decide o bloqueio irreversível é o
 * mais frouxo. É o inverso da ordem que se esperaria.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · 🔴 a guarda forte está no caminho reversível");

  const MULTITENANT = [
    "app-cliente1-escopo.vercel.app",
    "app-cliente2-escopo.vercel.app",
    "app-cliente3-escopo.vercel.app",
  ];

  ok(
    "linha de base: a detecção automática ACHA famílias de verdade",
    familiasDePreview([
      "moldes-ahuhuv5fb-escopo.vercel.app",
      "moldes-ralhb1gzf-escopo.vercel.app",
      "moldes-ppxn74d34-escopo.vercel.app",
    ]).length === 1,
    "senão a asserção seguinte passaria com o detector desligado",
  );

  ok(
    "✅ a SUGESTÃO protege o multi-tenant: `cliente1..3` não vira família",
    familiasDePreview(MULTITENANT).length === 0,
    "o teste de prefixo comum barra — `cliente` é começo compartilhado",
  );
  ok(
    "🔴 mas o padrão APROVADO bloqueia cada um deles",
    MULTITENANT.every((h) => casaPadrao(h, "app-*-escopo.vercel.app")),
    "o mesmo trio que a detecção recusa, a regra de ingestão barra",
  );
  ok(
    "…e a diferença é só o teste de PREFIXO COMUM, que o `pareceHashUnico` não tem",
    pareceHashUnico("cliente1") && pareceHashUnico("cliente2") && pareceHashUnico("cliente3"),
    "os três passam sozinhos; juntos, o `pareceHashes` os recusaria",
  );

  console.log(
    "\n   \x1b[33m⚠️  REGISTRADO, NÃO CORRIGIDO. Fechar exigiria o teste de prefixo\n" +
      "      no `casaPadrao`, e ele não tem os irmãos à mão — o padrão aprovado\n" +
      "      chega sozinho na ingestão. É decisão de produto: hoje o usuário\n" +
      "      aprova o molde e assume o alcance dele.\x1b[0m",
  );
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
