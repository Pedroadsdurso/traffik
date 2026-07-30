"use client";

import { useState, useTransition } from "react";

import { setMyTimezone } from "@/lib/actions/profile";
import { CONFIG } from "@/lib/explicacoes";
import { faltamTaxas } from "@/lib/areas/taxas";
import { sx } from "@/lib/sx";
import { Select } from "../ui/Select";
import { Checkbox } from "../ui/Checkbox";
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
      <div style={sx("margin-top:var(--space-3)")}>
        <Select
          label=""
          minWidth={260}
          value={tz}
          onChange={aplicar}
          options={[
            // Um fuso salvo fora da lista (via API) continua selecionável.
            ...(TIMEZONE_OPTIONS.some((o) => o.value === tz) ? [] : [{ value: tz, label: tz }]),
            ...TIMEZONE_OPTIONS,
          ]}
        />
      </div>
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
  /**
   * 🐛 Os campos do formulário vivem AQUI, não no `useTraffikState`.
   *
   * Eles moravam no hook global, provido por contexto ao dashboard inteiro:
   * cada tecla re-renderizava a árvore toda (gráficos incluídos) e, com input
   * controlado, o teclado corria mais rápido que o re-render — digitar uma frase
   * deixava o campo VAZIO.
   *
   * ⚠️ Campo de formulário não deve morar naquele hook. Lá vai dado do servidor
   * e estado compartilhado entre telas, não digitação.
   */
  const [gatewayMetodo, setGatewayMetodo] = useState("PIX");
  const [gatewayPct, setGatewayPct] = useState("");
  const [taxNome, setTaxNome] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [despesaNome, setDespesaNome] = useState("");
  const [despesaValor, setDespesaValor] = useState("");

  /**
   * 🔴 AVISO QUE TORNA VISÍVEL A FALHA DA TAXA POR ÁREA.
   *
   * Com taxas isoladas por área (decisão de 30/07/2026), esquecer de cadastrar o
   * imposto ou a taxa do gateway numa área faz o lucro dela aparecer **maior do
   * que é** — e o número continua plausível, então nada denuncia. Este aviso é o
   * que denuncia. **Não remova sem antes reintroduzir a taxa global.**
   */
  const faltando = faltamTaxas([
    ...(v.gatewayExpenses.length ? ["TAXA_GATEWAY"] : []),
    ...(v.taxExpenses.length ? ["IMPOSTO"] : []),
  ]);


  return (
    <div style={sx("display:grid;grid-template-columns:1fr 320px;gap:var(--space-4);align-items:start")}>

      {faltando.length > 0 && (
        <div
          className="card"
          style={sx(
            "grid-column:1/-1;display:flex;gap:10px;align-items:flex-start;" +
              "border-left:3px solid #f59e0b;background:color-mix(in srgb, #f59e0b 7%, var(--color-surface))",
          )}
        >
          <span aria-hidden style={sx("font-size:16px;line-height:1.2")}>⚠️</span>
          <div style={sx("font-size:13px;line-height:1.55")}>
            <strong>
              Esta área não tem {faltando.join(" nem ")} cadastrad{faltando.length > 1 ? "os" : "o"}.
            </strong>
            <div className="text-muted" style={sx("margin-top:3px")}>
              O lucro que aparece no painel desta operação está <strong>maior do que a
              realidade</strong>, porque esse custo não está sendo descontado. Cada área tem as
              suas próprias taxas — cadastre {faltando.length > 1 ? "as duas" : "essa"} aqui.
            </div>
          </div>
        </div>
      )}
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
              <Select
                label=""
                minWidth={120}
                value={gatewayMetodo}
                onChange={setGatewayMetodo}
                options={[
                  { value: "PIX", label: "Pix" },
                  { value: "CARTAO", label: "Cartão" },
                  { value: "BOLETO", label: "Boleto" },
                  { value: "OUTRO", label: "Todas" },
                ]}
              />
              <input className="input" style={sx("width:100px")} placeholder="% taxa" value={gatewayPct} onChange={(e) => setGatewayPct(e.target.value)} inputMode="decimal" />
              <button className="btn btn-secondary" type="button" onClick={() => void v.addGateway(gatewayMetodo, gatewayPct).then(() => setGatewayPct(""))}>Adicionar</button>
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
              <input className="input" placeholder="Nome (ex.: Simples Nacional)" value={taxNome} onChange={(e) => setTaxNome(e.target.value)} />
              <input className="input" style={sx("width:100px")} placeholder="% alíquota" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} inputMode="decimal" />
              <button className="btn btn-secondary" type="button" onClick={() => void v.addTax(taxNome, taxPct).then(() => { setTaxNome(""); setTaxPct(""); })}>Adicionar</button>
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
              <input className="input" placeholder="Nome da despesa" value={despesaNome} onChange={(e) => setDespesaNome(e.target.value)} />
              <input className="input" style={sx("width:120px")} placeholder="Valor R$" value={despesaValor} onChange={(e) => setDespesaValor(e.target.value)} inputMode="decimal" />
              <button className="btn btn-secondary" type="button" onClick={() => void v.addDespesa(despesaNome, despesaValor).then(() => { setDespesaNome(""); setDespesaValor(""); })}>Adicionar</button>
            </div>
            {/* Só a despesa recorrente oferece a escolha. Taxa de gateway e
                imposto são globais por natureza — uma caixa neles convidaria a
                prender a uma área justamente o que, se prendido, sumiria da
                conta de lucro das outras em silêncio. */}
            
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
