"use client";

import { useState, type ReactNode } from "react";

import { sx } from "@/lib/sx";

/**
 * Bloco de código instalável: UM script visível e UM botão de copiar.
 *
 * A alternativa em JavaScript existe porque alguns campos de "script do
 * checkout" de gateway embrulham o conteúdo colado numa tag `<script>` por
 * conta própria — nesse caso um snippet que já traz as próprias tags aninha e
 * não executa. Mas isso é problema NOSSO, não do cliente: ele copia o principal
 * e pronto. A saída de emergência fica fechada, para quem colou e não funcionou.
 */
export function SnippetBox({
  codigo,
  alternativo,
  nota,
}: {
  codigo: string;
  alternativo?: string;
  nota?: ReactNode;
}) {
  const [copiado, setCopiado] = useState<"principal" | "alt" | null>(null);

  function copiar(texto: string, qual: "principal" | "alt") {
    navigator.clipboard.writeText(texto);
    setCopiado(qual);
    setTimeout(() => setCopiado(null), 1500);
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
        onClick={() => copiar(codigo, "principal")}
        disabled={!codigo}
        style={sx("width:fit-content")}
      >
        {copiado === "principal" ? "Copiado!" : "Copiar script"}
      </button>

      {alternativo && (
        <details style={sx("margin-top:2px")}>
          <summary style={sx("cursor:pointer;font-size:12px;color:var(--color-text-muted,#9ca3af)")}>
            Colei e não funcionou?
          </summary>
          <div style={sx("display:flex;flex-direction:column;gap:8px;padding-top:8px")}>
            <p className="card-body" style={sx("margin:0;font-size:12px")}>
              Alguns campos de script (principalmente os de checkout de gateway) aceitam só JavaScript e
              recusam HTML. Se for o seu caso, use esta versão no lugar — ela faz exatamente a mesma coisa.
            </p>
            <pre style={preStyle}>{alternativo}</pre>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => copiar(alternativo, "alt")}
              style={sx("width:fit-content")}
            >
              {copiado === "alt" ? "Copiado!" : "Copiar versão JavaScript"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
