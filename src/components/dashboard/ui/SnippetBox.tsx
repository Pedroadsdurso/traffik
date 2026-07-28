"use client";

import { useState, type ReactNode } from "react";

import { sx } from "@/lib/sx";

/**
 * Bloco de código instalável: UM script e UM botão de copiar.
 *
 * Sem formato alternativo, de propósito. O snippet gerado é um IIFE em
 * JavaScript puro, que funciona tanto no `<head>` do site quanto no campo de
 * script de gateway/checkout — como é universal, não há o que escolher. Chegou a
 * existir aqui um seletor `HTML | JavaScript` e depois um "Colei e não
 * funcionou?"; os dois transformavam um detalhe de bastidor em decisão de quem
 * só quer copiar e colar. **Não reintroduzir ramificação nesta tela.**
 */
export function SnippetBox({ codigo, nota }: { codigo: string; nota?: ReactNode }) {
  const [copiado, setCopiado] = useState(false);

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  const preStyle = sx(
    "background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:11px;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-all;margin:0;max-height:200px;overflow:auto",
  );

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-2)")}>
      <pre style={preStyle}>{codigo || "…"}</pre>
      {nota}
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => copiar(codigo)}
        disabled={!codigo}
        style={sx("width:fit-content")}
      >
        {copiado ? "Copiado!" : "Copiar script"}
      </button>
    </div>
  );
}
