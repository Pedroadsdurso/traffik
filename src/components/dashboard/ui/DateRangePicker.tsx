"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  atalhosDePeriodo,
  formatarIntervalo,
  fromISO,
  gradeDoMes,
  toISO,
  type DateRange,
} from "@/lib/dateRange";
import { sx } from "@/lib/sx";

// Reexporta para quem já importava daqui (a DashboardView usa os dois).
export { formatarIntervalo, toISO };
export type { DateRange };

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function DateRangePicker({
  value,
  onApply,
  onCancel,
}: {
  value: DateRange | null;
  onApply: (r: DateRange) => void;
  onCancel: () => void;
}) {
  const hoje = useMemo(() => new Date(), []);
  const inicial = value ? fromISO(value.from) : hoje;

  const [ano, setAno] = useState(inicial.getFullYear());
  const [mes, setMes] = useState(inicial.getMonth());
  /** Enquanto só a primeira ponta foi clicada, `to` fica null. */
  const [from, setFrom] = useState<string | null>(value?.from ?? null);
  const [to, setTo] = useState<string | null>(value?.to ?? null);
  /** Dia sob o mouse, para pré-visualizar o intervalo antes do 2º clique. */
  const [hover, setHover] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const anos = useMemo(() => {
    const atual = hoje.getFullYear();
    return Array.from({ length: 7 }, (_, i) => atual - 5 + i);
  }, [hoje]);

  function clicarDia(d: Date) {
    const iso = toISO(d);
    // 1º clique (ou recomeço) define o início; 2º fecha o intervalo.
    if (!from || (from && to)) {
      setFrom(iso);
      setTo(null);
      return;
    }
    if (iso < from) {
      setFrom(iso);
      setTo(from);
    } else {
      setTo(iso);
    }
  }

  const fimEfetivo = to ?? hover;
  function estado(d: Date): { dentro: boolean; ponta: boolean } {
    const iso = toISO(d);
    if (!from) return { dentro: false, ponta: false };
    const a = from;
    const b = fimEfetivo ?? from;
    const ini = a < b ? a : b;
    const fim = a < b ? b : a;
    return { dentro: iso > ini && iso < fim, ponta: iso === a || iso === (to ?? "") };
  }

  const grade = gradeDoMes(ano, mes);
  const podeAplicar = Boolean(from);

  function navegar(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <div ref={raizRef} className="tk-pop tk-calendario" role="dialog" aria-label="Selecionar período">
      <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
        {/* Atalhos */}
        <div style={sx("display:flex;flex-direction:column;gap:2px;min-width:140px")}>
          {atalhosDePeriodo().map((a) => (
            <button
              key={a.label}
              type="button"
              className="tk-atalho"
              onClick={() => {
                const r = a.range();
                setFrom(r.from);
                setTo(r.to);
                const d = fromISO(r.from);
                setAno(d.getFullYear());
                setMes(d.getMonth());
              }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Calendário */}
        <div style={sx("display:flex;flex-direction:column;gap:8px")}>
          <div style={sx("display:flex;align-items:center;gap:6px")}>
            <button type="button" className="btn btn-ghost" onClick={() => navegar(-1)} aria-label="Mês anterior" style={sx("padding:4px 8px")}>
              ‹
            </button>
            <select
              className="input"
              style={sx("width:auto;min-height:30px;font-size:13px")}
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              aria-label="Mês"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select
              className="input"
              style={sx("width:auto;min-height:30px;font-size:13px")}
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              aria-label="Ano"
            >
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost" onClick={() => navegar(1)} aria-label="Próximo mês" style={sx("padding:4px 8px")}>
              ›
            </button>
          </div>

          <div className="tk-grade">
            {DIAS.map((d, i) => (
              <span key={i} className="tk-grade-cab" aria-hidden>{d}</span>
            ))}
            {grade.map((d, i) =>
              d === null ? (
                <span key={`v${i}`} />
              ) : (
                (() => {
                  const iso = toISO(d);
                  const { dentro, ponta } = estado(d);
                  const futuro = iso > toISO(hoje);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={futuro}
                      className={`tk-dia${ponta ? " tk-dia-ponta" : ""}${dentro ? " tk-dia-dentro" : ""}`}
                      onClick={() => clicarDia(d)}
                      onMouseEnter={() => setHover(iso)}
                      onMouseLeave={() => setHover(null)}
                      aria-label={iso}
                    >
                      {d.getDate()}
                    </button>
                  );
                })()
              ),
            )}
          </div>
        </div>
      </div>

      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap")}>
        <span className="text-muted" style={sx("font-size:12px")}>
          {from ? formatarIntervalo({ from, to: to ?? from }) : "Escolha a data inicial"}
        </span>
        <div style={sx("display:flex;gap:var(--space-2)")}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!podeAplicar}
            onClick={() => from && onApply({ from, to: to ?? from })}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
