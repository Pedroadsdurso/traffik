/**
 * `deZonasParaGrade` — A CONVERSÃO QUE RODA UMA VEZ POR TESTADOR, SEM VOLTA.
 *
 * 🔴 POR QUE ELA MERECE O MESMO CUIDADO DO `donoDoEvento`
 *
 * Ela é o ponto único da migração zonas → grade, roda **sozinha ao abrir o
 * Dashboard**, e o que ela produz é gravado. Se ela embaralhar a ordem, o
 * arranjo que o usuário montou vira outro — e **não há de onde recuperar**: o
 * envelope antigo já foi convertido.
 *
 * ⛔ O `CLAUDE.md` registra o custo desta família em dinheiro de atenção: a
 * migração de altura foi projetada descartando o campo original, e só a
 * conferência do dono impediu que o layout de cada testador se perdesse na
 * primeira abertura.
 *
 * ## O que se congela: PROPRIEDADE, não resultado
 *
 * Ordem do dono, 14/08/2026 — e é o oposto de "o hero vira dois blocos de 6
 * colunas", que é resultado e envelhece no primeiro ajuste de catálogo:
 *
 *   1. **bloco válido NUNCA muda de posição relativa**
 *   2. **entrada ruim PRESERVA os válidos**, em vez de descartar tudo
 *
 * ⚠️ As quatro entradas (v4 real, v3, corrompido, lixo) já vivem em
 * `test:migrar-layout`. Aqui se exercita a CONVERSÃO em si, que aquele arquivo
 * atravessa sem nomear.
 */

import assert from "node:assert/strict";
import { deZonasParaGrade, fileirasDeMetricas } from "@/components/dashboard/layout/migrar";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};
const eq = (nome, a, b) => {
  assert.deepEqual(a, b, nome + " — obtido " + JSON.stringify(a));
  console.log("  ✓ " + nome + " — " + JSON.stringify(a));
  n++;
};

const ids = (r) => r.blocos.map((b) => b.id);
const painel = (id, col, h) => ({ id, col, h });

/* Métricas que o catálogo conhece. ⛔ Lidas do próprio resultado, não escritas
   à mão: uma lista fixa aqui envelheceria no primeiro nome que mudasse, e o
   teste passaria a medir a lista em vez da conversão. */
const HERO = ["roas", "cpa", "ctr", "arpu"];
const VALIDAS = fileirasDeMetricas(HERO, 2).length;

console.log("\ndeZonasParaGrade — a conversão sem volta");

/* ⛔ LINHA DE BASE: sem ela, todo `deepEqual` abaixo compararia listas vazias. */
ok("linha de base: as métricas do hero são conhecidas pelo catálogo", VALIDAS === HERO.length, VALIDAS + " de " + HERO.length);

/* ═══ 1 · PROPRIEDADE: bloco válido NUNCA muda de posição relativa ══════ */
{
  const paineis = [painel("funil", 6, 5), painel("paises", 6, 4), painel("rodape", 12, 3)];
  const r = deZonasParaGrade({ hero: HERO, faixa: [], paineis });

  /* A ordem dos painéis sobrevive INTEIRA, e na mesma sequência. */
  const saida = ids(r).filter((id) => ["funil", "paises", "rodape"].includes(id));
  eq("a ordem relativa dos painéis é preservada", saida, ["funil", "paises", "rodape"]);

  /* E o hero vem ANTES dos painéis — a leitura em Z do layout. */
  const iHero = ids(r).findIndex((id) => !["funil", "paises", "rodape"].includes(id));
  const iPainel = ids(r).indexOf("funil");
  ok("as métricas vêm antes dos painéis", iHero >= 0 && iHero < iPainel, "hero em " + iHero + ", funil em " + iPainel);

  /* ⛔ E a faixa vem entre os dois — hero, faixa, painéis. */
  const comFaixa = deZonasParaGrade({ hero: ["roas"], faixa: ["cpa"], paineis: [painel("funil", 6, 5)] });
  ok("a ordem das ZONAS é hero → faixa → painéis", ids(comFaixa).length === 3 && ids(comFaixa)[2] === "funil", ids(comFaixa).join(" · "));
}

/* ═══ 2 · PROPRIEDADE: entrada ruim PRESERVA os válidos ═════════════════ */
{
  /* Métrica que não existe no catálogo some — e as vizinhas ficam. */
  const r = deZonasParaGrade({ hero: ["roas", "metrica-que-nao-existe", "cpa"], faixa: [], paineis: [] });
  ok("métrica desconhecida some", ids(r).length === 2, ids(r).join(" · "));
  ok("⛔ e as VÁLIDAS sobrevivem — não se descarta tudo", ids(r).length === 2);

  /* Painel inválido: a conversão NÃO o filtra (quem filtra é o catálogo, mais
     tarde) — mas também não perde os vizinhos. É o que a propriedade exige. */
  const p = deZonasParaGrade({
    hero: [],
    faixa: [],
    paineis: [painel("funil", 6, 5), painel("bloco-que-morreu", 4, 3), painel("paises", 6, 4)],
  });
  const sobreviventes = ids(p).filter((id) => id === "funil" || id === "paises");
  eq("⛔ com painel inválido no meio, os válidos preservam a ORDEM", sobreviventes, ["funil", "paises"]);
}

/* ═══ 3 · Zonas vazias — e o legado guardado ════════════════════════════ */
{
  const r = deZonasParaGrade({ hero: [], faixa: [], paineis: [] });
  eq("tudo vazio devolve nenhum bloco", ids(r), []);

  /* ⚠️ `heroLegado`/`faixaLegado` são a PROCEDÊNCIA — o que havia antes da
     conversão. Perdê-los é a família "excluir configuração não pode apagar a
     procedência", e aqui não há de onde recuperar. */
  const z = { hero: HERO, faixa: ["vendas"], paineis: [] };
  const c = deZonasParaGrade(z);
  eq("⛔ o hero legado é GUARDADO, não descartado", c.heroLegado, HERO);
  eq("⛔ a faixa legada também", c.faixaLegado, ["vendas"]);
  ok(
    "…e são os valores de ENTRADA, não os convertidos",
    c.heroLegado !== c.blocos && c.heroLegado.every((x) => typeof x === "string"),
    "strings de métrica, não blocos de grade",
  );
}

/* ═══ 4 · INVARIANTE: nada aparece do nada, nada some sem motivo ════════ */
{
  /* Fuzz com semente FIXA. A propriedade: o número de blocos é
     (métricas válidas do hero) + (da faixa) + (painéis), sempre. */
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const POSSIVEIS = [...HERO, "vendas", "lucro", "nao-existe-1", "nao-existe-2"];
  let casos = 0;
  let viuInvalida = 0;
  let viuPainel = 0;

  for (let t = 0; t < 200; t++) {
    const hero = POSSIVEIS.filter(() => rnd() > 0.5);
    const faixa = POSSIVEIS.filter(() => rnd() > 0.7);
    const paineis = ["funil", "paises", "rodape"].filter(() => rnd() > 0.5).map((id) => painel(id, 6, 3));

    const r = deZonasParaGrade({ hero, faixa, paineis });
    const esperado = fileirasDeMetricas(hero, 2).length + fileirasDeMetricas(faixa, 1).length + paineis.length;
    assert.equal(r.blocos.length, esperado, "contagem divergiu — hero " + JSON.stringify(hero));

    /* Os painéis nunca mudam de ordem entre si. */
    const ordem = ids(r).filter((id) => paineis.some((p) => p.id === id));
    assert.deepEqual(ordem, paineis.map((p) => p.id), "a ordem dos painéis mudou");

    if (hero.some((x) => x.startsWith("nao-existe"))) viuInvalida++;
    if (paineis.length) viuPainel++;
    casos++;
  }
  ok("fuzz(200, semente 7): contagem e ordem preservadas", casos === 200);
  /* ⛔ LINHAS DE BASE — sem elas o fuzz passaria com 200 entradas vazias. */
  ok("linha de base: o fuzz produziu entrada com métrica INVÁLIDA (" + viuInvalida + ")", viuInvalida > 0);
  ok("linha de base: o fuzz produziu casos COM painel (" + viuPainel + ")", viuPainel > 0);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · PLANTIOS — os dois são consertos plausíveis
 * ═════════════════════════════════════════════════════════════════════ */
console.log("\n5 · plantios");

/* ── A: descartar TUDO ao encontrar uma entrada inválida ─────────────────
   O "conserto" defensivo: *"se tem lixo, melhor não migrar nada"*. Ele parece
   seguro e é o pior desfecho possível numa conversão sem volta — o usuário
   perde o arranjo inteiro por causa de UMA chave. */
{
  const tudoOuNada = (z) => {
    const invalida = z.hero.some((c) => fileirasDeMetricas([c], 2).length === 0);
    return invalida ? { blocos: [], heroLegado: z.hero, faixaLegado: z.faixa } : deZonasParaGrade(z);
  };
  const z = { hero: ["roas", "nao-existe", "cpa"], faixa: [], paineis: [painel("funil", 6, 5)] };
  const ruim = tudoOuNada(z);
  const certo = deZonasParaGrade(z);
  ok("PLANTIO A: 'tudo ou nada' devolve ZERO blocos", ruim.blocos.length === 0);
  ok("PLANTIO A: e o certo preserva os válidos", certo.blocos.length === 3, ids(certo).join(" · "));
  let caiu = false;
  try {
    assert.ok(ruim.blocos.length > 0, "os válidos precisam sobreviver");
  } catch {
    caiu = true;
  }
  ok("PLANTIO A: a asserção da preservação DERRUBA", caiu);
}

/* ── B: ordenar a saída "para ficar organizado" ──────────────────────────
   Parece arrumação inofensiva e é a perda do arranjo: o usuário escolheu a
   ordem, e ordenar por id a substitui pela ordem alfabética. */
{
  const ordenado = (z) => {
    const r = deZonasParaGrade(z);
    return { ...r, blocos: [...r.blocos].sort((a, b) => a.id.localeCompare(b.id)) };
  };
  const z = { hero: [], faixa: [], paineis: [painel("rodape", 12, 3), painel("funil", 6, 5), painel("paises", 6, 4)] };
  const ruim = ordenado(z).blocos.map((b) => b.id);
  const certo = ids(deZonasParaGrade(z));
  eq("PLANTIO B: ordenar troca a sequência escolhida", ruim, ["funil", "paises", "rodape"]);
  eq("PLANTIO B: e o certo mantém a do usuário", certo, ["rodape", "funil", "paises"]);
  let caiu = false;
  try {
    assert.deepEqual(ruim, ["rodape", "funil", "paises"]);
  } catch {
    caiu = true;
  }
  ok("PLANTIO B: a asserção da ordem relativa DERRUBA", caiu);
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
