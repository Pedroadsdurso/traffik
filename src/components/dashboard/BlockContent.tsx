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
import { Icone, type NomeIcone } from "./ui/Icone";
import { InfoTip } from "./ui/InfoTip";
import { useDensidade } from "./ui/useDensidade";
import { METRICAS } from "@/lib/explicacoes";
import { BLOCK_BY_ID } from "./blocks";
import type { TraffikView } from "./useTraffikState";

/** Envelope comum: todo bloco do grid ocupa 100% da célula e rola por dentro. */
function Bloco({
  children,
  gap0 = false,
  innerRef,
}: {
  children: React.ReactNode;
  gap0?: boolean;
  /** Para o `useDensidade` medir a caixa real do bloco. */
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  // `overflow:hidden` e não `auto`: barra de rolagem dentro de um card de KPI
  // é sintoma de conteúdo que não coube. Quem não cabe deve encolher (ver
  // `useDensidade`), não ganhar scroll. Blocos que legitimamente rolam — feed,
  // tabelas — pedem `gap0` e cuidam da própria rolagem internamente.
  return (
    <div ref={innerRef} className="card"
      style={sx(`height:100%;min-width:0;min-height:0;overflow:${gap0 ? "auto" : "hidden"};${gap0 ? "gap:0;" : ""}`)}>
      {children}
    </div>
  );
}

function KpiBloco({ v, metric }: { v: TraffikView; metric: string }) {
  const { ref, densidade } = useDensidade();
  const k = v.metricCards[metric as keyof typeof v.metricCards];
  if (!k) return null;
  const serie = v.sparklines[metric] ?? [];
  // Ordem de sacrifício quando o espaço aperta: primeiro o sparkline (é
  // enfeite), depois o delta (informação secundária), e o NÚMERO nunca sai —
  // ele é a razão de o bloco existir.
  const mostrarSparkline = densidade === "md" && serie.length > 1;
  const mostrarDelta = densidade !== "xs";
  const tamanhoNumero = densidade === "xs" ? 18 : densidade === "sm" ? 22 : 26;
  return (
    <Bloco innerRef={ref}>
      {/* Hierarquia: label pequeno em cima, número grande no meio, comparação embaixo. */}
      <div className="card-kicker" style={sx("display:flex;align-items:center;gap:4px")}>
        {k.label}
        {/* Explicação da métrica, com fórmula e os valores do período. */}
        {METRICAS[metric] && (
          <InfoTip conteudo={{ ...METRICAS[metric]!, valores: v.valoresMetrica(metric) }} tamanho={12} />
        )}
      </div>
      <div style={sx(`font-family:var(--font-heading);font-weight:500;font-size:${tamanhoNumero}px;line-height:1.1;font-variant-numeric:tabular-nums;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}>
        {k.value}
      </div>
      {(mostrarSparkline || mostrarDelta) && (
        <div style={sx("margin-top:auto;display:flex;flex-direction:column;gap:6px;min-height:0;overflow:hidden")}>
          {mostrarSparkline && <Sparkline valores={serie} />}
          {mostrarDelta && <Delta pct={k.delta} invertido={k.invertido} />}
        </div>
      )}
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
  const icone: NomeIcone =
    n.includes("pix") ? "pix"
    : n.includes("cart") ? "cartao"
    : n.includes("bolet") ? "boleto"
    : "pagamento";
  return <Icone nome={icone} tamanho={14} style={{ opacity: 0.75 }} />;
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

/**
 * Ícone por tipo de evento do feed.
 *
 * ⚠️ **Não recebe cor.** A pílula em volta já pinta `color: <cor do evento>`, e o
 * ícone herda por `currentColor` — o `cor` que existia aqui repassava o mesmo hex
 * duas vezes e seria hoje a única cor solta fora da paleta de `ui/Icone`.
 */
function IconeEvento({ tipo }: { tipo: string }) {
  const icone: NomeIcone =
    tipo === "clique" ? "clique"
    : tipo === "checkout" || tipo === "add_to_cart" ? "carrinho"
    : tipo === "lead" ? "lead"
    : tipo === "pageview" ? "visita"
    : tipo === "venda_aprovada" ? "vendaAprovada"
    : tipo === "venda_pendente" ? "vendaPendente"
    : "aviso";
  return <Icone nome={icone} tamanho={13} />;
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
                      <IconeEvento tipo={f.type} />
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
