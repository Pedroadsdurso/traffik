import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-icon" type="button" onClick={onClick} aria-label="Remover">
      <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round">
        <line x1="64" y1="64" x2="192" y2="192" />
        <line x1="192" y1="64" x2="64" y2="192" />
      </svg>
    </button>
  );
}

export function FeesView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:grid;grid-template-columns:1fr 320px;gap:var(--space-4);align-items:start")}>
      <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
        <div className="card">
          <div className="card-kicker">Gateways de pagamento</div>
          <div className="card-title">Taxas por forma de pagamento</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.gatewayExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px")}>Nenhuma taxa de gateway cadastrada.</div>
            )}
            {v.gatewayExpenses.map((g) => (
              <div key={g.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{g.name} <span className="text-muted">· {g.methodLabel}</span></span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={g.amountStr} onChange={g.onChange} onBlur={g.commit} inputMode="decimal" />
                  <span className="text-muted">{g.unit}</span>
                  <RemoveBtn onClick={g.remove} />
                </div>
              </div>
            ))}
            <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2)")}>
              <select className="input" style={sx("width:auto")} value={v.newGatewayMethod} onChange={v.onNewGatewayMethod}>
                <option value="PIX">Pix</option>
                <option value="CARTAO">Cartão</option>
                <option value="BOLETO">Boleto</option>
                <option value="OUTRO">Todas</option>
              </select>
              <input className="input" style={sx("width:100px")} placeholder="% taxa" value={v.newGatewayPct} onChange={v.onNewGatewayPct} inputMode="decimal" />
              <button className="btn btn-secondary" type="button" onClick={v.addGateway}>Adicionar</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Impostos</div>
          <div className="card-title">Alíquotas sobre o faturamento</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.taxExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px")}>Nenhum imposto cadastrado.</div>
            )}
            {v.taxExpenses.map((t) => (
              <div key={t.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{t.name}</span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={t.amountStr} onChange={t.onChange} onBlur={t.commit} inputMode="decimal" />
                  <span className="text-muted">%</span>
                  <RemoveBtn onClick={t.remove} />
                </div>
              </div>
            ))}
            <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2)")}>
              <input className="input" placeholder="Nome (ex.: Simples Nacional)" value={v.newTaxName} onChange={v.onNewTaxName} />
              <input className="input" style={sx("width:100px")} placeholder="% alíquota" value={v.newTaxPct} onChange={v.onNewTaxPct} inputMode="decimal" />
              <button className="btn btn-secondary" type="button" onClick={v.addTax}>Adicionar</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Despesas recorrentes</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)")}>
            {v.despesaRows.map((d) => (
              <div key={d.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) 0")}>
                <span style={sx("font-size:14px")}>{d.name}</span>
                <div style={sx("display:flex;align-items:center;gap:10px")}>
                  <span style={sx("font-variant-numeric:tabular-nums")}>{d.valueLabel}/mês</span>
                  <RemoveBtn onClick={d.remove} />
                </div>
              </div>
            ))}
            <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-2)")}>
              <input className="input" placeholder="Nome da despesa" value={v.newDespesaName} onChange={v.onNewDespesaName} />
              <input className="input" style={sx("width:120px")} placeholder="Valor R$" value={v.newDespesaValue} onChange={v.onNewDespesaValue} inputMode="decimal" />
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
