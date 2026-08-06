/**
 * Asserções do heatmap dia-da-semana × hora. Sem banco, sem rede.
 *
 * 🔴 O QUE ESTE ARQUIVO PROVA, e é uma coisa só:
 *
 * **Célula VAZIA (nunca observada) é distinguível de célula ZERO (observada,
 * sem venda).** Todo o resto do bloco é desenho; esta é a afirmação que, se
 * quebrar, faz o gráfico mentir sobre o público — dizendo "ninguém compra às
 * quartas" quando o recorte não tinha nenhuma quarta.
 *
 * ⚠️ E prova o FUSO: o dia da semana sai da chave já convertida, não de um
 * `getDay()` sobre o instante. Uma venda de sábado 21h em Brasília é sábado.
 */
import { weekdayDaChave, dayKeyRange, dayKeyInTz, hourInTz } from "@/lib/timezone";

let ok = 0;
let falhas = 0;
function eq(nome, obtido, esperado) {
  if (JSON.stringify(obtido) === JSON.stringify(esperado)) {
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome} — ${JSON.stringify(obtido)}`);
  } else {
    falhas++;
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`);
  }
}

const TZ = "America/Sao_Paulo";

/** A MESMA cobertura que `metrics.ts` monta — cópia literal do laço. */
function cobertura(startKey, endKey) {
  const c = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const k of dayKeyRange(startKey, endKey)) {
    const wd = weekdayDaChave(k);
    for (let h = 0; h < 24; h++) c[wd][h] += 1;
  }
  return c;
}

console.log("\n\x1b[1mDia da semana sai da CHAVE, não do instante\x1b[0m");
{
  // 2026-08-06 é uma quinta-feira.
  eq("2026-08-06 é quinta (4)", weekdayDaChave("2026-08-06"), 4);
  eq("2026-08-09 é domingo (0)", weekdayDaChave("2026-08-09"), 0);

  /* 🔴 O CASO DO FUSO, e é o que um `getDay()` erraria: sábado 21h em Brasília
     é domingo 00h em UTC. A venda tem de contar como SÁBADO — é quando o
     comprador comprou. */
  const sabado21hBrasilia = new Date("2026-08-08T21:30:00-03:00");
  eq("sábado 21h30 em Brasília continua SÁBADO (6)", weekdayDaChave(dayKeyInTz(sabado21hBrasilia, TZ)), 6);
  eq("  …e a hora é 21, não 00", hourInTz(sabado21hBrasilia, TZ), 21);
  /* O controle pelo lado negativo: o caminho ERRADO daria domingo. Se um dia
     alguém trocar por `getDay()`, esta linha mostra o que aconteceria. */
  eq("  …enquanto o UTC diria domingo (0) — o erro que evitamos", sabado21hBrasilia.getUTCDay(), 0);
}

console.log("\n\x1b[1mCélula VAZIA ≠ célula ZERO\x1b[0m");
{
  /* Janela de 3 dias: quinta, sexta e sábado de 2026. Os outros QUATRO dias da
     semana não foram observados — 96 células que não podem ser pintadas. */
  const c = cobertura("2026-08-06", "2026-08-08");
  eq("quinta observada 1 vez", c[4][10], 1);
  eq("sexta observada 1 vez", c[5][10], 1);
  eq("sábado observado 1 vez", c[6][10], 1);
  eq("🔴 quarta NUNCA observada", c[3][10], 0);
  eq("🔴 domingo NUNCA observado", c[0][10], 0);

  const vazias = c.flat().filter((n) => n === 0).length;
  eq("  …são 96 células sem observação (4 dias × 24h)", vazias, 96);
  // Prova que houve o que examinar — contagem `=== 0` passa com coleção vazia.
  eq("  …e 72 observadas (senão a contagem acima é vácuo)", c.flat().filter((n) => n > 0).length, 72);
}

console.log("\n\x1b[1mQuantas semanas cabem numa célula\x1b[0m");
{
  // 7 dias: cada dia da semana aparece EXATAMENTE uma vez. Retrato, não padrão.
  const semana = cobertura("2026-08-03", "2026-08-09");
  eq("janela de 7 dias -> 1 observação por célula", Math.max(...semana.flat()), 1);
  eq("  …e nenhuma célula fica vazia", semana.flat().filter((n) => n === 0).length, 0);

  // 30 dias: 4 ou 5 ocorrências de cada dia da semana.
  const mes = cobertura("2026-07-08", "2026-08-06");
  const max = Math.max(...mes.flat());
  const min = Math.min(...mes.flat());
  eq("janela de 30 dias -> entre 4 e 5 observações", [min, max], [4, 5]);
  /* ⚠️ É JUSTAMENTE ESSA DESIGUALDADE que obriga a média: com SOMA, o dia da
     semana que aparece 5 vezes pareceria 25% mais forte que o que aparece 4 —
     artefato do recorte, não comportamento do público. */
  eq("  …e a desigualdade 4≠5 é o motivo de a célula mostrar MÉDIA", max !== min, true);
}

console.log("\n\x1b[1mEscala de raiz quadrada\x1b[0m");
{
  /* Raiz comprime o pico SEM tratar zero como caso especial — que é o motivo de
     não ser log. A intensidade de zero tem de ser zero, e a do máximo, 1. */
  const inten = (media, max) => (max > 0 ? Math.sqrt(media / max) : 0);
  eq("zero -> intensidade 0 (e zero é valor legítimo, não vazio)", inten(0, 100), 0);
  eq("máximo -> intensidade 1", inten(100, 100), 1);
  /* O ponto da raiz: 1% do máximo vira 10% de tom em vez de 1%. Na linear a
     célula sumiria — foi o que achatou o globo. */
  eq("1% do máximo fica visível (10% de tom, não 1%)", Math.round(inten(1, 100) * 100), 10);
  eq("  …e na linear sumiria (1% de tom)", Math.round((1 / 100) * 100), 1);
}

console.log(
  falhas === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${ok} passaram, ${falhas} FALHARAM.\x1b[0m\n`,
);
process.exit(falhas === 0 ? 0 : 1);
