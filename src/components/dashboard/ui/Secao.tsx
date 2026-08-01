"use client";

import type { ReactNode } from "react";

import { sx } from "@/lib/sx";

/**
 * Seção de gaveta com título e um **selo de região**.
 *
 * ## 🔴 O selo é da REGIÃO, nunca do campo
 *
 * Marcar campo a campo produziria ~15 selos numa gaveta de 5 blocos — poluição
 * que se aprende a ignorar, que é o oposto do objetivo. Com um selo por região,
 * a regra fica legível de uma olhada: **tudo que tem a mesma consequência está
 * junto.**
 *
 * ⚠️ Isso é uma restrição de layout, não decoração: se um campo migrar para uma
 * região cujo selo não descreve a consequência dele, **o selo passa a mentir**.
 * Ao mover campo de lugar, confira em qual lado ele cai.
 *
 * ## Por que é compartilhado
 *
 * Nasceu local na gaveta do Pixel (`⟳ muda o script` × `⚡ vale na hora`) e a
 * gaveta de Regras precisou do mesmo desenho com outro par de selos
 * (`⚠ mexe na sua conta do Facebook` × `⚡ só decide quando roda`). Duas cópias
 * do mesmo cabeçalho divergem no primeiro ajuste de espaçamento — e o valor
 * deste padrão está justamente em ele ser reconhecível de uma gaveta para a
 * outra.
 */
export interface SeloDeRegiao {
  /** Texto curto do selo, com o ícone-caractere na frente. */
  texto: string;
  /** O que a região faz, no `title`. É onde a consequência é explicada. */
  ajuda: string;
  /** `aviso` = âmbar (a região com consequência). `neutro` = discreto. */
  tom?: "aviso" | "neutro";
}

export function Secao({
  titulo,
  selo,
  children,
}: {
  titulo: string;
  selo?: SeloDeRegiao;
  children: ReactNode;
}) {
  return (
    <section
      style={sx(
        "display:flex;flex-direction:column;gap:var(--space-2);" +
          "padding-top:var(--space-3);border-top:1px solid var(--color-divider)",
      )}
    >
      <header style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap")}>
        <span style={sx("font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.75")}>
          {titulo}
        </span>
        {selo && (
          <span
            title={selo.ajuda}
            className={selo.tom === "aviso" ? undefined : "text-muted"}
            style={sx(
              `font-size:11px;white-space:nowrap${
                selo.tom === "aviso" ? ";color:var(--color-warning,#fbbf24)" : ""
              }`,
            )}
          >
            {selo.texto}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}
