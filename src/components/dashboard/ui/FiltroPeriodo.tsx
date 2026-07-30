"use client";

import { useEffect, useRef, useState } from "react";

import { formatarIntervalo } from "@/lib/dateRange";
import { PERIODOS, type PeriodoNome } from "@/lib/periodo";
import { sx } from "@/lib/sx";
import { DateRangePicker } from "./DateRangePicker";
import { Select } from "./Select";

/**
 * Seletor de período — **o único da ferramenta**.
 *
 * ## Por que existe
 *
 * Isto era uma função `FiltroPeriodo` escondida dentro de `DashboardView.tsx`,
 * então só o Dashboard tinha calendário. O Gerenciador de Anúncios e os Criativos
 * tinham cada um o seu `<Select>` com **três** opções (Hoje / 7 dias / 30 dias) e
 * nenhuma forma de escolher um intervalo. Três telas de análise, três filtros de
 * data diferentes.
 *
 * Agora é um componente, e as opções vêm de `lib/periodo.ts` — a mesma lista que
 * o servidor usa para resolver a janela. Acrescentar um período é uma linha lá, e
 * as três telas ganham juntas.
 *
 * ## ⚠️ O período viaja como NOME, não como intervalo de datas
 *
 * `onChange` devolve `"mesPassado"`, não `{ from, to }`. Quem calcula o intervalo
 * é o servidor, com o **fuso do usuário** — que o navegador não conhece de forma
 * confiável. Resolver a data no cliente foi exatamente o bug de "o hoje do
 * calendário era o do navegador" registrado no CLAUDE.md.
 *
 * A exceção é `custom`, que **é** um intervalo por definição: aí vão `from`/`to`,
 * escolhidos no calendário.
 */
export function FiltroPeriodo({
  periodo,
  from,
  to,
  timezone,
  onChange,
  minWidth = 170,
  label = "Período",
}: {
  periodo: PeriodoNome;
  from?: string | null;
  to?: string | null;
  /** Fuso do usuário — o calendário precisa dele para saber que dia é "hoje". */
  timezone: string;
  onChange: (periodo: PeriodoNome, from?: string, to?: string) => void;
  minWidth?: number;
  label?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function onDown(e: MouseEvent) {
      if (!raizRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [aberto]);

  // Com intervalo escolhido, o gatilho mostra as DATAS em vez de "Personalizado":
  // "12/06 – 18/06" diz o que está filtrado; "Personalizado" não diz nada.
  const opcoes = PERIODOS.map((p) =>
    p.value === "custom" && periodo === "custom" && from
      ? { ...p, label: formatarIntervalo({ from, to: to ?? from }) }
      : p,
  );

  return (
    <div ref={raizRef} style={sx("position:relative")}>
      <Select
        label={label}
        value={periodo}
        options={opcoes}
        minWidth={minWidth}
        onChange={(val) => {
          // "Personalizado" não aplica nada sozinho: abre o calendário e espera o
          // Aplicar. Trocar o período aqui recarregaria o painel duas vezes.
          if (val === "custom") {
            setAberto(true);
            return;
          }
          onChange(val as PeriodoNome);
        }}
      />
      {aberto && (
        <DateRangePicker
          timezone={timezone}
          value={from ? { from, to: to ?? from } : null}
          onCancel={() => setAberto(false)}
          onApply={(r) => {
            onChange("custom", r.from, r.to);
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}
