"use client";

import { sx } from "@/lib/sx";
import { DashboardGrid } from "../DashboardGrid";
import type { TraffikView } from "../useTraffikState";

function Filtro({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:3px")}>
      <span style={sx("font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.5")}>{label}</span>
      <select className="input" style={sx("width:auto")} value={value} onChange={onChange}>
        {children}
      </select>
    </div>
  );
}

export function DashboardView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-6)")}>
      <div style={sx("display:flex;gap:var(--space-3);flex-wrap:wrap")}>
        <Filtro label="Período" value={v.dashPeriod} onChange={v.onDashPeriod}>
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="custom">Personalizado</option>
        </Filtro>
        <Filtro label="Conta de anúncio" value={v.dashAccount} onChange={v.onDashAccount}>
          <option value="todas">Todas as contas</option>
          {v.filterAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Filtro>
        <Filtro label="Produto" value={v.dashProduct} onChange={v.onDashProduct}>
          <option value="todos">Todos os produtos</option>
          {v.filterProducts.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Filtro>
        <Filtro label="Fonte de tráfego" value={v.dashSource} onChange={v.onDashSource}>
          <option value="todas">Todas as fontes</option>
          {v.filterSources.map((src) => (
            <option key={src} value={src}>{src}</option>
          ))}
        </Filtro>
      </div>

      {/* Todo o conteúdo do dashboard vive no grid arrastável (Bloco 2). */}
      <DashboardGrid v={v} />
    </div>
  );
}
