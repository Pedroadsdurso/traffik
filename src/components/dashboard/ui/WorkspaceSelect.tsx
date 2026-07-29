"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspaceDTO } from "@/lib/actions/workspaces";
import { sx } from "@/lib/sx";

/** Acima disto a lista ganha campo de busca — abaixo, rolar é mais rápido. */
const LIMIAR_BUSCA = 6;

/**
 * Seletor de Área de Trabalho, no topo da sidebar.
 *
 * "Todas as áreas" é sempre a primeira opção e o padrão: uma conta sem área
 * nenhuma continua funcionando exatamente como antes, e quem exclui a última
 * área não fica sem lugar para voltar.
 *
 * Áreas arquivadas não aparecem aqui (só na tela de gerenciar) — arquivar
 * existe justamente para tirar da troca do dia a dia sem perder a configuração.
 */
export function WorkspaceSelect({
  areas,
  ativa,
  onTrocar,
}: {
  areas: WorkspaceDTO[];
  ativa: string | null;
  onTrocar: (id: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const visiveis = areas.filter((a) => !a.archived);
  const atual = ativa ? visiveis.find((a) => a.id === ativa) ?? null : null;
  const filtradas = busca.trim()
    ? visiveis.filter((a) => a.name.toLowerCase().includes(busca.trim().toLowerCase()))
    : visiveis;

  const escolher = (id: string | null) => {
    onTrocar(id);
    setAberto(false);
    setBusca("");
  };

  const ponto = (cor: string | null) => (
    <span aria-hidden style={sx(`width:8px;height:8px;border-radius:3px;flex-shrink:0;background:${cor || "var(--color-neutral-400,#94a3b8)"}`)} />
  );

  return (
    <div ref={raiz} style={sx("position:relative")}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={atual ? `Área ativa: ${atual.name}` : "Vendo todas as áreas"}
        style={sx(
          "width:100%;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-md);" +
            "background:var(--color-surface-2);border:1px solid var(--color-border);cursor:pointer;" +
            "color:var(--color-text);font-size:13px;text-align:left;transition:border-color var(--dur-fast) var(--ease-out)",
        )}
      >
        {atual ? ponto(atual.color) : (
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden style={{ flexShrink: 0, opacity: 0.6 }}>
            <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        )}
        <span style={sx("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600")}>
          {atual?.name ?? "Todas as áreas"}
        </span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.2}
          aria-hidden style={{ flexShrink: 0, opacity: 0.55, transform: aberto ? "rotate(180deg)" : undefined, transition: "transform var(--dur-fast)" }}>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {aberto && (
        <div role="listbox"
          style={sx(
            "position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:60;max-height:320px;overflow:auto;" +
              "background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);" +
              "box-shadow:0 12px 30px rgba(0,0,0,.42);padding:5px",
          )}
        >
          {visiveis.length >= LIMIAR_BUSCA && (
            <input
              className="input"
              autoFocus
              placeholder="Buscar área…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={sx("width:100%;margin-bottom:5px;font-size:12.5px;min-height:30px")}
            />
          )}

          <button type="button" role="option" aria-selected={ativa === null} onClick={() => escolher(null)}
            style={sx(
              `width:100%;display:flex;align-items:center;gap:8px;padding:7px 9px;border:0;border-radius:var(--radius-sm);cursor:pointer;font-size:12.5px;text-align:left;color:var(--color-text);background:${ativa === null ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "transparent"}`,
            )}>
            <span style={sx("flex:1")}>Todas as áreas</span>
            {ativa === null && <span aria-hidden style={sx("color:var(--color-accent-300)")}>✓</span>}
          </button>

          {filtradas.length > 0 && <div style={sx("height:1px;background:var(--color-divider);margin:4px 2px")} />}

          {filtradas.map((a) => (
            <button key={a.id} type="button" role="option" aria-selected={ativa === a.id} onClick={() => escolher(a.id)}
              style={sx(
                `width:100%;display:flex;align-items:center;gap:8px;padding:7px 9px;border:0;border-radius:var(--radius-sm);cursor:pointer;font-size:12.5px;text-align:left;color:var(--color-text);background:${ativa === a.id ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : "transparent"}`,
              )}>
              {ponto(a.color)}
              <span style={sx("flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{a.name}</span>
              {ativa === a.id && <span aria-hidden style={sx("color:var(--color-accent-300)")}>✓</span>}
            </button>
          ))}

          {busca.trim() && filtradas.length === 0 && (
            <div className="text-muted" style={sx("font-size:12px;padding:8px 9px")}>Nenhuma área com esse nome.</div>
          )}

          <div style={sx("height:1px;background:var(--color-divider);margin:4px 2px")} />
          <a href="/dashboard/areas"
            style={sx("display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:var(--radius-sm);font-size:12.5px;color:var(--color-text-muted);text-decoration:none")}>
            <span aria-hidden>⚙</span> Gerenciar áreas
          </a>
        </div>
      )}
    </div>
  );
}
