import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function RulesView({ v }: { v: TraffikView }) {
  const rf = v.ruleForm;
  const isBudget = rf.action === "aumentar" || rf.action === "reduzir";
  return (
    <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);align-items:start")}>
      <div className="card">
        <div className="card-kicker">Nova regra</div>
        <div className="card-title">Criar automação (Meta)</div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>Nome da regra</label>
          <input className="input" placeholder="Ex: Pausar CPA alto" value={rf.name} onChange={v.onRuleName} />
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>Produto (opcional)</label>
            <select className="input" value={rf.product} onChange={v.onRuleProduct}>
              <option value="todos">Todos</option>
              {v.filterProducts.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Contas de anúncio</label>
            <select className="input" value={rf.account} onChange={v.onRuleAccount}>
              <option value="todas">Todas</option>
              {v.ruleAccountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>Nível de aplicação</label>
          <div className="seg">
            <label className="seg-opt"><input type="radio" name="rulelevel" checked={rf.level === "campanha"} onChange={v.onRuleLevelCampanha} /><span className="dot" />Campanha</label>
            <label className="seg-opt"><input type="radio" name="rulelevel" checked={rf.level === "conjunto"} onChange={v.onRuleLevelConjunto} /><span className="dot" />Conjunto</label>
            <label className="seg-opt"><input type="radio" name="rulelevel" checked={rf.level === "anuncio"} onChange={v.onRuleLevelAnuncio} /><span className="dot" />Anúncio</label>
          </div>
        </div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>Condição</label>
          <div style={sx("display:grid;grid-template-columns:1.2fr .7fr 1fr 1.1fr;gap:var(--space-2)")}>
            <select className="input" value={rf.metric} onChange={v.onRuleMetric}>
              <option>CPA</option><option>ROAS</option><option>CTR</option><option>Gasto</option><option>Vendas</option>
            </select>
            <select className="input" value={rf.op} onChange={v.onRuleOp}>
              <option value=">">&gt;</option><option value="<">&lt;</option><option value="=">=</option>
            </select>
            <input className="input" value={rf.value} onChange={v.onRuleValue} inputMode="decimal" />
            <select className="input" value={rf.window} onChange={v.onRuleWindow}>
              <option value="hoje">Hoje</option>
              <option value="ontem">Ontem</option>
              <option value="ultimas_3h">Últimas 3h</option>
              <option value="ultimas_6h">Últimas 6h</option>
              <option value="ultimos_7d">Últimos 7 dias</option>
            </select>
          </div>
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>Ação</label>
            <select className="input" value={rf.action} onChange={v.onRuleAction}>
              <option value="pausar">Pausar</option>
              <option value="ativar">Ativar</option>
              <option value="aumentar">Aumentar orçamento %</option>
              <option value="reduzir">Reduzir orçamento %</option>
            </select>
          </div>
          {isBudget ? (
            <div className="field">
              <label>Percentual (%)</label>
              <input className="input" value={rf.budgetPct} onChange={v.onRuleBudgetPct} inputMode="decimal" />
            </div>
          ) : (
            <div className="field">
              <label>Limite diário de execuções</label>
              <input className="input" value={rf.dailyLimit} onChange={v.onRuleDailyLimit} inputMode="numeric" />
            </div>
          )}
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>Frequência de checagem</label>
            <select className="input" value={rf.freq} onChange={v.onRuleFreq}>
              <option value="15">A cada 15 min</option>
              <option value="30">A cada 30 min</option>
              <option value="60">A cada 1h</option>
            </select>
          </div>
          {isBudget && (
            <div className="field">
              <label>Limite diário de execuções</label>
              <input className="input" value={rf.dailyLimit} onChange={v.onRuleDailyLimit} inputMode="numeric" />
            </div>
          )}
        </div>
        <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-4)")}>
          <div style={sx("display:flex;align-items:center;gap:10px")}>
            <button className="sw" role="switch" aria-checked={rf.active} onClick={v.onRuleActive} />
            <span style={sx("font-size:13px")}>Ativar ao criar</span>
          </div>
          <button className="btn btn-primary" type="button" onClick={v.addRule} disabled={v.ruleBusy}>
            {v.ruleBusy ? "Criando…" : "Criar regra"}
          </button>
        </div>
      </div>

      <div className="card" style={sx("gap:var(--space-3)")}>
        <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
          <div className="card-kicker" style={sx("margin:0")}>Regras</div>
          <button className="btn btn-secondary" type="button" onClick={v.runRules} disabled={v.ruleRunBusy}>
            {v.ruleRunBusy ? "Executando…" : "Rodar agora"}
          </button>
        </div>
        {v.ruleRunResult && <div className="text-muted" style={sx("font-size:12px")}>{v.ruleRunResult}</div>}

        {v.rules.length === 0 ? (
          <div className="text-muted" style={sx("font-size:13px")}>Nenhuma regra criada ainda.</div>
        ) : (
          v.rules.map((r) => (
            <div key={r.id} style={sx("display:flex;flex-direction:column;gap:8px;padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
              <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3)")}>
                <div style={sx("display:flex;flex-direction:column;gap:4px;min-width:0")}>
                  <div style={sx("font-family:var(--font-heading);font-size:14px")}>{r.name}</div>
                  <div className="text-muted" style={sx("font-size:12px")}>{r.summary}</div>
                  <div style={sx("display:flex;gap:6px;flex-wrap:wrap")}>
                    <span className="tag tag-neutral" style={sx("font-size:10px")}>{r.levelLabel}</span>
                    <span className="tag tag-neutral" style={sx("font-size:10px")}>{r.freq}</span>
                    <span className="tag tag-neutral" style={sx("font-size:10px")}>última: {r.lastRunLabel}</span>
                  </div>
                </div>
                <div style={sx("display:flex;align-items:center;gap:10px;flex-shrink:0")}>
                  <button className="sw" role="switch" aria-checked={r.on} onClick={r.toggle} />
                  <button className="btn btn-ghost" type="button" onClick={r.remove} style={sx("font-size:12px")}>Excluir</button>
                </div>
              </div>
              {r.logs.length > 0 && (
                <div style={sx("display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--color-divider);padding-top:8px")}>
                  {r.logs.map((l) => (
                    <div key={l.id} style={sx("display:flex;align-items:center;gap:8px;font-size:11px")}>
                      <span className={l.statusTag}>{l.statusLabel}</span>
                      <span className="text-muted" style={sx("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.message}</span>
                      <span className="text-muted">{l.timeLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
