/**
 * Asserções de `lib/facebook/telefone.ts` — E.164 antes do hash da CAPI.
 *
 * ⚠️ Estes formatos vêm da especificação brasileira, NÃO de payload real da
 * Kirvano (o banco de dev não tem nenhum gravado). Ao receber a primeira venda
 * real com telefone, acrescente o formato exato aqui.
 */
import { normalizarTelefoneE164 as e164 } from "@/lib/facebook/telefone";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (obtido === esperado) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const BR = "5511987654321";

console.log("\n\x1b[1mBrasil — sem DDI\x1b[0m");
eq("celular com DDD (11 dígitos)", e164("11987654321"), BR);
eq("fixo com DDD (10 dígitos)", e164("1132165498"), "551132165498");
eq("DDD 55 NÃO é confundido com DDI", e164("55987654321"), "5555987654321");

console.log("\n\x1b[1mBrasil — já com DDI\x1b[0m");
eq("13 dígitos começando em 55", e164("5511987654321"), BR);
eq("12 dígitos (fixo com DDI)", e164("551132165498"), "551132165498");

console.log("\n\x1b[1mPontuação e prefixos\x1b[0m");
eq("+55 com parênteses e traço", e164("+55 (11) 98765-4321"), BR);
eq("parênteses e traço, sem DDI", e164("(11) 98765-4321"), BR);
eq("espaços e pontos", e164(" 11 9 8765 . 4321 "), BR);
eq("prefixo internacional 00", e164("005511987654321"), BR);
eq("+ com espaços", e164("+ 55 11 98765 4321"), BR);

console.log("\n\x1b[1mOutros países\x1b[0m");
eq("Portugal pelo país da venda", e164("912345678", "PT"), "351912345678");
eq("Portugal já com DDI", e164("351912345678", "PT"), "351912345678");
eq("EUA pelo país da venda", e164("2025550143", "US"), "12025550143");
eq("+ vence o país informado", e164("+351912345678", "BR"), "351912345678");
eq("país minúsculo funciona", e164("912345678", "pt"), "351912345678");
eq("país desconhecido cai em Brasil", e164("11987654321", "XX"), BR);

console.log("\n\x1b[1mEntradas inválidas\x1b[0m");
eq("null", e164(null), undefined);
eq("vazio", e164("   "), undefined);
eq("só pontuação", e164("()- ."), undefined);
eq("curto demais", e164("1234"), undefined);
eq("longo demais (> 15 dígitos)", e164("1234567890123456"), undefined);
eq("texto", e164("não tem"), undefined);

console.log("\n\x1b[1mO caso que motivou a correção\x1b[0m");
{
  // ANTES: `phone.replace(/\D/g,"")` devolvia "11987654321" e o hash NUNCA casava
  // com o da Meta, que espera o número com DDI.
  const antes = "(11) 98765-4321".replace(/\D/g, "");
  eq("o comportamento antigo perdia o DDI", antes, "11987654321");
  eq("o novo entrega E.164", e164("(11) 98765-4321"), BR);
  eq("e os dois são diferentes (por isso o match falhava)", antes !== e164("(11) 98765-4321"), true);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
