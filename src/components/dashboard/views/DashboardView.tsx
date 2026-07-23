import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function DashboardView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-6)")}>
      <div style={sx("display:flex;align-items:flex-end;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap")}>
        <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
          <div style={sx("display:flex;flex-direction:column;gap:3px")}>
            <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Período</span>
            <select className="input" style={sx("width:auto")} value={v.dashPeriod} onChange={v.onDashPeriod}>
              <option value="hoje">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div style={sx("display:flex;flex-direction:column;gap:3px")}>
            <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Conta de anúncio</span>
            <select className="input" style={sx("width:auto")} value={v.dashAccount} onChange={v.onDashAccount}>
              <option value="todas">Todas as contas</option>
              <option value="metodofoco">Método Foco Cursos</option>
              <option value="mentoria">Mentoria Alta Renda</option>
            </select>
          </div>
          <div style={sx("display:flex;flex-direction:column;gap:3px")}>
            <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Produto</span>
            <select className="input" style={sx("width:auto")} value={v.dashProduct} onChange={v.onDashProduct}>
              <option value="todos">Todos os produtos</option>
              <option value="metodo">Método Foco 3.0</option>
              <option value="mentoria">Mentoria Alta Renda</option>
              <option value="ebook">E-book Gatilhos</option>
            </select>
          </div>
          <div style={sx("display:flex;flex-direction:column;gap:3px")}>
            <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>Fonte de tráfego</span>
            <select className="input" style={sx("width:auto")} value={v.dashSource} onChange={v.onDashSource}>
              <option value="todas">Todas as fontes</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="organico">Orgânico</option>
            </select>
          </div>
        </div>
        <button className="btn btn-secondary" type="button" onClick={v.openEditDash}>
          <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round">
            <line x1="40" y1="80" x2="216" y2="80" />
            <circle cx="96" cy="80" r="18" fill="var(--color-surface)" />
            <line x1="40" y1="176" x2="216" y2="176" />
            <circle cx="168" cy="176" r="18" fill="var(--color-surface)" />
          </svg>
          Editar dashboard
        </button>
      </div>

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:var(--space-4)")}>
        {v.kpiCards.map((k) => (
          <div className="card" key={k.label}>
            <div className="card-kicker">{k.label}</div>
            <div style={sx("font-family:var(--font-heading);font-weight:500;font-size:24px;font-variant-numeric:tabular-nums")}>{k.value}</div>
            <div style={sx(`display:flex;align-items:center;gap:5px;font-size:12px;color:${k.trendColor}`)}>
              <svg viewBox="0 0 256 256" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
                <path d={k.trendPath} />
              </svg>
              <span>{k.trendLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={sx("gap:var(--space-4)")}>
        <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
          <div>
            <div className="card-kicker">{v.chartPeriodLabel}</div>
            <div className="card-title">Faturamento vs. gasto em anúncios</div>
          </div>
          <div style={sx("display:flex;gap:var(--space-4);font-size:12px")}>
            <span style={sx("display:flex;align-items:center;gap:6px")}>
              <span style={sx("width:8px;height:8px;border-radius:50%;background:var(--color-accent)")} />
              Faturamento
            </span>
            <span style={sx("display:flex;align-items:center;gap:6px;opacity:.7")}>
              <span style={sx("width:8px;height:8px;border-radius:50%;background:var(--color-neutral-500)")} />
              Gasto
            </span>
          </div>
        </div>
        <svg viewBox="0 0 600 180" style={{ width: "100%", height: 180 }}>
          <polygon points={v.chart.revenueArea} fill="var(--color-accent-800)" opacity={0.35} />
          <polyline points={v.chart.spendLine} fill="none" stroke="var(--color-neutral-600)" strokeWidth={2} strokeDasharray="4 4" />
          <polyline points={v.chart.revenueLine} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
          <circle cx={v.chart.lastX} cy={v.chart.lastY} r={4} fill="var(--color-accent)">
            <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)")}>
        <div className="card">
          <div className="card-kicker">Vendas por produto</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-2)")}>
            {v.products.map((p) => (
              <div key={p.name} style={sx("display:flex;flex-direction:column;gap:5px")}>
                <div style={sx("display:flex;justify-content:space-between;font-size:13px")}>
                  <span>{p.name}</span>
                  <span style={sx("font-variant-numeric:tabular-nums")}>{p.totalLabel}</span>
                </div>
                <div style={sx("height:6px;border-radius:3px;background:var(--color-neutral-800);overflow:hidden")}>
                  <div style={sx(`height:100%;background:var(--color-accent);width:${p.barWidth}`)} />
                </div>
                <div className="text-muted" style={sx("font-size:11px")}>{p.sales} vendas</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-kicker">Vendas por fonte</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-2)")}>
            {v.sources.map((src) => (
              <div key={src.name} style={sx("display:flex;flex-direction:column;gap:5px")}>
                <div style={sx("display:flex;justify-content:space-between;font-size:13px")}>
                  <span>{src.name}</span>
                  <span style={sx("font-variant-numeric:tabular-nums")}>{src.totalLabel} · {src.pctLabel}</span>
                </div>
                <div style={sx("height:6px;border-radius:3px;background:var(--color-neutral-800);overflow:hidden")}>
                  <div style={sx(`height:100%;background:var(--color-accent-500);width:${src.barWidth}`)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-kicker">Funil de conversão</div>
        <div style={sx("display:flex;align-items:flex-end;gap:var(--space-4);margin-top:var(--space-3)")}>
          {v.funnel.map((stage) => (
            <div key={stage.label} style={sx("flex:1;display:flex;flex-direction:column;align-items:center;gap:8px")}>
              <div style={sx("font-family:var(--font-heading);font-size:22px;font-variant-numeric:tabular-nums")}>{stage.count}</div>
              <div style={sx(`width:100%;background:${stage.color};border-radius:var(--radius-sm);height:${stage.height}`)} />
              <div className="text-muted" style={sx("font-size:12px;text-align:center")}>{stage.label}</div>
              {stage.hasRate && <span className="tag tag-outline" style={sx("font-size:10px")}>{stage.rate} conv.</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={sx("gap:0")}>
        <div className="card-kicker" style={sx("margin-bottom:var(--space-2)")}>Atividade recente</div>
        <table className="table">
          <thead>
            <tr><th>Evento</th><th>Origem</th><th>Campanha</th><th>Valor</th><th>Quando</th></tr>
          </thead>
          <tbody>
            {v.feed.map((f) => (
              <tr key={f.id}>
                <td><span className={f.tagClass}>{f.typeLabel}</span></td>
                <td>{f.source}</td>
                <td className="text-muted">{f.campaign}</td>
                <td style={sx("font-variant-numeric:tabular-nums")}>{f.valueLabel}</td>
                <td className="text-muted">{f.timeLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
