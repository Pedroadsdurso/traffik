import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function UtmView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:grid;grid-template-columns:1.1fr 1fr;gap:var(--space-4);align-items:start")}>
      <div className="card">
        <div className="card-kicker">Script de rastreamento</div>
        <div className="card-title">Instale o snippet no seu site</div>
        <pre style={sx("background:var(--color-bg);border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:var(--space-3);font-size:12.5px;overflow:auto;margin:var(--space-2) 0")}>
          <code>{v.snippetText}</code>
        </pre>
        <button className="btn btn-secondary" type="button" onClick={v.copySnippet} style={sx("width:fit-content")}>
          <svg viewBox="0 0 256 256" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
            <rect x="88" y="88" width="120" height="120" rx="12" />
            <path d="M168 88 V60 a12 12 0 00-12-12 H60 a12 12 0 00-12 12 v96 a12 12 0 0012 12h28" />
          </svg>
          {v.snippetCopyLabel}
        </button>
        <ol style={sx("margin:var(--space-4) 0 0;padding-left:18px;font-size:13px;opacity:.85;display:flex;flex-direction:column;gap:8px")}>
          <li>Cole o snippet acima antes do <code>&lt;/head&gt;</code> do seu site ou checkout.</li>
          <li>O pixel salva utm_source, utm_medium, utm_campaign, utm_content e fbclid em cookie por até 30 dias.</li>
          <li>Aponte o webhook da sua plataforma de pagamento para <code>api.traffik.io/webhooks/vendas</code>.</li>
          <li>Cada venda recebida é cruzada automaticamente com o clique de origem salvo.</li>
        </ol>
      </div>

      <div className="card">
        <div className="card-kicker">Gerador de link</div>
        <div className="card-title">Monte sua URL com UTMs</div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>URL de destino</label>
          <input className="input" value={v.utmUrl} onChange={v.onUtmUrl} />
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>utm_source</label>
            <select className="input" value={v.utmSource} onChange={v.onUtmSource}>
              <option value="facebook">facebook</option>
              <option value="instagram">instagram</option>
              <option value="google">google</option>
              <option value="email">email</option>
            </select>
          </div>
          <div className="field">
            <label>utm_medium</label>
            <input className="input" value={v.utmMedium} onChange={v.onUtmMedium} />
          </div>
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>utm_campaign</label>
            <input className="input" value={v.utmCampaign} onChange={v.onUtmCampaign} />
          </div>
          <div className="field">
            <label>utm_content</label>
            <input className="input" value={v.utmContent} onChange={v.onUtmContent} />
          </div>
        </div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>Link gerado</label>
          <textarea className="input" readOnly rows={3} style={sx("font-size:12px")} value={v.generatedLink} onChange={() => {}} />
        </div>
        <button className="btn btn-primary" type="button" onClick={v.copyLink} style={sx("width:fit-content;margin-top:var(--space-2)")}>
          {v.linkCopyLabel}
        </button>
      </div>
    </div>
  );
}
