import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function FeesView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:grid;grid-template-columns:1fr 320px;gap:var(--space-4);align-items:start")}>
      <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
        <div className="card">
          <div className="card-kicker">Gateways de pagamento</div>
          <div className="card-title">Taxas por plataforma</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.gatewayRows.map((g) => (
              <div key={g.name} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{g.name}</span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={g.pctStr} onChange={g.onChange} />
                  <span className="text-muted">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-kicker">Impostos</div>
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-top:var(--space-2)")}>
            <span style={sx("font-size:14px")}>Alíquota sobre faturamento (Simples Nacional)</span>
            <div style={sx("display:flex;align-items:center;gap:6px")}>
              <input className="input" style={sx("width:80px;text-align:right")} value={v.taxPctStr} onChange={v.onTaxPct} />
              <span className="text-muted">%</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-kicker">Despesas recorrentes</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)")}>
            {v.despesaRows.map((d) => (
              <div key={d.name} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) 0")}>
                <span style={sx("font-size:14px")}>{d.name}</span>
                <div style={sx("display:flex;align-items:center;gap:10px")}>
                  <span style={sx("font-variant-numeric:tabular-nums")}>{d.valueLabel}/mês</span>
                  <button className="btn btn-ghost btn-icon" type="button" onClick={d.remove} aria-label="Remover">
                    <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round">
                      <line x1="64" y1="64" x2="192" y2="192" />
                      <line x1="192" y1="64" x2="64" y2="192" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2)")}>
              <input className="input" placeholder="Nome da despesa" value={v.newDespesaName} onChange={v.onNewDespesaName} />
              <input className="input" style={sx("width:120px")} placeholder="Valor R$" value={v.newDespesaValue} onChange={v.onNewDespesaValue} />
              <button className="btn btn-secondary" type="button" onClick={v.addDespesa}>Adicionar</button>
            </div>
          </div>
        </div>
      </div>
      <div className="card elev-sm" style={sx("position:sticky;top:var(--space-4)")}>
        <div className="card-kicker">Cálculo de lucro (período atual)</div>
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2);font-size:13px")}>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Faturamento</span><span style={sx("font-variant-numeric:tabular-nums")}>{v.finance.revenue}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Gasto em anúncios</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.spend}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Taxas de gateway</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.gateway}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Impostos</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.tax}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Despesas</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.despesas}</span></div>
          <hr className="hr" style={sx("margin:var(--space-2) 0")} />
          <div style={sx("display:flex;justify-content:space-between;font-size:15px")}><span>Lucro líquido</span><span style={sx("color:var(--color-accent-300);font-variant-numeric:tabular-nums")}>{v.finance.profit}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Margem de lucro</span><span style={sx("font-variant-numeric:tabular-nums")}>{v.finance.margin}</span></div>
        </div>
      </div>
    </div>
  );
}
