import { splitPipe } from "@/lib/utm/parse";
import { utmsDaVenda, type UtmsDaVenda } from "@/lib/vendas/utmsDaVenda";

/**
 * # Atribuição de área — quem é o dono de cada linha
 *
 * ## Por que isto substituiu o filtro por interseção
 *
 * Antes, a área era um conjunto de filtros aplicados em AND no `where` do
 * Prisma: a venda aparecia na Área A se casasse com o webhook de A **e** com o
 * produto de A **e** com o escopo de conta de A. Esse modelo tem duas falhas
 * que nenhuma escolha de dimensão conserta:
 *
 * - **uma linha podia não casar com área NENHUMA** e sumir do produto inteiro;
 * - **uma linha podia casar com DUAS** e ser contada duas vezes.
 *
 * Medido no código antigo: venda sem clique, vinda de um webhook reivindicado
 * por uma área secundária, saía do escopo da secundária (inclusão descarta o
 * não atribuível) **e** do escopo da principal (que excluía aquele webhook).
 * Faturamento real, respondido com 200, invisível nas três telas.
 *
 * A pergunta certa não é "casa com os filtros de A?" — é **"de quem é esta
 * linha?"**, que sempre tem uma resposta e nunca tem duas. É o que este módulo
 * responde, e é o que garante por construção que as áreas PARTICIONEM o total.
 *
 * ## ⛔ PRECEDÊNCIA — a conta de anúncio vence tudo
 *
 * | # | Critério | Vale para |
 * |---|---|---|
 * | 1 | **Conta de anúncio**, via `Click.utmCampaign → Campaign → AdAccount` | venda, clique, evento |
 * | 2 | **Área do script de UTM** (`Click.workspaceId`) | venda, clique, evento |
 * | 3 | **Desempate por produto** (`Workspace.produtosDesempate`) | venda |
 * | 4 | **Webhook** dono (`Webhook.workspaceId`) | venda |
 * | 5 | **Credencial de API** dona | venda |
 * | 6 | **Pixel** dono (`PixelConfig.workspaceId`) | evento |
 * | 7 | **Principal** (catch-all) | tudo |
 *
 * **Por que a conta vence o webhook**, e não o contrário:
 *
 * 1. O **custo não é negociável**. O gasto da conta vai para a área dela por
 *    FK. Se a receita da mesma venda for para outra área, **as duas ficam
 *    erradas ao mesmo tempo**: uma mostra faturamento sem custo, a outra custo
 *    sem faturamento (ROI travado em −1,00x). A única regra que mantém
 *    numerador e denominador no mesmo balde é seguir o dinheiro que pagou o
 *    clique.
 * 2. O webhook é explícito sobre o **gateway**, não sobre a venda. "Este
 *    webhook é da Área A" fala de por onde o pagamento passou; "este clique
 *    veio da campanha 1202…" fala de qual tráfego pago gerou a venda — que é a
 *    pergunta que a área faz. Um gateway é compartilhável; uma campanha não.
 * 3. O erro fica **visível**. Com a conta vencendo, a venda aparece na área da
 *    campanha e o usuário corrige a configuração. Com o webhook vencendo,
 *    nasce um ROAS fantasma que nada na tela denuncia.
 *
 * ## ⚠️ Por que o script de UTM NÃO vence a conta de anúncio
 *
 * O script instalado na página declara a área (`ws` no payload do clique). Se
 * ele vencesse a conta, um anúncio da conta da Área A levando tráfego para a
 * página da Área B faria o clique contar em B **enquanto o gasto fica em A** —
 * A com gasto sem visita, B com visita sem gasto. **As duas erradas**, que é o
 * mesmo motivo pelo qual a conta vence o webhook.
 *
 * Com a conta vencendo, o script atua exatamente onde havia um buraco: o
 * tráfego **não atribuível** (orgânico, direto, outros canais), que antes caía
 * todo na Principal independentemente da página visitada.
 *
 * ⚠️ **Alcance real:** para tráfego PAGO o script não muda nada — esse já era
 * separado pela campanha. O ganho é no não atribuível.
 *
 * ## ⚠️ Por que o desempate por produto vem ANTES do webhook
 *
 * O plano original o colocava depois, como desempate de "webhook ambíguo".
 * Trocar `Workspace.webhookIds` (array) por `Webhook.workspaceId` (FK) tornou a
 * ambiguidade **estruturalmente impossível** — uma coluna não comporta dois
 * donos —, e um desempate que só agisse na ambiguidade nunca dispararia.
 *
 * O caso de borda que ele existe para resolver continua real: **um gateway com
 * URL única vendendo duas ofertas**. Aí o webhook é de A, e as vendas do
 * produto da oferta B precisam ir para B. Regra mais específica vence a mais
 * geral, que é o padrão de qualquer roteamento.
 *
 * ⚠️ **Se o produto for renomeado no gateway**, o desempate para de casar e a
 * venda cai na regra 3 — o **dono do webhook** —, não na Principal. Mandar para
 * a Principal levaria junto todas as vendas legítimas daquele webhook e
 * esvaziaria uma área que funcionava. O que impede o erro silencioso é o
 * **aviso**: a tela de áreas denuncia, em âmbar, o produto de desempate que
 * não casa com venda nenhuma há 30 dias (a mesma mecânica que
 * `checarProdutosDasAreas` já usa hoje para o filtro de produto).
 */

/** Nada de mágico: `null` nunca é usado como "sem área" — o dono final é sempre a principal. */
export interface Resolucao {
  areaId: string;
  /** Qual regra decidiu. Alimenta o diagnóstico da tela, não a métrica. */
  motivo: "conta" | "script" | "produto" | "webhook" | "credencial" | "pixel" | "principal";
}

interface AreaCfg {
  id: string;
  name: string;
  isDefault: boolean;
  archived: boolean;
  produtosDesempate: string[];
}

export interface MapaDeAreas {
  principalId: string;
  areas: AreaCfg[];
  /** Resolve a área dona de uma venda. */
  areaDaVenda(v: VendaParaAtribuir): Resolucao;
  /** Resolve a área dona de um clique. Só a conta de anúncio decide. */
  areaDoClique(c: { utmCampaign: string | null; workspaceId?: string | null }): Resolucao;
  /** Resolve a área dona de um evento de pixel. */
  areaDoEvento(e: EventoParaAtribuir): Resolucao;
  /**
   * 🔐 A área ATIVA de uma requisição, validada.
   *
   * Recebe o `?ws=` cru e devolve **sempre** um id de área que existe, é deste
   * usuário e não está arquivada — caindo na Principal quando não é. É o único
   * ponto onde a posse é verificada, e é por isso que o cliente manda só o id:
   * se mandasse as listas de filtro, bastaria forjar a querystring para montar
   * um escopo arbitrário.
   *
   * ⚠️ **Nunca devolve "sem área".** Era o `{}` do modelo antigo, que
   * significava "não filtra nada" — o buraco por onde uma rota que esquecesse o
   * `?ws=` somava as áreas em silêncio.
   */
  areaValida(workspaceId: string | null | undefined): string;
  /** Área dona de uma conta de anúncio. Sem dono ⇒ principal. */
  areaDaConta(adAccountId: string): string;
  /**
   * Contas de anúncio que pertencem a esta área.
   *
   * É o filtro do GASTO (`DailyAdMetric`), que é o único dado ancorado em conta
   * por FK. Para a área principal inclui as contas **sem dono** — ela é
   * catch-all, e conta que ninguém reivindicou precisa aparecer em algum lugar.
   */
  contasDaArea(areaId: string): string[];
  /** Conta de anúncio que um `utm_campaign` denuncia, ou `null`. */
  contaDoUtm(utmCampaign: string | null | undefined): string | null;
}

/**
 * ⚠️ Os UTMs vêm das DUAS pontas: a relação `click` é a fonte, e as colunas na
 * própria venda são a cópia gravada na ingestão. `Sale.clickId` é `SetNull`, e
 * sem a cópia apagar o clique tiraria a venda da área da campanha que a pagou —
 * mandando faturamento para a Principal sem nada denunciar. Quem escolhe entre
 * as duas é `utmsDaVenda`; espalhe `CAMPOS_UTM` nos dois `select`.
 */
export interface VendaParaAtribuir extends Partial<UtmsDaVenda> {
  product: string;
  webhookId: string | null;
  apiCredentialId?: string | null;
  /** `workspaceId` = a área que o script da página declarou (pode ser nula). */
  click: (Partial<UtmsDaVenda> & { workspaceId?: string | null }) | null;
}

export interface EventoParaAtribuir {
  pixelConfigId: string | null;
  /** O evento não guarda campanha, mas guarda `fbclid` — e o clique tem o UTM. */
  utmCampaign?: string | null;
  /** Área declarada pelo script, herdada do clique casado por `fbclid`. */
  clickWorkspaceId?: string | null;
}

/** As linhas cruas de que a precedência precisa. Ver `construirMapa`. */
export interface DadosDoMapa {
  areas: AreaCfg[];
  contas: { id: string; workspaceId: string | null }[];
  webhooks: { id: string; workspaceId: string | null }[];
  pixels: { id: string; workspaceId: string | null }[];
  credenciais: { id: string; workspaceId: string | null }[];
  campanhas: { fbCampaignId: string; name: string; adAccountId: string }[];
}

/**
 * O núcleo da precedência, **puro**: recebe linhas, devolve resolvedores.
 *
 * Separado do acesso a banco de propósito — é o que permite ao teste de
 * regressão alimentá-lo com o backup REAL de produção sem conectar em lugar
 * nenhum. Testar atribuição contra dado inventado não provaria nada: o bug de
 * 29/07 só apareceu porque 89 dos 221 cliques reais tinham `utm_campaign` nulo.
 */
export function construirMapa(d: DadosDoMapa): MapaDeAreas {
  const { areas, contas, webhooks, pixels, credenciais, campanhas } = d;

  // A principal SEMPRE existe (`garantirAreaPrincipal` roda no carregamento do
  // layout). Cair na mais antiga é rede de segurança para um usuário que
  // esteja no meio da primeira requisição.
  const principalId = areas.find((a) => a.isDefault)?.id ?? areas[0]?.id ?? "";

  const donoDaConta = new Map(contas.map((c) => [c.id, c.workspaceId]));
  const donoDoWebhook = new Map(webhooks.map((w) => [w.id, w.workspaceId]));
  const donoDoPixel = new Map(pixels.map((p) => [p.id, p.workspaceId]));
  const donoDaCredencial = new Map(credenciais.map((c) => [c.id, c.workspaceId]));

  // utm_campaign → conta de anúncio. Preferimos o ID do Facebook (`nome|id`,
  // Bloco 11) e caímos no nome para cliques gravados antes daqueles códigos.
  const contaPorFbId = new Map(campanhas.map((c) => [c.fbCampaignId, c.adAccountId]));
  const contaPorNome = new Map(campanhas.map((c) => [c.name.toLowerCase(), c.adAccountId]));

  // Produto → área que o reivindica no desempate. Se duas áreas reivindicarem o
  // mesmo nome, a mais antiga vence — determinístico, e a tela mostra o
  // conflito. Um empate silencioso seria pior que uma escolha explicada.
  const areaPorProduto = new Map<string, string>();
  for (const a of areas) {
    if (a.isDefault || a.archived) continue; // a principal não desempata: ela É o fallback
    for (const p of a.produtosDesempate) {
      const chave = p.trim().toLowerCase();
      if (chave && !areaPorProduto.has(chave)) areaPorProduto.set(chave, a.id);
    }
  }

  // Uma área arquivada não pode continuar recebendo linha: ela sumiu do
  // seletor, então o dado ficaria inalcançável. Volta para a principal.
  const ativas = new Set(areas.filter((a) => !a.archived).map((a) => a.id));
  const valida = (id: string | null | undefined): string | null =>
    id && ativas.has(id) ? id : null;

  const contaDoUtm = (utmCampaign: string | null | undefined): string | null => {
    if (!utmCampaign) return null;
    const { id, name } = splitPipe(utmCampaign);
    if (id) return contaPorFbId.get(id) ?? null;
    return name ? (contaPorNome.get(name.toLowerCase()) ?? null) : null;
  };

  const areaDaConta = (adAccountId: string): string =>
    valida(donoDaConta.get(adAccountId)) ?? principalId;

  const porConta = (utmCampaign: string | null | undefined): string | null => {
    const conta = contaDoUtm(utmCampaign);
    return conta ? valida(donoDaConta.get(conta)) : null;
  };

  return {
    principalId,
    areas,
    areaDaConta,
    contaDoUtm,
    areaValida: (id) => (id && ativas.has(id) ? id : principalId),
    contasDaArea: (areaId) => contas.filter((c) => areaDaConta(c.id) === areaId).map((c) => c.id),

    areaDaVenda(v) {
      // 1. Conta de anúncio — segue o dinheiro que pagou pelo clique.
      //    A cadeia `Sale → Click` é a fonte; a cópia na venda entra quando o
      //    clique já não existe. Ver `lib/vendas/utmsDaVenda`.
      const c = porConta(utmsDaVenda(v).utms.utmCampaign);
      if (c) return { areaId: c, motivo: "conta" };
      // 2. Área do script na página onde o comprador entrou. Vem antes do
      //    webhook porque é evidência DAQUELA compra; o webhook é uma regra do
      //    gateway inteiro. Mais específico vence.
      const s = valida(v.click?.workspaceId);
      if (s) return { areaId: s, motivo: "script" };
      // 3. Desempate por produto — regra mais específica que o gateway.
      const p = areaPorProduto.get(v.product.trim().toLowerCase());
      if (p && ativas.has(p)) return { areaId: p, motivo: "produto" };
      // 3. Webhook dono.
      const w = v.webhookId ? valida(donoDoWebhook.get(v.webhookId)) : null;
      if (w) return { areaId: w, motivo: "webhook" };
      // 4. Credencial de API — o equivalente do webhook na ingestão genérica.
      const k = v.apiCredentialId ? valida(donoDaCredencial.get(v.apiCredentialId)) : null;
      if (k) return { areaId: k, motivo: "credencial" };
      // 5. Catch-all. NUNCA se perde: toda venda tem dono.
      return { areaId: principalId, motivo: "principal" };
    },

    areaDoClique(c) {
      const a = porConta(c.utmCampaign);
      if (a) return { areaId: a, motivo: "conta" };
      const s = valida(c.workspaceId);
      if (s) return { areaId: s, motivo: "script" };
      return { areaId: principalId, motivo: "principal" };
    },

    areaDoEvento(e) {
      // Mesma ordem da venda: a conta vence o pixel, para o funil ficar na
      // mesma área do gasto que o produziu.
      const c = porConta(e.utmCampaign);
      if (c) return { areaId: c, motivo: "conta" };
      const s = valida(e.clickWorkspaceId);
      if (s) return { areaId: s, motivo: "script" };
      const p = e.pixelConfigId ? valida(donoDoPixel.get(e.pixelConfigId)) : null;
      if (p) return { areaId: p, motivo: "pixel" };
      return { areaId: principalId, motivo: "principal" };
    },
  };
}

/**
 * Esta despesa entra no cálculo desta área?
 *
 * ### 🔴 ELA E O `whereDespesasDaArea` DISCORDAVAM, E O COMENTÁRIO OS CHAMAVA DE EQUIVALENTES
 *
 * Medido em 14/08/2026, e corrigido no mesmo dia:
 *
 * ```
 * despesaVale({ workspaceId: null }, "A")  ->  false   <- a nula NÃO entrava
 * whereDespesasDaArea("A")                 ->  OR [ null, "A" ]   <- a nula ENTRA
 * ```
 *
 * As duas respondem **a mesma pergunta**, uma em memória e a outra como `where`
 * do Prisma, e o comentário da segunda dizia — literalmente — que era o
 * *"`where` equivalente ao `despesaVale`"*.
 *
 * ### 🔎 A PROCEDÊNCIA — as duas estavam certas no dia em que nasceram
 *
 * | | commit | data | semântica |
 * |---|---|---|---|
 * | esta função | `8b9b162` | **30/07** | nulo não vale — *"cada área com as suas próprias taxas"* |
 * | o `where` | `3be5d39` | **04/08** | nulo vale para todas — e o commit se chama *"DESPESA QUE NAO ERA DESCONTADA"* |
 *
 * A de 04/08 foi escrita **para consertar** o comportamento estrito: taxa de
 * gateway e imposto nascem GLOBAIS (o formulário não os prende a área nenhuma),
 * então o filtro estrito descartava TODA despesa cadastrada do cálculo de
 * lucro. Reproduzido na época: cinco descontos cadastrados, painel mostrando
 * `Taxas de gateway − R$ 0,00`.
 *
 * ⛔ **Esta função ficou para trás com a semântica revogada, e o que a tornava
 * inofensiva era não ter consumidor — ou seja, um acidente.** Hoje ela devolve
 * a mesma resposta que a consulta, e o `whereDespesasDaArea` volta a ser
 * honestamente equivalente a ela.
 *
 * ⚠️ **Nenhum comportamento mudou nesta correção**, e isso é verificável:
 * `despesaVale` tinha zero chamadores de produção quando foi alinhada
 * (`test:despesa-vale` mede a contagem a cada execução).
 *
 * ### 🔴 E O RISCO QUE A SEMÂNTICA ESTRITA EVITAVA CONTINUA REAL
 *
 * Uma área sem taxa de gateway ou sem imposto cadastrado calcula lucro **sem
 * eles** — número maior que a realidade, e plausível. A mitigação é a tela
 * avisar (`faltamTaxas`), transformando erro silencioso em erro visível.
 *
 * ⚠️ **E o aviso já saiu uma vez:** ele perdeu o último consumidor em `9608704`
 * (12/08), quando a reescrita de Taxas deletou a `FeesView`, e ficou dois dias
 * e meio sem ninguém. Foi religado em 14/08 no construtor de alertas do
 * Dashboard, com o par dispara/não-dispara em `test:alertas` §6b/§6c.
 */
export function despesaVale(despesa: { workspaceId: string | null }, areaId: string): boolean {
  /* 🔴 NULO = vale para TODAS as áreas. É uma das DUAS linhas vermelhas da
     tabela de nulos do `CLAUDE.md` (a outra é `AutomationRule.workspaceId`):
     aqui nulo não significa "sem dono", significa GLOBAL. Trocar este `||` por
     um `===` não restringe um filtro — apaga toda despesa global do cálculo. */
  return despesa.workspaceId === areaId || despesa.workspaceId === null;
}

/**
 * `where` do Prisma equivalente ao `despesaVale`, para filtrar na consulta.
 *
 * ⚠️ A palavra **equivalente** aqui já foi falsa (ver o cabeçalho do
 * `despesaVale`). `test:despesa-vale` a mantém verdadeira: ele avalia as duas
 * sobre o mesmo universo e exige que concordem em TODAS as entradas.
 */
export function whereDespesasDaArea(areaId: string) {
  /**
   * 🔴 `workspaceId` NULO = vale para TODAS as áreas — e por isso ENTRA aqui.
   *
   * Devolvia `{ workspaceId: areaId }` seco, que **descarta as nulas**. Taxa de
   * gateway e imposto nascem globais (o formulário não os prende a área
   * nenhuma), então na prática TODA despesa cadastrada era ignorada no cálculo
   * de lucro — e o lucro aparecia maior que a realidade, com número plausível.
   *
   * Reproduzido em 05/08/2026: cinco descontos cadastrados, painel mostrando
   * `Taxas de gateway − R$ 0,00` para todos.
   *
   * ⚠️ Este é o mesmo `OR` do catch-all de venda e evento — e aqui ele é ainda
   * mais obrigatório, porque em `Expense` o NULO não significa "sem dono", e sim
   * "vale para todo mundo". É a exceção que o CLAUDE.md registra.
   */
  return { OR: [{ workspaceId: null }, { workspaceId: areaId }] };
}
