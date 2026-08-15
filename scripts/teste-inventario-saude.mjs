/**
 * `contarEstados` / `montarSaude` — O PAINEL DE SAÚDE DE INTEGRAÇÕES.
 *
 * Dois consumidores, os dois na `VisaoGeralScreen` (linhas 105 e 108). Zero
 * asserções até 14/08/2026.
 *
 * ### 🔑 O QUE `montarSaude` DECIDE, e o comentário dele já AFIRMA um efeito
 *
 * > ⚠️ **O PIOR estado entre os perfis manda.** Um perfil saudável não compensa
 * > outro vencido: a sincronização daquele está parada do mesmo jeito.
 *
 * Afirmação de efeito é afirmação testável, e esta não tinha asserção. É a
 * propriedade central do arquivo: **o painel não pode fazer média**. Uma
 * agregação que tirasse o "melhor" — ou uma média — deixaria uma conta com o
 * token vencido invisível atrás de outra saudável, e a sincronização parada
 * seria descoberta pelo gasto congelado.
 *
 * ### 🔴 E A OUTRA É A DISTINÇÃO CENTRAL DO PROJETO, em cinco linhas
 *
 * Cada linha separa **ausência** de **falha**, e as duas têm estados
 * diferentes:
 *
 * | | `ausente` | `erro` / `atencao` |
 * |---|---|---|
 * | CAPI | `Sem pixel` — não há o que configurar | `Sem token` — há pixel e falta a chave |
 * | Pixel | `Não configurado` | `Todos desligados` |
 * | Webhook | `Nenhum` | `Todos desligados` |
 *
 * ⛔ Colapsar os dois faria o painel dizer "erro" para quem ainda não começou —
 * e é o oposto do que a tela existe para comunicar.
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { contarEstados, montarSaude } = await import("@/lib/integracoes/inventario");

const AGORA = new Date("2026-08-14T12:00:00.000Z");
const DIA = 864e5;
const emDias = (d) => new Date(AGORA.getTime() + d * DIA).toISOString();

const perfil = (tokenExpiresAt, accounts = [{ syncErrorCount: 0 }]) => ({
  id: "p" + Math.random(),
  name: "Perfil",
  tokenExpiresAt,
  accounts,
});
const pixel = (enabled, metaPixels = []) => ({ id: "px", name: "Pixel", enabled, metaPixels, rules: [] });
const webhook = (active) => ({ id: "wh", name: "WH", active });

const linha = (l, nome) => l.find((x) => x.nome === nome);

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · `contarEstados` — os três contadores PARTICIONAM
 *
 * `EstadoIntegracao` tem exatamente três valores, então a soma dos três tem de
 * dar o total. Se um estado novo entrar no tipo e não aqui, ele some da
 * contagem — e o cabeçalho do painel passa a mentir por omissão.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · contarEstados");

  const item = (estado) => ({ id: "x", chave: "x", nome: "x", subtitulo: "", categoria: "c", estado });
  const lista = [
    ...Array.from({ length: 3 }, () => item("conectada")),
    ...Array.from({ length: 2 }, () => item("erro")),
    item("inativa"),
  ];
  const c = contarEstados(lista);

  ok("linha de base: a lista tem os três estados", new Set(lista.map((i) => i.estado)).size === 3);
  ok("conta cada um", c.conectadas === 3 && c.erro === 2 && c.inativas === 1, JSON.stringify(c));
  ok("e o total é a lista inteira", c.total === lista.length);
  ok(
    "🔑 os três PARTICIONAM o total",
    c.conectadas + c.erro + c.inativas === c.total,
    "um estado novo no tipo e não aqui sumiria da contagem",
  );
  ok("lista vazia dá zeros, não `undefined`", JSON.stringify(contarEstados([])) === JSON.stringify({ conectadas: 0, erro: 0, inativas: 0, total: 0 }));

  /* ⚠️ Estado FORA do tipo entra no total e em nenhum contador — é o buraco
     que a asserção da partição fecha, medido para ele não ser surpresa. */
  const comIntruso = contarEstados([...lista, item("pendente")]);
  ok(
    "⚠️ estado desconhecido entra no total e em contador NENHUM",
    comIntruso.total === lista.length + 1 &&
      comIntruso.conectadas + comIntruso.erro + comIntruso.inativas === lista.length,
    "por isso a partição é asserção: hoje o tipo tem três, e a soma prova",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · AUSÊNCIA ≠ FALHA — a distinção central, linha por linha
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · ausência não é falha");

  const vazio = montarSaude([], [], [], AGORA);
  ok("linha de base: o painel sai com 5 linhas mesmo vazio", vazio.length === 5, vazio.map((l) => l.nome).join(" · "));
  ok(
    "e TODAS dizem `ausente`, nenhuma `erro`",
    vazio.every((l) => l.estado === "ausente"),
    "conta nova não pode abrir o painel em vermelho",
  );

  /* CAPI é a linha que mais separa os dois. */
  const semPixel = linha(montarSaude([], [], [], AGORA), "CAPI");
  const semToken = linha(montarSaude([], [], [pixel(true, [{ hasToken: false }])], AGORA), "CAPI");
  const comToken = linha(montarSaude([], [], [pixel(true, [{ hasToken: true }, { hasToken: false }])], AGORA), "CAPI");

  ok("CAPI sem pixel é `ausente`", semPixel.estado === "ausente", semPixel.valor);
  ok("🔴 CAPI COM pixel e sem token é `erro`", semToken.estado === "erro", semToken.valor);
  ok(
    "…e os dois têm valores DIFERENTES na tela",
    semPixel.valor !== semToken.valor,
    `"${semPixel.valor}" × "${semToken.valor}"`,
  );
  ok("com token, `ok` e a proporção", comToken.estado === "ok" && comToken.valor === "1 de 2", comToken.valor);

  /* Pixel e Webhook: nenhum × todos desligados. */
  for (const [nome, fabricar] of [
    ["Pixel", (n2) => montarSaude([], [], n2 === 0 ? [] : [pixel(false)], AGORA)],
    ["Webhook", (n2) => montarSaude([], n2 === 0 ? [] : [webhook(false)], [], AGORA)],
  ]) {
    ok(nome + ": nenhum é `ausente`", linha(fabricar(0), nome).estado === "ausente");
    ok(
      nome + ": todos DESLIGADOS é `atencao`, não `ausente`",
      linha(fabricar(1), nome).estado === "atencao",
      linha(fabricar(1), nome).valor + " — existe e está parado, que é outra coisa",
    );
  }

  ok(
    "Pixel ligado usa plural corretamente",
    linha(montarSaude([], [], [pixel(true), pixel(true)], AGORA), "Pixel").valor === "2 ativos" &&
      linha(montarSaude([], [], [pixel(true)], AGORA), "Pixel").valor === "1 ativo",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · 🔑 O PIOR ESTADO MANDA — a afirmação do comentário, agora asserida
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · 🔑 o pior estado manda");

  const SAUDAVEL = perfil(emDias(200));
  const VENCIDO = perfil(emDias(-5));
  const DESCONHECIDO = perfil(null);
  const EXPIRANDO = perfil(emDias(10));

  const tok = (perfis) => linha(montarSaude(perfis, [], [], AGORA), "Token de acesso");

  ok("linha de base: só o saudável dá `ok`", tok([SAUDAVEL]).estado === "ok", tok([SAUDAVEL]).valor);

  ok(
    "🔑 um VENCIDO no meio de saudáveis manda",
    tok([SAUDAVEL, SAUDAVEL, VENCIDO, SAUDAVEL]).estado === "erro",
    "um perfil saudável não compensa outro vencido",
  );
  ok("…e a ordem não importa", tok([VENCIDO, SAUDAVEL]).estado === tok([SAUDAVEL, VENCIDO]).estado);
  ok(
    "🔑 o DESCONHECIDO também vence o saudável",
    tok([SAUDAVEL, DESCONHECIDO]).estado === "atencao",
    tok([SAUDAVEL, DESCONHECIDO]).valor + " — é o grupo mais perigoso da base",
  );
  ok(
    "e o vencido vence o desconhecido",
    tok([DESCONHECIDO, VENCIDO]).estado === "erro",
    "a ordem entre os dois piores também é fixa",
  );
  ok(
    "com vários expirando, o MENOR número de dias aparece",
    tok([perfil(emDias(40)), EXPIRANDO, perfil(emDias(90))]).valor === "10 dias restantes",
    "não a média, não o primeiro da lista",
  );
  ok(
    "expirando longe é `ok`, expirando perto é `atencao`",
    tok([perfil(emDias(200))]).estado === "ok" && tok([EXPIRANDO]).estado === "atencao",
    "o limiar é o `tokenPedeAtencao`, fonte única com a tela e o cron",
  );

  /* ── PLANTIO: pegar o MELHOR em vez do pior. É a agregação que alguém
     escreveria por reflexo — `some(ok)` em vez de `find(ruim)`. */
  {
    const melhor = (perfis) => (perfis.some((p) => p.tokenExpiresAt && new Date(p.tokenExpiresAt) > AGORA) ? "ok" : "erro");
    ok(
      "PLANTIO: pelo MELHOR, o vencido some atrás do saudável",
      melhor([SAUDAVEL, VENCIDO]) === "ok" && tok([SAUDAVEL, VENCIDO]).estado === "erro",
      "a sincronização daquele perfil está parada, e o painel diria `Operacional`",
    );
    ok(
      "PAR NEGATIVO: com UM perfil só as duas versões concordam",
      melhor([VENCIDO]) === "erro" && melhor([SAUDAVEL]) === "ok",
      "quem tem um perfil — o caso comum — nunca veria o defeito",
    );
  }

  /* A mesma regra na API Meta: uma conta com erro entre boas manda. */
  const api = (accounts) => linha(montarSaude([perfil(emDias(200), accounts)], [], [], AGORA), "API Meta");
  ok("linha de base: contas sem erro dão `Operacional`", api([{ syncErrorCount: 0 }, { syncErrorCount: 0 }]).estado === "ok");
  ok(
    "🔑 uma conta com erro entre boas manda",
    api([{ syncErrorCount: 0 }, { syncErrorCount: 3 }, { syncErrorCount: 0 }]).estado === "erro",
    api([{ syncErrorCount: 0 }, { syncErrorCount: 3 }, { syncErrorCount: 0 }]).valor,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `agora` É PARÂMETRO — a regra do `elapsed()`
 *
 * `montarSaude` deriva o estado do token, que depende de "quando é agora". Um
 * `new Date()` interno produziria HTML diferente no servidor e na hidratação, e
 * o React abortaria a árvore — o efeito visível não é texto errado, é a
 * navegação parar.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · `agora` é parâmetro");

  const p = [perfil(emDias(20))];
  const cedo = linha(montarSaude(p, [], [], AGORA), "Token de acesso");
  const tarde = linha(montarSaude(p, [], [], new Date(AGORA.getTime() + 25 * DIA)), "Token de acesso");

  ok("o mesmo perfil muda de estado com o `agora`", cedo.estado === "atencao" && tarde.estado === "erro", `${cedo.valor} → ${tarde.valor}`);
  ok(
    "e duas chamadas com o mesmo `agora` são idênticas",
    JSON.stringify(montarSaude(p, [], [], AGORA)) === JSON.stringify(montarSaude(p, [], [], AGORA)),
    "determinismo — um `Date.now()` interno faria isto oscilar",
  );

  /* E o consumidor passa o argumento. */
  {
    const { readFileSync } = await import("node:fs");
    const tela = readFileSync("src/components/dashboard/views/integracoes/VisaoGeralScreen.tsx", "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/\/\/[^\n]*/g, "");
    ok("linha de base: a tela chama `montarSaude` no CÓDIGO", /montarSaude\(/.test(tela));
    ok(
      "e passa o `agora` explicitamente",
      /montarSaude\([^)]*,\s*agora\)/.test(tela),
      "sem ele a função cairia no relógio do processo",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: 5 linhas de saúde · 3 estados de integração\n");
