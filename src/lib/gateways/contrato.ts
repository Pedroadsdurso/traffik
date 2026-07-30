import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";

/**
 * # O CONTRATO — formato interno de venda, independente do gateway
 *
 * Toda venda que entra na Traffik passa por aqui, venha da Kirvano, da Cakto, de
 * um gateway que ainda não existe ou da chave de API. **Nada abaixo desta camada
 * sabe o nome de um gateway.**
 *
 * ## O critério de aceite que este arquivo serve
 *
 * Integrar o décimo gateway tem de custar **um arquivo de parser + uma entrada no
 * registro**. Se aparecer um `if (plataforma === "X")` em rota, na ingestão, nas
 * métricas ou na tela, a arquitetura falhou — não importa quão limpo esteja o
 * parser.
 *
 * ---
 *
 * ## ⛔ REGRA 1 — AUSÊNCIA NÃO É ZERO
 *
 * Todo campo que o gateway **não envia** é `null`. Nunca `0`, nunca `""`.
 *
 * `taxaGateway: 0` significa "o gateway informou que não cobrou nada".
 * `taxaGateway: null` significa "não sabemos" — e as duas alimentam contas
 * diferentes em `lib/financeiro.ts`: a primeira desconta zero, a segunda cai na
 * taxa que o usuário cadastrou. Colapsar as duas em `0` faz o lucro aparecer
 * **maior que a realidade**, com o número continuando plausível.
 *
 * ---
 *
 * ## ⛔ REGRA 2 — REPROCESSAR NUNCA DEGRADA DADO JÁ RESOLVIDO
 *
 * Os campos se dividem em duas classes, e a diferença governa o que um
 * reprocessamento pode fazer:
 *
 * | Classe | Exemplos | Pode ser sobrescrito? |
 * |---|---|---|
 * | **Declarado** — veio do payload | valor, produto, e-mail, status | ✅ sim: a fonte é a mesma |
 * | **Derivado com procedência** — a Traffik inferiu | `country`/`countrySource`, `clickId`/`matchMethod` | ⛔ só se estiver vazio, ou se a fonte nova for **igual ou mais forte** |
 *
 * O caso concreto que originou a regra: `ingestSale` recalcula o país a cada
 * ingestão, e a 2ª fonte dele é o IP **de dentro do payload**. Quando a Fase A da
 * purga remover o IP dos payloads guardados, reprocessar uma venda com um parser
 * corrigido faria o país recalculado **piorar** — cairia do IP medido para o país
 * do clique (estimado) ou para o texto cru. Silenciosamente.
 *
 * **O mecanismo não é disciplina, é estrutura:** a precedência de fonte vive numa
 * tabela e entra no `WHERE` do `UPDATE`, exatamente como a força do status no
 * upsert monotônico. Quem decide é o banco. Reprocessamento com payload degradado
 * simplesmente **não passa no WHERE**.
 *
 * Vale para todo campo derivado, presente e futuro: campo novo com procedência =
 * uma entrada na tabela de precedência.
 *
 * ⚠️ A regra está declarada aqui, no contrato, mas **a tabela de precedência
 * ainda não existe** — ela é a etapa 2. Hoje o `ingestSale` tem uma versão
 * parcial e ad-hoc dela (`...(country ? {...} : {})`), que protege contra apagar
 * com `null` mas **não** contra sobrescrever com fonte mais fraca.
 *
 * ---
 *
 * ## ⛔ REGRA 3 — UM PAYLOAD PODE SER VÁRIAS VENDAS
 *
 * `parse()` devolve **sempre uma lista**, mesmo quando tem um item só. Order bump
 * e upsell existem em praticamente todo gateway do mercado, e a Cakto manda os
 * dois no mesmo disparo quando o webhook está em modo agrupado.
 *
 * Quem assume "um payload = uma venda" quebra no dia em que o primeiro bump
 * aparece — e quebra em silêncio, com faturamento certo e contagem inflada.
 */

/** Um item de uma compra: a principal, ou o que foi acrescentado a ela. */
export type TipoDeItem = "principal" | "orderbump" | "upsell";

/** Uma comissão informada pelo gateway (produtor, coprodutor, afiliado…). */
export interface Comissao {
  /** Como o gateway chama: "producer", "affiliate", "coproducer"… */
  tipo: string;
  valor: number;
  /** `null` quando o gateway manda só o valor. */
  percentual: number | null;
  /** Quem recebe, quando informado. Só para diagnóstico — nunca some na conta. */
  quem: string | null;
}

/** Os códigos de rastreamento que o gateway devolve junto da venda. */
export interface RastreamentoDaVenda {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  /** Campo livre de alguns gateways ("sck" na Cakto, "src" na Kirvano). */
  sck: string | null;
}

/**
 * Uma venda no formato interno. **Um item de compra**, não necessariamente uma
 * conversão — ver `pedidoId`.
 */
export interface VendaNormalizada {
  // ─────────────── identidade ───────────────

  /** Id da venda no gateway. Chave de idempotência do upsert monotônico. */
  externalId: string | null;

  /**
   * Agrupador do checkout: todos os itens da MESMA compra compartilham.
   *
   * ⚠️ É o que separa "faturamento" de "conversões". Um checkout com order bump
   * gera 2 linhas e 1 pedido: o faturamento soma as linhas (90 + 27 = 117), mas
   * vendas, CPA, funil e taxa de aprovação contam pedidos distintos. Contar
   * linhas derrubaria o CPA pela metade — e o número continuaria plausível.
   *
   * Gateway sem agrupador → o próprio `externalId`: cada venda é o seu pedido,
   * que é o comportamento de sempre.
   */
  pedidoId: string | null;

  itemTipo: TipoDeItem;
  /** `externalId` do item principal, quando este é bump/upsell. */
  itemPaiExternalId: string | null;

  // ─────────────── comercial ───────────────

  /** O que o comprador pagou POR ESTE ITEM. É o que vira faturamento. */
  valor: number;
  /** Antes de desconto/cupom, quando o gateway informa. Metadado — nunca somado. */
  valorBruto: number | null;
  desconto: number | null;
  moeda: string;

  produto: string;
  produtoId: string | null;
  status: SaleStatus;
  formaDePagamento: PaymentMethod;

  /**
   * Este evento significa que o comprador **chegou ao checkout**?
   *
   * ⚠️ NÃO é `status === "PENDENTE"`, e essa era a suposição que quebrava. Um
   * carrinho abandonado chegou ao checkout e não é venda pendente; um PIX gerado
   * é as duas coisas. Enquanto "gerou checkout" era inferido do status, separar
   * os dois estados apagaria o `InitiateCheckout` do funil como efeito colateral
   * invisível.
   *
   * Alimenta `webhook/checkoutEvent.ts`, que é a única via de InitiateCheckout
   * quando o checkout é hospedado pelo gateway e não dá para instalar o `px.js`.
   */
  gerouCheckout: boolean;

  // ─────────────── comprador ───────────────

  email: string | null;
  nome: string | null;
  /**
   * Telefone **como o gateway mandou**, sem normalizar.
   *
   * ⚠️ A conversão para E.164 acontece no ponto de uso (`lib/facebook/capi.ts`,
   * via `telefone.ts`), não aqui. Ela **infere o DDI por comprimento** — e
   * congelar um palpite no banco é a mesma classe de erro que congelar um país
   * inferido: quando a inferência melhorar, o dado gravado continua errado.
   */
  telefone: string | null;
  documento: string | null;

  /**
   * País **como o gateway mandou**, sem filtrar.
   *
   * ⚠️ O parser NÃO decide se é ISO-2. Quem aplica `normalizarPais()` é a
   * ingestão, num lugar só: texto livre ("Brasil", "BRA") gravado na coluna não
   * casa com nada no mapa nem no ranking e vira país fantasma, mas essa regra
   * vale igual para todos os gateways — replicá-la em cada parser é como as
   * versões divergem.
   *
   * Além disso, `normalizarPais` mora em `lib/geo/pais.ts`, que carrega a base
   * de IP de 5,7 MB. Importá-la em cada parser arrastaria o artefato para o
   * grafo de quem só quer ler um payload.
   */
  pais: string | null;

  /**
   * IP **do comprador, tirado do payload**.
   *
   * ⚠️ Jamais o IP da conexão: num webhook quem conecta é o servidor do gateway.
   * Usá-lo carimbaria toda venda com o país do datacenter dele — um país real,
   * com vendas reais, e nada denunciando o erro.
   */
  ipDoComprador: string | null;

  // ─────────────── atribuição ───────────────

  /** `click_id` público que o nosso script propagou até o checkout. */
  clickId: string | null;
  /** Cookie `_fbc` da Meta: `fb.1.<timestamp>.<fbclid>`. Contém o fbclid. */
  fbc: string | null;
  /** Cookie `_fbp` da Meta. Melhora a correspondência da CAPI; não casa clique. */
  fbp: string | null;
  utm: RastreamentoDaVenda | null;

  // ─────────────── financeiro reportado pelo gateway ───────────────

  /** Taxa do gateway JÁ CALCULADA. `null` = não informou → usa a cadastrada. */
  taxaGateway: number | null;
  /** Comissões informadas. `null` = não informou (≠ lista vazia = não houve). */
  comissoes: Comissao[] | null;
}

/** O que um parser devolve. Sempre uma lista — ver a REGRA 3. */
export interface ResultadoParse {
  vendas: VendaNormalizada[];
  /**
   * Por que nada foi extraído, quando `vendas` vem vazio.
   *
   * ⚠️ Evento não reconhecido **nunca** é descartado em silêncio: o motivo vai
   * para o `WebhookLog` e aparece na aba Testes. Um gateway que passe a mandar um
   * evento novo tem de virar uma linha visível, não um 200 vazio.
   */
  ignorado?: string;
  /** Avisos não fatais (ex.: evento desconhecido resolvido por fallback). */
  avisos?: string[];
}

// ─────────────────────────── capacidades ───────────────────────────

/**
 * O que cada gateway **consegue** entregar.
 *
 * ⛔ Isto é DADO do registro, não `if` espalhado pelo código. Um
 * `if (plataforma === "CAKTO")` na ingestão é exatamente o que faz o décimo
 * gateway custar caro.
 *
 * A tela lê estes campos para avisar antes do fato — "este gateway não informa o
 * endereço do comprador, então o país destas vendas é estimado" — em vez de o
 * usuário descobrir olhando um mapa errado.
 */
export interface Capacidades {
  /**
   * Envia o IP do comprador no payload?
   *
   * `false` faz a venda depender do país do CLIQUE — e 55,6% do tráfego humano
   * deste produto passa pelo navegador embutido do app da Meta, que resolve
   * US/IE para brasileiros. É a diferença entre geolocalização medida e estimada.
   */
  ipDoComprador: boolean;
  /** Envia `fbc`/`fbp`? O `fbc` permite casar o clique sem depender do IP. */
  fbc: boolean;
  fbp: boolean;
  /** Devolve os UTMs da venda? */
  utms: boolean;
  /** Manda a taxa do gateway já calculada, por venda? */
  taxasCalculadas: boolean;
  /** Manda coprodução/afiliados discriminados? */
  comissoes: boolean;
  /** Formato do telefone: já internacional, nacional (sem DDI), ou nenhum. */
  telefone: "e164" | "nacional" | "nenhum";
  /** Manda order bump/upsell no MESMO disparo? (muda a forma do payload) */
  agrupaItens: boolean;
  /** Reentrega o mesmo evento? Se sim, a idempotência é requisito, não luxo. */
  reentregaEventos: boolean;
}

// ─────────────────────────── autenticação ───────────────────────────

/** Onde o segredo viaja numa requisição. */
export type FonteDoSegredo =
  | { header: string }
  /** Chave no corpo JSON. Aceita caminho aninhado: `"data.secret"`. */
  | { corpo: string };

/**
 * Como provar que a requisição é mesmo do gateway.
 *
 * ⛔ Toda estratégia **falha FECHADA**: ausência de configuração nunca vira
 * permissão. É a mesma regra do `cronAuth` — e a razão é concreta: venda falsa
 * não é só número errado no painel, ela dispara `Purchase` na CAPI e envenena a
 * otimização da campanha, com dinheiro real em jogo.
 */
export type EstrategiaAuth =
  | {
      tipo: "segredo";
      /** Onde procurar, em ordem. Kirvano usa header; Cakto usa o corpo. */
      onde: FonteDoSegredo[];
      /**
       * Segredo **obrigatório**?
       *
       * `true` (todo gateway de verdade) — sem segredo cadastrado a requisição é
       * recusada com 401. É a falha fechada: o fluxo de cadastro do gateway
       * sempre entrega um segredo, então exigir não quebra integração nenhuma, e
       * não exigir deixaria quem descobrisse a URL (que circula no painel do
       * gateway, em log de proxy e no histórico do navegador) injetar venda
       * falsa.
       *
       * `false` (só a plataforma `CUSTOM`) — a própria URL é o segredo, porque
       * quem envia é um sistema do próprio usuário e não há painel onde cadastrar
       * um token. Mesmo assim, **se ele configurar um segredo, ele passa a ser
       * exigido** — senão viraria decoração.
       */
      exigir: boolean;
      /**
       * `true` = nós geramos o segredo e o usuário cola no painel do gateway
       * (Cakto). `false` = o usuário cria lá e cola aqui (Kirvano).
       */
      geradoPorNos: boolean;
    }
  | {
      /** Assinatura HMAC do corpo bruto (padrão da Stripe). Ainda não usado. */
      tipo: "hmac";
      header: string;
      algoritmo: "sha256";
    };

// ─────────────────────────── a tela ───────────────────────────

/** Um passo do "como instalar", exibido na gaveta do gateway. */
export interface PassoInstalacao {
  titulo: string;
  /** Linguagem de consequência, não de mecanismo. Sem jargão de programação. */
  texto: string;
  /** Destaca o passo (ex.: a escolha do tipo de disparo na Cakto). */
  atencao?: boolean;
}

/** Um campo que o usuário preenche ao cadastrar este gateway. */
export interface CampoDeCadastro {
  chave: "secret" | "nome";
  rotulo: string;
  ajuda?: string;
  obrigatorio: boolean;
  /** Nós geramos o valor e mostramos para copiar, em vez de pedir. */
  gerado?: boolean;
}

// ─────────────────────────── o gateway ───────────────────────────

export interface GatewayDef {
  /** Valor gravado em `Webhook.platform`. */
  id: string;
  nome: string;
  /** `false` mostra "em breve" na tela e recusa a criação. */
  ativo: boolean;

  /** URL que o usuário cola no painel do gateway. */
  urlDoWebhook(token: string, base: string): string;

  auth: EstrategiaAuth;
  parse(payload: unknown): ResultadoParse;
  capacidades: Capacidades;

  instalacao: PassoInstalacao[];
  campos: CampoDeCadastro[];
  /** Payloads da documentação, para o testador da aba Testes. */
  exemplos?: { nome: string; payload: unknown }[];
}
