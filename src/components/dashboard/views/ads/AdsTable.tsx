"use client";

import { brl, brl0, pct } from "@/lib/format";
import { derivar, somar, type LinhaBase } from "@/lib/ads/metrics";
import { sx } from "@/lib/sx";

export interface LinhaTabela extends LinhaBase {
  id: string;
  fbId: string;
  nome: string;
  status: string;
  /** Subtítulo da coluna nome (ex.: campanha do conjunto). */
  sub?: string;
  bidCap?: number | null;
  orcamento?: number | null;
}

/** Colunas de métrica, na ordem pedida no Bloco 6. */
const COLUNAS: { chave: string; label: string; dica?: string }[] = [
  { chave: "vendas", label: "Vendas" },
  { chave: "cpa", label: "CPA", dica: "Gasto ÷ vendas" },
  { chave: "faturamento", label: "Faturamento" },
  { chave: "lucro", label: "Lucro", dica: "Faturamento − gasto (bruto, sem taxas)" },
  { chave: "roas", label: "ROAS", dica: "Faturamento ÷ gasto" },
  { chave: "roi", label: "ROI", dica: "Lucro ÷ gasto" },
  { chave: "ic", label: "IC", dica: "Initiate Checkout — ainda sem atribuição por campanha" },
  { chave: "cpi", label: "CPI", dica: "Custo por Initiate Checkout — depende do IC" },
  { chave: "cpc", label: "CPC", dica: "Gasto ÷ cliques" },
  { chave: "ctr", label: "CTR", dica: "Cliques ÷ impressões" },
  { chave: "cpm", label: "CPM", dica: "Gasto por mil impressões" },
  { chave: "impressoes", label: "Impressões" },
  { chave: "cliques", label: "Cliques" },
  { chave: "bid", label: "Bid Cap" },
];

const traco = <span style={sx("opacity:.35")}>—</span>;
const n0 = (v: number) => v.toLocaleString("pt-BR");

export function AdsTable({
  linhas,
  selecionadas,
  onSelecionar,
  onSelecionarTodas,
  onToggleStatus,
  fixadas,
  carregando,
  vazio,
}: {
  linhas: LinhaTabela[];
  selecionadas: Set<string>;
  onSelecionar: (id: string) => void;
  onSelecionarTodas: () => void;
  onToggleStatus: (id: string) => void;
  /** Ids fixados sobem para o topo (ação "Fixar" do Bloco 7). */
  fixadas: Set<string>;
  carregando: boolean;
  vazio: string;
}) {
  const todasMarcadas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.id));
  const totais = somar(linhas);
  const md = derivar(totais);

  const ordenadas = [...linhas].sort((a, b) => {
    const fa = fixadas.has(a.id) ? 1 : 0;
    const fb = fixadas.has(b.id) ? 1 : 0;
    return fb - fa;
  });

  return (
    <div className="ads-scroll">
      <table className="ads-table">
        <thead>
          <tr>
            <th className="fixa fixa-1">
              <input type="checkbox" checked={todasMarcadas} onChange={onSelecionarTodas}
                aria-label="Selecionar todas as linhas" />
            </th>
            <th className="fixa fixa-2">Status</th>
            <th className="fixa fixa-3">Nome</th>
            {COLUNAS.map((c) => (
              <th key={c.chave} title={c.dica} style={sx("text-align:right;white-space:nowrap")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {ordenadas.length === 0 ? (
            <tr>
              <td colSpan={3 + COLUNAS.length} className="text-muted" style={sx("padding:var(--space-4);font-size:13px;text-align:center")}>
                {carregando ? "Carregando…" : vazio}
              </td>
            </tr>
          ) : (
            ordenadas.map((l) => {
              const m = derivar(l);
              const ativo = l.status === "ACTIVE";
              const marcada = selecionadas.has(l.id);
              return (
                <tr key={l.id} className={marcada ? "linha-marcada" : undefined}>
                  <td className="fixa fixa-1">
                    <input type="checkbox" checked={marcada} onChange={() => onSelecionar(l.id)}
                      aria-label={`Selecionar ${l.nome}`} />
                  </td>
                  <td className="fixa fixa-2">
                    {/* Toggle deslizante, não play/pause — Bloco 6, item 3. */}
                    <button className="sw" role="switch" aria-checked={ativo}
                      onClick={() => onToggleStatus(l.id)}
                      aria-label={`${ativo ? "Pausar" : "Ativar"} ${l.nome}`} />
                  </td>
                  <td className="fixa fixa-3">
                    <div style={sx("display:flex;align-items:center;gap:6px;min-width:0")}>
                      {fixadas.has(l.id) && <span title="Fixada no topo" aria-hidden>📌</span>}
                      <div style={sx("min-width:0")}>
                        <div style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px")}>{l.nome}</div>
                        {l.sub && <div className="text-muted" style={sx("font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.sub}</div>}
                      </div>
                    </div>
                  </td>

                  <td>{n0(l.results)}</td>
                  <td>{m.cpa != null ? brl(m.cpa) : traco}</td>
                  <td>{brl(l.revenue)}</td>
                  <td style={sx(`color:${m.lucro > 0 ? "#4ade80" : m.lucro < 0 ? "#f87171" : "inherit"}`)}>{brl(m.lucro)}</td>
                  <td>{m.roas != null ? `${m.roas.toFixed(2).replace(".", ",")}x` : traco}</td>
                  <td>{m.roi != null ? `${m.roi.toFixed(2).replace(".", ",")}x` : traco}</td>
                  <td>{traco}</td>
                  <td>{traco}</td>
                  <td>{m.cpc != null ? brl(m.cpc) : traco}</td>
                  <td>{m.ctr != null ? pct(m.ctr) : traco}</td>
                  <td>{m.cpm != null ? brl(m.cpm) : traco}</td>
                  <td>{n0(l.impressions)}</td>
                  <td>{n0(l.clicks)}</td>
                  <td>{l.bidCap != null ? brl(l.bidCap) : traco}</td>
                </tr>
              );
            })
          )}
        </tbody>

        {ordenadas.length > 0 && (
          <tfoot>
            <tr>
              <td className="fixa fixa-1" />
              <td className="fixa fixa-2" />
              <td className="fixa fixa-3" style={sx("font-weight:600")}>Total ({ordenadas.length})</td>
              <td>{n0(totais.results)}</td>
              <td>{md.cpa != null ? brl(md.cpa) : traco}</td>
              <td>{brl(totais.revenue)}</td>
              <td style={sx(`color:${md.lucro > 0 ? "#4ade80" : md.lucro < 0 ? "#f87171" : "inherit"}`)}>{brl(md.lucro)}</td>
              <td>{md.roas != null ? `${md.roas.toFixed(2).replace(".", ",")}x` : traco}</td>
              <td>{md.roi != null ? `${md.roi.toFixed(2).replace(".", ",")}x` : traco}</td>
              <td>{traco}</td>
              <td>{traco}</td>
              <td>{md.cpc != null ? brl(md.cpc) : traco}</td>
              <td>{md.ctr != null ? pct(md.ctr) : traco}</td>
              <td>{md.cpm != null ? brl0(md.cpm) : traco}</td>
              <td>{n0(totais.impressions)}</td>
              <td>{n0(totais.clicks)}</td>
              <td>{traco}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
