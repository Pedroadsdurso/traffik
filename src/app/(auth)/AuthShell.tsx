import Image from "next/image";
import type { ReactNode } from "react";

import { sx } from "@/lib/sx";

/** Moldura compartilhada por /login e /signup. */
export function AuthShell({
  kicker,
  title,
  subtitle,
  children,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      style={sx(
        "min-height:100vh;display:grid;place-items:center;padding:var(--space-8);background:radial-gradient(1200px 600px at 50% -10%, var(--color-accent-900), var(--color-bg) 60%)",
      )}
    >
      <div style={sx("width:min(400px,100%);display:flex;flex-direction:column;gap:var(--space-6)")}>
        <div style={sx("display:flex;justify-content:center")}>
          <Image
            src="/logos/traffik-claro.webp"
            alt="Trackhub"
            width={904}
            height={230}
            priority
            style={{ width: 168, height: "auto", objectFit: "contain" }}
          />
        </div>

        <div className="card elev-md" style={sx("padding:var(--space-6);gap:var(--space-3)")}>
          <div className="card-kicker">{kicker}</div>
          <h4 style={sx("margin:0")}>{title}</h4>
          <p style={sx("margin:0;font-size:13px;opacity:.7")}>{subtitle}</p>
          <hr className="hr" style={sx("margin:var(--space-3) 0")} />
          {children}
        </div>

        <p style={sx("margin:0;text-align:center;font-size:13px;opacity:.75")}>{footer}</p>
      </div>
    </div>
  );
}
