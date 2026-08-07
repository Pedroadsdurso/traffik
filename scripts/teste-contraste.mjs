/**
 * Contraste WCAG da paleta do redesign, nos DOIS temas.
 *
 * O que este teste prova, e o que ele deliberadamente NÃO faz:
 *
 *  - Ele LÊ o `globals.css` e converte o OKLCH declarado. Não existe aqui uma
 *    cópia dos hexadecimais. Se alguém ajustar um token e esquecer o comentário
 *    ao lado, o teste continua medindo o que a página pinta — e ainda denuncia a
 *    divergência entre o OKLCH e o hexadecimal do comentário.
 *
 *  - Ele monta o tema claro do jeito que a cascata monta: base (`:root`) e
 *    depois o bloco `[data-theme="light"]` por cima. Medir o claro com os
 *    valores do escuro é o erro que faria a paleta "passar" sem nunca ter sido
 *    conferida no tema que reprova.
 *
 *  - A conta em si mora em `src/lib/cor.ts`, que é o mesmo módulo que a página
 *    /design-system consome. Duas implementações da mesma conta divergem sempre.
 *
 * Uso: npm run test:contraste
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  lerOklch,
  oklchParaRgb,
  rgbParaHex,
  hexParaRgb,
  rgbParaOklch,
  formatarOklch,
  contraste,
  sobrepor,
} from "@/lib/cor";

const AQUI = dirname(fileURLToPath(import.meta.url));

/**
 * 🔴 OS COMENTÁRIOS SAEM ANTES DE QUALQUER EXTRAÇÃO — e isto foi um bug de
 * verdade, não precaução.
 *
 * O `globals.css` documenta o próprio fallback do `color-mix` mostrando o CSS
 * que o Lightning emite, dentro de um comentário. O extrator de tingimentos leu
 * aquele exemplo como se fosse declaração: `--tk-tint-danger` aparecia DUAS
 * vezes, o teste anunciava "8 tons" onde há 7, e media o mesmo par duas vezes.
 *
 * Numericamente foi inofensivo porque o exemplo é igual ao código real. O
 * perigoso é o caso geral: um comentário que mostre um valor ANTIGO, ou um token
 * hipotético, entraria na medição como se fosse a paleta — e o teste passaria a
 * aprovar uma cor que a página não pinta, que é exatamente o que este arquivo
 * inteiro existe para impedir.
 *
 * ⚠️ Só os comentários MULTILINHA saem. Os de uma linha ficam de propósito: é
 * deles que a conferência cruzada tira o hexadecimal (`--tk-x: oklch(...);
 * /* #AABBCC *\/`). Apagar todos faria a conferência parar de achar hexadecimal
 * nenhum e passar sempre — trocaria um bug por uma asserção morta, que é pior.
 */
const CSS = readFileSync(join(AQUI, "..", "src", "app", "globals.css"), "utf8").replace(
  /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g,
  (bloco) => (bloco.includes("\n") ? "" : bloco),
);

const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const vermelho = (s) => `\x1b[31m${s}\x1b[0m`;
const amarelo = (s) => `\x1b[33m${s}\x1b[0m`;
const cinza = (s) => `\x1b[90m${s}\x1b[0m`;

/* ── 1. Extrair os tokens do CSS ──────────────────────────────────────────────
   Cada bloco `seletor { ... }` vira um conjunto de declarações `--tk-*`. Só
   entram as que são OKLCH literal: as de densidade, raio e duração moram nos
   mesmos blocos e não são cor. O hexadecimal do comentário é capturado junto,
   para a conferência cruzada. */

function extrairBlocos(css) {
  const blocos = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const seletor = m[1].trim().replace(/\s+/g, " ");
    const corpo = m[2];
    const tokens = {};
    const reDecl = /(--tk-[\w-]+)\s*:\s*(oklch\([^)]*\))\s*;(?:\s*\/\*\s*(#[0-9A-Fa-f]{6})[^*]*\*\/)?/g;
    let d;
    while ((d = reDecl.exec(corpo))) tokens[d[1]] = { oklch: d[2], hexComentado: d[3] ?? null };
    if (Object.keys(tokens).length) blocos.push({ seletor, tokens });
  }
  return blocos;
}

const blocos = extrairBlocos(CSS);
if (!blocos.length) {
  console.error(vermelho("Nenhum token --tk-* em OKLCH encontrado no globals.css."));
  process.exit(1);
}

/* A base é tudo que não é exclusivo do tema claro; o claro sobrescreve por cima,
   que é exatamente a ordem da cascata no arquivo. */
const base = {};
const soClaro = {};
for (const b of blocos) {
  const alvo = b.seletor.includes('[data-theme="light"]') ? soClaro : base;
  Object.assign(alvo, b.tokens);
}

const temas = {
  escuro: base,
  claro: { ...base, ...soClaro },
};

/* ── 1b. O selo tingido ────────────────────────────────────────────────────────
   A definição do tingimento é LIDA do CSS — qual token é tingido e a que
   porcentagem. Escrever "14%" aqui seria uma segunda implementação da mesma
   conta: alguém sobe o tingimento para 18% no globals.css, o teste continua
   medindo 14% e aprova um par que a tela não pinta. */
function extrairTingimentos(css) {
  const re =
    /--tk-tint-([\w-]+)\s*:\s*color-mix\(\s*in oklch\s*,\s*var\((--tk-[\w-]+)\)\s*([\d.]+)%\s*,\s*transparent\s*\)/g;
  const out = [];
  let m;
  while ((m = re.exec(css))) out.push({ nome: m[1], token: m[2], alfa: parseFloat(m[3]) / 100 });
  return out;
}

const TINGIMENTOS = extrairTingimentos(CSS);
if (!TINGIMENTOS.length) {
  console.error(vermelho("Nenhum --tk-tint-* encontrado no globals.css — o selo tingido saiu do sistema?"));
  process.exit(1);
}

/* ── 1c. O PAR tem de estar completo nos dois temas ───────────────────────────
   O erro provável aqui não é errar um valor: é acrescentar um tom novo e
   escrever só metade dele. Um `--tk-tint-info` sem `--tk-on-tint-info` deixaria
   o selo herdando a cor de texto do que estiver em volta — plausível na tela,
   nunca medido, e o `Badge` nem compila diferente porque o mapa dele é escrito à
   mão. Esta asserção falha ALTO em vez de deixar o par nascer torto. */
{
  const tint = TINGIMENTOS.map((t) => t.nome);
  const onTint = [...CSS.matchAll(/--tk-on-tint-([\w-]+)\s*:/g)].map((m) => m[1]);
  const faltando = [];
  for (const n of tint) {
    // Um `on-tint` por tema: o degrau é para cima no escuro e para baixo no claro.
    const quantos = onTint.filter((o) => o === n).length;
    if (quantos < 2) faltando.push(`--tk-on-tint-${n} declarado ${quantos}× (esperado 2: escuro e claro)`);
  }
  for (const n of new Set(onTint)) {
    if (!tint.includes(n)) faltando.push(`--tk-on-tint-${n} existe sem o --tk-tint-${n} correspondente`);
  }
  if (faltando.length) {
    console.error(vermelho("\nSelo tingido com par incompleto:"));
    for (const f of faltando) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`  ${verde("✓")} ${tint.length} tons de selo tingido, todos com o par nos dois temas`);
}

/* ── 2. Conferência cruzada: o OKLCH bate com o hexadecimal do comentário? ──── */

let divergencias = 0;
console.log("\n\x1b[1mConferência OKLCH × hexadecimal do comentário\x1b[0m");
for (const [nomeTema, tokens] of Object.entries(temas)) {
  for (const [nome, { oklch, hexComentado }] of Object.entries(tokens)) {
    if (!hexComentado) continue;
    if (nomeTema === "claro" && !(nome in soClaro)) continue; // já conferido no escuro
    const doCss = rgbParaHex(oklchParaRgb(lerOklch(oklch)));
    if (doCss !== hexComentado.toUpperCase()) {
      divergencias++;
      const esperado = formatarOklch(rgbParaOklch(hexParaRgb(hexComentado)));
      console.log(
        `  ${vermelho("✗")} ${nome} (${nomeTema}) — o CSS pinta ${doCss}, o comentário diz ${hexComentado.toUpperCase()}`,
      );
      console.log(cinza(`      quem manda é o CSS. Para o comentário virar verdade: ${esperado}`));
    }
  }
}
if (!divergencias) console.log(`  ${verde("✓")} todos os OKLCH batem com o hexadecimal ao lado`);

/* ── 3. Os pares ──────────────────────────────────────────────────────────────
   Os fundos são os quatro da escada de elevação. Os pares "obrigatórios" são
   texto de verdade (limiar AA 4.5:1); os "informativos" são objeto gráfico —
   borda, série de gráfico, anel de foco — cujo critério é o 1.4.11 (3:1), e que
   por não serem texto não reprovam a fase. */

const FUNDOS = ["--tk-background", "--tk-background-alt", "--tk-surface", "--tk-surface-hover"];

const TEXTO = [
  ["--tk-text", "número e título"],
  ["--tk-text-secondary", "rótulo e texto de apoio"],
  ["--tk-text-muted", "placeholder e metadado"],
  ["--tk-primary", "link, ícone, estado ativo"],
  ["--tk-success", "lucro"],
  ["--tk-warning", "atenção"],
  ["--tk-danger", "prejuízo"],
];

/* `accent` SAIU da lista de texto em 05/08/2026, e a saída é uma decisão de
   sistema, não um jeito de fazer o teste ficar verde: ele é série de gráfico,
   indicador de dado ao vivo e seleção — objeto gráfico, cujo critério é 3:1
   (WCAG 1.4.11). Medi-lo como texto era medir um par que não existe.
   ⚠️ Se alguém um dia usar accent como cor de TEXTO, esta linha passa a estar
   errada — e o lugar de descobrir isso é a revisão da Fase 2, não aqui. */
const GRAFICO = [
  ["--tk-border", "contorno e separador"],
  ["--tk-accent", "série primária, dado ao vivo, seleção"],
  ["--tk-category", "categoria (roxo) — nunca affordance"],
  ["--tk-channel-meta", "série Meta"],
  ["--tk-channel-tiktok", "série TikTok"],
  ["--tk-channel-google", "série Google"],
  ["--tk-channel-outros", "série Outros"],
];

function rgb(tokens, nome) {
  const t = tokens[nome];
  if (!t) throw new Error(`token ausente no CSS: ${nome}`);
  return oklchParaRgb(lerOklch(t.oklch));
}

/* ── Exceções ACEITAS, com piso ────────────────────────────────────────────────
   Um teste que sai vermelho toda vez para de ser lido — e aí a reprovação NOVA,
   a que importa, chega no meio de dez que já estavam lá. Por isso cada exceção é
   registrada com o número que ela tinha quando foi aceita.

   O piso é o que mantém a asserção viva: a exceção passa enquanto o valor NÃO
   PIORAR. Se alguém escurecer um token e a razão cair abaixo do piso, o teste
   reprova de novo — foi aceito aquele número, não "esse token pode ser ruim". */
const ACEITOS = {
  "--tk-danger · tema escuro": {
    piso: 4.03,
    motivo: "marginal sobre surface/surface-hover; hover não é onde se lê texto longo",
    quando: "decisão de 05/08/2026",
  },
  "--tk-primary · tema escuro": {
    piso: 4.12,
    motivo: "marginal sobre surface-hover; mexer mudaria a identidade por pouco ganho",
    quando: "decisão de 05/08/2026",
  },
  /* As CINCO do tema claro saíram daqui na Fase 6 (05/08/2026): text-muted 2.34,
     warning 2.91, success 3.01, text-secondary 4.34 e danger 4.41 foram
     CORRIGIDAS, não readiadas. Se alguma reaparecer, é regressão de verdade —
     não há mais exceção de tema claro para ela cair. */
};

let reprovados = 0;
let avisos = 0;
let medidos = 0;
let temaCorrente = "";
/** Exceções aceitas que apareceram nesta rodada, para o resumo. */
const aceitosVistos = new Map();
/** Falhas obrigatórias agrupadas por token+tema, para o resumo do fim. */
const porToken = new Map();
/** O caminho de fallback do `color-mix` — risco aceito, mas nunca invisível. */
const FALLBACKS = [];

function medir(rotulo, corA, corB, limiar, obrigatorio, token) {
  const razao = contraste(corA, corB);
  medidos++;
  const passou = razao >= limiar;
  const chave = `${token} · tema ${temaCorrente}`;
  // Tolerância de arredondamento: o piso foi registrado com 2 casas.
  const aceito = !passou && obrigatorio && ACEITOS[chave] && razao >= ACEITOS[chave].piso - 0.005;

  if (!passou && obrigatorio && !aceito) {
    reprovados++;
    const antes = porToken.get(chave);
    if (!antes || razao < antes.pior) porToken.set(chave, { pior: razao, n: (antes?.n ?? 0) + 1, onde: rotulo });
    else porToken.set(chave, { ...antes, n: antes.n + 1 });
  }
  if (aceito) {
    const antes = aceitosVistos.get(chave);
    if (!antes || razao < antes) aceitosVistos.set(chave, razao);
  }
  if (!passou && !obrigatorio) avisos++;
  const marca = passou ? verde("✓") : aceito ? amarelo("≈") : obrigatorio ? vermelho("✗") : amarelo("!");
  const n = razao.toFixed(2).padStart(5);
  console.log(`  ${marca} ${n}:1  ${rotulo}`);
  return razao;
}

for (const [nomeTema, tokens] of Object.entries(temas)) {
  temaCorrente = nomeTema;
  console.log(`\n\x1b[1mTema ${nomeTema} — texto sobre fundo (AA exige 4.5:1)\x1b[0m`);
  for (const [tok, uso] of TEXTO) {
    for (const fundo of FUNDOS) {
      medir(
        `${tok.replace("--tk-", "")} sobre ${fundo.replace("--tk-", "")}  ${cinza(uso)}`,
        rgb(tokens, tok),
        rgb(tokens, fundo),
        4.5,
        true,
        tok,
      );
    }
  }

  /* Rótulo sobre preenchimento de marca. O par é `on-*` contra o preenchimento,
     e NÃO `text` contra ele: `text` sobre um botão azul é um par que o sistema
     não produz — no tema claro seria texto quase preto sobre azul escuro, que
     ninguém desenharia. Medir isso reprovava a paleta por um uso inexistente.

     ⚠️ Estes pares são o que impede a correção de 05/08 de ser desfeita: se
     alguém trocar `primary-solid` por `primary` no botão, o número cai para
     3.52:1 e o teste reprova aqui. */
  console.log(`\n\x1b[1mTema ${nomeTema} — rótulo sobre preenchimento de marca\x1b[0m`);
  medir("on-primary sobre primary-solid  " + cinza("rótulo do botão"), rgb(tokens, "--tk-on-primary"), rgb(tokens, "--tk-primary-solid"), 4.5, true, "rótulo do botão primário");
  medir("on-primary sobre primary-solid-hover  " + cinza("botão em hover"), rgb(tokens, "--tk-on-primary"), rgb(tokens, "--tk-primary-solid-hover"), 4.5, true, "rótulo do botão primário");
  medir("on-accent sobre accent  " + cinza("rótulo do chip de seleção"), rgb(tokens, "--tk-on-accent"), rgb(tokens, "--tk-accent"), 4.5, true, "rótulo sobre chip de accent");

  /* Selo tingido — o padrão mais repetido das telas de referência, e o que mais
     reprovava. O par medido é `on-tint-X` contra o TINGIMENTO de X composto
     sobre cada um dos quatro fundos, porque o mesmo selo aparece em card, em
     linha de tabela e na barra de contexto — e o pior fundo não é o mesmo nos
     dois temas.

     ⚠️ É este bloco que impede a volta do erro estrutural: usar a cor pura como
     texto do selo derruba primary para 3.44 e category para 3.07 no escuro, e
     accent para 1.97 no claro. Nenhuma porcentagem de tingimento conserta isso —
     texto e fundo da mesma cor não se separam mexendo na saturação. */
  console.log(`\n\x1b[1mTema ${nomeTema} — selo tingido (rótulo sobre o próprio tingimento)\x1b[0m`);
  for (const { nome, token, alfa } of TINGIMENTOS) {
    const pura = rgb(tokens, token);
    const rotulo = rgb(tokens, `--tk-on-tint-${nome}`);
    for (const fundo of FUNDOS) {
      const tingido = sobrepor(pura, rgb(tokens, fundo), alfa);
      medir(
        `on-tint-${nome} sobre tint-${nome} em ${fundo.replace("--tk-", "")}  ` +
          cinza(`${token.replace("--tk-", "")} a ${(alfa * 100).toFixed(0)}%`),
        rotulo,
        tingido,
        4.5,
        true,
        `selo tingido ${nome}`,
      );
    }
  }

  /* ── O CAMINHO DE FALLBACK, medido em vez de suposto ────────────────────────
     O Lightning CSS não consegue calcular `color-mix` quando o argumento é uma
     `var()`, então ele emite o token OPACO como fallback e a mistura de verdade
     dentro de um `@supports`. Num navegador sem `color-mix` (pré-2023), o selo
     não fica "um pouco pior": ele fica com o fundo na COR CHEIA e o rótulo em
     `on-tint` por cima — que é o vizinho mais próximo daquela mesma cor.

     Isto está aceito como risco. O que NÃO estava aceito é ele ser invisível:
     "selo ilegível sem nada avisando" é o modo de falha que esta base mais
     coleciona. Agora o número sai em toda execução, com nome.

     ⚠️ Não reprova de propósito — reprovar aqui obrigaria a abandonar o
     `color-mix`, que é a decisão contrária à que foi tomada. O valor deste bloco
     é a VISIBILIDADE: se alguém mexer nos tons e o fallback piorar, o número
     muda à vista de quem rodar o teste. */
  console.log(`\n\x1b[1mTema ${nomeTema} — FALLBACK sem color-mix (navegador pré-2023; não reprova)\x1b[0m`);
  for (const { nome, token } of TINGIMENTOS) {
    const razao = medir(
      `on-tint-${nome} sobre ${token.replace("--tk-", "")} OPACO  ${cinza("o que um navegador sem color-mix pinta")}`,
      rgb(tokens, `--tk-on-tint-${nome}`),
      rgb(tokens, token),
      4.5,
      false,
      `fallback ${nome}`,
    );
    if (razao < 4.5) avisos--; // contado à parte, para não poluir o total de objeto gráfico
    FALLBACKS.push({ tema: nomeTema, nome, razao });
  }

  console.log(`\n\x1b[1mTema ${nomeTema} — objeto gráfico (1.4.11 pede 3:1; não reprova a fase)\x1b[0m`);
  for (const [tok, uso] of GRAFICO) {
    for (const fundo of ["--tk-background", "--tk-surface"]) {
      medir(
        `${tok.replace("--tk-", "")} sobre ${fundo.replace("--tk-", "")}  ${cinza(uso)}`,
        rgb(tokens, tok),
        rgb(tokens, fundo),
        3,
        false,
        tok,
      );
    }
  }

  // As duas assinaturas do sistema são composições alfa: medir a cor pura daria
  // um número que a tela nunca produz.
  console.log(`\n\x1b[1mTema ${nomeTema} — assinaturas (composição alfa real)\x1b[0m`);
  const superficie = rgb(tokens, "--tk-surface");
  medir(
    "preenchimento acima do break-even  " + cinza("success 12% sobre surface"),
    sobrepor(rgb(tokens, "--tk-success"), superficie, 0.12),
    superficie,
    3,
    false,
    "--tk-success",
  );
  medir(
    "preenchimento abaixo do break-even  " + cinza("danger 12% sobre surface"),
    sobrepor(rgb(tokens, "--tk-danger"), superficie, 0.12),
    superficie,
    3,
    false,
    "--tk-danger",
  );
  medir(
    "anel do glow de dado ao vivo  " + cinza("accent 22% sobre surface"),
    sobrepor(rgb(tokens, "--tk-accent"), superficie, 0.22),
    superficie,
    3,
    false,
    "--tk-accent",
  );

  /* 🔴 FITA DO FUNIL. Os pares ADJACENTES (fluxo × perda) sumiram em
     07/08/2026 junto com as faixas de perda: elas deixaram de ser desenhadas.
     O que sobrou não é adjacência — é a fita sobre o card, e a cápsula sobre a
     fita. Os dois REPROVAM, porque a legibilidade da pílula é a figura inteira:
     ela é onde a perda existe agora, e ilegível ali não há outro lugar. */
  console.log(`
[1mTema ${nomeTema} — fita do funil (3:1 reprova)[0m`);
  medir(
    "fita: entrada sobre surface  " + cinza("a fita precisa existir contra o card"),
    rgb(tokens, "--tk-fluxo"),
    superficie,
    3,
    true,
    "--tk-fluxo",
  );
  medir(
    "fita: saída sobre surface  " + cinza("a ponta violeta da rampa"),
    rgb(tokens, "--tk-fluxo-fim"),
    superficie,
    3,
    true,
    "--tk-fluxo-fim",
  );
  medir(
    "cápsula da pílula sobre a fita  " + cinza("a pílula é o elemento mais visível"),
    rgb(tokens, "--tk-pilula"),
    rgb(tokens, "--tk-fluxo"),
    3,
    true,
    "--tk-pilula",
  );
  medir(
    "texto da pílula sobre a cápsula  " + cinza("é TEXTO: 4.5:1"),
    rgb(tokens, "--tk-on-pilula"),
    rgb(tokens, "--tk-pilula"),
    4.5,
    true,
    "--tk-on-pilula",
  );
}

/* ── 4. Veredito ──────────────────────────────────────────────────────────── */

console.log(`\n${"─".repeat(76)}`);
console.log(`${medidos} pares medidos nos dois temas.`);
if (divergencias) console.log(vermelho(`${divergencias} token(s) com OKLCH divergindo do hexadecimal do comentário.`));
if (avisos) console.log(amarelo(`${avisos} objeto(s) gráfico(s) abaixo de 3:1 — decisão de design, não reprova.`));

/* O aviso do fallback sai SEMPRE, mesmo se um dia todos passarem: a linha some
   só quando o `color-mix` sair do arquivo. Um alerta que desaparece sozinho é
   como o risco volta a ficar invisível. */
{
  const ruins = FALLBACKS.filter((f) => f.razao < 4.5).sort((a, b) => a.razao - b.razao);
  console.log(
    amarelo(`\nFALLBACK do color-mix (navegador pré-2023) — risco ACEITO, e por isso medido:`),
  );
  if (!ruins.length) {
    console.log(cinza("  todos os selos continuariam legíveis sem color-mix."));
  } else {
    const pior = ruins[0];
    console.log(
      `  ${ruins.length} de ${FALLBACKS.length} selos ficariam ABAIXO de 4.5:1 — o pior é ` +
        `${vermelho(pior.razao.toFixed(2) + ":1")} (${pior.nome}, tema ${pior.tema}).`,
    );
    console.log(
      cinza(
        "  Sem color-mix o Lightning CSS emite o token OPACO, então o selo fica com a cor cheia\n" +
        "  no fundo e o on-tint por cima. Não reprova de propósito: reprovar obrigaria a largar o\n" +
        "  color-mix, que é a decisão contrária à tomada. Ver a nota no globals.css.",
      ),
    );
  }
}

/* Um token pode ter um fundo acima do piso e outro abaixo. Nesse caso ele já
   aparece na REPROVAÇÃO, e repeti-lo entre as exceções aceitas leria como se
   estivesse tolerado — some daqui. */
for (const chave of porToken.keys()) aceitosVistos.delete(chave);

if (aceitosVistos.size) {
  console.log(amarelo(`\n${aceitosVistos.size} exceção(ões) ACEITA(S) — não reprovam, mas seguem na conta:`));
  /* Não há marcador de "piorou" aqui, e a ausência é de propósito: um par que
     caiu abaixo do piso NÃO é aceito, então nunca chega nesta lista — ele sai
     na reprovação, com saída 1. Um "PIOROU" amarelo aqui seria código morto
     dando a impressão de que a regressão é só um aviso. */
  for (const [chave, razao] of [...aceitosVistos].sort((a, b) => a[1] - b[1])) {
    const { piso, motivo, quando } = ACEITOS[chave];
    console.log(
      `  ${amarelo(razao.toFixed(2).padStart(5) + ":1")}  ${chave}  ${cinza(`piso ${piso.toFixed(2)} · ${quando} · ${motivo}`)}`,
    );
  }
}

/* Uma exceção registrada que NÃO apareceu quer dizer que o par melhorou (ou
   sumiu). Isso é bom — e é ruído a partir do momento em que fica pendurado. */
const fantasmas = Object.keys(ACEITOS).filter((k) => !aceitosVistos.has(k));
if (fantasmas.length) {
  console.log(cinza(`\n${fantasmas.length} exceção(ões) aceita(s) que não apareceram — o par melhorou ou saiu. Remova de ACEITOS:`));
  for (const f of fantasmas) console.log(cinza(`  · ${f}`));
}
if (reprovados) {
  /* "abaixo do LIMIAR", não "abaixo de 4.5:1": desde 07/08/2026 a fita do funil
     entra aqui com limiar 3:1 (par adjacente). Citar um número só faria a
     mensagem mentir sobre metade das reprovações possíveis. */
  console.log(vermelho(`\n${reprovados} par(es) abaixo do limiar, em ${porToken.size} token(s):\n`));
  const ordenado = [...porToken.entries()].sort((a, b) => a[1].pior - b[1].pior);
  for (const [chave, { pior, n }] of ordenado) {
    console.log(`  ${vermelho(pior.toFixed(2).padStart(5) + ":1")}  ${chave}${n > 1 ? cinza(`  (pior de ${n} fundos)`) : ""}`);
  }
  console.log(
    cinza(
      "\n  Isto NÃO está em ACEITOS — ou é novo, ou uma exceção aceita piorou.\n" +
      "  Corrija o token, ou registre em ACEITOS com o piso e o motivo.",
    ),
  );
  process.exit(1);
}
console.log(verde("\nNenhuma reprovação nova: todo par de texto abaixo de 4.5:1 está em ACEITOS e não piorou."));
