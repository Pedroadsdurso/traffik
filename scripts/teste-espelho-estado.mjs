/**
 * `estadoDoEspelho` / `ordemDoEspelho` — O VOCABULÁRIO DOS ESTADOS DO ESPELHO.
 *
 * ### ⚠️ CORREÇÃO DE PREMISSA — este arquivo NÃO é a dedup
 *
 * Ele entrou na fila como *"dedup que falha para o lado errado dobra contagem
 * na Meta"*. **Medido antes de escrever: não é.** `lib/pixel/espelho.ts` é uma
 * tabela de rótulo, tom e texto de ajuda. O espelho de verdade — o `fbq` que
 * recebe o mesmo `eventId` que a CAPI — vive no runtime gerado, e **já tem
 * cobertura**:
 *
 * | | |
 * |---|---|
 * | `test:espelho` | 39 asserções sobre `pixelScript`, em DOM falso |
 * | `test:donos-evento` | 39 asserções sobre a partição que impede o envio duplo |
 * | `test:eid` | o `eventId` determinístico dos dois lados |
 *
 * ⛔ Escrever aqui uma asserção "de dedup" seria duplicar teste — o que a fila
 * pediu explicitamente para não fazer.
 *
 * ### 🔑 O QUE ESTE MÓDULO DECIDE DE FATO, E VALE CONGELAR
 *
 * Duas coisas, e a segunda é uma relação entre dois arquivos:
 *
 * 1. **Estado desconhecido nunca some da contagem** — ele cai em `nulo`. E o
 *    fallback importa: a primeira entrada da tabela é `ok` ("saiu junto",
 *    tom **bom**). Cair no índice 0 daria rótulo BENIGNO a um estado que
 *    ninguém sabe nomear.
 *
 * 2. **`estadoDoEspelho` e `ordemDoEspelho` respondem à MESMA pergunta** —
 *    "esta chave é conhecida?" —, uma devolvendo o registro e a outra um
 *    índice. E `actions/diagnostics.ts:102` depende do acordo entre as duas:
 *
 *    ```ts
 *    const chave = (v) => (v && ordemDoEspelho(v) < 99 ? v : "nulo");
 *    ```
 *
 *    Se `ordemDoEspelho` aceitasse uma chave que o `estadoDoEspelho` não
 *    reconhece, a contagem manteria o nome cru e a TELA renderizaria `nulo` —
 *    duas telas discordando sobre a mesma linha.
 *
 * ⚠️ É a família *duas formas da mesma pergunta*. Aqui as duas leem a MESMA
 * tabela, então o conserto certo não seria apagar uma: o que se congela é o
 * acordo.
 */

import assert from "node:assert/strict";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const { ESTADOS_DO_ESPELHO, estadoDoEspelho, ordemDoEspelho } = await import("@/lib/pixel/espelho");

const CHAVES = ESTADOS_DO_ESPELHO.map((e) => e.estado);
const LIXO = ["", "OK", "ok ", "sem_fbq", "inventado", "null", "undefined", "99"];

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — toda chave declarada resolve para SI MESMA
 *
 * ⛔ Sem isto, um `estadoDoEspelho` que devolvesse SEMPRE `nulo` satisfaria a
 * §1 inteira com nota máxima — e apagaria a tela.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — as chaves declaradas resolvem para si");

  ok("a tabela tem estados", CHAVES.length >= 6, CHAVES.length + ": " + CHAVES.join(", "));
  const naoResolvem = CHAVES.filter((k) => estadoDoEspelho(k).estado !== k);
  ok("as " + CHAVES.length + " chaves resolvem para si mesmas", naoResolvem.length === 0, naoResolvem.join(", "));
  ok("`nulo` está na tabela — é o destino do fallback", CHAVES.includes("nulo"));
  ok("e ele não é o PRIMEIRO", CHAVES[0] !== "nulo", "o primeiro é `" + CHAVES[0] + "`");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · O DESCONHECIDO CAI EM `nulo`, e não no índice 0
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · o fallback");

  const foraDoNulo = LIXO.filter((k) => estadoDoEspelho(k).estado !== "nulo");
  ok(
    "as " + LIXO.length + " chaves inválidas caem em `nulo`",
    foraDoNulo.length === 0,
    JSON.stringify(foraDoNulo),
  );
  ok("e nunca devolve `undefined`", LIXO.every((k) => !!estadoDoEspelho(k)?.rotulo));

  /* ⚠️ Sensível a caixa e a espaço DE PROPÓSITO: a coluna guarda a chave que o
     script escreveu, e "quase igual" é desconhecido. Cair em `nulo` é honesto;
     casar por aproximação inventaria um estado. */
  ok("`OK` (caixa alta) não casa com `ok`", estadoDoEspelho("OK").estado === "nulo");
  ok("`ok ` (com espaço) também não", estadoDoEspelho("ok ").estado === "nulo");

  /* ── PLANTIO A: fallback no índice 0 em vez de `nulo`. É o "conserto" de quem
     escreve `?? ESTADOS_DO_ESPELHO[0]` sem olhar o que está lá. */
  {
    const plantio = (k) => ESTADOS_DO_ESPELHO.find((e) => e.estado === k) ?? ESTADOS_DO_ESPELHO[0];
    ok(
      "PLANTIO A: o desconhecido ganharia o rótulo do PRIMEIRO estado",
      plantio("inventado").estado === CHAVES[0],
      "`" + plantio("inventado").rotulo + "`, tom " + plantio("inventado").tom,
    );
    ok(
      "PLANTIO A: …e esse rótulo é BENIGNO — pior que não saber",
      plantio("inventado").tom === "bom",
      "um estado que ninguém nomeia apareceria como sucesso",
    );
    ok("PLANTIO A: a asserção do fallback DERRUBA", plantio("inventado").estado !== "nulo");
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · O ACORDO COM `ordemDoEspelho` — e é dele que `diagnostics.ts` depende
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · a ordem e o registro concordam sobre o que é CONHECIDO");

  const todas = [...CHAVES, ...LIXO];
  const divergem = todas.filter((k) => (ordemDoEspelho(k) < 99) !== (estadoDoEspelho(k).estado === k));
  ok(
    "linha de base: " + todas.length + " chaves examinadas, conhecidas e não",
    todas.length > CHAVES.length,
  );
  ok(
    "`ordemDoEspelho(k) < 99` ⟺ `estadoDoEspelho(k).estado === k`",
    divergem.length === 0,
    divergem.join(", ") || "é o predicado que `diagnostics.ts:102` usa",
  );

  ok("toda chave conhecida tem índice único", new Set(CHAVES.map(ordemDoEspelho)).size === CHAVES.length);
  ok("e o desconhecido vai para o FIM", LIXO.every((k) => ordemDoEspelho(k) === 99));

  /* ── PLANTIO B: desconhecido valendo 0 ("põe no começo"). */
  {
    const plantio = (k) => {
      const i = CHAVES.indexOf(k);
      return i < 0 ? 0 : i;
    };
    ok(
      "PLANTIO B: o desconhecido passaria no teste `< 99` do diagnóstico",
      plantio("inventado") < 99,
      "a contagem guardaria o nome cru e a TELA renderizaria `nulo`",
    );
    ok(
      "PLANTIO B: a asserção do acordo DERRUBA",
      (plantio("inventado") < 99) !== (estadoDoEspelho("inventado").estado === "inventado"),
    );
    /* PAR NEGATIVO: sobre as chaves CONHECIDAS as duas versões dão o mesmo
       índice. A divergência mora só no desconhecido — que é o caso que ninguém
       cria de propósito e por isso ninguém testa à mão. */
    ok(
      "PAR NEGATIVO: nas " + CHAVES.length + " chaves conhecidas as duas concordam",
      CHAVES.every((k) => plantio(k) === ordemDoEspelho(k)),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · A ORDEM É NARRATIVA, E O QUE NÃO É FALHA VEM POR ÚLTIMO
 *
 * ⛔ Não é "pior primeiro": a tabela vai de bom → atenção → ruim → neutro. O
 * que importa é que o **neutro nunca suba**: `sem-nativo`, `alheio` e `nulo`
 * são "não é falha", e se algum deles subisse acima de `sem-fbq` o estado que
 * significa contagem dobrada ficaria enterrado.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · o que não é falha vem por último");

  const tons = ESTADOS_DO_ESPELHO.map((e) => e.tom);
  const TOM_VALIDO = ["bom", "atencao", "ruim", "neutro"];

  ok("todo tom é um dos quatro", tons.every((t) => TOM_VALIDO.includes(t)), [...new Set(tons)].join(", "));
  ok(
    "linha de base: há tons de falha E de não-falha",
    tons.includes("ruim") && tons.includes("neutro"),
  );

  const primeiroNeutro = tons.indexOf("neutro");
  ok(
    "nenhum estado de falha aparece DEPOIS do primeiro neutro",
    tons.slice(primeiroNeutro).every((t) => t === "neutro"),
    "os " + (tons.length - primeiroNeutro) + " últimos são todos `neutro`",
  );
  ok(
    "e `sem-fbq` fica ACIMA de todo neutro",
    ordemDoEspelho("sem-fbq") < primeiroNeutro,
    "é o estado que significa possível contagem dobrada na Meta",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · O TEXTO — e `sem-fbq` afirma um efeito, portanto é asserção
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · o texto que a tela mostra");

  const vazios = ESTADOS_DO_ESPELHO.filter((e) => !e.rotulo?.trim() || !e.ajuda?.trim());
  ok("nenhum estado sai sem rótulo nem ajuda", vazios.length === 0, vazios.map((e) => e.estado).join(", "));
  ok(
    "nenhum rótulo é longo demais para o selo",
    ESTADOS_DO_ESPELHO.every((e) => e.rotulo.length <= 40),
    "maior: " + Math.max(...ESTADOS_DO_ESPELHO.map((e) => e.rotulo.length)) + " caracteres",
  );
  ok(
    "nenhum rótulo mostra a chave CRUA",
    ESTADOS_DO_ESPELHO.every((e) => e.rotulo !== e.estado),
    "`sem-fbq` na tela seria jargão de programador",
  );

  /* O único estado cuja ajuda promete uma CONSEQUÊNCIA na Meta. */
  const semFbq = estadoDoEspelho("sem-fbq");
  ok("`sem-fbq` é `ruim`", semFbq.tom === "ruim");
  ok(
    "…e a ajuda dele diz a consequência: contagem em DOBRO",
    /dobro/i.test(semFbq.ajuda),
    "é a única forma de o usuário saber por que aquilo importa",
  );
  ok(
    "…e diz o que FAZER",
    /cole o script|depois dele/i.test(semFbq.ajuda),
    "diagnóstico sem próximo passo é ruído",
  );

  /* E o oposto: `nulo` e `sem-nativo` NÃO podem soar como falha. */
  for (const k of ["nulo", "sem-nativo"]) {
    ok(
      "`" + k + "` declara que NÃO é falha",
      /não (é|significa) falha/i.test(estadoDoEspelho(k).ajuda),
      "sem isso o histórico inteiro pareceria espelho quebrado",
    );
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m");
console.log("   denominador: " + CHAVES.length + " estados declarados · " + LIXO.length + " chaves inválidas\n");
