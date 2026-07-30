"use client";

import { sx } from "@/lib/sx";
import { DashboardGrid } from "../DashboardGrid";
import { BannerPendencias } from "../ui/BannerPendencias";
import { FiltroPeriodo } from "../ui/FiltroPeriodo";
import { Icone } from "../ui/Icone";
import { Select } from "../ui/Select";
import { useDashboardLayout } from "../useDashboardLayout";
import type { TraffikView } from "../useTraffikState";

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
          <FiltroPeriodo
              periodo={v.dashPeriod}
              from={v.dashFrom}
              to={v.dashTo}
              timezone={v.timezone}
              onChange={v.setDashPeriod}
            />
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
          {/* Idade do dado. Existia no estado (`syncLabel`) e só era mostrado no
              Gerenciador — no Dashboard, que é onde fica o botão de atualizar, não
              havia como saber se o número na tela é de agora ou de 20 minutos
              atrás. Sai de cena enquanto sincroniza, porque aí quem informa é o
              próprio botão. */}
          {!grid.editing && !v.syncManualBusy && !v.dashLoading && v.syncLabel && (
            <span className="text-muted" style={sx("font-size:11.5px;white-space:nowrap")}>
              {v.syncLabel}
            </span>
          )}
          {!grid.editing && (
            <button className="btn btn-secondary" type="button" onClick={v.refreshDashboard}
              // Desabilitado enquanto sincroniza: é a 1ª camada contra clique
              // repetido. A 2ª é a reserva no banco, que cobre duas abas.
              disabled={v.syncManualBusy || v.dashLoading}
              title="Sincroniza com o Facebook e recarrega os dados"
              style={sx("display:inline-flex;align-items:center;gap:7px;white-space:nowrap")}>
              <Icone
                nome="atualizar"
                tamanho={14}
                style={{ animation: v.syncManualBusy || v.dashLoading ? "girar 900ms linear infinite" : undefined }}
              />
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
              <Icone nome="ajustes" tamanho={14} />
              Editar dashboard
            </button>
          )}
        </div>
      </div>

      <DashboardGrid v={v} grid={grid} />
    </div>
  );
}
