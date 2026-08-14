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
 * | `areas/taxas.ts` | 🔴 **proteção que perdeu o consumidor** — ver a §3 |
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
  "src/lib/areas/taxas.ts":
    "🔴 PROTEÇÃO QUE PERDEU O CONSUMIDOR — ver a §3. Se ganhar consumidor, o aviso voltou: apague esta entrada.",
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
 * 3 · 🔴 `faltamTaxas` — A PROTEÇÃO SAIU, E O RISCO ESTÁ DOCUMENTADO EM VERMELHO
 *
 * `precedencia.ts` (30/07/2026) diz, no cabeçalho do `despesaVale`:
 *
 *   > 🔴 O risco que a decisão anterior evitava continua real: uma área sem
 *   > taxa de gateway ou sem imposto cadastrado calcula lucro SEM ELES —
 *   > número maior que a realidade, e plausível. A mitigação é a TELA avisar
 *   > (`faltamTaxas`), transformando erro silencioso em erro visível.
 *   > **Se o aviso sair, o risco volta inteiro.**
 *
 * ⛔ **O aviso saiu.** `faltamTaxas` nasceu em `8b9b162` (30/07), no MESMO
 * commit que o `despesaVale`, e perdeu o último consumidor em `9608704`
 * (12/08) — a reescrita da tela de Taxas, que deletou a `FeesView`.
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
 * ⛔ **NÃO RELIGADO, e o motivo é o mesmo do alerta de dono corrompido (§13 do
 * `07`):** um aviso que eu não vejo disparar é o "controle inerte" que esta
 * base persegue, e a tela não é mensurável nesta máquina — o instrumento de
 * janela está registrado como INDISPONÍVEL em 14/08/2026.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · 🔴 faltamTaxas — a proteção que perdeu o consumidor");

  const prec = readFileSync("src/lib/areas/precedencia.ts", "utf8").replace(/\r\n/g, "\n");
  const taxas = readFileSync("src/lib/areas/taxas.ts", "utf8").replace(/\r\n/g, "\n");

  ok(
    "linha de base: `precedencia.ts` documenta a mitigação por NOME",
    /`faltamTaxas`/.test(prec),
    "e diz: 'Se o aviso sair, o risco volta inteiro'",
  );
  ok("linha de base: e declara o risco em vermelho", /risco que a decisão anterior evitava continua real/.test(prec));
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

  /* 🔴 E ninguém a chama. */
  const consumidor = temImportador("src/lib/areas/taxas.ts");
  ok(
    "🔴 `faltamTaxas` NÃO tem consumidor — a mitigação está desligada",
    consumidor === null,
    "SE ESTA REPROVAR porque a tela voltou a avisar, apague esta seção e a entrada em ACEITOS: o risco foi remitigado",
  );

  /* E a tela de Taxas, que é onde ele viveu, não avisa mais nada disso. */
  const telaTaxas = globSync("src/components/dashboard/views/taxas/*.tsx")
    .map((f) => f.replace(/\\/g, "/"))
    .map((f) => semCom(readFileSync(f, "utf8")))
    .join("\n");
  ok("linha de base: a tela de Taxas foi lida", telaTaxas.length > 5000, telaTaxas.length + " bytes de código");
  ok(
    "e ela não menciona `faltamTaxas`",
    !/faltamTaxas/.test(telaTaxas),
    "a reescrita de 12/08 deletou a `FeesView`, que era o único consumidor",
  );
}

console.log(
  "\n\x1b[33m  ⚠️  ACHADO REGISTRADO, NÃO CORRIGIDO: `faltamTaxas` perdeu o último" +
    "\n      consumidor na reescrita de Taxas (`9608704`, 12/08). O `precedencia.ts`" +
    "\n      documenta essa função como A mitigação de um risco que ele mesmo pinta" +
    "\n      de vermelho — área sem imposto calcula lucro maior que a realidade, com" +
    "\n      número plausível e nada denunciando." +
    "\n      Religar é escrever aviso de tela, e a tela não é mensurável nesta" +
    "\n      máquina: um aviso que ninguém vê disparar é controle inerte.\x1b[0m",
);
console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
