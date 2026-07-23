import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function NotificationsView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4);max-width:680px")}>
      <div className="card">
        <div className="card-kicker">Alertas de venda</div>
        <div className="card-title">Notificações de novas vendas</div>
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
            <div>
              <div style={sx("font-size:14px")}>Alertar a cada nova venda</div>
              <div className="text-muted" style={sx("font-size:12px")}>Receba um alerta em tempo real quando uma venda for confirmada</div>
            </div>
            <button className="sw" role="switch" aria-checked={v.notif.newSale} onClick={v.toggleNewSale} />
          </div>
          <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
            <div style={sx("font-size:14px")}>Mostrar valor da venda</div>
            <button className="sw" role="switch" aria-checked={v.notif.showValue} onClick={v.toggleShowValue} />
          </div>
          <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
            <div style={sx("font-size:14px")}>Mostrar produto</div>
            <button className="sw" role="switch" aria-checked={v.notif.showProduct} onClick={v.toggleShowProduct} />
          </div>
          <div className="field" style={sx("max-width:240px")}>
            <label>Canal de envio</label>
            <select className="input" value={v.notif.channel} onChange={v.onNotifChannel}>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="email">E-mail</option>
              <option value="push">Push do app</option>
            </select>
          </div>
          <div style={sx("padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);font-size:13px")}>
            <div className="text-muted" style={sx("font-size:11px;margin-bottom:4px")}>Prévia do alerta</div>
            <span>💰 {v.notif.preview}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-kicker">Relatórios programados</div>
        <div className="card-title">Resumos periódicos</div>
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
