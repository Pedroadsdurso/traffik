/**
 * O CATÁLOGO — metadados dos blocos do Dashboard. **Sem JSX, de propósito.**
 *
 * 🔴 REGRA DE ENTRADA, E ELA É APLICADA PELO COMPILADOR: nada entra aqui sem
 * ter um render em `catalogoRender.tsx`. O `Record<IdBloco, …>` de lá exige uma
 * entrada para CADA id declarado aqui — acrescentar um bloco só nos metadados
 * quebra o `tsc`.
 *
 * Isso é mais forte do que a versão anterior, em que metadados e render moravam
 * juntos e nada impedia um `render: () => null`. **Um catálogo que oferece bloco
 * vazio é o pior controle inerte da base**: o usuário ESCOLHE, espera, e é ele
 * quem descobre que não há nada. O botão inerte frustra; o catálogo inerte faz
 * o usuário duvidar do próprio entendimento.
 *
 * ⚠️ A separação nasceu de uma necessidade concreta, e vale registrar porque é
 * um bom motivo: a MIGRAÇÃO de layout precisa das larguras, é pura, e é testada
 * com `node --experimental-strip-types`, que não lê `.tsx`. Metadado que só um
 * componente pode ler é metadado que nenhum teste alcança.
 *
 * ### As LARGURAS nascem aqui
 *
 * Cada painel declara as que aceita. **O modo de edição oferece as DELE, não um
 * valor qualquer** — é o que separa "escolher entre opções" de
 * "redimensionamento livre", e o que impede o Dashboard de voltar a ser uma
 * grade de doze caixas iguais.
 */

/** Onde o bloco pode viver. **Não há arrasto entre zonas.** */
export type Zona = "hero" | "faixa" | "paineis";

/**
 * As frações de linha que um painel aceita.
 *
 * ⚠️ Um painel pode aceitar mais de uma; o usuário escolhe **entre as dele**.
 * Um globo não cabe em 1/3; uma lista de 5 linhas não precisa de linha cheia.
 */
export type Largura = "um-terco" | "metade" | "cheia";

export interface MetaBloco {
  id: string;
  titulo: string;
  /** Uma linha dizendo o que o bloco responde. Vai para o painel de escolha. */
  descricao: string;
  zona: Zona;
  larguras: Largura[];
  /** A largura inicial. **Tem de estar em `larguras`** — há asserção disso. */
  larguraPadrao: Largura;
}

/* ⚠️ Hero e faixa NÃO estão aqui: são listas de MÉTRICA, não de bloco, e o
   catálogo delas é o `metricCards` do hook. Misturar os dois faria o painel de
   escolha oferecer "Faturamento" e "Vendas por país" na mesma lista. */
export const CATALOGO_META = [
  {
    id: "funil",
    titulo: "Funil",
    descricao: "Cliques → checkouts → vendas, com a taxa de cada passo",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
  {
    id: "fontes",
    titulo: "Fontes de tráfego",
    descricao: "De qual canal veio o faturamento",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
  {
    id: "produtos",
    titulo: "Produtos",
    descricao: "Quais produtos faturaram mais",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
  {
    id: "pagamentos",
    titulo: "Formas de pagamento",
    descricao: "Como os compradores pagaram",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
  {
    id: "vendas-por-dia",
    titulo: "Vendas por dia",
    descricao: "Quantas vendas e quanto faturou em cada dia",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
  },
  {
    id: "vendas-por-hora",
    titulo: "Vendas por horário",
    descricao: "As 24 horas do período filtrado",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
  },
  {
    id: "lucro-por-hora",
    titulo: "Lucro por horário",
    descricao: "Receita menos a fatia de custo daquela hora",
    zona: "paineis",
    larguras: ["metade", "cheia"],
    larguraPadrao: "metade",
  },
  {
    id: "aprovacao",
    titulo: "Taxa de aprovação",
    descricao: "Quanto de cada forma de pagamento é aprovado",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
  {
    id: "atividade",
    titulo: "Atividade recente",
    descricao: "Os últimos eventos de venda e rastreamento",
    zona: "paineis",
    larguras: ["um-terco", "metade"],
    larguraPadrao: "um-terco",
  },
] as const satisfies readonly MetaBloco[];

/** Os ids válidos, derivados da lista. É o que o `Record` dos renders exige. */
export type IdBloco = (typeof CATALOGO_META)[number]["id"];

export function metaDoBloco(id: string): MetaBloco | undefined {
  return CATALOGO_META.find((b) => b.id === id);
}

/**
 * ⛔ BLOCOS ESTRUTURAIS — a categoria que NÃO entra no catálogo, por decisão de
 * produto. Não é omissão, e a lista existe para não rediscutirmos caso a caso.
 *
 * ⚠️ A regra: **bloco cuja ausência faz o usuário tomar decisão errada, ou
 * deixar de saber que o sistema falhou, é estrutural.** Não é sobre importância
 * — é sobre o que a ausência CAUSA.
 *
 * ### 🔴 O `motivo` é DADO, e não prosa neste comentário
 *
 * Ele era uma tabela em Markdown aqui em cima, legível só por quem abrisse o
 * arquivo. **O modo de edição precisa dizer ao usuário por que aquele bloco não
 * tem ✕**, e a alternativa era escrever a frase de novo na tela — segunda cópia
 * da mesma decisão, que diverge no primeiro dia em que alguém mudar uma delas.
 *
 * ⛔ O bloco estrutural aparece no modo de edição **sem o ✕**, não desabilitado.
 * Um ✕ apagado é um controle que existe e não funciona; a ausência dele, com o
 * motivo ao alcance, é uma afirmação sobre o produto.
 */
export interface MetaEstrutural {
  id: string;
  titulo: string;
  /** Uma frase curta, na voz do usuário. Vai para a tooltip do selo "Fixo". */
  motivo: string;
}

export const ESTRUTURAIS_META = [
  {
    id: "alertas",
    titulo: "Alertas",
    motivo: "Alerta que dá para esconder é alerta que ninguém vê.",
  },
  {
    id: "receita-gasto",
    titulo: "Receita vs. gasto",
    motivo: "É a leitura central do painel — sem ela a tela não responde nada.",
  },
  {
    id: "paises",
    titulo: "Vendas por país",
    motivo: "O globo não cabe em nenhuma das larguras de painel.",
  },
  {
    id: "rodape",
    titulo: "Estado do sistema",
    motivo: "Diz se a ferramenta está funcionando. Não é sobre dinheiro.",
  },
] as const satisfies readonly MetaEstrutural[];

export const IDS_ESTRUTURAIS = ESTRUTURAIS_META.map((b) => b.id);
