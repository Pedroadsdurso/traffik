/**
 * `ehIpAnonimizado` · `podeIrParaCapi` · `normalizarPais` — AS TRÊS PORTEIRAS
 * DE `geo/`, e por que elas estavam fora do `npm test`.
 *
 * ### 🔴 A MEDIÇÃO QUE MUDOU O ENQUADRAMENTO
 *
 * `anonimizarIp`, `candidatosDeIp` e `podeIrParaCapi` **têm** asserção — em
 * `teste-match-ip.mjs`. Só que aquele arquivo está em **`test:banco`**, e não
 * no `npm test`:
 *
 * ```
 * test:match no npm test   ->  false
 * test:match no test:banco ->  true
 * ```
 *
 * `test:banco` é separado de propósito (um agregado que exige banco não roda em
 * máquina limpa). ⛔ **Mas as três funções aqui são PURAS.** A guarda que
 * decide se um IP vai em claro para a Meta só é exercida por quem tiver um
 * Postgres de dev à mão — e `ehIpAnonimizado`, que decide o que a purga pula,
 * não tem asserção nenhuma em lugar nenhum.
 *
 * > ## Teste de função pura escondido atrás de um requisito de banco é teste que quase ninguém roda.
 *
 * É a família *teste que existe e nunca rodou*, na versão mais branda: ele
 * roda, mas só no agregado que exige infraestrutura. Este arquivo põe a parte
 * PURA no `npm test`, sem tirar nada de lá.
 *
 * ### ⚠️ CORREÇÃO DE PREMISSA — só UMA das duas é guarda de privacidade
 *
 * A fila pôs `pareceHashUnico` e `ehIpAnonimizado` juntas como "guardas de
 * privacidade". Medido:
 *
 * | | dizer SIM indevidamente causa |
 * |---|---|
 * | `pareceHashUnico` | evento real **fora da CAPI** — conversão perdida (ver `test:ambiente-padroes`) |
 * | `ehIpAnonimizado` | 🔴 a purga **PULA a linha**, e o IP fica em claro para sempre |
 *
 * ✅ **A direção que a fila pediu vale para as duas**, e para esta é literal: o
 * que passa indevidamente é o defeito, e o defeito é privacidade.
 *
 * ⚠️ E o lado oposto também custa: dizer NÃO para um hash faz `anonimizarIp`
 * **re-hashear**, o valor muda a cada execução e o `matchClick` para de casar —
 * em silêncio. Os dois lados têm asserção.
 */

import assert from "node:assert/strict";

/* A chave entra no hash. Falsa e local — o `CLAUDE.md` proíbe segredo real em
   arquivo versionado, e nada aqui toca banco. */
process.env.ENCRYPTION_KEY = "teste-nao-e-a-chave-de-producao-0000000000";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { anonimizarIp, ehIpAnonimizado, podeIrParaCapi, candidatosDeIp, RETENCAO_DIAS } =
  await import("@/lib/geo/anonimizarIp");
const { normalizarPais } = await import("@/lib/geo/pais");

const IPS = ["200.160.2.3", "8.8.8.8", "2001:db8::1", "::1", "192.168.0.1"];

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — a anonimização faz alguma coisa
 *
 * ⛔ Sem isto, um `anonimizarIp` que devolvesse a entrada intacta satisfaria a
 * idempotência da §1 com nota máxima — e não anonimizaria nada.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base");

  const anon = anonimizarIp("200.160.2.3");
  ok("o anonimizado NÃO é o IP", anon !== "200.160.2.3", anon.slice(0, 20) + "…");
  ok("e o IP não aparece dentro dele", !anon.includes("200.160.2.3"));
  ok("ele carrega o envelope `iph.v1.`", anon.startsWith("iph.v1."));
  ok("`RETENCAO_DIAS` é um prazo utilizável", Number.isInteger(RETENCAO_DIAS) && RETENCAO_DIAS > 0, RETENCAO_DIAS + " dias");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · 🔴 `ehIpAnonimizado` — O PAR NEGATIVO É O QUE IMPORTA
 *
 * Ela tem dois consumidores, e cada um paga por um lado do erro:
 *
 *   `anonimizarIp`      dizer NÃO a um hash  -> re-hasheia, e o match quebra
 *   o `where` do cron   dizer SIM a um IP    -> a purga PULA, e o IP fica
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · 🔴 a porteira da purga");

  /* ── O lado que a fila pediu: o que passa indevidamente. */
  const EM_CLARO = [
    ...IPS,
    "iph",
    "iph.",
    "iph.v",
    "iph.v2.abc",
    "IPH.V1.ABC",
    " iph.v1.abc",
    "x-iph.v1.abc",
    "",
  ];
  const passam = EM_CLARO.filter((v) => ehIpAnonimizado(v));
  ok(
    "🔴 nenhum valor NÃO-anonimizado passa como anonimizado",
    passam.length === 0,
    passam.length ? "PASSARAM: " + JSON.stringify(passam) : "cada um destes ficaria em claro para sempre",
  );
  ok("null não passa", ehIpAnonimizado(null) === false);
  ok("undefined não passa", ehIpAnonimizado(undefined) === false);
  ok(
    "e o prefixo tem de estar NO COMEÇO",
    ehIpAnonimizado("x-iph.v1.abc") === false,
    "um valor que só CONTÉM a marca é texto cru — e texto cru fica em claro",
  );
  ok(
    "a versão do envelope é EXATA",
    ehIpAnonimizado("iph.v2.abc") === false,
    "um envelope de outra versão não pode ser dado como purgado",
  );

  /* ── O lado oposto: dizer NÃO a um hash. */
  const anonimizados = IPS.map(anonimizarIp);
  ok(
    "linha de base: os " + IPS.length + " anonimizados SÃO reconhecidos",
    anonimizados.every(ehIpAnonimizado),
    "senão a idempotência abaixo passaria sem exercer nada",
  );

  /* ── PLANTIO A: reconhecer por `includes` em vez de `startsWith`. */
  {
    const frouxo = (v) => typeof v === "string" && v.includes("iph.v1.");
    ok(
      "PLANTIO A (`includes`): um valor com a marca no MEIO vira `purgado`",
      frouxo("x-iph.v1.abc") === true && ehIpAnonimizado("x-iph.v1.abc") === false,
      "a purga o pularia, e ele nunca seria anonimizado",
    );
    /* PAR NEGATIVO: sobre hash de verdade e IP comum as duas versões
       concordam. A divergência mora só no valor esquisito — que é justamente
       o que ninguém cria de propósito e por isso ninguém testa. */
    const comuns = [...anonimizados, ...IPS];
    ok(
      "PAR NEGATIVO: nas " + comuns.length + " entradas comuns as duas concordam",
      comuns.every((v) => frouxo(v) === ehIpAnonimizado(v)),
    );
  }

  /* ── PLANTIO B: a guarda sumindo de dentro do `anonimizarIp`. */
  {
    const semGuarda = (ip) => anonimizarIp(ip + "");
    const uma = anonimizarIp("200.160.2.3");
    ok(
      "PLANTIO B: sem a guarda, re-hashear muda o valor",
      semGuarda(uma) === uma,
      "…e AQUI ela está presente, então não muda — é a asserção da idempotência",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · IDEMPOTÊNCIA E DETERMINISMO — o que a purga e o match exigem
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · idempotência e determinismo");

  const naoIdempotentes = IPS.filter((ip) => anonimizarIp(anonimizarIp(ip)) !== anonimizarIp(ip));
  ok(
    "anonimizar o já-anonimizado devolve o MESMO valor",
    naoIdempotentes.length === 0,
    naoIdempotentes.join(", ") || "sem isto o hash mudaria a cada execução do cron",
  );

  ok(
    "e o hash é DETERMINÍSTICO",
    anonimizarIp("200.160.2.3") === anonimizarIp("200.160.2.3"),
    "é a igualdade de que o `matchClick` depende — o oposto do IV aleatório dos segredos",
  );
  ok("IPs diferentes dão hashes diferentes", anonimizarIp("8.8.8.8") !== anonimizarIp("8.8.4.4"));
  ok(
    "espaço e caixa não mudam o hash",
    anonimizarIp(" 200.160.2.3 ") === anonimizarIp("200.160.2.3") &&
      anonimizarIp("2001:DB8::1") === anonimizarIp("2001:db8::1"),
    "senão o mesmo visitante teria dois hashes",
  );

  /* `candidatosDeIp` é a outra ponta: ele existe para o match casar
     independentemente de a linha já ter sido purgada. */
  ok("IP em claro gera os DOIS candidatos", candidatosDeIp("8.8.8.8").length === 2);
  ok("…e o segundo é o anonimizado dele", candidatosDeIp("8.8.8.8")[1] === anonimizarIp("8.8.8.8"));
  ok("IP já anonimizado gera UM", candidatosDeIp(anonimizarIp("8.8.8.8")).length === 1);
  ok("nulo e vazio não geram nenhum", candidatosDeIp(null).length === 0 && candidatosDeIp("  ").length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · 🔴 `podeIrParaCapi` — A GUARDA QUE NÃO CONFIA NO PREFIXO
 *
 * O cabeçalho dela diz por quê: a Meta **recusa** `client_ip_address`
 * hasheado, e mandar um hash ali *"degrada em silêncio a correspondência de
 * todo `Purchase`"*. Então ela não pergunta "tem o prefixo?" — pergunta
 * **"parece um IP?"**, o que barra qualquer lixo, não só o nosso envelope.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · 🔴 o que pode ir para a Meta");

  const VALIDOS = ["200.160.2.3", "8.8.8.8", "2001:db8::1", "::1"];
  ok("linha de base: IP de verdade passa", VALIDOS.every(podeIrParaCapi), VALIDOS.length + " de " + VALIDOS.length);
  ok("…e com espaço em volta também", podeIrParaCapi("  8.8.8.8  ") === true);

  const BARRADOS = [
    anonimizarIp("8.8.8.8"),
    "a".repeat(64),
    "iph.v1.deadbeef",
    "unknown",
    "",
    "   ",
    null,
    undefined,
    "999.999.999.999",
    "8.8.8",
  ];
  const vazam = BARRADOS.filter((v) => podeIrParaCapi(v));
  ok(
    "🔴 nenhum valor não-IP vaza para a CAPI",
    vazam.length === 0,
    vazam.length ? "VAZARAM: " + JSON.stringify(vazam) : BARRADOS.length + " formas barradas",
  );

  /* ⛔ E a guarda tem de barrar o hash SEM depender do prefixo — é o que o
     cabeçalho promete, e é afirmação de efeito, portanto asserção. */
  ok(
    "o hash é barrado por PARECER lixo, não pelo prefixo",
    podeIrParaCapi("a".repeat(64)) === false && !ehIpAnonimizado("a".repeat(64)),
    "um sha-256 nu, sem envelope nenhum, também não passa",
  );

  /* ── PLANTIO: a guarda passando a confiar no prefixo. */
  {
    const pelaMarca = (v) => typeof v === "string" && v.trim() !== "" && !ehIpAnonimizado(v);
    ok(
      "PLANTIO: pelo prefixo, um sha-256 nu IRIA para a Meta",
      pelaMarca("a".repeat(64)) === true && podeIrParaCapi("a".repeat(64)) === false,
      "e a Meta degradaria a correspondência de todo Purchase, sem erro",
    );
    ok(
      "PLANTIO: `unknown` também iria",
      pelaMarca("unknown") === true,
      "qualquer texto que não seja o nosso envelope passaria",
    );
    ok(
      "PAR NEGATIVO: sobre IP real e sobre o NOSSO hash as duas concordam",
      [...VALIDOS, anonimizarIp("8.8.8.8")].every((v) => pelaMarca(v) === podeIrParaCapi(v)),
      "os dois casos que alguém testaria à mão não denunciam nada",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `normalizarPais` — o portão entre `payload` (força 4) e `payload_cru` (0)
 *
 * Três linhas, e elas decidem se o país declarado pelo gateway vira MEDIÇÃO ou
 * texto sem valor. `test:sobrescrita-fonte` congela a hierarquia; aqui fica
 * quem entra nela.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · normalizarPais");

  ok("ISO-2 passa", normalizarPais("BR") === "BR");
  ok("minúscula é normalizada", normalizarPais("br") === "BR");
  ok("espaço é aparado", normalizarPais("  br  ") === "BR");

  const RECUSADOS = ["Brasil", "BRA", "B", "", "  ", "B1", "12", "br-SP", null, undefined, "BRASIL"];
  const passam = RECUSADOS.filter((v) => normalizarPais(v) !== null);
  ok(
    "o que NÃO é ISO-2 vira `null`",
    passam.length === 0,
    passam.length ? "PASSARAM: " + JSON.stringify(passam) : RECUSADOS.length + " formas recusadas",
  );
  ok(
    "⚠️ `BRA` (ISO-3) é recusado, e isso é a decisão",
    normalizarPais("BRA") === null,
    "três letras não são ISO-2 — vira `payload_cru`, força 0, e não sobrescreve medição",
  );
  ok(
    "e `null` NÃO é `\"\"` — a ausência atravessa como ausência",
    normalizarPais(null) === null && normalizarPais("") === null,
  );
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: " + IPS.length + " IPs · as 3 porteiras, agora no `npm test` e não só no `test:banco`\n");
