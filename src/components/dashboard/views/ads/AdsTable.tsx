"use client";

import { useState } from "react";

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
  /**
   * Se o orçamento pode ser editado NESTE nível. Campanha CBO edita na
   * campanha; ABO edita no conjunto. A Meta recusa no nível errado, então a
   * célula nem oferece a caneta quando não é o lugar certo.
   */
  orcamentoEditavel?: boolean;
}

/** Colunas de métrica, na ordem pedida no Bloco 6. */
const COLUNAS: { chave: string; label: string; dica?: string }[] = [
  { chave: "orcamento", label: "Orçamento", dica: "Orçamento diário — editável no nível correto (CBO na campanha, ABO no conjunto)" },
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

/** Célula de orçamento: mostra o valor e, quando editável, a caneta. */
function CelulaOrcamento({
  linha,
  onSalvar,
}: {
  linha: LinhaTabela;
  onSalvar: (id: string, valor: number) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!linha.orcamentoEditavel) {
    // Nível errado para este tipo de campanha — mostra o valor se houver, mas
    // sem caneta, para não sugerir uma edição que a Meta recusaria.
    return <>{linha.orcamento != null ? brl(linha.orcamento) : traco}</>;
  }

  async function salvar() {
    const n = parseFloat(valor.replace(",", "."));
    if (!n || n <= 0) return;
    setSalvando(true);
    try {
      await onSalvar(linha.id, n);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span style={sx("display:inline-flex;align-items:center;gap:4px;justify-content:flex-end")}>
        <input
          className="input"
          autoFocus
          inputMode="decimal"
          value={valor}
          disabled={salvando}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") salvar();
            if (e.key === "Escape") setEditando(false);
          }}
          style={sx("width:82px;min-height:26px;padding:2px 6px;font-size:12px;text-align:right")}
          aria-label={`Novo orçamento de ${linha.nome}`}
        />
        <button className="btn btn-ghost" type="button" onClick={salvar} disabled={salvando}
          style={sx("padding:2px 6px;font-size:12px")} aria-label="Salvar orçamento">
          {salvando ? "…" : "✓"}
        </button>
      </span>
    );
  }

  return (
    <span style={sx("display:inline-flex;align-items:center;gap:6px;justify-content:flex-end")}>
      {linha.orcamento != null ? brl(linha.orcamento) : traco}
      <button
        type="button"
        onClick={() => {
          setValor(linha.orcamento != null ? String(linha.orcamento).replace(".", ",") : "");
          setEditando(true);
        }}
        title="Editar orçamento"
        aria-label={`Editar orçamento de ${linha.nome}`}
        style={sx("background:none;border:0;cursor:pointer;color:var(--color-accent);padding:2px;line-height:0;opacity:.75")}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
    </span>
  );
}
const n0 = (v: number) => v.toLocaleString("pt-BR");

export function AdsTable({
  linhas,
  selecionadas,
  onSelecionar,
  onSelecionarTodas,
  onToggleStatus,
  onSalvarOrcamento,
  fixadas,
  carregando,
  vazio,
}: {
  linhas: LinhaTabela[];
  selecionadas: Set<string>;
  onSelecionar: (id: string) => void;
  onSelecionarTodas: () => void;
  onToggleStatus: (id: string) => void;
  onSalvarOrcamento: (id: string, valor: number) => Promise<void>;
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

                  <td><CelulaOrcamento linha={l} onSalvar={onSalvarOrcamento} /></td>
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
              <td>{traco}</td>
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
