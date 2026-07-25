"use client";

import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { AreaChart } from "./ui/AreaChart";
import { CountryMap } from "./ui/CountryMap";
import { Donut } from "./ui/Donut";
import { Funnel } from "./ui/Funnel";
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

/**
 * Barras verticais (Bloco 4). Escala pelo maior valor; barras zeradas viram um
 * traço de 2px para a lacuna ser legível em vez de sumir.
 */
function BarrasVerticais({
  dados,
  cor,
  formatar,
  vazio,
}: {
  dados: { rotulo: string; valor: number; titulo: string }[];
  cor: string;
  formatar: (v: number) => string;
  vazio: string;
}) {
  const max = Math.max(0, ...dados.map((d) => d.valor));
  if (max <= 0) {
    return <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>{vazio}</div>;
  }
  return (
    // `justify-content:flex-start` + largura máxima por barra: com poucos pontos
    // (ex.: um único dia) uma barra esticada na largura toda vira um bloco
    // sólido, que não se lê como gráfico.
    <div style={sx("display:flex;align-items:flex-end;justify-content:flex-start;gap:2px;flex:1;min-height:80px;margin-top:var(--space-2)")}>
      {dados.map((d, i) => (
        <div key={i} style={sx("flex:1;max-width:56px;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end")}
          title={`${d.titulo}: ${formatar(d.valor)}`}>
          <div
            style={sx(
              `width:100%;border-radius:2px 2px 0 0;background:${cor};height:${Math.max(2, (d.valor / max) * 100)}%;transition:height var(--dur-base) var(--ease-out)`,
            )}
          />
          <span className="text-muted" style={sx("font-size:9px;white-space:nowrap")}>{d.rotulo}</span>
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
          <AreaChart serie={v.chartSerie} />
        </Bloco>
      );

    case "chart:produtos":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por produto</div>
          <Donut
            vazio="Nenhuma venda no período."
            fatias={v.products.map((p) => ({ name: p.name, value: p.total, label: p.totalLabel }))}
          />
        </Bloco>
      );

    case "chart:fontes":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por fonte</div>
          <Donut
            vazio="Nenhuma venda no período."
            fatias={v.sources.map((x) => ({ name: x.name, value: x.total, label: x.totalLabel }))}
          />
        </Bloco>
      );

    case "chart:pagamentos":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por método de pagamento</div>
          <Donut
            vazio="Nenhuma venda aprovada no período."
            fatias={v.payments.map((p) => ({ name: p.name, value: p.total, label: p.totalLabel }))}
          />
        </Bloco>
      );

    case "chart:paises":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por país</div>
          <CountryMap dados={v.byCountry} />
        </Bloco>
      );

    case "chart:aprovacao":
      return (
        <Bloco>
          <div className="card-kicker">Taxa de aprovação</div>
          {v.approval.length === 0 ? (
            <div className="text-muted" style={sx("font-size:13px;padding:var(--space-2) 0")}>
              Nenhum evento de venda no período.
            </div>
          ) : (
            <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-2)")}>
              {v.approval.map((a) => (
                <div key={a.name} style={sx("display:flex;flex-direction:column;gap:4px")}>
                  <div style={sx("display:flex;justify-content:space-between;font-size:12.5px;gap:8px")}>
                    <span>{a.name}</span>
                    <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>
                      <strong>{a.rate.toFixed(1).replace(".", ",")}%</strong>{" "}
                      <span className="text-muted">({a.pagas}/{a.geradas})</span>
                    </span>
                  </div>
                  <div style={sx("height:8px;border-radius:4px;background:var(--color-neutral-800);overflow:hidden")}>
                    <div style={sx(`height:100%;border-radius:4px;background:var(--color-accent);width:${a.rate}%;transition:width var(--dur-base) var(--ease-out)`)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Bloco>
      );

    case "chart:vendasHora":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por horário</div>
          <BarrasVerticais
            cor="var(--color-accent)"
            vazio="Nenhuma venda aprovada no período."
            formatar={(n) => `${n} venda(s)`}
            // Rótulo a cada 3h para não virar sopa de números em bloco estreito.
            dados={v.byHour.map((h) => ({
              rotulo: h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : "",
              valor: h.sales,
              titulo: `${String(h.hour).padStart(2, "0")}h`,
            }))}
          />
        </Bloco>
      );

    case "chart:lucroHora":
      return (
        <Bloco>
          <div className="card-kicker">Lucro por horário</div>
          <BarrasVerticais
            cor="var(--color-accent-2-500)"
            vazio="Sem lucro apurado no período."
            formatar={(n) => brl(n)}
            dados={v.byHour.map((h) => ({
              rotulo: h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : "",
              valor: h.profit,
              titulo: `${String(h.hour).padStart(2, "0")}h`,
            }))}
          />
        </Bloco>
      );

    case "chart:vendasDia":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por dia</div>
          <BarrasVerticais
            cor="var(--color-accent-500)"
            vazio="Nenhuma venda aprovada no período."
            formatar={(n) => `${n} venda(s)`}
            dados={v.byDay.map((d) => {
              const [, m, dia] = d.date.split("-");
              return { rotulo: `${dia}/${m}`, valor: d.sales, titulo: `${dia}/${m}` };
            })}
          />
        </Bloco>
      );

    case "chart:funil":
      return (
        <Bloco>
          <div className="card-kicker">Funil de conversão</div>
          <Funnel etapas={v.funnelStages} />
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
