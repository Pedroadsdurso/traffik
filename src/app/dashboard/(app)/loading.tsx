import { sx } from "@/lib/sx";

/**
 * Fallback mostrado enquanto o segmento da rota carrega. Como o shell (sidebar
 * + header) vive no layout e é preservado entre rotas irmãs, isto aparece
 * **na hora** ao clicar num link — antes só ficava tudo parado até o servidor
 * responder, que era a maior parte da sensação de lentidão.
 *
 * O esqueleto imita o formato dos cards para a troca não "pular".
 */
export default function Loading() {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      {/* Faixa de KPIs */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-3)")}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton" style={sx("height:96px")} />
        ))}
      </div>

      {/* Bloco principal */}
      <div className="skeleton" style={sx("height:280px")} />

      {/* Dois blocos lado a lado */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-3)")}>
        <div className="skeleton" style={sx("height:180px")} />
        <div className="skeleton" style={sx("height:180px")} />
      </div>
    </div>
  );
}
