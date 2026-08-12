import { NAV_PREVIA } from "@/lib/auth/conteudo";
/* ⛔ A curva vem do helper COMPARTILHADO (`test:curva`, com a invariante de não
   sair do intervalo entre pontos consecutivos), e não de uma polilinha escrita
   aqui. Duas implementações da mesma conta divergem sempre — e a divergência
   aqui seria a prévia desenhando um gráfico com forma diferente da do produto. */
import { caminhoSuave, fecharArea, type Ponto } from "@/lib/grafico/curva";
import { MarcaAuth } from "./MarcaAuth";

/**
 * PreviaProduto — o retrato em miniatura do painel, no lado esquerdo da entrada.
 *
 * ⛔ É DECORAÇÃO, E ESTÁ DECLARADO COMO TAL. `aria-hidden` no contêiner inteiro:
 * um leitor de tela que lesse "R$ 1.248.672,00" aqui anunciaria um número de
 * demonstração com a mesma voz com que anuncia o faturamento de verdade lá
 * dentro. As três provas logo acima já carregam a mensagem em texto.
 *
 * 🔴 A NAVEGAÇÃO É A REAL, e a lista vem de `NAV_PREVIA` justamente para poder
 * ser conferida. A referência desenha `Conversões`, `Relatórios` e `Logs` — três
 * áreas que não existem nesta ferramenta. Desenhá-las seria a tela de entrada
 * prometendo produto que ninguém construiu, no exato momento em que a
 * expectativa se forma.
 *
 * ⚠️ Os NÚMEROS, ao contrário dos rótulos, são de demonstração e é isso mesmo:
 * não existe usuário logado para ter dado nenhum. O que não pode é a ESTRUTURA
 * mentir — área que não existe, métrica que o produto não calcula.
 */
export function PreviaProduto() {
  return (
    <div
      aria-hidden="true"
      className="bg-surface border-border rounded-card overflow-hidden select-none"
      style={{
        border: "1px solid var(--tk-border)",
        boxShadow: "var(--tk-shadow-card)",
        display: "grid",
        /* 148px e não 126: a 126 o rótulo mais longo do rail de verdade
           ("Gerenciador de Anúncios") saía com reticência. Encurtar o rótulo
           resolveria a largura e quebraria a guarda que confere a prévia contra
           o `Rail` — e a guarda é que está certa: o nome tem de ser o real. */
        gridTemplateColumns: "162px 1fr",
        /* ⛔ ALTURA FIXA, e o `flex: 1` que estava aqui foi REMOVIDO depois de
           ver a tela: esticando, o gráfico comia a folga toda e a miniatura
           virava "um gráfico enorme com cartõezinhos" — proporção que nenhum
           painel real tem, num elemento cuja única função é parecer o painel.

           A folga que sobra na coluna fica ENTRE a prévia e o rodapé de
           segurança, ou seja FORA do cartão. Vão fora não promete nada; vão
           dentro faria a prévia afirmar que ali cabia mais conteúdo.

           ⚠️ O TETO existe pelo mesmo motivo: sem ele o gráfico engolia a folga
           inteira e a miniatura ficava com 75% de área de plotagem — proporção
           que nenhum painel real tem, num elemento cuja única função é parecer
           o painel. Com teto, a folga que sobra cai FORA do cartão. */
        flex: 1,
        minHeight: 300,
        maxHeight: 470,
      }}
    >
      <BarraLateral />
      <Conteudo />
    </div>
  );
}

/* ── coluna da esquerda ─────────────────────────────────────────────────────── */

function BarraLateral() {
  return (
    <div
      className="border-border"
      style={{
        borderRight: "1px solid var(--tk-border)",
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px 2px" }}>
        <MarcaMini />
        <span className="text-text" style={{ fontSize: 11, fontWeight: 600 }}>
          TrackHub
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV_PREVIA.map((rotulo, i) => {
          const ativo = i === 0;
          return (
            <div
              key={rotulo}
              className={ativo ? "bg-tint-primary" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 6px",
                borderRadius: 6,
              }}
            >
              <span
                className={ativo ? "bg-on-tint-primary" : "bg-text-muted"}
                style={{ width: 9, height: 9, borderRadius: 2, flex: "none", opacity: ativo ? 1 : 0.5 }}
              />
              <span
                className={ativo ? "text-on-tint-primary" : "text-text-muted"}
                style={{
                  fontSize: 9.5,
                  fontWeight: ativo ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {rotulo}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** O símbolo segue o tema pelo MESMO caminho do rail — ver `MarcaAuth`. */
function MarcaMini() {
  return <MarcaAuth variante="simbolo" largura={14} />;
}

/* ── coluna da direita ──────────────────────────────────────────────────────── */

/**
 * ⚠️ Só métricas que a ferramenta CALCULA de verdade. `ROI`, `ROAS`, `Receita`,
 * `Gasto` e `Lucro` saem de `lib/dashboard/metrics.ts`; `Vendas` é contagem por
 * pedido. Nada aqui é métrica inventada para encher o quadro.
 */
const KPIS_GRANDES = [
  { rotulo: "Receita", valor: "R$ 1.248.672,00", delta: "18,7%" },
  { rotulo: "Gasto", valor: "R$ 543.768,00", delta: "12,4%" },
  { rotulo: "Lucro", valor: "R$ 704.904,00", delta: "24,1%" },
];

const KPIS_PEQUENOS = [
  { rotulo: "ROI", valor: "3,21", delta: "12,4%" },
  { rotulo: "ROAS", valor: "3,21", delta: "12,4%" },
  { rotulo: "Vendas", valor: "9.876", delta: "19,2%" },
];

function Conteudo() {
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="text-text" style={{ fontSize: 11, fontWeight: 600 }}>
          Visão geral
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span className="bg-success" style={{ width: 5, height: 5, borderRadius: 999 }} />
          <span className="text-text-muted" style={{ fontSize: 9 }}>
            Tudo funcionando
          </span>
        </span>
        <span
          className="text-text-secondary border-border"
          style={{
            marginLeft: "auto",
            fontSize: 9,
            border: "1px solid var(--tk-border)",
            borderRadius: 6,
            padding: "3px 7px",
            whiteSpace: "nowrap",
          }}
        >
          Últimos 30 dias
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {KPIS_GRANDES.map((k) => (
          <CartaoMini key={k.rotulo} {...k} tamanho={12.5} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {KPIS_PEQUENOS.map((k) => (
          <CartaoMini key={k.rotulo} {...k} tamanho={14} />
        ))}
      </div>

      <div
        className="border-border"
        style={{
          border: "1px solid var(--tk-border)",
          borderRadius: 8,
          padding: 8,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="text-text" style={{ fontSize: 10, fontWeight: 600 }}>
            Receita × Gasto
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            <Legenda cor="var(--tk-primary)" texto="Receita" />
            <Legenda cor="var(--tk-accent)" texto="Gasto" />
          </span>
        </div>
        <GraficoMini />
      </div>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{ width: 6, height: 6, borderRadius: 2, background: cor }} />
      <span className="text-text-muted" style={{ fontSize: 8.5 }}>
        {texto}
      </span>
    </span>
  );
}

function CartaoMini({
  rotulo,
  valor,
  delta,
  tamanho,
}: {
  rotulo: string;
  valor: string;
  delta: string;
  tamanho: number;
}) {
  return (
    <div
      className="border-border"
      style={{
        border: "1px solid var(--tk-border)",
        borderRadius: 8,
        padding: "7px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}
    >
      <span className="text-text-muted" style={{ fontSize: 8.5 }}>
        {rotulo}
      </span>
      <span
        className="text-text"
        style={{ fontSize: tamanho, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}
      >
        {valor}
      </span>
      {/* Pílula de variação — o ÚNICO lugar da prévia com cor semântica, que é a
          regra do `06` §10: verde é lucro, nunca volume. */}
      <span className="text-success" style={{ fontSize: 8, whiteSpace: "nowrap" }}>
        ↑ {delta}
      </span>
    </div>
  );
}

/**
 * Duas séries desenhadas com curva monotônica e área — o mesmo desenho do
 * `LineChart` de verdade (`06` §3), em miniatura.
 *
 * ⚠️ As duas séries são o DESTAQUE e o ACENTO, nunca verde/vermelho: receita e
 * gasto são VOLUME, e volume não recebe cor semântica.
 */
const SERIE_RECEITA = [38, 52, 44, 61, 55, 70, 64, 78, 72, 86, 80, 95];
const SERIE_GASTO = [22, 28, 25, 33, 30, 38, 34, 43, 39, 47, 44, 52];

function GraficoMini() {
  const L = 300;
  const A = 84;
  const maximo = 100;

  const pontos = (serie: number[]): Ponto[] =>
    serie.map((v, i) => [(i / (serie.length - 1)) * L, A - (v / maximo) * A]);

  const receita = pontos(SERIE_RECEITA);
  const gasto = pontos(SERIE_GASTO);
  const linhaReceita = caminhoSuave(receita);

  return (
    /* ⚠️ `preserveAspectRatio="none"` foi REMOVIDO: ele esticava o traço no
       eixo y e a espessura da linha saía diferente da horizontal. */
    <svg viewBox={`0 0 ${L} ${A}`} style={{ width: "100%", flex: 1, minHeight: 0 }}>
      <defs>
        <linearGradient id="previa-receita" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--tk-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--tk-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fecharArea(linhaReceita, 0, L, A)} fill="url(#previa-receita)" />
      <path d={caminhoSuave(gasto)} fill="none" stroke="var(--tk-accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={linhaReceita} fill="none" stroke="var(--tk-primary)" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
