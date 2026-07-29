"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { sx } from "@/lib/sx";

/** Origem do dado — vira uma etiqueta colorida no rodapé do balão. */
export type FonteDado = "meta" | "nosso" | "derivada";

const FONTE_META: Record<FonteDado, { cor: string; label: string }> = {
  meta: { cor: "#60a5fa", label: "Meta Ads" },
  nosso: { cor: "#a78bfa", label: "Nosso rastreamento · tempo real" },
  derivada: { cor: "#94a3b8", label: "Calculada" },
};

export interface ConteudoInfo {
  titulo: string;
  /** Parágrafos do corpo. Array em vez de string com `\n` para o espaçamento
   *  entre blocos ser do CSS, não de quebra de linha solta. */
  corpo?: string[];
  /** Lista curta de itens. */
  lista?: string[];
  /** Fórmula do cálculo, em fonte monoespaçada. */
  formula?: string;
  /** Valores que compuseram o resultado AGORA — preenchido em tempo de render. */
  valores?: [rotulo: string, valor: string][];
  fonte?: FonteDado;
  /** Aviso em destaque (âmbar), para limitações e pegadinhas. */
  alerta?: string;
}

const ABRIR_MS = 150;
const FECHAR_MS = 300;
const LARGURA = 300;
const MARGEM = 10;

/**
 * Tooltip explicativo — **o único da ferramenta** para texto de ajuda.
 *
 * Substitui o `title=""` nativo, que tinha três problemas de usabilidade: só
 * aparece depois de ~1s parado, some no primeiro movimento do mouse, e é texto
 * cru sem hierarquia. Nada disso é configurável no atributo nativo.
 *
 * ## Decisões que não são óbvias
 *
 * - **Portal para o `<body>`, obrigatório.** O balão é `position:fixed`, e
 *   qualquer ancestral com `transform` vira o bloco de contenção dele — o
 *   `.page-enter` do shell faz exatamente isso. É a mesma armadilha que já
 *   apareceu no `Drawer` e no `Modal`.
 * - **Fechamento com atraso E ponte de hover.** O balão só fecha 300ms depois
 *   que o mouse sai, e passar o mouse POR DENTRO dele cancela o fechamento.
 *   Sem as duas coisas, um tooltip com link é impossível de alcançar.
 * - **Clique também abre.** Em touch não existe hover; sem isso a explicação
 *   ficaria inacessível no celular. Clique fora fecha.
 * - **É um `<button>`, não um `<span>`.** Entra na ordem de tabulação de graça,
 *   e o balão abre no foco — a alternativa seria refazer teclado na mão.
 */
export function InfoTip({ conteudo, tamanho = 13 }: { conteudo: ConteudoInfo; tamanho?: number }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; setaX: number; acima: boolean } | null>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const balaoRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const cancelar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const abrirComAtraso = () => {
    cancelar();
    timer.current = setTimeout(() => setAberto(true), ABRIR_MS);
  };
  const fecharComAtraso = () => {
    cancelar();
    timer.current = setTimeout(() => setAberto(false), FECHAR_MS);
  };

  /** Mede o gatilho e escolhe o lado que cabe. */
  const posicionar = useCallback(() => {
    const g = gatilhoRef.current?.getBoundingClientRect();
    if (!g) return;
    const alturaEstimada = balaoRef.current?.offsetHeight ?? 160;

    // Horizontal: centraliza no gatilho e depois puxa para dentro da viewport.
    const centro = g.left + g.width / 2;
    let left = centro - LARGURA / 2;
    left = Math.max(MARGEM, Math.min(left, window.innerWidth - LARGURA - MARGEM));

    // Vertical: abre para baixo, e vira para cima quando não cabe. Comparar com
    // o espaço de cima evita virar para um lado ainda mais apertado.
    const espacoAbaixo = window.innerHeight - g.bottom;
    const acima = espacoAbaixo < alturaEstimada + MARGEM && g.top > espacoAbaixo;
    const top = acima ? g.top - alturaEstimada - 8 : g.bottom + 8;

    // A seta segue o gatilho mesmo quando o balão foi empurrado pela borda.
    setPos({ top, left, setaX: Math.max(12, Math.min(centro - left, LARGURA - 12)), acima });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    posicionar();
    // Segunda medição depois de renderizar: a primeira usa altura estimada.
    const t = setTimeout(posicionar, 0);
    const onScroll = () => posicionar();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", onKey);
    const onFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!gatilhoRef.current?.contains(alvo) && !balaoRef.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("mousedown", onFora);
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onFora);
    };
  }, [aberto, posicionar]);

  useEffect(() => cancelar, []);

  const f = conteudo.fonte ? FONTE_META[conteudo.fonte] : null;

  const balao = aberto && pos && (
    <div
      ref={balaoRef}
      id={id}
      role="tooltip"
      // O mouse pode entrar no balão: cancela o fechamento pendente.
      onMouseEnter={cancelar}
      onMouseLeave={fecharComAtraso}
      style={sx(
        `position:fixed;top:${pos.top}px;left:${pos.left}px;width:${LARGURA}px;z-index:1200;` +
          "background:color-mix(in srgb, var(--color-surface) 92%, transparent);backdrop-filter:blur(10px);" +
          "border:1px solid var(--color-border);border-radius:var(--radius-md);" +
          "box-shadow:0 12px 32px rgba(0,0,0,.45);padding:11px 13px;" +
          "font-size:12.5px;line-height:1.5;color:var(--color-text);" +
          "animation:tipEntra 140ms var(--ease-out)",
      )}
    >
      {/* Seta */}
      <span
        aria-hidden
        style={sx(
          `position:absolute;left:${pos.setaX}px;${pos.acima ? "bottom:-5px" : "top:-5px"};` +
            "width:9px;height:9px;transform:translateX(-50%) rotate(45deg);" +
            "background:var(--color-surface);" +
            `border-${pos.acima ? "right" : "left"}:1px solid var(--color-border);` +
            `border-${pos.acima ? "bottom" : "top"}:1px solid var(--color-border)`,
        )}
      />

      <div style={sx("font-weight:700;font-size:13px;margin-bottom:5px")}>{conteudo.titulo}</div>

      {conteudo.corpo?.map((p, i) => (
        <p key={i} style={sx("margin:0 0 6px;color:color-mix(in srgb, var(--color-text) 82%, transparent)")}>{p}</p>
      ))}

      {conteudo.lista && (
        <ul style={sx("margin:0 0 6px;padding-left:16px;color:color-mix(in srgb, var(--color-text) 82%, transparent)")}>
          {conteudo.lista.map((li, i) => (
            <li key={i} style={sx("margin-bottom:2px")}>{li}</li>
          ))}
        </ul>
      )}

      {conteudo.formula && (
        <div style={sx("margin:7px 0;padding:6px 8px;border-radius:var(--radius-sm);background:rgba(0,0,0,.28);border:1px solid var(--color-divider);font-family:var(--font-mono, ui-monospace, monospace);font-size:11.5px;color:var(--color-accent-300)")}>
          {conteudo.formula}
        </div>
      )}

      {conteudo.valores && conteudo.valores.length > 0 && (
        <div style={sx("margin-top:6px;display:flex;flex-direction:column;gap:3px")}>
          <div className="text-muted" style={sx("font-size:10.5px;text-transform:uppercase;letter-spacing:.4px")}>
            Neste período
          </div>
          {conteudo.valores.map(([rot, val]) => (
            <div key={rot} style={sx("display:flex;justify-content:space-between;gap:10px;font-size:11.5px")}>
              <span className="text-muted">{rot}</span>
              <span style={sx("font-variant-numeric:tabular-nums")}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {conteudo.alerta && (
        <div style={sx("margin-top:7px;padding:6px 8px;border-radius:var(--radius-sm);background:rgba(120,53,15,.28);border:1px solid rgba(245,158,11,.32);font-size:11.5px;color:#fcd34d")}>
          {conteudo.alerta}
        </div>
      )}

      {f && (
        <div style={sx("margin-top:8px;padding-top:7px;border-top:1px solid var(--color-divider);display:flex;align-items:center;gap:6px;font-size:11px")}>
          <span style={sx(`width:5px;height:5px;border-radius:50%;background:${f.cor};flex-shrink:0`)} />
          <span className="text-muted">{f.label}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        aria-label={`Explicação: ${conteudo.titulo}`}
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onMouseEnter={abrirComAtraso}
        onMouseLeave={fecharComAtraso}
        onFocus={() => setAberto(true)}
        onBlur={fecharComAtraso}
        // Clique alterna: é o caminho do touch, onde hover não existe.
        onClick={(e) => {
          e.stopPropagation();
          cancelar();
          setAberto((a) => !a);
        }}
        style={sx(
          `display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;` +
            `width:${tamanho}px;height:${tamanho}px;padding:0;border:0;background:none;cursor:help;` +
            `color:var(--color-text-muted);opacity:${aberto ? 1 : 0.5};transition:opacity var(--dur-fast) var(--ease-out);vertical-align:middle`,
        )}
      >
        <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill="none" stroke="currentColor" strokeWidth={2.1} aria-hidden>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v5" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1.05" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {typeof document !== "undefined" && balao ? createPortal(balao, document.body) : null}
    </>
  );
}
