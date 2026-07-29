"use client";

import { useState, useTransition } from "react";

import { setMyTimezone } from "@/lib/actions/profile";
import { CONFIG } from "@/lib/explicacoes";
import { sx } from "@/lib/sx";
import { InfoTip } from "../ui/InfoTip";
import { TIMEZONE_OPTIONS, partsInTz } from "@/lib/timezone";
import type { TraffikView } from "../useTraffikState";

/**
 * Fuso de referência da conta. Fica aqui porque esta é a tela de configuração
 * que já existe (taxas, impostos, despesas) e o fuso é da mesma natureza: um
 * parâmetro que muda como todo número do produto é calculado.
 *
 * Mostra a hora atual no fuso escolhido — é a única forma de o usuário conferir
 * que acertou sem esperar o dashboard virar o dia.
 */
function CardFusoHorario({ inicial }: { inicial: string }) {
  const [tz, setTz] = useState(inicial);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const p = partsInTz(new Date(), tz);
  const agora = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const dia = `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;

  function aplicar(valor: string) {
    setTz(valor);
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      const r = await setMyTimezone(valor);
      if (r.ok) {
        setSalvo(true);
        // Os dados do dashboard são buscados no servidor com o fuso ANTIGO;
        // recarregar é o caminho honesto de repintar tudo com o novo.
        setTimeout(() => window.location.reload(), 600);
      } else {
        setErro(r.error ?? "Não foi possível salvar.");
        setTz(inicial);
      }
    });
  }

  return (
    <div className="card elev-sm">
      <div className="card-kicker" style={sx("display:flex;align-items:center;gap:4px")}>
        Fuso horário
        <InfoTip conteudo={CONFIG.fusoHorario!} tamanho={12} />
      </div>
      <div className="card-title">Referência de dia e hora</div>
      <p className="text-muted" style={sx("font-size:12px;margin-top:var(--space-2);line-height:1.5")}>
        Define onde o dia começa e termina em todos os relatórios — dashboard, vendas
        por horário, vendas por dia e os filtros de período.
      </p>
      <select
        className="input"
        style={sx("width:100%;margin-top:var(--space-3)")}
        value={tz}
        disabled={pendente}
        onChange={(e) => aplicar(e.target.value)}
      >
        {/* Um fuso salvo fora da lista (via API) continua selecionável. */}
        {!TIMEZONE_OPTIONS.some((o) => o.value === tz) && <option value={tz}>{tz}</option>}
        {TIMEZONE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div style={sx("display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);font-size:12px")}>
        <span className="text-muted">Agora neste fuso</span>
        <span style={sx("font-variant-numeric:tabular-nums")}>{dia} · {agora}</span>
      </div>
      {salvo && !erro && (
        <div style={sx("font-size:12px;color:var(--color-accent-300);margin-top:var(--space-2)")}>
          Salvo — recarregando os dados…
        </div>
      )}
      {erro && <div style={sx("font-size:12px;color:var(--color-danger, #f87171);margin-top:var(--space-2)")}>{erro}</div>}
    </div>
  );
}

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
            {/* Só a despesa recorrente oferece a escolha. Taxa de gateway e
                imposto são globais por natureza — uma caixa neles convidaria a
                prender a uma área justamente o que, se prendido, sumiria da
                conta de lucro das outras em silêncio. */}
            <label style={sx("display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;cursor:pointer")}>
              <input type="checkbox" checked={v.despesaSoNestaArea} onChange={v.toggleDespesaSoNestaArea} />
              <span className="text-muted">
                Só nesta Área de Trabalho{" "}
                {v.despesaSoNestaArea
                  ? "— não entra no lucro das outras áreas."
                  : "(desmarcado: vale para todas as áreas)"}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:var(--space-4)")}>
      <CardFusoHorario inicial={v.timezone} />

      <div className="card elev-sm">
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
    </div>
  );
}
