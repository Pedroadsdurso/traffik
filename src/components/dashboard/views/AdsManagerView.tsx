import { sx } from "@/lib/sx";
import { ImageSlot } from "../ImageSlot";
import type { TraffikView } from "../useTraffikState";

export function AdsManagerView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div className="seg" style={sx("width:fit-content")}>
        {v.adsTabs.map((t) => (
          <label className="seg-opt" key={t.key}>
            <input type="radio" name="adsview" checked={t.checked} onChange={t.go} />
            <span className="dot" />
            {t.label}
          </label>
        ))}
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
          <select className="input" style={sx("width:auto")}>
            <option>Últimos 7 dias</option>
            <option>Hoje</option>
            <option>Últimos 30 dias</option>
          </select>
          <select className="input" style={sx("width:auto")}>
            <option>Todas as contas</option>
            <option>Método Foco Cursos</option>
            <option>Mentoria Alta Renda</option>
          </select>
          <select className="input" style={sx("width:auto")}>
            <option>Todos os produtos</option>
            <option>Método Foco 3.0</option>
            <option>Mentoria Alta Renda</option>
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
              {v.filteredCampaigns.map((c) => (
                <tr key={c.id}>
                  <td style={sx("max-width:260px")}>{c.name}</td>
                  <td><span className={c.statusTag}>{c.statusLabel}</span></td>
                  <td className="text-muted">{c.budgetLabel}</td>
                  <td style={sx("font-variant-numeric:tabular-nums")}>{c.spendLabel}</td>
                  <td>{c.results}</td>
                  <td className="text-muted">{c.cpaLabel}</td>
                  <td className="text-muted">{c.ctrLabel}</td>
                  <td style={sx("color:var(--color-accent-300)")}>{c.roasLabel}</td>
                  <td>
                    <button className="btn btn-ghost btn-icon" type="button" onClick={c.toggle} aria-label="Alternar status">
                      <svg viewBox="0 0 256 256" width="14" height="14" fill="currentColor" stroke="none">
                        <path d={c.toggleIconPath} />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "adsets" && (
        <div className="card" style={sx("gap:0")}>
          <table className="table">
            <thead>
              <tr><th>Conjunto de anúncios</th><th>Campanha</th><th>Status</th><th>Gasto</th><th>Resultados</th><th>CPA</th><th>CTR</th><th>ROAS</th></tr>
            </thead>
            <tbody>
              {v.filteredAdsets.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td className="text-muted">{a.campaign}</td>
                  <td><span className={a.statusTag}>{a.statusLabel}</span></td>
                  <td style={sx("font-variant-numeric:tabular-nums")}>{a.spendLabel}</td>
                  <td>{a.results}</td>
                  <td className="text-muted">{a.cpaLabel}</td>
                  <td className="text-muted">{a.ctrLabel}</td>
                  <td style={sx("color:var(--color-accent-300)")}>{a.roasLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "ads" && (
        <div className="card" style={sx("gap:0")}>
          <table className="table">
            <thead>
              <tr><th>Anúncio</th><th>Formato</th><th>Status</th><th>Gasto</th><th>Resultados</th><th>CPA</th><th>CTR</th><th>ROAS</th></tr>
            </thead>
            <tbody>
              {v.filteredAds.map((a) => (
                <tr key={a.slotId}>
                  <td>
                    <div style={sx("display:flex;align-items:center;gap:10px")}>
                      <div style={sx("width:56px;height:32px;flex:none;border-radius:var(--radius-sm);overflow:hidden")}>
                        <ImageSlot label={a.format} />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {v.adsSub === "accounts" && (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-4)")}>
          {v.accounts.map((ac) => (
            <div className="card" key={ac.id}>
              <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                <div className="card-title" style={sx("font-size:15px")}>{ac.name}</div>
                <span className={ac.trackingTag}>{ac.trackingLabel}</span>
              </div>
              <div className="card-meta">{ac.actId}</div>
              <div style={sx("display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3);margin-top:var(--space-2)")}>
                <div><div className="text-muted" style={sx("font-size:11px")}>Gasto</div><div style={sx("font-variant-numeric:tabular-nums")}>{ac.spendLabel}</div></div>
                <div><div className="text-muted" style={sx("font-size:11px")}>Campanhas</div><div>{ac.campaigns}</div></div>
                <div><div className="text-muted" style={sx("font-size:11px")}>ROAS</div><div style={sx("color:var(--color-accent-300)")}>{ac.roasLabel}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
