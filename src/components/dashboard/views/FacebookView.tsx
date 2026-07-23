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
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:760px")}>
          {v.fbConnected && (
            <div style={sx("display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap")}>
              <button className="btn btn-primary" type="button" onClick={v.runSync} disabled={v.syncBusy}>
                {v.syncBusy ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              {v.syncResult && <span className="text-muted" style={sx("font-size:13px")}>{v.syncResult}</span>}
            </div>
          )}

          {!v.fbConnected && (
            <div className="card elev-sm">
              <div className="card-title">Conectar conta do Facebook Ads</div>
              <p className="card-body">Conecte via Marketing API para puxar campanhas, gasto e métricas automaticamente. Pediremos as permissões <code>ads_read</code> e <code>ads_management</code>.</p>
              <a className="btn btn-primary btn-block" href={v.connectHref}>Conectar com Facebook</a>
            </div>
          )}

          {v.adProfiles.map((p) => (
            <div className="card" key={p.id} style={sx("gap:var(--space-2)")}>
              <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <button
                  type="button"
                  onClick={p.toggleExpanded}
                  style={sx("display:flex;align-items:center;gap:10px;background:none;border:none;color:inherit;cursor:pointer;padding:0;text-align:left")}
                >
                  <span style={sx("display:inline-flex;transition:transform .15s;transform:rotate(" + (p.expanded ? "90" : "0") + "deg)")}>
                    <svg viewBox="0 0 256 256" width="12" height="12" fill="currentColor"><path d="M96 60 L176 128 L96 196 Z" /></svg>
                  </span>
                  {p.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.pictureUrl} alt="" width={30} height={30} style={sx("border-radius:50%")} />
                  ) : (
                    <span style={sx("width:30px;height:30px;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:grid;place-items:center;font-size:12px")}>{p.name.charAt(0)}</span>
                  )}
                  <span>
                    <span className="card-title" style={sx("font-size:15px")}>{p.name} ({p.accountCount})</span>
                    {p.email && <span className="card-meta" style={sx("display:block")}>{p.email}</span>}
                  </span>
                </button>
                <button className="btn btn-ghost" type="button" onClick={p.disconnect} style={sx("font-size:13px")}>Desconectar</button>
              </div>

              {p.expanded && (
                <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:var(--space-2)")}>
                  {p.accounts.length === 0 ? (
                    <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2)")}>Nenhuma conta de anúncio neste perfil.</div>
                  ) : (
                    p.accounts.map((ac) => (
                      <div key={ac.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
                        <div style={sx("min-width:0")}>
                          <div style={sx("font-size:14px;display:flex;align-items:center;gap:8px")}>
                            {ac.name}
                            <span className={ac.statusTag}>{ac.statusLabel}</span>
                          </div>
                          <div className="card-meta">act_{ac.fbAccountId} · {ac.currency}</div>
                        </div>
                        <div style={sx("display:flex;align-items:center;gap:10px;flex-shrink:0")}>
                          <span className="text-muted" style={sx("font-size:12px")}>Rastrear</span>
                          <button className="sw" role="switch" aria-checked={ac.trackingOn} onClick={ac.toggleTracking} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {v.fbConnected && (
            <a className="btn btn-secondary" href={v.connectHref} style={sx("width:fit-content")}>+ Adicionar perfil</a>
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
