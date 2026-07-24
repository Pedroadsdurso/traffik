import Link from "next/link";

import { sx } from "@/lib/sx";
import type { TraffikView } from "../../useTraffikState";

export function WebhooksView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:820px")}>
      <div className="card">
        <div className="card-kicker">Novo webhook</div>
        <div className="card-title">Adicionar plataforma de pagamento</div>
        <p className="card-body">Geramos uma URL única. Cole-a no painel da sua plataforma para que as vendas cheguem à Traffik.</p>
        <Link href="/dashboard/test-checkout" className="btn btn-secondary" style={sx("width:fit-content")}>
          Abrir checkout de teste →
        </Link>
        <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2);flex-wrap:wrap;align-items:flex-end")}>
          <div className="field" style={sx("width:auto")}>
            <label>Plataforma</label>
            <select className="input" style={sx("width:auto")} value={v.newWebhookPlatform} onChange={v.onNewWebhookPlatform}>
              <option value="KIRVANO">Kirvano</option>
              <option value="HOTMART">Hotmart</option>
              <option value="KIWIFY">Kiwify</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="field" style={sx("flex:1;min-width:200px")}>
            <label>Nome (opcional)</label>
            <input className="input" placeholder="Ex.: Kirvano — Método Foco" value={v.newWebhookName} onChange={v.onNewWebhookName} />
          </div>
          <button className="btn btn-primary" type="button" onClick={v.addWebhook} disabled={v.webhookBusy}>
            {v.webhookBusy ? "Adicionando…" : "Adicionar Webhook"}
          </button>
        </div>
      </div>

      {v.webhooks.length === 0 ? (
        <div className="card text-muted" style={sx("font-size:13px")}>Nenhum webhook cadastrado ainda.</div>
      ) : (
        v.webhooks.map((w) => (
          <div className="card" key={w.id}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
              <div style={sx("min-width:0")}>
                <div style={sx("display:flex;align-items:center;gap:8px")}>
                  <span className="card-title" style={sx("font-size:15px")}>{w.name}</span>
                  <span className={w.active ? "tag tag-accent" : "tag tag-neutral"}>{w.active ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="card-meta">{v.webhookPlatformLabel(w.platform)} · {w.eventCount} vendas recebidas</div>
              </div>
              <div style={sx("display:flex;align-items:center;gap:10px")}>
                <span className="text-muted" style={sx("font-size:12px")}>Ativo</span>
                <button className="sw" role="switch" aria-checked={w.active} onClick={() => v.toggleWebhook(w.id)} />
              </div>
            </div>
            <div style={sx("display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-2)")}>
              <input className="input" readOnly value={w.url} style={sx("flex:1;min-width:0;font-size:12px;font-family:ui-monospace,monospace")} onFocus={(e) => e.target.select()} />
              <button className="btn btn-secondary" type="button" onClick={() => v.copyWebhookUrl(w.id, w.url)}>
                {v.copiedWebhookId === w.id ? "Copiado!" : "Copiar"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => v.removeWebhook(w.id)} title="Remover">Remover</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
