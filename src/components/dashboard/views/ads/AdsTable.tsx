"use client";

import { useState } from "react";

import { brl, brl0, pct } from "@/lib/format";
import { derivar, somar, type LinhaBase } from "@/lib/ads/metrics";
import { sx } from "@/lib/sx";
import { Icone } from "../../ui/Icone";
import { InfoTip } from "../../ui/InfoTip";
import { METRICAS } from "@/lib/explicacoes";

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

/**
 * De onde vem cada métrica.
 *
 * `meta` — só o Facebook sabe (ele é quem cobra e quem entrega).
 * `nosso` — do nosso rastreamento, via UTM: chega no INSTANTE do evento, sem
 *           esperar a consolidação da Meta, e cruza com o gateway (por isso
 *           sabemos o que foi aprovado, coisa que a Meta não sabe).
 * `misto`  — derivada: custo da Meta ÷ conversão nossa.
 *
 * ⚠️ **Não existe dupla contagem por construção.** Pedimos ao `/insights`
 * apenas `spend,impressions,clicks,ctr,cpc,cpm,reach,frequency` — nenhum evento
 * de conversão. `DailyAdMetric` não tem coluna para guardá-los. Quando a Meta
 * enfim reporta as conversões dela, o dado simplesmente não entra aqui.
 */
type Fonte = "meta" | "nosso" | "misto";

const COR_FONTE: Record<Fonte, string> = { meta: "#60a5fa", nosso: "#a78bfa", misto: "#94a3b8" };
const NOME_FONTE: Record<Fonte, string> = {
  meta: "Fonte: Meta Ads",
  nosso: "Fonte: nosso rastreamento (tempo real)",
  misto: "Custo da Meta ÷ conversão nossa",
};

/** Colunas de métrica, na ordem pedida no Bloco 6. */
const COLUNAS: { chave: string; label: string; dica?: string; fonte: Fonte }[] = [
  { chave: "orcamento", label: "Orçamento", fonte: "meta" },
  // A ordem é a da leitura natural: quanto POSSO gastar → quanto GASTEI →
  // quanto VENDI. Antes a tabela pulava de Orçamento direto para Vendas, e o
  // gasto — que já alimentava CPM, CPA, ROAS e Lucro — só aparecia dentro de
  // tooltip de fórmula.
  { chave: "gasto", label: "Gasto", dica: "Quanto a Meta cobrou no período filtrado. É a base de CPA, ROAS, ROI, CPC, CPM e Lucro.", fonte: "meta" },
  { chave: "vendas", label: "Vendas", fonte: "nosso" },
  { chave: "cpa", label: "CPA", fonte: "misto" },
  { chave: "faturamento", label: "Faturamento", fonte: "nosso" },
  { chave: "lucro", label: "Lucro", fonte: "misto" },
  { chave: "roas", label: "ROAS", fonte: "misto" },
  { chave: "roi", label: "ROI", fonte: "misto" },
  { chave: "ic", label: "IC", fonte: "nosso" },
  { chave: "cpi", label: "CPI", fonte: "misto" },
  { chave: "cliquesAtr", label: "Cliq. atr.", fonte: "nosso" },
  { chave: "vendasInic", label: "Vend. inic.", fonte: "nosso" },
  { chave: "cpc", label: "CPC", fonte: "meta" },
  { chave: "ctr", label: "CTR", fonte: "meta" },
  { chave: "cpm", label: "CPM", fonte: "meta" },
  { chave: "impressoes", label: "Impressões", fonte: "meta" },
  { chave: "cliques", label: "Cliques", fonte: "meta" },
  { chave: "bid", label: "Bid Cap", fonte: "meta" },
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

  /** Números que compuseram a métrica no período, para o tooltip da fórmula. */
  function valoresDe(chave: string): [string, string][] | undefined {
    const v = (n: number) => n.toLocaleString("pt-BR");
    switch (chave) {
      case "roas":
        return [["Faturamento", brl(totais.revenue)], ["Gasto", brl(totais.spend)]];
      case "roi":
        return [["Lucro", brl(md.lucro)], ["Custo (gasto)", brl(totais.spend)]];
      case "cpa":
        return [["Gasto", brl(totais.spend)], ["Vendas aprovadas", v(totais.results)]];
      case "lucro":
        return [["Faturamento", brl(totais.revenue)], ["Gasto", brl(totais.spend)]];
      case "cpi":
        return [["Gasto", brl(totais.spend)], ["IC", v(totais.ic ?? 0)]];
      case "cpc":
        return [["Gasto", brl(totais.spend)], ["Cliques (Meta)", v(totais.clicks)]];
      case "ctr":
        return [["Cliques (Meta)", v(totais.clicks)], ["Impressões", v(totais.impressions)]];
      case "cpm":
        return [["Gasto", brl(totais.spend)], ["Impressões", v(totais.impressions)]];
      case "cliquesAtr":
        return [["Nossos cliques", v(totais.cliquesAtribuidos ?? 0)], ["Cliques da Meta", v(totais.clicks)]];
      case "vendasInic":
        return [["Iniciadas", v(totais.vendasIniciadas ?? 0)], ["Aprovadas", v(totais.results)]];
      default:
        return undefined;
    }
  }

  const ordenadas = [...linhas].sort((a, b) => {
    const fa = fixadas.has(a.id) ? 1 : 0;
    const fb = fixadas.has(b.id) ? 1 : 0;
    return fb - fa;
  });

  return (
    <>
    {/* Legenda das fontes. Sem ela, o usuário compara com o Gerenciador da Meta,
        vê números diferentes e conclui que um dos dois está errado. */}
    <div style={sx("display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;font-size:11px;padding:0 2px 7px")}>
      <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
        <span style={sx(`width:5px;height:5px;border-radius:50%;background:${COR_FONTE.meta}`)} />
        <span className="text-muted">Vem do Facebook</span>
      </span>
      <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
        <span style={sx(`width:5px;height:5px;border-radius:50%;background:${COR_FONTE.nosso}`)} />
        <span className="text-muted">Medido pela Traffik</span>
      </span>
      <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
        <span style={sx(`width:5px;height:5px;border-radius:50%;background:${COR_FONTE.misto}`)} />
        <span className="text-muted">Calculado</span>
      </span>
      <span style={sx("display:inline-flex;align-items:center;gap:4px")}>
        <span className="text-muted" style={sx("opacity:.75")}>Por que difere da Meta?</span>
        <InfoTip conteudo={METRICAS.divergenciaMeta!} tamanho={12} />
      </span>
    </div>
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
            {COLUNAS.map((c) => {
              // Os valores do rodapé de totais entram no tooltip da métrica
              // calculada: a fórmula sozinha não mostra de onde saiu o número.
              const base = METRICAS[c.chave];
              const conteudo = base && { ...base, valores: valoresDe(c.chave) };
              return (
                <th key={c.chave} style={sx("text-align:right;white-space:nowrap")}>
                  <span style={sx("display:inline-flex;align-items:center;gap:4px;justify-content:flex-end")}>
                    {c.label}
                    {/* Ponto da fonte: o usuário precisa saber por que o número
                        pode divergir do Gerenciador da Meta. */}
                    <span aria-hidden style={sx(`width:5px;height:5px;border-radius:50%;background:${COR_FONTE[c.fonte]};flex-shrink:0;opacity:.9`)} />
                    {conteudo && <InfoTip conteudo={conteudo} tamanho={12} />}
                  </span>
                </th>
              );
            })}
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
                      {fixadas.has(l.id) && <span title="Fixada no topo" aria-hidden><Icone nome="fixado" tamanho={13} cor="marca" /></span>}
                      <div style={sx("min-width:0")}>
                        <div style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px")}>{l.nome}</div>
                        {l.sub && <div className="text-muted" style={sx("font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{l.sub}</div>}
                      </div>
                    </div>
                  </td>

                  <td><CelulaOrcamento linha={l} onSalvar={onSalvarOrcamento} /></td>
                  <td>{brl(l.spend)}</td>
                  <td>{n0(l.results)}</td>
                  <td>{m.cpa != null ? brl(m.cpa) : traco}</td>
                  <td>{brl(l.revenue)}</td>
                  <td style={sx(`color:${m.lucro > 0 ? "#4ade80" : m.lucro < 0 ? "#f87171" : "inherit"}`)}>{brl(m.lucro)}</td>
                  <td>{m.roas != null ? `${m.roas.toFixed(2).replace(".", ",")}x` : traco}</td>
                  <td>{m.roi != null ? `${m.roi.toFixed(2).replace(".", ",")}x` : traco}</td>
                  <td>{(l.ic ?? 0) > 0 ? n0(l.ic ?? 0) : traco}</td>
                  <td>{m.cpi != null ? brl(m.cpi) : traco}</td>
                  <td>{(l.cliquesAtribuidos ?? 0) > 0 ? n0(l.cliquesAtribuidos ?? 0) : traco}</td>
                  <td>{(l.vendasIniciadas ?? 0) > 0 ? n0(l.vendasIniciadas ?? 0) : traco}</td>
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
              {/* Orçamento não soma: são tetos diários de linhas diferentes,
                  e somá-los produziria um número que não significa nada. */}
              <td>{traco}</td>
              <td style={sx("font-weight:600")}>{brl(totais.spend)}</td>
              <td>{n0(totais.results)}</td>
              <td>{md.cpa != null ? brl(md.cpa) : traco}</td>
              <td>{brl(totais.revenue)}</td>
              <td style={sx(`color:${md.lucro > 0 ? "#4ade80" : md.lucro < 0 ? "#f87171" : "inherit"}`)}>{brl(md.lucro)}</td>
              <td>{md.roas != null ? `${md.roas.toFixed(2).replace(".", ",")}x` : traco}</td>
              <td>{md.roi != null ? `${md.roi.toFixed(2).replace(".", ",")}x` : traco}</td>
              <td>{(totais.ic ?? 0) > 0 ? n0(totais.ic ?? 0) : traco}</td>
              <td>{md.cpi != null ? brl(md.cpi) : traco}</td>
              <td>{(totais.cliquesAtribuidos ?? 0) > 0 ? n0(totais.cliquesAtribuidos ?? 0) : traco}</td>
              <td>{(totais.vendasIniciadas ?? 0) > 0 ? n0(totais.vendasIniciadas ?? 0) : traco}</td>
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
    </>
  );
}
