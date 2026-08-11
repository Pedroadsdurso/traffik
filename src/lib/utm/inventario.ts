/**
 * O INVENTÁRIO REAL DE SNIPPETS — o que esta ferramenta de fato entrega.
 *
 * > ### 🔧 A REFERÊNCIA (imagem 8) DESCREVE OUTRO PRODUTO, e a tela mostra o NOSSO
 * >
 * > Não existe modelo `Snippet` no `schema.prisma` — conferido nos 24 modelos em
 * > 11/08/2026. Mas o produto tem snippets de verdade: quatro famílias de código
 * > **gerado**, que o usuário copia e instala no site dele.
 * >
 * > Inventar uma biblioteca de trechos avulsos para bater com o print seria pior
 * > que a ausência: uma tabela de conteúdo que ninguém escreveu, sobre snippets
 * > que não são instalados em lugar nenhum.
 *
 * ## ⛔ O TOGGLE NÃO É UNIFORME — e isso é a decisão, não uma falta
 *
 * Os snippets de pixel têm `PixelConfig.enabled` e `togglePixel()`: o controle é
 * real dos dois lados. Os de UTM **não têm coluna de estado**. Desenhar quatro
 * toggles inertes ali criaria exatamente o defeito que esta base vem removendo
 * há dez sessões — o usuário desliga, a tela confirma, e ninguém lê.
 *
 * No lugar deles vai um SELO medido: `instalado` quando já chegou clique
 * carimbado com a área (`cliquesComArea > 0`), `não detectado` quando não
 * chegou nenhum. É melhor que o toggle, aliás: responde se o script está
 * funcionando, não se alguém marcou uma caixa.
 *
 * ⚠️ `não detectado` **não é** `quebrado`. Área sem tráfego produz o mesmo zero
 * que script mal instalado, e não temos como distinguir — o rótulo diz o que foi
 * medido e a tela escreve a ambiguidade por extenso.
 */

import type { Linguagem } from "@/components/tk/CodigoDestacado";
import { scriptDoPixel } from "@/lib/pixel/script";
import type { UtmCodesDTO } from "@/lib/actions/utm";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import { backRedirectScript, utmScript } from "./scripts";

export type CategoriaSnippet = "UTM" | "Pixel" | "Anúncio";

export type EstadoSnippet =
  /** Tem coluna no banco e ação que escreve nela. */
  | { tipo: "ligavel"; ligado: boolean }
  /** Não tem estado gravável — o que se sabe é se ele já reportou. */
  | { tipo: "instalacao"; detectado: boolean };

export interface SnippetReal {
  id: string;
  nome: string;
  categoria: CategoriaSnippet;
  linguagem: Linguagem;
  /** O que a coluna TIPO mostra: `JavaScript`, `HTML`, `Texto`. */
  tipo: string;
  codigo: string;
  /** Uma linha: o que ele faz, em consequência para o negócio. */
  descricao: string;
  /** Onde colar. É a pergunta seguinte de quem clicou em copiar. */
  ondeColar: string;
  /**
   * `null` = **não medível**, e a tela escreve `—`.
   *
   * ⛔ Zero e "não sabemos" não são a mesma afirmação. O script de UTM é colado
   * num site que não nos reporta quantas páginas o receberam.
   */
  usadoEm: number | null;
  /** ISO, ou `null` quando o snippet é gerado sob demanda e não tem data. */
  atualizadoEm: string | null;
  estado: EstadoSnippet;
  /**
   * `true` = o CÓDIGO muda com a área ativa.
   *
   * 🔴 É a marca da regra do artefato. Um snippet `porArea` copiado com a área
   * errada não produz número velho: produz instalação permanente errada na
   * página de outra pessoa.
   */
  porArea: boolean;
}

/**
 * Monta o inventário. Função pura: recebe os DTOs, devolve a lista.
 *
 * ⚠️ `codigos` chega da `getUtmCodes(workspaceId)`, e é ele que carrega a área.
 * Trocar de área muda `codigos.workspaceId`, que muda o `utmScript` — é essa
 * corrente que `test:utm-tela` exercita ponta a ponta.
 */
export function montarInventario({
  codigos,
  pixels,
  apiBase,
  urlBackRedirect,
}: {
  codigos: UtmCodesDTO | null;
  pixels: PixelConfigDTO[];
  apiBase: string;
  /** Vazio = o cartão do back redirect aparece pedindo o endereço. */
  urlBackRedirect: string;
}): SnippetReal[] {
  if (!codigos) return [];

  const detectado = codigos.cliquesComArea > 0;
  const lista: SnippetReal[] = [];

  lista.push({
    id: "utm-rastreamento",
    nome: "Rastreamento de visitas",
    categoria: "UTM",
    linguagem: "js",
    tipo: "JavaScript",
    codigo: utmScript(codigos.accountId, apiBase, codigos.workspaceId),
    descricao:
      "Identifica de qual anúncio cada visitante veio e leva essa informação até o checkout. É o que faz a venda aparecer ligada à campanha certa.",
    ondeColar: "No campo de código do cabeçalho do site — “Header”, ou antes de </head>.",
    usadoEm: null,
    atualizadoEm: null,
    estado: { tipo: "instalacao", detectado },
    porArea: true,
  });

  lista.push({
    id: "utm-back-redirect",
    nome: "Rastreamento do back redirect",
    categoria: "UTM",
    linguagem: "js",
    tipo: "JavaScript",
    /* Sem endereço não há script: gerar um com `DEST = ""` produziria um arquivo
       que não faz nada e que parece pronto para instalar. */
    codigo: urlBackRedirect.trim() ? backRedirectScript(urlBackRedirect) : "",
    descricao:
      "Se você usa página de back redirect, instale nela também. Sem ele, quem passa por ali perde a origem do anúncio e a venda deixa de ser atribuída.",
    ondeColar: "No cabeçalho da sua página de back redirect.",
    usadoEm: null,
    atualizadoEm: null,
    estado: { tipo: "instalacao", detectado },
    porArea: false,
  });

  /* Os três destinos são TEXTO, não script: vão no campo "Parâmetros de URL" do
     anúncio, no Gerenciador da Meta. Categoria própria porque quem os usa está
     em outra ferramenta, não no site. */
  const destinos = [
    ["hotmart", "Parâmetros de URL — Hotmart", "Usa o xcod, com o separador único da sua conta"],
    ["cartpanda", "Parâmetros de URL — Cartpanda", "Usa o cid para identificar a sua conta"],
    ["outros", "Parâmetros de URL — Outros", "Formato padrão, para qualquer plataforma"],
  ] as const;

  for (const [chave, nome, descricao] of destinos) {
    lista.push({
      id: `param-${chave}`,
      nome,
      categoria: "Anúncio",
      linguagem: "js",
      tipo: "Texto",
      codigo: codigos[chave],
      descricao,
      ondeColar: "No campo “Parâmetros de URL” do seu anúncio, no Gerenciador da Meta.",
      usadoEm: null,
      atualizadoEm: null,
      estado: { tipo: "instalacao", detectado },
      porArea: false,
    });
  }

  for (const px of pixels) {
    lista.push({
      id: `pixel-${px.id}`,
      nome: `Pixel — ${px.name}`,
      categoria: "Pixel",
      linguagem: "js",
      tipo: "JavaScript",
      codigo: scriptDoPixel(px, apiBase),
      descricao:
        "Dispara os eventos configurados deste pixel a partir do navegador e reporta à Conversions API da Meta.",
      ondeColar: "No cabeçalho do site, junto do script de rastreamento.",
      /* `usado em N contas` da referência: aqui o número que EXISTE é quantos
         pixels da Meta este snippet alimenta. Chamá-lo de "contas" seria pegar
         emprestado o rótulo de um dado que não temos. */
      usadoEm: px.metaPixels.length,
      atualizadoEm: null,
      estado: { tipo: "ligavel", ligado: px.enabled },
      porArea: false,
    });
  }

  return lista;
}

/** Rótulo da coluna USADO EM — respeita `null` como "não medido". */
export function rotuloUsadoEm(s: SnippetReal): string {
  if (s.usadoEm === null) return "—";
  return s.usadoEm === 1 ? "1 pixel da Meta" : `${s.usadoEm} pixels da Meta`;
}
