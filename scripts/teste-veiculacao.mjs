/**
 * Asserções de `lib/ads/veiculacao.ts` — status CONFIGURADO × VEICULAÇÃO.
 *
 * ⚠️ O que este teste protege não é a tradução dos rótulos (isso é texto), são
 * as **três decisões** que produzem número/alarme errado na tela:
 *
 * 1. `divergente` — configurado ativo e não entregando. É o alarme âmbar. Um
 *    falso positivo manda o usuário caçar problema que não existe; um falso
 *    negativo esconde a campanha parada que ele está procurando.
 * 2. **Nulo NÃO é "parado".** Antes do primeiro sync com o código novo, TODA
 *    linha tem `effectiveStatus` nulo. Se nulo virasse alarme, o Gerenciador
 *    inteiro apareceria em âmbar no dia do deploy.
 * 3. **Status conclusivo responde sozinho.** A Meta não devolve objetos
 *    `DELETED` em nenhuma aresta de listagem — sem este ramo, "Excluído"
 *    apareceria como "—" para sempre, e a aba Arquivados não distinguiria
 *    arquivado de excluído (que foi o pedido).
 *
 * Puro: sem banco, sem rede.
 */
import { contarDivergentes, veiculacao } from "@/lib/ads/veiculacao";

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

console.log("\n\x1b[1mENTREGANDO — configurado e efetivo concordam\x1b[0m");
eq("ACTIVE + ACTIVE não é divergente", veiculacao("ACTIVE", "ACTIVE").divergente, false);
eq("ACTIVE + ACTIVE tem tom ok", veiculacao("ACTIVE", "ACTIVE").tom, "ok");
eq("PAUSED + PAUSED não é divergente", veiculacao("PAUSED", "PAUSED").divergente, false);

console.log("\n\x1b[1m🔴 DIVERGENTE — ligado e NÃO entregando (o caso que a coluna existe para mostrar)\x1b[0m");
eq("ACTIVE + CAMPAIGN_PAUSED é divergente", veiculacao("ACTIVE", "CAMPAIGN_PAUSED").divergente, true);
eq("  …e o rótulo diz o motivo", veiculacao("ACTIVE", "CAMPAIGN_PAUSED").rotulo, "Campanha pausada");
eq("ACTIVE + ADSET_PAUSED é divergente", veiculacao("ACTIVE", "ADSET_PAUSED").divergente, true);
eq("ACTIVE + DISAPPROVED é divergente", veiculacao("ACTIVE", "DISAPPROVED").divergente, true);
eq("  …e tem tom de erro", veiculacao("ACTIVE", "DISAPPROVED").tom, "erro");
eq("ACTIVE + PENDING_REVIEW é divergente", veiculacao("ACTIVE", "PENDING_REVIEW").divergente, true);
eq("  …mas é ATENÇÃO, não erro (a Meta ainda vai liberar)", veiculacao("ACTIVE", "PENDING_REVIEW").tom, "atencao");
eq("ACTIVE + PENDING_BILLING_INFO é erro", veiculacao("ACTIVE", "PENDING_BILLING_INFO").tom, "erro");
eq("ACTIVE + IN_PROCESS é divergente", veiculacao("ACTIVE", "IN_PROCESS").divergente, true);
eq("ACTIVE + WITH_ISSUES é divergente", veiculacao("ACTIVE", "WITH_ISSUES").divergente, true);

console.log("\n\x1b[1m⚠️ PAUSADO não divergente — quem está parado por escolha não é alarme\x1b[0m");
eq("PAUSED + CAMPAIGN_PAUSED NÃO é divergente", veiculacao("PAUSED", "CAMPAIGN_PAUSED").divergente, false);
eq("PAUSED + DISAPPROVED NÃO é divergente", veiculacao("PAUSED", "DISAPPROVED").divergente, false);

console.log("\n\x1b[1m🔴 NULO é 'não informado', NUNCA 'parado'\x1b[0m");
eq("ACTIVE + null não é divergente", veiculacao("ACTIVE", null).divergente, false);
eq("  …e o rótulo é um traço", veiculacao("ACTIVE", null).rotulo, "—");
eq("  …com tom indefinido", veiculacao("ACTIVE", null).tom, "indefinido");
eq("ACTIVE + undefined idem", veiculacao("ACTIVE", undefined).rotulo, "—");
eq("ACTIVE + string vazia idem", veiculacao("ACTIVE", "").rotulo, "—");
eq("ACTIVE + só espaços idem", veiculacao("ACTIVE", "   ").rotulo, "—");
eq("UNKNOWN + null é indefinido", veiculacao("UNKNOWN", null).tom, "indefinido");

console.log("\n\x1b[1m🔴 Status CONCLUSIVO responde sozinho (a Meta nunca devolve DELETED)\x1b[0m");
eq("DELETED + null diz 'Excluído'", veiculacao("DELETED", null).rotulo, "Excluído");
eq("ARCHIVED + null diz 'Arquivado'", veiculacao("ARCHIVED", null).rotulo, "Arquivado");
eq("  …e ARQUIVADO ≠ EXCLUÍDO na aba Arquivados", veiculacao("ARCHIVED", null).rotulo !== veiculacao("DELETED", null).rotulo, true);
eq("PAUSED + null diz 'Pausado'", veiculacao("PAUSED", null).rotulo, "Pausado");
eq("nenhum deles vira alarme", [
  veiculacao("DELETED", null).divergente,
  veiculacao("ARCHIVED", null).divergente,
  veiculacao("PAUSED", null).divergente,
].some(Boolean), false);
eq("ARCHIVED + ARCHIVED também diz 'Arquivado'", veiculacao("ARCHIVED", "ARCHIVED").rotulo, "Arquivado");

console.log("\n\x1b[1mValor NOVO da Meta — aparece cru, não vira chute\x1b[0m");
{
  // A Meta acrescenta valores sem aviso. Traduzir por default seria inventar
  // diagnóstico; esconder seria perder a informação.
  const novo = veiculacao("ACTIVE", "ALGUM_ESTADO_FUTURO");
  eq("é marcado como desconhecido", novo.desconhecido, true);
  eq("o rótulo é o valor CRU", novo.rotulo, "ALGUM_ESTADO_FUTURO");
  eq("ainda assim conta como divergente (ligado e não é ACTIVE)", novo.divergente, true);
  eq("valor conhecido não é marcado como desconhecido", veiculacao("ACTIVE", "ACTIVE").desconhecido, false);
  eq("desconhecido em linha pausada não alarma", veiculacao("PAUSED", "ALGUM_ESTADO_FUTURO").divergente, false);
}

console.log("\n\x1b[1mcontarDivergentes\x1b[0m");
eq(
  "conta só as ligadas e paradas",
  contarDivergentes([
    { status: "ACTIVE", effectiveStatus: "ACTIVE" },          // entrega
    { status: "ACTIVE", effectiveStatus: "CAMPAIGN_PAUSED" }, // ← conta
    { status: "ACTIVE", effectiveStatus: "DISAPPROVED" },     // ← conta
    { status: "PAUSED", effectiveStatus: "PAUSED" },          // parada por escolha
    { status: "ACTIVE", effectiveStatus: null },              // não informado
    { status: "ARCHIVED", effectiveStatus: "ARCHIVED" },      // apagada
  ]),
  2,
);
eq("lista vazia dá zero", contarDivergentes([]), 0);
eq(
  "nada informado dá zero (o dia do deploy, antes do 1º sync)",
  contarDivergentes([
    { status: "ACTIVE", effectiveStatus: null },
    { status: "ACTIVE", effectiveStatus: null },
    { status: "ACTIVE", effectiveStatus: null },
  ]),
  0,
);

console.log("\n\x1b[1mTexto que vai para a tela\x1b[0m");
{
  const casos = ["ACTIVE", "PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED", "DISAPPROVED", "PENDING_REVIEW",
    "PREAPPROVED", "PENDING_BILLING_INFO", "IN_PROCESS", "WITH_ISSUES", "ARCHIVED", "DELETED"];
  const semRotulo = casos.filter((c) => !veiculacao("ACTIVE", c).rotulo.trim()).length;
  const semDetalhe = casos.filter((c) => !veiculacao("ACTIVE", c).detalhe.trim()).length;
  eq("todo estado conhecido tem rótulo", semRotulo, 0);
  eq("todo estado conhecido tem explicação", semDetalhe, 0);
  // Rótulo é selo de tabela: acima de ~24 caracteres ele estoura a coluna.
  const longos = casos.filter((c) => veiculacao("ACTIVE", c).rotulo.length > 24);
  eq("nenhum rótulo é longo demais para o selo", longos.length, 0);
  // O valor cru da API nunca deve vazar como rótulo de estado conhecido.
  const crus = casos.filter((c) => veiculacao("ACTIVE", c).rotulo === c);
  eq("nenhum estado conhecido mostra o valor cru da API", crus.length, 0);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
