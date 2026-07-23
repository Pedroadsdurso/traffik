import Link from "next/link";
import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function FacebookView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div className="seg" style={sx("width:fit-content")}>
        {v.fbTabs.map((t) => (
          <label className="seg-opt" key={t.key}>
            <input type="radio" name="fbview" checked={t.checked} onChange={t.go} />
            <span className="dot" />
            {t.label}
          </label>
        ))}
      </div>

      {v.fbSub === "contas" && (
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:720px")}>
          {!v.fbConnected && (
            <div className="card elev-sm">
              <div className="card-title">Conectar conta do Facebook Ads</div>
              <p className="card-body">Conecte via Marketing API para puxar campanhas, gasto e métricas automaticamente.</p>
              <button className="btn btn-primary btn-block" type="button" onClick={v.connectFacebook}>Conectar com Facebook</button>
            </div>
          )}
          {v.fbConnected && (
            <>
              {v.accounts.map((ac) => (
                <div className="card" key={ac.id}>
                  <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                    <div>
                      <div className="card-title" style={sx("font-size:15px")}>{ac.name}</div>
                      <div className="card-meta">{ac.actId} · {ac.campaigns} campanhas · {ac.spendLabel}</div>
                    </div>
                    <div style={sx("display:flex;align-items:center;gap:10px")}>
                      <span className="text-muted" style={sx("font-size:12px")}>Rastreamento</span>
                      <button className="sw" role="switch" aria-checked={ac.trackingOn} onClick={ac.toggleTracking} />
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary" type="button" onClick={v.disconnectFacebook} style={sx("width:fit-content")}>Desconectar todas as contas</button>
            </>
          )}
        </div>
      )}

      {v.fbSub === "webhooks" && (
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
      )}

      {v.fbSub === "pixel" && (
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:720px")}>
          <div className="card">
            <div className="card-kicker">Conversions API</div>
            <div className="card-title">Eventos enviados de volta ao Facebook</div>
            <p className="card-body">Configure quais eventos a Traffik dispara para a sua pixel via Conversions API (server-side).</p>
            <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)")}>
              {v.pixelEvents.map((pe) => (
                <div key={pe.name} style={sx("display:flex;align-items:center;justify-content:space-between;padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
                  <div>
                    <div style={sx("font-size:14px")}>{pe.name}</div>
                    <div className="text-muted" style={sx("font-size:12px")}>{pe.desc}</div>
                  </div>
                  <button className="sw" role="switch" aria-checked={pe.on} onClick={pe.toggle} />
                </div>
              ))}
            </div>
            <div className="field" style={sx("margin-top:var(--space-3);max-width:280px")}>
              <label>Pixel ID</label>
              <input className="input" value={v.pixelId} onChange={v.onPixelId} />
            </div>
          </div>
        </div>
      )}

      {v.fbSub === "testes" && (
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:720px")}>
          <div className="card">
            <div className="card-kicker">Diagnóstico</div>
            <div className="card-title">Disparar evento de teste</div>
            <p className="card-body">Simule um evento para verificar se a integração está enviando corretamente ao Facebook.</p>
            <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2)")}>
              <select className="input" style={sx("width:auto")} value={v.testEvent} onChange={v.onTestEvent}>
                <option>Purchase</option><option>Initiate Checkout</option><option>Add to Cart</option><option>Lead</option>
              </select>
              <button className="btn btn-primary" type="button" onClick={v.fireTest}>Disparar evento de teste</button>
            </div>
          </div>
          <div className="card" style={sx("gap:var(--space-2)")}>
            <div className="card-kicker">Log de testes</div>
            {v.testLog.length > 0 ? (
              v.testLog.map((l, i) => (
                <div key={i} style={sx("display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);font-size:13px")}>
                  <span>{l.event}</span>
                  <span style={sx("display:flex;align-items:center;gap:8px")}>
                    <span className="tag tag-accent">{l.status}</span>
                    <span className="text-muted">{l.time}</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2)")}>Nenhum evento disparado ainda.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
