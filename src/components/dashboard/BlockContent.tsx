"use client";

import { sx } from "@/lib/sx";
import { BLOCK_BY_ID } from "./blocks";
import type { TraffikView } from "./useTraffikState";

/** Envelope comum: todo bloco do grid ocupa 100% da célula e rola por dentro. */
function Bloco({ children, gap0 = false }: { children: React.ReactNode; gap0?: boolean }) {
  return (
    <div className="card" style={sx(`height:100%;overflow:auto;${gap0 ? "gap:0;" : ""}`)}>
      {children}
    </div>
  );
}

function KpiBloco({ v, metric }: { v: TraffikView; metric: string }) {
  const k = v.metricCards[metric as keyof typeof v.metricCards];
  if (!k) return null;
  return (
    <Bloco>
      <div className="card-kicker">{k.label}</div>
      <div style={sx("font-family:var(--font-heading);font-weight:500;font-size:24px;font-variant-numeric:tabular-nums")}>
        {k.value}
      </div>
      <div style={sx(`display:flex;align-items:center;gap:5px;font-size:12px;color:${k.trendColor}`)}>
        <svg viewBox="0 0 256 256" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round">
          <path d={k.trendPath} />
        </svg>
        <span>{k.trendLabel}</span>
      </div>
    </Bloco>
  );
}

/** Barra rotulada reutilizada por produto / fonte / pagamento. */
function Barras({
  linhas,
  cor,
  vazio,
}: {
  linhas: { key: string; titulo: React.ReactNode; direita: string; largura: string; sub?: string }[];
  cor: string;
  vazio?: string;
}) {
  if (linhas.length === 0 && vazio) {
    return <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>{vazio}</div>;
  }
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-2)")}>
      {linhas.map((l) => (
        <div key={l.key} style={sx("display:flex;flex-direction:column;gap:5px")}>
          <div style={sx("display:flex;justify-content:space-between;font-size:13px;gap:8px")}>
            <span>{l.titulo}</span>
            <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>{l.direita}</span>
          </div>
          <div style={sx("height:6px;border-radius:3px;background:var(--color-neutral-800);overflow:hidden")}>
            <div style={sx(`height:100%;background:${cor};width:${l.largura}`)} />
          </div>
          {l.sub && <div className="text-muted" style={sx("font-size:11px")}>{l.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Renderiza o conteúdo de um bloco a partir do seu id. */
export function BlockContent({ id, v }: { id: string; v: TraffikView }) {
  const def = BLOCK_BY_ID.get(id);
  if (!def) return null;

  if (def.kind === "kpi" && def.metric) return <KpiBloco v={v} metric={def.metric} />;

  switch (id) {
    case "chart:receita":
      return (
        <Bloco>
          <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
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
          {/* preserveAspectRatio="none" faz o gráfico acompanhar a altura do bloco */}
          <svg viewBox="0 0 600 180" preserveAspectRatio="none" style={{ width: "100%", flex: 1, minHeight: 90 }}>
            <polygon points={v.chart.revenueArea} fill="var(--color-accent-800)" opacity={0.35} />
            <polyline points={v.chart.spendLine} fill="none" stroke="var(--color-neutral-600)" strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <polyline points={v.chart.revenueLine} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            <circle cx={v.chart.lastX} cy={v.chart.lastY} r={4} fill="var(--color-accent)">
              <animate attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </svg>
        </Bloco>
      );

    case "chart:produtos":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por produto</div>
          <Barras
            cor="var(--color-accent)"
            vazio="Nenhuma venda no período."
            linhas={v.products.map((p) => ({ key: p.name, titulo: p.name, direita: p.totalLabel, largura: p.barWidth, sub: `${p.sales} vendas` }))}
          />
        </Bloco>
      );

    case "chart:fontes":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por fonte</div>
          <Barras
            cor="var(--color-accent-500)"
            vazio="Nenhuma venda no período."
            linhas={v.sources.map((s) => ({ key: s.name, titulo: s.name, direita: `${s.totalLabel} · ${s.pctLabel}`, largura: s.barWidth }))}
          />
        </Bloco>
      );

    case "chart:pagamentos":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por pagamento</div>
          <Barras
            cor="var(--color-accent-2-500)"
            vazio="Nenhuma venda aprovada no período."
            linhas={v.payments.map((p) => ({
              key: p.name,
              titulo: (
                <>
                  {p.name} <span className="text-muted">· {p.count} vendas</span>
                </>
              ),
              direita: `${p.totalLabel} · ${p.pctLabel}`,
              largura: p.barWidth,
            }))}
          />
        </Bloco>
      );

    case "chart:funil":
      return (
        <Bloco>
          <div className="card-kicker">Funil de conversão</div>
          <div style={sx("display:flex;align-items:flex-end;gap:var(--space-4);margin-top:var(--space-3);flex:1")}>
            {v.funnel.map((stage) => (
              <div key={stage.label} style={sx("flex:1;display:flex;flex-direction:column;align-items:center;gap:8px")}>
                <div style={sx("font-family:var(--font-heading);font-size:22px;font-variant-numeric:tabular-nums")}>{stage.count}</div>
                <div style={sx(`width:100%;background:${stage.color};border-radius:var(--radius-sm);height:${stage.height}`)} />
                <div className="text-muted" style={sx("font-size:12px;text-align:center")}>{stage.label}</div>
                {stage.hasRate && <span className="tag tag-outline" style={sx("font-size:10px")}>{stage.rate} conv.</span>}
              </div>
            ))}
          </div>
        </Bloco>
      );

    case "chart:feed":
      return (
        <Bloco gap0>
          <div className="card-kicker" style={sx("margin-bottom:var(--space-2)")}>Atividade recente</div>
          <table className="table">
            <thead>
              <tr><th>Evento</th><th>Origem</th><th>Campanha</th><th>Valor</th><th>Quando</th></tr>
            </thead>
            <tbody>
              {v.feed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted" style={sx("padding:var(--space-3);font-size:13px")}>
                    {v.dashLoading ? "Carregando atividade…" : "Nenhum clique ou venda no período. Use o checkout de teste para gerar dados."}
                  </td>
                </tr>
              ) : (
                v.feed.map((f) => (
                  <tr key={f.id}>
                    <td><span className={f.tagClass}>{f.typeLabel}</span></td>
                    <td>{f.source}</td>
                    <td className="text-muted">{f.campaign}</td>
                    <td style={sx("font-variant-numeric:tabular-nums")}>{f.valueLabel}</td>
                    <td className="text-muted">{f.timeLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Bloco>
      );

    default:
      return null;
  }
}
