import type { ConteudoInfo } from "@/components/dashboard/ui/InfoTip";

/**
 * Textos de ajuda da ferramenta, em UM lugar.
 *
 * Ficam centralizados por dois motivos: revisar redação sem caçar `title=""`
 * espalhado por dez componentes, e garantir que a mesma métrica seja explicada
 * igual no Dashboard e no Gerenciador — antes o CPA tinha uma descrição em cada
 * tela, e elas já divergiam ("Gasto ÷ vendas" vs. nada).
 *
 * As entradas com `valores` são funções: os números do período precisam ser
 * lidos no momento do render, não fixados aqui.
 */

// ─────────────────── Métricas do Gerenciador e do Dashboard ───────────────────

export const METRICAS: Record<string, ConteudoInfo> = {
  orcamento: {
    titulo: "Orçamento diário",
    corpo: ["Quanto a campanha ou o conjunto pode gastar por dia."],
    lista: [
      "Campanha CBO: o orçamento fica na campanha e é editado ali.",
      "Campanha ABO: o orçamento fica nos conjuntos.",
    ],
    alerta: "A caneta só aparece no nível que a Meta aceita — no nível errado a alteração seria recusada.",
    fonte: "meta",
  },
  vendas: {
    titulo: "Vendas aprovadas",
    corpo: [
      "Vendas confirmadas pelo gateway de pagamento e atribuídas a este anúncio pelos UTMs.",
      "Aparecem em segundos, no instante em que o webhook chega — sem esperar a consolidação da Meta.",
    ],
    fonte: "nosso",
  },
  vendasInic: {
    titulo: "Vendas iniciadas",
    corpo: [
      "Todo pedido gerado, em qualquer status: pendente, aprovado, reembolsado, recusado.",
      "A coluna “Vendas” conta apenas as aprovadas. A diferença entre as duas é a sua taxa de aprovação.",
    ],
    fonte: "nosso",
  },
  faturamento: {
    titulo: "Faturamento",
    corpo: ["Soma do valor das vendas aprovadas atribuídas a este anúncio."],
    alerta: "É receita bruta: não desconta taxa de gateway, imposto nem despesas.",
    fonte: "nosso",
  },
  lucro: {
    titulo: "Lucro (bruto)",
    corpo: ["O que sobrou depois de descontar o gasto com mídia."],
    formula: "Faturamento − Gasto",
    alerta:
      "Não desconta taxas, impostos nem despesas — elas existem só no nível da conta e não há como ratear por campanha com honestidade. O Dashboard, que é no nível da conta, usa o lucro líquido.",
    fonte: "derivada",
  },
  cpa: {
    titulo: "CPA — Custo por Aquisição",
    corpo: ["Quanto custou, em mídia, cada venda aprovada."],
    formula: "Gasto ÷ Vendas aprovadas",
    fonte: "derivada",
  },
  roas: {
    titulo: "ROAS — Retorno sobre o Investimento em Anúncios",
    corpo: [
      "Quantos reais de faturamento cada real de anúncio trouxe.",
      "2,00x significa que cada R$ 1 investido devolveu R$ 2 em vendas.",
    ],
    formula: "Faturamento ÷ Gasto",
    fonte: "derivada",
  },
  roi: {
    titulo: "ROI — Retorno sobre o Investimento",
    corpo: [
      "Diferente do ROAS: olha o LUCRO, não o faturamento.",
      "0,50x significa 50% de lucro sobre o que foi investido. Negativo significa prejuízo.",
    ],
    formula: "Lucro ÷ Custo total",
    alerta:
      "O piso é −1,00x, e não é um travamento: sem faturamento nenhum você perdeu 100% do investido, e não há como perder mais que isso. Quem varia com o tamanho do prejuízo é o Lucro, em reais.",
    fonte: "derivada",
  },
  margem: {
    titulo: "Margem de lucro",
    corpo: ["Quanto do faturamento virou lucro."],
    formula: "(Lucro ÷ Faturamento) × 100",
    fonte: "derivada",
  },
  ic: {
    titulo: "IC — Initiate Checkout",
    corpo: [
      "Visitantes distintos que clicaram para ir ao checkout.",
      "Contado por pessoa, não por clique: quem clica duas vezes conta uma.",
    ],
    alerta:
      "A Meta não enxerga este evento — o checkout é hospedado pelo gateway. Só é atribuído a um anúncio quando o visitante tem fbclid; tráfego orgânico entra no funil do Dashboard mas não nesta coluna.",
    fonte: "nosso",
  },
  cpi: {
    titulo: "CPI — Custo por Initiate Checkout",
    corpo: ["Quanto custou, em mídia, cada pessoa que chegou ao checkout."],
    formula: "Gasto ÷ IC",
    fonte: "derivada",
  },
  cliques: {
    titulo: "Cliques (mídia)",
    corpo: [
      "Cliques no anúncio, como a Meta contabiliza.",
      "É o denominador do CTR e do CPC, de propósito: assim esses números batem com o painel da Meta.",
    ],
    fonte: "meta",
  },
  cliquesAtr: {
    titulo: "Cliques atribuídos",
    corpo: [
      "Pessoas que chegaram ao seu site com os UTMs, contadas pelo nosso script.",
      "Não é o mesmo número da coluna “Cliques”, e as duas nunca são somadas.",
    ],
    alerta:
      "A diferença entre as duas é informação útil: clique na Meta sem clique nosso é gente que clicou e não carregou a página — ou tráfego sem o script de UTM instalado.",
    fonte: "nosso",
  },
  cpc: {
    titulo: "CPC — Custo por Clique",
    corpo: ["Quanto custou cada clique no anúncio."],
    formula: "Gasto ÷ Cliques (Meta)",
    fonte: "meta",
  },
  ctr: {
    titulo: "CTR — Taxa de Cliques",
    corpo: ["Quantos por cento de quem viu o anúncio clicou nele. Mede o poder de atração do criativo."],
    formula: "(Cliques ÷ Impressões) × 100",
    fonte: "meta",
  },
  cpm: {
    titulo: "CPM — Custo por Mil Impressões",
    corpo: ["Quanto custa exibir o anúncio mil vezes. Mede o preço do leilão para o seu público."],
    formula: "(Gasto ÷ Impressões) × 1000",
    fonte: "meta",
  },
  impressoes: {
    titulo: "Impressões",
    corpo: ["Quantas vezes o anúncio foi exibido. A mesma pessoa pode gerar várias impressões."],
    fonte: "meta",
  },
  gasto: {
    titulo: "Gasto",
    corpo: ["Quanto a Meta já cobrou no período."],
    alerta: "É a única métrica que depende da consolidação da Meta — ela pode levar de minutos a horas.",
    fonte: "meta",
  },
  bid: {
    titulo: "Bid Cap",
    corpo: ["Teto de lance do conjunto. Vazio significa que a Meta otimiza o lance sem limite definido por você."],
    fonte: "meta",
  },
  ticket: {
    titulo: "Ticket médio",
    corpo: ["Valor médio de cada venda aprovada."],
    formula: "Faturamento ÷ Vendas aprovadas",
    fonte: "derivada",
  },
  arpu: {
    titulo: "ARPU — Receita por Comprador",
    corpo: ["Faturamento dividido por comprador ÚNICO, identificado pelo e-mail."],
    formula: "Faturamento ÷ Compradores únicos",
    alerta:
      "Vendas sem e-mail contam como compradores distintos — não há como agrupá-las, e é melhor superestimar o denominador do que fundir pessoas diferentes.",
    fonte: "derivada",
  },
  divergenciaMeta: {
    titulo: "Por que difere do Gerenciador da Meta?",
    corpo: ["Três motivos, e nenhum deles é erro de cálculo:"],
    lista: [
      "Atraso: a Meta leva de minutos a horas para consolidar; nós registramos no instante do evento.",
      "Janela de atribuição: a Meta credita a venda em até 7 dias após o clique (e 1 dia após a visualização). Nós casamos por UTM/fbclid direto.",
      "Deduplicação: a Meta agrupa por pessoa entre dispositivos; nós, por sessão.",
    ],
    alerta: "Para vendas e faturamento, o nosso número é o que reflete o gateway — é o dinheiro que entrou de fato.",
  },
};

// ─────────────────── Etapas do funil ───────────────────

export const FUNIL: Record<string, ConteudoInfo> = {
  cliques: {
    titulo: "Cliques no anúncio",
    corpo: ["Cliques que a Meta reportou nos seus anúncios no período."],
    fonte: "meta",
  },
  visitas: {
    titulo: "Visita na página",
    corpo: ["Sessões que chegaram ao seu site com os UTMs. Contada uma vez por sessão, não por pageview."],
    alerta:
      "Pode ser MAIOR que os cliques do anúncio, e isso não é erro: tráfego orgânico e direto também gera visita, e a Meta subnotifica cliques.",
    fonte: "nosso",
  },
  checkouts: {
    titulo: "Initiate Checkout",
    corpo: ["Visitantes distintos que foram para o checkout, pelo clique no botão ou pelo pedido gerado no gateway."],
    fonte: "nosso",
  },
  iniciadas: {
    titulo: "Vendas iniciadas",
    corpo: ["Pedidos gerados no gateway, em qualquer status."],
    fonte: "nosso",
  },
  aprovadas: {
    titulo: "Vendas aprovadas",
    corpo: ["Pedidos efetivamente pagos e confirmados pelo gateway."],
    fonte: "nosso",
  },
  metodo: {
    titulo: "Como o percentual é calculado",
    corpo: [
      "Cada etapa mostra seu tamanho em relação à MAIOR etapa do funil, que fica em 100%.",
      "Assim nenhuma etapa passa de 100% e a largura do desenho fica proporcional ao número.",
    ],
    formula: "(Valor da etapa ÷ Maior etapa) × 100",
    alerta:
      "A conversão real em relação à etapa anterior continua disponível: passe o mouse sobre a etapa.",
  },
};

// ─────────────────── Campos de configuração ───────────────────

export const CONFIG: Record<string, ConteudoInfo> = {
  webhookToken: {
    titulo: "Token de segurança",
    corpo: [
      "O mesmo token que você configurou no painel do gateway.",
      "Ele prova que o webhook veio mesmo do gateway, e não de outra pessoa que descobriu a URL.",
    ],
    alerta: "Se não bater, a venda é recusada com 401 e fica registrada na aba Testes.",
  },
  webhookUrl: {
    titulo: "URL do webhook",
    corpo: ["Cole este endereço no painel do seu gateway, no campo de notificações ou webhooks."],
    alerta: "É único e secreto: quem tiver esta URL e o token pode registrar vendas na sua conta.",
  },
  apiKey: {
    titulo: "Chave de API",
    corpo: [
      "Use no header das suas requisições: Authorization: Bearer <chave>.",
      "Serve para registrar vendas de sistemas que não têm integração pronta.",
    ],
    alerta: "Mostrada por inteiro só uma vez. Depois fica mascarada — guarde agora.",
  },
  pixelId: {
    titulo: "ID do Pixel da Meta",
    corpo: ["O identificador numérico do pixel, encontrado no Gerenciador de Eventos da Meta."],
  },
  pixelToken: {
    titulo: "Token da API de Conversões",
    corpo: [
      "Permite enviar eventos direto do servidor para a Meta, sem depender do navegador do visitante.",
      "Gerado no Gerenciador de Eventos, em Configurações › API de Conversões.",
    ],
    alerta: "Guardado criptografado. Ao editar o pixel, deixe em branco para manter o token atual.",
  },
  pixelIC: {
    titulo: "Detecção de Initiate Checkout",
    corpo: ["Como identificamos que o visitante foi para o checkout."],
    lista: [
      "Clique no link de checkout: funciona mesmo com o checkout no gateway. É o recomendado.",
      "Contém texto ou CSS: dispara ao clicar num elemento específico da sua página.",
      "Contém URL: só funciona se o script estiver instalado NA página do checkout.",
    ],
    alerta:
      "“Contém URL” é a causa mais comum de pixel que não dispara: se o checkout é do gateway (pay.kirvano.com), o script não roda lá e a regra nunca casa.",
  },
  utmSeparador: {
    titulo: "Separador do xcod",
    corpo: [
      "Código único da sua conta, usado para separar os campos dentro do parâmetro xcod da Hotmart.",
      "É aleatório para não colidir com texto que apareça nos nomes das suas campanhas.",
    ],
  },
  utmFormato: {
    titulo: "Formato nome|id",
    corpo: [
      "Os UTMs saem como “Nome da campanha|123456”, com o id numérico da Meta no fim.",
      "É o id que permite atribuir a venda ao anúncio certo mesmo se você renomear a campanha depois.",
    ],
    alerta: "Sem o id, a atribuição cai no nome — e dois anúncios com o mesmo nome viram um só.",
  },
  regraPeriodo: {
    titulo: "Período de cálculo",
    corpo: ["A janela de dados que a regra olha para decidir se dispara."],
    alerta: "“Hoje” usa o seu fuso horário configurado, não o do servidor.",
  },
  regraFrequencia: {
    titulo: "Frequência de verificação",
    corpo: ["De quanto em quanto tempo a regra é avaliada."],
    alerta: "Depende de um cron externo estar configurado — sem ele, nenhuma regra roda sozinha.",
  },
  regraTeto: {
    titulo: "Teto de orçamento",
    corpo: [
      "O valor máximo que esta regra pode colocar no orçamento diário. Ela nunca passa daí.",
      "É obrigatório nas regras que aumentam orçamento.",
    ],
    alerta:
      "Sem teto, uma regra de +20% aumentaria o orçamento a cada execução: 100 → 120 → 144 → 173… Por isso a Traffik recusa o aumento quando o teto está em branco.",
  },
  regraJanela: {
    titulo: "Intervalo de execução",
    corpo: [
      "A faixa de horário em que a regra pode agir, no seu horário local.",
      "Fora dela, ela não é avaliada — útil para não mexer em campanha de madrugada.",
    ],
    lista: ["Deixe em “qualquer hora” para rodar sempre", "22h → 6h atravessa a meia-noite"],
  },
  regraContas: {
    titulo: "Contas de anúncio",
    corpo: [
      "Em quais contas esta regra pode agir. Em branco = todas as contas desta área de trabalho.",
    ],
    alerta:
      "A regra nunca age em conta de outra área, mesmo em branco — a Traffik sempre limita ao que pertence à área onde ela foi criada.",
  },
  despesaArea: {
    titulo: "Só nesta área de trabalho",
    corpo: [
      "Desmarcado, a taxa vale para todas as suas operações — é o certo para imposto e taxa de gateway.",
      "Marcado, ela desconta só do lucro desta área.",
    ],
    alerta: "Marque apenas se o custo é exclusivo desta operação. Do contrário o lucro das outras áreas fica maior do que a realidade.",
  },
  contaUnicaPorArea: {
    titulo: "Uma conta, uma área",
    corpo: [
      "Cada conta de anúncio pertence a uma área de trabalho só.",
      "É o que impede o mesmo investimento de ser contado como se fossem duas operações — o que inflaria ROAS, ROI e CPA das duas.",
    ],
    lista: ["Conta já usada aparece bloqueada, com o nome da área que a ocupa", "“Mover para cá” transfere ao salvar"],
  },
  utmPorArea: {
    titulo: "Este script é desta área",
    corpo: [
      "Instale-o na página de vendas desta operação. Cada área tem o seu.",
      "Ele faz o tráfego sem campanha identificada (direto, orgânico, outros canais) entrar nesta área em vez de cair na Principal.",
    ],
    alerta:
      "Tráfego pago já é separado pelo utm_campaign da campanha na Meta — o script resolve o resto. Scripts antigos continuam funcionando.",
  },
  regraLimite: {
    titulo: "Limite diário de execuções",
    corpo: [
      "Quantas vezes, no máximo, esta regra pode agir por dia.",
      "Protege contra uma regra mal calibrada pausar e reativar a mesma campanha em loop.",
    ],
  },
  fusoHorario: {
    titulo: "Fuso horário de referência",
    corpo: [
      "Define onde o seu dia começa e termina em TODOS os relatórios.",
      "Os horários são guardados em UTC no banco e convertidos para este fuso na exibição.",
    ],
    alerta: "Mudar aqui altera dashboard, vendas por horário, vendas por dia e os filtros de período.",
  },
};
