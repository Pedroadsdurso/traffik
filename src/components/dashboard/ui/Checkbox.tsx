"use client";

import { sx } from "@/lib/sx";

/**
 * Checkbox e radio próprios do Trackhub.
 *
 * O nativo não aceita a cor da marca no estado marcado nem transição, e ao lado
 * dos componentes já customizados (Select, DateRangePicker) ele denuncia a
 * mistura. O `<input>` real continua ali, só visualmente escondido — é ele que
 * entrega foco por teclado, espaço para marcar e leitura por leitor de tela.
 * Recriar isso com `<div role="checkbox">` seria trocar acessibilidade de graça
 * por trabalho.
 *
 * ⚠️ O alvo de clique é o `<label>` inteiro, não só o quadradinho: 16px é
 * pequeno demais para o mouse e muito pequeno para o dedo.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  dica,
  disabled = false,
  tipo = "checkbox",
  rotuloAcessivel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  /** Segunda linha, menor — a consequência de marcar. */
  dica?: React.ReactNode;
  disabled?: boolean;
  tipo?: "checkbox" | "radio";
  /**
   * Para quando NÃO há texto visível — a coluna de seleção de uma tabela, por
   * exemplo. Sem isto o leitor de tela anuncia "caixa de seleção" e nada mais.
   */
  rotuloAcessivel?: string;
}) {
  const raio = tipo === "radio" ? "50%" : "5px";

  return (
    <label
      style={sx(
        "display:flex;align-items:flex-start;gap:9px;padding:5px 0;" +
          (disabled ? "opacity:.45;cursor:not-allowed" : "cursor:pointer"),
      )}
    >
      <input
        type={tipo}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={rotuloAcessivel}
        // Escondido do olho, presente para o teclado e o leitor de tela.
        style={sx("position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none")}
      />
      <span
        aria-hidden
        style={sx(
          `flex:none;width:17px;height:17px;margin-top:1px;border-radius:${raio};display:grid;place-items:center;` +
            "transition:background var(--dur-fast) var(--ease-out),border-color var(--dur-fast) var(--ease-out);" +
            (checked
              ? "background:var(--color-accent);border:1px solid var(--color-accent)"
              : "background:var(--color-bg);border:1px solid var(--color-divider)"),
        )}
      >
        {checked &&
          (tipo === "radio" ? (
            <span style={sx("width:7px;height:7px;border-radius:50%;background:var(--color-bg)")} />
          ) : (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--color-bg)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ))}
      </span>
      <span style={sx("min-width:0;font-size:13px;line-height:1.45")}>
        {label}
        {dica && (
          <span className="text-muted" style={sx("display:block;font-size:11.5px;margin-top:1px")}>
            {dica}
          </span>
        )}
      </span>
    </label>
  );
}
