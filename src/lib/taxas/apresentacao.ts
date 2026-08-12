import type { ExpenseCalc, ExpenseRecurrence, ExpenseType, PaymentMethod } from "@/generated/prisma/enums";

/**
 * A LINGUAGEM da tela de Taxas — pura, sem JSX e sem prisma.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 O PROBLEMA QUE ESTE ARQUIVO EXISTE PARA RESOLVER
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Duas taxas com valores parecidos podem incidir sobre coisas completamente
 * diferentes, e a tela antiga mostrava as duas como **número solto**:
 *
 *     R$ 2,50   ← por venda, e SÓ nas vendas no Pix
 *     3,5 %     ← sobre TODA venda
 *     R$ 500    ← por MÊS, independente de vender
 *
 * Três grandezas distintas, três denominadores distintos, e a lista dizendo
 * apenas "2,50", "3,5" e "500". Quem confere o lucro não tem como saber por que
 * a conta deu o que deu — e o erro que isso esconde não é de arredondamento: é
 * cadastrar uma taxa de gateway achando que ela vale para tudo.
 *
 * ⛔ POR ISSO A FRASE É DERIVADA, NUNCA ESCRITA NA TELA. Um template no JSX
 * viraria quatro templates (um por bloco) e divergiriam na primeira correção —
 * é a regra dos dois lugares que fazem a mesma conta. Aqui há UMA função, ela é
 * pura, e `test:taxas` a exercita nos oito formatos.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/* ── o que a tela precisa saber de cada despesa ─────────────────────────────── */

export type DespesaLinha = {
  id: string;
  name: string;
  type: ExpenseType;
  calc: ExpenseCalc;
  amount: number;
  paymentMethod: PaymentMethod | null;
  recurrence: ExpenseRecurrence;
  active: boolean;
};

const FORMA: Record<PaymentMethod, string> = {
  PIX: "no Pix",
  CARTAO: "no cartão",
  BOLETO: "no boleto",
  OUTRO: "em outras formas",
};

/**
 * O período de cada frequência, na voz do usuário.
 *
 * ⚠️ `UNICA` fica com string vazia de propósito: ela não tem período, e é
 * exatamente por não ter que ela está fora do cálculo. Escrever "uma vez" aqui
 * daria a ela a aparência de uma frequência como as outras.
 */
const PERIODO: Record<ExpenseRecurrence, string> = {
  UNICA: "",
  DIARIA: "por dia",
  SEMANAL: "por semana",
  MENSAL: "por mês",
  ANUAL: "por ano",
};

/**
 * As frequências que a tela OFERECE — quatro, e `UNICA` não está entre elas.
 *
 * ⛔ A ausência é decisão do dono, 12/08/2026, e o motivo é que oferecer uma
 * opção que a própria tela desaconselha na linha seguinte é pior que não
 * oferecer: o aviso viraria uma placa de "não use isto". Enquanto a despesa
 * única não tiver data de ocorrência (`ocorreEm`, migration pendente), ela não
 * entra em cálculo nenhum — então cadastrá-la é registrar um custo que não conta.
 *
 * ⚠️ Isto NÃO esconde as `UNICA` que já existem no banco: elas continuam
 * listadas, com a consequência declarada. Ver `AVISO_UNICA`.
 *
 * ⚠️ E o padrão é `MENSAL` porque é **exatamente o que o código já fazia**:
 * `createExpense` cai em `"MENSAL"` quando a frequência é omitida, e
 * `addDespesa` a passava fixa. Ou seja, o seletor torna VISÍVEL uma escolha que
 * já era tomada — não muda o resultado de quem não mexer nele.
 */
export const FREQUENCIAS: readonly { valor: ExpenseRecurrence; rotulo: string }[] = [
  { valor: "DIARIA", rotulo: "Por dia" },
  { valor: "SEMANAL", rotulo: "Por semana" },
  { valor: "MENSAL", rotulo: "Por mês" },
  { valor: "ANUAL", rotulo: "Por ano" },
];

export const FREQUENCIA_PADRAO: ExpenseRecurrence = "MENSAL";

/**
 * 🔴 A CONSEQUÊNCIA DECLARADA — e ela diz O QUE ACONTECE **e** POR QUÊ.
 *
 * Exigência do dono, 12/08/2026, e as duas metades são o ponto: um aviso que só
 * diz "despesa única não entra" deixa o usuário sem saber se é regra do produto,
 * limitação temporária ou erro dele. Dizendo o porquê, ele decide — cadastra
 * assim mesmo, ou usa outra frequência.
 *
 * ⛔ Não encurte para caber. Se o espaço apertar, o que sai é outra coisa da
 * tela, não a metade explicativa desta frase.
 */
export const AVISO_UNICA =
  "Despesas únicas ainda não entram no cálculo do lucro nem do break-even, " +
  "porque não guardamos a data em que elas ocorreram.";

/* ── a frase de cada linha ──────────────────────────────────────────────────── */

const real = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** `3,5` e não `3,50`; `3,55` continua `3,55`. */
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * A frase que diz **sobre o que a linha incide** — o entregável desta tela.
 *
 * | Entrada | Sai |
 * |---|---|
 * | gateway, FIXO 2,50, PIX | `R$ 2,50 por venda no Pix` |
 * | gateway, PERCENTUAL 3,5, sem forma | `3,5% sobre toda venda` |
 * | imposto, PERCENTUAL 6 | `6% sobre toda venda` |
 * | recorrente, FIXO 500, MENSAL | `R$ 500,00 por mês` |
 * | recorrente, FIXO 300, UNICA | `R$ 300,00 — sem período` |
 *
 * ⚠️ O `sobre toda venda` não é enfeite: ele é o contraste explícito com o
 * `no Pix`. Sem ele, a linha sem forma de pagamento não afirma nada e o leitor
 * tem de deduzir a ausência — e ausência não se lê.
 */
export function incidencia(d: Pick<DespesaLinha, "type" | "calc" | "amount" | "paymentMethod" | "recurrence">): string {
  if (d.type === "DESPESA_RECORRENTE") {
    const periodo = PERIODO[d.recurrence];
    /* Sem período é a `UNICA`. O travessão + "sem período" nomeia a AUSÊNCIA em
       vez de deixar a frase terminar no número — que se leria como "R$ 300,00"
       e nada mais, indistinguível de uma linha bem formada. */
    return periodo ? `${real(d.amount)} ${periodo}` : `${real(d.amount)} — sem período`;
  }

  const valor = d.calc === "FIXO" ? `${real(d.amount)} por venda` : `${pct(d.amount)} sobre`;
  const alvo = d.paymentMethod ? FORMA[d.paymentMethod] : d.calc === "FIXO" ? "em toda venda" : "toda venda";

  /* No FIXO o "por venda" já veio no valor, então o alvo só qualifica a forma;
     no PERCENTUAL o "sobre" pede o complemento. As duas frases terminam
     dizendo a mesma coisa por caminhos diferentes de propósito — "R$ 2,50 por
     venda no Pix" e "3,5% sobre toda venda" são como se fala, não como se
     preenche um template. */
  if (d.calc === "FIXO") return d.paymentMethod ? `${real(d.amount)} por venda ${alvo}` : `${real(d.amount)} por venda`;
  return `${valor} ${alvo}`;
}

/** `true` = esta linha NÃO entra no cálculo do lucro nem do break-even. */
export function foraDoCalculo(d: Pick<DespesaLinha, "type" | "recurrence">): boolean {
  return d.type === "DESPESA_RECORRENTE" && d.recurrence === "UNICA";
}

/* ── os grupos da seção de taxas ────────────────────────────────────────────── */

export type Grupo = {
  tipo: ExpenseType;
  titulo: string;
  /** O que este grupo faz com o dinheiro — em uma linha, na voz do usuário. */
  apoio: string;
  /** Estado vazio: diz a consequência de não cadastrar, não "nenhum item". */
  vazio: string;
};

/**
 * ⚠️ CADA `vazio` DIZ A CONSEQUÊNCIA, não a ausência. "Nenhuma taxa cadastrada"
 * é uma constatação; "o lucro aparece maior do que é" é o que a pessoa precisa
 * saber para decidir se age. É a mesma regra dos estados vazios do Dashboard.
 */
export const GRUPOS: readonly Grupo[] = [
  {
    tipo: "TAXA_GATEWAY",
    titulo: "Taxas de gateway",
    apoio: "O que a plataforma de pagamento retém de cada venda.",
    vazio: "Sem a taxa do seu gateway, o lucro do painel aparece maior do que é.",
  },
  {
    tipo: "IMPOSTO",
    titulo: "Impostos sobre a venda",
    apoio: "Percentual retido sobre o faturamento.",
    vazio: "Sem imposto cadastrado, o lucro é calculado como se não houvesse.",
  },
  {
    tipo: "COPRODUCAO",
    titulo: "Coprodução e afiliados",
    apoio: "Comissão paga sobre o faturamento.",
    vazio: "Se você divide faturamento com alguém, cadastre aqui.",
  },
  {
    tipo: "CUSTO_PRODUTO",
    titulo: "Custo do produto",
    apoio: "Produção, entrega e plataforma — o que sai por venda.",
    vazio: "Sem o custo do produto, a margem do painel é a margem bruta.",
  },
  {
    tipo: "DESPESA_RECORRENTE",
    titulo: "Despesas fixas",
    apoio: "O que você paga por período, venda ou não venda.",
    vazio: "Ferramentas, salários e aluguel entram aqui e no break-even.",
  },
];

/**
 * ⛔ TODA DESPESA NASCE NA ÁREA ATIVA — e este helper existe para que o
 * formulário não possa esquecer.
 *
 * 🔴 `Expense.workspaceId` NULO **não é "sem dono": é VALE PARA TODAS AS ÁREAS**.
 * É uma das duas linhas vermelhas da tabela do `CLAUDE.md` (a outra é
 * `AutomationRule`). Anular por descuido não deixa a despesa órfã — ela
 * **amplia escopo**, e passa a ser descontada do lucro de operações que nunca a
 * tiveram. O número continua plausível nas duas pontas, que é o que torna o
 * defeito mudo.
 *
 * ⚠️ A guarda de verdade é estrutural e está em `actions/expenses.ts`:
 * `createExpense` grava `escopo.areaId || null` e `updateExpense` aceita
 * **apenas** `amount | name | active` — não existe caminho pelo qual a edição
 * toque no `workspaceId`. Esta função é o lado da TELA da mesma regra, e
 * `test:taxas` prova as duas pontas.
 */
export function areaDaNovaDespesa(areaAtiva: string | null | undefined): string | null {
  return areaAtiva ?? null;
}

/* ── o modo de cálculo, e a forma de pagamento ──────────────────────────────── */

/**
 * 🔴 OS DOIS SELETORES QUE ESTA TELA PERDEU E RECUPEROU — leia antes de mexer.
 *
 * A primeira versão da tela nova (12/08/2026) cravou `calc: "PERCENTUAL"` e não
 * enviava `paymentMethod` nenhum. A tela ANTIGA oferecia os dois. Ou seja: a
 * reescrita **removeu caminho de escrita**, e o defeito ficou invisível porque a
 * LEITURA continuou perfeita — a lista desenhava `R$ 2,50 por venda no Pix` sem
 * que existisse qualquer forma de criar aquela linha.
 *
 * ⛔ AO MEXER AQUI, A PERGUNTA NÃO É "a tela mostra tudo?" — É "a tela CRIA
 * tudo que ela mostra?". Ver a seção própria no `CLAUDE.md`.
 */

/**
 * ⚠️ O RÓTULO DIZ O EFEITO, não o nome do modo.
 *
 * `%` e `R$` sozinhos são símbolos, e o campo ao lado aceita os dois — então
 * **3,5 significa coisas muito diferentes** conforme o modo, e é exatamente ali
 * que alguém cadastra `R$ 3,50` achando que são `3,5%`. A diferença entre os
 * dois, numa venda de R$ 300, é de R$ 7,00 por venda.
 */
export const MODOS_CALC: readonly { valor: ExpenseCalc; rotulo: string }[] = [
  { valor: "PERCENTUAL", rotulo: "% sobre o valor da venda" },
  { valor: "FIXO", rotulo: "R$ fixo por venda" },
];

/** O padrão de hoje. ⛔ Não mude: é o que todo caminho de criação já usava. */
export const CALC_PADRAO: ExpenseCalc = "PERCENTUAL";

/**
 * Quem aceita escolher o modo.
 *
 * ⛔ `IMPOSTO` e `DESPESA_RECORRENTE` ficam de fora, e não é omissão — os dois
 * cravam por razão, e a razão é do domínio:
 *
 *   · imposto sobre venda é percentual por natureza;
 *   · despesa fixa em % do faturamento não é despesa fixa — ela deixaria de ser
 *     o custo que existe mesmo sem vender, que é o que a define e o que faz
 *     dela a base do break-even.
 *
 * ⚠️ Isto reproduz exatamente o que a tela antiga oferecia. Acrescentar um dos
 * dois aqui é MUDANÇA DE COMPORTAMENTO, não conserto.
 */
export function aceitaCalc(tipo: ExpenseType): boolean {
  return tipo === "TAXA_GATEWAY" || tipo === "COPRODUCAO" || tipo === "CUSTO_PRODUTO";
}

/** Só a taxa de gateway se restringe a uma forma de pagamento. */
export function aceitaFormaDePagamento(tipo: ExpenseType): boolean {
  return tipo === "TAXA_GATEWAY";
}

/**
 * O sentinela de "todas as formas", na INTERFACE.
 *
 * ⚠️ Reexportado daqui, e não importado do `financeiro` por cada componente, para
 * que a conversão e o valor andem juntos — separá-los é como um deles muda sem o
 * outro.
 */
export { TODAS_AS_FORMAS } from "@/lib/financeiro";

export const FORMAS_DE_PAGAMENTO: readonly { valor: string; rotulo: string }[] = [
  { valor: "__TODAS__", rotulo: "Todas as formas" },
  { valor: "PIX", rotulo: "Somente Pix" },
  { valor: "CARTAO", rotulo: "Somente cartão" },
  { valor: "BOLETO", rotulo: "Somente boleto" },
  { valor: "OUTRO", rotulo: "Somente outras formas" },
];

/**
 * 🔴 A CONVERSÃO DO SENTINELA — e ela é a razão de `addGateway` não ter sido
 * apagado como órfão comum.
 *
 * `__TODAS__` existe SÓ na interface: no banco, "todas as formas" é `null`.
 * Gravar a string faria a taxa não casar com forma de pagamento nenhuma — a
 * linha existiria, apareceria na tela, e **não entraria em cálculo nenhum**.
 *
 * ⚠️ Ela vivia dentro de `addGateway`, no `useTraffikState`. Ao deletar aquele
 * helper a conversão teria sumido junto, e o sintoma só apareceria semanas
 * depois, num lucro alto demais. É a regra *"antes de deletar um órfão,
 * pergunte o que ele FAZIA"* — e por isso ela mudou de casa em vez de morrer.
 *
 * ⛔ `test:taxas` a exercita com os dois valores. Sem isso ela seria a próxima
 * proteção morta esperando alguém deletar.
 */
export function formaParaServidor(valor: string): PaymentMethod | null {
  return valor === "__TODAS__" || valor === "" ? null : (valor as PaymentMethod);
}
