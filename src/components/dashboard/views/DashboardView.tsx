"use client";

import { useEffect, useRef, useState } from "react";

import { sx } from "@/lib/sx";
import { DashboardGrid } from "../DashboardGrid";
import { BannerPendencias } from "../ui/BannerPendencias";
import { DateRangePicker, formatarIntervalo } from "../ui/DateRangePicker";
import { Select } from "../ui/Select";
import { useDashboardLayout } from "../useDashboardLayout";
import type { TraffikView } from "../useTraffikState";

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" },
];

/** Seletor de período: o valor "Personalizado" abre o calendário de intervalo. */
function FiltroPeriodo({ v }: { v: TraffikView }) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  // Quando há intervalo escolhido, o rótulo mostra as datas em vez de "Personalizado".
  const opcoes = PERIODOS.map((p) =>
    p.value === "custom" && v.dashPeriod === "custom" && v.dashFrom
      ? { ...p, label: formatarIntervalo({ from: v.dashFrom, to: v.dashTo ?? v.dashFrom }) }
      : p,
  );

  return (
    <div ref={raizRef} style={sx("position:relative")}>
      <Select
        label="Período"
        value={v.dashPeriod}
        options={opcoes}
        minWidth={170}
        onChange={(val) => {
          if (val === "custom") {
            setAberto(true);
            return;
          }
          v.setDashPeriod(val as typeof v.dashPeriod);
        }}
      />
      {aberto && (
        <DateRangePicker
          timezone={v.timezone}
          value={v.dashFrom ? { from: v.dashFrom, to: v.dashTo ?? v.dashFrom } : null}
          onCancel={() => setAberto(false)}
          onApply={(r) => {
            v.setDashRange(r.from, r.to);
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}

export function DashboardView({ v }: { v: TraffikView }) {
  // O estado do grid vive aqui porque os controles de edição ficam no container
  // de filtros, acima do grid.
  const grid = useDashboardLayout(v.workspaceAtiva);

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      {/* Acima dos filtros de propósito: quem cai numa área recém-criada precisa
          ver o que falta ANTES de tentar ler números que ainda não são só dela. */}
      <BannerPendencias workspaceId={v.workspaceAtiva} />

      <div className="tk-filtros">
        <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:flex-end")}>
          <FiltroPeriodo v={v} />
          <Select
            label="Conta de anúncio"
            value={v.dashAccount}
            onChange={v.setDashAccount}
            minWidth={180}
            options={[{ value: "todas", label: "Todas as contas" }, ...v.filterAccounts.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <Select
            label="Produto"
            value={v.dashProduct}
            onChange={v.setDashProduct}
            minWidth={170}
            options={[{ value: "todos", label: "Todos os produtos" }, ...v.filterProducts.map((p) => ({ value: p, label: p }))]}
          />
          <Select
            label="Fonte de tráfego"
            value={v.dashSource}
            onChange={v.setDashSource}
            minWidth={170}
            options={[{ value: "todas", label: "Todas as fontes" }, ...v.filterSources.map((s) => ({ value: s, label: s }))]}
          />
        </div>

        <div style={sx("display:flex;gap:var(--space-2);align-items:center;flex-wrap:wrap")}>
          {/* Resultado da última sincronização manual — o usuário precisa saber
              se algo foi feito ou se já estava em dia, senão clica de novo. */}
          {v.syncManualMsg && (
            <span
              onClick={v.limparSyncMsg}
              title="Clique para dispensar"
              style={sx("font-size:12px;color:var(--color-text-muted);background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:999px;padding:4px 11px;cursor:pointer;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
              {v.syncManualMsg}
            </span>
          )}
          {!grid.editing && (
            <button className="btn btn-secondary" type="button" onClick={v.refreshDashboard}
              // Desabilitado enquanto sincroniza: é a 1ª camada contra clique
              // repetido. A 2ª é a reserva no banco, que cobre duas abas.
              disabled={v.syncManualBusy || v.dashLoading}
              title="Sincroniza com o Facebook e recarrega os dados"
              style={sx("display:inline-flex;align-items:center;gap:7px;white-space:nowrap")}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden
                style={{ animation: v.syncManualBusy || v.dashLoading ? "girar 900ms linear infinite" : undefined }}>
                <path d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />
              </svg>
              {v.syncManualBusy ? "Sincronizando…" : v.dashLoading ? "Atualizando…" : "Atualizar"}
            </button>
          )}

          {grid.editing ? (
            <div style={sx("display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center")}>
              <span className="tag tag-accent">Modo de edição</span>
              <button className="btn btn-ghost" type="button" onClick={grid.redefinir} disabled={grid.busy}>
                Redefinir configurações
              </button>
              <button className="btn btn-secondary" type="button" onClick={grid.cancelar} disabled={grid.busy}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={grid.salvar} disabled={grid.busy}>
                {grid.busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" type="button" onClick={grid.abrirEdicao}>
              <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round">
                <line x1="40" y1="80" x2="216" y2="80" />
                <circle cx="96" cy="80" r="18" fill="var(--color-surface)" />
                <line x1="40" y1="176" x2="216" y2="176" />
                <circle cx="168" cy="176" r="18" fill="var(--color-surface)" />
              </svg>
              Editar dashboard
            </button>
          )}
        </div>
      </div>

      <DashboardGrid v={v} grid={grid} />
    </div>
  );
}
