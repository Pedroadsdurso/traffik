import { sx } from "@/lib/sx";
import { ImageSlot } from "../ImageSlot";
import type { TraffikView } from "../useTraffikState";

function StatusToggle({ path, busy, onClick }: { path: string; busy: boolean; onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-icon" type="button" onClick={onClick} disabled={busy} aria-label="Alternar status">
      <svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" stroke="none">
        <path d={path} />
      </svg>
    </button>
  );
}

export function AdsManagerView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
        <div className="seg" style={sx("width:fit-content")}>
          {v.adsTabs.map((t) => (
            <label className="seg-opt" key={t.key}>
              <input type="radio" name="adsview" checked={t.checked} onChange={t.go} />
              <span className="dot" />
              {t.label}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" type="button" onClick={v.openNewCampaign} disabled={v.adsAccountOptions.length === 0}>
          + Nova campanha
        </button>
      </div>

      {v.adsSub !== "accounts" && (
        <div style={sx("display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap")}>
          <div style={sx("display:flex;align-items:center;gap:8px;flex:1;min-width:200px;max-width:280px;background:var(--color-surface);border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:6px 10px")}>
            <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round">
              <circle cx="112" cy="112" r="72" />
              <line x1="164" y1="164" x2="220" y2="220" />
            </svg>
            <input className="input" style={sx("border:none;background:transparent;padding:0")} placeholder="Buscar por nome..." value={v.adsSearch} onChange={v.onAdsSearch} />
          </div>
          <select className="input" style={sx("width:auto")} value={v.adsStatus} onChange={v.onAdsStatus}>
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
          </select>
          <select className="input" style={sx("width:auto")} value={v.adsPeriod} onChange={v.onAdsPeriod}>
            <option value="hoje">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
          <select className="input" style={sx("width:auto")} value={v.adsAccount} onChange={v.onAdsAccount}>
            <option value="todas">Todas as contas</option>
            {v.adsAccountOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {v.adsSub === "campaigns" && (
        <div className="card" style={sx("gap:0")}>
          <table className="table">
            <thead>
              <tr><th>Campanha</th><th>Status</th><th>Orçamento/dia</th><th>Gasto</th><th>Resultados</th><th>CPA</th><th>CTR</th><th>ROAS</th><th></th></tr>
            </thead>
            <tbody>
              {v.filteredCampaigns.length === 0 ? (
                <tr><td colSpan={9} className="text-muted" style={sx("padding:var(--space-3);font-size:13px")}>{v.adsLoading ? "Carregando…" : "Nenhuma campanha. Sincronize em Facebook Ads ou crie uma nova."}</td></tr>
              ) : (
                v.filteredCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={sx("max-width:260px")}>{c.name}</td>
                    <td><span className={c.statusTag}>{c.statusLabel}</span></td>
                    <td className="text-muted">{c.budgetLabel}</td>
                    <td style={sx("font-variant-numeric:tabular-nums")}>{c.spendLabel}</td>
                    <td>{c.results}</td>
                    <td className="text-muted">{c.cpaLabel}</td>
                    <td className="text-muted">{c.ctrLabel}</td>
                    <td style={sx("color:var(--color-accent-300)")}>{c.roasLabel}</td>
                    <td><StatusToggle path={c.toggleIconPath} busy={c.busy} onClick={c.toggle} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "adsets" && (
        <div className="card" style={sx("gap:0")}>
          <table className="table">
            <thead>
              <tr><th>Conjunto de anúncios</th><th>Campanha</th><th>Status</th><th>Gasto</th><th>Resultados</th><th>CPA</th><th>CTR</th><th>ROAS</th><th></th></tr>
            </thead>
            <tbody>
              {v.filteredAdsets.length === 0 ? (
                <tr><td colSpan={9} className="text-muted" style={sx("padding:var(--space-3);font-size:13px")}>{v.adsLoading ? "Carregando…" : "Nenhum conjunto."}</td></tr>
              ) : (
                v.filteredAdsets.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="text-muted">{a.campaign}</td>
                    <td><span className={a.statusTag}>{a.statusLabel}</span></td>
                    <td style={sx("font-variant-numeric:tabular-nums")}>{a.spendLabel}</td>
                    <td>{a.results}</td>
                    <td className="text-muted">{a.cpaLabel}</td>
                    <td className="text-muted">{a.ctrLabel}</td>
                    <td style={sx("color:var(--color-accent-300)")}>{a.roasLabel}</td>
                    <td><StatusToggle path={a.toggleIconPath} busy={a.busy} onClick={a.toggle} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "ads" && (
        <div className="card" style={sx("gap:0")}>
          <table className="table">
            <thead>
              <tr><th>Anúncio</th><th>Formato</th><th>Status</th><th>Gasto</th><th>Resultados</th><th>CPA</th><th>CTR</th><th>ROAS</th><th></th></tr>
            </thead>
            <tbody>
              {v.filteredAds.length === 0 ? (
                <tr><td colSpan={9} className="text-muted" style={sx("padding:var(--space-3);font-size:13px")}>{v.adsLoading ? "Carregando…" : "Nenhum anúncio."}</td></tr>
              ) : (
                v.filteredAds.map((a) => (
                  <tr key={a.slotId}>
                    <td>
                      <div style={sx("display:flex;align-items:center;gap:10px")}>
                        <div style={sx("width:56px;height:32px;flex:none;border-radius:var(--radius-sm);overflow:hidden;background:var(--color-bg)")}>
                          {a.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.thumbnailUrl} alt="" style={sx("width:100%;height:100%;object-fit:cover")} />
                          ) : (
                            <ImageSlot label={a.format} />
                          )}
                        </div>
                        <span style={sx("max-width:200px")}>{a.name}</span>
                      </div>
                    </td>
                    <td><span className="tag tag-neutral">{a.format}</span></td>
                    <td><span className={a.statusTag}>{a.statusLabel}</span></td>
                    <td style={sx("font-variant-numeric:tabular-nums")}>{a.spendLabel}</td>
                    <td>{a.results}</td>
                    <td className="text-muted">{a.cpaLabel}</td>
                    <td className="text-muted">{a.ctrLabel}</td>
                    <td style={sx("color:var(--color-accent-300)")}>{a.roasLabel}</td>
                    <td><StatusToggle path={a.toggleIconPath} busy={a.busy} onClick={a.toggle} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "accounts" && (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-4)")}>
          {v.accounts.length === 0 ? (
            <div className="card text-muted" style={sx("font-size:13px")}>Nenhuma conta conectada. Conecte em Facebook Ads.</div>
          ) : (
            v.accounts.map((ac) => (
              <div className="card" key={ac.id}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                  <div className="card-title" style={sx("font-size:15px")}>{ac.name}</div>
                  <span className={ac.trackingTag}>{ac.trackingLabel}</span>
                </div>
                <div className="card-meta">{ac.actId}</div>
                <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-2)")}>
                  <div><div className="text-muted" style={sx("font-size:11px")}>Gasto total</div><div style={sx("font-variant-numeric:tabular-nums")}>{ac.spendLabel}</div></div>
                  <div><div className="text-muted" style={sx("font-size:11px")}>Faturamento</div><div style={sx("font-variant-numeric:tabular-nums")}>{ac.revenueLabel}</div></div>
                  <div><div className="text-muted" style={sx("font-size:11px")}>Campanhas</div><div>{ac.campaigns}</div></div>
                  <div><div className="text-muted" style={sx("font-size:11px")}>ROAS médio</div><div style={sx("color:var(--color-accent-300)")}>{ac.roasLabel}</div></div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {v.newCampaignOpen && (
        <div className="dialog-backdrop" onClick={v.closeNewCampaign}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">Nova campanha</div>
            <div className="dialog-body" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
              <div className="field">
                <label>Conta de anúncio</label>
                <select className="input" value={v.newCampaignAccount} onChange={v.onNewCampaignAccount}>
                  {v.adsAccountOptions.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Nome da campanha</label>
                <input className="input" value={v.newCampaignName} onChange={v.onNewCampaignName} placeholder="Ex.: Vendas — Método Foco" />
              </div>
              <div className="field">
                <label>Objetivo</label>
                <select className="input" value={v.newCampaignObjective} onChange={v.onNewCampaignObjective}>
                  <option value="OUTCOME_TRAFFIC">Tráfego</option>
                  <option value="OUTCOME_SALES">Vendas</option>
                  <option value="OUTCOME_LEADS">Cadastros (Leads)</option>
                  <option value="OUTCOME_ENGAGEMENT">Engajamento</option>
                  <option value="OUTCOME_AWARENESS">Reconhecimento</option>
                </select>
              </div>
              <div className="field">
                <label>Orçamento diário (R$) — opcional</label>
                <input className="input" value={v.newCampaignBudget} onChange={v.onNewCampaignBudget} inputMode="decimal" placeholder="Ex.: 50" />
              </div>
              <p className="text-muted" style={sx("font-size:12px;margin:0")}>A campanha é criada <strong>pausada</strong> no Facebook por segurança. Ative quando estiver pronta.</p>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" type="button" onClick={v.closeNewCampaign}>Cancelar</button>
              <button className="btn btn-primary" type="button" onClick={v.createCampaign} disabled={v.newCampaignBusy || !v.newCampaignName.trim()}>
                {v.newCampaignBusy ? "Criando…" : "Criar campanha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
