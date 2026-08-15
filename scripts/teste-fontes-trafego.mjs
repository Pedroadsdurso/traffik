/**
 * `nomeDaFonte` / `ehFonteMeta` — O QUE DECIDE SE UMA SESSÃO CONTA NA COBERTURA
 * DO FUNIL.
 *
 * `ehFonteMeta` tem **um** consumidor, e ele é o numerador de uma razão que o
 * `CLAUDE.md` documenta em seção própria (`metrics.ts:750`):
 *
 * ```ts
 * const visitasDaMeta = w.clicks.filter((c) => ehFonteMeta(c.utmSource)).length;
 * ```
 *
 * ### 🔴 ELA EXISTE PARA CONSERTAR UMA RAZÃO SEM INTERVALO VÁLIDO
 *
 * A faixa de cobertura divide sessões por `DailyAdMetric.clicks`, que é **só da
 * Meta**. Enquanto o numerador era `Click.length` inteiro, a razão somava
 * tráfego que não pode existir no denominador — medido no dev em 13/08/2026,
 * **20 das 57 sessões (35%)** vinham de `google`, `organico` e `tiktok`.
 *
 * ⛔ Não era uma taxa ruim: era uma taxa **sem intervalo válido**, porque o
 * numerador não era subconjunto do denominador. Se `ehFonteMeta` afrouxar, a
 * razão volta a passar de 100% — e o `CLAUDE.md` registra isso como a
 * assinatura da família.
 *
 * ### 🔑 O CABEÇALHO DELA PROÍBE UMA COISA, E A PROIBIÇÃO É TESTÁVEL
 *
 * > ⛔ **Não escreva uma segunda lista de aliases aqui.** `fb`, `facebook`,
 * > `meta`, `ig` e `instagram` já vivem em `NOMES` […] Esta função **lê** o
 * > mapa; ela não o copia.
 *
 * É a família *duas fontes da mesma conta*, antecipada por quem escreveu. A §3
 * congela a proibição — e o alias de Meta vem **LIDO do arquivo**, não copiado
 * para cá: um alias novo em `NOMES` entra no teste sozinho.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { nomeDaFonte, ehFonteMeta, NOME_META } = await import("@/lib/fontes");

/**
 * Os aliases, LIDOS do módulo. ⛔ Copiá-los para cá criaria a terceira fonte —
 * e o teste passaria a medir a própria cópia em vez do mapa.
 */
const FONTE = readFileSync("src/lib/fontes.ts", "utf8").replace(/\r\n/g, "\n");
const MAPA = [...(FONTE.match(/const NOMES[^{]*\{([\s\S]*?)\n\};/) ?? [])[1].matchAll(/^\s*(\w+):\s*"([^"]+)"/gm)].map(
  (m) => ({ alias: m[1], nome: m[2] }),
);
const ALIASES_META = MAPA.filter((e) => e.nome === NOME_META).map((e) => e.alias);
const ALIASES_OUTROS = MAPA.filter((e) => e.nome !== NOME_META).map((e) => e.alias);

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — o mapa foi LIDO, e ele tem os dois lados
 *
 * ⛔ Sem isto, uma âncora quebrada devolveria lista vazia e TODA asserção de
 * "todos os aliases de Meta são reconhecidos" passaria por vacuidade. É o
 * `=== 0` com a coleção vazia, na forma de leitura de arquivo.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — o mapa foi lido do arquivo");

  ok("o mapa `NOMES` foi extraído", MAPA.length >= 10, MAPA.length + " aliases");
  ok("há aliases de Meta", ALIASES_META.length >= 4, ALIASES_META.join(", "));
  ok("e aliases que NÃO são Meta", ALIASES_OUTROS.length >= 4, ALIASES_OUTROS.join(", "));
  ok("`NOME_META` é o rótulo que o mapa usa", MAPA.some((e) => e.nome === NOME_META), NOME_META);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `nomeDaFonte` — o desconhecido volta COMO VEIO, nunca "Outro"
 *
 * É decisão escrita no módulo: o `utm_source` é texto livre e quase sempre foi
 * escrito pelo próprio usuário. Agrupar o que não reconhecemos apagaria o nome
 * que ele escolheu, e ele procuraria na tela um valor que não está mais lá.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · nomeDaFonte");

  ok("alias conhecido é traduzido", nomeDaFonte("fb") === NOME_META);
  ok("e a comparação IGNORA a caixa", nomeDaFonte("FB") === NOME_META && nomeDaFonte("FaCeBoOk") === NOME_META);
  ok("espaço em volta é aparado", nomeDaFonte("  fb  ") === NOME_META);

  const DESCONHECIDOS = ["minha-newsletter", "Parceiro X", "whatsapp", "e-mail", "FB Ads Manager"];
  const alterados = DESCONHECIDOS.filter((v) => nomeDaFonte(v) !== v);
  ok(
    "⛔ o desconhecido volta EXATAMENTE como veio",
    alterados.length === 0,
    alterados.length ? "ALTERADOS: " + JSON.stringify(alterados) : DESCONHECIDOS.length + " preservados",
  );
  ok(
    "…inclusive um que CONTÉM um alias conhecido",
    nomeDaFonte("FB Ads Manager") === "FB Ads Manager",
    "a tradução é por igualdade, não por substring — senão `FB Ads Manager` viraria Meta",
  );

  const AUSENTES = [null, undefined, "", "   "];
  ok(
    "ausência vira `Direto / Orgânico`",
    AUSENTES.every((v) => nomeDaFonte(v) === "Direto / Orgânico"),
    "e não string vazia — a tela desenharia um rótulo em branco",
  );

  /* ── PLANTIO: o balde "Outro". */
  {
    const comBalde = (v) => (MAPA.some((e) => e.alias === String(v).toLowerCase()) ? nomeDaFonte(v) : "Outro");
    ok(
      "PLANTIO (balde `Outro`): o nome que o usuário escreveu some",
      comBalde("minha-newsletter") === "Outro" && nomeDaFonte("minha-newsletter") === "minha-newsletter",
      "ele procuraria na tela um valor que não está mais lá",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · 🔴 `ehFonteMeta` — o numerador da cobertura
 *
 * As duas direções custam, e custam coisas diferentes:
 *
 *   dizer SIM a `google`  -> a razão passa de 100% e perde o intervalo válido
 *   dizer NÃO a `ig`      -> a cobertura aparece pior do que é, e o usuário
 *                            vai procurar defeito de instalação que não existe
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · 🔴 quem entra no numerador");

  const naoReconhecidos = ALIASES_META.filter((a) => !ehFonteMeta(a));
  ok(
    "🔑 TODO alias de Meta do mapa é reconhecido",
    naoReconhecidos.length === 0,
    naoReconhecidos.join(", ") || ALIASES_META.join(", ") + " — lidos do arquivo, não copiados",
  );
  ok("…e a caixa não importa", ALIASES_META.every((a) => ehFonteMeta(a.toUpperCase())));

  const vazam = ALIASES_OUTROS.filter(ehFonteMeta);
  ok(
    "🔴 nenhuma outra fonte do mapa entra como Meta",
    vazam.length === 0,
    vazam.length ? "VAZARAM: " + vazam.join(", ") : ALIASES_OUTROS.join(", ") + " — todas fora",
  );

  /* Os três que o `CLAUDE.md` mede como 35% das sessões do dev. */
  const OS_TRES = ["google", "organico", "tiktok"];
  ok(
    "🔴 `google`, `organico` e `tiktok` ficam FORA",
    OS_TRES.every((v) => !ehFonteMeta(v)),
    "eram 20 das 57 sessões do dev — tráfego que não pode existir no denominador",
  );
  ok("e a ausência de fonte também fica fora", !ehFonteMeta(null) && !ehFonteMeta("") && !ehFonteMeta(undefined));
  ok(
    "…assim como um nome livre do usuário",
    !ehFonteMeta("minha-newsletter") && !ehFonteMeta("FB Ads Manager"),
    "`FB Ads Manager` contém `FB` e mesmo assim não entra",
  );

  /* ── PLANTIO A: `ehFonteMeta` frouxo — qualquer fonte não nula conta.
     É a regressão exata que a função existe para impedir. */
  {
    const frouxo = (v) => !!v && String(v).trim() !== "";
    const contamina = [...OS_TRES, "minha-newsletter"].filter(frouxo);
    ok(
      "PLANTIO A: a razão volta a somar tráfego de fora da Meta",
      contamina.length === 4 && contamina.every((v) => !ehFonteMeta(v)),
      "o numerador deixa de ser subconjunto do denominador, e a taxa perde o intervalo",
    );
    ok("PLANTIO A: a asserção da §2 DERRUBA", frouxo("google") !== ehFonteMeta("google"));
  }

  /* ── PLANTIO B: por SUBSTRING em vez de igualdade — o "conserto" de quem quer
     pegar `FB Ads` e `Facebook Ads` escritos à mão. */
  {
    const porSubstring = (v) => !!v && /fb|face|meta|insta|^ig$/i.test(String(v));
    ok(
      "PLANTIO B: `FB Ads Manager` passaria a contar como Meta",
      porSubstring("FB Ads Manager") === true && ehFonteMeta("FB Ads Manager") === false,
      "e o nome livre do usuário entraria no numerador de uma razão da Meta",
    );
    /* PAR NEGATIVO: nos aliases do mapa as duas versões concordam — a
       divergência mora só no texto livre, que é o que ninguém testa à mão. */
    ok(
      "PAR NEGATIVO: nos " + ALIASES_META.length + " aliases do mapa as duas concordam",
      ALIASES_META.every((a) => porSubstring(a) === ehFonteMeta(a)),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · ⛔ A PROIBIÇÃO DO CABEÇALHO — uma lista só, e ela é a do `NOMES`
 *
 * *"Não escreva uma segunda lista de aliases aqui […] esta função LÊ o mapa;
 * ela não o copia."* Proibição escrita é afirmação testável — e é a família
 * que esta base registra como *duas fontes da mesma conta*.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · ⛔ uma lista só");

  const semCom = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");
  const codigo = semCom(FONTE);

  ok("linha de base: sobrou código depois de apagar comentário", /export function ehFonteMeta/.test(codigo));
  ok(
    "linha de base: e o apagador removeu volume",
    FONTE.length - codigo.replace(/ /g, "").length > 1500,
    FONTE.length + " bytes crus × " + codigo.replace(/ /g, "").length + " de código",
  );

  const corpo = codigo.slice(codigo.indexOf("export function ehFonteMeta"));
  const soEla = corpo.slice(0, corpo.indexOf("\n}"));

  ok(
    "⛔ o corpo de `ehFonteMeta` não cita alias nenhum",
    !ALIASES_META.some((a) => new RegExp('"' + a + '"').test(soEla)),
    "ele compara o RESULTADO de `nomeDaFonte` com `NOME_META`",
  );
  ok(
    "…e ele DERIVA de `nomeDaFonte`",
    /nomeDaFonte\(/.test(soEla) && /NOME_META/.test(soEla),
    soEla.trim().split("\n").pop().trim(),
  );
  ok(
    "o rótulo `Meta Ads` é escrito UMA vez fora do mapa",
    (codigo.match(/"Meta Ads"/g) ?? []).filter(() => true).length ===
      MAPA.filter((e) => e.nome === NOME_META).length + 1,
    "as N do mapa + a constante `NOME_META` — nenhuma cópia solta",
  );

  /* ── PLANTIO: a segunda lista, exatamente como o cabeçalho proíbe. */
  {
    const comLista = (v) => ["fb", "facebook", "meta", "ig", "instagram"].includes(String(v ?? "").toLowerCase());
    ok(
      "PLANTIO: a lista copiada CONCORDA com o mapa hoje",
      ALIASES_META.every((a) => comLista(a) === ehFonteMeta(a)),
      "e é a concordância que faria a duplicata sobreviver",
    );
    ok(
      "PLANTIO: …e divergiria no primeiro alias novo",
      comLista("fb-ads") === false && ["fb-ads"].every((a) => !ALIASES_META.includes(a)),
      "um alias acrescentado em `NOMES` não entraria na cópia — defeito mudo",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log(
  "   denominador: " + MAPA.length + " aliases lidos do mapa · " + ALIASES_META.length + " de Meta · " + ALIASES_OUTROS.length + " de outras\n",
);
