"use client";

import { useMemo, useState } from "react";

import { combinaStatus } from "@/lib/ads/status";
import { sx } from "@/lib/sx";
import { AdsActionBar, type Acao, type AlvoSelecionado, type Nivel } from "./ads/AdsActionBar";
import { AdsTable, type LinhaTabela } from "./ads/AdsTable";
import type { TraffikView } from "../useTraffikState";

const ABAS: { key: "campaigns" | "adsets" | "ads" | "accounts"; label: string; icone: string; nivel: Nivel | null }[] = [
  { key: "accounts", label: "Contas", icone: "M3 7h18v12H3zM3 11h18", nivel: null },
  { key: "campaigns", label: "Campanhas", icone: "M3 12h4l3-8 4 16 3-8h4", nivel: "campaign" },
  { key: "adsets", label: "Conjuntos", icone: "M4 6h16M4 12h16M4 18h10", nivel: "adset" },
  { key: "ads", label: "Anúncios", icone: "M4 5h16v10H4zM8 19h8", nivel: "ad" },
];

/** Link direto para a entidade no Gerenciador de Anúncios do Facebook. */
function urlFacebook(nivel: Nivel, fbId: string, contaFb: string | null): string {
  const act = contaFb ? `act_${contaFb.replace(/^act_/, "")}` : "";
  const base = "https://adsmanager.facebook.com/adsmanager/manage";
  if (nivel === "campaign") return `${base}/campaigns?act=${act}&selected_campaign_ids=${fbId}`;
  if (nivel === "adset") return `${base}/adsets?act=${act}&selected_adset_ids=${fbId}`;
  return `${base}/ads?act=${act}&selected_ad_ids=${fbId}`;
}

export function AdsManagerView({ v }: { v: TraffikView }) {
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
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

    let base: LinhaTabela[] = [];
    if (v.adsSub === "campaigns") {
      base = raw.campaigns.filter((c) => filtra(c.name, c.status)).map((c) => ({
        id: c.id, fbId: c.fbId, nome: c.name, status: c.status,
        // Orçamento na campanha ⇒ CBO. É o que o modal de orçamento lê.
        sub: c.dailyBudget != null ? "CBO · orçamento na campanha" : "ABO · orçamento nos conjuntos",
        orcamento: c.dailyBudget,
        // CBO edita na campanha; ABO não (o orçamento vive nos conjuntos).
        orcamentoEditavel: c.dailyBudget != null,
        spend: c.spend, impressions: c.impressions,
        clicks: c.clicks, results: c.results, revenue: c.revenue,
      }));
    } else if (v.adsSub === "adsets") {
      base = raw.adSets.filter((a) => filtra(a.name, a.status)).map((a) => ({
        id: a.id, fbId: a.fbId, nome: a.name, status: a.status, sub: a.campaignName,
        orcamento: a.dailyBudget, bidCap: a.bidAmount,
        // Conjunto só edita orçamento quando a campanha-mãe é ABO.
        orcamentoEditavel: raw.campaigns.find((c) => c.id === a.campaignId)?.dailyBudget == null,
        spend: a.spend,
        impressions: a.impressions, clicks: a.clicks, results: a.results, revenue: a.revenue,
      }));
    } else if (v.adsSub === "ads") {
      base = raw.ads.filter((a) => filtra(a.name, a.status)).map((a) => ({
        id: a.id, fbId: a.fbId, nome: a.name, status: a.status, sub: a.campaignName,
        spend: a.spend, impressions: a.impressions, clicks: a.clicks,
        results: a.results, revenue: a.revenue,
      }));
    } else {
      base = raw.accounts.map((ac) => ({
        id: ac.id, fbId: ac.fbAccountId, nome: ac.name,
        status: ac.tracking ? "ACTIVE" : "PAUSED",
        sub: `${ac.fbAccountId} · ${ac.campaigns} campanha(s)`,
        spend: ac.spend, impressions: 0, clicks: 0, results: 0, revenue: ac.revenue,
      }));
    }
    return base.sort((a, b) => (ordemGasto === "desc" ? b.spend - a.spend : a.spend - b.spend));
  }, [raw, v.adsSub, v.adsSearch, v.adsStatus, ordemGasto]);

  /**
   * Contagem da aba respeitando o filtro ativo. Usava `length` do array cru, o
   * que mostraria "12 campanhas" com a tabela vazia depois que "Todos os
   * status" passou a esconder arquivadas.
   */
  const contar = (rows?: { name: string; status: string }[]) =>
    (rows ?? []).filter(
      (r) => combinaStatus(r.status, v.adsStatus) && r.name.toLowerCase().includes(v.adsSearch.toLowerCase()),
    ).length;

  const selecionados: AlvoSelecionado[] = linhas
    .filter((l) => selecao.has(l.id))
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      cbo: v.adsSub === "campaigns" ? l.orcamento != null : undefined,
      campanha: l.sub,
    }));

  function alternar(id: string) {
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function alternarTodas() {
    setSelecao((s) => (s.size === linhas.length ? new Set() : new Set(linhas.map((l) => l.id))));
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
            : `${data.sucessos} ok · ${falhas.length} falha(s): ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`,
        );
        setSelecao(new Set());
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
    setResultado(`✓ ${ids.length} ID(s) copiados.`);
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
              onClick={() => { v.setAdsSub(a.key); setSelecao(new Set()); }}>
              <span className="ads-aba-icone">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.9}
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={a.icone} /></svg>
              </span>
              <span style={sx("min-width:0")}>
                <span style={sx("display:block;font-size:13.5px;font-weight:600")}>{a.label}</span>
                <span className="text-muted" style={sx("display:block;font-size:11px")}>{contagem} item(ns)</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div style={sx("display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center")}>
        <input className="input" style={sx("max-width:260px")} placeholder="Buscar por nome…"
          value={v.adsSearch} onChange={v.onAdsSearch} />
        <select className="input" style={sx("width:auto")} value={v.adsStatus} onChange={v.onAdsStatus}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="pausado">Pausados</option>
          {/* Arquivadas ficam fora de "Todos": no Facebook, "excluir" arquiva,
              e elas voltariam a poluir a lista com o que o usuário apagou. */}
          <option value="arquivado">Arquivados</option>
        </select>
        <select className="input" style={sx("width:auto")} value={v.adsPeriod} onChange={v.onAdsPeriod}>
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
        <select className="input" style={sx("width:auto")} value={v.adsAccount} onChange={v.onAdsAccount}>
          <option value="todas">Todas as contas</option>
          {v.adsAccountOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Painel de controle (Bloco 7) — só nos níveis que aceitam ação */}
      {nivel && (
        <AdsActionBar
          nivel={nivel}
          selecionados={selecionados}
          ordemGasto={ordemGasto}
          onOrdenar={() => setOrdemGasto((o) => (o === "desc" ? "asc" : "desc"))}
          onSincronizar={v.runSync}
          sincronizando={v.syncBusy}
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
        vazio={
          v.adsSub === "accounts"
            ? "Nenhuma conta conectada. Conecte um perfil em Integrações › Anúncios."
            : "Nada aqui. Sincronize as métricas ou ajuste os filtros."
        }
      />
    </div>
  );
}
