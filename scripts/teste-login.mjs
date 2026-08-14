/**
 * A TELA DE ENTRADA — o que só o código responde.
 *
 * Ela é a ÚNICA tela do produto fora do shell, e é isso que faz este arquivo
 * existir. As outras vinte e uma rotas herdam do `AppShell` três coisas que
 * ninguém precisa lembrar de pedir: a ponte `.tk-tema`, a fonte e o fundo. Aqui
 * não há de quem herdar — e o modo de falha é MUDO, porque a tela continua
 * funcionando, só que com o anel de foco roxo do sistema antigo.
 *
 * ## O que cada guarda mede, e o valor que o caso ERRADO produziria
 *
 * | # | Guarda | Se estiver errado |
 * |---|---|---|
 * | 1 | `tk-tema` na RAIZ do markup | anel de foco, link e seleção em `#9184d9` (roxo do legado) |
 * | 2 | nenhum login social | três botões inertes na tela de entrada |
 * | 3 | o painel de marca NÃO PODE depender do modo | `/login` e `/signup` divergindo em silêncio |
 * | 4 | o olho da senha existe e é NOMEADO | botão sem nome que faz algo invisível |
 * | 5 | a prévia desenha a nav REAL | a entrada prometendo área que não existe |
 * | 6 | nenhum texto carrega valor que envelhece | ano que vira mentira; número que vira 2ª fonte |
 *
 * ⚠️ Toda guarda por texto aqui leva LINHA DE BASE e normaliza CRLF. São 402
 * arquivos versionados em CRLF nesta base, e uma âncora com `\n` falha neles em
 * silêncio — devolvendo "não achei" com a mesma cara de "está tudo certo".
 *
 * Puro: sem banco, sem rede. ⚠️ Roda com `tsx` (lê `.tsx`).
 *
 *   npm run test:login
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { TelaAuth } = await import("../src/components/auth/TelaAuth.tsx");
const { PROVAS, APOIO, BADGE, HEADLINE, COPYRIGHT, NAV_PREVIA, RODAPE_SEGURANCA } = await import(
  "../src/lib/auth/conteudo.ts"
);
const { ThemeProvider } = await import("../src/components/theme/ThemeProvider.tsx");

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

/** Normaliza a quebra: sem isto toda âncora multilinha falha nos arquivos CRLF. */
const fonte = (caminho) => readFileSync(new URL(caminho, import.meta.url), "utf8").replace(/\r\n/g, "\n");

const TELA = fonte("../src/components/auth/TelaAuth.tsx");
const PAINEL = fonte("../src/components/auth/PainelMarca.tsx");
const RAIL = fonte("../src/components/tk/Rail.tsx");
const FORM = fonte("../src/components/auth/FormularioAuth.tsx");

/** A ação é falsa: o teste é da TELA, e a ação de verdade importa o prisma. */
const acaoFalsa = async () => ({});

const render = (modo) =>
  renderToStaticMarkup(
    React.createElement(ThemeProvider, null, React.createElement(TelaAuth, { modo, acao: acaoFalsa })),
  );

const HTML = { login: render("login"), signup: render("signup") };

/**
 * O markup com as entidades desfeitas.
 *
 * ⚠️ NECESSÁRIO, e a primeira versão deste teste não tinha: "UTM & Snippets"
 * chega ao HTML como `UTM &amp; Snippets`, então procurar o rótulo cru devolvia
 * "não achei" — a guarda reprovando por comparar texto de origem com texto
 * ESCAPADO. É a mesma família do CRLF: a âncora não casa e o silêncio tem cara
 * de resultado.
 */
const TEXTO = {
  login: HTML.login.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"'),
  signup: HTML.signup.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"'),
};

/* ── LINHA DE BASE ────────────────────────────────────────────────────────────
   Sem isto, tudo que segue passa com a tela renderizando vazio: "não contém
   Google" é verdade num string vazio, e `=== 0` passa com a coleção vazia. */

console.log("\nLINHA DE BASE — houve tela para examinar?");

checar("os dois modos renderizam markup de verdade", () => {
  assert.ok(HTML.login.length > 2000, `login com ${HTML.login.length} caracteres`);
  assert.ok(HTML.signup.length > 2000, `signup com ${HTML.signup.length} caracteres`);
});

checar("o formulário chegou aos dois — campo de e-mail e de senha", () => {
  for (const modo of ["login", "signup"]) {
    assert.match(HTML[modo], /name="email"/, `${modo}: sem campo de e-mail`);
    assert.match(HTML[modo], /name="password"/, `${modo}: sem campo de senha`);
  }
});

/* ── 1. A PONTE ──────────────────────────────────────────────────────────────
   Medido no MARKUP e não no arquivo: o que importa é a classe chegar ao nó
   raiz, e é isso que decide a cor do anel de foco. */

console.log("\n1 — a ponte `.tk-tema` chega à RAIZ (senão, anel roxo)");

checar("o primeiro `<div` do markup carrega `tk-tema`", () => {
  /* ⚠️ O PRIMEIRO NÓ NÃO É A RAIZ: o `next/image` com `priority` emite um
     `<link rel="preload">` antes de tudo. Ancorar em "a primeira tag" fazia a
     guarda reprovar por medir o preload — guarda certa, alvo errado. */
  for (const modo of ["login", "signup"]) {
    const i = HTML[modo].indexOf("<div");
    assert.ok(i >= 0, `${modo}: linha de base — nenhum <div> no markup`);
    const raiz = HTML[modo].slice(i, HTML[modo].indexOf(">", i) + 1);
    assert.match(
      raiz,
      /class="[^"]*\btk-tema\b/,
      `${modo}: a raiz é \`${raiz}\` — sem a ponte, ` +
        "`a`, `:focus-visible` e `::selection` resolvem `--color-accent` do :root, que é roxo",
    );
  }
});

checar("a ponte NÃO foi reimplementada por --color-accent inline", () => {
  /* Uma segunda implementação da ponte diverge da primeira no dia em que alguém
     mexer no `.tk-tema`, e o sintoma é uma tela só ficando para trás. */
  const ofensoras = TELA.split("\n")
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /--color-accent\s*:/.test(l) || /--font-body\s*:/.test(l));
  assert.deepEqual(ofensoras, [], "TelaAuth redeclarando token do legado");
});

/* ── 2. O QUE NÃO EXISTE NÃO É DESENHADO ─────────────────────────────────── */

console.log("\n2 — login social: NÃO existe backend, então NÃO existe botão");

checar("nenhum dos três sociais aparece em nenhum dos dois modos", () => {
  for (const modo of ["login", "signup"]) {
    for (const nome of ["Google", "Apple", "ou continue com"]) {
      assert.ok(
        !HTML[modo].includes(nome),
        `${modo}: "${nome}" na tela — src/auth.ts só tem o provider Credentials, ` +
          "então o botão seria controle inerte na tela de ENTRADA",
      );
    }
  }
});

checar("e o divisor saiu junto — ele só separava o que não existe", () => {
  for (const modo of ["login", "signup"]) {
    assert.ok(!/continue com|Ou entre com/i.test(HTML[modo]), `${modo}: divisor órfão`);
  }
});

/* ── 3. O PAINEL DE MARCA É O MESMO NOS DOIS ─────────────────────────────────
   ⛔ Comparar as duas strings de HTML seria mais fraco do que parece: elas são
   iguais por construção hoje, e a asserção passaria mesmo depois de alguém
   acrescentar a prop. O que se prova aqui é ESTRUTURAL — o painel não tem por
   onde receber o modo. */

console.log("\n3 — o painel de marca não PODE depender do modo");

checar("`PainelMarca` não aceita prop nenhuma", () => {
  assert.ok(
    PAINEL.includes("export function PainelMarca()"),
    "a assinatura mudou: se ele passou a receber prop, /login e /signup podem divergir",
  );
});

checar("e a `TelaAuth` o chama sem passar nada", () => {
  const i = TELA.indexOf("<PainelMarca />");
  assert.ok(i > 0, "linha de base: a chamada `<PainelMarca />` não existe no CÓDIGO");
});

checar("os dois modos mostram a headline, o badge e as TRÊS provas", () => {
  for (const modo of ["login", "signup"]) {
    assert.ok(HTML[modo].includes(HEADLINE.destaque), `${modo}: sem a segunda linha da headline`);
    assert.ok(HTML[modo].includes(BADGE), `${modo}: sem o badge`);
    assert.ok(HTML[modo].includes(APOIO), `${modo}: sem o parágrafo de apoio`);
    assert.ok(HTML[modo].includes(RODAPE_SEGURANCA), `${modo}: sem o rodapé de segurança`);
    for (const p of PROVAS) {
      assert.ok(HTML[modo].includes(p.titulo), `${modo}: sem a prova "${p.titulo}"`);
    }
  }
});

/* ── 4. O OLHO ───────────────────────────────────────────────────────────── */

console.log("\n4 — o olho da senha");

checar("a senha nasce OCULTA", () => {
  assert.match(
    HTML.login,
    /name="password"[^>]*type="password"|type="password"[^>]*name="password"/,
    "o campo de senha não nasce `type=password`",
  );
});

checar("o botão do olho existe e DIZ o que faz", () => {
  assert.ok(HTML.login.includes('aria-label="Mostrar senha"'), "olho sem nome acessível");
  assert.ok(HTML.login.includes('aria-pressed="false"'), "olho sem estado anunciado");
});

checar("o olho é BOTÃO — Tab alcança, e ele não some do foco", () => {
  const i = HTML.login.indexOf('aria-label="Mostrar senha"');
  assert.ok(i > 0, "linha de base: o olho não está no markup");
  const abertura = HTML.login.lastIndexOf("<", i);
  assert.ok(
    HTML.login.slice(abertura, i).startsWith("<button"),
    "o olho não é <button>: um <span> com onClick não recebe foco nem Enter",
  );
});

/* ── 5. A PRÉVIA NÃO PROMETE O QUE NÃO EXISTE ────────────────────────────────
   A referência desenha `Conversões`, `Relatórios` e `Logs`. Esta guarda é a
   pergunta nova do CLAUDE.md: *que valor deveria ser IGUAL a este, e é?* */

console.log("\n5 — a prévia desenha a navegação REAL");

checar("linha de base: o Rail declara rótulos para conferir", () => {
  const quantos = (RAIL.match(/label: "/g) ?? []).length;
  assert.ok(quantos >= 7, `só ${quantos} ocorrências de \`label: "\` no Rail — âncora quebrada`);
});

checar("cada rótulo da prévia existe no Rail, EXATO", () => {
  const ausentes = NAV_PREVIA.filter((r) => !RAIL.includes(`label: "${r}"`));
  assert.deepEqual(
    ausentes,
    [],
    "rótulo da prévia que o rail não tem — a tela de entrada estaria prometendo área inexistente",
  );
});

checar("e a prévia chega ao markup", () => {
  for (const r of NAV_PREVIA) {
    assert.ok(TEXTO.login.includes(r), `a prévia não desenhou "${r}"`);
  }
});

checar("a prévia é DECORAÇÃO declarada — leitor de tela não lê o número falso", () => {
  const i = HTML.login.indexOf("R$ 1.248.672,00");
  assert.ok(i > 0, "linha de base: a prévia não desenhou o número de demonstração");
  /* O `aria-hidden` do contêiner tem de vir ANTES do número, e sem que outro
     `aria-hidden` feche no meio — na prática, basta ele existir acima. */
  assert.ok(
    HTML.login.slice(0, i).includes('aria-hidden="true"'),
    "número de demonstração fora de um contêiner aria-hidden",
  );
});

/* ── 6. NENHUM VALOR QUE ENVELHECE OU QUE VIRA SEGUNDA FONTE ───────────────── */

console.log("\n6 — o texto não carrega valor que envelhece");

checar("o copyright não tem ano", () => {
  assert.ok(
    !/\d{4}/.test(COPYRIGHT),
    `"${COPYRIGHT}" — ano fixo vira mentira em 1º de janeiro, e ` +
      "`new Date().getFullYear()` no servidor é a armadilha do `elapsed()`: " +
      "na virada do ano o HTML e a hidratação divergem e o React aborta a árvore",
  );
});

checar("nenhuma frase de marketing carrega número de configuração", () => {
  const comNumero = [APOIO, RODAPE_SEGURANCA, ...PROVAS.map((p) => p.apoio)].filter((f) => /\d/.test(f));
  assert.deepEqual(
    comNumero,
    [],
    "número na copy vira SEGUNDA FONTE do valor que está no código " +
      "(foi o caso de 'atualiza a cada 5 segundos', lido de DASH_POLL_MS)",
  );
});

/* ── 7. O QUE DIFERE ENTRE OS DOIS MODOS — e a DIREÇÃO ────────────────────── */

console.log("\n7 — o que o modo tem DIREITO de mudar");

checar("só o signup pede nome — e a direção é ACRESCENTAR", () => {
  assert.ok(HTML.signup.includes('name="name"'), "signup sem campo de nome");
  assert.ok(!HTML.login.includes('name="name"'), "login pedindo nome");
});

checar("`Lembrar de mim` e `Esqueci minha senha` só existem no login", () => {
  assert.ok(HTML.login.includes("Lembrar de mim"), "login sem 'Lembrar de mim'");
  assert.ok(HTML.login.includes("Esqueci minha senha"), "login sem 'Esqueci minha senha'");
  assert.ok(!HTML.signup.includes("Esqueci minha senha"), "signup oferecendo recuperar senha inexistente");
});

checar("`Esqueci minha senha` NÃO é link morto — é botão que declara o estado", () => {
  const i = HTML.login.indexOf("Esqueci minha senha");
  assert.ok(i > 0, "linha de base: o controle não está no markup");
  const abertura = HTML.login.lastIndexOf("<", i);
  assert.ok(
    HTML.login.slice(abertura, i).startsWith("<button"),
    "virou <a>: um link que não vai a lugar nenhum é procurado justamente por " +
      "quem está trancado do lado de fora, e o silêncio dele é o pior desfecho",
  );
  /* E o texto honesto tem de existir no código — ele só aparece após o clique. */
  assert.ok(
    FORM.includes("ainda não está disponível"),
    "o botão perdeu a frase que explica por que nada acontece",
  );
});

checar("o CTA é a variante do ANEL, não o gradiente preenchido do mockup", () => {
  const i = FORM.indexOf('variante="cta"');
  assert.ok(
    i > 0,
    "linha de base: o botão de envio não é `cta` — o gradiente preenchido do " +
      "mockup reprova em AA (rótulo claro a 1,73:1 no ciano)",
  );
});

/* ── O CAMINHO DO FRACASSO — o único que o usuário percorre com calma ──────
 *
 * 🔴 Ele estava SEM ASSERÇÃO até 14/08/2026, e a razão era estrutural: o aviso
 * vivia inline atrás de `estado.error`, e `useActionState` **não roda a ação no
 * SSR**. O `test:login` passava `acaoFalsa` e mesmo assim media só o formulário
 * limpo — a ação falsa dava a APARÊNCIA de exercitar o envio.
 *
 * ⛔ Quem acerta a senha vê a tela por dois segundos e vai embora. Quem erra
 * fica ali, lendo. Era esse o caminho descoberto.
 */
{
  const { AvisoDeErro } = await import("../src/components/auth/FormularioAuth.tsx");

  checar("o erro do servidor RENDERIZA a mensagem que veio", () => {
    const html = renderToStaticMarkup(
      React.createElement(AvisoDeErro, { mensagem: "E-mail ou senha inválidos." }),
    );
    assert.ok(html.length > 30, "linha de base: o aviso não renderizou");
    assert.ok(
      html.includes("E-mail ou senha inválidos."),
      "a mensagem do servidor não chegou à tela",
    );
  });

  checar("o erro é ANUNCIADO sozinho — `role=alert`", () => {
    const html = renderToStaticMarkup(React.createElement(AvisoDeErro, { mensagem: "x" }));
    assert.ok(
      html.includes('role="alert"'),
      "sem `role=alert` quem usa leitor de tela só descobre o erro voltando ao campo",
    );
  });

  checar("o aviso carrega o TOM de erro, não texto solto", () => {
    const html = renderToStaticMarkup(React.createElement(AvisoDeErro, { mensagem: "x" }));
    /* ⛔ `bg-tint-danger` + `text-danger` é o par tingido. A cor PURA sobre o
       fundo do card dá 3,55:1 — é o par que os tokens `on-tint-*` existem para
       não deixar voltar. */
    assert.ok(html.includes("text-danger"), "o aviso perdeu a cor de erro");
    assert.ok(html.includes("bg-tint-danger"), "o aviso perdeu o fundo tingido");
  });

  checar("a mensagem NÃO é inventada pelo componente", () => {
    /* O texto vem do servidor. Um fallback aqui faria a tela afirmar uma causa
       que o servidor não disse — e o usuário agiria sobre ela. */
    const html = renderToStaticMarkup(React.createElement(AvisoDeErro, { mensagem: "Conta bloqueada." }));
    assert.ok(html.includes("Conta bloqueada."), "a mensagem do servidor foi trocada");
    assert.ok(
      !html.includes("inválid"),
      "o componente injetou um texto próprio por cima do que o servidor mandou",
    );
  });

  checar("o formulário LIMPO não desenha aviso nenhum", () => {
    /* A linha de base do PAR: sem isto, as asserções acima passariam num
       componente que desenha o alerta sempre. */
    const limpo = HTML.login;
    assert.ok(limpo.length > 1000, "linha de base: a tela não renderizou");
    assert.ok(
      !limpo.includes('role="alert"'),
      "o aviso de erro aparece no formulário limpo — alarme que grita sem motivo",
    );
  });
}

/* ── rodapé ──────────────────────────────────────────────────────────────── */

console.log(`\n${falhas.length === 0 ? "\x1b[32m✓" : "\x1b[31m✗"} ${ok} asserções\x1b[0m`);
if (falhas.length) {
  console.log(`\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(" · ")}`);
  process.exit(1);
}
