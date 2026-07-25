"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { sx } from "@/lib/sx";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Select próprio do Traffik (Bloco 3) — o nativo do navegador não aceita o
 * dropdown escuro nem busca interna.
 *
 * Mantém o essencial de acessibilidade que o nativo dava de graça: papéis
 * `combobox`/`listbox`, navegação por setas, Enter/Esc, Home/End e foco de volta
 * no gatilho ao fechar. A busca só aparece quando a lista é longa o bastante
 * para justificar (`searchThreshold`), como a de contas de anúncio.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  searchThreshold = 8,
  minWidth = 150,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchThreshold?: number;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raizRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const comBusca = options.length >= searchThreshold;
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, busca]);

  const selecionada = options.find((o) => o.value === value);

  // Fecha ao clicar fora ou perder o foco para fora do componente.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // Ao abrir: foca a busca (se houver) e destaca a opção atual.
  useEffect(() => {
    if (!open) return;
    setBusca("");
    const idx = Math.max(0, filtradas.findIndex((o) => o.value === value));
    setAtivo(idx);
    if (comBusca) requestAnimationFrame(() => buscaRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function fechar(devolverFoco = true) {
    setOpen(false);
    if (devolverFoco) gatilhoRef.current?.focus();
  }

  function escolher(v: string) {
    onChange(v);
    fechar();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(i + 1, filtradas.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setAtivo(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setAtivo(filtradas.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const o = filtradas[ativo];
      if (o) escolher(o.value);
    }
  }

  return (
    <div ref={raizRef} style={sx("display:flex;flex-direction:column;gap:3px;position:relative")}>
      <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>{label}</span>

      <button
        ref={gatilhoRef}
        type="button"
        className="tk-select"
        style={sx(`min-width:${minWidth}px`)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listaId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>
          {selecionada?.label ?? "—"}
        </span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className={open ? "tk-caret tk-caret-open" : "tk-caret"} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="tk-pop" role="presentation" onKeyDown={onKeyDown}>
          {comBusca && (
            <input
              ref={buscaRef}
              className="input"
              style={sx("margin-bottom:6px;min-height:32px;font-size:13px")}
              placeholder="Buscar…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAtivo(0);
              }}
              aria-label={`Buscar em ${label}`}
            />
          )}
          <div id={listaId} role="listbox" aria-label={label} style={sx("max-height:240px;overflow:auto")}>
            {filtradas.length === 0 ? (
              <div className="text-muted" style={sx("font-size:12.5px;padding:8px 10px")}>Nada encontrado.</div>
            ) : (
              filtradas.map((o, i) => (
                <div
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={`tk-opt${i === ativo ? " tk-opt-ativa" : ""}`}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(o.value)}
                >
                  <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{o.label}</span>
                  {o.value === value && <span aria-hidden>✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
