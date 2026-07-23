import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

function Row({ label, desc, on, onToggle }: { label: string; desc?: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
      <div>
        <div style={sx("font-size:14px")}>{label}</div>
        {desc && <div className="text-muted" style={sx("font-size:12px")}>{desc}</div>}
      </div>
      <button className="sw" role="switch" aria-checked={on} onClick={onToggle} />
    </div>
  );
}

export function NotificationsView({ v }: { v: TraffikView }) {
  const n = v.notif;
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4);max-width:680px")}>
      <div className="card">
        <div className="card-kicker">Notificações de venda</div>
        <div className="card-title">Alertas de novas vendas</div>
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-3)")}>
          <Row label="Vendas aprovadas" desc="Alerta quando uma venda é confirmada" on={n.notifyApprovedSale} onToggle={v.toggleNotifyApproved} />
          <Row label="Vendas pendentes" desc="Alerta quando um pagamento fica pendente" on={n.notifyPendingSale} onToggle={v.toggleNotifyPending} />
          <hr className="hr" style={sx("margin:var(--space-1) 0")} />
          <div className="text-muted" style={sx("font-size:11px;text-transform:uppercase;letter-spacing:.08em")}>Exibir na notificação</div>
          <Row label="Valor da venda" on={n.showValue} onToggle={v.toggleShowValue} />
          <Row label="Nome do produto" on={n.showProductName} onToggle={v.toggleShowProduct} />
          <Row label="Campanha (utm_campaign)" on={n.showUtmCampaign} onToggle={v.toggleShowUtm} />
          <Row label="Nome do dashboard" on={n.showDashboardName} onToggle={v.toggleShowDashboard} />
          <div style={sx("padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);font-size:13px")}>
            <div className="text-muted" style={sx("font-size:11px;margin-bottom:4px")}>Prévia do alerta</div>
            <span>💰 {n.preview}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-kicker">Notificações de relatório</div>
        <div className="card-title">Resumos programados</div>
        <div className="field" style={sx("max-width:280px;margin-top:var(--space-3)")}>
          <label>Padrão da notificação</label>
          <select className="input" value={n.reportPattern} onChange={v.onReportPattern}>
            <option value="STATUS_LUCRO">Status de Lucro</option>
            <option value="RESUMO_DETALHADO">Resumo Detalhado</option>
            <option value="NOTIFICACOES_CRIATIVAS">Notificações Criativas</option>
          </select>
        </div>
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
          {v.reports.map((rp) => (
            <div key={rp.time} style={sx("display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
              <div style={sx("font-size:14px;font-variant-numeric:tabular-nums")}>Resumo às {rp.time}</div>
              <button className="sw" role="switch" aria-checked={rp.on} onClick={rp.toggle} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
