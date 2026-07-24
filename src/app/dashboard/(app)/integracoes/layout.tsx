"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { sx } from "@/lib/sx";

const SUBTABS = [
  { href: "/dashboard/integracoes/anuncios", label: "Anúncios" },
  { href: "/dashboard/integracoes/webhooks", label: "Webhooks" },
  { href: "/dashboard/integracoes/utms", label: "UTMs" },
  { href: "/dashboard/integracoes/pixel", label: "Pixel" },
  { href: "/dashboard/integracoes/testes", label: "Testes" },
];

export default function IntegracoesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div style={sx("display:flex;gap:var(--space-2);width:100%")}>
        {SUBTABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              style={sx(
                `flex:1;text-align:center;padding:var(--space-3);border-radius:var(--radius-md);font-size:14px;text-decoration:none;border:1px solid ${
                  active ? "var(--color-accent)" : "var(--color-divider)"
                };${active ? "background:var(--color-accent-800);color:var(--color-accent-100);" : "background:var(--color-surface);color:var(--color-text);opacity:.85;"}`,
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
