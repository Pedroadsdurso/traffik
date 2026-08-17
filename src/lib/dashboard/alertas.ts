import type { Alerta } from "@/components/tk/AlertList";
import { faltamTaxas } from "@/lib/areas/taxas";
import { donosCorrompidos } from "@/lib/pixel/donos";
import { detalheDoToken, estadoDoToken, rotuloDoToken, tokenPedeAtencao } from "@/lib/integracoes/token";

/**
 * O CONSTRUTOR DOS ALERTAS DO DASHBOARD — extraído do `useMemo` em 14/08/2026.
 *
 * 🔴 POR QUE ELE SAIU DO COMPONENTE
 *
 * Ele vivia dentro de `React.useMemo` em `dadosDosBlocos.tsx`, e por isso
 * **nenhum dos cinco alertas tinha uma asserção**. Medido: `grep` por
 * `dadosDosBlocos`, `gasto-sem-conversao` e `roi-caiu` em `scripts/teste-*.mjs`
 * devolvia **zero arquivos**.
 *
 * É a mesma razão que tirou a `composicaoDoNoDeICs` da IIFE do
 * `catalogoRender` e o preset do pixel de dentro do `.tsx`:
 *
 * > ## Proteção que mora dentro de um componente é proteção que nenhum teste alcança.
 *
 * ⛔ **A EXTRAÇÃO É UM MOVE.** Nem uma linha do que se calcula mudou — o `git
 * diff` do commit mostra o corpo saindo do `useMemo` e entrando aqui, idêntico.
 * O que prova que nenhum alerta sumiu é `test:alertas`, que exercita os cinco
 * ids originais.
 *
 * ⚠️ A entrada é um objeto de campos JÁ DERIVADOS, não a `TraffikView` inteira.
 * Passar a view toda traria o monolito para dentro de um módulo puro e o
 * tornaria intestável de novo — que é o defeito que a extração desfaz.
 */
export interface EntradaDeAlertas {
  fbConnected: boolean;
  perfisCrus: readonly { id: string; name: string; tokenExpiresAt: Date | string | null }[];
  adProfiles: readonly {
    accounts?: readonly { id: string; name: string; erroSync?: { tom: string; mensagem: string; acao?: string | null } | null }[];
  }[] | null;
  /** O KPI de ROI já formatado, com o delta. `null` = a métrica não compara. */
  roi: { value: string; delta: number | null } | null;
  chartSerie: { spend: readonly number[]; revenue: readonly number[] };
  /** Instante de referência — NUNCA `Date.now()` aqui dentro. Ver a nota. */
  agora: number;
  /** Formatador de moeda, injetado para o módulo não depender de locale. */
  brl: (n: number) => string;
  /**
   * 🔴 OS `eventOwners` ILEGÍVEIS, por pixel — ligados em 14/08/2026.
   *
   * A corrupção cai no PADRÃO (para `Purchase`, `traffik`), ou seja **religa o
   * envio de um evento que o usuário desligou** e a contagem dobrada na Meta
   * volta. A direção não muda — falhar fechado apagaria conversão real —, mas
   * o silêncio acaba aqui.
   */
  pixels?: readonly { id: string; name: string; donosCorrompidos: readonly { chave: string; bruto: string; assumido: string }[] }[];
  /**
   * 🔴 OS TIPOS DE DESCONTO **ATIVOS** DA ÁREA — religados em 14/08/2026.
   *
   * `faltamTaxas` existia desde `8b9b162` (30/07) e perdeu o último consumidor
   * em `9608704` (12/08), quando a reescrita de Taxas deletou a `FeesView`.
   * Ficou **dois dias e meio sem ninguém**, e o `precedencia.ts` a documenta
   * como *A* mitigação de um risco que ele pinta de vermelho:
   *
   * > uma área sem taxa de gateway ou sem imposto cadastrado calcula lucro
   * > **sem eles** — número maior que a realidade, e plausível. […] **Se o
   * > aviso sair, o risco volta inteiro.**
   *
   * ⛔ **`active` é filtrado por quem monta esta lista, e não é detalhe.**
   * `metrics.ts` desconta apenas `active: true`, e `listExpenses` devolve as
   * inativas junto. Contá-las aqui faria uma taxa DESLIGADA calar o aviso sem
   * ser descontada — o defeito exato que o aviso existe para impedir, agora
   * disfarçado de configuração completa.
   *
   * ⚠️ E o recorte por área não é feito aqui porque já veio: `listExpenses`
   * aplica a MESMA `whereDespesas` que o `metrics.ts` usa no lucro. Refiltrar
   * criaria a segunda implementação do mesmo filtro, que é a família que esta
   * base já pagou com o lucro descontando `R$ 0,00`.
   */
  tiposDeDespesa?: readonly string[];
  /**
   * 🔴 OS PADRÕES DE HOST APROVADOS — o bloqueio que não tinha como sair.
   *
   * Um padrão aprovado (`eventos:marcar --aplicar`) faz o evento ser tratado
   * como TESTE **na ingestão**: ele não vai para a CAPI, e não volta.
   * `lib/pixel/ambiente.ts` declara, no próprio módulo, que por isso a lista
   * precisa ser removível — *"irreversível é exatamente o que ela não pode
   * ser"*.
   *
   * ⛔ **E não era.** `removerPadraoDeTeste` é o único escritor de
   * `User.testHostPatterns` na base, e ficou órfã quando a tela de
   * `Integrações › Testes` foi deletada. O remédio existia e não tinha porta.
   *
   * ⚠️ **Por que ALERTA e não uma tela nova:** alerta aqui é *o que pede
   * decisão*, e uma regra de bloqueio permanente é exatamente isso. Uma tela
   * nova custaria uma sessão e deixaria o buraco aberto até lá.
   *
   * ⚠️ **Por que UM POR PADRÃO**, contra o costume de consolidar do `donos-` e
   * do `faltam-taxas`: lá o alerta pede UMA revisão; aqui cada padrão tem a
   * própria remoção. Consolidar daria um alerta com N botões — e um botão só
   * removeria o quê? É a mesma forma do `token-<id>` e do `conta-<id>`, que já
   * são um por entidade.
   */
  padroesDeTeste?: readonly { padrao: string; criadoEm: string | null }[];
  /**
   * ⚠️ Injetada pela TELA, como o `brl` acima — este módulo é puro e não conhece
   * server action. Sem ela o alerta ainda ANUNCIA o bloqueio; o que ele perde é
   * a única porta de saída, e aí volta a ser o estado que ele existe para
   * denunciar. Há asserção do par.
   */
  aoRemoverPadrao?: (padrao: string) => void | Promise<void>;
}

/**
 * ⛔ `agora` ENTRA POR PARÂMETRO, e não é zelo: `Date.now()` dentro de um
 * componente que renderiza no servidor produz HTML diferente do da hidratação,
 * e o React **aborta a árvore inteira**. É a regra do `elapsed()` desta base —
 * lá o efeito visível não foi texto errado, foi a navegação parar de funcionar.
 */
export function montarAlertas(e: EntradaDeAlertas): Alerta[] {
  const lista: Alerta[] = [];

  if (!e.fbConnected) {
    lista.push({
      id: "sem-conta",
      severidade: "warning",
      titulo: "Nenhuma conta de anúncio conectada",
      detalhe: "Sem ela não há gasto, ROAS nem ROI.",
      href: "/dashboard/integracoes/anuncios",
    });
  }

  /* ── TOKEN DA META EXPIRANDO ───────────────────────────────────────────
     🔴 É a falha mais cara que esta ferramenta tem, e ela é MUDA: o token
     vence, a sincronização para, o gasto congela — e o ROAS passa a mentir
     por omissão enquanto o motor de regras decide com dado velho.

     ⛔ A conta NÃO é feita aqui. `lib/integracoes/token.ts` é a fonte única, e
     a tela de Integrações usa exatamente as mesmas funções.

     ⚠️ `desconhecido` ENTRA na lista, e é o caso mais perigoso: são os perfis
     conectados antes de a coluna existir — os mais antigos, logo os mais
     prováveis de já estarem vencidos. */
  for (const p of e.perfisCrus) {
    const t = estadoDoToken(p.tokenExpiresAt, new Date(e.agora));
    if (!tokenPedeAtencao(t)) continue;
    lista.push({
      id: `token-${p.id}`,
      severidade: t.tipo === "expira" ? "warning" : "danger",
      titulo: `${p.name}: ${rotuloDoToken(t)}`,
      detalhe: detalheDoToken(t) ?? undefined,
      href: "/dashboard/integracoes",
    });
  }

  /* `erroSync` já vem TRADUZIDO pelo `erroMeta.ts` — mensagem em linguagem de
     consequência, ação sugerida e um `tom` que diz se é erro ou aviso. Usar o
     tom dele em vez de marcar tudo como crítico é o que impede o painel de
     encher de vermelho por rate limit, que passa sozinho. */
  for (const p of e.adProfiles ?? []) {
    for (const c of p.accounts ?? []) {
      if (!c.erroSync) continue;
      lista.push({
        id: `conta-${c.id}`,
        severidade: c.erroSync.tom === "erro" ? "danger" : "warning",
        titulo: `${c.name}: ${c.erroSync.mensagem}`,
        detalhe: c.erroSync.acao ?? undefined,
        href: "/dashboard/integracoes/anuncios",
      });
    }
  }

  const roi = e.roi;
  if (roi?.delta != null && roi.delta < -20) {
    lista.push({
      id: "roi-caiu",
      severidade: "warning",
      titulo: "ROI caiu mais de 20% no período",
      detalhe: `Agora em ${roi.value}.`,
    });
  }

  /* Gasto sem conversão: há gasto na série e nenhuma venda. É o alerta que
     mais custa dinheiro, e ele só é possível porque as duas séries vivem no
     mesmo objeto. */
  const gastoTotal = e.chartSerie.spend.reduce((s, n) => s + n, 0);
  const receitaTotal = e.chartSerie.revenue.reduce((s, n) => s + n, 0);
  if (gastoTotal > 0 && receitaTotal === 0) {
    lista.push({
      id: "gasto-sem-conversao",
      severidade: "danger",
      titulo: "Gasto sem nenhuma conversão",
      detalhe: `${e.brl(gastoTotal)} investidos e nenhuma venda atribuída no período.`,
    });
  }

  /* ── 🔴 CUSTOS NÃO CADASTRADOS — o aviso que tinha sumido ───────────────
     Ele não denuncia um erro: denuncia uma AUSÊNCIA que faz o número mentir
     para cima. Sem a taxa do gateway, o Lucro do painel é maior do que o
     dinheiro que entrou na conta — e nada na tela sugere que falta algo.

     ⛔ O PORTÃO É A RECEITA, e não "tem despesa cadastrada?". Os quatro
     descontos incidem sobre venda: sem faturamento no período eles valeriam
     zero, e o Lucro não está inflado por nada. Alertar ali seria gritar em
     toda conta nova — é o mesmo raciocínio do `gasto-sem-conversao`, que exige
     `gastoTotal > 0`, e da regra desta base de que alarme sem motivo envenena
     o único sinal que existe.

     ⛔ E é UM alerta com a lista dentro, não um por tipo: quatro linhas quase
     iguais afogariam os outros, exatamente como no `donos-`. */
  if (e.tiposDeDespesa) {
    /* `receitaTotal` é a MESMA soma que o `gasto-sem-conversao` usa, logo
       acima — reduzir de novo criaria duas contas do mesmo número no mesmo
       arquivo, que é literalmente a família que esta sessão passou o dia
       medindo. */
    const faltando = faltamTaxas([...e.tiposDeDespesa]);
    if (faltando.length > 0 && receitaTotal > 0) {
      lista.push({
        id: "faltam-taxas",
        severidade: "warning",
        titulo:
          faltando.length === 1
            ? `Falta cadastrar ${faltando[0]} nesta área`
            : `Faltam ${faltando.length} custos cadastrados nesta área`,
        detalhe: `Sem ${faltando.join(", ")}, o Lucro aparece maior do que é.`,
        href: "/dashboard/taxas",
      });
    }
  }

  /* ── 🔴 DONO DE EVENTO ILEGÍVEL — o alerta que faltava ──────────────────
     A escolha do usuário sobre QUEM envia o evento à Meta se perdeu, e a
     ferramenta assumiu o padrão. Para `Purchase` o padrão é a Trackhub — ou
     seja, o envio foi RELIGADO e a Meta pode voltar a contar em dobro.

     ⛔ Um por PIXEL, não um por entrada corrompida: cinco chaves ilegíveis no
     mesmo pixel são um problema só, e cinco linhas iguais no painel afogariam
     os outros alertas. O detalhe nomeia cada evento e o dono assumido. */
  for (const px of e.pixels ?? []) {
    if (!px.donosCorrompidos.length) continue;
    const partes = px.donosCorrompidos.map((d) => `${d.chave} → ${d.assumido}`);
    lista.push({
      id: `donos-${px.id}`,
      severidade: "warning",
      titulo: `${px.name}: configuração de eventos ilegível`,
      detalhe: `A ferramenta assumiu: ${partes.join(" · ")}. Reveja quem envia cada evento — se dois lados enviarem o mesmo, a Meta conta em dobro.`,
      href: "/dashboard/integracoes/pixel",
    });
  }

  /* ── 🔴 PADRÃO DE HOST APROVADO — bloqueio irreversível, e a porta de saída ─
     O padrão faz o evento ser tratado como TESTE na ingestão: ele não vai para
     a CAPI e não volta. Enquanto não houver tela de Testes, ESTE alerta é o
     único lugar do produto onde o padrão pode ser visto e removido.

     ⛔ NÃO é `danger`: o usuário aprovou isto de propósito, e pintar de
     vermelho a própria escolha dele é o alarme que grita sem motivo. O que o
     alerta acrescenta é a CONSEQUÊNCIA e a saída — não um juízo.

     ⚠️ E ele não some sozinho: some quando o padrão for removido, ou no dia em
     que uma tela listar os padrões e este bloco puder sair daqui. */
  for (const p of e.padroesDeTeste ?? []) {
    lista.push({
      id: `padrao-teste-${p.padrao}`,
      severidade: "warning",
      titulo: `Bloqueio de teste ativo: ${p.padrao}`,
      detalhe:
        "Eventos de hosts com este desenho não são enviados à Meta, e não voltam. Se algum for um site de verdade, a venda dele não conta.",
      /* ⛔ Sem `href` DE PROPÓSITO: não existe tela que resolva isto. Apontar
         para uma que não resolve seria affordance mentindo — a regra que matou
         a interação do globo. */
      acao: e.aoRemoverPadrao
        ? { rotulo: "Remover", aoAcionar: () => e.aoRemoverPadrao!(p.padrao) }
        : undefined,
    });
  }

  return lista;
}

/** Reexportado para quem monta a entrada a partir do bruto do banco. */
export { donosCorrompidos, faltamTaxas };
