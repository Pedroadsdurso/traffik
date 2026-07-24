import { sx } from "@/lib/sx";
import type { TraffikView } from "../../useTraffikState";

export function PixelView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:760px")}>
      <div className="card">
        <div className="card-kicker">Conversions API</div>
        <div className="card-title">Adicionar Pixel</div>
        <p className="card-body">Envie eventos server-side para o seu pixel da Meta. Pegue o ID e o token da CAPI no <em>Gerenciador de Eventos → Configurações</em>.</p>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-top:var(--space-2)")}>
          <div className="field"><label>Nome</label><input className="input" placeholder="Ex.: Pixel principal" value={v.newPixelName} onChange={v.onNewPixelName} /></div>
          <div className="field"><label>Pixel ID</label><input className="input" placeholder="Ex.: 284910375562481" value={v.newPixelId} onChange={v.onNewPixelId} /></div>
          <div className="field" style={sx("grid-column:1/-1")}><label>Token da Conversions API</label><input className="input" type="password" placeholder="EAAG..." value={v.newPixelToken} onChange={v.onNewPixelToken} /></div>
        </div>
        <button className="btn btn-primary" type="button" onClick={v.addPixel} disabled={v.pixelBusy || !v.newPixelId.trim()} style={sx("width:fit-content;margin-top:var(--space-2)")}>
          {v.pixelBusy ? "Adicionando…" : "Adicionar Pixel"}
        </button>
      </div>

      {v.pixels.length === 0 ? (
        <div className="card text-muted" style={sx("font-size:13px")}>Nenhum pixel configurado ainda.</div>
      ) : (
        v.pixels.map((px) => (
          <div className="card" key={px.id}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
              <div>
                <div style={sx("display:flex;align-items:center;gap:8px")}>
                  <span className="card-title" style={sx("font-size:15px")}>{px.name}</span>
                  {!px.hasToken && <span className="tag tag-neutral">sem token CAPI</span>}
                </div>
                <div className="card-meta">Pixel ID: {px.pixelId}</div>
              </div>
              <div style={sx("display:flex;align-items:center;gap:10px")}>
                <button className="sw" role="switch" aria-checked={px.enabled} onClick={px.toggle} />
                <button className="btn btn-ghost" type="button" onClick={px.remove}>Remover</button>
              </div>
            </div>

            <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)")}>
              {px.rules.map((r) => (
                <div key={r.eventType} style={sx("padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
                  <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                    <div>
                      <div style={sx("font-size:14px")}>{r.label}</div>
                      <div className="text-muted" style={sx("font-size:12px")}>{r.desc}</div>
                    </div>
                    <button className="sw" role="switch" aria-checked={r.enabled} onClick={r.toggle} />
                  </div>

                  {r.enabled && r.eventType !== "PURCHASE" && (
                    <div className="field" style={sx("margin-top:var(--space-2)")}>
                      <label>Regra de detecção (contém texto)</label>
                      <input className="input" placeholder='Ex.: "COMPRAR AGORA"' value={r.detectionText} onChange={r.onDetection} onBlur={r.commitDetection} />
                    </div>
                  )}

                  {r.enabled && r.eventType === "PURCHASE" && (
                    <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);margin-top:var(--space-2)")}>
                      <div className="field">
                        <label>Enviar</label>
                        <select className="input" value={r.sendMode} onChange={r.onSendMode}>
                          <option value="APENAS_APROVADAS">Apenas vendas aprovadas</option>
                          <option value="TODAS">Todas as vendas</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Valor do evento</label>
                        <select className="input" value={r.valueMode} onChange={r.onValueMode}>
                          <option value="VALOR_DA_VENDA">Valor da venda</option>
                          <option value="VALOR_FIXO">Valor fixo</option>
                        </select>
                      </div>
                      {r.valueMode === "VALOR_FIXO" && (
                        <div className="field">
                          <label>Valor fixo (R$)</label>
                          <input className="input" inputMode="decimal" value={r.fixedValue} onChange={r.onFixedValue} onBlur={r.commitFixedValue} />
                        </div>
                      )}
                      <div className="field" style={sx("grid-column:1/-1")}>
                        <label>Produto alvo (opcional — vazio = qualquer)</label>
                        <input className="input" placeholder="Ex.: Método Foco 3.0" value={r.targetProduct} onChange={r.onTargetProduct} onBlur={r.commitTargetProduct} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
