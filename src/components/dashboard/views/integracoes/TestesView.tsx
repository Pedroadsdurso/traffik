import { sx } from "@/lib/sx";
import type { TraffikView } from "../../useTraffikState";

export function TestesView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:720px")}>
      <div className="card">
        <div className="card-kicker">Conversions API</div>
        <div className="card-title">Enviar evento de teste real</div>
        <p className="card-body">Envia um evento <strong>Purchase</strong> de verdade (valor R$1) para a Conversions API do pixel escolhido. Informe um <em>test_event_code</em> do Gerenciador de Eventos para vê-lo aparecer em &quot;Testar eventos&quot;.</p>
        {v.testPixelOptions.length === 0 ? (
          <p className="card-body" style={sx("color:#ffce8a")}>Nenhum pixel com token da CAPI configurado. Adicione um na aba Pixel.</p>
        ) : (
          <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2);flex-wrap:wrap;align-items:flex-end")}>
            <div className="field" style={sx("width:auto")}>
              <label>Pixel</label>
              <select className="input" style={sx("width:auto")} value={v.testPixelId} onChange={v.onTestPixel}>
                {v.testPixelOptions.map((px) => (
                  <option key={px.id} value={px.id}>{px.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={sx("width:180px")}>
              <label>test_event_code (opcional)</label>
              <input className="input" placeholder="TEST12345" value={v.testEventCode} onChange={v.onTestEventCode} />
            </div>
            <button className="btn btn-primary" type="button" onClick={v.runPixelTest} disabled={v.testBusy}>
              {v.testBusy ? "Enviando…" : "Enviar evento de teste"}
            </button>
          </div>
        )}
        {v.testResult && (
          <p style={sx("margin:var(--space-3) 0 0;font-size:13px;padding:10px;border-radius:var(--radius-md);background:var(--color-bg)")}>{v.testResult}</p>
        )}
      </div>
    </div>
  );
}
