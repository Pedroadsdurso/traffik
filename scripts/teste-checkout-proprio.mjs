/**
 * OS PASSOS DO CHECKOUT PRÓPRIO — 101 linhas que o desenvolvedor do cliente
 * COPIA E COLA no servidor dele, e que ninguém verificava.
 *
 * > ### 🔴 POR QUE ISTO PRECISA DE TESTE, se é "só texto"
 * >
 * > Não é texto: são dois trechos de CÓDIGO que saem da nossa tela e entram no
 * > checkout de outra pessoa. Errado, o modo de falha é o pior desta base — o
 * > **artefato válido de contexto errado**: a cobrança é criada, a venda entra,
 * > o faturamento bate. Só a campanha e o país ficam vazios, e isso só é notado
 * > quando alguém compara o total com a soma das campanhas.
 *
 * ## As três coisas que só o teste responde
 *
 * | | |
 * |---|---|
 * | o campo é `click_id`, **nunca `sck`** | o parser lê os dois, em destinos diferentes — `sck` grava a string e não casa clique nenhum |
 * | o leitor do cookie casa com o cookie que o NOSSO script ESCREVE | nome e campo estão em arquivos diferentes, e ninguém liga um ao outro |
 * | o IP sai do FIM da cadeia | o começo do `X-Forwarded-For` é o que o cliente controla, e o país sairia forjado |
 *
 * Puro: sem banco, sem rede, sem navegador — o `document` é falso.
 *
 *   npm run test:checkout-proprio
 */
import assert from "node:assert/strict";

const { PASSOS_CHECKOUT_PROPRIO, CAMPO_CLICK_ID } = await import(
  "../src/lib/pixel/checkoutProprio.ts"
);
const { utmScript } = await import("../src/lib/utm/scripts.ts");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

const CODIGO = PASSOS_CHECKOUT_PROPRIO.map((p) => p.codigo ?? "").join("\n");

/* ═══════════════════════ 1 · A forma dos passos ════════════════════════════ */

console.log("\n\x1b[1mCada passo diz o que acontece se ele ficar de FORA\x1b[0m");

checar("linha de base: existem passos, e mais de um tem código", () => {
  // `every` sobre lista vazia é `true`: sem esta linha, todo o resto passaria
  // com a constante apagada.
  assert.ok(PASSOS_CHECKOUT_PROPRIO.length >= 3, `só ${PASSOS_CHECKOUT_PROPRIO.length} passo(s)`);
  assert.ok(PASSOS_CHECKOUT_PROPRIO.filter((p) => p.codigo).length >= 2, "quase nenhum tem código");
});

checar("🔴 todo passo tem `semIsso`, e ele não repete o título", () => {
  // O `semIsso` é a razão de o bloco existir: quem lê é o DESENVOLVEDOR do site,
  // que não sabe o que a ferramenta faz. Um passo sem consequência escrita é uma
  // instrução que se pula.
  for (const p of PASSOS_CHECKOUT_PROPRIO) {
    assert.ok(p.titulo?.trim(), "passo sem título");
    assert.ok(p.semIsso?.trim().length > 40, `\`semIsso\` curto demais em: ${p.titulo}`);
    assert.notEqual(p.semIsso.trim(), p.titulo.trim());
  }
});

/* ═══════════════════════ 2 · `click_id`, nunca `sck` ═══════════════════════ */

console.log("\n\x1b[1m⛔ O campo é `click_id` — `sck` grava e não casa nada\x1b[0m");

checar("a constante é `click_id`", () => {
  assert.equal(CAMPO_CLICK_ID, "click_id");
});

checar("🔴 `sck` não aparece em lugar nenhum do código entregue", () => {
  // Linha de base primeiro: se o código estivesse vazio, o `!includes` passaria.
  assert.ok(CODIGO.includes(CAMPO_CLICK_ID), "o código não menciona o campo certo");
  assert.ok(!/\bsck\b/.test(CODIGO), "o código entregue menciona `sck`");
});

checar("🔴 o id vai nos DOIS campos que os gateways devolvem", () => {
  // O comentário do arquivo afirma isto ("gateways diferentes devolvem um ou
  // outro"), e comentário que afirma um efeito é uma afirmação testável.
  assert.ok(/tracking:\s*\{\s*click_id:/.test(CODIGO), "não vai em `tracking`");
  assert.ok(/metadata:\s*\{\s*click_id:/.test(CODIGO), "não vai em `metadata`");
});

/* ═══════════════ 3 · O leitor casa com o cookie que NÓS escrevemos ═════════ */

console.log("\n\x1b[1m🔴 O leitor do cookie × o cookie que o nosso script ESCREVE\x1b[0m");

const scriptDeUtm = utmScript("conta-1", "https://app.exemplo.com", "ws-1");

/** O nome do cookie, LIDO do script de rastreamento — não escrito aqui. */
const nomeDoCookie = /var COOKIE = "([^"]+)"/.exec(scriptDeUtm)?.[1];

checar("linha de base: o script de rastreamento declara um cookie", () => {
  assert.ok(nomeDoCookie, "não achei `var COOKIE` no script de UTM");
});

checar("🔴 o passo do checkout procura EXATAMENTE esse cookie", () => {
  /* Os dois vivem em arquivos diferentes (`utm/scripts.ts` escreve,
     `pixel/checkoutProprio.ts` lê) e nada liga um ao outro. Renomear o cookie de
     um lado deixaria o snippet do cliente lendo um cookie que não existe — sem
     erro nenhum, com a venda entrando sem campanha. */
  assert.ok(CODIGO.includes(nomeDoCookie), `o snippet não procura \`${nomeDoCookie}\``);
});

checar("🔴 e o CAMPO lido é o mesmo que o script grava", () => {
  assert.ok(
    /data\.click_id\s*=/.test(scriptDeUtm),
    "o script de UTM não grava `click_id` no cookie",
  );
  assert.ok(/dados\.click_id/.test(CODIGO), "o snippet não lê `click_id` do cookie");
});

/* Executa a função entregue ao cliente, num `document` falso. */
function traffikClickIdCom({ cookie = "", search = "" }) {
  const corpo = PASSOS_CHECKOUT_PROPRIO.find((p) => /traffikClickId/.test(p.codigo ?? ""))?.codigo;
  assert.ok(corpo, "o passo com a função sumiu");
  const fn = new Function(
    "document",
    "location",
    "URLSearchParams",
    `${corpo.split("var clickId")[0]}\nreturn traffikClickId();`,
  );
  return fn({ cookie }, { search }, URLSearchParams);
}

/** O cookie exatamente como o `writeCookie` do script de UTM o escreve. */
const cookieComo = (dados) => `${nomeDoCookie}=${encodeURIComponent(JSON.stringify(dados))}`;

console.log("\n\x1b[1mA função RODA — em `document` falso, não por leitura\x1b[0m");

checar("🔴 lê o `click_id` do cookie no formato que o nosso script grava", () => {
  const r = traffikClickIdCom({ cookie: cookieComo({ utm_source: "fb", click_id: "clk-123" }) });
  assert.equal(r, "clk-123");
});

checar("cookie de outro sistema ao lado não atrapalha", () => {
  const r = traffikClickIdCom({
    cookie: `_ga=GA1.1.9; ${cookieComo({ click_id: "clk-777" })}; outro=x`,
  });
  assert.equal(r, "clk-777");
});

checar("🔴 sem cookie, cai na QUERYSTRING — o caso da primeira visita", () => {
  // O script decora os links de checkout com `click_id=`; numa aba nova o cookie
  // pode ainda não existir quando a página de pagamento abre.
  assert.equal(traffikClickIdCom({ cookie: "", search: "?click_id=clk-url&utm_source=fb" }), "clk-url");
  assert.ok(/click_id=/.test(scriptDeUtm), "o script parou de decorar os links com o click_id");
});

checar("sem nada, devolve `null` — e não uma string vazia", () => {
  // `""` viajaria até o gateway e viraria um `click_id` que não casa com nada,
  // em vez de "não havia identificador".
  assert.equal(traffikClickIdCom({ cookie: "", search: "" }), null);
});

checar("cookie corrompido não derruba o checkout do cliente", () => {
  // O `try/catch` do snippet é a diferença entre "a venda entra sem campanha" e
  // "a página de pagamento quebra".
  assert.equal(traffikClickIdCom({ cookie: `${nomeDoCookie}=%7Bnao-e-json` }), null);
});

/* ═══════════════════════ 4 · O IP vem do FIM da cadeia ═════════════════════ */

console.log("\n\x1b[1m🔴 O IP sai do FIM do X-Forwarded-For\x1b[0m");

function ipDoSnippet(xff) {
  const passo = PASSOS_CHECKOUT_PROPRIO.find((p) => /x-forwarded-for/.test(p.codigo ?? ""));
  assert.ok(passo, "o passo do IP sumiu");
  const linha = passo.codigo
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && l.trim())
    .join("\n")
    .replace(/^const ip =/, "return");
  const fn = new Function("req", `${linha.split("corpo.customer_ip")[0]}`);
  return fn({ headers: { "x-forwarded-for": xff }, socket: { remoteAddress: "10.0.0.9" } });
}

checar("🔴 com dois saltos, pega o ÚLTIMO — não o primeiro", () => {
  /* O primeiro da cadeia é o que o CLIENTE escreveu, e ele pode inventar
     qualquer coisa. É a mesma escolha de `lib/geo/clientIp.ts`, que conta da
     direita — se as duas discordarem, o país da venda pelo checkout próprio sai
     diferente do país do clique, na mesma jornada. */
  assert.equal(ipDoSnippet("1.1.1.1, 200.200.200.200"), "200.200.200.200");
});

checar("provado pelo lado negativo: o ingênuo `[0]` daria OUTRO valor", () => {
  // Sem isto, a asserção acima passaria numa cadeia de um salto só — onde os
  // dois jeitos dão o mesmo resultado e nada é medido.
  const cadeia = "1.1.1.1, 200.200.200.200";
  assert.notEqual(cadeia.split(",")[0].trim(), ipDoSnippet(cadeia));
});

checar("cadeia de um salto continua funcionando", () => {
  assert.equal(ipDoSnippet("200.200.200.200"), "200.200.200.200");
});

checar("sem header nenhum, cai na conexão", () => {
  assert.equal(ipDoSnippet(undefined), "10.0.0.9");
});

checar("⚠️ o IP é lido no SERVIDOR — o passo diz isso por escrito", () => {
  // Lido no navegador ele é forjável. A instrução é metade do valor do passo.
  const passo = PASSOS_CHECKOUT_PROPRIO.find((p) => /x-forwarded-for/.test(p.codigo ?? ""));
  assert.ok(/servidor/i.test(passo.atencao ?? ""), "o passo não avisa que é no servidor");
});

console.log(
  falhas.length
    ? `\n\x1b[31m${falhas.length} falha(s)\x1b[0m de ${ok + falhas.length}\n`
    : `\n\x1b[32m${ok} asserções, todas verdes\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
