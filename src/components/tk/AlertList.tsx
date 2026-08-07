"use client";

import * as React from "react";

import { Icone } from "@/components/dashboard/ui/Icone";

/**
 * AlertList — o painel que não existia, e a única coisa do Dashboard que EXIGE
 * AÇÃO.
 *
 * Todo o resto da tela é monitoramento: números que você olha e segue a vida.
 * Aqui é o contrário — cada linha é um problema custando dinheiro agora. É por
 * isso que ele fica acima da dobra e ao lado do gráfico principal, e não num
 * rodapé.
 *
 * 🔴 REGRA DE CONTEÚDO: alerta é o que pede DECISÃO, não o que é apenas
 * verdadeiro. "Faturamento caiu 3%" não é alerta — é o KPI fazendo o trabalho
 * dele. "Gasto de R$ 2.340 sem nenhuma conversão em 4 campanhas" é, porque a
 * pessoa precisa ir pausar alguma coisa. Se um dia esta lista encher de coisas
 * que ninguém aciona, ela vira decoração e para de ser lida — e aí o alerta que
 * importa chega no meio de dez que já estavam lá. É o mesmo raciocínio do
 * `ACEITOS` no teste de contraste.
 *
 * ⚠️ Sem alerta é BOA NOTÍCIA, e o estado vazio precisa dizer isso. Um "nenhum
 * resultado" cinza aqui lê como falha de carregamento.
 */

export type Severidade = "danger" | "warning" | "info";

export type Alerta = {
  id: string;
  severidade: Severidade;
  titulo: string;
  detalhe?: string;
  /** Já formatado — "há 2h". A formatação de tempo é do fuso do usuário. */
  quando?: string;
  href?: string;
};

const TOM: Record<Severidade, { classe: string; glifo: string; rotulo: string }> = {
  danger: { classe: "bg-tint-danger text-on-tint-danger", glifo: "✕", rotulo: "Crítico" },
  warning: { classe: "bg-tint-warning text-on-tint-warning", glifo: "!", rotulo: "Atenção" },
  info: { classe: "bg-tint-primary text-on-tint-primary", glifo: "i", rotulo: "Informação" },
};

/** Crítico primeiro. Dentro da mesma severidade, mantém a ordem de chegada. */
const PESO: Record<Severidade, number> = { danger: 0, warning: 1, info: 2 };

export function AlertList({
  alertas,
  limite = 3,
}: {
  alertas: Alerta[];
  limite?: number;
}) {
  const [expandido, setExpandido] = React.useState(false);
  const ordenados = React.useMemo(
    () => [...alertas].sort((a, b) => PESO[a.severidade] - PESO[b.severidade]),
    [alertas],
  );
  const visiveis = expandido ? ordenados : ordenados.slice(0, limite);
  const restantes = ordenados.length - visiveis.length;

  if (alertas.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", padding: "20px 12px" }}>
        <span
          aria-hidden="true"
          className="bg-tint-success text-on-tint-success"
          style={{ width: 28, height: 28, borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", fontSize: 14 }}
        >
          ✓
        </span>
        <p className="text-label text-text" style={{ margin: 0 }}>Nada exigindo ação</p>
        <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: 240, lineHeight: 1.5 }}>
          Sem ROI abaixo da meta, gasto sem conversão ou integração desconectada no período.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
      {visiveis.map((a) => {
        const t = TOM[a.severidade];
        const Conteudo = (
          <>
            <span
              aria-hidden="true"
              className={t.classe}
              style={{ width: 28, height: 28, flex: "none", borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", fontSize: 14 }}
            >
              {t.glifo}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="text-label text-text" style={{ display: "block" }}>
                {/* A severidade também vira TEXTO para leitor de tela: cor e
                    ícone sozinhos não comunicam gravidade (WCAG 1.4.1). */}
                <span className="sr-only">{t.rotulo}: </span>
                {a.titulo}
              </span>
              {a.detalhe && <span className="text-caption text-text-muted" style={{ display: "block" }}>{a.detalhe}</span>}
            </span>
            {a.quando && (
              <span
                className="text-caption text-text-muted"
                /* Alinhado à PRIMEIRA LINHA do texto (`06` §14.3), não ao topo
                   da caixa nem ao centro: com duas linhas de detalhe o carimbo
                   centrado flutua no meio do nada, e colado no topo fica acima
                   da maiúscula do título. */
                style={{ flex: "none", whiteSpace: "nowrap", alignSelf: "flex-start", marginTop: 5 }}
              >
                {a.quando}
              </span>
            )}
          </>
        );

        const estilo: React.CSSProperties = {
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 10px", borderRadius: "var(--tk-radius-controle)",
          background: "var(--tk-surface-hover)", textDecoration: "none",
        };

        return a.href ? (
          <a key={a.id} href={a.href} style={estilo} className="transition-[background-color]">{Conteudo}</a>
        ) : (
          <div key={a.id} style={estilo}>{Conteudo}</div>
        );
      })}

      {/* ── O controle de EXPANSÃO, no rodapé e centrado (`06` §14.2) ────────
          Na referência a lista de alertas tem DOIS controles, e a distinção é
          por posição: `Ver todos` no CABEÇALHO navega para outra tela; o
          `+ N ⌄` no RODAPÉ expande no lugar. Não é acaso — trocar um pelo outro
          promete navegação e entrega expansão.

          🔧 **Aqui só existe o do rodapé, e é decisão com motivo:** não há tela
          de "todos os alertas". Alerta nesta base é DERIVADO do período filtrado
          (`computeDashboard`), não uma linha guardada em lugar nenhum — não há
          para onde navegar. Um `Ver todos` no cabeçalho seria affordance
          mentindo, que é a regra que matou a interação do globo.

          ⚠️ Havia uma prop `aoVerTodos` para isso, com ZERO chamadores. Foi
          removida em vez de mantida "para quando existir": prop inerte é o que
          faz o próximo commit acreditar que o caminho está pronto. */}
      {restantes > 0 && !expandido && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          aria-expanded={false}
          className="text-caption text-primary hover:bg-surface-hover"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            width: "100%",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: "var(--tk-radius-controle)",
            transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
          }}
        >
          + {restantes} {restantes === 1 ? "alerta" : "alertas"}
          <Icone nome="chevronBaixo" tamanho={13} cor="marca" />
        </button>
      )}

      {/* Expandido, o caminho de volta precisa existir: sem ele a lista cresce e
          não encolhe, e o bloco fica ocupando a coluna inteira até recarregar. */}
      {expandido && ordenados.length > limite && (
        <button
          type="button"
          onClick={() => setExpandido(false)}
          aria-expanded
          className="text-caption text-text-muted hover:bg-surface-hover hover:text-text"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            width: "100%",
            background: "none",
            border: 0,
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: "var(--tk-radius-controle)",
            transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
          }}
        >
          Mostrar menos
          <Icone nome="chevronCima" tamanho={13} cor="suave" />
        </button>
      )}
    </div>
  );
}
