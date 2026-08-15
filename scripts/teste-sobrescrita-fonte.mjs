/**
 * `paisesSobrescreviveis` / `matchesSobrescreviveis` — A PERMISSÃO DE ESCRITA
 * QUE MORA DENTRO DO `WHERE`.
 *
 * Elas produzem a lista que vai no `in:` do upsert de venda
 * (`ingestSale.ts:277` e `:288`):
 *
 * ```ts
 * OR: [{ country: null }, { countrySource: { in: paisesSobrescreviveis(countrySource) } }]
 * OR: [{ clickId: null }, { matchMethod: { in: matchesSobrescreviveis(match.method) } }]
 * ```
 *
 * ### 🔴 O QUE ACONTECE QUANDO A LISTA ESTÁ ERRADA
 *
 * O cabeçalho de `gateways/fontes.ts` descreve o bug que elas existem para
 * impedir, e ele já aconteceu:
 *
 * > se o primeiro evento casou por `direct` (o `click_id` que o nosso script
 * > propagou) e o segundo, com payload esparso, casa por `ip` num clique
 * > **DIFERENTE**, o match forte era substituído pelo fraco. A venda passava a
 * > apontar para outro visitante — e daí saem país, campanha e atribuição.
 *
 * ⛔ Ou seja: uma lista larga demais **reaponta a venda para outra pessoa**, e
 * uma estreita demais **congela o campo** — nas duas o número segue plausível.
 *
 * ### 🔑 A RELAÇÃO CENTRAL É ENTRE AS DUAS FORMAS DA MESMA PERGUNTA
 *
 * O módulo expõe a decisão de dois jeitos: como LISTA (para o `WHERE`) e como
 * BOOLEANO (`paisEhMelhor`/`matchEhMelhor`, "para decidir fora de um `WHERE`").
 *
 * > ## Duas formas da mesma pergunta é uma duplicata com outro nome — e a única defesa é exigir que concordem em TODO o domínio.
 *
 * ⚠️ Aqui elas **compartilham a tabela de força**, então a duplicação é parcial
 * e o conserto certo não seria apagar uma: as duas formas são necessárias (o
 * Prisma precisa de lista, o código precisa de booleano). O que se congela é o
 * acordo, sobre o produto cartesiano inteiro.
 *
 * ⚠️ **Limite:** `FORCA_PAIS` e `FORCA_MATCH` são privadas do módulo. Este
 * arquivo não conhece os números — ele os DERIVA das próprias funções. Uma
 * asserção que copiasse a tabela mediria a cópia.
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { paisesSobrescreviveis, matchesSobrescreviveis, paisEhMelhor, matchEhMelhor } =
  await import("@/lib/gateways/fontes");

/**
 * Os dois domínios, DERIVADOS e não copiados: a lista da fonte mais forte
 * conhecida contém todas as chaves da tabela.
 *
 * ⛔ Não escrevo `["payload","ip","campanha",…]` à mão. Uma cópia aqui
 * envelheceria no primeiro campo derivado novo — e o cabeçalho do módulo diz,
 * literalmente, que acrescentar fonte é acrescentar linha na tabela dele.
 */
const DOMINIOS = [
  { nome: "país", lista: paisesSobrescreviveis, melhor: paisEhMelhor, forte: "payload" },
  { nome: "match", lista: matchesSobrescreviveis, melhor: matchEhMelhor, forte: "direct" },
];

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — há hierarquia, e ela é derivada da própria função
 *
 * ⛔ Sem isto, uma implementação que devolvesse SEMPRE a tabela inteira
 * satisfaria "acordo", "monotonia" e "nunca vazia" com nota máxima — e seria
 * exatamente o defeito de permissão larga demais.
 * ═════════════════════════════════════════════════════════════════════ */
const CHAVES = {};
{
  console.log("\n0 · linha de base — existe hierarquia");

  for (const d of DOMINIOS) {
    const todas = d.lista(d.forte);
    CHAVES[d.nome] = todas;

    ok(
      d.nome + ": a fonte mais forte (`" + d.forte + "`) sobrescreve TUDO",
      todas.length >= 4,
      todas.length + " fontes: " + todas.join(", "),
    );

    /* 🔴 A METADE QUE IMPEDE "devolve tudo sempre": a fonte mais FRACA tem de
       sobrescrever estritamente menos que a mais forte. */
    const fraca = d.lista(null);
    ok(
      d.nome + ": a fonte DESCONHECIDA sobrescreve estritamente menos",
      fraca.length > 0 && fraca.length < todas.length,
      fraca.length + " de " + todas.length + ": " + fraca.join(", "),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · O ACORDO ENTRE A LISTA E O BOOLEANO — sobre o produto cartesiano
 *
 * Esta é a relação, e ela não conhece nenhum número: para TODO par (nova,
 * atual), estar na lista tem de ser a mesma coisa que "é melhor ou igual".
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · a lista e o booleano concordam");

  for (const d of DOMINIOS) {
    const chaves = [...CHAVES[d.nome], null, "fonte-que-nao-existe"];
    const divergem = [];
    let pares = 0;

    for (const nova of chaves) {
      const permitidas = d.lista(nova);
      for (const atual of chaves) {
        pares++;
        const naLista = permitidas.includes(atual ?? "");
        const booleano = d.melhor(nova, atual);
        /* ⚠️ `null` e a fonte inventada NÃO estão na tabela, então nunca
           aparecem na lista — mas o booleano os trata como força 0. O acordo
           vale para as chaves REAIS; para as de fora, a lista é o lado
           conservador, e a §2 mede isso separado. */
        if (CHAVES[d.nome].includes(atual) && naLista !== booleano) {
          divergem.push(`${nova ?? "null"} → ${atual}: lista ${naLista}, booleano ${booleano}`);
        }
      }
    }

    /* ⚠️ O limiar é DERIVADO do domínio, não escrito. A primeira versão usava
       `pares > 40` e reprovou no `match`, que tem 4 chaves (36 pares) contra as
       10 do país (144). Limiar fixado antes de medir é a família que o `07`
       registra três vezes — e aqui ela apareceu na minha própria linha de
       base. */
    ok(
      d.nome + ": linha de base — o produto cartesiano inteiro foi percorrido",
      pares === chaves.length ** 2,
      pares + " pares (" + chaves.length + "²)",
    );
    ok(
      d.nome + ": lista e booleano concordam em TODO par",
      divergem.length === 0,
      divergem.slice(0, 3).join(" · "),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · A FONTE DESCONHECIDA VALE ZERO — "a dúvida vira bloqueio"
 *
 * É a regra do projeto aplicada a permissão de escrita, e o cabeçalho do módulo
 * a escreve: *"uma fonte que não esteja aqui vale 0 — então esquecer de
 * cadastrar NUNCA amplia permissão de escrita"*. Afirmação de efeito, portanto
 * asserção.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · fonte desconhecida vale zero");

  for (const d of DOMINIOS) {
    const doNulo = d.lista(null);
    const doInventado = d.lista("typo-no-nome-da-fonte");

    ok(
      d.nome + ": nome inventado dá a MESMA permissão que `null`",
      JSON.stringify(doInventado) === JSON.stringify(doNulo),
      doInventado.join(", "),
    );
    ok(
      d.nome + ": e ele NÃO sobrescreve uma fonte medida",
      !doInventado.includes(d.forte),
      "`" + d.forte + "` é medição — um typo não pode apagá-la",
    );
    ok(
      d.nome + ": mas sobrescreve o que também vale zero",
      doInventado.length > 0,
      "senão o campo congelaria para sempre no primeiro valor fraco",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · MONOTONIA E REFLEXIVIDADE — e a reflexividade é o REPROCESSAMENTO
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · monotonia e reflexividade");

  for (const d of DOMINIOS) {
    const chaves = CHAVES[d.nome];

    /* Reflexividade: toda fonte sobrescreve a SI MESMA. Não é detalhe formal —
       é o que permite corrigir uma venda reprocessando com a mesma origem. */
    const naoReflexivas = chaves.filter((f) => !d.lista(f).includes(f));
    ok(
      d.nome + ": toda fonte sobrescreve a si mesma (o reprocessamento)",
      naoReflexivas.length === 0,
      naoReflexivas.join(", ") || chaves.length + " de " + chaves.length,
    );

    /* Monotonia: se `a` sobrescreve `b`, então tudo que `b` sobrescreve, `a`
       também sobrescreve. Sem isso a hierarquia não é uma ordem, e existiria um
       par em que a força "média" escreve onde a "forte" não escreve. */
    const quebras = [];
    for (const a of chaves) {
      const deA = d.lista(a);
      for (const b of chaves) {
        if (!deA.includes(b)) continue;
        const naoContidos = d.lista(b).filter((x) => !deA.includes(x));
        if (naoContidos.length) quebras.push(`${a} ⊇ ${b} falhou em ${naoContidos.join(",")}`);
      }
    }
    ok(d.nome + ": a permissão é MONOTÔNICA", quebras.length === 0, quebras.slice(0, 2).join(" · "));

    /* A lista nunca é vazia: `in: []` no Prisma não casa com NADA, então o
       campo só poderia ser escrito quando estivesse nulo. */
    const vazias = [...chaves, null, "inventada"].filter((f) => d.lista(f).length === 0);
    ok(
      d.nome + ": nenhuma lista sai VAZIA",
      vazias.length === 0,
      "`in: []` no Prisma congela o campo em qualquer valor não nulo",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · PLANTIO A — `<` no lugar de `<=`, e ele quebra O REPROCESSAMENTO
 *
 * É o "conserto" de quem lê a hierarquia e conclui que reescrever com a MESMA
 * força é trabalho inútil. O `07` já registra o gêmeo dele no `paisEhMelhor`:
 * *"parece mais seguro e quebra o reprocessamento — correção do gateway, vinda
 * da mesma fonte, é ignorada"*.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · plantio A — o estrito, que ignora a correção");

  for (const d of DOMINIOS) {
    const chaves = CHAVES[d.nome];
    /* A versão estrita, derivada da real: tira do resultado a própria fonte e
       as de força igual (que são exatamente as que a real inclui e a estrita
       não). */
    const estrito = (nova) => d.lista(nova).filter((f) => !d.lista(f).includes(nova));

    ok(
      d.nome + ": PLANTIO A — a fonte deixa de sobrescrever a si mesma",
      chaves.every((f) => !estrito(f).includes(f)),
      "reprocessar com a mesma origem para de escrever",
    );
    ok(
      d.nome + ": PLANTIO A — a asserção da reflexividade DERRUBA",
      estrito(d.forte).length < d.lista(d.forte).length,
      d.lista(d.forte).length + " → " + estrito(d.forte).length + " fontes permitidas",
    );

    /* ── PAR NEGATIVO, e é ele que explica por que o defeito seria MUDO:
       quando a fonte nova é ESTRITAMENTE mais forte que a guardada — que é a
       ingestão normal, o caminho de melhora —, as duas versões permitem
       igual. Elas só divergem quando as forças EMPATAM, ou seja no caminho da
       CORREÇÃO. */
    const maisForteQue = (a, b) => d.lista(a).includes(b) && !d.lista(b).includes(a);
    const paresDeMelhora = [];
    for (const a of chaves) for (const b of chaves) if (maisForteQue(a, b)) paresDeMelhora.push([a, b]);

    ok(
      d.nome + ": linha de base — há " + paresDeMelhora.length + " pares de MELHORA",
      paresDeMelhora.length > 0,
    );
    ok(
      d.nome + ": PAR NEGATIVO — na melhora as duas versões permitem igual",
      paresDeMelhora.every(([a, b]) => estrito(a).includes(b) === d.lista(a).includes(b)),
      "a ingestão normal não denuncia; só a correção some",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · PLANTIO B — desconhecida valendo o MÁXIMO ("na dúvida, deixa escrever")
 *
 * É o oposto exato da regra do projeto, e é plausível para quem tema congelar
 * o campo. O custo: um typo no nome da fonte apaga uma MEDIÇÃO.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · plantio B — a dúvida virando permissão");

  for (const d of DOMINIOS) {
    const frouxo = (nova) => (CHAVES[d.nome].includes(nova) ? d.lista(nova) : d.lista(d.forte));

    ok(
      d.nome + ": PLANTIO B — o typo passa a sobrescrever a fonte medida",
      frouxo("payloadd").includes(d.forte) && !d.lista("payloadd").includes(d.forte),
      "um erro de digitação apagaria `" + d.forte + "`, que é medição",
    );
    ok(
      d.nome + ": PLANTIO B — a asserção da §2 DERRUBA",
      JSON.stringify(frouxo("payloadd")) !== JSON.stringify(d.lista(null)),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 · PLANTIO C — a tabela TROCADA entre os dois domínios
 *
 * Copiar/colar entre `paisesSobrescreviveis` e `matchesSobrescreviveis` é o
 * erro fácil: as duas têm a mesma forma e chamam o mesmo helper. E o modo de
 * falha é o mais silencioso dos três.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n6 · plantio C — as tabelas trocadas");

  /* 🔴 ACHADO — eu supus que os dois domínios não tivessem chave em comum, e a
     asserção me corrigiu: **`ip` está nos dois**, com postos OPOSTOS.

       país  → `ip` é MEDIÇÃO (empatada no topo com `payload`): resolvemos o
               endereço do comprador.
       match → `ip` é INFERÊNCIA FROUXA (o mais fraco não nulo): "algum clique
               do mesmo IP nas últimas 12 h".

     ⛔ A mesma palavra é o melhor de uma hierarquia e o quase-pior da outra. E
     é isso que torna a troca de tabelas PERIGOSA em vez de inofensiva: uma
     parte dos nomes não casaria (congelando o campo), e o `ip` casaria — com a
     força invertida. */
  const comuns = CHAVES["país"].filter((f) => CHAVES["match"].includes(f));
  ok(
    "🔴 os dois domínios compartilham exatamente UMA chave",
    comuns.length === 1 && comuns[0] === "ip",
    "`" + comuns.join(", ") + "` — e o posto dela é oposto nos dois",
  );

  /* O posto é DERIVADO: quantas fontes daquele domínio a chave sobrescreve. */
  const postoPais = paisesSobrescreviveis("ip").length;
  const postoMatch = matchesSobrescreviveis("ip").length;
  ok(
    "`ip` é quase o TOPO em país e quase o PISO em match",
    postoPais === CHAVES["país"].length && postoMatch < CHAVES["match"].length,
    `país: sobrescreve ${postoPais}/${CHAVES["país"].length} · match: ${postoMatch}/${CHAVES["match"].length}`,
  );

  /* ── A troca de tabelas, medida nos dois efeitos. */
  const trocada = matchesSobrescreviveis("payload"); // fonte de PAÍS na tabela de MATCH
  ok(
    "PLANTIO C: uma fonte de país SEM par cai como desconhecida no match",
    JSON.stringify(trocada) === JSON.stringify(matchesSobrescreviveis(null)),
    trocada.join(", ") + " — nenhum casa com `countrySource`, e o campo congela",
  );
  ok(
    "PLANTIO C: …mas o `ip` CASA, e com a força invertida",
    matchesSobrescreviveis("ip").length < paisesSobrescreviveis("ip").length,
    "um país medido por IP passaria a sobrescrever quase nada — perde para `campanha`, que é estimativa",
  );
  ok(
    "PLANTIO C: e a §1 (acordo lista × booleano) DERRUBA",
    matchesSobrescreviveis("ip").includes("campanha") !== paisEhMelhor("ip", "campanha"),
    "a lista trocada diria NÃO onde o booleano do país diz SIM",
  );
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log(
  "   denominador: 2 domínios · " +
    CHAVES["país"].length +
    " fontes de país · " +
    CHAVES["match"].length +
    " métodos de match\n",
);
