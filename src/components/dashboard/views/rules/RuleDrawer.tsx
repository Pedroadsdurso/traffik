"use client";

import { useState } from "react";

import type { CreateRuleInput, RuleDTO } from "@/lib/actions/rules";
import type { RuleCondition } from "@/lib/rules/engine";
import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { Checkbox } from "../../ui/Checkbox";
import { Drawer } from "../../ui/Drawer";
import { ListaSelecionavel } from "../../ui/ListaSelecionavel";
import { Select } from "../../ui/Select";

/**
 * Gaveta de criação/edição de regra de automação (Bloco 8).
 *
 * ⚠️ **Zero `<select>` nativo aqui.** Usa o `ui/Select` do Bloco 3 e o
 * `ui/Checkbox` — a padronização visual não vai precisar refazer esta tela.
 *
 * ⚠️ É `Drawer`, não `Modal`: o formulário é longo e tem seções condicionais.
 * `Modal` é para diálogo curto e centralizado (ver o CLAUDE.md).
 */

/** Ações da UI. Mapeiam para 3 valores do enum + `actionParams`. */
type AcaoUI = "pausar" | "ativar" | "aumentar" | "diminuir" | "definir";

const ACOES: { value: AcaoUI; label: string }[] = [
  { value: "pausar", label: "Desativar (pausar)" },
  { value: "ativar", label: "Ativar" },
  { value: "aumentar", label: "Aumentar orçamento" },
  { value: "diminuir", label: "Diminuir orçamento" },
  { value: "definir", label: "Definir orçamento" },
];

const METRICAS: { value: RuleCondition["metrica"]; label: string }[] = [
  { value: "cpa", label: "CPA" },
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR (%)" },
  { value: "gasto", label: "Gasto (R$)" },
  { value: "vendas", label: "Vendas" },
];

/** Os quatro operadores + igualdade. `>=` e `<=` só passaram a funcionar de
 *  verdade depois da correção no avaliador — antes viravam `=` em silêncio. */
const OPERADORES = [
  { value: ">", label: "maior que" },
  { value: ">=", label: "maior ou igual a" },
  { value: "<", label: "menor que" },
  { value: "<=", label: "menor ou igual a" },
  { value: "=", label: "igual a" },
];

const NIVEIS = [
  { value: "CAMPAIGN", label: "Campanha" },
  { value: "ADSET", label: "Conjunto" },
  { value: "AD", label: "Anúncio" },
];

const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "ultimas_3h", label: "Últimas 3 horas" },
  { value: "ultimas_24h", label: "Últimas 24 horas" },
  { value: "ultimos_7d", label: "Últimos 7 dias" },
];

const FREQUENCIAS = [
  { value: "15", label: "A cada 15 minutos" },
  { value: "30", label: "A cada 30 minutos" },
  { value: "60", label: "A cada 1 hora" },
  { value: "180", label: "A cada 3 horas" },
];

const HORAS = [{ value: "", label: "Qualquer hora" }].concat(
  Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` })),
);

export interface RascunhoRegra {
  id: string | null;
  name: string;
  produtos: string[];
  contas: string[];
  acao: AcaoUI;
  level: string;
  condicoes: RuleCondition[];
  /** Valor da ação de orçamento. Interpretação depende de `unidade`. */
  valor: string;
  /** `%` = percentual sobre o orçamento atual; `R$` = valor absoluto. */
  unidade: "%" | "R$";
  /** Só em "definir": base do percentual é o GASTO, não o orçamento. */
  sobreGasto: boolean;
  maxBudget: string;
  calcPeriod: string;
  frequencyMin: string;
  windowStart: string;
  windowEnd: string;
  semLimiteDiario: boolean;
  dailyRunLimit: string;
  active: boolean;
}

export const RASCUNHO_REGRA: RascunhoRegra = {
  id: null,
  name: "",
  produtos: [],
  contas: [],
  acao: "pausar",
  level: "CAMPAIGN",
  condicoes: [{ metrica: "cpa", operador: ">", valor: 50 }],
  valor: "20",
  unidade: "%",
  sobreGasto: false,
  maxBudget: "",
  calcPeriod: "hoje",
  frequencyMin: "30",
  windowStart: "",
  windowEnd: "",
  semLimiteDiario: false,
  dailyRunLimit: "10",
  active: true,
};

export function deRegra(r: RuleDTO): RascunhoRegra {
  const p = r.actionParams ?? {};
  const valor = p.valor ?? 0;
  const acao: AcaoUI =
    r.action === "PAUSAR" ? "pausar"
    : r.action === "ATIVAR" ? "ativar"
    : p.tipo === "valor" || p.tipo === "pct_gasto" ? "definir"
    : valor < 0 ? "diminuir"
    : "aumentar";
  return {
    id: r.id,
    name: r.name,
    produtos: r.targetProducts.length ? r.targetProducts : r.targetProduct ? [r.targetProduct] : [],
    contas: r.adAccountIds,
    acao,
    level: r.level,
    condicoes: r.conditions.length ? r.conditions : [{ metrica: "cpa", operador: ">", valor: 50 }],
    valor: String(Math.abs(valor) || ""),
    unidade: p.tipo === "valor" ? "R$" : "%",
    sobreGasto: p.tipo === "pct_gasto",
    maxBudget: r.maxBudget == null ? "" : String(r.maxBudget),
    calcPeriod: r.calcPeriod,
    frequencyMin: String(r.frequencyMin),
    windowStart: r.windowStartHour == null ? "" : String(r.windowStartHour),
    windowEnd: r.windowEndHour == null ? "" : String(r.windowEndHour),
    semLimiteDiario: r.dailyRunLimit <= 0,
    dailyRunLimit: String(r.dailyRunLimit || 10),
    active: r.active,
  };
}

/** Ações que mexem em dinheiro ou desligam entrega — exigem confirmação. */
export const acaoSensivel = (a: AcaoUI) => a !== "ativar";

/** Traduz o rascunho para o formato que a server action espera. */
export function paraInput(d: RascunhoRegra, workspaceId: string | null): CreateRuleInput {
  const n = parseFloat(d.valor.replace(",", ".")) || 0;
  const action = d.acao === "pausar" ? "PAUSAR" : d.acao === "ativar" ? "ATIVAR" : "AJUSTAR_ORCAMENTO";

  let actionParams: { tipo?: string; valor?: number } | null = null;
  if (d.acao === "aumentar") actionParams = { tipo: d.unidade === "%" ? "percentual" : "valor", valor: Math.abs(n) };
  else if (d.acao === "diminuir") actionParams = { tipo: d.unidade === "%" ? "percentual" : "valor", valor: -Math.abs(n) };
  else if (d.acao === "definir") actionParams = { tipo: d.sobreGasto ? "pct_gasto" : "valor", valor: Math.abs(n) };

  return {
    name: d.name,
    targetProducts: d.produtos,
    adAccountIds: d.contas,
    level: d.level as CreateRuleInput["level"],
    action: action as CreateRuleInput["action"],
    actionParams,
    conditions: d.condicoes,
    calcPeriod: d.calcPeriod,
    frequencyMin: parseInt(d.frequencyMin, 10) || 30,
    // "Sem limite" grava um teto altíssimo em vez de 0: o motor bloqueia
    // quando `runsToday >= dailyRunLimit`, então 0 significaria "nunca roda".
    dailyRunLimit: d.semLimiteDiario ? 9999 : Math.max(1, parseInt(d.dailyRunLimit, 10) || 10),
    maxBudget: d.acao === "aumentar" || d.acao === "definir" ? parseFloat(d.maxBudget.replace(",", ".")) || null : null,
    windowStartHour: d.windowStart === "" ? null : Number(d.windowStart),
    windowEndHour: d.windowEnd === "" ? null : Number(d.windowEnd),
    active: d.active,
    workspaceId,
  };
}

function Campo({ label, dica, children }: { label: string; dica?: string; children: React.ReactNode }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:5px")}>
      <div style={sx("font-size:12px;font-weight:600")}>{label}</div>
      {dica && <div className="text-muted" style={sx("font-size:11.5px;line-height:1.45")}>{dica}</div>}
      {children}
    </div>
  );
}

export function RuleDrawer({
  aberta,
  rascunho,
  setRascunho,
  produtos,
  contas,
  salvando,
  erro,
  onSalvar,
  onFechar,
}: {
  aberta: boolean;
  rascunho: RascunhoRegra;
  setRascunho: (r: RascunhoRegra) => void;
  produtos: string[];
  contas: { id: string; label: string; detalhe?: string }[];
  salvando: boolean;
  erro: string | null;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  const d = rascunho;
  const patch = (p: Partial<RascunhoRegra>) => setRascunho({ ...d, ...p });
  const [confirmando, setConfirmando] = useState(false);

  const mexeOrcamento = d.acao === "aumentar" || d.acao === "diminuir" || d.acao === "definir";
  const exigeTeto = d.acao === "aumentar";
  const tetoNum = parseFloat(d.maxBudget.replace(",", ".")) || 0;
  const tetoFaltando = exigeTeto && tetoNum <= 0;

  const condicoesValidas = d.condicoes.length > 0 && d.condicoes.every((c) => Number.isFinite(c.valor));
  const podeSalvar = d.name.trim().length > 0 && condicoesValidas && !tetoFaltando && !salvando;

  const patchCond = (i: number, p: Partial<RuleCondition>) =>
    patch({ condicoes: d.condicoes.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  const tentarSalvar = () => {
    // Confirmação para tudo que pausa entrega ou mexe em dinheiro. "Ativar" não
    // pede: ligar de volta não gasta mais do que o orçamento já configurado.
    if (acaoSensivel(d.acao) && !confirmando) {
      setConfirmando(true);
      return;
    }
    onSalvar();
  };

  return (
    <Drawer
      aberta={aberta}
      titulo={d.id ? "Editar regra" : "Nova regra"}
      descricao="A regra roda pelo cron e age nas campanhas desta Área de Trabalho."
      largura={560}
      onClose={onFechar}
      rodape={
        <div style={sx("display:flex;flex-direction:column;gap:10px")}>
          {confirmando && (
            <div
              style={sx(
                "display:flex;gap:9px;align-items:flex-start;padding:var(--space-3);border-radius:var(--radius-md);" +
                  "background:color-mix(in srgb, #ef4444 10%, transparent);border:1px solid color-mix(in srgb, #ef4444 45%, transparent)",
              )}
            >
              <span aria-hidden style={sx("font-size:15px")}>⚠️</span>
              <div style={sx("font-size:12.5px;line-height:1.5")}>
                <strong>
                  {d.acao === "pausar"
                    ? "Esta regra vai PAUSAR campanhas automaticamente."
                    : "Esta regra vai ALTERAR o orçamento de campanhas automaticamente."}
                </strong>
                <div className="text-muted" style={sx("margin-top:3px")}>
                  Ela age sozinha, pelo cron, sem ninguém olhando — e a Meta não oferece desfazer.
                  {exigeTeto && tetoNum > 0 && ` O orçamento nunca passará de ${brl(tetoNum)}.`}{" "}
                  Confirme para salvar.
                </div>
              </div>
            </div>
          )}
          <div style={sx("display:flex;gap:var(--space-2);justify-content:flex-end")}>
            <button className="btn btn-ghost" type="button" onClick={confirmando ? () => setConfirmando(false) : onFechar}>
              {confirmando ? "Voltar" : "Cancelar"}
            </button>
            <button
              className={confirmando ? "btn btn-danger" : "btn btn-primary"}
              type="button"
              disabled={!podeSalvar}
              onClick={tentarSalvar}
            >
              {salvando ? "Salvando…" : confirmando ? "Confirmar e salvar" : "Salvar regra"}
            </button>
          </div>
        </div>
      }
    >
      <Campo label="Nome da regra">
        <input
          className="input"
          autoFocus
          value={d.name}
          placeholder="Ex.: Pausar quando o CPA passar de R$ 50"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Campo>

      <Campo label="Produtos" dica="Vazio = todos os produtos. A lista traz o que já teve venda rastreada.">
        <ListaSelecionavel
          itens={produtos.map((p) => ({ id: p, label: p }))}
          selecionados={d.produtos}
          onChange={(produtos) => patch({ produtos })}
          altura={140}
          vazio="Nenhuma venda registrada ainda — a regra valerá para todos os produtos."
        />
      </Campo>

      <Campo
        label="Contas de anúncio"
        dica="Vazio = todas as contas desta área. O motor sempre intersecta com as contas da área, então uma conta de outra área nunca é afetada."
      >
        <ListaSelecionavel
          itens={contas}
          selecionados={d.contas}
          onChange={(contas) => patch({ contas })}
          altura={140}
          vazio="Nenhuma conta de anúncio nesta área."
        />
      </Campo>

      <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
        <Campo label="Ação">
          <Select label="" value={d.acao} options={ACOES} onChange={(v) => patch({ acao: v as AcaoUI })} minWidth={210} />
        </Campo>
        <Campo label="Aplicar em">
          <Select label="" value={d.level} options={NIVEIS} onChange={(level) => patch({ level })} minWidth={150} />
        </Campo>
      </div>

      {/* ── Condições ─────────────────────────────────────────────────────── */}
      <Campo label="Condições" dica="Todas precisam ser verdadeiras ao mesmo tempo (E).">
        <div style={sx("display:flex;flex-direction:column;gap:7px")}>
          {d.condicoes.map((c, i) => (
            <div key={i} style={sx("display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap")}>
              {i > 0 && (
                <span className="text-muted" style={sx("font-size:11px;font-weight:700;align-self:center;padding-bottom:9px")}>E</span>
              )}
              <Select
                label=""
                value={c.metrica}
                options={METRICAS}
                onChange={(v) => patchCond(i, { metrica: v as RuleCondition["metrica"] })}
                minWidth={120}
              />
              <Select
                label=""
                value={c.operador}
                options={OPERADORES}
                onChange={(v) => patchCond(i, { operador: v as RuleCondition["operador"] })}
                minWidth={160}
              />
              <input
                className="input"
                style={sx("width:96px")}
                inputMode="decimal"
                value={String(c.valor)}
                onChange={(e) => patchCond(i, { valor: parseFloat(e.target.value.replace(",", ".")) || 0 })}
              />
              {d.condicoes.length > 1 && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  aria-label="Remover condição"
                  onClick={() => patch({ condicoes: d.condicoes.filter((_, j) => j !== i) })}
                  style={sx("padding:6px 9px")}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-secondary"
            type="button"
            style={sx("align-self:flex-start;font-size:12px")}
            onClick={() => patch({ condicoes: [...d.condicoes, { metrica: "gasto", operador: ">", valor: 0 }] })}
          >
            + Adicionar condição
          </button>
        </div>
      </Campo>

      {/* ── Campos condicionais da ação ───────────────────────────────────── */}
      {mexeOrcamento && (
        <>
          <div style={sx("height:1px;background:var(--color-divider)")} />

          <Campo
            label={d.acao === "definir" ? "Novo orçamento" : `Quanto ${d.acao === "aumentar" ? "aumentar" : "diminuir"}`}
            dica={
              d.acao === "definir"
                ? d.sobreGasto
                  ? "Percentual sobre o GASTO do período de cálculo."
                  : "Valor absoluto, em reais."
                : d.unidade === "%"
                  ? "Percentual sobre o orçamento atual da entidade."
                  : "Valor absoluto somado ou subtraído."
            }
          >
            <div style={sx("display:flex;gap:6px;align-items:center")}>
              <input
                className="input"
                style={sx("width:120px")}
                inputMode="decimal"
                value={d.valor}
                onChange={(e) => patch({ valor: e.target.value })}
              />
              {d.acao === "definir" ? (
                <Select
                  label=""
                  value={d.sobreGasto ? "pct" : "abs"}
                  options={[
                    { value: "abs", label: "R$ (absoluto)" },
                    { value: "pct", label: "% do gasto" },
                  ]}
                  onChange={(v) => patch({ sobreGasto: v === "pct" })}
                  minWidth={150}
                />
              ) : (
                <Select
                  label=""
                  value={d.unidade}
                  options={[
                    { value: "%", label: "%" },
                    { value: "R$", label: "R$" },
                  ]}
                  onChange={(v) => patch({ unidade: v as "%" | "R$" })}
                  minWidth={90}
                />
              )}
            </div>
          </Campo>

          {(d.acao === "aumentar" || d.acao === "definir") && (
            <Campo
              label={`Teto de orçamento${exigeTeto ? " (obrigatório)" : " (opcional)"}`}
              dica={
                exigeTeto
                  ? "Sem teto, o motor RECUSA o aumento — uma regra de +20% multiplicaria o orçamento a cada execução (100 → 120 → 144 → 173…). O orçamento nunca passa deste valor."
                  : "Limite máximo. Se o valor definido passar dele, o motor trava no teto."
              }
            >
              <input
                className="input"
                style={sx(`width:160px${tetoFaltando ? ";border-color:#ef4444" : ""}`)}
                inputMode="decimal"
                placeholder="Ex.: 300"
                value={d.maxBudget}
                onChange={(e) => patch({ maxBudget: e.target.value })}
              />
              {tetoFaltando && (
                <div style={sx("font-size:11.5px;color:#ef4444")}>
                  Informe o teto — sem ele o motor recusaria o aumento e a regra nunca agiria.
                </div>
              )}
            </Campo>
          )}
        </>
      )}

      <div style={sx("height:1px;background:var(--color-divider)")} />

      <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
        <Campo label="Período de cálculo">
          <Select label="" value={d.calcPeriod} options={PERIODOS} onChange={(calcPeriod) => patch({ calcPeriod })} minWidth={175} />
        </Campo>
        <Campo label="Frequência">
          <Select label="" value={d.frequencyMin} options={FREQUENCIAS} onChange={(frequencyMin) => patch({ frequencyMin })} minWidth={185} />
        </Campo>
      </div>

      <Campo
        label="Intervalo de execução"
        dica="Janela em que a regra pode agir, na sua hora local. Fora dela ela não é avaliada. Deixe em “Qualquer hora” para rodar sempre."
      >
        <div style={sx("display:flex;gap:6px;align-items:center")}>
          <Select label="" value={d.windowStart} options={HORAS} onChange={(windowStart) => patch({ windowStart })} minWidth={140} />
          <span className="text-muted" style={sx("font-size:12px")}>até</span>
          <Select label="" value={d.windowEnd} options={HORAS} onChange={(windowEnd) => patch({ windowEnd })} minWidth={140} />
        </div>
      </Campo>

      <Campo label="Limite de execuções diárias" dica="Trava de segurança: quantas vezes por dia a regra pode agir.">
        <div style={sx("display:flex;gap:10px;align-items:center")}>
          <input
            className="input"
            style={sx("width:96px")}
            inputMode="numeric"
            disabled={d.semLimiteDiario}
            value={d.semLimiteDiario ? "" : d.dailyRunLimit}
            onChange={(e) => patch({ dailyRunLimit: e.target.value })}
          />
          <Checkbox
            checked={d.semLimiteDiario}
            onChange={(semLimiteDiario) => patch({ semLimiteDiario })}
            label="Sem limite"
          />
        </div>
      </Campo>

      <Checkbox
        checked={d.active}
        onChange={(active) => patch({ active })}
        label="Ativar a regra ao salvar"
        dica={d.active ? "Ela passará a rodar no próximo ciclo do cron." : "Fica salva e parada até você ativar."}
      />

      {erro && <p style={sx("margin:0;font-size:12.5px;color:#ef4444")}>{erro}</p>}
    </Drawer>
  );
}
