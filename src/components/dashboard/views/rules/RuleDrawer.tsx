"use client";

import { useState } from "react";

import { previewRuleConditions, type CreateRuleInput, type RuleDTO } from "@/lib/actions/rules";
import { analisarCondicoes } from "@/lib/rules/analise";
import type { RuleCondition, RulePreviewEntity } from "@/lib/rules/engine";
import { METRICAS as AJUDA } from "@/lib/explicacoes";
import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { Checkbox } from "../../ui/Checkbox";
import { Drawer } from "../../ui/Drawer";
import { Icone } from "../../ui/Icone";
import { InfoTip, type ConteudoInfo } from "../../ui/InfoTip";
import { ListaSelecionavel } from "../../ui/ListaSelecionavel";
import { Secao, type SeloDeRegiao } from "../../ui/Secao";
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

/**
 * ## Os dois selos de região desta gaveta
 *
 * A gaveta tinha os dois grupos **intercalados**, e um deles move dinheiro
 * real: a regra pausa campanha e altera orçamento sozinha, de madrugada, sem
 * ninguém olhando. O outro só escolhe o horário e o ritmo.
 *
 * 🔴 **A condição entra no lado que mexe na conta, não no lado do ritmo.** Ela
 * parece configuração de leitura, mas é o mecanismo de segurança da regra — e
 * já falhou em silêncio: `gasto ≤ 999999` é visualmente idêntica a
 * `gasto ≥ 999999`, e foi um operador invertido que fez a regra agir sobre tudo
 * o que estava no escopo. Errar a condição é errar o que a Meta recebe.
 *
 * ⚠️ Ver `ui/Secao`: o selo é da REGIÃO. Ao mover um campo de bloco, confira em
 * qual lado ele cai — do lado errado, o selo mente.
 */
const SELO_CONTA: SeloDeRegiao = {
  texto: "⚠ mexe na sua conta do Facebook",
  ajuda:
    "Estes campos decidem o que a regra faz nas suas campanhas: pausar e alterar orçamento, sozinha. A Meta não oferece desfazer.",
  tom: "aviso",
};

const SELO_RITMO: SeloDeRegiao = {
  texto: "⚡ só decide quando roda",
  ajuda:
    "Estes campos mudam o horário e o ritmo da automação. Nenhum deles muda o que ela faz nas suas campanhas.",
};

/** " campanha" / " campanhas" conforme o nível e a quantidade. */
function nivelPlural(level: string, n: number): string {
  const nome = level === "ADSET" ? "conjunto" : level === "AD" ? "anúncio" : "campanha";
  return ` ${nome}${n === 1 ? "" : "s"}`;
}
/** Sufixo de gênero para "Nenhum(a)". */
function nivelSufixo(level: string): string {
  return level === "CAMPAIGN" ? "a campanha" : level === "ADSET" ? " conjunto" : " anúncio";
}

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

/**
 * A regra já usa algum campo do avançado?
 *
 * 🔴 Esconder controle com padrão sensato é bom; esconder um valor que a pessoa
 * **já configurou** é armadilha — ela abriria a gaveta de uma regra que só roda
 * das 8h às 18h e não veria nada sobre isso. Quando há valor fora do padrão, a
 * seção nasce ABERTA.
 *
 * ⚠️ Compara com `RASCUNHO_REGRA`, não com literais soltos: um padrão que mude
 * lá e não aqui faria a seção abrir sozinha para todo mundo.
 */
function usaAvancado(d: RascunhoRegra): boolean {
  return (
    d.calcPeriod !== RASCUNHO_REGRA.calcPeriod ||
    d.windowStart !== "" ||
    d.windowEnd !== "" ||
    d.semLimiteDiario ||
    d.dailyRunLimit !== RASCUNHO_REGRA.dailyRunLimit
  );
}

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

/**
 * Rótulo + campo.
 *
 * ⚠️ Explicação longa vai no `info` (tooltip ⓘ), não no `dica`. Parágrafo de
 * ajuda embaixo de cada campo empilha ruído numa gaveta que já tem 10 campos —
 * quem sabe o que quer só quer preencher. `dica` fica para a linha curta que
 * muda com a escolha (ex.: a unidade selecionada).
 */
function Campo({
  label, dica, info, children,
}: {
  label: string;
  dica?: string;
  info?: ConteudoInfo;
  children: React.ReactNode;
}) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:5px")}>
      <div style={sx("display:flex;align-items:center;gap:5px")}>
        <span style={sx("font-size:12px;font-weight:600")}>{label}</span>
        {info && <InfoTip conteudo={info} tamanho={12} />}
      </div>
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
  workspaceId,
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
  /** Área ativa — a prévia precisa dela para escopar igual ao motor. */
  workspaceId: string | null;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  const d = rascunho;
  const patch = (p: Partial<RascunhoRegra>) => setRascunho({ ...d, ...p });
  const [confirmando, setConfirmando] = useState(false);
  // Inicializador, não efeito: a gaveta é montada do zero a cada abertura
  // (`{rascunho && <RuleDrawer …>}`), então isto roda uma vez por abertura.
  const [avancado, setAvancado] = useState(() => usaAvancado(rascunho));

  // ── Prévia: "esta condição bate em quantas, agora?" ──────────────────────
  //
  // Nasceu do ensaio a seco que disparou: `gasto ≤ 999999` é visualmente
  // idêntica a `gasto ≥ 999999`, e nada distinguia as duas até a regra rodar.
  const [previa, setPrevia] = useState<
    { chave: string; total: number; bateram: number; agiria: number; entidades: RulePreviewEntity[] } | null
  >(null);
  const [testando, setTestando] = useState(false);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);

  /**
   * Tudo que muda o resultado da prévia. Mexer em qualquer um destes torna o
   * número anterior MENTIRA — e um número velho ao lado de uma condição nova é
   * pior que nenhum número, porque parece confirmação.
   */
  // ⚠️ A AÇÃO e seus parâmetros entram na chave: eles não mudam quem BATE, mas
  // mudam quem a ação ALCANÇA (`agiria`) — trocar de "pausar" para "ajustar
  // orçamento" com o número antigo na tela seria a pior forma de mentir.
  const chavePrevia = JSON.stringify([
    d.condicoes, d.level, d.contas, d.calcPeriod, d.produtos,
    d.acao, d.valor, d.unidade, d.sobreGasto, d.maxBudget,
  ]);
  const previaAtual = previa && previa.chave === chavePrevia ? previa : null;

  /** Avisos demonstráveis sem dado nenhum. Ver `lib/rules/analise.ts`. */
  const avisos = analisarCondicoes(d.condicoes);

  const testarCondicao = async () => {
    setTestando(true);
    setErroPrevia(null);
    try {
      const r = await previewRuleConditions(paraInput(d, workspaceId));
      setPrevia({ chave: chavePrevia, total: r.total, bateram: r.bateram, agiria: r.agiria, entidades: r.entidades });
    } catch (e) {
      setErroPrevia(e instanceof Error ? e.message : "Não foi possível testar agora.");
    } finally {
      setTestando(false);
    }
  };

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
      descricao="A regra roda sozinha, de tempos em tempos, e age nas campanhas desta Área de Trabalho."
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
                  Ela age sozinha, sem ninguém olhando — e a Meta não oferece desfazer.
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

      {/* ═══ Região 1 — mexe na conta do Facebook ═══════════════════════════
          A ação vem primeiro porque, numa regra, **escolher a ação é a
          decisão**. E os campos dela (valor, teto) ficam logo abaixo: antes
          moravam depois do construtor de condições, então marcar "Aumentar
          orçamento" fazia o campo do valor nascer do outro lado de um bloco
          inteiro de outra coisa. */}
      <Secao titulo="A ação" selo={SELO_CONTA}>
        <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
          <Campo label="Ação">
            <Select label="" value={d.acao} options={ACOES} onChange={(v) => patch({ acao: v as AcaoUI })} minWidth={210} />
          </Campo>
          <Campo label="Aplicar em">
            <Select label="" value={d.level} options={NIVEIS} onChange={(level) => patch({ level })} minWidth={150} />
          </Campo>
        </div>

        {mexeOrcamento && (
          <Campo
            label={d.acao === "definir" ? "Novo orçamento" : `Quanto ${d.acao === "aumentar" ? "aumentar" : "diminuir"}`}
            dica={
              d.acao === "definir"
                ? d.sobreGasto
                  ? "Percentual sobre o GASTO do período de cálculo."
                  : "Valor absoluto, em reais."
                : d.unidade === "%"
                  ? "Percentual sobre o orçamento atual."
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
        )}

        {(d.acao === "aumentar" || d.acao === "definir") && (
          <Campo label={`Teto de orçamento${exigeTeto ? " (obrigatório)" : " (opcional)"}`} info={AJUDA.regraTeto}>
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
                Informe o teto — sem ele a Trackhub recusa o aumento e a regra nunca age.
              </div>
            )}
          </Campo>
        )}
      </Secao>

      {/* ═══ Região 1 — o alcance ═══════════════════════════════════════════
          Contas antes de produtos: é a conta que limita o estrago. Uma regra de
          orçamento com a conta errada alcança campanhas de outra operação. */}
      <Secao titulo="Onde ela age" selo={SELO_CONTA}>
        <Campo label="Contas de anúncio" info={AJUDA.regraContas}>
          <ListaSelecionavel
            itens={contas}
            selecionados={d.contas}
            onChange={(contas) => patch({ contas })}
            altura={140}
            vazio="Nenhuma conta de anúncio nesta área. Conecte um perfil em Integrações › Anúncios, de dentro desta área — sem conta, a regra alcança as campanhas de todas elas."
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
      </Secao>

      {/* ═══ Região 1 — a condição É o mecanismo de segurança ════════════════
          Ela parece leitura e não é: foi um operador invertido que fez a regra
          agir sobre tudo. Por isso mora deste lado, não no do ritmo. */}
      <Secao titulo="Quando ela dispara" selo={SELO_CONTA}>
        <Campo
          label="Condições"
          dica={`Todas precisam ser verdadeiras ao mesmo tempo (E). As métricas são medidas em: ${
            PERIODOS.find((p) => p.value === d.calcPeriod)?.label.toLowerCase() ?? d.calcPeriod
          }.`}
        >
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

          {/* ── Avisos ESTÁTICOS ──────────────────────────────────────────
              Só o que é demonstrável pela própria condição: contradição e o
              piso das métricas. Nada de heurística de "número grande demais" —
              quem responde "isso pega tudo?" é a prévia, contando. */}
          {avisos.map((a, i) => (
            <p
              key={i}
              style={sx(
                `margin:2px 0 0;font-size:12px;line-height:1.45;color:${
                  a.gravidade === "impossivel" ? "#f87171" : "#fbbf24"
                }`,
              )}
            >
              {a.gravidade === "impossivel" ? "✕" : "⚠"} {a.texto}
            </p>
          ))}

          {/* ── Prévia ────────────────────────────────────────────────────
              Roda a MESMA avaliação do motor (`loadEntities` + `conditionsMet`)
              e para antes do caminho de ação. Ver `previewRule`. */}
          <div style={sx("display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:2px")}>
            <button
              className="btn btn-secondary"
              type="button"
              style={sx("align-self:flex-start;font-size:12px")}
              onClick={testarCondicao}
              disabled={testando || !condicoesValidas}
            >
              {testando ? "Testando…" : "Testar condição"}
            </button>
            <span className="text-muted" style={sx("font-size:11.5px")}>
              Conta em quantas bate agora. Não altera nada no Facebook.
            </span>
          </div>

          {erroPrevia && (
            <p style={sx("margin:0;font-size:12px;color:#f87171")}>{erroPrevia}</p>
          )}

          {previaAtual && (
            <div
              style={sx(
                "border:1px solid var(--color-border);border-radius:var(--radius-2, 8px);" +
                  "padding:10px 12px;display:flex;flex-direction:column;gap:6px",
              )}
            >
              <div style={sx("font-size:13px;font-weight:600")}>
                {previaAtual.total === 0 ? (
                  <span style={sx("color:#fbbf24")}>
                    ⚠ Nenhum{nivelSufixo(d.level)} no escopo — a regra não teria o que avaliar.
                  </span>
                ) : (
                  <span
                    style={sx(
                      previaAtual.bateram === previaAtual.total
                        ? "color:#fbbf24"
                        : previaAtual.bateram === 0
                          ? "color:var(--color-text)"
                          : "",
                    )}
                  >
                    Bate em {previaAtual.bateram} de {previaAtual.total}
                    {nivelPlural(d.level, previaAtual.total)} agora
                  </span>
                )}
              </div>

              {/* ⚠️ Este é o aviso que teria evitado o disparo acidental: a
                  condição sempre-verdadeira aparece como "N de N". */}
              {previaAtual.total > 0 && previaAtual.bateram === previaAtual.total && (
                <p className="text-muted" style={sx("margin:0;font-size:11.5px;line-height:1.45")}>
                  A condição bate em <strong>tudo</strong> que está no escopo. Se a ideia era
                  filtrar, confira o operador.
                </p>
              )}

              {/* 🔴 Bater a condição não é ser alterada. Numa conta só de
                  campanhas ABO, uma regra de orçamento bate em todas e altera
                  NENHUMA — e um número que exagera ensina a ignorar o número. */}
              {previaAtual.bateram > 0 && (
                <div style={sx(`font-size:12px;color:${previaAtual.agiria === 0 ? "#fbbf24" : "var(--color-text)"}`)}>
                  {previaAtual.agiria === 0
                    ? "⚠ Mas a ação não alteraria nenhuma delas."
                    : previaAtual.agiria === previaAtual.bateram
                      ? `A ação alteraria ${previaAtual.agiria === 1 ? "a única que bateu" : "todas elas"}.`
                      : `Destas, a ação alteraria ${previaAtual.agiria}.`}
                  {previaAtual.agiria < previaAtual.bateram && (
                    <span className="text-muted"> As demais são puladas — o motivo aparece ao lado de cada uma.</span>
                  )}
                </div>
              )}

              {/* Quais, não só quantas — para você reconhecer se são as que
                  esperava. Sem os nomes, "3 de 12" não é conferível. */}
              {previaAtual.entidades.length > 0 && (
                <ul style={sx("margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px")}>
                  {previaAtual.entidades.map((e, i) => (
                    <li key={i} style={sx("display:flex;gap:8px;align-items:baseline;font-size:12px")}>
                      <span style={sx(`color:${e.bateu ? "#4ade80" : "var(--color-neutral-500)"};width:11px`)}>
                        {e.bateu ? "✓" : "·"}
                      </span>
                      <span style={sx("flex:1 1 140px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
                        {e.nome}
                      </span>
                      {/* O motivo do pulo é o que transforma "não alterou" em
                          algo acionável: "sem orçamento diário (CBO?)" diz que
                          a regra está no nível errado. */}
                      {e.bateu && !e.acionavel && e.motivo && (
                        <span style={sx("font-size:10.5px;color:#fbbf24;white-space:nowrap")}>{e.motivo}</span>
                      )}
                      <span className="text-muted" style={sx("font-size:11px;font-variant-numeric:tabular-nums")}>
                        {Object.entries(e.valores)
                          .map(([k, v]) => `${k} ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {previaAtual.bateram > previaAtual.entidades.length && (
                <p className="text-muted" style={sx("margin:0;font-size:11px")}>
                  … e mais {previaAtual.bateram - previaAtual.entidades.length}.
                </p>
              )}
              <p className="text-muted" style={sx("margin:0;font-size:11px;line-height:1.4")}>
                Arquivados e excluídos ficam de fora, igual a quando a regra rodar de verdade.
                A janela de horário e o limite diário não entram nesta conta.
              </p>
            </div>
          )}
        </div>
        </Campo>
      </Secao>

      {/* ═══ Região 2 — só decide QUANDO ════════════════════════════════════
          Nada aqui muda o que a regra faz nas campanhas. Os três controles com
          padrão sensato ficam atrás de "Configuração avançada": quem cria uma
          regra decide a ação e a condição, não o intervalo de execução. */}
      <Secao titulo="Ritmo" selo={SELO_RITMO}>
        <Campo label="Frequência" info={AJUDA.regraFrequencia}>
          <Select label="" value={d.frequencyMin} options={FREQUENCIAS} onChange={(frequencyMin) => patch({ frequencyMin })} minWidth={185} />
        </Campo>

        <button
          type="button"
          onClick={() => setAvancado((v) => !v)}
          style={sx(
            "display:flex;align-items:center;gap:6px;align-self:flex-start;" +
              "background:transparent;border:0;padding:0;cursor:pointer;color:inherit;font-size:12.5px",
          )}
        >
          <Icone nome={avancado ? "chevronCima" : "chevronBaixo"} tamanho={14} />
          Configuração avançada
        </button>

        {avancado && (
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
            {/* ⚠️ O período de cálculo não é só agendamento — ele decide o que
                "CPA > 50" significa. Fica aqui porque tem padrão sensato
                ("hoje"), mas o valor escolhido aparece na dica das Condições,
                para a regra nunca ser lida sem a janela dela. */}
            <Campo label="Período de cálculo" info={AJUDA.regraPeriodo}>
              <Select label="" value={d.calcPeriod} options={PERIODOS} onChange={(calcPeriod) => patch({ calcPeriod })} minWidth={175} />
            </Campo>

            <Campo label="Intervalo de execução" info={AJUDA.regraJanela}>
              <div style={sx("display:flex;gap:6px;align-items:center")}>
                <Select label="" value={d.windowStart} options={HORAS} onChange={(windowStart) => patch({ windowStart })} minWidth={140} />
                <span className="text-muted" style={sx("font-size:12px")}>até</span>
                <Select label="" value={d.windowEnd} options={HORAS} onChange={(windowEnd) => patch({ windowEnd })} minWidth={140} />
              </div>
            </Campo>

            <Campo label="Limite de execuções diárias" info={AJUDA.regraLimite}>
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
          </div>
        )}
      </Secao>

      <Checkbox
        checked={d.active}
        onChange={(active) => patch({ active })}
        label="Ativar a regra ao salvar"
        dica={d.active ? "Ela passa a rodar no próximo ciclo." : "Fica salva e parada até você ativar."}
      />

      {erro && <p style={sx("margin:0;font-size:12.5px;color:#ef4444")}>{erro}</p>}
    </Drawer>
  );
}
