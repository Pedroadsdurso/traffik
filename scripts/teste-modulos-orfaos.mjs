/**
 * MÓDULOS DE `src/lib/` QUE NINGUÉM IMPORTA — a varredura, não o caso.
 *
 * ### ⛔ POR QUE ESTE ARQUIVO EXISTE NO LUGAR DE UM `test:funil`
 *
 * A fila pedia cobertura para `calcularFunil` (`src/lib/funnel.ts`). Medido
 * antes de escrever: **ele não tem consumidor nenhum.** `EtapaCalculada`,
 * `ResumoFunil`, `gargalo`, `perdaPct` e `taxaVsAnterior` têm **zero
 * ocorrências fora do próprio arquivo**, em `src/` e em `scripts/`. O funil
 * vivo é `lib/funil/fita.ts`, e ele já tem quatro suítes.
 *
 * > ## Escrever asserção verde sobre `calcularFunil` seria fabricar exatamente a *GARANTIA FALSA* que esta base nomeou em 07/08/2026.
 *
 * O registro daquele dia diz, literal: um órfão **sem** teste é silêncio; um
 * órfão **com** teste verde é uma afirmação de que a coisa funciona — *"e
 * nenhuma das duas metades é verdade"*. A fixture do teste seria o único
 * chamador, e para o agregado um chamador basta.
 *
 * ### 🔑 O QUE SUBSTITUI, e é a meta-regra: registre o PADRÃO
 *
 * Esta base já pagou **sete vezes** por "existe e ninguém consome". Um teste
 * sobre um deles não acha o oitavo. Uma varredura acha.
 *
 * **Medido em 14/08/2026: 3 órfãos em 124 módulos de `src/lib/`** — e os três
 * são de categorias diferentes, o que é o motivo de a lista carregar o MOTIVO
 * de cada um em vez de só o nome:
 *
 * | módulo | categoria |
 * |---|---|
 * | `ads/escopo.ts` | ✅ **lápide deliberada** — `export {}` com o aviso de não reintroduzir |
 * | `funnel.ts` | ⚠️ **superado** pela reescrita do funil, sem lápide |
 * | ~~`areas/taxas.ts`~~ | ✅ **RELIGADO em 14/08** — saiu da lista. Ver a §3 |
 *
 * ⚠️ E a lista é um REGISTRO, não uma permissão: a varredura reprova nos dois
 * sentidos — órfão novo que aparece, e órfão registrado que ganha consumidor.
 * O segundo sentido não é uma falha: é o aviso de que a entrada envelheceu.
 */

import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

/**
 * Os órfãos ACEITOS, com o motivo e o que fazer quando a linha mudar.
 *
 * ⛔ Cada entrada carrega a saída dela. Um registro sem saída escrita é o
 * formato "decidido, não reabrir" que o CLAUDE.md proíbe por nome.
 */
const ACEITOS = {
  "src/lib/ads/escopo.ts":
    "LÁPIDE deliberada: `export {}` + o aviso de não reintroduzir `filtroEfetivo`/`escopoExcluindo` " +
    "(o modelo antigo escondia 12 de 14 vendas reais). Se ganhar consumidor, alguém reintroduziu o defeito.",
  "src/lib/funnel.ts":
    "SUPERADO pela reescrita do funil (`lib/funil/fita.ts`, com 4 suítes). Sem lápide, e a regra de percentual " +
    "dele ('vs. maior etapa', com teto em 100) NÃO é a do funil vivo — revivê-lo troca a conta em silêncio. " +
    "Se for deletado, apague esta entrada.",
};

const semCom = (s) =>
  s
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");

/**
 * O conjunto de CONSUMIDORES — e a exclusão dos `teste-*.mjs` é a regra, não
 * uma conveniência.
 *
 * > ## O `grep` que responde não é *"alguém importa?"* — é **"alguém ALÉM DO TESTE importa?"**. Um símbolo cujo único chamador é a fixture que o testa está morto com atestado de saúde.
 *
 * ⚠️ Escrito depois de a varredura reprovar por MINHA causa: a §3 importa
 * `@/lib/areas/taxas` para exercitar a função, e com os testes no conjunto isso
 * fez o módulo aparecer como revivido. A guarda pegou o próprio autor.
 *
 * ⛔ Os outros scripts FICAM: `encrypt-secrets.mjs` e `seed-dev.mjs` são
 * consumidores de verdade, e excluir `scripts/` inteiro marcaria como órfão
 * módulo que roda em operação real.
 */
const arquivos = [...globSync("src/**/*.{ts,tsx}"), ...globSync("scripts/**/*.mjs")]
  .map((f) => f.replace(/\\/g, "/"))
  .filter((f) => !f.includes("generated"))
  .filter((f) => !/^scripts\/teste-/.test(f));

const fontes = new Map(arquivos.map((f) => [f, semCom(readFileSync(f, "utf8"))]));
const libs = arquivos.filter((f) => f.startsWith("src/lib/"));

/** Alguém, além do próprio arquivo, importa este módulo? */
const temImportador = (f) => {
  const semExt = f.replace(/\.tsx?$/, "");
  const alias = "@/" + semExt.replace(/^src\//, "");
  const base = semExt.split("/").pop();

  for (const [g, src] of fontes) {
    if (g === f) continue;
    if (src.includes(alias + '"') || src.includes(alias + "'")) return g;
    const dir = path.posix.dirname(g);
    for (const m of src.matchAll(new RegExp('["\'](\\.{1,2}/[\\w./-]*' + base + ')["\']', "g"))) {
      if (path.posix.normalize(path.posix.join(dir, m[1])) === semExt) return g;
    }
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — o detector SABE reconhecer consumo
 *
 * ⛔ Esta é a asserção que a família *"a medição não acertou o alvo"* exige.
 * Um resolvedor de import quebrado devolveria "124 órfãos" com a mesma cara de
 * medição, e a lista de aceitos reprovaria por excesso — mas um resolvedor que
 * dissesse "0 órfãos" passaria em tudo. O controle NEGATIVO é obrigatório.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — o detector reconhece consumo");

  ok("há módulos para varrer", libs.length > 100, libs.length + " módulos em `src/lib/`");
  ok("há arquivos consumidores", arquivos.length > 300, arquivos.length + " arquivos varridos (src + scripts)");

  /* Controle negativo: três módulos que sabidamente TÊM consumidor. Se o
     resolvedor quebrar, eles aparecem como órfãos e a asserção cai. */
  for (const vivo of ["src/lib/timezone.ts", "src/lib/crypto/secrets.ts", "src/lib/ads/status.ts"]) {
    const quem = temImportador(vivo);
    ok("CONTROLE NEGATIVO: `" + vivo.replace("src/lib/", "") + "` é reconhecido como vivo", quem !== null, "importado por " + quem);
  }

  /* E o outro lado: o alias e o caminho relativo são as duas formas usadas
     nesta base, e o detector precisa entender as duas. */
  ok(
    "o detector entende import por caminho RELATIVO",
    temImportador("src/lib/areas/precedencia.ts") !== null,
    "`escopoConfig.ts` reexporta por `./precedencia`",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · A VARREDURA — nos DOIS sentidos
 * ═════════════════════════════════════════════════════════════════════ */
const orfaos = libs.filter((f) => temImportador(f) === null);
{
  console.log("\n1 · a varredura");

  console.log("   denominador: " + libs.length + " módulos · " + orfaos.length + " sem importador");
  for (const f of orfaos) console.log("     - " + f);

  const novos = orfaos.filter((f) => !(f in ACEITOS));
  ok(
    "nenhum órfão NOVO",
    novos.length === 0,
    novos.length
      ? "ÓRFÃO NOVO: " + novos.join(", ") + " — alguém deletou o último consumidor. Leia o que o módulo FAZIA antes de apagá-lo."
      : orfaos.length + " de " + libs.length + ", todos registrados",
  );

  const revividos = Object.keys(ACEITOS).filter((f) => !orfaos.includes(f));
  ok(
    "nenhum órfão registrado ganhou consumidor",
    revividos.length === 0,
    revividos.length
      ? "REVIVIDO: " + revividos.map((f) => f + " -> " + ACEITOS[f]).join(" | ")
      : "as " + Object.keys(ACEITOS).length + " entradas continuam descrevendo o estado real",
  );

  /* E todo aceito existe: uma entrada apontando para arquivo apagado é lista à
     mão envelhecendo, que é o que esta varredura existe para não virar. */
  const fantasmas = Object.keys(ACEITOS).filter((f) => !libs.includes(f));
  ok(
    "toda entrada do registro aponta para um arquivo que existe",
    fantasmas.length === 0,
    fantasmas.join(", ") || "3 de 3",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · `funnel.ts` — o que a fila pediu, e por que ele fica SEM teste
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · funnel.ts — o órfão que a fila pediu para testar");

  const fonte = semCom(readFileSync("src/lib/funnel.ts", "utf8"));
  ok("linha de base: o módulo tem código, não é uma lápide", /export function calcularFunil/.test(fonte));

  /* O vocabulário inteiro dele é morto — não é só a função de entrada. */
  const simbolos = ["calcularFunil", "EtapaCalculada", "ResumoFunil", "taxaVsAnterior", "perdaValor"];
  const vivos = simbolos.filter((s) =>
    [...fontes].some(([g, src]) => g !== "src/lib/funnel.ts" && new RegExp("\\b" + s + "\\b").test(src)),
  );
  ok(
    "os " + simbolos.length + " símbolos do módulo têm ZERO ocorrências fora dele",
    vivos.length === 0,
    vivos.join(", ") || "é o vocabulário inteiro, não só a função de entrada",
  );

  /* E o funil VIVO existe e é outro — a asserção que impede alguém de ler isto
     como "o funil está sem cobertura". */
  ok(
    "o funil vivo (`lib/funil/fita.ts`) TEM consumidor",
    temImportador("src/lib/funil/fita.ts") !== null,
    "importado por " + temImportador("src/lib/funil/fita.ts"),
  );

  /* ⚠️ A armadilha registrada: a regra de percentual dos dois NÃO é a mesma.
     Reviver `calcularFunil` por parecer útil trocaria a conta em silêncio. */
  ok(
    "linha de base: o módulo morto documenta a regra 'vs. maior etapa'",
    /maior etapa/i.test(readFileSync("src/lib/funnel.ts", "utf8")),
    "revivê-lo não é neutro: é adotar um denominador diferente do funil de hoje",
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · ✅ `faltamTaxas` — A PROTEÇÃO SAIU E VOLTOU. O QUE FICA É A CICATRIZ.
 *
 * `precedencia.ts` (30/07/2026) diz, no cabeçalho do `despesaVale`:
 *
 *   > 🔴 O risco que a decisão anterior evitava continua real: uma área sem
 *   > taxa de gateway ou sem imposto cadastrado calcula lucro SEM ELES —
 *   > número maior que a realidade, e plausível. A mitigação é a TELA avisar
 *   > (`faltamTaxas`), transformando erro silencioso em erro visível.
 *   > **Se o aviso sair, o risco volta inteiro.**
 *
 * ⛔ **Ele saiu, e ficou fora por dois dias e meio.** `faltamTaxas` nasceu em
 * `8b9b162` (30/07), no MESMO commit que o `despesaVale`, e perdeu o último
 * consumidor em `9608704` (12/08) — a reescrita de Taxas, que deletou a
 * `FeesView`. **Religado em 14/08** no construtor de alertas do Dashboard.
 *
 * ### ⚠️ E ELE ESCAPOU DA GUARDA QUE A PRÓPRIA SESSÃO DE 12/08 CRIOU
 *
 * Aquela sessão achou a família *"a tela nova apresenta estado que ela não
 * consegue criar"* e a fechou com a *conferência de escrita*. Mas aquela
 * guarda cruza os campos que o servidor **PERSISTE** com os que a tela envia —
 * e `faltamTaxas` não escreve nada: ele DERIVA um aviso. A guarda não tinha
 * como pegá-lo, e não é falha dela.
 *
 * > ## A conferência de escrita cobre o que a tela GRAVA. Nada cobria o que a tela AVISA.
 *
 * ### ⛔ POR QUE ESTA SEÇÃO NÃO FOI APAGADA JUNTO COM A ENTRADA
 *
 * A entrada em `ACEITOS` saiu — o módulo tem consumidor e a varredura o
 * trataria como órfão revivido, que é o aviso funcionando. Mas o **caminho de
 * volta** não é o mesmo do de ida: quem for reescrever a tela de Taxas de novo
 * precisa saber que essa função já sumiu uma vez, por deleção de tela, sem
 * nada acusar. Apagar a seção deixaria só o estado bom e perderia a razão de
 * ele estar sob guarda.
 *
 * ⚠️ Hoje quem segura é `test:alertas` §6b/§6c: o par dispara/não-dispara e a
 * asserção de que a tela **passa o campo e filtra `active`**. As de baixo
 * cobrem o outro lado — que a função continua fazendo o que se espera dela.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · ✅ faltamTaxas — religado, e a cicatriz fica registrada");

  const prec = readFileSync("src/lib/areas/precedencia.ts", "utf8").replace(/\r\n/g, "\n");
  const taxas = readFileSync("src/lib/areas/taxas.ts", "utf8").replace(/\r\n/g, "\n");

  ok(
    "linha de base: `precedencia.ts` documenta a mitigação por NOME",
    /`faltamTaxas`/.test(prec),
    "e diz: 'Se o aviso sair, o risco volta inteiro'",
  );
  /* ⚠️ A âncora era `risco que a decisão anterior evitava continua real`, e
     QUEBROU quando o `precedencia.ts` foi reescrito na mesma sessão (o
     alinhamento do `despesaVale`). Ela citava uma redação, não um fato — e
     redação de outro arquivo muda por motivos que este teste não controla.

     ⛔ E o modo de falha vale registrar: rodei o teste de cada item e não os
     CRUZADOS. Só o `npm test` completo pegou. Guarda que lê arquivo alheio
     precisa da suíte inteira depois de tocar aquele arquivo. */
  ok(
    "linha de base: e declara o risco em vermelho",
    /continua real/i.test(prec) && /maior que a realidade/i.test(prec),
    "o `precedencia.ts` descreve o lucro inflado por falta de taxa",
  );
  ok("linha de base: a função existe e é exportada", /export function faltamTaxas/.test(taxas));

  /* A função funciona — o problema não é ela. */
  const { faltamTaxas } = await import("@/lib/areas/taxas");
  ok("ela denuncia as 4 ausências numa área vazia", faltamTaxas([]).length === 4, faltamTaxas([]).join(", "));
  ok("e cala quando os 4 estão cadastrados", faltamTaxas(["TAXA_GATEWAY", "COPRODUCAO", "IMPOSTO", "CUSTO_PRODUTO"]).length === 0);
  ok(
    "o imposto ausente é nomeado",
    faltamTaxas(["TAXA_GATEWAY", "COPRODUCAO", "CUSTO_PRODUTO"]).join() === "imposto",
    "é exatamente o caso que faz o lucro sair maior que a realidade",
  );

  /* ✅ E AGORA ELA TEM CONSUMIDOR — a asserção inverteu de lado.
     Ela era `consumidor === null` com a saída escrita ("se reprovar porque a
     tela voltou a avisar, apague a entrada"). Foi exatamente o que aconteceu:
     a guarda reprovou nomeando o módulo, e a entrada saiu. Registrado assim,
     e não reescrito em silêncio, porque o que valida a varredura é ela ter
     mudado de veredito por uma mudança real. */
  const consumidor = temImportador("src/lib/areas/taxas.ts");
  ok(
    "✅ `faltamTaxas` voltou a ter consumidor de produção",
    consumidor !== null,
    "importado por " + consumidor,
  );
  ok(
    "e o consumidor é o construtor de alertas do Dashboard",
    consumidor === "src/lib/dashboard/alertas.ts",
    consumidor + " — é ele que decide se o aviso aparece",
  );

  /* ⚠️ O AVISO MUDOU DE CASA, e isso é decisão, não acidente.
     Ele voltou no DASHBOARD, não na tela de Taxas. É onde o número mentiroso
     é lido: quem abre Taxas já está indo cadastrar; quem abre o Dashboard está
     lendo um Lucro inflado sem saber. A tela de Taxas segue sem mencioná-lo, e
     a asserção registra isso para não parecer esquecimento. */
  const telaTaxas = globSync("src/components/dashboard/views/taxas/*.tsx")
    .map((f) => f.replace(/\\/g, "/"))
    .map((f) => semCom(readFileSync(f, "utf8")))
    .join("\n");
  ok("linha de base: a tela de Taxas foi lida", telaTaxas.length > 5000, telaTaxas.length + " bytes de código");
  ok(
    "a tela de Taxas NÃO é quem avisa — o Dashboard é",
    !/faltamTaxas/.test(telaTaxas),
    "o aviso vale onde o número inflado é LIDO, não onde ele é configurado",
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * 4 · 🔴 ESTA VARREDURA É POR MÓDULO, E ELA NÃO VÊ O EXPORT ÓRFÃO DENTRO DE
 *     UM MÓDULO VIVO
 *
 * Achado em 14/08/2026: `calcularFita`, em `lib/funil/fita.ts`, não tem
 * consumidor nenhum — nem em `src/`, nem em `scripts/`. Mas o MÓDULO tem
 * (`calcularFluxo` e `segmentosDaFita` são importados pelo `FitaFunil`), então
 * a §1 nunca o alcança.
 *
 * > ## Módulo vivo com export morto é o mesmo defeito do módulo morto — só que invisível para uma varredura que conta arquivos.
 *
 * ### ⛔ E A VARREDURA POR EXPORT **NÃO** VIRA GUARDA — medido antes de tentar
 *
 * Rodada em 14/08: **74 exports** de `src/lib/` sem consumidor fora do próprio
 * arquivo. E a lista mistura três coisas que só a leitura separa:
 *
 * | | exemplo |
 * |---|---|
 * | morto de verdade | `calcularFita`, `calcularFunil` |
 * | **exportado SÓ para o teste** | `evaluateRule`, `metricValue`, `conditionsMet`, `planejarAcao` |
 * | exportado e usado só internamente | `fatorDeRateio`, `paisEhMelhor` |
 *
 * ⛔ A segunda categoria é **deliberada nesta base**: o `07` registra que o
 * motor de regras recebeu *"três `export`, e nada mais"* justamente para ficar
 * alcançável por teste. Uma guarda que acusasse os 74 reprovaria o que foi
 * decidido de propósito — e lista inflada é lista desacreditada, que é a regra
 * do CRITÉRIO LARGO DEMAIS.
 *
 * ✅ Por isso o `calcularFita` entra como asserção NOMEADA, e não como
 * varredura. O custo de uma lista à mão aqui é conhecido; o de uma lista com
 * 74 falsos positivos é maior.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · 🔴 o export órfão dentro de um módulo vivo");

  const semCom = (s) =>
    s.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

  /* ⚠️ Os `teste-*.mjs` ficam FORA do conjunto de consumidores — é a regra que
     esta base já escreve: não é "alguém importa?", é "alguém ALÉM DO TESTE
     importa?". Um símbolo cujo único chamador é a fixture está morto com
     atestado de saúde. */
  const { globSync } = await import("node:fs");
  const consumidores = [...globSync("src/**/*.{ts,tsx}"), ...globSync("scripts/**/*.mjs")]
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.includes("generated") && !/^scripts\/teste-/.test(f) && f !== "src/lib/funil/fita.ts");

  const citam = consumidores.filter((f) => /\bcalcularFita\b/.test(semCom(readFileSync(f, "utf8"))));

  ok(
    "linha de base: o MÓDULO `funil/fita.ts` está vivo",
    temImportador("src/lib/funil/fita.ts") !== null,
    "importado por " + temImportador("src/lib/funil/fita.ts") + " — por isso a §1 não o vê",
  );
  ok(
    "linha de base: e ele exporta `calcularFita`",
    /export function calcularFita/.test(readFileSync("src/lib/funil/fita.ts", "utf8")),
  );
  ok(
    "🔴 `calcularFita` não tem consumidor de produção",
    citam.length === 0,
    citam.join(" · ") || "0 de " + consumidores.length + " arquivos examinados",
  );

  /* E os irmãos dele TÊM — é o que prova que o módulo não está inteiro morto,
     e que o alvo da medição é o export, não o arquivo. */
  for (const vivo of ["calcularFluxo", "segmentosDaFita"]) {
    const quem = consumidores.filter((f) => new RegExp("\\b" + vivo + "\\b").test(semCom(readFileSync(f, "utf8"))));
    ok(
      "…enquanto `" + vivo + "` tem " + quem.length,
      quem.length > 0,
      quem[0] ?? "",
    );
  }

  console.log(
    "\n   \x1b[33m⚠️  REGISTRADO, NÃO DELETADO. `calcularFita` é a geometria da\n" +
      "      fita, e a regra desta base é perguntar o que o órfão FAZIA antes de\n" +
      "      apagá-lo — só a leitura responde, e apagar 40 linhas de geometria no\n" +
      "      meio de um commit de cobertura mistura dois motivos de revisão.\x1b[0m",
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * 5 · A VARREDURA POR SÍMBOLO — ela RODA barato, e NÃO vira allowlist
 *
 * A §4 registrava que a varredura por export não era viável. Tentada de novo
 * em 15/08/2026, com um corte a mais: separar "morto" de "exportado SÓ para o
 * teste", que era o ruído que a inviabilizava.
 *
 * **Medido: 74 exports sem consumidor de produção → 41 citados por algum
 * `teste-*.mjs`, 33 não.** O corte funciona como REDUÇÃO.
 *
 * ### ⛔ MAS O DISCRIMINADOR CONFLACIONA DUAS COISAS, e a prova é este arquivo
 *
 * "Citado por um teste" significa duas coisas diferentes:
 *
 * | | exemplo |
 * |---|---|
 * | exportado **para** o teste alcançar | `evaluateRule` — o `07` registra "três `export`, e nada mais" |
 * | **morto**, e um teste documenta a morte | `calcularFita` — citado 8× pela §4, aqui em cima |
 *
 * ⛔ `calcularFita` é morto, e o corte o joga no balde dos vivos — **porque a
 * asserção que prova que ele é morto conta como citação**. Escrever o registro
 * muda o resultado da medição.
 *
 * > ## Uma guarda cujo critério é alterado pelo ato de registrar o achado não pode ser allowlist: a lista se auto-invalida no commit seguinte.
 *
 * ### ✅ O QUE ELA VIRA, ENTÃO: INVENTÁRIO PUBLICADO COM TETO
 *
 * Ela imprime os dois baldes a cada execução — o denominador fica na tela — e
 * reprova se o total CRESCER. Um símbolo que perde o último consumidor sobe a
 * contagem e aparece na lista impressa, que é o que se queria; e nenhuma lista
 * à mão precisa ser mantida, que é o que a inviabilizava.
 *
 * ⚠️ **O limite está escrito:** um empate (apagar um morto e criar outro) passa
 * pelo teto. A lista impressa é o que resolve isso, e ela depende de alguém
 * ler — como a evidência de agrupamento do `test:catalogo-f0b`.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · o inventário de exports sem consumidor");

  /**
   * ⛔ `teste-diagnosticos-orfaos.mjs` FICA DE FORA, e a razão é a mesma que já
   * tirou os testes do conjunto de CONSUMIDORES, um nível acima.
   *
   * > ## Um arquivo cuja função é NOMEAR órfãos cita todos eles — e citar aqui move o símbolo de `mortos` para `paraTeste`, ou seja, faz a triagem parecer cobertura.
   *
   * Aconteceu de verdade em 17/08/2026: aquele arquivo nasceu, os 12 exports de
   * `actions/diagnostics.ts` migraram de balde, o total continuou 74 — o teto
   * passou — e o aglomerado caiu de **12 para 0**. Só a asserção do aglomerado
   * denunciou; sozinho, o teto teria deixado passar.
   *
   * ⚠️ E os dois baldes afirmam coisas diferentes: `paraTeste` quer dizer *"há
   * asserção exercitando isto"*, e para os 12 não há nenhuma — o próprio
   * `test:diagnosticos-orfaos` mede e afirma que não há.
   */
  const testes = globSync("scripts/teste-*.mjs")
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => !f.endsWith("teste-diagnosticos-orfaos.mjs"));
  const txtTestes = testes.map((f) => readFileSync(f, "utf8")).join("\n");

  const mortos = [];
  const paraTeste = [];
  for (const f of libs) {
    for (const m of fontes.get(f).matchAll(/export (?:async )?function (\w+)/g)) {
      const nome = m[1];
      let usado = false;
      for (const [g, s] of fontes) {
        if (g === f) continue;
        if (new RegExp("\\b" + nome + "\\b").test(s)) { usado = true; break; }
      }
      if (usado) continue;
      (new RegExp("\\b" + nome + "\\b").test(txtTestes) ? paraTeste : mortos).push(
        f.replace("src/lib/", "") + " :: " + nome,
      );
    }
  }

  /** Medido em 15/08/2026. Teto, não alvo: ele existe para acusar CRESCIMENTO. */
  const TETO = 74;

  console.log("   denominador: " + (mortos.length + paraTeste.length) + " exports sem consumidor de produção");
  console.log("     · " + paraTeste.length + " citados por algum teste (inclui os exportados PARA o teste)");
  console.log("     · " + mortos.length + " sem citação nenhuma:");
  for (const x of mortos) console.log("       - " + x);

  ok(
    "linha de base: a varredura achou exports dos DOIS tipos",
    mortos.length > 0 && paraTeste.length > 0,
    "senão o detector estaria devolvendo tudo num balde só",
  );
  ok(
    "linha de base: e ela reconhece consumo — a maioria dos exports NÃO entra",
    mortos.length + paraTeste.length < 200,
    "um detector quebrado listaria todos os exports de `src/lib/`",
  );

  ok(
    "o total de exports sem consumidor não CRESCEU",
    mortos.length + paraTeste.length <= TETO,
    (mortos.length + paraTeste.length) + " de teto " + TETO +
      " — se subiu, alguém deletou o último consumidor de algo. A lista impressa acima nomeia.",
  );

  /* 🔴 O maior aglomerado, e ele tem causa conhecida: a tela de Testes foi
     DELETADA e levou os consumidores das server actions de diagnóstico — mas o
     módulo sobreviveu porque outros quatro exports seguem em uso. É o caso que
     a varredura por ARQUIVO (§1) não tem como ver. */
  {
    const doDiagnostico = mortos.filter((x) => x.startsWith("actions/diagnostics.ts"));
    ok(
      "🔴 o maior aglomerado é `actions/diagnostics.ts`",
      doDiagnostico.length >= 8,
      doDiagnostico.length + " exports — a tela de Testes foi deletada e levou os consumidores",
    );
    ok(
      "…e o MÓDULO continua vivo, por isso a §1 não o vê",
      temImportador("src/lib/actions/diagnostics.ts") !== null,
      "importado por " + temImportador("src/lib/actions/diagnostics.ts"),
    );
    ok(
      "linha de base: a rota de Testes de fato não existe mais",
      globSync("src/app/dashboard/(app)/integracoes/testes/**").length === 0,
      "sem isto, o aglomerado poderia ser defeito do detector",
    );
  }
}

console.log(
  "\n\x1b[32m  ✅ `faltamTaxas` FOI RELIGADO em 14/08/2026 — no construtor de alertas" +
    "\n      do Dashboard, não na tela de Taxas: o aviso vale onde o número inflado" +
    "\n      é LIDO, não onde ele é configurado." +
    "\n" +
    "\n      Ele ficou 2 dias e meio sem consumidor, entre a reescrita de Taxas" +
    "\n      (`9608704`, 12/08) e agora. Quem segura hoje é `test:alertas` §6b/§6c —" +
    "\n      o par dispara/não-dispara e a asserção de que a TELA passa o campo." +
    "\n" +
    "\x1b[33m      ⚠️  A §3 fica mesmo com o defeito resolvido: quem reescrever Taxas de" +
    "\n      novo precisa saber que esta função já sumiu uma vez, por deleção de" +
    "\n      tela, sem nada acusar.\x1b[0m",
);
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
