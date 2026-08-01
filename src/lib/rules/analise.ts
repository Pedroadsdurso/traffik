/**
 * # Análise ESTÁTICA das condições de uma regra
 *
 * Complementa a prévia (`previewRule`), que conta quantas entidades batem
 * agora. Aqui não há dado nenhum: são só as coisas **demonstráveis pela
 * própria condição**, que valem independentemente do que exista na conta.
 *
 * > ### ⛔ NADA de heurística de "número grande demais"
 * > A versão tentadora deste arquivo diria *"`gasto ≤ 999999` provavelmente
 * > pega tudo"*. Não entra aqui, e a razão não é preciosismo: isso exige
 * > conhecer a faixa plausível de cada métrica, erra nos dois sentidos, e um
 * > aviso que às vezes mente treina o usuário a ignorar todos os avisos —
 * > inclusive os dois abaixo, que são certos.
 * >
 * > Quem responde "isso pega tudo?" é a PRÉVIA, contando. Aqui só entra o que
 * > é verdade por álgebra.
 *
 * Duas famílias, e só duas:
 *
 * 1. **Contradição** — `Gasto > 100 E Gasto < 50` não pode ser verdadeiro. A
 *    regra nunca dispararia, e isso é provável de acontecer por engano quando
 *    se acrescenta a segunda condição sobre a mesma métrica.
 * 2. **Piso das métricas** — as cinco métricas de regra (`cpa`, `roas`, `ctr`,
 *    `gasto`, `vendas`) são todas **≥ 0** por construção em `metricValue`:
 *    nenhuma pode ser negativa. Então `gasto ≥ 0` é sempre verdadeira e
 *    `gasto < 0` nunca é.
 *
 * ⚠️ **ROI não está na lista de propósito** — ele *pode* ser negativo (o piso é
 * −1). Ele também não é uma métrica de regra hoje; se um dia entrar, o piso
 * dele **não é 0** e esta análise precisa saber disso.
 */
import type { RuleCondition } from "@/lib/rules/engine";

export type GravidadeAviso = "impossivel" | "sempre" | "atencao";

export interface AvisoCondicao {
  gravidade: GravidadeAviso;
  texto: string;
}

const ROTULO: Record<RuleCondition["metrica"], string> = {
  cpa: "CPA",
  roas: "ROAS",
  ctr: "CTR",
  gasto: "Gasto",
  vendas: "Vendas",
};

/** Toda métrica de regra é ≥ 0. Ver o cabeçalho antes de mexer nisto. */
const PISO = 0;

/** A condição é verdadeira para QUALQUER valor possível da métrica? */
function sempreVerdadeira(c: RuleCondition): boolean {
  switch (c.operador) {
    // x ≥ 0 vale sempre quando o limite é ≤ o piso.
    case ">=": return c.valor <= PISO;
    // x > v vale sempre só se v for estritamente menor que o piso.
    case ">": return c.valor < PISO;
    default: return false;
  }
}

/** A condição é falsa para QUALQUER valor possível da métrica? */
function nuncaVerdadeira(c: RuleCondition): boolean {
  switch (c.operador) {
    case "<": return c.valor <= PISO;
    case "<=": return c.valor < PISO;
    case "=": return c.valor < PISO;
    default: return false;
  }
}

/** Limites que uma métrica precisa respeitar, para achar contradição. */
interface Faixa {
  min: number;
  minAberto: boolean;
  max: number;
  maxAberto: boolean;
  igual: number | null;
  conflitoIgual: boolean;
}

function novaFaixa(): Faixa {
  return {
    min: -Infinity, minAberto: false,
    max: Infinity, maxAberto: false,
    igual: null, conflitoIgual: false,
  };
}

/** A faixa ficou vazia — nenhum número a satisfaz. */
function faixaVazia(f: Faixa): boolean {
  if (f.conflitoIgual) return true;
  if (f.igual !== null) {
    if (f.igual < f.min || (f.minAberto && f.igual === f.min)) return true;
    if (f.igual > f.max || (f.maxAberto && f.igual === f.max)) return true;
    return false;
  }
  if (f.min > f.max) return true;
  // `> 50 E < 50` e `> 50 E <= 50` são vazias; `>= 50 E <= 50` não é.
  if (f.min === f.max && (f.minAberto || f.maxAberto)) return true;
  return false;
}

/**
 * Avisos sobre um conjunto de condições, todas em E.
 *
 * Devolve lista vazia quando não há nada demonstrável — que é o caso comum, e
 * é de propósito: aviso que aparece sempre vira ruído.
 */
export function analisarCondicoes(conds: RuleCondition[]): AvisoCondicao[] {
  const avisos: AvisoCondicao[] = [];

  if (!conds.length) {
    return [{
      gravidade: "impossivel",
      // O motor tem `if (!conds.length) return false` — lista vazia NÃO dispara.
      // Sem este aviso, uma regra sem condição parece armada e nunca age.
      texto: "Sem nenhuma condição, a regra nunca vai agir. Acrescente ao menos uma.",
    }];
  }

  // ── 1. Contradição, por métrica ─────────────────────────────────────────
  const faixas = new Map<string, Faixa>();
  for (const c of conds) {
    const f = faixas.get(c.metrica) ?? novaFaixa();
    switch (c.operador) {
      case ">": if (c.valor >= f.min) { f.min = c.valor; f.minAberto = true; } break;
      case ">=": if (c.valor > f.min) { f.min = c.valor; f.minAberto = false; } break;
      case "<": if (c.valor <= f.max) { f.max = c.valor; f.maxAberto = true; } break;
      case "<=": if (c.valor < f.max) { f.max = c.valor; f.maxAberto = false; } break;
      case "=":
        if (f.igual !== null && f.igual !== c.valor) f.conflitoIgual = true;
        f.igual = c.valor;
        break;
    }
    faixas.set(c.metrica, f);
  }
  for (const [metrica, f] of faixas) {
    if (faixaVazia(f)) {
      const doTipo = conds
        .filter((c) => c.metrica === metrica)
        .map((c) => `${ROTULO[metrica as RuleCondition["metrica"]] ?? metrica} ${c.operador} ${c.valor}`)
        .join(" e ");
      avisos.push({
        gravidade: "impossivel",
        texto: `${doTipo} não podem ser verdadeiras ao mesmo tempo. A regra nunca vai agir.`,
      });
    }
  }

  // ── 2. Piso das métricas ────────────────────────────────────────────────
  const nunca = conds.filter(nuncaVerdadeira);
  for (const c of nunca) {
    avisos.push({
      gravidade: "impossivel",
      texto: `${ROTULO[c.metrica]} ${c.operador} ${c.valor} nunca é verdadeira — ${ROTULO[c.metrica]} nunca fica abaixo de zero. A regra nunca vai agir.`,
    });
  }

  const sempre = conds.filter(sempreVerdadeira);
  if (sempre.length) {
    // Todas sempre verdadeiras = a regra age em TUDO que estiver no escopo. É
    // exatamente a forma do acidente do ensaio a seco, e merece o aviso forte.
    const todas = sempre.length === conds.length && !avisos.length;
    avisos.push({
      gravidade: todas ? "sempre" : "atencao",
      texto: todas
        // ⚠️ "entidades" é o nome interno do que o motor carrega. Quem lê a tela
        // pensa em campanha, conjunto e anúncio — e o nível não chega aqui, então
        // a frase honesta é a genérica.
        ? `Todas as condições são sempre verdadeiras (${ROTULO[sempre[0]!.metrica]} nunca fica abaixo de zero). A regra vai agir sobre TUDO que estiver no escopo escolhido.`
        : `${sempre.map((c) => `${ROTULO[c.metrica]} ${c.operador} ${c.valor}`).join(", ")} é sempre verdadeira e não filtra nada.`,
    });
  }

  return avisos;
}
