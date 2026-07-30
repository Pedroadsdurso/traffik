"use client";

import { useEffect, useState } from "react";

import { getUtmCodes, type UtmCodesDTO } from "@/lib/actions/utm";
import { getPublicAppUrl } from "@/lib/appUrl";
import { backRedirectScript, utmScript } from "@/lib/utm/scripts";
import { CONFIG } from "@/lib/explicacoes";
import { sx } from "@/lib/sx";
import { InfoTip } from "../../ui/InfoTip";
import { LogoGateway } from "../../ui/LogoGateway";
import { Modal } from "../../ui/Modal";
import { SnippetBox } from "../../ui/SnippetBox";

type Destino = "hotmart" | "cartpanda" | "outros";
const DESTINOS: { id: Destino; label: string }[] = [
  { id: "hotmart", label: "Hotmart" },
  { id: "cartpanda", label: "Cartpanda" },
  { id: "outros", label: "Outros" },
];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─────────────────────────── Bloco 1: Códigos ───────────────────────────

function CodigosBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<Destino>("hotmart");
  const [copied, setCopied] = useState(false);

  const code = codes ? codes[dest] : "";

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Códigos</div>
          <div className="card-title">Parâmetros para o Facebook Ads</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Cole estes parâmetros no campo <strong>“Parâmetros de URL”</strong> do seu anúncio. O Facebook
            preenche campanha/conjunto/anúncio automaticamente, e nós cruzamos a venda com o criativo.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)} disabled={!codes} style={sx("white-space:nowrap")}>
          Ver opções
        </button>
      </div>

      {open && codes && (
        <Modal
          aberta
          onClose={() => setOpen(false)}
          largura={640}
          titulo="Parâmetros de URL"
          descricao="Cole no campo “Parâmetros de URL” do seu anúncio no Facebook Ads."
          rodape={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Fechar</button>
              <button className="btn btn-primary" type="button" onClick={copy}>{copied ? "Copiado!" : "Copiar"}</button>
            </>
          }
        >
          <div style={sx("display:flex;gap:8px")}>
            {DESTINOS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDest(d.id)}
                style={sx(
                  `flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:9px;border-radius:9px;font-size:13px;cursor:pointer;border:1px solid ${dest === d.id ? "var(--color-accent,#a78bfa)" : "var(--color-border)"};background:${dest === d.id ? "var(--color-accent-soft,rgba(139,92,246,.12))" : "transparent"};color:var(--color-text)`,
                )}
              >
                {d.id !== "outros" && <LogoGateway id={d.id} nome={d.label} tamanho={22} />}
                {d.label}
              </button>
            ))}
          </div>
          <pre
            style={sx("background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:11.5px;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-all;margin:0;max-height:260px;overflow:auto")}
          >
            {code}
          </pre>
          <p className="text-muted" style={sx("font-size:11.5px;margin:0;line-height:1.5")}>
            {dest === "hotmart"
              ? "O xcod concatena tudo com um separador único da sua conta, usado no parsing reverso."
              : dest === "cartpanda"
                ? "O cid identifica sua conta na Traffik para atribuição."
                : "Formato genérico de UTMs para qualquer plataforma."}
          </p>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────── Bloco 2: Scripts ───────────────────────────

function ScriptsBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [backUrl, setBackUrl] = useState("");

  // O script leva a ÁREA ATIVA. Instalado na página de vendas daquela operação,
  // ele faz o tráfego não atribuível (orgânico/direto) cair nela em vez de na
  // Principal. Tráfego pago já era separado pela campanha.
  const snippet = codes ? utmScript(codes.accountId, getPublicAppUrl(), codes.workspaceId) : "";
  // Área secundária sem nenhum clique carimbado = o script dela ainda não foi
  // instalado. Na Principal isso é normal (ela é o catch-all do legado).
  const faltaInstalar = !!codes && !codes.ehPrincipal && codes.cliquesComArea === 0;

  function baixarBack() {
    download("traffik-back-redirect.js", backRedirectScript(backUrl));
  }

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div>
        <div className="card-kicker">Scripts</div>
        <div className="card-title">
          Instale na página de vendas de <strong>{codes?.workspaceName ?? "—"}</strong>
        </div>
        <div style={sx("display:flex;align-items:center;gap:5px;margin-top:6px")}>
          <span className="card-body">
            Este script é <strong>desta área</strong>. Instale na página de vendas desta operação.
          </span>
          <InfoTip conteudo={CONFIG.utmPorArea!} tamanho={12} />
        </div>
      </div>

      {faltaInstalar && (
        <div
          style={sx(
            "display:flex;gap:10px;align-items:flex-start;padding:var(--space-3);border-radius:var(--radius-md);" +
              "background:color-mix(in srgb, #f59e0b 12%, transparent);border:1px solid color-mix(in srgb, #f59e0b 45%, transparent)",
          )}
        >
          <span aria-hidden style={sx("font-size:15px;line-height:1.2")}>⚠️</span>
          <div style={sx("font-size:13px;line-height:1.55")}>
            <strong>Esta área ainda está no script antigo.</strong> Nenhum clique chegou
            carimbado com ela até agora.
            <div className="text-muted" style={sx("margin-top:4px")}>
              O script antigo continua funcionando — o tráfego sem campanha atribuível dele
              cai na área Principal. Copie o script abaixo e substitua o que está instalado na
              página de vendas desta operação.
            </div>
          </div>
        </div>
      )}

      <div style={sx("display:flex;flex-direction:column;gap:var(--space-2)")}>
        <div style={sx("font-size:14px;font-weight:600")}>Script de UTMs</div>
        <p className="card-body" style={sx("margin:0")}>
          Captura UTMs + fbclid, salva em cookie de 30 dias, propaga para os links de checkout e envia o
          clique para a Traffik.
        </p>
        <p className="card-body" style={sx("margin:0")}>
          Cole antes de <code>&lt;/head&gt;</code> do seu site (ou no campo de script do seu
          gateway/checkout). É o código completo — não depende de nenhum arquivo externo.
        </p>
        {getPublicAppUrl().includes("localhost") && (
          <p className="card-body" style={sx("margin:0;font-size:12px;color:var(--color-warning,#fbbf24)")}>
            O script aponta para <code>{getPublicAppUrl()}</code>, um endereço local. Defina{" "}
            <code>NEXT_PUBLIC_APP_URL</code> com o domínio de produção e copie de novo antes de instalar.
          </p>
        )}
        <SnippetBox codigo={snippet} />
      </div>

      <div style={sx("border-top:1px solid var(--color-border);padding-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)")}>
        <div style={sx("font-size:14px;font-weight:600")}>Script de Back Redirect</div>
        <p className="card-body" style={sx("margin:0")}>
          Ao clicar em “voltar”, redireciona o visitante para a URL abaixo preservando os UTMs.
        </p>
        <div className="field">
          <label>URL de destino</label>
          <input className="input" value={backUrl} onChange={(e) => setBackUrl(e.target.value)} placeholder="https://seusite.com/oferta-especial" />
        </div>
        <button className="btn btn-secondary" type="button" onClick={baixarBack} disabled={!backUrl.trim()} style={sx("width:fit-content")}>
          Baixar traffik-back-redirect.js
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── View ───────────────────────────

export function UtmsView() {
  const [codes, setCodes] = useState<UtmCodesDTO | null>(null);

  useEffect(() => {
    let alive = true;
    getUtmCodes()
      .then((c) => {
        if (alive) setCodes(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={sx("display:grid;gap:var(--space-4);align-items:start")}>
      {/* ⚠️ O aviso "este script é o mesmo em todas as áreas" foi REMOVIDO em
          29/07/2026 — ele era da Sessão 2 e a Sessão 3 reverteu a decisão: o
          script passou a ser POR ÁREA (`ws` no payload do clique). Ficaram os
          dois na tela por um deploy, se contradizendo. Se um dia o script
          voltar a ser global, o aviso volta AQUI e sai do `ScriptsBlock` —
          nunca os dois. */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:var(--space-4);align-items:start")}>
        <CodigosBlock codes={codes} />
        <ScriptsBlock codes={codes} />
      </div>
    </div>
  );
}
