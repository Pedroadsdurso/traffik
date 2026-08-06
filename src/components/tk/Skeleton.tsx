"use client";

import * as React from "react";

/**
 * Skeleton e Separator — os dois primitivos "de moldura".
 *
 * ── Skeleton ────────────────────────────────────────────────────────────────
 * ⚠️ ELE TEM DE TER O TAMANHO DO QUE VAI CHEGAR. Um esqueleto de altura errada
 * é pior que um "carregando…": a página salta quando o dado entra, e o salto é
 * exatamente o que ele existia para evitar. Por isso não há variante "genérica"
 * — quem usa informa a forma.
 *
 * ⚠️ E ele NÃO é o estado de "deu erro" nem de "não tem nada". Um esqueleto que
 * nunca sai é indistinguível de uma tela travada. Quando a busca falha ou volta
 * vazia, o lugar é uma mensagem, não um esqueleto eterno.
 *
 * O `aria-hidden` + `aria-busy` no contêiner é o que impede o leitor de tela de
 * anunciar caixas vazias: quem escuta ouve "carregando", não sete retângulos.
 */

export function Skeleton({
  largura = "100%",
  altura = 16,
  circulo = false,
  style,
}: {
  largura?: number | string;
  altura?: number | string;
  circulo?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className="bg-surface-hover tk-skeleton"
      style={{
        display: "block",
        width: largura,
        height: altura,
        borderRadius: circulo ? "var(--tk-radius-pill)" : "var(--tk-radius-controle)",
        ...style,
      }}
    />
  );
}

/**
 * O contêiner que anuncia a espera. Sem ele, o leitor de tela lê a tela como
 * vazia — que é diferente de "está vindo".
 */
export function AreaCarregando({
  carregando,
  esqueleto,
  children,
  rotulo = "Carregando",
}: {
  carregando: boolean;
  esqueleto: React.ReactNode;
  children: React.ReactNode;
  rotulo?: string;
}) {
  if (!carregando) return <>{children}</>;
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
      {esqueleto}
    </div>
  );
}

/**
 * ── Separator ───────────────────────────────────────────────────────────────
 * `decorativo` decide se ele existe para o leitor de tela. A regra: se o
 * separador só desenha, ele é decorativo (`role="none"`); se ele marca uma
 * mudança real de assunto que a hierarquia de títulos não marca, ele é
 * `separator`. Anunciar "separador" a cada linha de uma lista é ruído.
 */
export function Separator({
  vertical = false,
  decorativo = true,
  espaco = "var(--tk-gap-grid)",
}: {
  vertical?: boolean;
  decorativo?: boolean;
  espaco?: number | string;
}) {
  return (
    <div
      role={decorativo ? "none" : "separator"}
      aria-orientation={!decorativo && vertical ? "vertical" : undefined}
      className="bg-border"
      style={
        vertical
          ? { width: 1, alignSelf: "stretch", margin: `0 ${typeof espaco === "number" ? `${espaco}px` : espaco}`, flex: "none" }
          : { height: 1, width: "100%", margin: `${typeof espaco === "number" ? `${espaco}px` : espaco} 0` }
      }
    />
  );
}
