"use client";

import { useState } from "react";

import { brl, brl0 } from "@/lib/format";
import { sx } from "@/lib/sx";
import { BarChart, type BarraDado } from "./ui/BarChart";
import { ChartEmpty, Delta, Sparkline, useEntrada } from "./ui/chartKit";
import { AreaChart } from "./ui/AreaChart";
import { CountryMap } from "./ui/CountryMap";
import { Donut } from "./ui/Donut";
import { Funnel } from "./ui/Funnel";
import { InfoTip } from "./ui/InfoTip";
import { METRICAS } from "@/lib/explicacoes";
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
  const serie = v.sparklines[metric] ?? [];
  return (
    <Bloco>
      {/* Hierarquia: label pequeno em cima, número grande no meio, comparação embaixo. */}
      <div className="card-kicker" style={sx("display:flex;align-items:center;gap:4px")}>
        {k.label}
        {/* Explicação da métrica, com fórmula e os valores do período. */}
        {METRICAS[metric] && (
          <InfoTip conteudo={{ ...METRICAS[metric]!, valores: v.valoresMetrica(metric) }} tamanho={12} />
        )}
      </div>
      <div style={sx("font-family:var(--font-heading);font-weight:500;font-size:26px;line-height:1.1;font-variant-numeric:tabular-nums;margin-top:2px")}>
        {k.value}
      </div>
      <div style={sx("margin-top:auto;display:flex;flex-direction:column;gap:6px")}>
        {serie.length > 1 && <Sparkline valores={serie} />}
        <Delta pct={k.delta} invertido={k.invertido} />
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

/** Ícone do método de pagamento. */
function IconePagamento({ nome }: { nome: string }) {
  const n = nome.toLowerCase();
  const d =
    n.includes("pix") ? "M12 2l4 4-4 4-4-4 4-4zm0 12l4 4-4 4-4-4 4-4zM2 12l4-4 4 4-4 4-4-4zm12 0l4-4 4 4-4 4-4-4z"
    : n.includes("cart") ? "M2 7h20v12H2zM2 11h20"
    : n.includes("bolet") ? "M4 5v14M8 5v14M12 5v14M16 5v14M20 5v14"
    : "M12 2a10 10 0 100 20 10 10 0 000-20zM8 12h8";
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none", opacity: 0.75 }}>
      <path d={d} />
    </svg>
  );
}

/**
 * Taxa de aprovação por método. A cor do preenchimento reage ao valor —
 * verde/amarelo/vermelho — porque 30% e 95% de aprovação são situações
 * completamente diferentes e a barra sozinha não comunicava isso.
 */
function AprovacaoBloco({ v }: { v: TraffikView }) {
  const pronto = useEntrada();
  // Mostra sempre os 3 métodos principais, mesmo sem dado: sumir da lista
  // esconderia justamente o método que parou de vender.
  const base = ["Pix", "Cartão", "Boleto"];
  const linhas = [
    ...base.map((nome) => v.approval.find((a) => a.name === nome) ?? { name: nome, geradas: 0, pagas: 0, rate: 0 }),
    ...v.approval.filter((a) => !base.includes(a.name)),
  ];

  return (
    <Bloco>
      <div className="card-kicker">Taxa de aprovação</div>
      <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-2);flex:1;justify-content:center")}>
        {linhas.map((a, i) => {
          const semDado = a.geradas === 0;
          const cor = semDado ? "#4b5563" : a.rate >= 80 ? "#4ade80" : a.rate >= 50 ? "#fbbf24" : "#f87171";
          const corClara = semDado ? "#4b5563" : a.rate >= 80 ? "#86efac" : a.rate >= 50 ? "#fde68a" : "#fca5a5";
          return (
            <div key={a.name} style={sx("display:flex;flex-direction:column;gap:6px")}>
              <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px")}>
                <span style={sx("display:inline-flex;align-items:center;gap:7px")}>
                  <IconePagamento nome={a.name} />
                  {a.name}
                </span>
                <span style={sx("font-variant-numeric:tabular-nums;white-space:nowrap")}>
                  {semDado ? (
                    <span className="text-muted">N/A</span>
                  ) : (
                    <>
                      <strong style={sx(`color:${cor}`)}>{a.rate.toFixed(1).replace(".", ",")}%</strong>{" "}
                      <span className="text-muted">({a.pagas}/{a.geradas})</span>
                    </>
                  )}
                </span>
              </div>
              <div style={sx("position:relative;height:9px;border-radius:999px;background:color-mix(in srgb, var(--color-text) 7%, transparent);overflow:hidden")}>
                <div
                  style={sx(
                    `height:100%;border-radius:999px;width:${pronto ? a.rate : 0}%;` +
                      `background:linear-gradient(90deg, ${cor}, ${corClara});` +
                      `box-shadow:0 0 10px color-mix(in srgb, ${cor} 65%, transparent);` +
                      `transition:width 700ms ${i * 90}ms cubic-bezier(0.22,0.61,0.36,1)`,
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Bloco>
  );
}

/** Ícone por tipo de evento do feed. */
function IconeEvento({ tipo, cor }: { tipo: string; cor: string }) {
  const d =
    tipo === "clique" ? "M9 3l10 7-4.5 1.5L17 17l-2.5 1.5-2.5-5L9 17V3z"
    : tipo === "checkout" || tipo === "add_to_cart" ? "M6 6h15l-1.5 9h-12zM6 6L5 3H2m4 17a1 1 0 100 2 1 1 0 000-2zm11 0a1 1 0 100 2 1 1 0 000-2z"
    : tipo === "lead" ? "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"
    : tipo === "pageview" ? "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z"
    : tipo === "venda_aprovada" ? "M20 6L9 17l-5-5"
    : tipo === "venda_pendente" ? "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    : "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z";
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={cor} strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}>
      <path d={d} />
    </svg>
  );
}

/**
 * Feed de atividade unificado: clique, checkout, venda pendente/aprovada,
 * reembolso e chargeback — antes só existia "venda", porque lia apenas a tabela
 * de vendas. O filtro por tipo é local (os dados já vêm todos).
 */
function FeedBloco({ v }: { v: TraffikView }) {
  const [filtro, setFiltro] = useState<string>("todos");
  const tipos = [...new Set(v.feed.map((f) => f.type))];
  const linhas = filtro === "todos" ? v.feed : v.feed.filter((f) => f.type === filtro);

  return (
    <Bloco gap0>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-2)")}>
        <div className="card-kicker">Atividade recente</div>
        <div style={sx("display:flex;gap:4px;flex-wrap:wrap")}>
          <button type="button" onClick={() => setFiltro("todos")}
            className={filtro === "todos" ? "btn btn-primary" : "btn btn-ghost"}
            style={sx("padding:2px 9px;font-size:11px")}>Todos</button>
          {tipos.map((t) => {
            const meta = v.feed.find((f) => f.type === t)!;
            return (
              <button key={t} type="button" onClick={() => setFiltro(t)}
                className={filtro === t ? "btn btn-primary" : "btn btn-ghost"}
                style={sx("padding:2px 9px;font-size:11px;display:inline-flex;align-items:center;gap:5px")}>
                <span style={sx(`width:6px;height:6px;border-radius:50%;background:${meta.cor}`)} />
                {meta.typeLabel}
              </button>
            );
          })}
        </div>
      </div>

      {linhas.length === 0 ? (
        <ChartEmpty titulo="Nenhum evento no período"
          dica="Cliques, checkouts e vendas aparecem aqui em ordem cronológica." />
      ) : (
        <div style={sx("overflow:auto;flex:1")}>
          <table className="table">
            <thead>
              <tr><th>Evento</th><th>Origem</th><th>Campanha</th><th>Valor</th><th>Quando</th></tr>
            </thead>
            <tbody>
              {linhas.map((f, i) => (
                <tr key={f.id}
                  style={sx(`animation:fade-rise 300ms ${Math.min(i * 18, 260)}ms var(--ease-out) both`)}>
                  <td>
                    <span style={sx(`display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:11px;white-space:nowrap;background:color-mix(in srgb, ${f.cor} 16%, transparent);color:${f.cor}`)}>
                      <IconeEvento tipo={f.type} cor={f.cor} />
                      {f.typeLabel}
                    </span>
                  </td>
                  <td>{f.source}</td>
                  <td className="text-muted">{f.campaign}</td>
                  <td style={sx("font-variant-numeric:tabular-nums")}>{f.valueLabel}</td>
                  <td className="text-muted">{f.timeLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Bloco>
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
            vazio="Nenhuma venda por produto"
            totalLabel={brl0(v.products.reduce((a, p) => a + p.total, 0))}
            fatias={v.products.map((p) => ({ name: p.name, value: p.total, label: p.totalLabel }))}
          />
        </Bloco>
      );

    case "chart:fontes":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por fonte</div>
          <Donut
            vazio="Nenhuma venda por fonte"
            totalLabel={brl0(v.sources.reduce((a, x) => a + x.total, 0))}
            fatias={v.sources.map((x) => ({ name: x.name, value: x.total, label: x.totalLabel }))}
          />
        </Bloco>
      );

    case "chart:pagamentos":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por método de pagamento</div>
          <Donut
            vazio="Nenhuma venda aprovada"
            totalLabel={brl0(v.payments.reduce((a, p) => a + p.total, 0))}
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
      return <AprovacaoBloco v={v} />;

    case "chart:vendasHora":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por horário</div>
          <BarChart
            vazio="Nenhuma venda aprovada no período"
            dicaVazio="As 24 horas aparecem sempre; as barras se preenchem conforme as vendas entram."
            formatarEixo={(n) => String(Math.round(n))}
            dados={v.byHour.map((h): BarraDado => ({
              rotulo: h.hour % 3 === 0 ? `${String(h.hour).padStart(2, "0")}h` : "",
              valor: h.sales,
              titulo: `${String(h.hour).padStart(2, "0")}h00 – ${String((h.hour + 1) % 24).padStart(2, "0")}h00`,
              detalhes: [
                { label: "Vendas", valor: String(h.sales) },
                { label: "Faturamento", valor: brl(h.revenue) },
              ],
            }))}
          />
        </Bloco>
      );

    case "chart:lucroHora":
      return (
        <Bloco>
          <div className="card-kicker">Lucro por horário</div>
          <BarChart
            vazio="Sem lucro apurado no período"
            dicaVazio="O lucro por hora rateia gasto e despesas na proporção do faturamento da hora."
            formatarEixo={(n) => brl0(n)}
            dados={v.byHour.map((h): BarraDado => ({
              rotulo: h.hour % 3 === 0 ? `${String(h.hour).padStart(2, "0")}h` : "",
              valor: Math.max(0, h.profit),
              titulo: `${String(h.hour).padStart(2, "0")}h00 – ${String((h.hour + 1) % 24).padStart(2, "0")}h00`,
              detalhes: [
                { label: "Lucro", valor: brl(h.profit) },
                { label: "Faturamento", valor: brl(h.revenue) },
                { label: "Vendas", valor: String(h.sales) },
              ],
            }))}
          />
        </Bloco>
      );

    case "chart:vendasDia":
      return (
        <Bloco>
          <div className="card-kicker">Vendas por dia</div>
          <BarChart
            vazio="Nenhuma venda aprovada no período"
            dicaVazio="Cada barra é um dia da janela filtrada, no máximo os últimos 30."
            formatarEixo={(n) => String(Math.round(n))}
            dados={v.byDay.map((d): BarraDado => {
              const [ano, m, dia] = d.date.split("-");
              return {
                rotulo: `${dia}/${m}`,
                valor: d.sales,
                titulo: new Date(Number(ano), Number(m) - 1, Number(dia)).toLocaleDateString("pt-BR", {
                  weekday: "long", day: "2-digit", month: "long", year: "numeric",
                }),
                detalhes: [
                  { label: "Vendas", valor: String(d.sales) },
                  { label: "Faturamento", valor: brl(d.revenue) },
                ],
              };
            })}
          />
        </Bloco>
      );

    case "chart:funil":
      return (
        <Bloco>
          <div className="card-kicker">Funil de conversão</div>
          <Funnel etapas={v.funnelStages} ticketMedio={v.ticketMedio} />
        </Bloco>
      );

    case "chart:feed":
      return <FeedBloco v={v} />;

    default:
      return null;
  }
}
