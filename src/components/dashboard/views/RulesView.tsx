import { sx } from "@/lib/sx";
import type { TraffikView } from "../useTraffikState";

export function RulesView({ v }: { v: TraffikView }) {
  const rf = v.ruleForm;
  return (
    <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);align-items:start")}>
      <div className="card">
        <div className="card-kicker">Nova regra</div>
        <div className="card-title">Criar automação</div>
        <div className="field" style={sx("margin-top:var(--space-3)")}>
          <label>Nome da regra</label>
          <input className="input" placeholder="Ex: Pausar CPA alto" value={rf.name} onChange={v.onRuleName} />
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>Produto</label>
            <select className="input" value={rf.product} onChange={v.onRuleProduct}>
              <option value="todos">Todos</option>
              <option value="metodo">Método Foco 3.0</option>
              <option value="mentoria">Mentoria Alta Renda</option>
            </select>
          </div>
          <div className="field">
            <label>Contas de anúncio</label>
            <select className="input" value={rf.account} onChange={v.onRuleAccount}>
              <option value="todas">Todas</option>
              <option value="metodofoco">Método Foco Cursos</option>
              <option value="mentoria">Mentoria Alta Renda</option>
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
          <div style={sx("display:grid;grid-template-columns:1.2fr .7fr 1fr 1fr;gap:var(--space-2)")}>
            <select className="input" value={rf.metric} onChange={v.onRuleMetric}>
              <option>CPA</option><option>ROAS</option><option>CTR</option><option>Gasto</option><option>Vendas</option>
            </select>
            <select className="input" value={rf.op} onChange={v.onRuleOp}>
              <option value=">">&gt;</option><option value="<">&lt;</option><option value="=">=</option>
            </select>
            <input className="input" value={rf.value} onChange={v.onRuleValue} />
            <select className="input" value={rf.window} onChange={v.onRuleWindow}>
              <option value="1h">1h</option><option value="3h">3h</option><option value="6h">6h</option><option value="24h">24h</option>
            </select>
          </div>
        </div>
        <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-3)")}>
          <div className="field">
            <label>Ação</label>
            <select className="input" value={rf.action} onChange={v.onRuleAction}>
              <option value="pausar">Pausar</option>
              <option value="aumentar">Aumentar orçamento 20%</option>
              <option value="reduzir">Reduzir orçamento 20%</option>
              <option value="notificar">Enviar notificação</option>
            </select>
          </div>
          <div className="field">
            <label>Frequência de checagem</label>
            <select className="input" value={rf.freq} onChange={v.onRuleFreq}>
              <option value="15min">A cada 15 min</option>
              <option value="30min">A cada 30 min</option>
              <option value="1h">A cada 1h</option>
            </select>
          </div>
        </div>
        <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-top:var(--space-4)")}>
          <div style={sx("display:flex;align-items:center;gap:10px")}>
            <button className="sw" role="switch" aria-checked={rf.active} onClick={v.onRuleActive} />
            <span style={sx("font-size:13px")}>Ativar ao criar</span>
          </div>
          <button className="btn btn-primary" type="button" onClick={v.addRule}>Criar regra</button>
        </div>
      </div>

      <div className="card" style={sx("gap:var(--space-3)")}>
        <div className="card-kicker">Regras ativas</div>
        {v.rules.map((r) => (
          <div key={r.id} style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg)")}>
            <div style={sx("display:flex;flex-direction:column;gap:4px")}>
              <div style={sx("font-family:var(--font-heading);font-size:14px")}>{r.name}</div>
              <div className="text-muted" style={sx("font-size:12px")}>{r.summary}</div>
              <span className="tag tag-neutral" style={sx("width:fit-content;font-size:10px")}>{r.freq}</span>
            </div>
            <button className="sw" role="switch" aria-checked={r.on} onClick={r.toggle} />
          </div>
        ))}
      </div>
    </div>
  );
}
