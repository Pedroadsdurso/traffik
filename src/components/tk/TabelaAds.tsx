"use client";

import * as React from "react";

import { derivar, somar, type LinhaBase, type MetricasDerivadas } from "@/lib/ads/metrics";
import { MOTIVO_SEM_MEDICAO, podeAfirmar, precisaDeSelo, type FonteDaColuna } from "@/lib/ads/apresentacao";
import type { Medicao } from "@/lib/ads/overview";
import { veiculacao } from "@/lib/ads/veiculacao";
import { corFinanceira } from "@/lib/financeiro";
import { brl, multFmt, pct } from "@/lib/format";
import { METRICAS } from "@/lib/explicacoes";

import { Badge } from "./Badge";
import { Button } from "./Button";
import { Checkbox } from "./Controles";
import { Input } from "./Input";
import { Tooltip } from "./Tooltip";
import { Icone } from "@/components/dashboard/ui/Icone";

/**
 * # TabelaAds — as 19 colunas do Gerenciador, legíveis
 *
 * ## O problema que ela resolve
 *
 * A tabela antiga tinha as mesmas 19 colunas com cabeçalho de 10px, todas
 * sempre visíveis. **Ilegível por definição** (`03`): ninguém lê dezenove
 * números por linha, e a rolagem horizontal levava embora o nome da campanha —
 * o único campo que torna a linha acionável.
 *
 * Duas coisas resolvem, e as duas são desta reescrita (não estão na imagem 4):
 *
 * | | |
 * |---|---|
 * | **Conjuntos nomeados** | `Performance` · `Custo` · `Conversão` · `Tudo`. Seis a sete colunas por vez, escolhidas por PERGUNTA, não por gosto |
 * | **Congelamento** | seleção, toggle e nome+objetivo ficam parados enquanto o resto rola |
 *
 * ⚠️ `Gasto` aparece em dois dos três conjuntos temáticos, e não é descuido: ele
 * é a base de CPA, ROAS, ROI, CPC, CPM e Lucro. Um conjunto de "Custo" sem o
 * gasto obrigaria a trocar de lente para conferir a própria conta.
 *
 * ## 🕳️ A distinção que esta tabela existe para fazer
 *
 * `R$ 0,00` e `—` **não são a mesma afirmação**, e as duas apareciam como
 * `R$ 0,00`. Quem decide qual sai é `lib/ads/apresentacao.ts`, a partir dos três
 * estados de `medicao` — e a decisão vale para toda coluna que vem da Meta, não
 * só para o Gasto. Ver o cabeçalho daquele arquivo.
 *
 * ⛔ **Nenhuma conta muda aqui.** `derivar()` e `somar()` são os mesmos, o
 * rodapé soma o que sempre somou. O que a tabela faz é escolher o que tem
 * permissão de IMPRIMIR.
 */

export type ChaveColunaAds =
  | "veiculacao" | "orcamento" | "gasto" | "vendas" | "cpa" | "faturamento"
  | "lucro" | "roas" | "roiMidia" | "ic" | "cpi" | "cliquesAtr" | "vendasInic"
  | "cpc" | "ctr" | "cpm" | "impressoes" | "cliques" | "bid";

export interface LinhaAds extends LinhaBase {
  id: string;
  /** O id da entidade NA META — o que se copia e o que abre o link de lá. */
  fbId: string;
  nome: string;
  /** Segunda linha da célula do nome: o objetivo, ou a campanha-mãe (`06` §14.4). */
  sub?: string;
  /** O que foi CONFIGURADO. É o que o toggle reflete. */
  status: string;
  /** O que a Meta ENTREGA. `undefined` = este nível não veicula (conta). */
  effectiveStatus?: string | null;
  medicao: Medicao;
  orcamento?: number | null;
  orcamentoEditavel?: boolean;
  bidCap?: number | null;
  /** Filhas da expansão inline. Vazio/ausente = a linha não abre. */
  filhas?: LinhaAds[];
}

interface ColunaAds {
  chave: ChaveColunaAds;
  label: string;
  fonte: FonteDaColuna;
  /**
   * A coluna descreve CONFIGURAÇÃO ou um fato sobre a entidade, não uma medição
   * da janela — então ela não some quando não houve medição.
   *
   * ⚠️ São três, e confundi-las com métrica seria apagar informação verdadeira:
   * `Veiculação` vem do sync da campanha (não do `DailyAdMetric`), e
   * `Orçamento`/`Bid Cap` são o que o usuário configurou. Uma campanha que nunca
   * gastou tem orçamento, e dizer "—" ali afirmaria que ela não tem teto.
   */
  ignoraMedicao?: boolean;
  /** Ausente = a coluna tem desenho próprio (veiculação, orçamento). */
  valor?: (l: LinhaAds, m: MetricasDerivadas) => number | null;
  formato?: (n: number) => string;
  /** Cor financeira. ⛔ Só onde o número É lucro/prejuízo (`06` §10). */
  cor?: (n: number) => string;
}

const inteiro = (n: number) => n.toLocaleString("pt-BR");

export const COLUNAS_ADS: readonly ColunaAds[] = [
  // Vem logo depois do nome porque é a pergunta que se faz ANTES de olhar
  // número nenhum: "isto está rodando?".
  { chave: "veiculacao", label: "Veiculação", fonte: "meta", ignoraMedicao: true },
  { chave: "orcamento", label: "Orçamento", fonte: "meta", ignoraMedicao: true },
  // A ordem é a da leitura natural: quanto POSSO gastar → quanto GASTEI →
  // quanto VENDI.
  { chave: "gasto", label: "Gasto", fonte: "meta", valor: (l) => l.spend, formato: brl },
  { chave: "vendas", label: "Vendas", fonte: "nosso", valor: (l) => l.results, formato: inteiro },
  { chave: "cpa", label: "CPA", fonte: "misto", valor: (_, m) => m.cpa, formato: brl },
  { chave: "faturamento", label: "Faturamento", fonte: "nosso", valor: (l) => l.revenue, formato: brl },
  {
    chave: "lucro", label: "Lucro", fonte: "misto", valor: (_, m) => m.lucro, formato: brl,
    cor: (n) => corFinanceira(n, "lucro"),
  },
  {
    chave: "roas", label: "ROAS", fonte: "misto", valor: (_, m) => m.roas, formato: multFmt,
    cor: (n) => corFinanceira(n, "roas"),
  },
  /* 🔴 "ROI de mídia", não "ROI" — são contas DIFERENTES e não podem ter o mesmo
     nome. No Dashboard, ROI é lucro LÍQUIDO ÷ investimento total (com taxas,
     impostos e despesas); aqui é (faturamento − gasto) ÷ gasto. Taxas só
     existem no nível da conta e não há como ratear por campanha com honestidade. */
  {
    chave: "roiMidia", label: "ROI de mídia", fonte: "misto", valor: (_, m) => m.roi, formato: multFmt,
    cor: (n) => corFinanceira(n, "roi"),
  },
  { chave: "ic", label: "IC", fonte: "nosso", valor: (l) => l.ic ?? 0, formato: inteiro },
  { chave: "cpi", label: "CPI", fonte: "misto", valor: (_, m) => m.cpi, formato: brl },
  { chave: "cliquesAtr", label: "Cliq. atr.", fonte: "nosso", valor: (l) => l.cliquesAtribuidos ?? 0, formato: inteiro },
  { chave: "vendasInic", label: "Vend. inic.", fonte: "nosso", valor: (l) => l.vendasIniciadas ?? 0, formato: inteiro },
  { chave: "cpc", label: "CPC", fonte: "meta", valor: (_, m) => m.cpc, formato: brl },
  { chave: "ctr", label: "CTR", fonte: "meta", valor: (_, m) => m.ctr, formato: pct },
  { chave: "cpm", label: "CPM", fonte: "meta", valor: (_, m) => m.cpm, formato: brl },
  { chave: "impressoes", label: "Impressões", fonte: "meta", valor: (l) => l.impressions, formato: inteiro },
  { chave: "cliques", label: "Cliques", fonte: "meta", valor: (l) => l.clicks, formato: inteiro },
  { chave: "bid", label: "Bid Cap", fonte: "meta", ignoraMedicao: true, valor: (l) => l.bidCap ?? null, formato: brl },
];

export type ConjuntoDeColunas = "performance" | "custo" | "conversao" | "tudo";

/**
 * Os conjuntos nomeados. Cada um responde uma PERGUNTA, e é por isso que eles
 * se sobrepõem: quem está olhando custo também precisa do gasto.
 */
export const CONJUNTOS_DE_COLUNAS: {
  id: ConjuntoDeColunas;
  rotulo: string;
  pergunta: string;
  colunas: ChaveColunaAds[];
}[] = [
  {
    id: "performance",
    rotulo: "Performance",
    pergunta: "Está dando retorno?",
    colunas: ["veiculacao", "orcamento", "gasto", "faturamento", "lucro", "roas"],
  },
  {
    id: "custo",
    rotulo: "Custo",
    pergunta: "Quanto custa cada coisa?",
    colunas: ["veiculacao", "orcamento", "gasto", "cpc", "cpm", "cpa", "cpi"],
  },
  {
    id: "conversao",
    rotulo: "Conversão",
    pergunta: "Onde a jornada trava?",
    colunas: ["veiculacao", "vendas", "faturamento", "ic", "cliquesAtr", "vendasInic", "cpa"],
  },
  {
    id: "tudo",
    rotulo: "Tudo",
    pergunta: "As 19 colunas",
    colunas: COLUNAS_ADS.map((c) => c.chave),
  },
];

/**
 * O valor de uma coluna para ORDENAR — a mesma função que a célula imprime.
 *
 * ⛔ Exportada de propósito: quem ordena é a tela (a ordenação vem ANTES da
 * paginação, e a tabela só vê a página). Se a tela tivesse a própria conta,
 * ordenar por ROAS poderia discordar do ROAS impresso ao lado.
 *
 * ⚠️ `null` para o que não pode ser afirmado, e não `0`: quem ordena precisa
 * saber a diferença para jogar as sem medição para o fim, em vez de fingir que
 * elas são as mais baratas da lista.
 */
export function valorDaColuna(l: LinhaAds, chave: ChaveColunaAds): number | null {
  if (chave === "veiculacao") return null;
  if (chave === "orcamento") return l.orcamento ?? null;
  const col = COLUNAS_ADS.find((c) => c.chave === chave);
  if (!col?.valor) return null;
  if (!col.ignoraMedicao && !podeAfirmar(col.fonte, l.medicao)) return null;
  return col.valor(l, derivar(l));
}

/**
 * De onde o número vem, em PALAVRA.
 *
 * 🔧 **A tabela antiga marcava isto com um ponto colorido por coluna — azul,
 * roxo, cinza —, e aqui ele SAIU.** O `06` §10 reserva a cor: azul é "onde eu
 * clico", ciano é "acontecendo agora", verde/vermelho são lucro e prejuízo.
 * Procedência não é nenhuma dessas coisas, e três pontos coloridos num
 * cabeçalho de 19 colunas gastavam a única cor que dá significado à tela para
 * dizer algo que cabe numa palavra.
 *
 * ⚠️ A informação NÃO se perdeu, que era o risco: ela virou uma linha dentro da
 * ajuda de cada coluna. Quem precisa saber por que o número difere do
 * Gerenciador da Meta encontra ali, no lugar em que já está perguntando.
 */
const NOME_FONTE: Record<FonteDaColuna, string> = {
  meta: "Vem do Facebook",
  nosso: "Medido pela Trackhub",
  misto: "Calculado a partir dos dois",
};

/** O travessão, com o motivo no `title`. Ver `MOTIVO_SEM_MEDICAO`. */
function Traco({ motivo }: { motivo?: string }) {
  return (
    <span className="text-text-muted" title={motivo} style={{ opacity: 0.55 }}>
      —
    </span>
  );
}

/**
 * A ajuda da coluna, a partir de `lib/explicacoes.ts`.
 *
 * ⚠️ O texto NÃO é escrito aqui. Aquele arquivo existe para a mesma métrica ser
 * explicada igual no Dashboard e no Gerenciador — antes o CPA tinha uma
 * descrição em cada tela, e elas já divergiam.
 */
function AjudaDaColuna({ chave, fonte }: { chave: ChaveColunaAds; fonte: FonteDaColuna }) {
  const info = METRICAS[chave];
  if (!info) return null;
  return (
    <Tooltip
      texto={
        <span style={{ display: "block", maxWidth: 260 }}>
          <strong style={{ display: "block", marginBottom: 3 }}>{info.titulo}</strong>
          {info.corpo?.map((p) => (
            <span key={p} style={{ display: "block", marginBottom: 3 }}>{p}</span>
          ))}
          {info.formula && (
            <span className="text-text-muted" style={{ display: "block" }}>{info.formula}</span>
          )}
          {/* A procedência, que era o ponto colorido. Ver `NOME_FONTE`. */}
          <span className="text-text-muted" style={{ display: "block", marginTop: 3 }}>{NOME_FONTE[fonte]}</span>
        </span>
      }
    >
      <span
        tabIndex={0}
        role="img"
        aria-label={`O que é ${info.titulo}`}
        className="text-text-muted"
        style={{ cursor: "help", lineHeight: 1, display: "inline-flex" }}
      >
        <Icone nome="info" tamanho={12} />
      </span>
    </Tooltip>
  );
}

/**
 * Selo de veiculação.
 *
 * ⚠️ **A divergência precisa ser VISÍVEL sem hover.** O caso que esta coluna
 * existe para resolver — "está ligada e não roda" — é justamente o que passa
 * batido: a linha diz ativa, o toggle está ligado, e a pessoa vai procurar o
 * erro no rastreamento. Por isso a divergência vira selo de ATENÇÃO com "⚠", e
 * não um `title`.
 */
function SeloVeiculacao({ linha }: { linha: LinhaAds }) {
  // Ausente ≠ nulo: a conta não veicula nada, e um "aguardando sincronização"
  // ali seria falso.
  if (linha.effectiveStatus === undefined) {
    return <Traco motivo="A veiculação é informada por campanha, conjunto e anúncio." />;
  }
  const v = veiculacao(linha.status, linha.effectiveStatus);
  if (v.tom === "indefinido" && !v.desconhecido) return <Traco motivo={v.detalhe} />;

  const TOM = { ok: "success", pausado: "neutral", atencao: "warning", erro: "danger", apagado: "neutral", indefinido: "neutral" } as const;
  return (
    <Badge
      tom={TOM[v.tom]}
      title={`${v.divergente ? `Configurado como ativo, mas não está entregando. ` : ""}${v.detalhe}${v.cru ? `\n\nA Meta chama isto de: ${v.cru}` : ""}`}
    >
      {v.divergente && <span aria-hidden="true">⚠</span>}
      {v.rotulo}
    </Badge>
  );
}

/** Célula de orçamento: o valor e, quando editável NESTE nível, a caneta. */
function CelulaOrcamento({
  linha,
  aoSalvar,
}: {
  linha: LinhaAds;
  aoSalvar: (id: string, valor: number) => Promise<void>;
}) {
  const [editando, setEditando] = React.useState(false);
  const [valor, setValor] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  if (!linha.orcamentoEditavel) {
    /* Nível errado para este tipo de campanha — mostra o valor, sem caneta, para
       não oferecer uma edição que a Meta recusaria. */
    return <>{linha.orcamento != null ? brl(linha.orcamento) : <Traco motivo="O orçamento desta campanha vive nos conjuntos (ABO)." />}</>;
  }

  async function salvar() {
    const n = parseFloat(valor.replace(",", "."));
    if (!n || n <= 0) return;
    setSalvando(true);
    try {
      await aoSalvar(linha.id, n);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
        <Input
          autoFocus
          inputMode="decimal"
          value={valor}
          disabled={salvando}
          blocoInteiro={false}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
            if (e.key === "Escape") setEditando(false);
          }}
          style={{ width: 96, textAlign: "right" }}
          aria-label={`Novo orçamento de ${linha.nome}`}
        />
        <Button variante="fantasma" apenasIcone carregando={salvando} onClick={() => void salvar()} aria-label="Salvar orçamento">
          <Icone nome="ok" tamanho={14} />
        </Button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
      {linha.orcamento != null ? brl(linha.orcamento) : <Traco motivo="Sem orçamento configurado nesta linha." />}
      <Button
        variante="fantasma"
        apenasIcone
        onClick={() => {
          setValor(linha.orcamento != null ? String(linha.orcamento).replace(".", ",") : "");
          setEditando(true);
        }}
        title="Editar orçamento"
        aria-label={`Editar orçamento de ${linha.nome}`}
      >
        <Icone nome="editar" tamanho={13} cor="marca" />
      </Button>
    </span>
  );
}

/** Larguras das três congeladas. O `left` de cada uma é a soma das anteriores. */
const L_SELECAO = 40;
const L_TOGGLE = 52;

export function TabelaAds({
  linhas,
  colunas,
  selecionadas,
  aoSelecionar,
  aoSelecionarTodas,
  aoAlternarStatus,
  aoSalvarOrcamento,
  ordem,
  aoOrdenar,
  fixadas,
  carregando,
  vazio,
}: {
  linhas: LinhaAds[];
  /** As chaves do conjunto escolhido, na ordem. */
  colunas: ChaveColunaAds[];
  selecionadas: Set<string>;
  aoSelecionar: (id: string) => void;
  aoSelecionarTodas: () => void;
  aoAlternarStatus: (id: string) => void;
  aoSalvarOrcamento: (id: string, valor: number) => Promise<void>;
  ordem: { chave: ChaveColunaAds; dir: "asc" | "desc" } | null;
  aoOrdenar: (chave: ChaveColunaAds) => void;
  /** Ids fixados no topo. A ordenação já os colocou lá; aqui é só o alfinete. */
  fixadas: Set<string>;
  carregando: boolean;
  vazio: React.ReactNode;
}) {
  const [abertas, setAbertas] = React.useState<Set<string>>(new Set());
  const visiveis = COLUNAS_ADS.filter((c) => colunas.includes(c.chave));
  const todasMarcadas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.id));

  /* O rodapé soma as linhas de PRIMEIRO nível — as filhas abertas já estão
     dentro delas, e somá-las junto contaria o mesmo gasto duas vezes. */
  const totais = somar(linhas);
  const md = derivar(totais);

  function alternarAberta(id: string) {
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Uma linha e, se aberta, as filhas dela — recursivo por nível. */
  function desenharLinha(l: LinhaAds, nivel: number): React.ReactNode[] {
    const m = derivar(l);
    const marcada = selecionadas.has(l.id);
    const aberta = abertas.has(l.id);
    const temFilhas = (l.filhas?.length ?? 0) > 0;
    const ativo = l.status === "ACTIVE";

    const linha = (
      <tr key={l.id} data-marcada={marcada || undefined} data-filha={nivel > 0 || undefined}>
        <td className="tk-ads-fixa" style={{ left: 0, width: L_SELECAO }}>
          <Checkbox marcado={marcada} aoMudar={() => aoSelecionar(l.id)} aria-label={`Selecionar ${l.nome}`} />
        </td>
        <td className="tk-ads-fixa" style={{ left: L_SELECAO, width: L_TOGGLE }}>
          {/* ⚠️ O toggle reflete o CONFIGURADO (`status`), nunca a veiculação:
              ele é o controle do que o usuário escolheu, e a coluna Veiculação
              é que diz se a Meta está entregando. */}
          <button
            type="button"
            role="switch"
            aria-checked={ativo}
            onClick={() => aoAlternarStatus(l.id)}
            aria-label={`${ativo ? "Pausar" : "Ativar"} ${l.nome}`}
            className={ativo ? "bg-primary-solid" : "bg-surface-hover border border-border"}
            style={{
              width: 30, height: 17, borderRadius: "var(--tk-radius-pill)", cursor: "pointer",
              padding: 2, display: "flex", alignItems: "center",
              justifyContent: ativo ? "flex-end" : "flex-start",
              transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 13, height: 13, borderRadius: "var(--tk-radius-pill)", display: "block",
                background: ativo ? "var(--tk-on-primary)" : "var(--tk-text-muted)",
                transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
              }}
            />
          </button>
        </td>
        <td className="tk-ads-fixa tk-ads-fixa-fim" style={{ left: L_SELECAO + L_TOGGLE, minWidth: 240, maxWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, paddingLeft: nivel * 18 }}>
            {/* O chevron ocupa o lugar mesmo quando não abre — sem isso o nome
                das linhas sem filha fica 20px à esquerda das outras. */}
            {temFilhas ? (
              <button
                type="button"
                onClick={() => alternarAberta(l.id)}
                aria-expanded={aberta}
                aria-label={`${aberta ? "Recolher" : "Expandir"} ${l.nome}`}
                className="text-text-muted hover:text-text"
                style={{ background: "none", border: 0, cursor: "pointer", padding: 0, lineHeight: 0, flex: "none" }}
              >
                <Icone nome={aberta ? "chevronBaixo" : "chevronDireita"} tamanho={14} />
              </button>
            ) : (
              <span aria-hidden="true" style={{ width: 14, flex: "none" }} />
            )}
            {fixadas.has(l.id) && (
              <span title="Fixada no topo" aria-hidden="true" style={{ flex: "none", lineHeight: 0 }}>
                <Icone nome="fixado" tamanho={12} cor="marca" />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="text-label text-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.nome}
              </div>
              {/* `06` §14.4 — sub-rótulo na célula: qualifica sem gastar coluna. */}
              {l.sub && (
                <div className="text-caption text-text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.sub}
                </div>
              )}
            </div>
            {/* ⚠️ O selo é só de `nunca-sincronizada`. Ver `precisaDeSelo`. */}
            {precisaDeSelo(l.medicao) && (
              <span style={{ flex: "none" }}>
                <Badge tom="neutral" title={MOTIVO_SEM_MEDICAO["nunca-sincronizada"]}>
                  não sincronizado
                </Badge>
              </span>
            )}
          </div>
        </td>

        {visiveis.map((c) => (
          <td key={c.chave}>{celula(l, m, c, aoSalvarOrcamento)}</td>
        ))}
      </tr>
    );

    if (!aberta || !temFilhas) return [linha];
    return [linha, ...(l.filhas ?? []).flatMap((f) => desenharLinha(f, nivel + 1))];
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      {/* Por que os números divergem do Gerenciador da Meta. Sem esta linha o
          usuário compara os dois, vê valores diferentes e conclui que um está
          errado — e o texto já existe em `lib/explicacoes.ts`. */}
      {METRICAS.divergenciaMeta && (
        <div className="text-caption text-text-muted" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 2px" }}>
          <Tooltip
            texto={
              <span style={{ display: "block", maxWidth: 280 }}>
                <strong style={{ display: "block", marginBottom: 3 }}>{METRICAS.divergenciaMeta.titulo}</strong>
                {METRICAS.divergenciaMeta.corpo?.map((p) => (
                  <span key={p} style={{ display: "block", marginBottom: 3 }}>{p}</span>
                ))}
              </span>
            }
          >
            <button
              type="button"
              className="text-caption text-text-muted hover:text-text-secondary"
              style={{ background: "none", border: 0, cursor: "help", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Icone nome="info" tamanho={12} />
              Cada coluna diz na ajuda de onde vem o número — e por que ele pode divergir da Meta
            </button>
          </Tooltip>
        </div>
      )}

      <div style={{ overflowX: "auto", minWidth: 0 }}>
        <table className="tk-ads">
          <thead>
            <tr>
              <th className="tk-ads-fixa" style={{ left: 0, width: L_SELECAO }}>
                <Checkbox
                  marcado={todasMarcadas}
                  /* "Alguns" é um terceiro estado e o checkbox sabe desenhá-lo:
                     sem `indeterminado`, uma seleção parcial fica idêntica a
                     nenhuma seleção. */
                  indeterminado={selecionadas.size > 0}
                  aoMudar={aoSelecionarTodas}
                  aria-label="Selecionar todas as linhas"
                />
              </th>
              <th className="tk-ads-fixa text-micro text-text-secondary" style={{ left: L_SELECAO, width: L_TOGGLE }}>
                Ativo
              </th>
              <th className="tk-ads-fixa tk-ads-fixa-fim text-micro text-text-secondary" style={{ left: L_SELECAO + L_TOGGLE }}>
                Nome
              </th>
              {visiveis.map((c) => {
                const ordenada = ordem?.chave === c.chave;
                return (
                  <th
                    key={c.chave}
                    aria-sort={ordenada ? (ordem.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => aoOrdenar(c.chave)}
                        className={`text-micro ${ordenada ? "text-text" : "text-text-secondary hover:text-text"}`}
                        style={{ background: "none", border: 0, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        {c.label}
                        {ordenada && (
                          <span aria-hidden="true" style={{ lineHeight: 0 }}>
                            <Icone nome={ordem.dir === "asc" ? "chevronCima" : "chevronBaixo"} tamanho={11} cor="marca" />
                          </span>
                        )}
                      </button>
                      <AjudaDaColuna chave={c.chave} fonte={c.fonte} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={3 + visiveis.length} style={{ textAlign: "center", height: "auto", padding: "var(--tk-pad-card)" }}>
                  {carregando ? <span className="text-body text-text-muted">Carregando…</span> : vazio}
                </td>
              </tr>
            ) : (
              linhas.flatMap((l) => desenharLinha(l, 0))
            )}
          </tbody>

          {linhas.length > 0 && (
            <tfoot>
              <tr>
                <td className="tk-ads-fixa" style={{ left: 0 }} />
                <td className="tk-ads-fixa" style={{ left: L_SELECAO }} />
                <td className="tk-ads-fixa tk-ads-fixa-fim text-label" style={{ left: L_SELECAO + L_TOGGLE }}>
                  Total de {linhas.length}
                </td>
                {visiveis.map((c) => (
                  <td key={c.chave} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {rodape(c, totais, md, linhas)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** O conteúdo de uma célula de dado. */
function celula(
  l: LinhaAds,
  m: MetricasDerivadas,
  c: ColunaAds,
  aoSalvarOrcamento: (id: string, valor: number) => Promise<void>,
): React.ReactNode {
  if (c.chave === "veiculacao") return <SeloVeiculacao linha={l} />;
  if (c.chave === "orcamento") return <CelulaOrcamento linha={l} aoSalvar={aoSalvarOrcamento} />;

  /* 🕳️ AQUI. Sem medição, nada que venha da Meta pode ser impresso — nem o
     `R$ 0,00` do gasto, nem o `R$ 0,00` de CPA que `div(0, results)` produz. */
  if (!c.ignoraMedicao && !podeAfirmar(c.fonte, l.medicao) && l.medicao !== "medida") {
    return <Traco motivo={MOTIVO_SEM_MEDICAO[l.medicao]} />;
  }

  const v = c.valor?.(l, m) ?? null;
  // `null` aqui é o denominador zero do `div()`: "não existe", não "é zero".
  if (v === null) return <Traco motivo="Não existe: o denominador desta conta é zero no período." />;
  return (
    <span style={{ color: c.cor?.(v) ?? "var(--tk-text)", fontVariantNumeric: "tabular-nums" }}>
      {(c.formato ?? inteiro)(v)}
    </span>
  );
}

/**
 * A medição do TOTAL — a melhor das linhas somadas.
 *
 * 🔴 Achado pelo teste diferencial, e é o mesmo defeito uma camada acima: com
 * TODAS as linhas sem medição, o rodapé imprimia `R$ 0,00` de gasto e de CPA.
 * A soma de nada observado não é zero observado.
 *
 * ⚠️ "A melhor" e não "todas": uma tabela em que UMA campanha sincronizou tem um
 * total observado — parcial, mas observado. É a mesma regra que a linha de conta
 * usa para agregar as campanhas dela, e ela precisa ser a mesma nos dois lugares.
 */
function medicaoDoTotal(linhas: LinhaAds[]): Medicao {
  if (linhas.some((l) => l.medicao === "medida")) return "medida";
  if (linhas.some((l) => l.medicao === "sem-veiculacao")) return "sem-veiculacao";
  return "nunca-sincronizada";
}

/** O rodapé de totais. Nem toda coluna soma — e as que não somam dizem por quê. */
function rodape(c: ColunaAds, totais: LinhaBase, md: MetricasDerivadas, linhas: LinhaAds[]): React.ReactNode {
  if (c.chave === "veiculacao") {
    /* Veiculação não soma — mas "quantas estão ligadas e paradas" é exatamente
       o número que se procura numa lista longa, onde um selo âmbar por linha
       passa despercebido. */
    const divergentes = linhas.filter(
      (l) => l.effectiveStatus !== undefined && veiculacao(l.status, l.effectiveStatus).divergente,
    ).length;
    if (divergentes === 0) return <Traco />;
    return (
      <span style={{ color: "var(--tk-warning)" }}>
        {/* "sem entregar" e não "paradas": a mesma tabela lista campanhas,
            conjuntos e anúncios, e o gênero mudaria. */}
        {divergentes} sem entregar
      </span>
    );
  }
  // Orçamento e bid cap não somam: são tetos de linhas diferentes, e a soma
  // deles não significaria nada.
  if (c.chave === "orcamento" || c.chave === "bid") return <Traco motivo="Tetos de linhas diferentes não se somam." />;

  // 🕳️ A MESMA REGRA DA CÉLULA, no total. Ver `medicaoDoTotal`.
  const medicao = medicaoDoTotal(linhas);
  if (!c.ignoraMedicao && !podeAfirmar(c.fonte, medicao) && medicao !== "medida") {
    return <Traco motivo={MOTIVO_SEM_MEDICAO[medicao]} />;
  }

  const v = c.valor?.(fakeLinha(totais), md) ?? null;
  if (v === null) return <Traco />;
  return <span style={{ color: c.cor?.(v) ?? "var(--tk-text)" }}>{(c.formato ?? inteiro)(v)}</span>;
}

/**
 * O total como se fosse uma linha, para reusar o mesmo `valor()` das células.
 *
 * ⚠️ `medicao: "medida"` aqui é inofensivo: quem decide se o total pode ser
 * impresso é o `medicaoDoTotal`, ANTES desta chamada. Este campo só existe
 * porque `valor()` recebe uma `LinhaAds`.
 *
 * ⛔ E a SOMA não mudou: `somar()` continua tratando parcela sem medição como
 * zero, exatamente como antes desta tela existir. O que mudou é se o resultado
 * é impresso — conta é território congelado, apresentação não.
 */
function fakeLinha(t: LinhaBase): LinhaAds {
  return { ...t, id: "__total__", fbId: "", nome: "", status: "", medicao: "medida" };
}
