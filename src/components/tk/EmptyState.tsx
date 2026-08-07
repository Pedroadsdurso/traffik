"use client";

import * as React from "react";

/**
 * EmptyState — o estado que os testadores mais veem.
 *
 * 🔴 A REGRA: estado vazio é CONVITE PARA AGIR, não mensagem de erro. "Nenhuma
 * venda com país identificado" diz o que falta e não diz o que fazer — quem lê
 * fica sabendo que a tela está vazia, que era a única coisa que já dava para ver.
 *
 * Por isso `causa` e `acao` são separados de `titulo`:
 *
 *   titulo  o que não há           "Nenhuma venda no período"
 *   causa   POR QUE pode não haver "o país vem do gateway ou do clique rastreado"
 *   acao    o próximo passo        → Conferir integrações
 *
 * ⚠️ `acao` é opcional só porque existe um caso legítimo sem ela: quando a
 * ausência é normal e não há o que fazer ("nenhum reembolso no período" é uma
 * boa notícia). Se você está prestes a omitir a ação por não saber qual é, a
 * resposta é descobrir, não omitir.
 *
 * ⚠️ E ele NÃO serve para erro. Falha de carregamento tem outro tom, outra cor e
 * um botão de tentar de novo — use `ErrorState`.
 */

export function EmptyState({
  titulo,
  causa,
  acao,
  compacto = false,
}: {
  titulo: string;
  causa?: React.ReactNode;
  acao?: { texto: string; href?: string; aoClicar?: () => void };
  compacto?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 6,
        padding: compacto ? "16px 12px" : "28px 20px",
        minHeight: compacto ? 0 : 120,
      }}
    >
      {/* ⚠️ NÃO VOLTE COM UMA PROP `icone` SOLTA. Havia uma, com zero chamadores,
          e ela renderizava o ícone direto sobre o fundo do card — o oposto do
          `06` §13, que exige recipiente tingido (quadrado neutro de 36px para o
          que ILUSTRA UM BLOCO). Se um ícone for pedido aqui um dia, ele nasce
          dentro do recipiente, não ao lado da regra. */}
      <p className="text-label text-text" style={{ margin: 0 }}>{titulo}</p>
      {causa && (
        <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          {causa}
        </p>
      )}
      {acao &&
        (acao.href ? (
          <a className="text-caption text-primary" href={acao.href} style={{ marginTop: 4 }}>
            {acao.texto} →
          </a>
        ) : (
          <button
            type="button"
            onClick={acao.aoClicar}
            className="text-caption text-primary"
            style={{ marginTop: 4, background: "none", border: 0, cursor: "pointer" }}
          >
            {acao.texto} →
          </button>
        ))}
    </div>
  );
}

/**
 * ErrorState — falha de carregamento. Separado do vazio de propósito: um
 * esqueleto que nunca sai e um "sem dados" são indistinguíveis de uma tela
 * travada, e as três coisas pedem reações diferentes de quem está olhando.
 */
export function ErrorState({
  titulo = "Não foi possível carregar",
  detalhe,
  aoTentar,
  compacto = false,
}: {
  titulo?: string;
  detalhe?: React.ReactNode;
  aoTentar?: () => void;
  compacto?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 6,
        padding: compacto ? "16px 12px" : "28px 20px",
      }}
    >
      <span
        aria-hidden="true"
        className="bg-tint-danger text-on-tint-danger"
        style={{ width: 28, height: 28, borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", fontSize: 15 }}
      >
        !
      </span>
      <p className="text-label text-text" style={{ margin: 0 }}>{titulo}</p>
      {detalhe && (
        <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
          {detalhe}
        </p>
      )}
      {aoTentar && (
        <button
          type="button"
          onClick={aoTentar}
          className="text-caption text-primary"
          style={{ marginTop: 4, background: "none", border: 0, cursor: "pointer" }}
        >
          Tentar de novo →
        </button>
      )}
    </div>
  );
}
