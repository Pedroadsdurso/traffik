"use client";

import { plural } from "@/lib/format";
import { useMemo, useState } from "react";

import { combinaStatus, estaArquivado } from "@/lib/ads/status";
import { sx } from "@/lib/sx";
import { FiltroPeriodo } from "../ui/FiltroPeriodo";
import { Icone, type NomeIcone } from "../ui/Icone";
import { Select } from "../ui/Select";
import { AdsActionBar, type Acao, type AlvoSelecionado, type Nivel } from "./ads/AdsActionBar";
import { AdsTable, type LinhaTabela } from "./ads/AdsTable";
import { NovaCampanhaModal } from "./ads/NovaCampanhaModal";
import type { TraffikView } from "../useTraffikState";

// ⚠️ `icone` guarda um NOME do mapa de `ui/Icone`, não um `path` de SVG. Era um
// `path` em string, que é a forma pela qual a divergência de ícones volta: parece
// dado de configuração e escapa da padronização de tamanho e traço.
type Aba = "campaigns" | "adsets" | "ads" | "accounts";

const ABAS: { key: Aba; label: string; icone: NomeIcone; nivel: Nivel | null }[] = [
  { key: "accounts", label: "Contas", icone: "contas", nivel: null },
  { key: "campaigns", label: "Campanhas", icone: "relatorio", nivel: "campaign" },
  { key: "adsets", label: "Conjuntos", icone: "conjuntos", nivel: "adset" },
  { key: "ads", label: "Anúncios", icone: "anuncios", nivel: "ad" },
];

/** Link direto para a entidade no Gerenciador de Anúncios do Facebook. */
function urlFacebook(nivel: Nivel, fbId: string, contaFb: string | null): string {
  const act = contaFb ? `act_${contaFb.replace(/^act_/, "")}` : "";
  const base = "https://adsmanager.facebook.com/adsmanager/manage";
  if (nivel === "campaign") return `${base}/campaigns?act=${act}&selected_campaign_ids=${fbId}`;
  if (nivel === "adset") return `${base}/adsets?act=${act}&selected_adset_ids=${fbId}`;
  return `${base}/ads?act=${act}&selected_ad_ids=${fbId}`;
}

/** Ordem hierárquica. O que é marcado num nível filtra os de baixo. */
const ORDEM: Aba[] = ["accounts", "campaigns", "adsets", "ads"];

export function AdsManagerView({ v }: { v: TraffikView }) {
  /**
   * 🔗 MARCADOS POR NÍVEL — uma estrutura só, não duas.
   *
   * O `contasFiltro` que existia aqui era exatamente isto para um nível só:
   * reaproveitava o checkbox da tabela (que na aba Contas não tinha função,
   * porque não há ação em massa para conta) como filtro das abas de baixo.
   *
   * ⚠️ **Isto é a GENERALIZAÇÃO daquilo, não um segundo mecanismo.** Um filtro
   * de campanha paralelo ao de conta divergiria do primeiro — foi assim que a
   * contagem das abas e o filtro da tabela já divergiram uma vez, mostrando
   * "12 campanhas" com a tabela vazia.
   *
   * O que está marcado num nível é, ao mesmo tempo, a **seleção para ação em
   * massa** naquela aba e o **filtro** das abas abaixo dela. São a mesma
   * intenção do usuário ("estou trabalhando nestas"), então são o mesmo dado.
   */
  const [marcados, setMarcados] = useState<Record<Aba, Set<string>>>({
    accounts: new Set(), campaigns: new Set(), adsets: new Set(), ads: new Set(),
  });
  /** O que está marcado na aba ATUAL — é a seleção de ação em massa. */
  const selecao = marcados[v.adsSub];
  const marcar = (aba: Aba, muda: (s: Set<string>) => Set<string>) =>
    setMarcados((m) => ({ ...m, [aba]: muda(m[aba]) }));
  const [fixadas, setFixadas] = useState<Set<string>>(new Set());
  const [ordemGasto, setOrdemGasto] = useState<"desc" | "asc">("desc");
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const abaAtual = ABAS.find((a) => a.key === v.adsSub) ?? ABAS[1]!;
  const nivel = abaAtual.nivel;
  const raw = v.adsRaw;

  /** Linhas do nível ativo, já filtradas e ordenadas por gasto. */
  const linhas: LinhaTabela[] = useMemo(() => {
    if (!raw) return [];
    // Mesmo filtro do servidor (`lib/ads/status.ts`) — era duplicado aqui com
    // a lógica antiga, e como esta cópia refiltra o que o servidor já mandou,
    // corrigir só o servidor não mudava nada na tela.
    const filtra = (nome: string, status: string) =>
      nome.toLowerCase().includes(v.adsSearch.toLowerCase()) && combinaStatus(status, v.adsStatus);
    // Conjunto vazio = visão consolidada. Só filtra quando há conta marcada.
    // Interseção, nunca substituição: vazio em qualquer nível = "todos".
    const daConta = (accountId: string) => !marcados.accounts.size || marcados.accounts.has(accountId);
    const daCampanha = (campaignId: string) => !marcados.campaigns.size || marcados.campaigns.has(campaignId);
    const doConjunto = (adSetId: string) => !marcados.adsets.size || marcados.adsets.has(adSetId);

    let base: LinhaTabela[] = [];
    if (v.adsSub === "campaigns") {
      base = raw.campaigns.filter((c) => filtra(c.name, c.status) && daConta(c.accountId)).map((c) => ({
        id: c.id, fbId: c.fbId, nome: c.name, status: c.status, effectiveStatus: c.effectiveStatus,
        // Orçamento na campanha ⇒ CBO. É o que o modal de orçamento lê.
        sub: c.dailyBudget != null ? "CBO · orçamento na campanha" : "ABO · orçamento nos conjuntos",
        orcamento: c.dailyBudget,
        // CBO edita na campanha; ABO não (o orçamento vive nos conjuntos).
        orcamentoEditavel: c.dailyBudget != null,
        spend: c.spend, impressions: c.impressions,
        clicks: c.clicks, results: c.results, revenue: c.revenue,
        ic: c.ic, cliquesAtribuidos: c.cliquesAtribuidos, vendasIniciadas: c.vendasIniciadas,
      }));
    } else if (v.adsSub === "adsets") {
      base = raw.adSets.filter((a) => filtra(a.name, a.status) && daConta(a.accountId) && daCampanha(a.campaignId)).map((a) => ({
        id: a.id, fbId: a.fbId, nome: a.name, status: a.status, effectiveStatus: a.effectiveStatus,
        sub: a.campaignName,
        orcamento: a.dailyBudget, bidCap: a.bidAmount,
        // Conjunto só edita orçamento quando a campanha-mãe é ABO.
        orcamentoEditavel: raw.campaigns.find((c) => c.id === a.campaignId)?.dailyBudget == null,
        spend: a.spend,
        impressions: a.impressions, clicks: a.clicks, results: a.results, revenue: a.revenue,
        ic: a.ic, cliquesAtribuidos: a.cliquesAtribuidos, vendasIniciadas: a.vendasIniciadas,
      }));
    } else if (v.adsSub === "ads") {
      base = raw.ads
        .filter((a) => filtra(a.name, a.status) && daConta(a.accountId) && daCampanha(a.campaignId) && doConjunto(a.adSetId))
        .map((a) => ({
        id: a.id, fbId: a.fbId, nome: a.name, status: a.status, effectiveStatus: a.effectiveStatus,
        sub: a.campaignName,
        spend: a.spend, impressions: a.impressions, clicks: a.clicks,
        results: a.results, revenue: a.revenue,
        ic: a.ic, cliquesAtribuidos: a.cliquesAtribuidos, vendasIniciadas: a.vendasIniciadas,
      }));
    } else {
      // ⚠️ Conta NÃO leva `effectiveStatus` — e a ausência é significativa, não
      // esquecimento. Aqui o toggle é "rastreando na Traffik", não entrega da
      // Meta: quem veicula é campanha, conjunto e anúncio. A célula de
      // Veiculação mostra "—" seco, sem falar em sincronização pendente.
      base = raw.accounts.map((ac) => ({
        id: ac.id, fbId: ac.fbAccountId, nome: ac.name,
        status: ac.tracking ? "ACTIVE" : "PAUSED",
        sub: `${ac.fbAccountId} · ${plural(ac.campaigns, "campanha", "campanhas")}`,
        spend: ac.spend, impressions: 0, clicks: 0, results: 0, revenue: ac.revenue,
      }));
    }
    return base.sort((a, b) => (ordemGasto === "desc" ? b.spend - a.spend : a.spend - b.spend));
  }, [raw, v.adsSub, v.adsSearch, v.adsStatus, ordemGasto, marcados]);

  /**
   * Contagem da aba respeitando o filtro ativo. Usava `length` do array cru, o
   * que mostraria "12 campanhas" com a tabela vazia depois que "Todos os
   * status" passou a esconder arquivadas.
   */
  /**
   * O que dizer quando a tabela está vazia.
   *
   * 🔴 O estado vazio era MUDO: "Nenhuma campanha neste período", sempre. Com
   * uma conta cujos objetos foram todos arquivados no Facebook, as três abas
   * ficavam vazias e **nada dizia que havia 12 itens escondidos pelo filtro** —
   * porque "Todos os status" exclui arquivados de propósito.
   *
   * ⚠️ Esconder é certo (no Gerenciador do Facebook "excluir" apenas arquiva, e
   * sem o filtro a lista enche do que o usuário já apagou). Esconder **sem
   * dizer** é que estava errado: o usuário via vazio e concluía que o sync
   * falhou.
   */
  const mensagemVazio = (() => {
    if (v.adsSub === "accounts") return "Nenhuma conta conectada. Conecte um perfil em Integrações › Anúncios.";
    const rows: { name: string; status: string; accountId?: string }[] =
      v.adsSub === "adsets" ? (raw?.adSets ?? []) : v.adsSub === "ads" ? (raw?.ads ?? []) : (raw?.campaigns ?? []);
    const nome = v.adsSub === "adsets" ? "conjunto" : v.adsSub === "ads" ? "anúncio" : "campanha";
    // Só os que o filtro de STATUS derrubou — busca e conta continuam valendo.
    const escondidos = rows.filter(
      (r) =>
        estaArquivado(r.status) &&
        r.name.toLowerCase().includes(v.adsSearch.toLowerCase()) &&
        (marcados.accounts.size === 0 || !r.accountId || marcados.accounts.has(r.accountId)),
    ).length;

    if (escondidos > 0 && v.adsStatus !== "arquivado") {
      return `Nenhum ${nome} ativo neste período — mas ${plural(escondidos, `${nome} arquivado`, `${nome}s arquivados`)} não ${escondidos === 1 ? "aparece" : "aparecem"} com este filtro. Troque o status para "Arquivados" para ver.`;
    }
    if (v.adsSearch.trim()) return `Nenhum ${nome} com esse nome. Limpe a busca para ver todos.`;
    // O drill-down também esvazia a tabela, e sem dizer isso o usuário procura
    // dado faltando em vez de olhar a seleção que ele mesmo fez numa aba acima.
    // ⚠️ Vem DEPOIS do aviso de arquivados: aquele é o surpreendente (ninguém
    // pediu por ele); este explica uma escolha do próprio usuário.
    if (ORDEM.slice(0, ORDEM.indexOf(v.adsSub)).some((a) => marcados[a].size > 0)) {
      return `Nenhum ${nome} pertence ao que está selecionado nas abas acima. Limpe a seleção para ver todos.`;
    }
    return `Nenhum ${nome} neste período. Tente outro intervalo ou outro status.`;
  })();

  /**
   * ⚠️ A contagem da aba usa EXATAMENTE os mesmos filtros das linhas. Ela já
   * divergiu uma vez (mostrava "12 campanhas" com a tabela vazia), e com o
   * drill-down a chance de divergir dobra: um filtro novo aplicado só nas
   * linhas produziria a mesma mentira de novo.
   */
  const contar = (rows?: { name: string; status: string; accountId?: string; campaignId?: string; adSetId?: string }[]) =>
    (rows ?? []).filter(
      (r) =>
        combinaStatus(r.status, v.adsStatus) &&
        r.name.toLowerCase().includes(v.adsSearch.toLowerCase()) &&
        (!marcados.accounts.size || !r.accountId || marcados.accounts.has(r.accountId)) &&
        (!marcados.campaigns.size || !r.campaignId || marcados.campaigns.has(r.campaignId)) &&
        (!marcados.adsets.size || !r.adSetId || marcados.adsets.has(r.adSetId)),
    ).length;

  const selecionados: AlvoSelecionado[] = linhas
    .filter((l) => selecao.has(l.id))
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      cbo: v.adsSub === "campaigns" ? l.orcamento != null : undefined,
      campanha: l.sub,
    }));

  // O checkbox escreve sempre no nível da aba atual. Em Contas isso é só
  // filtro; nas demais é filtro E seleção de ação em massa — a mesma marcação.
  function alternar(id: string) {
    marcar(v.adsSub, (s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodas() {
    marcar(v.adsSub, (s) => (s.size === linhas.length ? new Set() : new Set(linhas.map((l) => l.id))));
  }

  async function executar(acao: Acao, valor?: number, ativar?: boolean) {
    if (!nivel) return;
    setBusy(true);
    setResultado(null);
    try {
      const res = await fetch("/api/ads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nivel, acao, ids: [...selecao], valor, ativar }),
      });
      const data = (await res.json()) as {
        error?: string; sucessos?: number;
        resultados?: { nome: string; ok: boolean; erro?: string }[];
      };
      if (data.error) {
        setResultado(`✗ ${data.error}`);
      } else {
        const falhas = data.resultados?.filter((r) => !r.ok) ?? [];
        setResultado(
          falhas.length === 0
            ? `✓ ${data.sucessos} item(ns) atualizados no Facebook.`
            : `${data.sucessos} ok · ${plural(falhas.length, "falhou", "falharam")}: ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`,
        );
        // Limpa só o nível em que a ação foi feita — a marcação das abas
        // acima é o filtro que trouxe estas linhas, e apagá-la junto tiraria o
        // usuário do contexto em que ele estava trabalhando.
        marcar(v.adsSub, () => new Set());
        v.refreshAds();
      }
    } catch (e) {
      setResultado(`✗ ${e instanceof Error ? e.message : "Falha de rede."}`);
    } finally {
      setBusy(false);
    }
  }

  /** Edição inline do orçamento — mesma rota das ações em massa, com 1 id. */
  async function salvarOrcamento(id: string, valor: number) {
    if (!nivel) return;
    const res = await fetch("/api/ads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nivel, acao: "budget", ids: [id], valor }),
    });
    const data = (await res.json()) as { error?: string; resultados?: { ok: boolean; erro?: string }[] };
    const falha = data.error ?? data.resultados?.find((r) => !r.ok)?.erro;
    setResultado(falha ? `✗ ${falha}` : "✓ Orçamento atualizado no Facebook.");
    v.refreshAds();
  }

  function fixar() {
    setFixadas((f) => {
      const n = new Set(f);
      for (const id of selecao) {
        if (n.has(id)) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }
  function copiarId() {
    const ids = linhas.filter((l) => selecao.has(l.id)).map((l) => l.fbId);
    navigator.clipboard.writeText(ids.join("\n"));
    setResultado(`✓ ${plural(ids.length, "ID copiado", "IDs copiados")}`);
  }
  function abrirNoFacebook() {
    const l = linhas.find((x) => selecao.has(x.id));
    if (!l || !nivel || !raw) return;
    const accountId =
      raw.campaigns.find((c) => c.id === l.id)?.accountId ??
      raw.adSets.find((a) => a.id === l.id)?.accountId ??
      raw.ads.find((a) => a.id === l.id)?.accountId ??
      null;
    const conta = raw.accounts.find((a) => a.id === accountId);
    window.open(urlFacebook(nivel, l.fbId, conta?.fbAccountId ?? null), "_blank", "noopener");
  }

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      {/* Abas como cards lado a lado, à la Ads Manager */}
      <div className="ads-abas" role="tablist" aria-label="Nível do gerenciador">
        {ABAS.map((a) => {
          const contagem =
            a.key === "accounts" ? raw?.accounts.length ?? 0
            : a.key === "campaigns" ? contar(raw?.campaigns)
            : a.key === "adsets" ? contar(raw?.adSets)
            : contar(raw?.ads);
          return (
            <button key={a.key} type="button" role="tab" className="ads-aba" aria-selected={v.adsSub === a.key}
              // ⚠️ NÃO limpa a marcação: ela é o filtro das abas de baixo, e
              // limpar ao trocar de aba tornaria o drill-down impossível.
              onClick={() => v.setAdsSub(a.key)}>
              <span className="ads-aba-icone">
                <Icone nome={a.icone} tamanho={17} />
              </span>
              <span style={sx("min-width:0")}>
                <span style={sx("display:block;font-size:13.5px;font-weight:600")}>{a.label}</span>
                <span className="text-muted" style={sx("display:block;font-size:11px")}>
                  {plural(contagem, "item", "itens", "nada aqui")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={sx("display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center")}>
        <input className="input" style={sx("max-width:260px")} placeholder="Buscar por nome…"
          value={v.adsSearch} onChange={v.onAdsSearch} />
        {/* Arquivadas ficam fora de "Todos os status": no Facebook, "excluir"
            arquiva, e elas voltariam a poluir a lista com o que o usuário apagou. */}
        <Select
          label=""
          minWidth={155}
          value={v.adsStatus}
          onChange={v.setAdsStatus}
          options={[
            { value: "todos", label: "Todos os status" },
            { value: "ativo", label: "Ativos" },
            { value: "pausado", label: "Pausados" },
            { value: "arquivado", label: "Arquivados" },
          ]}
        />
        {/* Antes eram três opções e nenhum calendário. Agora é o MESMO seletor
            do Dashboard e dos Criativos — 7 períodos e intervalo personalizado. */}
        <FiltroPeriodo
          label=""
          minWidth={150}
          periodo={v.adsPeriod}
          from={v.adsFrom}
          to={v.adsTo}
          timezone={v.timezone}
          onChange={v.setAdsPeriod}
        />
        <Select
          label=""
          minWidth={185}
          value={v.adsAccount}
          onChange={v.setAdsAccount}
          options={[
            { value: "todas", label: "Todas as contas" },
            ...v.adsAccountOptions.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
        {/* Criar campanha vive aqui e não no cabeçalho porque é ação da aba
            Campanhas, não do Gerenciador inteiro. A rota cria SÓ a campanha —
            sem conjunto, sem anúncio, e pausada. */}
        {v.adsSub === "campaigns" && (
          <button
            className="btn btn-secondary"
            type="button"
            style={sx("margin-left:auto")}
            onClick={v.openNewCampaign}
          >
            + Nova campanha
          </button>
        )}
      </div>

      {v.newCampaignOpen && <NovaCampanhaModal v={v} />}

      {/* Painel de controle (Bloco 7) — só nos níveis que aceitam ação */}
      {nivel && (
        <AdsActionBar
          nivel={nivel}
          selecionados={selecionados}
          ordemGasto={ordemGasto}
          onOrdenar={() => setOrdemGasto((o) => (o === "desc" ? "asc" : "desc"))}
          // Mostra a idade do dado (atualizada sozinha pelo polling) e só troca
          // pelo resultado do clique manual enquanto ele existir.
          ultimaSync={v.syncResult ?? v.syncLabel}
          onFixar={fixar}
          onCopiarId={copiarId}
          onAbrirNoFacebook={abrirNoFacebook}
          onExecutar={executar}
          busy={busy}
          resultado={resultado}
        />
      )}

      {/* Indicador do que está filtrando ESTA aba.
          Mostra só os níveis ACIMA do atual: o que está marcado na própria aba
          é seleção de ação em massa, não filtro dela mesma. Sem esta barra,
          trocar de aba e ver uma lista menor pareceria dado faltando. */}
      {(() => {
        const acima = ORDEM.slice(0, ORDEM.indexOf(v.adsSub)).filter((a) => marcados[a].size > 0);
        if (!acima.length) return null;
        const nomeDe = (aba: Aba, id: string) =>
          (aba === "accounts" ? raw?.accounts.find((x) => x.id === id)?.name
            : aba === "campaigns" ? raw?.campaigns.find((x) => x.id === id)?.name
            : raw?.adSets.find((x) => x.id === id)?.name) ?? id;
        const rotulo: Record<Aba, [string, string]> = {
          accounts: ["conta", "contas"], campaigns: ["campanha", "campanhas"],
          adsets: ["conjunto", "conjuntos"], ads: ["anúncio", "anúncios"],
        };
        return (
          <div style={sx("display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 11px;border-radius:var(--radius-md);background:color-mix(in srgb, var(--color-accent) 11%, transparent);border:1px solid color-mix(in srgb, var(--color-accent) 32%, transparent)")}>
            <span style={sx("font-size:12px;font-weight:600")}>Mostrando só o que pertence a:</span>
            {acima.map((aba) =>
              [...marcados[aba]].map((id) => (
                <span key={`${aba}:${id}`}
                  style={sx("display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:2px 4px 2px 9px;border-radius:999px;background:var(--color-surface-2);border:1px solid var(--color-border)")}>
                  <span className="text-muted">{rotulo[aba][0]}</span>
                  {nomeDe(aba, id)}
                  <button type="button" aria-label={`Remover ${rotulo[aba][0]} ${nomeDe(aba, id)}`}
                    onClick={() => marcar(aba, (f) => { const n = new Set(f); n.delete(id); return n; })}
                    style={sx("background:none;border:0;cursor:pointer;color:var(--color-text-muted);padding:0 4px;font-size:13px;line-height:1")}>
                    ✕
                  </button>
                </span>
              )),
            )}
            <button className="btn btn-ghost" type="button"
              onClick={() => setMarcados((m) => ({ ...m, ...Object.fromEntries(acima.map((a) => [a, new Set<string>()])) }))}
              style={sx("margin-left:auto;font-size:11.5px;padding:3px 9px")}>
              Limpar seleção
            </button>
          </div>
        );
      })()}

      <AdsTable
        linhas={linhas}
        selecionadas={selecao}
        onSelecionar={alternar}
        onSelecionarTodas={alternarTodas}
        onToggleStatus={(id) => {
          if (nivel) v.toggleAdsEntity(nivel, id);
        }}
        onSalvarOrcamento={salvarOrcamento}
        fixadas={fixadas}
        carregando={v.adsLoading}
        vazio={mensagemVazio}
      />
    </div>
  );
}
