import type { Alerta } from "@/components/tk/AlertList";
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

  return lista;
}

/** Reexportado para quem monta a entrada a partir do bruto do banco. */
export { donosCorrompidos };
