/**
 * Regenera `scripts/fixtures/parsers-esperado.json` — o snapshot que congela o
 * comportamento dos parsers contra payloads REAIS de produção.
 *
 * ## ⛔ ISTO NÃO É PARA "FAZER O TESTE PASSAR"
 *
 * O snapshot existe para recusar mudança acidental de comportamento. Rodar este
 * script depois de uma falha do `npm run test:gateways` **apaga a evidência da
 * regressão** e faz o teste concordar com o bug.
 *
 * Só regenere quando a mudança for DELIBERADA — e aí leia o diff do arquivo
 * linha a linha, porque é ele que diz quais vendas passariam a ser lidas
 * diferente. Por isso exige `--aceitar` escrito no comando, a cada execução:
 * não existe atalho curto, pela mesma razão do `ALLOW_PROD_WRITES`.
 *
 * ## Histórico
 *
 * A versão original (30/07/2026) importava `webhook/parseKirvano.ts` e
 * `webhook/normalizeSale.ts` — o código de ANTES da camada de gateways — e foi
 * assim que o snapshot nasceu. Aqueles arquivos não existem mais; hoje ele lê o
 * registro. É a diferença entre "congelar o comportamento antigo" (feito uma
 * vez, e é o que dá valor ao teste) e "aceitar o comportamento atual".
 *
 * A fonte é o backup mais recente de PRODUÇÃO — somente leitura de arquivo
 * local, sem conexão com banco nenhum.
 *
 * Uso: node --experimental-strip-types --import ./scripts/alias-loader.mjs \
 *        scripts/snapshot-parsers.mjs --aceitar
 */
import fs from "node:fs";
import path from "node:path";

import { escolherBackupDeProducao, lerBackup } from "./lib/backup.mjs";
import { REGISTRO } from "../src/lib/gateways/registro.ts";

if (!process.argv.includes("--aceitar")) {
  console.error(
    "\n\x1b[41m\x1b[30m  PARE  \x1b[0m Este script SOBRESCREVE o snapshot de comportamento.\n\n" +
      "  Se o `npm run test:gateways` falhou, a resposta quase nunca é regenerar:\n" +
      "  o teste está apontando uma mudança de leitura em vendas reais.\n\n" +
      "  Se a mudança é deliberada, rode de novo com \x1b[1m--aceitar\x1b[0m e leia o diff.\n",
  );
  process.exit(1);
}

const arquivo = escolherBackupDeProducao();
console.log(`Backup: ${path.basename(arquivo)}`);

const linhas = lerBackup(arquivo);
const logs = linhas.filter((x) => x.t === "WebhookLog").map((x) => x.r);
const vendas = linhas.filter((x) => x.t === "Sale").map((x) => x.r);

const PARSER = {
  kirvano: REGISTRO.KIRVANO.parse,
  generico: REGISTRO.CUSTOM.parse,
};

/** Um caso = um payload real + o parser que as rotas aplicariam nele. */
const casos = [];

for (const log of logs) {
  const p = log.payloadRaw;
  if (!p || typeof p !== "object" || Array.isArray(p)) continue;
  // O `gateway` do log é o que decide o parser: KIRVANO → kirvano; o resto
  // (API/CUSTOM) → genérico.
  casos.push({ origem: `WebhookLog:${log.id}`, parser: log.gateway === "KIRVANO" ? "kirvano" : "generico", payload: p });
}

for (const venda of vendas) {
  const p = venda.rawPayload;
  if (!p || typeof p !== "object" || Array.isArray(p)) continue;
  // A venda não guarda de qual gateway veio. Rodamos os DOIS parsers: o payload
  // é real de qualquer forma, e cobrir os dois caminhos aumenta a superfície.
  casos.push({ origem: `Sale:${venda.id}:kirvano`, parser: "kirvano", payload: p });
  casos.push({ origem: `Sale:${venda.id}:generico`, parser: "generico", payload: p });
}

/** O snapshot guarda o formato ANTIGO — é o contrato que não pode mudar. */
function comoFormatoAntigo(v) {
  return {
    externalId: v.externalId,
    value: v.valor,
    currency: v.moeda,
    product: v.produto,
    productId: v.produtoId,
    status: v.status,
    paymentMethod: v.formaDePagamento,
    buyerEmail: v.email,
    buyerName: v.nome,
    buyerPhone: v.telefone,
    country: v.pais,
    clickId: v.clickId,
    ip: v.ipDoComprador,
  };
}

const esperado = casos.map((c) => {
  const r = PARSER[c.parser](c.payload);
  return {
    origem: c.origem,
    parser: c.parser,
    payload: c.payload,
    saida: r.vendas.length === 1 ? comoFormatoAntigo(r.vendas[0]) : null,
  };
});

const destino = path.join(import.meta.dirname, "fixtures", "parsers-esperado.json");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(esperado, null, 1) + "\n", "utf8");

const porParser = esperado.reduce((a, c) => ((a[c.parser] = (a[c.parser] ?? 0) + 1), a), {});
console.log(`\n${esperado.length} casos gravados:`, porParser);
console.log(`→ ${path.relative(process.cwd(), destino)}`);
console.log(`\n\x1b[33m⚠ Leia o diff antes de commitar.\x1b[0m\n`);
