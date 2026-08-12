import type { NotificationSettingsDTO } from "@/lib/actions/notifications";

/**
 * A LINGUAGEM da tela de Notificações — pura, sem JSX e sem prisma.
 *
 * ⛔ OS CAMPOS SÃO DADO, NÃO JSX REPETIDO. São onze interruptores da MESMA
 * tabela, e escrevê-los um a um no componente produziria onze lugares onde
 * esquecer um — que é exatamente a forma da regressão do `calc` na tela de
 * Taxas: *"parece simples"* foi o que a produziu.
 *
 * Sendo dado, `test:notificacoes` consegue cruzar esta lista com o
 * `NotificationSettingsDTO` da própria ação e exigir que **os dois conjuntos
 * sejam iguais** — nem campo a mais, nem a menos.
 */

/** Um interruptor, com o rótulo dizendo o EFEITO. */
export type Interruptor = {
  campo: keyof NotificationSettingsDTO;
  rotulo: string;
  /** A consequência de ligar/desligar, quando ela não é óbvia. */
  apoio?: string;
};

/**
 * QUANDO avisar.
 *
 * ⚠️ Os dois são sobre venda, e a distinção importa: `pendente` é boleto ou Pix
 * gerado — dinheiro que **ainda pode não entrar**. Quem deixa os dois ligados
 * recebe duas notificações pela mesma venda, e é melhor dizer isso do que
 * deixar a pessoa descobrir pelo celular.
 */
export const QUANDO_AVISAR: readonly Interruptor[] = [
  {
    campo: "notifyApprovedSale",
    rotulo: "Venda aprovada",
    apoio: "O pagamento entrou.",
  },
  {
    campo: "notifyPendingSale",
    rotulo: "Venda pendente",
    apoio: "Boleto ou Pix gerado — o dinheiro ainda pode não entrar. Com os dois ligados, a mesma venda avisa duas vezes.",
  },
];

/**
 * O QUE mostrar na notificação.
 *
 * ⚠️ `showDashboardName` nasce DESLIGADO no schema, e é o único: ele só serve a
 * quem gerencia mais de uma operação. Ligá-lo por padrão poria o nome da área em
 * toda notificação de quem tem uma só.
 */
export const O_QUE_MOSTRAR: readonly Interruptor[] = [
  { campo: "showValue", rotulo: "Valor da venda" },
  { campo: "showProductName", rotulo: "Nome do produto" },
  { campo: "showUtmCampaign", rotulo: "Campanha de origem" },
  {
    campo: "showDashboardName",
    rotulo: "Nome da área",
    apoio: "Útil quando você acompanha mais de uma operação.",
  },
];

/**
 * Os horários fixos do resumo.
 *
 * ⛔ SÃO QUATRO COLUNAS SEPARADAS no schema (`report08`…`report23`), e não uma
 * lista — por isso o campo vem escrito aqui, e a hora é só o rótulo. Derivar o
 * nome da coluna a partir da hora (`report${h}`) funcionaria hoje e quebraria em
 * silêncio no dia em que alguém acrescentasse um horário com outro formato.
 *
 * ⚠️ E o horário é o do FUSO DA CONTA, não o do aparelho — é a mesma regra que
 * decide o que é "hoje" no painel inteiro. A tela diz isso.
 */
export const HORARIOS: readonly Interruptor[] = [
  { campo: "report08", rotulo: "08h" },
  { campo: "report12", rotulo: "12h" },
  { campo: "report18", rotulo: "18h" },
  { campo: "report23", rotulo: "23h" },
];

/** O tom do resumo. Os três valores são o enum `ReportPattern`. */
export const PADROES_DE_RESUMO: readonly { valor: string; rotulo: string; apoio: string }[] = [
  { valor: "STATUS_LUCRO", rotulo: "Status de lucro", apoio: "Faturamento, gasto e lucro do período." },
  { valor: "RESUMO_DETALHADO", rotulo: "Resumo detalhado", apoio: "Acrescenta ROAS, CPA e as campanhas do topo." },
  { valor: "NOTIFICACOES_CRIATIVAS", rotulo: "Notificações criativas", apoio: "O mesmo dado, em tom informal." },
];

/**
 * TODOS os campos que a tela escreve — a lista única.
 *
 * ⛔ É ela que `test:notificacoes` cruza com o DTO da ação. Se alguém
 * acrescentar uma coluna no servidor e esquecer da tela, ou o contrário, a
 * suíte diz qual — e é a família *"a tela nova apresenta o que não consegue
 * criar"*, que nenhuma outra ferramenta desta base pega.
 */
export const CAMPOS_ESCRITOS: readonly (keyof NotificationSettingsDTO)[] = [
  ...QUANDO_AVISAR.map((i) => i.campo),
  ...O_QUE_MOSTRAR.map((i) => i.campo),
  ...HORARIOS.map((i) => i.campo),
  "reportPattern",
];

/**
 * `true` = nenhum resumo vai sair, por mais que o padrão esteja escolhido.
 *
 * ⚠️ Sem isto o seletor de padrão fica pedindo uma escolha que não produz nada —
 * a mesma classe do controle inerte, só que criada pelo estado em vez do
 * código. A tela declara, em vez de deixar o usuário descobrir pela ausência.
 */
export function nenhumHorarioLigado(s: Pick<NotificationSettingsDTO, "report08" | "report12" | "report18" | "report23">): boolean {
  return HORARIOS.every((h) => s[h.campo as keyof typeof s] === false);
}
